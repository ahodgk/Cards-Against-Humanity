/*
 * Copyright (c) 2020.
 * Developed by Adam Hodgkinson
 * Last modified 31/1/1 21:25
 *
 * Everything on this page, and other pages on the website, is subject to the copyright of Adam Hodgkinson, it may be freely used, copied, distributed and/or modified, however, full credit must be given
 * to me and any derived works should be released under the same license. I am not held liable for any claim, this software is provided as-is and without any warranty.
 *
 * I do not own any of the following content and is used under their respective licenses:
 *     Fontawesome
 *     Photonstorm's phaser.js
 */
var USER;
var APIURI = "http://192.168.1.2:3000";
let currentSessionID = getCookie("currentSessionID");
if (currentSessionID != "" && currentSessionID != null) {
    window.location.href = "/serverlist.html";
}


window.onload = function () {
    //console.log(firebase.auth().currentUser);
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            // User is signed in.
            if (getCookie('sessionID') != '0') { // if it has one saved
                // asks if session already exists, only responds anything if the current user has perms
                request("GET", "/players/" + getCookie('sessionID')).then(
                    function (data) {
                        if (data == null) {
                            setCookie("sessionID", '0', 0.2);
                        } else {
                            window.location.href = "/serverlist.html";
                        }
                    })
            } else {
                if(nameChosen)
                request("POST", "/players", "username=" + nameChosen).then(function (data) {
                    console.log(data);

                    setCookie("userID", user.uid, 0.2);
                    setCookie("sessionID", data.sessionID);
                    setCookie("currentUsername", data.username, 0.2);
                    window.location.href = "/serverlist.html";

                });
            }
        } else {
            // User is signed out.
            console.log("Signed out")
        }
    });
}


var nameChosen = null;
function connect(form) {
    let name = htmlEscape(form.username.value);
    if (name == " " || name == "" || name == null) {
        return;
    }
    nameChosen = name;
    //socket.emit('new player', name);
    firebase.auth().signInAnonymously().catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
    });


    //window.location.href = "/static/serverlist.html";
}

async function request(method, endpoint, body, headers) {
    return new Promise(function (resolve, reject) {
        let req = new XMLHttpRequest();
        req.open(method, APIURI + endpoint);
        req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        req.setRequestHeader("userID", firebase.auth().currentUser.uid);
        for (let i = 0; i < headers.length; i++) {
            req.setRequestHeader(header[i].name, header[i].value)
        }
        req.send(encodeURI(body));
        req.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(this.response);
            } else {
                reject({
                    status: this.status,
                    statusText: this.statusText
                });
            }
            this.onerror = function () {
                reject({
                    status: this.status,
                    statusText: this.statusText
                });
            };
        };
    })
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