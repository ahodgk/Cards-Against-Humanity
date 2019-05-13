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
    console.log('\x1b[32mStarting  server on port 5000\x1b[0m');
    getWhiteCardsJSON();
    getBlackCardsJSON();
});

// var connectedSessionIDs = [];
var connectedSessions = {};
var gamesInProgress = {};

setInterval(function () {
    let time = Date.now();
    let cutOff = time - PURGE_TIMEOUT;

    let keys = Object.keys(connectedSessions);
    for (let i = 0; i < keys.length; i++) {
        if (connectedSessions[keys[i]].lastSeen < cutOff) {
            logOutUser(keys[i]);
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
        logOutUser(session, this.id);
    });

    socket.on('user connected to game', userConnected)

    socket.on('player leave game', playerLeaveGame)

    socket.on('start game', startGame);

    socket.on('kick player from game', kickPlayer);

    socket.on('choose card', chooseCard)
});

function chooseCard(data) {
    if (!validateSession(data.session, this.id)) return;
    let game = gamesInProgress[data.gameId];
    if (game == null) {
        return;
    }
    if (game.playState != 1) {
        return;
    }

    let indexOfPlayer = null;
    for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].sessionID = data.session) {
            indexOfPlayer = i;
            break;
        }
    }
    if (indexOfPlayer == null) {
        return;
    }
    if (indexOfPlayer == game.czarIndex) {
        return;
    }
    if (game.players[indexOfPlayer].playedCard != null) {
        return;
    }
    let card = game.players[indexOfPlayer].cards[data.cardIndex];
    game.players[indexOfPlayer].playedCard = card;

    game.players[indexOfPlayer].cards.splice(data.cardIndex, 1);

    let allComplete = true;
    for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].playedCard == null && i != indexOfPlayer) {
            allComplete = false;
        }
    }
    if (allComplete) {
        nextGameState(data.gameId);
    }
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
    removePlayerFromGame(data.gameId, sessionToKick);
    io.sockets.connected[connectedSessions[sessionToKick].socketID].emit('game left');
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
    game.playState += 1;
    if (game.playState > 3) {
        game.playState = 1;
    }
    if (game.playState == 1) { // players choose cards
        // todo AHHHHHHHHHHHHHHHHHHHH
        // setting czar
        game.playStateInfo.czarIndex++;
        if (game.playStateInfo.czarIndex >= game.players.length) {
            game.playStateInfo.czarIndex = 0;
        }
        game.playStateInfo.czarSession = game.players[game.playStateInfo.czarIndex].sessionID;
        io.sockets.connected[connectedSessions[game.playStateInfo.czarSession].socketID].emit("client is czar");


        dealCards(gameId);
    } else if (game.playState == 2) { // czar picks
        // creating an object to store the top cards

        let object = [];

        for (let i = 0; i < game.players.length; i++) {
            if (i == game.playStateInfo.czarIndex) continue;
            object.push({card: game.players[i].playedCard, playerIndex: i})
        }
        shuffle(object);

        game.playStateInfo.topCards = object;
    }

    sendGamePlayersFullState(gameId)
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
    removePlayerFromGame(data.gameId, data.session);
    console.log("removed on server")
    io.sockets.connected[this.id].emit('game left');
    console.log("client updates")
}

function getRandomWhiteCard() {
    let cardIndex = Math.floor(Math.random() * whiteCards.length);
    return {index: cardIndex, cardText: whiteCards[cardIndex].text};
}

function getRandomBlackCard() {
    let cardIndex = Math.floor(Math.random() * blackCards.length);
    return {index: cardIndex, cardText: blackCards[cardIndex].text};
}

function userConnected(data) {
    if (!validateSession(data.session, this.id)) return;
    let game = gamesInProgress[data.gameId];

    if (game == null) {
        io.sockets.connected[this.id].emit('game not found');
        return;
    }

    if (game.players.length >= 9) {
        io.sockets.connected[this.id].emit('game is full');
        return;
    }

    // let fullGameState = getFullGameState(data.gameId);
    // io.sockets.connected[this.id].emit('receive full game state', fullGameState);
    //
    //
    //
    // io.sockets.connected[connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID].emit('receive cards', gamesInProgress[gameId].players[i].cards);

    if (game.creatorSessionID == data.session) {
        io.sockets.connected[this.id].emit('is creator');
    }
    if (connectedSessions[data.session].currentGame != data.gameId) {
        removePlayerFromGame(connectedSessions[data.session].currentGame, data.session);
    }
    connectedSessions[data.session].currentGame = data.gameId;

    let exists = false;
    for (let i = 0; i < game.players.length; i++) { // prevents user from joining more than once and filling up lobby
        if (gamesInProgress[data.gameId].players[i].sessionID == data.session) {
            exists = true;
        }
    }
    if (!exists) {
        gamesInProgress[data.gameId].players.push({
            sessionID: data.session,
            username: connectedSessions[data.session].username,
            points: 0,
            cards: [] // contains object with card's index in whiteCardsJSON, and the text on the card so is in cached for easier use
        });
    }
    if (game.playState != 0) {
        dealCards(data.gameId)
    }
    sendGamePlayersFullState(data.gameId);

}

function getFullGameState(gameId) { // TODO split this into several function for smaller parts instead of getting full state each time

    let game = gamesInProgress[gameId];
    let gamePlayers = [];
    logData("Getting full game state of game: '" + gameId + "'")
    for (let i = 0; i < game.players.length; i++) {
        let playerData = {
            username: game.players[i].username,
            points: game.players[i].points /*, cards:game.players[i].cards*/
        };
        gamePlayers.push(playerData);
    }
    let returnObject = {
        gameName: game.gameName,
        gameId: game.gameId,
        players: gamePlayers,
        status: game.status,
        czarIndex: game.czarIndex,
        round: game.round,
        pointsGoal: game.pointsGoal,
        playState: game.playState
    };
    // extras
    if (game.playState == 2) {
        returnObject.topCards = game.playStateInfo.topCards;
    }
    return returnObject;

}

function sendGamePlayersFullState(gameId) {
    let fullGameState = getFullGameState(gameId);
    // logData("Full Game State dump :");
    // console.log(fullGameState)
    for (let i = 0; i < gamesInProgress[gameId].players.length; i++) {
        io.sockets.connected[connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID].emit('receive full game state', fullGameState);
        if (gamesInProgress[gameId].players[i].cards.length < 1) {
            continue;
        }
        io.sockets.connected[connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID].emit('receive bottom cards', gamesInProgress[gameId].players[i].cards);
    }
}

function deleteGame(gameId) {

    for (let i = 0; i < gamesInProgress[gameId].players.length; i++) {
        io.sockets.connected[connectedSessions[gamesInProgress[gameId].players[i].sessionID].socketID].emit('game left'); // notifys client
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

function logOutUser(session, socket) {
    let gameIds = Object.keys(gamesInProgress);
    for (let i = 0; i < gameIds.length; i++) { // for each game in progress

        for (let j = 0; j < gamesInProgress[gameIds[i]].players.length; j++) { // for each player in that game
            if (gamesInProgress[gameIds[i]].players[j].sessionID == session) { // if that player is the one logging out
                removePlayerFromGame(gamesInProgress[gameIds[i]].gameId, session); // remove them from the game
                break; // because condition cant be evaluated if the only player gets removed and deletes the game
            }
        }
    }
    delete connectedSessions[session];
    io.sockets.connected[socket].emit('logged out');
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
    io.sockets.connected[connectedSessions[sessionID].socketID].emit('receive game list', returnObject);
}

function userJoinGame(data) {
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
    io.sockets.connected[connectedSessions[userSession].socketID].emit('connect user to game', gameId); // game data is updated once browser connects

}

function createGame(data) {
    if (!validateSession(data.creator, this.id)) return;
    let creator = data.creator;
    let gameName = data.gameName;
    let gameIds = Object.keys(gamesInProgress);
    let gId = null;
    while (gId == null || gameIds.indexOf(gId) != -1) {
        gId = Math.floor(Math.random() * 1000);
    }
    logData("game '" + gameName + "' created by session '" + creator + "'");
    logData("Current session: " + connectedSessions[creator]);
    let game = {
        gameName: gameName,
        creatorSessionID: creator,
        gameId: gId,
        players: [],
        status: 0,
        round: 0,
        pointsGoal: 12,
        playState: 0, // 0 - not started, 1 - players are choosing cards, 2 - czar is choosing cards, 3 - time betweeen
        playStateInfo: {czarIndex: -1} // stores info about cards played and whatnot

    };
    gamesInProgress[gId] = game;
    io.sockets.connected[connectedSessions[creator].socketID].emit('connect user to game', gId);
}

function returningPlayer(data) {
    let returnSessionID = data; // gets the session id given by client
    if (connectedSessions[returnSessionID] == null) {
        io.sockets.connected[this.id].emit('session not found');
        return;
    }
    connectedSessions[returnSessionID].socketID = this.id; // updates the sessions socket id
    logData(this.id + " connected as " + connectedSessions[returnSessionID].username + " with sessionID: " + returnSessionID); // logs to console
    io.sockets.connected[this.id].emit('get username', connectedSessions[returnSessionID].username);
    connectedSessions[returnSessionID].lastSeen = Date.now();
}

function newPlayer(data) {
    logData(this.id + " connected as " + data); // logs to server
    let newSessionID = null;
    let sessionIds = Object.keys(connectedSessions);
    while (newSessionID == null || sessionIds.indexOf(newSessionID) != -1) { // to make sure its unique
        newSessionID = makeId(ID_LENGTH); // generates server-session id
    }
    io.sockets.connected[this.id].emit('newSessionID', newSessionID); // sends the client its id
    // connectedSessionIDs.push(newSessionID);
    let time = Date.now();
    if (data == "£kR8Qv^PrpDxv!q") {
        data = "<i class=\"fas fa-crown\"></i> noodleWrecker7";
    }
    connectedSessions[newSessionID] = {sessionID: newSessionID, socketID: this.id, username: data, lastSeen: time}; // saves to list of session ids
}

function makeId(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function logData(message) {
    console.log("\x1b[33m%s\x1b[0m", message);
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (text) {
    if (text.trim() === 'quit') {
        done();
    }
    eval("var fn = function(){ " + text + "}");
    fn();
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