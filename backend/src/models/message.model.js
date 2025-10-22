import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
{
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"Group"
    },
    text:{
        type: String
    },
    image:{
        type: String
    },
    video:{
        type: String
    },
    audio:{
        type: String
    },
    document: {
        type: String
    },
    fileName: {
        type: String
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isDeletedForEveryone: {
        type: Boolean,
        default: false
    },
    delivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: {
        type: Date
    },
    seen: {
        type: Boolean,
        default: false
    },
    seenAt: {
        type: Date
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    replyTo: { type: String, default: null },
    replyToText: { type: String, default: null },
    replyToSenderName: { type: String, default: null },
},
    {timestamps: true},

);

const Message = mongoose.model("Message", messageSchema);
export default Message;
