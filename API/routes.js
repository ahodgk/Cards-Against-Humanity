/*
 * Copyright (c) 2020.
 * Developed by Adam Hodgkinson
 * Last modified 14/3/3 20:27
 *
 * Everything on this page, and other pages on the website, is subject to the copyright of Adam Hodgkinson, it may be freely used, copied, distributed and/or modified, however, full credit must be given
 * to me and any derived works should be released under the same license. I am not held liable for any claim, this software is provided as-is and without any warranty.
 *
 * I do not own any of the following content and is used under their respective licenses:
 *     Fontawesome
 *     Photonstorm's phaser.js
 */
var firebase = require("firebase/app");
require("firebase/auth");
require("firebase/database");
const firebaseConfig = require('./firebaseConfig.json');
firebase.initializeApp(firebaseConfig);
const login = require("./login.json");
firebase.auth().signInWithEmailAndPassword(login.email, login.pass);

module.exports = function (app) {
    console.log("Cards initialised");


    app.post('/players', (req, res) => { /* it doesnt actually delete old sessions, a user could have many sessions
    with the same anonymous account, but they should be purged after a long inactivity */
        let SID = createSessionID();
        let UID = req.header('userID');
        firebase.database().ref('/CARDSGAMESERVERDATA/connectedSessions/' + SID).set({
            sessionID: SID,
            userID: UID,
            displayName: req.body.username,
            currentGameID: null,
            lastSeen: 0
        }).then();

        res.send({sessionID: SID, username: req.body.username})
    });

    var SIDLength = 10;

    function createSessionID() {
        let validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"; //-*&^@£!
        let val = null;
        while (!val) {
            let id = "";
            for (let i = 0; i < SIDLength; i++) {
                id += validChars.substr(Math.random() * validChars.length, 1);
            }
            if (checkSessionFree(id)) {
                return id;
            }
        }
    } // returns id as string

    function checkSessionFree(session) {
        return new Promise(function (resolve, reject) {
            firebase.database().ref('/CARDSGAMESERVERDATA/connectedSessions/' + session).once('value').then(function (snapshot) {
                let result = snapshot.val();
                if (result == null) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
        })
    } // returns true if no session is in use with ID

    app.get('/players/:sessionID', (req, res) => { // auth
        firebase.database().ref('/CARDSGAMESERVERDATA/connectedSessions/' + req.params.sessionID).once('value').then(function (snapshot) {
            let result = snapshot.val();
            if (result == null) {
                res.send(null);
                return;
            }
            if (req.header('userID') === result.userID) {
                updateUserLastSeen(req.params.sessionID);
                res.send(result);
                return
            }

            res.send(null);
        })
    })

    function updateUserLastSeen(sessionID) {

        let updates = {"lastSeen": Date.now()};
        firebase.database().ref('/CARDSGAMESERVERDATA/connectedSessions/' + sessionID).update(updates)
    }
};

