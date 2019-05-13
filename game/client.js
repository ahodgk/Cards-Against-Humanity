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


var socket = io();
socket.on('message', function (data) {
    console.log(data);
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

socket.on('receive full game state', function (data) {
    gameState = data;
    console.log(gameState)
    updatePlayersList();
    if (creatorOptionsAdded) {
        insertModalContent();
        return;
    }
    if (isCreator) {
        addCreatorOptions();
    }
})
// todo display top cards
// todo display black card
// todo click top cards
// todo czar notice
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

socket.on("client is czar", activateCzarMode)

function activateCzarMode(data) {
    //todo show the czar notice thing
    document.getElementById("czar-notice").style.display = "block";
    //todo change what client must do

}

function updateBottomCards() {
    let text = "";
    for (var i = 0; i < bottomCardsData.length; i++) {
        text += '<button id="card-' + i + '" class="card" onclick="selectCard(this);"><p class="white-card-text">' + bottomCardsData[i].cardText + '</p></button>';
    }
    document.getElementById("cards-container").innerHTML = text;
}

function confirmCardChoice() {
    socket.emit("choose card", {session: currentSessionID, gameId: gameState.gameId, cardIndex: selectedCardNo});
}

function selectCard(card) {
    console.log(card);
    selectedCardNo = parseInt(card.id[5]);

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
        "        <button class=\"top-buttons\" onclick=\"showGameConfig();\">Game Config</button>\n" +
        "        <button class=\"top-buttons right\" onclick=\"logOut()\">Log out</button>"

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
        string += "<div class=\"player-list-item\"><p class=\"player-list-name\">" + playersList[i].username + "</p>\n" +
            "                            <p class=\"player-list-points\">" + playersList[i].points + "</p></div>"
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
