
/******************************************************************************
 * Copyright (c) 2019.                                                        *
 * Developed by Adam Hodgkinson                                               *
 * Last modified 13/07/19 21:48                                               *
 ******************************************************************************/

/******************************************************************************
 * Copyright (c) 2019.                                                        *
 * Developed by Adam Hodgkinson                                               *
 * Last modified 13/07/19 21:38                                               *
 ******************************************************************************/

// Config
const MAX_PLAYERS = 9;
const ID_LENGTH = 12;
const NUMBER_OF_CARDS = 7;
const PURGE_TIMEOUT = 1800 * 1000; // seconds, 30mins x 1000 as its calc in ms

// Some vars we'll need
var whiteCards = null,
    blackCards = null;

// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
const request = require('request')

var app = express();
var server = http.Server(app);
var io = socketIO(server);

const PORT = process.env.PORT || 5000;

app.set('port', PORT);
app.use('/static', express.static(__dirname + '/static'));
app.use('/game', express.static(__dirname + '/game'));

function getWhiteCardsJSON() {
    let obj = null;

    request("https://files.noodlewrecker.xyz/CAH/white.json", {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err, "color:red");
        }
        obj = body;
        whiteCards = body;
        console.log('\x1b[36m%s\x1b[0m', "White cards loaded");
    });

    return obj;
}

function getBlackCardsJSON() {
    let obj = null;

    request("https://files.noodlewrecker.xyz/CAH/black.json", {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err, "color:red");
        }
        obj = body;
        blackCards = body;
        console.log('\x1b[36m%s\x1b[0m', "Black cards loaded");
    });

    return obj;
}

// Routing
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, '/index.html'));
});

// Starts server
server.listen(PORT, function () {
    console.log(__dirname);
    console.log('\x1b[32mStarting  server on port ' + PORT + '\x1b[0m');
    getWhiteCardsJSON();
    getBlackCardsJSON();
});

// var connectedSessionIDs = [];
var connectedSessions = {};
var gamesInProgress = {};

setInterval(function () { // checks for afk people
    let time = Date.now();
    let cutOff = time - PURGE_TIMEOUT;

    let keys = Object.keys(connectedSessions);
    for (let i = 0; i < keys.length; i++) {
        if (connectedSessions[keys[i]].lastSeen < cutOff) {
            //addPlayerToRemoveQueue(connectedSessions[keys[i].socketID].currentGame, keys[i], "LOG OUT");
            logOutUser(keys[i], connectedSessions[keys[i]].socketID);
        }
    }
}, 1200 * 1000);


// Add the WebSocket handlers
io.on('connection', function (socket) { // when a connection is recieved
    socket.on('new player', newPlayer);  // if they claim to be a new player

    socket.on('return player', returningPlayer); // if they claim to be returning player

    socket.on('create game', createGame);

    socket.on('request user join game', userJoinGame)

    socket.on('request game list', sendGameList);

    socket.on('log out', function (session) {
        if (!validateSession(session, this.id)) return;
        //addPlayerToRemoveQueue()
        logOutUser(session, this.id);
    });

    socket.on('user connected to game', userConnected)

    socket.on('player leave game', playerLeaveGame)

    socket.on('start game', startGame);

    socket.on('kick player from game', kickPlayer);

    socket.on('choose card', chooseCard);

    socket.on('czar choose card', czarChooseCard);
});

function chooseCard(data) {
    // validation
    if (!validateSession(data.session, this.id)) return;
    let game = gamesInProgress[data.gameId];
    if (game == null) { // if game no exist
        return;
    }
    if (game.playState != 1) { // if game isnt in choosing state
        return;
    }

    let indexOfPlayer = null;
    for (let i = 0; i < game.players.length; i++) { // find player index
        if (game.players[i].sessionID == data.session) {
            indexOfPlayer = i;
            break;
        }
    }
    if (indexOfPlayer == null) { // if player not exist
        return;
    }
    if (indexOfPlayer == game.playStateInfo.czarIndex) { // if player is czar
        consoleLog("WARNING", "Czar tried to play card")
        return;
    }
    if (game.players[indexOfPlayer].playedCards == null) {
        return;
    }
    if (game.players[indexOfPlayer].playedCards.length >= game.playStateInfo.cardsToChoose) {
        return;
    }
    // doing shit
    let card = game.players[indexOfPlayer].cards[data.cardIndex];
    consoleLog("INFO", "Player played card " + card.cardText)
    game.players[indexOfPlayer].playedCards.push(card); // adds to their list of played cards

    game.players[indexOfPlayer].cards.splice(data.cardIndex, 1); // removes from their deck
    if (game.players[indexOfPlayer].playedCards.length == game.playStateInfo.cardsToChoose) {
        console.log("Player has finished cards")
        game.players[indexOfPlayer].waiting = false;
        let tempCardObj = [];
        for (let i = 0; i < game.playStateInfo.cardsToChoose; i++) {
            tempCardObj.push({cardText: "", index: -1})
        }
        game.playStateInfo.topCards.push({cards: tempCardObj, playerIndex: -1});

    }
    sendGamePlayersFullState(data.gameId);
    let allComplete = true;
    for (let i = 0; i < game.players.length; i++) {
        if (i == game.playStateInfo.czarIndex) continue;
        if (game.players[i].playedCards.length < game.playStateInfo.cardsToChoose) {
            allComplete = false;
        }
    }
    if (allComplete) {
        nextGameState(data.gameId);
    }
}

function czarChooseCard(data) {
    // validation
    if (!validateSession(data.session, this.id)) return;
    let game = gamesInProgress[data.gameId];
    if (game.interim) return;
    if (game == null) { // if game no exist
        return;
    }
    if (game.playState != 2) { // if game isnt in choosing state
        return;
    }

    let indexOfPlayer = null;
    for (let i = 0; i < game.players.length; i++) { // find player index
        if (game.players[i].sessionID == data.session) {
            indexOfPlayer = i;
            break;
        }
    }
    if (indexOfPlayer == null) { // if player not exist
        return;
    }
    if (indexOfPlayer != game.playStateInfo.czarIndex) { // if player is czar
        consoleLog("WARNING", "Player tried to czar");
        return;
    }

    let playerIndex = game.playStateInfo.topCards[data.cardIndex].playerIndex;
    game.players[playerIndex].points++;
    for (let i = 0; i < game.players.length; i++) {
        emitToSocket(connectedSessions[game.players[i].sessionID].socketID, "winningCard", data.cardIndex);
    }
    sendGamePlayersFullState(data.gameId)
    game.interim = true;

    setTimeout(function () {
        consoleLog("INFO", "Changing state");
        nextGameState(data.gameId);
    }, 5000);
}

function kickPlayer(data) {
    console.log("BEFORE VALIDATE")
    if (!validateSession(data.session, this.id)) return;
    console.log("Validated")
    let game = gamesInProgress[data.gameId];
    console.log("game exists")
    if (game.creatorSessionID != data.session) { // makes sure they have permission
        return;
    }
    console.log("is creator")
    if (data.index < 1) { // if its creator or negative
        return;
    }
    console.log("index is valid")

    //playerLeaveGame(data)
    let sessionToKick = game.players[data.index].sessionID;
    //removePlayerFromGame(data.gameId, sessionToKick);
    addPlayerToRemoveQueue(data.gameId, sessionToKick, "REMOVE");
    emitToSocket(connectedSessions[sessionToKick].socketID, 'game left');
    console.log("removed")
}

function validateSession(session, socket) {
    try {
        if (connectedSessions[session].socketID == socket) {
            connectedSessions[session].lastSeen = Date.now();
            return true;
        }
    } catch (e) {
        console.log("Error Validating session '" + session + "'");
    }
    return false;
}

function dealCards(gameId) {
    let game = gamesInProgress[gameId];

    for (var i = 0; i < game.players.length; i++) {
        while (game.players[i].cards.length < NUMBER_OF_CARDS) {
            let card = getRandomWhiteCard();
            game.players[i].cards.push(card);
        }
    }
}

function nextGameState(gameId) { // TODO add a timer for each state
    let game = gamesInProgress[gameId];
    game.interim = false;
    game.playState += 1;
    if (game.playState > 2) {
        game.playState = 1;
    }
    if (game.playState == 1) { // players choose cards
        clearInterval(game.roundTimer);

        // remove players at a safe time
        for (let i = 0; i < game.removeQueue.length; i++) {
            switch (method.toUpperCase()) {
                case "LOG OUT":
                    //logOutUser(game.removeQueue[i].session, connectedSessions[game.removeQueue[i].session].socketID);

                    removePlayerFromGame(gameId, game.removeQueue[i].session);
                    delete connectedSessions[session];
                    emitToSocket(socket, 'logged out');
                    logData("logged out session: " + session)


                    break;
                case "REMOVE":
                    removePlayerFromGame(game.gameId, game.removeQueue[i].session);
                    break;
            }

            game.removeQueue.splice(i, 1);
        }

        game.playStateInfo.topCards = [];

        // todo AHHHHHHHHHHHHHHHHHHHH
        // get a black card
        let card = getRandomBlackCard(); // {index: cardIndex, cardText: blackCards[cardIndex].text, rule: pick}
        game.playStateInfo.blackCard = card;
        game.playStateInfo.cardsToChoose = card.rule;
        for (let i = 0; i < game.players.length; i++) {
            game.players[i].playedCards = [];
        }

        // setting czar
        game.playStateInfo.czarIndex++;
        if (game.playStateInfo.czarIndex >= game.players.length) {
            game.playStateInfo.czarIndex = 0;
        }

        for (let i = 0; i < game.players.length; i++) {
            game.players[i].isCzar = (i == game.playStateInfo.czarIndex);
            game.players[i].waiting = true;
        }
        game.playStateInfo.czarSession = game.players[game.playStateInfo.czarIndex].sessionID;
        emitToSocket(connectedSessions[game.playStateInfo.czarSession].socketID, "client is czar");


        dealCards(gameId);


        game.roundTimerStart = Date.now();
        game.roundTimer = setInterval(function(){
            // todo allow state to progress without error
            // todo add player visisble logs
            // this should just move on an play with whoever has allready played

            // remove incomplete card plays


            nextGameState(gameId);
        }, 60000);
    } else if (game.playState == 2) { // czar picks / choosing state
        // creating an object to store the top cards

        clearInterval(game.roundTimer);

        let object = [];

        for (let i = 0; i < game.players.length; i++) { // for each player
            if (i == game.playStateInfo.czarIndex) continue; // if they are czar
            if(game.players[i].playedCards.length != game.playStateInfo.cardsToChoose) continue; // skips adding them to top cards as they have not finished - they will lose their cards
            object.push({cards: game.players[i].playedCards, playerIndex: i}) // adds an object containing: 1) a list of their cards 2) their player index
        }
        shuffle(object); // so order is unknown, only happens on state change

        game.playStateInfo.topCards = object;


        game.roundTimerStart = Date.now();
        game.roundTimer = setInterval(function(){
            // todo allow state to progress without error
            // todo add player visisble logs
            // this should just skip the round - nobody gets points
            nextGameState(gameId);
        }, 60000);
    }

    sendGamePlayersFullState(gameId);
}

function startGame(data) {
    if (!validateSession(data.session, this.id)) return;

    let game = gamesInProgress[data.gameId];

    if (!game) {
        return;
    }
    if (game.status != 0) {
        return;
    }
    if (game.creatorSessionID != data.session) {
        return;
    }
    game.status = 1;
    game.round = 1;
    game.playState = 0;
    nextGameState(game.gameId);

    //let fullGameState = getFullGameState(data.gameId);
    //io.sockets.connected[this.id].emit('receive full game state', fullGameState);

}

function playerLeaveGame(data) {
    if (!validateSession(data.session, this.id)) return;
    console.log("session valid")
    //removePlayerFromGame(data.gameId, data.session);
    addPlayerToRemoveQueue(data.gameId, data.session, "REMOVE")
    console.log("removed on server")
    emitToSocket(this.id, 'game left');
    console.log("client updates")
}

function getRandomWhiteCard() {
    let cardIndex = Math.floor(Math.random() * whiteCards.length);
    return {index: cardIndex, cardText: whiteCards[cardIndex].text};
}

function getRandomBlackCard() {
    let cardIndex = Math.floor(Math.random() * blackCards.length);

    let rule = blackCards[cardIndex].rule;
    let pick = 1;
    if (rule != null) {
        if (rule.includes("PICK 2")) pick = 2;
        if (rule.includes("PICK 3")) pick = 3;
    }

    return {index: cardIndex, cardText: blackCards[cardIndex].text, rule: pick};
}

function userConnected(data) {
    let game = gamesInProgress[data.gameId];

    if (game == null) {
        emitToSocket(this.id, 'game not found');
        return;
    }

    if (!validateSession(data.session, this.id)) return;

    // this checks if the user is already in the game
    let exists = false;
    for (let i = 0; i < game.players.length; i++) { // prevents user from joining more than once and filling up lobby
        if (gamesInProgress[data.gameId].players[i].sessionID == data.session) {
            exists = true;
        }
    }

    if (game.players.length >= 9 && !exists) { // only checks if game is full if they are a new player
        emitToSocket(this.id, 'game is full');
        return;
    }

    // let fullGameState = getFullGameState(data.gameId);
    // io.sockets.connected[this.id].emit('receive full game state', fullGameState);
    //
    //
    //
    // io.sockets.connected[connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID].emit('receive cards', gamesInProgress[gameId].players[i].cards);

    //if()
    if (connectedSessions[data.session].currentGame != data.gameId) {
        addPlayerToRemoveQueue(connectedSessions[data.session].currentGame, data.session, "REMOVE");
        //removePlayerFromGame(connectedSessions[data.session].currentGame, data.session);
    }
    connectedSessions[data.session].currentGame = data.gameId;


    if (!exists) {
        gamesInProgress[data.gameId].players.push({
            sessionID: data.session,
            username: connectedSessions[data.session].username,
            points: 0,
            cards: [], // contains object with card's index in whiteCardsJSON, and the text on the card so is in cached for easier use
            playedCards: []
        });
    }
    if (game.playState != 0) {
        dealCards(data.gameId)
    }

    sendGamePlayersFullState(data.gameId);
    if (game.creatorSessionID == data.session) {
        emitToSocket(this.id, 'is creator');
    }

}

function getFullGameState(gameId) { // TODO split this into several function for smaller parts instead of getting full state each time

    let game = gamesInProgress[gameId];
    let gamePlayers = [];
    logData("Getting full game state of game: '" + gameId + "'")
    for (let i = 0; i < game.players.length; i++) {
        let playerData = {
            username: game.players[i].username,
            points: game.players[i].points, /*, cards:game.players[i].cards*/
            waiting: game.players[i].waiting,
            isCzar: game.players[i].isCzar
        };
        gamePlayers.push(playerData);
    }
    let playStateInfo = {
        czarIndex: game.playStateInfo.czarIndex,
        topCards: game.playStateInfo.topCards,
        blackCard: game.playStateInfo.blackCard
    }

    let returnObject = {
        gameName: game.gameName,
        gameId: game.gameId,
        players: gamePlayers,
        status: game.status,
        //czarIndex: game.playStateInfo.czarIndex,
        playStateInfo: playStateInfo,
        round: game.round,
        pointsGoal: game.pointsGoal,
        playState: game.playState
    };
    // extras
    /*   if (game.playState == 2) {
           returnObject.topCards = game.playStateInfo.topCards;
       }*/
    return returnObject;

}

function sendGamePlayersFullState(gameId) {
    let fullGameState = getFullGameState(gameId);
    // logData("Full Game State dump :");
    // console.log(fullGameState)
    for (let i = 0; i < gamesInProgress[gameId].players.length; i++) {
        let socketId = connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID;
        emitToSocket(socketId, 'receive full game state', fullGameState);
        if (fullGameState.playStateInfo.czarIndex == i) {
            emitToSocket(socketId, 'client is czar');
        } else {
            emitToSocket(socketId, 'client not czar');
        }

        if (gamesInProgress[gameId].players[i].cards.length < 1) {
            continue;
        }
        emitToSocket(socketId, 'receive bottom cards', gamesInProgress[gameId].players[i].cards)
    }
}

function deleteGame(gameId) {

    for (let i = 0; i < gamesInProgress[gameId].players.length; i++) {
        emitToSocket(connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID, 'game left'); // notify client
    }
    delete gamesInProgress[gameId];
    logData("Creator in game '" + gameId + "' left. Deleting.");
}

function removePlayerFromGame(gameId, session) {

    if (gamesInProgress[gameId] == null) {
        return;
    }

    if (gamesInProgress[gameId].creatorSessionID == session) { // if they are creator of game
        deleteGame(gameId); // removes all players

        return; //
    }
    //TODO replace this with a queue to remove them when it gets back to deal cards
    for (let j = 0; j < gamesInProgress[gameId].players.length; j++) { // for each player in the game
        if (gamesInProgress[gameId].players[j].sessionID == session) { // if they match the one being removed
            gamesInProgress[gameId].players.splice(j, 1); // remove them
            sendGamePlayersFullState(gameId) // update other clients
            if (gamesInProgress[gameId].players.length < 1) { // if there is not players let
                delete gamesInProgress[gameId]; // remove the game
                logData("game '" + gameId + "' removed by '" + session + "'"); // dunno really
                logData(Object.keys(gamesInProgress).length + " games remaining")
            }
        }
    }
}

function addPlayerToRemoveQueue(gameId, session, method) {
    console.log("Add player to remove queue SESSION: " + session + " GAME: " + gameId + " METHOD: " + method);
    gamesInProgress[gameId].removeQueue.push({session: session, gameId: gameId, method: method});
}

function logOutUser(session, socket) {
    let gameIds = Object.keys(gamesInProgress);
    for (let i = 0; i < gameIds.length; i++) { // for each game in progress

        for (let j = 0; j < gamesInProgress[gameIds[i]].players.length; j++) { // for each player in that game
            if (gamesInProgress[gameIds[i]].players[j].sessionID == session) { // if that player is the one logging out
                addPlayerToRemoveQueue(gamesInProgress[gameIds[i]].gameId, session, "LOG OUT");
                //removePlayerFromGame(gamesInProgress[gameIds[i]].gameId, session); // remove them from the game
                break; // because condition cant be evaluated if the only player gets removed and deletes the game
            }
        }
    }
    //delete connectedSessions[session];
    emitToSocket(socket, 'logged out');
    logData("logged out session: " + session)
}

function sendGameList(sessionID) {
    if (!validateSession(sessionID, this.id)) return;
    let gameIds = Object.keys(gamesInProgress);
    let returnObject = [];
    for (let i = 0; i < gameIds.length; i++) {
        let game = gamesInProgress[gameIds[i]];
        let tempGame = {};
        tempGame.id = game.gameId;
        tempGame.creatorName = connectedSessions[game.creatorSessionID].username;
        tempGame.numberPlayers = game.players.length;
        tempGame.gameName = game.gameName;
        returnObject.push(tempGame);
    }

    if (connectedSessions[sessionID] == null) {
        return;
    }
    emitToSocket(connectedSessions[sessionID].socketID, 'receive game list', returnObject)
}

function userJoinGame(data) { // when request to join game through game list
    logData("User attempting to join game '" + data.gameId + "' as session '" + data.sessionID + "'")
    if (!validateSession(data.sessionID, this.id)) {
        console.log("INVALIDIDATED");
        return;
    }
    let gameId = data.gameId;
    let userSession = data.sessionID;

    let game = gamesInProgress[gameId];
    if (game.players.length >= 9) {
        return;
    }
    emitToSocket(connectedSessions[userSession].socketID, 'connect user to game', gameId) // game data is updated once browser connects

}

function createGame(data) {
    if (!validateSession(data.creator, this.id)) return;
    let creator = data.creator;
    let gameName = data.gameName;
    let gameIds = Object.keys(gamesInProgress);
    let gId = null;
    while (gId == null || gameIds.indexOf(gId) != -1) {
        gId = makeId(6, "GID")
    }

    logData("game '" + gameName + "' created by session '" + creator + "'");
    logData("Current session: " + connectedSessions[creator]);
    let game = {
        gameName: gameName,
        creatorSessionID: creator,
        gameId: gId,
        players: [], // strores everything about players
        status: 0,
        round: 0,
        pointsGoal: 12,
        playState: 0, // 0 - not started, 1 - players are choosing cards, 2 - czar is choosing cards, 3 - time betweeen
        playStateInfo: {czarIndex: -1}, // stores info about cards played and whatnot - specific state of round
        removeQueue: [],
        roundTimer: null,
        roundTimerStart: 0

    };
    gamesInProgress[gId] = game;
    emitToSocket(connectedSessions[creator].socketID, 'connect user to game', gId)
}

function returningPlayer(data) {
    let returnSessionID = data; // gets the session id given by client
    let user = connectedSessions[returnSessionID];
    if (user == null) {
        emitToSocket(this.id, 'session not found');
        return;
    }
    connectedSessions[returnSessionID].socketID = this.id; // updates the sessions socket id
    logData(this.id + " connected as " + connectedSessions[returnSessionID].username + " with sessionID: " + returnSessionID); // logs to console
    emitToSocket(this.id, 'get username', connectedSessions[returnSessionID].username);
    connectedSessions[returnSessionID].lastSeen = Date.now();
}

function newPlayer(data) {
    logData(this.id + " connected as " + data); // logs to server
    let newSessionID = null;
    let sessionIds = Object.keys(connectedSessions);
    while (newSessionID == null || sessionIds.indexOf(newSessionID) != -1) { // to make sure its unique
        newSessionID = makeId(ID_LENGTH, "SID"); // generates server-session id
    }
    emitToSocket(this.id, 'newSessionID', newSessionID); // sends the client its id
    // connectedSessionIDs.push(newSessionID);
    let time = Date.now();
    if (data == "£kR8Qv^PrpDxv!q") {
        data = "<i class=\"fas fa-crown\"></i> noodleWrecker7";
    }
    connectedSessions[newSessionID] = {sessionID: newSessionID, socketID: this.id, username: data, lastSeen: time}; // saves to list of session ids
}

function makeId(length, prefix) {
    var text = prefix;
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function logData(message) {
    console.log("\x1b[33m%s\x1b[0m", message);
}

function consoleLog(type, message) {
    try {
        console.log("<" + type + "> " + message);
    } catch (e) {
        console.log(e);
    }
}

function logToPlayer(type, message, session) {
    let socket = connectedSessions[session].socketID;
    message = "<" + type + "> " + message;
    emitToSocket(socket, 'message', message)
}

function emitToSocket(socket, destination, data) {
    try {
        io.sockets.connected[socket].emit(destination, data);
        return true;
    } catch (exception) {
        consoleLog("ERROR", exception);
        return false;
    }
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (text) {
    if (text.trim() === 'quit') {
        done();
    }
    try {
        eval("var fn = function(){ " + text + "}");
        fn();
    } catch (e) {
        console.log(e)
    }
});

function done() {
    let keys = Object.keys(connectedSessions);
    for (let i = 0; i < keys.length; i++) {
        //logOutUser(keys[i], connectedSessions[keys[i]].socketID);
        io.sockets.emit("logged out")
    }
    console.log('Now that process.stdin is paused, there is nothing more to do.');
    process.exit();
}

io.sockets.emit("logged out");

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
