/*******************************************************************************
 * Copyright (c) 2019.
 * Developed by Adam Hodgkinson
 * Last modified 13/07/19 22:40
 ******************************************************************************/


let currentSessionID = getCookie("currentSessionID");
if (currentSessionID == "") {
    window.location.href = "../";
}

var parts = window.location.search.substr(1).split("&");
var $_GET = {};
for (var i = 0; i < parts.length; i++) {
    var temp = parts[i].split("=");
    $_GET[decodeURIComponent(temp[0])] = decodeURIComponent(temp[1]);
}
const GAME_ID = $_GET['gameId'];

var gameState = {};
var bottomCardsData;
var selectedCardNo;

var roundTimeLeft = 0;
var roundTimeInterval = null;


var socket = io();
socket.on('message', function (data) {
    console.log(data);
    // TODO add to on screen logs
})

socket.on('get username', function (data) { // fires if the server accepts them as a returning player
    currentUsername = data;
    setCookie("currentUsername", currentUsername, 0.2);
    socket.emit('user connected to game', {session: currentSessionID, gameId: GAME_ID});
})

socket.on('logged out', function () {
    window.location.href = "../";
})

socket.on('game left', function () {
    window.location.href = "../static/serverlist.html";
})

socket.on('session not found', function () {
    setCookie("currentSessionID", "", 0.2);
    window.location.href = "../";
})

socket.on('game not found', function () {
    window.location.href = "../static/serverlist.html"
})

socket.on('game is full', function () {
    window.location.href = "../static/serverlist.html";
})

socket.on("winningCard", function (data) {
    for (let i = 0; i < gameState.playStateInfo.topCards[data].cards.length; i++) {
        console.log("card changed")
        winningCardIds[i] = "top-white-card-container" + data + "-card" + i;
        document.getElementById(winningCardIds[i]).className = "white-card-text winningCard";
    }
})

function showWinningCards() {
    console.log(winningCardIds)
    for (let i = 0; i < winningCardIds.length; i++) {
        console.log("card changed")
        document.getElementById(winningCardIds[i]).className = "white-card-text winningCard";
    }
}

let winningCardIds = [];

socket.on('receive full game state', function (data) {
    console.log("received game state");

    gameState = data;
    console.log(gameState)
    updatePlayersList();

    if (gameState.playState == 1) {
        winningCardIds = [];
    }

    if (gameState.playState != 0) {
        updateBlackCard();
        updateRoundTimer();
    }

    //if (gameState.playState == 2) {
    showTopCards();
    /*} else {
        document.getElementById("top-other-player-cards-container").innerHTML = "";
    }*/


    if (creatorOptionsAdded) {
        insertModalContent();
        return;
    }
    if (isCreator) {
        addCreatorOptions();
    }
})

function updateRoundTimer() {
    try {
        clearInterval(roundTimeInterval);
    } catch (e) {
        console.log(e)
    }

    roundTimeInterval = setInterval(function () {
        let endTime = gameState.roundTimerStart + 60000;
        let timeLeft = Math.floor((endTime - Date.now()) / 1000);

        document.getElementById("round-timer").innerText = "Time Left: " + timeLeft + "s";

    }, 1000)

}

let containerData = [{containerClassSize: "single"}, {containerClassSize: "double"}, {containerClassSize: "triple"}] // index = cards per container

function showTopCards() {
    /*if (!(gameState.playState == 2 || gameState.playState == 3)) { // cards may show up blank to show they are played
        return;
    }*/
    console.log("Shwoing top cards");
    let output = "";
    try {
        let tempCards = gameState.playStateInfo.topCards;
        console.log(tempCards)
        if (tempCards[0] == null) {
            document.getElementById("top-other-player-cards-container").innerHTML = "";
            return;
        }
        let containerSize = tempCards[0].cards.length;
        let contData = containerData[containerSize - 1];

        for (let i = 0; i < tempCards.length; i++) { // for each players cards
            output += "<div class=\"" + contData.containerClassSize + " card-container\" onclick=\"selectCard(this);\" id='card-container-" + i + "'>"
            for (let j = 0; j < tempCards[i].cards.length; j++) { // for each specific card
                let cardIndent;
                if (j == 0) cardIndent = "left";
                if (j == 1) cardIndent = "mid";
                if (j == 2) cardIndent = "right";
                output += "<div class=\"top-white-card " + cardIndent + "\"><p id=\"top-white-card-container" + i + "-card" + j + "\" class=\"white-card-text\">\n" +
                    tempCards[i].cards[j].cardText + "</p></div>"
            }

            output += "</div>"
        }

        document.getElementById("top-other-player-cards-container").innerHTML = output;
        showWinningCards();
    } catch (exception) {
        console.log(exception);
    }
}

function updateBlackCard() {
    let blackCard = gameState.playStateInfo.blackCard;
    document.getElementById("black-card-text").innerText = blackCard.cardText;
}


// todo click top cards
socket.on('receive bottom cards', function (data) {
    bottomCardsData = data;
    updateBottomCards();
})

socket.on('player list update', function (playerlist) {

})
var isCreator = false;
socket.on('is creator', function () {
    addCreatorOptions();
    isCreator = true;
})

socket.on("client is czar", activateCzarMode);

function activateCzarMode(data) {
    document.getElementById("czar-notice").style.display = "block";
    //todo change what client must do

}

socket.on("client not czar", deactivateCzarMode);

function deactivateCzarMode(data) {
    document.getElementById("czar-notice").style.display = "none";
}

function updateBottomCards() {
    console.log("Updating bottom cards");
    let text = "";
    for (var i = 0; i < bottomCardsData.length; i++) {
        text += '<button id="card-' + i + '" class="card" onclick="selectCard(this);"><p class="white-card-text">' + bottomCardsData[i].cardText + '</p></button>';
    }
    document.getElementById("cards-container").innerHTML = text;
}

function confirmCardChoice() {
    if (document.getElementById("czar-notice").style.display == "none") {
        socket.emit("choose card", {
            session: currentSessionID,
            gameId: gameState.gameId,
            cardIndex: selectedCardNo
        });
    } else if (document.getElementById("czar-notice").style.display != "none") {
        console.log("confirmed")
        socket.emit("czar choose card", {
            session: currentSessionID,
            gameId: gameState.gameId,
            cardIndex: czarSelectedCards
        });
    }
}

var czarSelectedCards;

function selectCard(card) {
    let hCard = document.getElementById(card.id);
    console.log(hCard)
    if (hCard.className == "card") {
        if (document.getElementById("czar-notice").style.display != "none") return;
        console.log(hCard);
        console.log(hCard.id[5]);
        selectedCardNo = parseInt(hCard.id[5]); // 5 is position in string of number }
    } else if (hCard.className.toString().includes("container")) {
        console.log("card selected")
        if (document.getElementById("czar-notice").style.display == "none") return;
        czarSelectedCards = parseInt(hCard.id[15]);

    }
}

function startGame() {
    socket.emit('start game', {gameId: gameState.gameId, session: currentSessionID})
}

function hideModal() {
    document.getElementById('modal').style.display = "none";
}

function insertModalContent() {

    let option = "";
    for (let i = 4; i < 70; i++) {
        if (i == 8) {
            option += "<option selected='selected' value=\"" + i + "\">" + i + "</option>\n"
            continue;
        }
        option += "<option value=\"" + i + "\">" + i + "</option>\n"
    }

    let players = "";
    for (let i = 1; i < gameState.players.length; i++) {
        players += "<option value=\"" + i + "\">" + gameState.players[i].username + "</option>\n";
    }

    let content = "    <div class=\"modal-content\">\n" +
        "        <span class=\"close\" id=\"close-modal\" onclick='hideModal();'>&times;</span>\n" +
        "        <div class=\"modal-box\"><p><b>Game Config</b></p>\n" +
        "            <label class='config-label'>Game Name:\n" +
        "                <input type=\"text\" value='" + gameState.gameName + "'>\n" +
        "            </label>\n" +
        "            <label class='config-label'>\n" +
        "                Points Goal:\n" +
        "                <select id='points-goal'>\n" +
        option +
        "                </select>\n" +
        "            </label>\n" +
        "            <label class='config-label'>" +
        "                Kick Player:" +
        "                <select id='select-kick-player'>" +
        players +
        "                </select>" +
        "                <button onclick='kickPlayer();'>Kick</button>" +
        "            </label>" +
        "        </div>\n" +
        "    </div>\n";

    document.getElementById("modal").innerHTML = content;
}

function kickPlayer() {
    let indexToKick = document.getElementById("select-kick-player").value;
    console.log("Kicking player " + indexToKick)
    socket.emit("kick player from game", {session: currentSessionID, index: indexToKick, gameId: gameState.gameId});
}

function addModal() {

    let modal = "<div class=\"modal\" id=\"modal\">\n" +
        "</div>";

    document.getElementById("body").innerHTML += modal;
}

var creatorOptionsAdded = false;

function addCreatorOptions() {
    if (gameState.players == null) {
        return;
    }
    creatorOptionsAdded = true;
    console.log("Player is creator, adding extra options...")
    document.getElementById("top-bar").innerHTML = "<button class=\"top-buttons\" onclick=\"leaveGame();\">Leave</button>\n" +
        "        <button class=\"top-buttons\" onclick=\"startGame();\">Start Game</button>\n" +
        "\n" +
        "        <div class=\"push-right\"></div>\n" +
        "\n" +
        "        <p class=\"right-button time-left\" id=\"round-timer\">Time Left: 60s</p>" +
        "        <button class=\"top-buttons right-button\" onclick=\"showGameConfig();\">Game Config</button>\n" +
        "        <button class=\"top-buttons right-button\" onclick=\"logOut()\">Log out</button>"

    addModal();
    insertModalContent();

    window.onclick = function (event) {
        if (event.target == document.getElementById('modal')) {
            document.getElementById('modal').style.display = "none";
        }
    }
}

function showGameConfig() {
    document.getElementById('modal').style.display = "block";
}

function updatePlayersList() {
    let playersList = gameState.players;
    let string = "";
    for (let i = 0; i < playersList.length; i++) {
        let pointsPrefix = "";
        if (playersList[i].waiting) pointsPrefix = "Waiting ... ";
        if (playersList[i].isCzar) pointsPrefix = "CZAR ... ";


        string += "<div class=\"player-list-item\"><p class=\"player-list-name\">" + playersList[i].username + "</p>\n" +
            "                            <p class=\"player-list-points\">" + pointsPrefix + playersList[i].points + "</p></div>"
    }

    document.getElementById("list-of-players").innerHTML = string;
}

function leaveGame() {
    socket.emit('player leave game', {gameId: GAME_ID, session: currentSessionID});
}

function logOut() {
    setCookie("currentSessionID", "", 0.2);
    socket.emit('log out', currentSessionID);
}

window.onload = function () {
    if (currentSessionID == "" || currentSessionID == null) {
        window.location.href = "../";
        return;
    }
    socket.emit('return player', currentSessionID);
    setCookie("currentSessionID", currentSessionID, 0.2);


}

function sendChatMessage(message) {
    document.getElementById("chat-box").innerHTML += "<p class='chat-message'>" + message + "</p>";
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
