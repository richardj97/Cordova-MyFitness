// Richard Jacobs (16629926)

'use strict';

/* Workout global variables */
var stages = 10, totalDistance = 0, enableHighAcc = false;
var currentStage = 0, currentStageKm = 0, gpsTimeout = 30000;

/* Device global variables */
var enableNotifications = true;
var remoteNotificationsEnabled = false;
var isDevice = false;
var deviceLog = "";
var appName = "My Fitness";
var encryptionKey = "lsiMJ61K2VTRda8sMUIJRSNALT7wFpK2";

/* Firebase global variables */
var email, displayName, userId, weight = 0;

// Initialise device
var app = {
    initialize: function() {
        this.bindEvents();
    },
    bindEvents: function() {
        document.addEventListener("deviceready", this.onDeviceReady, false);
        document.addEventListener("online", this.onDeviceOnline, false);
        document.addEventListener("offline", this.onDeviceOffline, false);
    },
    onDeviceReady: function() {
        addLog("Device Ready");

        isDevice = true;
    
        var push = PushNotification.init({
            "android": {
                "senderID": "859362287720"
            },
            "ios": {
                "sound": true,
                "vibration": true,
                "badge": true
            },
            "windows": {}
        });

        addLog("Remote push notifications initialized");
    
        push.on('registration', function(data) {
            var oldRegId = localStorage.getItem('registrationId');
            
            remoteNotificationsEnabled = true;

            if (oldRegId !== data.registrationId) {
                localStorage.setItem('registrationId', data.registrationId);
            }
            addLog("Remote Notifications registered: " + data.registrationId);
            $("#rid").html("Remote Notifications Registered: Yes");
        });
    
        push.on('notification', function(data) {
            addLog("Remote Notification event received: " + data.title + "\n" + data.message + "\n" + data.additionalData.foreground);
            sendAlert(data.title, data.message);
        });
    
        push.on('error', function(e) {
            addLog("Remote Notification registration Error: " + e.message);
            $("#rid").html("Notifications Registered: No");
        });

        addLog("End of device ready");
    },
    onDeviceOnline: function() {
        addLog("Network Change: Device Online");
        $.mobile.changePage('#home');
        //sendAlert("Connected", "Welcome Back :-)");
    },
    onDeviceOffline: function() {
        addLog("Network Change: Device Offline");
        $.mobile.changePage('#offline');
    }
};

$(document).ready(function () {
    app.initialize();
    addLog("App initialized");
    addLog("Document Ready");
    setup();
});

/* Sign In Page */

$(document).on('pagecreate', '#signIn', function() {
    $("#signInBtn").on('click', function (){    
        var email = $("#email").val();
        var password = $("#password").val();
        
        if (email == null    || email == "" ||
            password == null || password == "") 
        {
            sendAlert(appName, "One or more text boxes are empty");
            return;
        }
        
        firebase.auth().signInWithEmailAndPassword(email, password)
        .then(function(user) {
            // No need for any action - has a 'onAuthStateChanged' event
            addLog("Signed in successfully");
        })
        .catch(function(error){
            sendAlert(appName, "Unable to sign in: " + error.message);
            addLog("Sign in unsuccessful: " + error.message);
        });
    });
});

/* Sign Up Page */

$(document).on('pagecreate', '#signUp', function() {
    $("#signUpBtn").on('click', function (){    
        
        var email = $("#regEmail").val();
        var password = $("#regPassword").val();
        var confPass = $("#regConfPassword").val();
        var firstName = $("#firstName").val();
        var lastName = $("#lastName").val();
        var weight = $("#weight").val();
        var user = null;
        
        displayName = firstName + ' ' + lastName;
        
        if (email == null     || email == ""     ||
            password == null  || password == ""  || 
            confPass == null  || confPass == ""  ||
            firstName == null || firstName == "" || 
            lastName == null  || lastName == ""  ||
            weight == null    || weight == "") 
        {
            sendAlert(appName, "One or more text boxes are empty");
            return;
        }
        
        if (password != confPass){
            sendAlert(appName, "Passwords do not match");
            return;
        }
        
        firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(function () {
            user = firebase.auth().currentUser;
            userId = user.uid;
            addLog("Sign up successful");
        })
        .then(function() {
            user.updateProfile({
                displayName: displayName,
                email: email,
                firstName: firstName,
                lastName: lastName
            });
            addUserDetails("UserDetails", displayName, email, weight );
        })
        .catch(function(error) {
            sendAlert(appName, error.message);
            addLog("Sign up error: " + error.message);
        });
    });
});

/* Home Page */

$(document).on('pagecreate', '#home', function() { 
    $("#homeWorkoutBtn").on('click', function() {
        $.mobile.changePage('#workout');
    });

    $("#workoutHistory").on('click', function() {
        $.mobile.changePage('#workoutHistory');
    });

    $("#localGyms").on('click', function() {
        $.mobile.changePage('#findGyms');
    });
});

$(document).on('pageshow', '#home', function() { 
    $("#totalDistance").html("<strong>" + totalDistance.toFixed(2) + "</strong");
    $("#currentStage").html("Current Stage: <strong>" + getCurrentStage() + "</strong>");
});

/* Workout Page */

$(document).on('pagecreate', '#workout', function() {   
    var countdown, seconds, minutes, hours, distance = 0;
    var workout_id = 0, watch_id = null, workout_data = [];
    var timer, interval, speed = 0, caloriesBurnt = 0;

    $("#stopWorkout").hide();
    $("#stopworkout").hide();
    $("#workoutData").hide();
    
    $("#startWorkout").on('click', function () {
        addLog("Workout started");

        /* Doesn't really work and when it does, it has awful battery comsumption - bad UX.
        // Keeps the app running in the background for the geolocation.
        if (isDevice && platform == "Android") {
            cordova.plugins.backgroundMode.setDefaults({ text:'You are doing a workout'});
            cordova.plugins.backgroundMode.enable();
        }
        */

        $("#workoutData").show();

        var options = { enableHighAccuracy : true, timeout: gpsTimeout, maximumAge: 0, distanceFilter: 0 };
        watch_id = navigator.geolocation.watchPosition(onSuccess, onError, options);

        function onSuccess(position) {
            var pos = {
                timestamp: position.timestamp,
                coords: {
                    heading: position.coords.heading,
                    altitude: position.coords.altitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    latitude: position.coords.latitude,
                    speed: position.coords.speed
                }
            };
            workout_data.push(pos);

            var data = JSON.stringify(workout_data);

            if (enableHighAcc) {
                // If enable high accuracy is enabled, it will only calculate the distance
                // if the speed is > than 1. This stops it calculating GPS bouncing and only calculate when actually moving.
                if (pos.coords.speed > 1) {
                    var calDist = calculateDistance(data);
                    distance += parseFloat(calDist);
                    totalDistance += parseFloat(calDist);
                }
            }
            else {
                var calDist = calculateDistance(data);
                distance += parseFloat(calDist);
                totalDistance += parseFloat(calDist);
            }

            speed = pos.coords.speed;
            caloriesBurnt = parseFloat(calculateCaloriesBurnt(timer, speed));

            $("#workoutData").html("<hr>Heading: <strong>" + pos.coords.heading + "</strong><br>Altitude: <strong>" + pos.coords.altitude + 
            "</strong><br>Longitude: <strong>" + pos.coords.longitude + "</strong><br>Latitude: <strong>" + pos.coords.latitude + 
            "</strong><br>Accuracy: <strong>" + pos.coords.accuracy + "</strong><br>Speed: <strong>" + pos.coords.speed + "</strong>");
            checkStageUpdates();
        }

        function onError(error) {
            $("#stopworkout").click();
            sendAlert(appName, "Unable to start workout. Error: " + error.message + "\nError code: " + error.code);
            addLog("watchPosition error");
        };
        
        workout_id = generateWorkoutId();
        
        timer = "00:00:00";
        
        interval = setInterval(function() {   
            countdown = timer.split(':');
            seconds = parseInt(countdown[2], 10);
            minutes = parseInt(countdown[1], 10);
            hours = parseInt(countdown[0], 10);
            seconds++;
            
            if (seconds > 59) {
                minutes++;
                seconds = 0;
            }
            if (minutes > 59) {
                hours++;
                minutes = 0;
            }

            seconds = (seconds < 10) ? '0' + seconds : seconds;
            minutes = (minutes < 10) ? '0' + minutes : minutes;
            hours = (hours < 10) ? '0' + hours : hours;
            
            timer = hours + ':' + minutes + ':' + seconds;
            
            $("#workoutStatus").html("Status: Workout: <strong>Stage " + getCurrentStage() + " started...</strong>" + "<br>Time elapsed: <strong>" + timer +
            "</strong><br>Distance: <strong>" + distance.toFixed(2) + "</strong> km<br>Calories burnt: <strong>" + caloriesBurnt.toFixed(0) + "</strong>");
        }, 1000);
        
        $("#progress").hide();
        $("#stopWorkout").show();
        $("#startWorkout").hide();
        $("#challengeBtn").hide();
        $("#challengeLb").hide();
    });

    $("#stopworkout").on('click', function () {
        addLog("Workout stopped");

        /*
        if (isDevice && platform == "Android") {
            cordova.plugins.backgroundMode.disable();
        }
        */

        $("#workoutData").hide();

        navigator.geolocation.clearWatch(watch_id);
        var jsonStr = JSON.stringify(workout_data);
        watch_id = null;
        workout_data = [];
        
        if (distance == 0){
            var message = "<strong>Workout completed:</strong> You didn't even work out LOL! Lazy...";
            $("#progress").html(message);   
        }
        else {
            var time = hours + ":" + minutes + ":" + seconds;
            addToFirebase(workout_id, jsonStr, distance, time, false);
            showWorkoutResult(workout_id, jsonStr, time, distance.toFixed(2), "false", false);
            addLog("Workout completed");
        }

        $("#workoutStatus").html("<strong>Status:</strong> Workout stopped.");
        $("#progress").show();  
        $('#stopWorkout').hide();
        $('#startWorkout').show();
        $("#challengeBtn").show();
        $("#challengeLb").show();
        distance = 0;
        clearInterval(interval);

    });

    var i = 0, timeOut = 0;

    $('.stopworkout').on('mousedown touchstart', function(e) {
        $(".stopworkout").buttonMarkup({icon:""});
        $(this).addClass('active');
        timeOut = setInterval(function(){
        i++;

        if (i == 11) {
            $("#stopworkout").click();
            i = 0;
        }
    }, 100);
    }).bind('mouseup mouseleave touchend', function() {
        $(".stopworkout").buttonMarkup({icon:"delete"});
        i = 0;
        $(this).removeClass('active');
        clearInterval(timeOut);
    });

    $("#challengeBtn").on('click', function() {
        $.mobile.changePage('#challenge');
    });
});

$(document).on('pageshow', '#workout', function() { 
    currentStage = getCurrentStage();
    currentStageKm = getKm(currentStage);
    $("#stage_current").text('Stage ' + currentStage + ' - Distance ' + currentStageKm + ' km');
});

/* Challenge Yourself Page */

$(document).on('pagecreate', '#challenge', function() { 
    var countdown, seconds, minutes, hours, totalTime, distance = 0;
    var workout_id = 0, watch_id = null, workout_data = [];
    var timer, originalTimer, interval;

    $("#stopchallenge").hide();

    new Picker(document.querySelector('.js-time-picker'), {
        format: 'HH:mm:ss',
        headers: true,
        text: {
        title: 'Pick a time',
        },
    });

    $("#stopChallenge").hide();
    $("#challengeData").hide();

    $("#startChallenge").on('click', function() {
        addLog("Challenge started");

        /* 
        if (isDevice && platform == "Android") {
            cordova.plugins.backgroundMode.setDefaults({ text:'You are doing a challenge'});
            cordova.plugins.backgroundMode.enable();
        }
        */

        timer = $('#timeChallenge').val();
        originalTimer = $('#timeChallenge').val();

        if (timer.length == 8 && timer != null && timer != "") {

            $("#timeChallenge").hide();
            $("#challengeTitle").hide();
            $("#startChallenge").hide();
            $("#stopChallenge").show();
            $("#challengeStatus").show();
            $("#challengeProgress").hide();
            $("#challengeData").show();

            var options = { enableHighAccuracy : true, timeout: gpsTimeout, maximumAge: 0, distanceFilter: 0 };

            watch_id = navigator.geolocation.watchPosition(onSuccess, onError, options);
    
            function onSuccess(position) {
    
                var pos = {
                    timestamp: position.timestamp,
                    coords: {
                        heading: position.coords.heading,
                        altitude: position.coords.altitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        latitude: position.coords.latitude,
                        speed: position.coords.speed
                    }
                };
                workout_data.push(pos);
    
                var data = JSON.stringify(workout_data);

                if (enableHighAcc) {
                    // If enable high accuracy is enabled, it will only calculate the distance
                    // if the speed is > than 1. This stops it calculating GPS bouncing and only calculate when actually moving.
                    if (pos.coords.speed > 1) {
                        var calDist = calculateDistance(data);
                        distance += parseFloat(calDist);
                        totalDistance += parseFloat(calDist);
                    }
                }
                else {
                    var calDist = calculateDistance(data);
                    distance += parseFloat(calDist);
                    totalDistance += parseFloat(calDist);
                }

                $("#challengeData").html("Heading: <strong>" + pos.coords.heading + "</strong><br>Altitude: <strong>" + pos.coords.altitude + "</strong><br>Longitude: <strong>" + pos.coords.longitude + "</strong><br>Latitude: <strong>" + pos.coords.latitude + "</strong><br>Accuracy: <strong>" + pos.coords.accuracy + "</strong><br>Speed: <strong>" + pos.coords.speed + "</strong>");
            }
    
            function onError(error) {
                $("#stopchallenge").click();
                sendAlert(appName, "Unable to start challenge. Error: " + error.message + "\nError code: " + error.code);
                addLog("watchPosition error");
            };
            
            workout_id = generateWorkoutId();

            function formatTime(seconds) {
                var h = Math.floor(seconds / 3600),
                    m = Math.floor(seconds / 60) % 60,
                    s = seconds % 60;
            
                if (h < 10) h = "0" + h;
                if (m < 10) m = "0" + m;
                if (s < 10) s = "0" + s;

                return h + ":" + m + ":" + s;
            }

            countdown = timer.split(':');

            // Get the parameters and convert to seconds
            seconds = parseInt(countdown[2], 10);
            minutes = parseInt(countdown[1], 10) * 60;
            hours = parseInt(countdown[0], 10) * 3600;
            totalTime = seconds + minutes + hours;

            interval = setInterval(function() {
                totalTime--;

                if (totalTime < 0){
                    $("#stopchallenge").click();
                    return;
                }

                timer = formatTime(totalTime);

                $("#challengeStatus").html("Time remaining: <strong>" + timer + "</strong><br>Distance: <strong>" + distance.toFixed(2) + "</strong> km");

            }, 1000);
        }
        else {
            sendAlert(appName, "Incorrect time format - (hh:mm:ss) e.g. 00:01:30");
        }
    });

    $("#stopchallenge").on('click', function() {
        addLog("Challenge stopped");

        /*
        if (isDevice && platform == "Android") {
            cordova.plugins.backgroundMode.disable();
        } 
        */

        navigator.geolocation.clearWatch(watch_id);

        var jsonStr = JSON.stringify(workout_data);
        watch_id = null;
        workout_data = [];
        
        if (distance == 0){
            var message = "<strong>Challenge completed:</strong> You didn't even work out LOL! Lazy...";
            $("#challengeProgress").html(message);
            $("#challengeProgress").show();  
        }
        else {
            sendPushNotification("My Fitness", "You have completed your challenge!", false);
            addToFirebase(workout_id, jsonStr, distance, originalTimer, true);
            showWorkoutResult(workout_id, jsonStr, originalTimer, distance.toFixed(2), "true", false);
            addLog("Challenge completed");
        }

        $("#challengeStatus").html("<strong>Status:</strong> Challenge stopped.");
        $('#stopChallenge').hide();
        $('#startChallenge').show();
        $("#timeChallenge").show();
        $("#challengeTitle").show();
        $("#challengeData").hide();
        distance = 0;
        clearInterval(interval);
    });

    var i = 0, timeOut = 0;

    $('.stopchallenge').on('mousedown touchstart', function(e) {
        $(".stopchallenge").buttonMarkup({icon:""});
    $(this).addClass('active');
    timeOut = setInterval(function(){
        i++;

        if (i == 11) {
            $("#stopchallenge").click();
            i = 0;
        }
    }, 100);
    }).bind('mouseup mouseleave touchend', function() {
        $(".stopchallenge").buttonMarkup({icon:"delete"});
        i = 0;
    $(this).removeClass('active');
    clearInterval(timeOut);
    });
});

/* Stages Page */

$(document).on('pagecreate', '#stages', function() { 
    for (var i = 0; i < stages; i++) {
        var index = i + 1;
        var button = $("<button id='stage" + index + "' class='stage incomplete dr' data-icon='lock'>" + "Stage " + index + " - Distance " + getKm(index) + " km</button>");
        $("#stageButtons").append(button).trigger('create');
    }
});

$(document).on('pageshow', '#stages', function() {
    var stageNum = getStage(totalDistance);

    for (var i = 0; i < stages; i++){
        var index = i + 1;
        var button = $("#stage" + index);

        button.addClass("incomplete");
        button.removeClass("current");
        button.removeClass("complete");

        if (i < stageNum) {
            button.removeClass("incomplete");
            button.addClass("complete");
            button.buttonMarkup({icon:"check"});
        }

        if (i == stageNum) {
            button.removeClass("incomplete");
            button.addClass("current");
            button.buttonMarkup({icon:"arrow-r"});
        }
    }

    $("#stagesTitle").html("My Progress (" + stageNum + "/" + stages + ")");

});

/* Settings Page */

$(document).on('pagecreate', '#settings', function() {
    $("#highAccCb").on('click', function() {
        if (document.getElementById("highAccCb").checked){
            enableHighAcc = true;
            addLog("High GPS Accuracy enabled");
        }
        else {
            enableHighAcc = false;
            addLog("High GPS Accuracy disabled");
        }
    });

    $("#enableNotification").on('click', function() {
        if (document.getElementById("enableNotification").checked){
            enableNotifications = true;
            addLog("Notifications enabled");
        }
        else {
            enableNotifications = false;
            addLog("Notifications disabled");
        }
    });

    $("#signOutBtn").on('click', function() {
        if (isDevice) {
            sendConfirmAlert(appName, "Are you sure you want to sign out?", "signOut");
        }
        else {
            signOut();
        }
    });

    $("#clearWorkouts").on('click', function() {
        if (isDevice) {
            sendConfirmAlert(appName, "Are you sure you want to clear your workouts?", "clearWorkouts");
        }
        else {
            deleteWorkouts();
        }
    });
});

/* Developer Tools Page */

$(document).on('pagecreate', '#developerTools', function() {
    $("#viewLogs").on('click', function() {
        $.mobile.changePage('#deviceLog');
        $("#deviceLogText").html(deviceLog);
    });
    
    $("#sendRemoteNotif").on('click', function() {
        if (remoteNotificationsEnabled) {
            sendPushNotification(appName, "This is a remote notification from our php server :-).", true);
        }
        else {
            sendAlert(appName, "Remote notifications aren't available");
        }
    });

    $("#sendNotif").on('click', function() {
        sendPushNotification(appName, "This is a local test notification.", false);
        addLog("Sent a test notification");
    });
});

/* Find Local Gyms Page */

$(document).on('pagecreate', '#findGyms', function() {
    var options = { enableHighAccuracy : true, timeout: 20000, maximumAge: 0, distanceFilter: 0 };
    navigator.geolocation.getCurrentPosition(success, error, options);

    var coords;

    function success(pos) {
        coords = pos.coords;
        addLog("Found coordinates for gym locater. Latitude:" + coords.latitude + " Longitude: " + coords.longitude);
    }
    
    function error(err) {
        addLog("Unable to find coordinates for gym locater");
        sendAlert(appName, "Unable to find your location");
    }

    $("#mapBtn").on('click', function () {
        var radius = $("#radiusTb").val();

        if (radius != null && radius != ""){
            if (coords != null) {
                var latlng = new google.maps.LatLng(coords.latitude, coords.longitude);
                var newRadius = parseInt(radius);
                showMap(newRadius, latlng);
            }
        } else {
            sendAlert(appName, "Enter a radius number. E.g. 1500");
        }
    });

    function showMap(radius, coords) {
        var map;
        var infowindow;

        infowindow = new google.maps.InfoWindow();

        map = new google.maps.Map(document.getElementById('map_canvas2'), {
            center: coords,
            zoom: 12
        });
    
        var service = new google.maps.places.PlacesService(map);
    
        service.nearbySearch({
            location: coords,
            radius: radius,
            type: ['gym']
        }, callback);
    
        var coordsRadius = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#13904C',
            fillOpacity: 0.35,
            map: map,
            center: coords,
            radius: radius
        });
    
    
        function callback(results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                for (var i = 0; i < results.length; i++) {
                    createMarker(results[i]);
                }
            }
        }
    
        function createMarker(place) {
            var marker = new google.maps.Marker({
                map: map,
                position: place.geometry.location
            });
    
            google.maps.event.addListener(marker, 'click', function() {
                var rating, website;
    
                if (place.rating == null) {
                    rating = "Rating: not rated";
                }
                else {
                    rating = "Rating: " + place.rating + "/5";
                }
    
                if (place.website == null) {
                    website = "Website: not available";
                }
                else {
                    website = "Website: " + place.website;
                }
    
                infowindow.setContent("<strong>" + place.name + "</strong><br>" + rating + "<br>" + website);
                infowindow.open(map, this);
            });
        }
    
        coordsRadius.setMap(map);
    }
});

/* Workout Result Page */

$(document).on('pageshow', '#workoutResult', function() {

    if ($(this)[0].hasAttribute("workoutId")) {
        var workoutId = $(this).attr("workoutId");
        var json = $(this).attr("json");
        var time = $(this).attr("time");
        var challenge = $(this).attr("challenge");
        var distance = $(this).attr("distance");
        distance = parseFloat(distance).toFixed(4);

        var data = JSON.parse(json);
        var coordinates = new google.maps.LatLng(data[0].coords.latitude, data[0].coords.longitude);

        var options = {
            zoom: 16,
            center: coordinates,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        var map = new google.maps.Map(document.getElementById("map_canvas"), options);
        
        var gpsTrack = [];

        for (var i = 0; i < data.length; i++) {
            gpsTrack.push(new google.maps.LatLng(data[i].coords.latitude, data[i].coords.longitude));
        }

        var trackPath = new google.maps.Polyline({
            path: gpsTrack,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 2
        });

        trackPath.setMap(map);

        if (challenge == "true"){
            $("#workoutTitle").html("Challenge: " + workoutId);
            $("#workoutDesc").html('<strong>Challenge history:</strong><br>You travelled <strong>' + distance + 
            '</strong> km within <strong>' + time + '</strong>');
        }
        else if (challenge == "false"){
            $("#workoutTitle").html("Workout: " + workoutId);
            $("#workoutDesc").html('<strong>Workout history:</strong><br>You travelled <strong>' + distance + 
            '</strong> km within <strong>' + time + '</strong>');
        }
    }
});

/* Workout History Page */

$(document).on('pageshow', '#workoutHistory', function() {
    $("#workout_history").empty();

    var db = firebase.firestore();
    var data = [];

    db.collection(userId).get().then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            if (doc.ref.id == "UserDetails") {return;}
            $("#workout_history").append("<li><a href='#workoutResult' data-ajax='false'>" + doc.ref.id + "</a></li>");

            var docData = {
                workoutId: doc.ref.id, 
                json: doc.data().json,
                time: doc.data().time,
                challenge: doc.data().challenge,
                distance: doc.data().distancekm
            }
            data.push(docData);
        });

        $("#workout_history").listview('refresh');

        $("#workout_history li a").on('click', function() {
            var index = $(this).parents("li").index();
            showWorkoutResult(data[index].workoutId, data[index].json, data[index].time, data[index].distance, data[index].challenge, true);
        });
    })
    .catch(function(error) {
        addLog("Error loading workout history: " + error.message);
    });
});


/* Functions */

function setup() {
    var config = {
        apiKey: "AIzaSyA5Pi_r-m9WIazfHXSF7BJEzW80-NUt8I0",
        authDomain: "myfitness-f8546.firebaseapp.com",
        databaseURL: "https://myfitness-f8546.firebaseio.com",
        projectId: "myfitness-f8546",
        storageBucket: "myfitness-f8546.appspot.com",
        messagingSenderId: "859362287720"
    };
    firebase.initializeApp(config);

    firebase.auth().onAuthStateChanged(function(user) {
        var auth = firebase.auth().currentUser;
            
        if (user) {       
            if(auth != null){  
                if (auth.displayName != null){
                    $('#signInDetails').html("Welcome, <strong>" + auth.displayName + "</strong>.");
                }
                else if (displayName != null){
                    $('#signInDetails').html("Welcome, <strong>" + displayName + "</strong>.");
                }
                else{
                    $('#signInDetails').html("Welcome, <strong>" + auth.email + "</strong>.");
                }
                
                userId = auth.uid;
                email = auth.email;

                getTotalDistanceFromDb();
                getUserDetails();
             
                // We only want to see these settings if its a device.
                if (!isDevice) {
                    $("#devFooter").hide();
                    $("#notificationSwitch").hide();
                    $("#enableNotification").hide();
                }
                
                $("#uid").html("UID: " + userId);
                addLog("Successfully signed in with firebase. UID: " + userId);

                $.mobile.changePage('#signIn');
                $.mobile.changePage('#home');
            }
        } else {
            // No user is signed in.
            $.mobile.changePage('#signIn');
            auth = null;
        }
    });
}

function addLog(log) {
    var d = new Date();
    var n = d.toLocaleTimeString();

    deviceLog += "<br>[" + n + "] " + log;
}

function sendPushNotification(title, message, remote) {
    if (isDevice) {
        if (enableNotifications) {
            if (remote) {
                var tempRegId = localStorage.getItem('registrationId');
                // Here i just created a free web host and uploaded my php script.
                // The script takes 3 parameters: notification registration id, title and message.
                // Once the server has submitted the data to Firebase, it will return a notification for the user.
                // This can be used for scheduling notifications. 
                $.ajax({
                    type: "POST",
                    url: 'http://dttdeliveries.000webhostapp.com/push.php?id='+tempRegId+'&title='+title+'&message='+message,
                    error: function(data) {
                        addLog("Send push notification failure: " + data.message);
                    },
                    success: function(data){
                        addLog("Send push notification success");
                    },
                }); 
            }
            else {
                cordova.plugins.notification.local.hasPermission(function (granted) { 
                    // If remote notifications aren't configured, send local instead
                    cordova.plugins.notification.local.schedule({
                        title: title,
                        text: message,
                        foreground: true

                        // Here we can send image notifications with buttons.
                        // Would be awesome to have this displaying challenge/workout map routes

                        //     attachments: ['file://img/rb-leipzig.jpg'],
                        //     actions: [
                        //     { id: 'yes', title: 'Yes' },
                        //     { id: 'no',  title: 'No' }
                        //     ]

                        // Here we can send input notifications to get a user input
                        // Would be good to have this for data inserts.

                        //     actions: [{
                        //         id: 'reply',
                        //         type: 'input',
                        //         title: 'Reply',
                        //          emptyText: 'Type message',
                        //     }, ... ]
                    });
                });
            }
        }
        else {
            sendAlert(appName, "Notifications are disabled");
        }
    }
}

function calculateDistance(json) {
    var data = JSON.parse(json);
    var temp_total_km = 0;

    for (var i = 0; i < data.length; i++) {
        if (i == (data.length - 1)) {
            break;
        }
        temp_total_km = getGPSDistance(data[i].coords.latitude, data[i].coords.longitude, data[i + 1].coords.latitude, data[i + 1].coords.longitude);
    }
    
    return temp_total_km;
}

function showWorkoutResult(workoutId, json, time, distance, challenge, hasAttr) {
    var decryptData = decrypt(json);

    if (hasAttr) {
        $("#workoutResult").attr({
            workoutId: workoutId,
            json: decryptData,
            time: time,
            challenge: challenge,
            distance: distance
        });
    }
    else {
        $.mobile.changePage('#workoutHistory');
    }
}

function deleteWorkouts() {
    var db = firebase.firestore();
            
    db.collection(userId).get().then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            var docRef = doc.ref.id;

            if (docRef != "UserDetails") {
                db.collection(userId).doc(docRef).delete();
            }
        });

        sendAlert(appName, "Your workouts have been removed");
        addLog("Workouts have been removed");
        getTotalDistanceFromDb();
    })
    .catch(function(error) {
        addLog("Error getting documents: " + error.message);
    });
}

function signOut() {
    try {
        firebase.auth().signOut();
        addLog("Successfully signed user out. UID: " + userId);
    }
    catch (e) {
        sendAlert(appName, "Unable to sign out: " + e.message);
    }
}

function checkStageUpdates() {
    // If the total distance (in km) is greater or equal to current stage (in km).
    // Stage complete!

    if (totalDistance >= currentStageKm) {
        var completeStage = getCompletedStage();
        currentStage = getCurrentStage();
        currentStageKm = getKm(currentStage);
        $("#stage_current").text('Stage ' + currentStage + ' - Distance ' + currentStageKm + ' km');
        sendPushNotification("My Fitness", "Congratulations! You have just completed stage " + completeStage + "!");
        alert("Congratulations! You have just completed stage " + completeStage + "!");
    }
}

function generateWorkoutId() {
    var d = new Date();
    var lt = d.toLocaleTimeString();
    var dd = d.getDate();
    var mm =  d.getMonth();
    mm += 1;
    var yy = d.getFullYear();
    var date = dd + "-" + mm + "-" + yy;

    if (workout){
        return date + "-" + lt;
    }
    else {
        return date + "-" + lt;
    }
}

function addToFirebase(workoutId, jsonStr, distance, time, challenge) {  
    var db = firebase.firestore();

    // Encryption to provide safer security for storing locations.
    var encryptJsonStr = encrypt(jsonStr);
    
    db.collection(userId).doc(workoutId).set({
        distancekm: distance,
        time: time, 
        json: encryptJsonStr,
        challenge: challenge
    })
    .then(function() {
        addLog("Document successfully written!");
    })
    .catch(function(error) {
        addLog("Error writing document: " + error.message);
    });
}

function encrypt(data) {
    var encryptData = CryptoJS.AES.encrypt(data, encryptionKey);
    return encryptData.toString();
}

function decrypt(data) {
    var temp;
    var decryptData = CryptoJS.AES.decrypt(data, encryptionKey);

    try {
        temp = decryptData.toString(CryptoJS.enc.Utf8);
    }
    catch(e) {
        temp = decryptData.toString();
    }
    return temp;
}

function addUserDetails(docName, displayName, email, weight) {
    var db = firebase.firestore();
    
    // Not important to encrypt, user has already gave permission

    db.collection(userId).doc(docName).set({
        displayName: displayName,
        email: email,
        weight: weight
    })
    .then(function() {
        addLog("Document successfully written!");
    })
    .catch(function(error) {
        addLog("Error writing document: " + error.message);
    });
}

function sendAlert(title, message) {
    if (isDevice) {
        navigator.notification.confirm(message, null, title, null);
    }
    else {
        alert(message);
    }
}

function sendConfirmAlert(title, message, name) {
    if (isDevice) {
        var buttonLabels = "Yes,No";
        navigator.notification.confirm(message, confirmCallback, title, buttonLabels);

        function confirmCallback(buttonIndex) {
            if (buttonIndex == 1) {
                if (name == "clearWorkouts") {
                    deleteWorkouts();
                }
                else if (name == "signOut") {
                    signOut();
                }
            }
        }
    }
}

function calculateCaloriesBurnt(timer, speed) {
    // Total calories burned = Duration (in minutes) * (MET * 3.5 * weight in kg) / 200

    var countdown = timer.split(':');

    // Get the parameters and convert to seconds
    var seconds = parseInt(countdown[2], 10);
    var minutes = parseInt(countdown[1], 10) * 60;
    var hours = parseInt(countdown[0], 10) * 3600;
    var totalSecs = seconds + minutes + hours;

    // Convert to minutes
    var totalMinutes = totalSecs / 60;

    // Get weight of the user and convert to KG
    var weightToKg = weight / 2.205;

    return (totalMinutes) * (speed * 3.5 * weightToKg) / 200; 
}

/* Get Functions (Retuns a value) */

function getTotalDistanceFromDb() {
    var db = firebase.firestore();

    db.collection(userId).get().then(function(querySnapshot) {
        var tempTotDist = 0;
        querySnapshot.forEach(function(doc) {
            if (doc.ref.id != "UserDetails"){
                var distance = doc.data().distancekm;
                tempTotDist += parseFloat(distance);
            }
        });
        totalDistance = tempTotDist;
    })
    .catch(function(error) {
        addLog("Error getting documents: " + error.message);
    });
}

function getGPSDistance(lat1, lon1, lat2, lon2) { 
    /* Credits: Haversine formula (http://www.movable-type.co.uk/scripts/latlong.html) */
    
    var R = 6371; // Radius of the earth in km
    var dLat = (lat2 - lat1) * (Math.PI / 180);
    var dLon = (lon2 - lon1) * (Math.PI / 180);
    var lat1 = lat1 * (Math.PI / 180);
    var lat2 = lat2 * (Math.PI / 180);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;

    return d;
}

function getStage(km) {
    return Math.floor(km / 2);
}

function getKm(stage) {
    return stage * 2;
}

function getCurrentStage() {
    return getStage(totalDistance) + 1;
}

function getCompletedStage() {
    return getStage(totalDistance);
}

function getUserDetails() {
    var db = firebase.firestore();

    db.collection(userId).doc("UserDetails").get().then(function(querySnapshot) {
        email = querySnapshot.data().email;
        displayName = querySnapshot.data().displayName;
        weight = querySnapshot.data().weight;
    })
    .catch(function(error) {
        addLog("Error getting documents: " + error.message);
    });
}
