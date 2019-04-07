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
    console.log(data)
    updatePlayersList();

})

socket.on('player list update', function (playerlist) {

})

socket.on('is creator', function () {
    addCreatorOptions();
})

function addCreatorOptions() {
    document.getElementById("top-bar").innerHTML = "<button class=\"top-buttons\" onclick=\"\">Leave</button>\n" +
        "        <button class=\"top-buttons\" onclick=\"\">Start Game</button>\n" +
        "\n" +
        "        <div class=\"push-right\"></div>\n" +
        "\n" +
        "        <button class=\"top-buttons\" onclick=\"showGameConfig();\">Game Config</button>\n" +
        "        <button class=\"top-buttons right\" onclick=\"logOut()\">Log out</button>"

    document.getElementById("close-modal").onclick = function () {
        document.getElementById('modal').style.display = "none";
    }
    window.onclick = function(event) {
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