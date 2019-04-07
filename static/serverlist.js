let currentSessionID = getCookie("currentSessionID");
if (currentSessionID == "") {
    window.location.href = "../";
}

var socket = io();
socket.on('message', function (data) {
    console.log(data);
})

socket.on('get username', function (data) {
    currentUsername = data;
    setCookie("currentUsername", currentUsername, 0.2);
})

socket.on('connect user to game', function (gameId) {
    window.location.href = "/game?gameId=" + gameId;
})

socket.on('logged out', function() {
    window.location.href = "../";

})

socket.on('session not found', function() {
    setCookie("currentSessionID", "", 0.2);
    window.location.href = "../";
})

socket.on('receive game list', function (data) {
    let htmlOut = "";
    for (let i = 0; i < data.length; i++) {
        console.log(data[i])
        let lobby = data[i];

        let box = "<div class=\"openGame\">\n" +
            "            <div class=\"gameInfo\">\n" +
            "                <h3 class=\"gameTitle\">" + lobby.gameName + "</h3>\n" +
            "                <p class=\"gameCreator infoChunk\"><b>Creator:</b> " + lobby.creatorName + "</p>\n" +
            "                <p class=\"playersInGame infoChunk\"><b>Players:</b> " + lobby.numberPlayers + "/9</p>\n" +
            "            </div>\n" +
            "            <div class=\"gameButtons\">\n" +
            "                <button class=\"indButton\" onclick='requestJoinGame("+ lobby.id +")'>Join Game</button>\n" +
            "            </div>\n" +
            "        </div>";
        htmlOut += box;
    }
    document.getElementById("openGamesContainer").innerHTML = htmlOut;
});



let currentUsername;

window.onload = function () {
    if (currentSessionID == "" || currentSessionID == null) {
        window.location.href = "../";
        return;
    }
    socket.emit('return player', currentSessionID);
    setCookie("currentSessionID", currentSessionID, 0.2);
    refreshGameList();
}

function refreshGameList() {
    document.getElementById("openGamesContainer").innerHTML = "";
    socket.emit('request game list', currentSessionID);
}

function createGame() {
    let data = {creator: currentSessionID, gameName: null};
    data.gameName = prompt("Enter Game Name");
    socket.emit('create game', data);
}

function requestJoinGame(gameId) {
    socket.emit('request user join game', {gameId: gameId, sessionID: currentSessionID});
}

function logOut() {
    setCookie("currentSessionID", "", 0.2);
    socket.emit('log out', currentSessionID);
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