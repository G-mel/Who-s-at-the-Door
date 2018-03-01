/*  This program is running on the Local Raspberry Pi, The other files in this repository are 
    running on the cloud in Lambda  */

var request = require('request');
var firebase = require('firebase');

const spawn = require('child_process').spawn;
const fs = require('fs');

var photoNum = 0;

firebase.initializeApp({
  databaseURL: 'https://alexadetection.firebaseio.com/',
  serviceAccount: './alexadetection@alexadetection.iam.gserviceaccount.com
.json'
});

/* Local Database Access */
var ref = firebase.database().ref("Alexa");

var name = './photo/image.jpg';

/* The Raspberry Pi is always listening to the database to see if voice commands to Alexa are issued */
ref.on("child_changed", function(snap) {
  console.log("initial data loaded!", snap.key +":",snap.val());
  if(snap.val() == 'callFacialRecog'){                                              //After the Alexa application is triggered by onLaunch or DoorIntent
    const Raspistill = spawn('raspistill',['-e','jpg','-o','./photo/image.jpg']);   //Snaps a picture of whatever is in front of the door
    Raspistill.on('close', (code) => {                                              
      fs.readFile(name, function(err, data) {
         var base64data = new Buffer(data).toString('base64');
         var options = {                                                
          url: 'https://api.kairos.com/recognize',
          headers:{
            'Content-Type': 'application/json',
            'app_id': '295b1046',
            'app_key': '61d6fe802ef0f20f0344ed08361f2a0e'
          },
          body: JSON.stringify({
            image: base64data,                                              //After picture is taken, image data is set on the facial recognition API
            gallery_name: 'alexaTest'
          })
        };
        request.post(options,function(error, response, body){
          if(error){                                //Case if request not properly made
            ref.child("Read").set("Failed");
          }
          else if(JSON.parse(body)["Errors"]){      //Case if no face is detected in the door (aka no one is at the door)
            ref.child("Read").set("noPerson");
          }
          else{
            var status = JSON.parse(body)["images"][0]["transaction"]["status"];
            if(status == "success"){
              var name = 'doneRecog '+JSON.parse(body)["images"][0]["transaction"]["subject"];   //Sends recognized name with 'doneRecog' data to database when recognition is complete
              ref.child("Read").set(name);
            }
            else if (status == "failure"){
              ref.child("Read").set("Failed");                                                   //Sends fail to recognize data to the DB on completed request
            }
          }
        });
      });
    });
  }
  /* When Raspberry Pi reads that the Alexa wrote the facial traning indicator word to the database */
  else if(snap.val()!=null && snap.val().includes('callFacialTrain')){
    fs.readFile(name, function(err, data) {
       var base64data = new Buffer(data).toString('base64');
       // console.log(base64data);
       var options = {
        url: 'https://api.kairos.com/enroll',
        headers:{
          'Content-Type': 'application/json',
          'app_id': '<KairosAppID>',
          'app_key': '<KairosAppKey>'
        },
        body: JSON.stringify({  
          image: base64data,                            //Uses the previously taken picture of the person's face to train
          subject_id: snap.val().substring(16),
          gallery_name: 'alexaTest',
          selector: 'SETPOSE',
          symmetricFill: 'true'
        })
      };
      request.post(options,function(error, response, body){
        if(error){
          ref.child("Read").set("Failed");                                      //If request fails or returns an error response, sends a fail message to DB
        }
        else if(JSON.parse(body)["Errors"]){
          ref.child("Read").set("Failed");
        }
        else{
          var status = JSON.parse(body)["images"][0]["transaction"]["status"];
          if(status == "success"){
            ref.child("Read").set("doneTrain");                                 //If successfully trained, indication word sent to DB for Alexa to say a proper response
          }
          else if (status == "failure"){
            ref.child("Read").set("Failed");
          }
        }
      });
    });
  }
});
