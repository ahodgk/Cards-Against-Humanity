/*******************************************************************************
 * Copyright (c) 2019.
 * Developed by Adam Hodgkinson
 * Last modified 13/07/19 22:24
 ******************************************************************************/
var USER;
var APIURI = "http://192.168.1.2:3000";
let currentSessionID = getCookie("currentSessionID");
if (currentSessionID != "" && currentSessionID != null) {
    window.location.href = "/serverlist.html";
}

var socket = io();
socket.on('message', function (data) {
    console.log(data);
})

socket.on('newSessionID', function (data) {
    currentSessionID = data;
    setCookie("currentSessionID", currentSessionID, 0.2);
    window.location.href = "/serverlist.html";
})

function connect(form) {
    let name = htmlEscape(form.username.value);
    if (name == " " || name == "" || name == null) {
        return;
    }
    //socket.emit('new player', name);
    firebase.auth().signInAnonymously().catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
    });

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            // User is signed in.
            var isAnonymous = user.isAnonymous;
            var uid = user.uid;
            console.log(uid);
            USER = user;
            let req = new XMLHttpRequest();
            req.open("POST", APIURI + "/newPlayer");
            req.setRequestHeader("Content-Type", "text/html");
            req.send(name);
        } else {
            // User is signed out.
            console.log("Signed out")
        }
    });

    console.log(name);
    setCookie("currentUsername", name, 0.2);

    //window.location.href = "/static/serverlist.html";
}

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(a) {
    const b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : '';
}

function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/#/g, '%23');
}