const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
    room_id: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
    },
},{
    timestamps: true, 
    collection: 'rooms',
});

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;