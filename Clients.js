// SOURCE: https://medium.com/@willrigsbee/how-to-keep-track-of-clients-with-websockets-1a018c23bbfc
class Clients {
    constructor() {
        this.clientList = {};
        this.saveClient = this.saveClient.bind(this);
    }

    saveClient(playerID,client){
        this.clientList[playerID] = client;
    }
}


module.exports = {
    Clients: Clients
}