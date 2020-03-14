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

const express = require('express'); // used for listening stuff
const bodyParser = require('body-parser'); // to parse body formats

const app = express();

const port = 3000 || process.env.PORT;

app.use(bodyParser.urlencoded({extended: true})); // using db parser
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, userid");
    next();
});


require('routes.js')(app); // gets api routes
app.listen(port, () => { // begins listen
    console.log("Listening on " + port)
});

