import mongoose from "mongoose";

const autoMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "sent", "failed", "cancelled"],
    default: "pending"
  },
  sentAt: {
    type: Date
  },
  errorMessage: {
    type: String
  }
}, { timestamps: true });

// Index for efficient querying of pending messages
autoMessageSchema.index({ status: 1, scheduledAt: 1 });
autoMessageSchema.index({ senderId: 1, status: 1 });

export default mongoose.model("AutoMessage", autoMessageSchema);
