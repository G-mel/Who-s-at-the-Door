/*  All of the Lambda database logic is conducted in this file  */

var https = require('https');
var request = require('request');
var queryString = require('querystring');

/* FireBase */
var firebase = require('firebase');

firebase.initializeApp({
  databaseURL: 'https://alexadetection.firebaseio.com/
',
  serviceAccount: './alexadetection@alexadetection.iam.gserviceaccount.com
.json'
});

/* Access to database */
var ref = firebase.database().ref('Alexa');
var root = firebase.database().ref();

function Database(){
}

/* This function is called when this skill is initiated, writes facial recognition indicator
   to database as well as listens for changes sent from the local Raspberry Pi */
Database.prototype.writeDatabase = function(callback){
    ref.child("Write").set("callFacialRecog");           //Gives the Raspberry Pi indication to start the facial recognition process
    ref.on("child_changed", function(snap){				 //When the Facial recognition process is complete, this listens for changes
    	if(snap.val()!=null){							 //to the database (Raspberry Pi writes 'doneRecog (Name of identified person) to DB')
	    	if(snap.val().includes('doneRecog')){
	    		console.log("done");
	    		var name = snap.val().substring(10);
	    		console.log(name);
	    		ref.child("Write").set("");
	    		ref.child("Read").set("");
	    		callback(name);							 //Callsback with name of person at the door to be handled in index.js
	    	}
	    	else if (snap.val() == "Failed"){			 //Case if failed to recognize person at door
	    		ref.child("Write").set("");
	    		ref.child("Read").set("");
	    		callback("noRecognize");
	    	}
	    	else if (snap.val() == "noPerson"){			 //Case if no on is at the door (face is not detected)
	    		ref.child("Write").set("");
	    		ref.child("Read").set("");
	    		callback("noPerson");
	    	}
    	}
    });
}

/* This function is called when the user agrees to train the face of whoever is at their door.
   The same DB logic is used here as above */
Database.prototype.trainFaceCall = function(name, callback){
    var nameSend = 'callFacialTrain '+name;
    ref.child("Write").set(nameSend);

    ref.on("child_changed", function(snap){
    	if(snap.val()!=null){
	    	if(snap.val() == 'doneTrain'){
	    		console.log("done Traing");
	    		ref.child("Write").set("");
	    		ref.child("Read").set("");
	    		callback("Success");
	    	}
	    	else if (snap.val() == "Failed"){
	    		ref.child("Write").set("");
	    		ref.child("Read").set("");
	    		callback("Fail");
	    	}
    	}
    });
}

module.exports = Database;
