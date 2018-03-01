/* Amazon Alexa App ID */
var APP_ID = 'Raspberrypi3';

/* Include skill, Alexa responses, and DB logic files */
var AlexaSkill = require('./AlexaSkill.js');
var Responses = require('./responses.js');
var Database = require('./database.js');

var database = new Database()

/* Used for 'Yes' intent logic to distinguish if the person at the door is recognized or not */
var AskIntent = {
  INIT: 1,
  RECOGNIZE: 2,
  NO_RECOGNIZE: 3,
}; 

/* Initiate skill */
var whosDoor = function (){
    AlexaSkill.call(this, APP_ID);
}

whosDoor.prototype = Object.create(AlexaSkill.prototype);
whosDoor.prototype.constructor = whosDoor;

whosDoor.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session){
    console.log("WhosAtTheDoor onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: "+ session.sessionId);
    // any initialization logic goes here such as setting up firebase communication
};

/* In the case where no intent is made but the skill is triggered, this function will fire
   The logic in this function is the same as the 'DoorIntent' function */
whosDoor.prototype.eventHandlers.onLaunch = function (launchRequest, session, response){
    console.log("WhosAtTheDoor onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);

    initiatePiFacialRecognition(session, response, function(name){                //This function initiates the Facial Recognition process on the Raspberry Pi
        if(name == "noRecognize"){                                                //When a person is not recognized                                          
            setNoRecognizeIntent(session)                                         //Session value set to AskIntent's NO_RECOGNIZE value
            var speechResponse = Responses.failRecognize()                        
            response.ask(speechResponse.speechOutput, speechResponse.repromptText)
        }
        else if(name == "noPerson"){                                              //When no face is detected in front of door
            response.tell(Responses.PIRRepromptText)                              //Exit response said
        }
        else{                                                                     //When face is recognized
            setRecognizeIntent(session)                                           //Session Value set to AskIntent's RECOGNIZE value
            setSessionName(session,name)                                          //Stores name of recognized person in the session JSON to be used in training if applicable
            var speechResponse = Responses.launchRecognized(name)   
            response.ask(speechResponse.speechOutput, speechResponse.repromptText)
        }
    });
};

whosDoor.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session){
    console.log("WhosAtTheDoor onSessionEnded requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    // cleanup logic goes here such as closing firebase communication
}

/* All of the intents or voice interactions handled here */
whosDoor.prototype.intentHandlers = {
    /* Same logic as the above onLaunch logic, this is triggered when user asks who's at the door */
    "DoorIntent": function(intent, session, response){
        initiatePiFacialRecognition(session, response, function(name){
            if(name == "noRecognize"){
                setNoRecognizeIntent(session)
                var speechResponse = Responses.failRecognize()
                response.ask(speechResponse.speechOutput, speechResponse.repromptText)
            }
            else if(name == "noPerson"){
                response.tell(Responses.PIRRepromptText)
            }
            else{
                setRecognizeIntent(session)
                setSessionName(session,name)
                var speechResponse = Responses.launchRecognized(name)
                response.ask(speechResponse.speechOutput, speechResponse.repromptText)
            }
        });
    },
    /* When a user answers a yes/no question with yes this intent is triggered */
    "AMAZON.YesIntent": function(intent, session, response){
        switch(session.attributes.AskIntentStatus) {                                                          //Different logic executed based on if person at door is recognized or not
            case AskIntent.RECOGNIZE:
                initiatePiFacialTraining(session, response, function(status){                                 //If recognized, facial training process occurs
                    if(status == "Success"){
                        var speechResponse = Responses.finishTrainIntent(session.attributes.NameRecognition)  //Response on success of facial training
                        response.tell(speechResponse.speechOutput)
                    }
                    else{
                        response.tell(Responses.noTrainText);                                                  //Response on failed facial training
                    }
                });
                break
            case AskIntent.NO_RECOGNIZE:                                                    //If user not recognized, asks for user's name to train them
                var speechResponse = Responses.setNameIntent()
                response.ask(speechResponse.speechOutput, speechResponse.repromptText)
                break
            default:
                console.log("ERROR: Unable to determine yes response")
                response.tell(Responses.exitText);
                break
        }
    },
    /* This intent allows user to set the name of the unknown person proceeded 
       by training person with given name */
    "SetNameIntent": function(intent, session, response){
        var name = intent.slots.UserFirstName.value;                                    //Value of user spoken name input
        trainUnknownPerson(session, response, name, function(status){                   //Train person's face with given name
            if(status == "Success"){
                var speechResponse = Responses.finishTrainIntent(name)
                response.tell(speechResponse.speechOutput)
            }
            else{
                response.tell(Responses.noTrainText);
            }
        });
    },
    /* The remaining intents exit the voice application with a message */
    "AMAZON.NoIntent": function (intent, session, response) {
        response.tell(Responses.exitText);
    },
    "AMAZON.StopIntent": function (intent, session, response) {
        response.tell(Responses.exitText);
    },
    "AMAZON.CancelIntent": function (intent, session, response) {
        response.tell(Responses.exitText);
    }

};

/* Appends session attribute to RECOGNIZE indicator */
function setRecognizeIntent(session){
    session.attributes.AskIntentStatus = AskIntent.RECOGNIZE
}

/* Appends session attribute to NO_RECOGNIZE indicator */
function setNoRecognizeIntent(session){
    session.attributes.AskIntentStatus = AskIntent.NO_RECOGNIZE
}

/* Appends name of recognized person in the session */
function setSessionName(session, name){
    session.attributes.NameRecognition = name;
}

/* Initiates facial recognition that is handled on the Raspberry Pi */
function initiatePiFacialRecognition(session, response, piCallback){
    database.writeDatabase(function(name){
        piCallback(name);
    });
}

/* Initiates facial training that is handled on the Raspberry Pi */
function initiatePiFacialTraining(session, response, piCallback){
    database.trainFaceCall(session.attributes.NameRecognition,function(status){
        piCallback(status);
    });
}

/* Initiates facial training of unknown person that is handled on the Raspberry Pi */
function trainUnknownPerson(session, response, name, piCallback){
    database.trainFaceCall(name, function(status){
        piCallback(status);
    });
}

// Lambda function:
exports.handler = function (event, context) {
    var door = new whosDoor();
    door.execute(event,context);
};
