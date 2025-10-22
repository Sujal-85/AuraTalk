import mongoose from "mongoose";

const archiveSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ["direct", "group", "call"], required: true },
    // For direct messages/calls, store a deterministic chat key of two userIds sorted and joined by '_'
    chatKey: { type: String, index: true },
    // For group messages
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", index: true },

    day: { type: Date, required: true, index: true }, // UTC day start (00:00:00)
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true, index: true },

    storagePath: { type: String, required: true }, // e.g., archives/messages/direct/<chatKey>/2025-10-20.jsonl.gz
    recordCount: { type: Number, default: 0 },
    compressedBytes: { type: Number, default: 0 },
    uncompressedBytes: { type: Number, default: 0 },
    checksum: { type: String },
  },
  { timestamps: true }
);

archiveSchema.index({ category: 1, chatKey: 1, day: -1 });
archiveSchema.index({ category: 1, groupId: 1, day: -1 });
archiveSchema.index({ category: 1, chatKey: 1, endAt: -1 });
archiveSchema.index({ category: 1, groupId: 1, endAt: -1 });

const Archive = mongoose.model("Archive", archiveSchema);
export default Archive;
