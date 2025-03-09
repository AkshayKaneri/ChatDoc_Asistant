const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    namespace: { type: String, required: true },
    messages: [
        {
            sender: { type: String, enum: ["user", "assistant"], required: true },
            message: { type: String, required: true, trim: true },
            source: { type: Array, default: [] },
            timestamp: { type: Date, default: Date.now }
        }
    ]
});

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;