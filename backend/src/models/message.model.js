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
    statusReply: {
      type: {
        statusType: { type: String, enum: ['text', 'image', 'video'] },
        text: { type: String },
        mediaUrl: { type: String },
        ownerName: { type: String },
      },
      default: null,
    },
},
    {timestamps: true}
);

// Performance Indexes
// Index for direct messages between two users (common query)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

// Index for group messages
messageSchema.index({ groupId: 1, createdAt: -1 });

// Index for unread counts
messageSchema.index({ receiverId: 1, seen: 1 });


const Message = mongoose.model("Message", messageSchema);
export default Message;
