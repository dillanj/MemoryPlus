const BASE_URL =  "https://memory-plus.herokuapp.com";
// const BASE_URL = "http://localhost:8080";

// const BASE_WS_URL = "localhost:8080";
const BASE_WS_URL = "memory-plus.herokuapp.com";


var ConnectionType = {
    NEW_GAME: 0,
    EXISTING_GAME:1
};

var ComponentType = {
    WELCOME_MODAL: 0,
    LOADING_MODAL: 1,
    GAME_BOARD: 2,
    GAME_OVER: 3
};


// REST Server Requests \\
var getGamePairsFromServer = function() {
    return fetch(`${BASE_URL}/pairs`);
};


// WS Server \\
var generateRandomToken = function() {
    // SOURCE: https://dev.to/rahmanfadhil/how-to-generate-unique-id-in-javascript-1b13
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return '_' + Math.random().toString(36).substr(2, 9);
};





// VUE \\

var app = new Vue({
    el: "#app",
    data: {
        socket: null,
        showModal: true,
        showWelcomeModal: true,
        showLoadingModal: false,
        showGameBoard: false,
        showGameOverModal: false,
        welcomeModal: {
            existingGameToken: "",
        },
        gameState: {
            aScore: 0,
            bScore: 0,
            playerATurn: false,
            playerBTurn: false,
            // category: "",
            // game cards is a list of 'Pair' Objects
            game_cards: [],
            // flipped cards is a list of card used to keep
            // track of the cards that the player has flipped
            // during their turn
            flipped_cards: [],
            game_token: "",
            gameOver: false,
            game_winner: ""
        },
        playerData: {
            id: "",
            isPlayerA: false,
            isPlayerB: false,
            // pairs is a list kept throughout the game of 
            // containing the id's of the pairs the player 
            // has matched.
            pairs: []
        }
    },
    methods: {
        showComponent: function ( type ){
            switch (type){
                case ComponentType.WELCOME_MODAL:
                    this.showModal = true;
                    this.showWelcomeModal = true;
                    this.showLoadingModal = false;
                    this.showGameBoard = false;
                    break;
                
                case ComponentType.LOADING_MODAL:
                    this.showModal = true;
                    this.showWelcomeModal = false;
                    this.showLoadingModal = true;
                    this.showGameBoard = false;
                    this.welcomeModal.existingGameToken = "";
                    break;

                case ComponentType.GAME_BOARD:
                    this.showModal = false;
                    this.showWelcomeModal = false;
                    this.showLoadingModal = false;
                    this.showGameBoard = true;
                    break;
                    
                case ComponentType.GAME_OVER:
                    this.showModal = true;
                    this.showGameOverModal = true;
                    this.showWelcomeModal = false;
                    this.showLoadingModal = false;
                    this.showGameBoard = true;
                    break;
            }

        }, // function

        enterNewMatchClicked: function() {
            var data = {
                action: "new-game",
                game_token: this.gameState.game_token,
                player: this.playerData,
                state: this.gameState
            }
            this.connectWebSocket( data );
            this.showComponent(ComponentType.LOADING_MODAL);

        }, // function

        enterExistingMatchClicked: function() {
            this.gameState.game_token = this.welcomeModal.existingGameToken;
            // if the user clicks to join another match and has a valid game_token
            // we request cards from the server. We request the cards here
            // so that we can send them as part of the init game data. This
            // allows for the players that are matched in the game to have the same 
            // set of cards, in the same order.
            getGamePairsFromServer().then(( response) => {
                response.json().then((pairs) => {
                    this.gameState.game_cards = this.splitAndShuffle(pairs);
                    var data = {
                        action: "join-game",
                        game_token: this.gameState.game_token,
                        player: this.playerData,
                        state: this.gameState,
                    }
                    this.connectWebSocket( data );
                }).catch(function(errors){
                    console.log("There was an error gettting pairs from the server. Error: ", errors);
                });
            });

        }, // function

        connectWebSocket: function( data ) {
            this.socket = new WebSocket(`wss://${BASE_WS_URL}`);
            
            // message received from client to server
            this.socket.onmessage = (event) => {
                var data = JSON.parse(event.data);
                if (data.action == "update-game-state"){
                    this.updateGameState( data.newState );
                }
                else if ( data.action == "init-game-state") {
                    this.initGame( data );
                    this.updateGameState( data.newState );
                }
                // console.log("received message: ", data);
            };

            // Send Message from client to server after connection has been established.
            this.socket.onopen = () => {
                this.socket.send(JSON.stringify(data))
            };

        }, //function

        initGame: function( data ){
            // when initializing a game, we need to set the game_cards
            // and set the players;
            this.gameState.game_cards = data.gamePairs;
            console.log("in initGame, data is: ", data);
            if(data.isPlayerA) {
                this.playerData.isPlayerA = true;
                this.playerData.isPlayerB = false;
            }
            else if ( data.isPlayerB ){
                this.playerData.isPlayerA = false;
                this.playerData.isPlayerB = true;
            }
            this.showComponent(ComponentType.GAME_BOARD);
        }, // function

        updateGameState: function( state ){            
            console.log("old state", this.gameState);
            this.gameState = state;
            console.log("new state: ", this.gameState);
            if ( this.gameState.gameOver ){
                this.showComponent(ComponentType.GAME_OVER);
            }
            
        }, //function

        sendGameState: function ( state ){
            if ( this.checkWinner() ){
               console.log("winner found");
            }
            var data = {
                action: "update-game-state",
                game_token: state.game_token,
                state: state
            }
            // console.log("about to make call to socket");
            this.socket.send(JSON.stringify(data))

        }, // function

        exitModalClicked: function() {
            this.welcomeModal.showModal = false;
            this.welcomeModal.showWelcomeModal = false;
        }, // function

        checkWinner: function() {
            if ( this.gameState.aScore + this.gameState.bScore >= (this.gameState.game_cards.length / 2) ){
                console.log("There is a winner!");
                if ( this.gameState.aScore > this.gameState.bScore ){
                    this.gameState.game_winner = "a";
                    console.log("Player A is winner!");
                } else if ( this.gameState.aScore < this.gameState.bScore ){
                    this.gameState.game_winner = "b";
                    console.log("Player B is winner!");
                } else {
                    this.gameState.game_winner = "t";
                    console.log("There was a tie. No one is a winner!");
                }
                this.gameState.gameOver = true;
                return true;
            }
            else {
                return false;
            }


        }, // function

        isMyTurn: function(){
            if ( this.playerData.isPlayerA && this.gameState.playerATurn ) {
                return true;
            } else if ( this.playerData.isPlayerB && this.gameState.playerBTurn ){
                return true;
            } else {
                return false;
            }
        }, // function

        switchPlayerTurns: function() {
            if ( this.gameState.playerATurn ) {
                this.gameState.playerATurn = false;
                this.gameState.playerBTurn = true;

            } else if ( this.gameState.playerBTurn) {
                this.gameState.playerATurn = true;
                this.gameState.playerBTurn = false;
            }
            // run through all the cards, if active the shut off their display
            this.gameState.game_cards.forEach( function(game_card){
                if (game_card.isActive){
                    game_card.isShown = false;
                }
            });
            this.gameState.flipped_cards = [];
            this.sendGameState( this.gameState );           

        }, // function

        flipCard: function(card) {
            // if my turn, and I haven't flipped >= 2 cards yet, and card isn't shown, and the card is active
            if ( this.isMyTurn() && this.gameState.flipped_cards.length < 2 && card.isActive && !card.isShown ) {
                card.isShown = true;
                // if the flip count is at 1, check to see if it matches with card that
                // comes right before it in cards_flipped
                if (this.gameState.flipped_cards.length == 1){
                    if( card.key == this.gameState.flipped_cards[ this.gameState.flipped_cards.length-1 ].key ){
                        console.log("it was a match with the card flipped before it!");
                        // if it does, it is matched. add it to the playerData.pairs list and increment player score
                        // and reset the turn flips to 0, and make sure the the paired cards are not active
                        this.playerData.pairs.push( card.key );
                        // console.log("right before incrementing score, gameState: ", this.gameState);
                        // console.log("right before incrementing score, player: ", this.playerData);

                        if (this.playerData.isPlayerA && this.gameState.playerATurn ){
                            console.log("incrementing score for player A");
                            this.gameState.aScore += 1;
                        } else if ( this.playerData.isPlayerB && this.gameState.playerBTurn ){
                            console.log("incrementing score for player B");
                            this.gameState.bScore += 1;
                        }
                        this.gameState.flipped_cards = [];
                        card.isActive = false;
                        card.pairedByPlayer = this.playerData.id;

                         console.log("in match, the player was: ", this.playerData);

                        //loop through the cards and make the one that was just matched inactive
                        this.gameState.game_cards.forEach( (game_card) => {
                            if (game_card.key == card.key){
                                game_card.isActive = false;
                                game_card.pairedByPlayer = this.playerData.id;
                            }
                        });
                    this.sendGameState( this.gameState );           
                    } 
                    else {
                        // no match. reset game params then initiate next players turn
                        this.gameState.flipped_cards.push(card);
                        this.sendGameState( this.gameState );           
                        console.log("NO MATCH!");
                        var v = this;
                        setTimeout(function() {
                            v.switchPlayerTurns()
                        },3000);
                    }

                }  else {
                    // it was their first flip of their new turn
                    // flip it and increment flipped cards.
                    card.isShown = true;
                    this.gameState.flipped_cards.push(card);
                    this.sendGameState( this.gameState );           
                }  
                    
            } else {
                // can't flip! NOT YOUR TURN.
                console.log("can't flip, not your turn.");
                return;
            }

        }, // function
        getGamePairs: function() {
            getGamePairsFromServer().then(( response) => {
                response.json().then((pairs) => {
                    this.gameState.game_cards = this.splitAndShuffle(pairs);
                    console.log("shuffled cards: ", this.gameState.game_cards);
                });
            });
        },
        splitAndShuffle: function(pairs) {
            side_a = [];
            side_b = [];
            // console.log("pairs", pairs);
            for(var i = 0; i < pairs.length; i++) {
                side_a.push({
                    value: pairs[i].sideA,
                    key: pairs[i]._id,
                    isShown: false,
                    isActive: true,
                    pairedByPlayer: ""
                });
                side_b.push({
                    value: pairs[i].sideB,
                    key: pairs[i]._id,
                    isShown: false,
                    isActive: true,
                    pairedByPlayer: ""
                });
            }
            return this.shuffle(side_a.concat(side_b));


        }, // function
        shuffle: function( list ){
            for( var i = list.length - 1; i > 0; i--){
                const j = Math.floor(Math.random() * i)
                const temp = list[i]
                list[i] = list[j]
                list[j] = temp
            }
            return list; 
        }, // function

    }, // methods
    created: function(){
        console.log("Vue App Loaded.")
        this.showComponent(ComponentType.WELCOME_MODAL);
        this.gameState.game_token = generateRandomToken();
        this.playerData.id = generateRandomToken();
    }



});