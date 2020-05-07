// Required Libraries \\
const express = require('express');
const bP = require('body-parser');
const cors = require('cors');
const WebSocket = require('ws');


// Global Declarations \\

const BASE_URL =  "https://memory-plus.herokuapp.com";
// const BASE_URL = "http://localhost:8080";
const model = require('./model');
const Clients = require('./Clients');
const app = express();
const port = process.env.PORT || 8080;


// Middleware \\
// app.use( cors() );
app.use(cors({
    origin: `null, ${BASE_URL}`
}));

app.use( bP.json() );
app.use( express.static('public') );


// REST endpoints & necessary functions \\
var getRandomPairs = function ( all_pairs, amount ){
    for( var i = all_pairs.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * i)
        const temp = all_pairs[i]
        all_pairs[i] = all_pairs[j]
        all_pairs[j] = temp
      }
     return all_pairs.splice(0,amount);
}

app.get('/pairs', function(req,res){
    model.Pair.find().then( function (all_pairs) {
        if (all_pairs.length > 10){
            pairs = getRandomPairs( all_pairs, 10 )
        } else {
            pairs = all_pairs;
        }
        res.json(pairs);
    }). catch( function (err){
        console.log("Failed to get pairs from server. Error(s) are: ", err);
        res.sendStatus(400);
    });
});


app.post('/pairs', function( req, res){
    // console.log("Create pair body is: ", req.body);
    let pair = new model.Pair({
        sideA: req.body.sideA,
        sideB: req.body.sideB,
        category: "Example"
    });

    // console.log("Pair Model: ", pair);

    pair.save().then( function() {
        res.sendStatus(201);
        console.log("Pair Saved");
    }).catch( function (err){
        if (err.errors){
            console.log("Error(s) creating a pair: ", err);
            res.sendStatus(422);
        } else {
            res.sendStatus(500);
        }
    });
});


var server = app.listen(port, function() {
    console.log(`Memory App listening on port ${port}!`);
});








// WebSocket Endpoints \\
const wss = new WebSocket.Server({ server: server });
const clients = new Clients.Clients();
var games = {};

wss.on('connection', function connection(wsclient) {
    // wsclient is a unique object representing a unique client
    wsclient.on('message', function incoming(message) {
        // PARSE incoming JSON message received by the server from the client
        var data = JSON.parse(message);        

        // ERROR CHECKING \\
        if (data.game_token == undefined || data.action == undefined ){
            // the client is missing some piece of data.
            var error = "ERROR, MISSING DATA.";
            wsclient.send(JSON.stringify(error));
            return;
        } else if ( data.action == "join-game" && games[data.game_token] == undefined ){
            // the client sent an invalid game token. There is no game with that token
            var error = "ERROR, NO GAME WITH THAT TOKEN.";
            wsclient.send(JSON.stringify(error));
            return;
        }

        // INITIALIZING CLIENTS/ HANDLING GAME SETUP \\
        if ( data.action == "new-game"){
            if ( data.player == undefined ) {
                var error = "ERROR, MISSING DATA.";
                wsclient.send(JSON.stringify(error));
                return;
            }
            games[ data.game_token ] = [ data.player.id, null ]
            clients.saveClient(data.player.id, wsclient );
            console.log("looks like we should start a new game. current games: ", games);

            var message = "Wait, we need another player";
            wsclient.send(JSON.stringify(message));

        } else if ( data.action == "join-game" ){
            if ( data.player == undefined ) {
                var error = "ERROR, MISSING DATA.";
                wsclient.send(JSON.stringify(error));
                return;
            }
            // if the user is joing the game, he will always be the second player in the list
            // RANDOMLY SELECT 0 OR 1 AND LET THAT USER GO FIRST
            var random = Math.floor(Math.random() * 1);
            console.log("random num: ", random);
            if (random == 1){
                data.state.playerBTurn = true;
                console.log("player B should go first");
            } else {
                data.state.playerATurn = true;
                console.log("player A should go first.");
            }
            // add playerB to the games list 
            games[data.game_token][1] = data.player.id;
            clients.saveClient(data.player.id, wsclient );
            // SEND BOTH CLIENTS IN GAME AN INITIALIZED GAME STATE NOW.

            sendInitializedGameStateToClients( data );

        } else if ( data.action == "update-game-state" ){
            // "update-game-state" is used to update the state of the game, NOT switch turns
            sendGameStateToClients( data ) 
        }
        // console.log("client list: ", clients.clientList);


        // wsclient.send('Server received your message.');
    });

    // wsclient.send('You\'re Connected');
});


var sendInitializedGameStateToClients = function (data){
    
     // find the two player ids associated with the game token in the games list
     var players = games[data.game_token];
     console.log("Matched players: ", players);
     // loop through each of the clients associated with those player.ids
     // and foward them the game data.
     var initGameData = {
         action: "init-game-state",
         newState: data.state,
         isPlayerA: data.player.isPlayerA,
         isPlayerB: data.player.isPlayerB,
        //  gamePairs: data.state.game_cards
     }
     var playerNum = 0;
     players.forEach( function(player){
         if ( playerNum == 0 ) {
             initGameData.isPlayerA = true;
             initGameData.isPlayerB = false;
         }
         else if ( playerNum == 1 ){
            initGameData.isPlayerA = false;
            initGameData.isPlayerB = true;
         }
         clients.clientList[player].send( JSON.stringify(initGameData) );
         playerNum += 1;
     });

};



var sendGameStateToClients = function ( data ){
    // console.log("GOT A MESSAGE!", data);
    // find the two player ids associated with the game token in the games list
    var players = games[data.game_token];
    // loop through each of the clients associated with those player.ids
    // and foward them the game data.
    // var newGameData = data;
    var newGameData = {
        action: "update-game-state",
        newState: data.state
    }
    // console.log("about to send newGameData: ", newGameData );
    players.forEach( function(player){
        clients.clientList[player].send( JSON.stringify(newGameData) );
    });

}


