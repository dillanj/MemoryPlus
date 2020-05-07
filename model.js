const mongoose = require('mongoose');
var Schema = mongoose.Schema;



// mongoose.connect()
mongoose.connect('mongodb+srv://dillanj:FFHKCQ3VV26eHeSi@memory-app-emjea.mongodb.net/test?retryWrites=true&w=majority',
{ useNewUrlParser: true, useUnifiedTopology: true } )


// Memory will implement the pair as being question answer
// but by keeping it general, the architecture will allow options
// to be added in the future by adding any kind of matching 'pairs'

// Although the user creating a pair determines the strength, the app
// (in future) will quickly begin to use calculations to determine the actual
// strength of the pair. 
var pairSchema = new Schema({
    sideA: { type: String, required: [true, "To Create a matching pair, both sides of the pair are required."]},
    sideB: { type: String, required: [true, "To Create a matching pair, both sides of the pair are required."]},
    category: {type: String, required: [true, "Categorization is Organization."]},
    strength: { type: Number, required: false }
});

var Pair = mongoose.model('Pair', pairSchema );

module.exports = {
    Pair: Pair
}