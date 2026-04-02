import mongoose from "mongoose";

const callSchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["audio", "video"], required: true },
  direction: { type: String, enum: ["incoming", "outgoing"], required: true },
  status: { type: String, enum: ["initiated", "answered", "declined", "missed", "ended", "completed", "ongoing"], default: "completed" },
  callId: { type: String }, // Unique identifier for the call session
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  duration: { type: Number }, // in seconds
}, { timestamps: true });

export default mongoose.model("Call", callSchema); 