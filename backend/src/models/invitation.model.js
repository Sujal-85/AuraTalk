import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

invitationSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

const Invitation = mongoose.model("Invitation", invitationSchema);
export default Invitation;


