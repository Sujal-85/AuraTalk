import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    avatar: {
      type: String,
      default: ""
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }],
    members: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      joinedAt: {
        type: Date,
        default: Date.now
      },
      role: {
        type: String,
        enum: ["member", "admin"],
        default: "member"
      },
      mutedUntil: {
        type: Date,
        default: null
      },
      notificationTone: {
        type: String,
        default: ""
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    settings: {
      onlyAdminsCanSendMessages: {
        type: Boolean,
        default: false
      },
      onlyAdminsCanEditInfo: {
        type: Boolean,
        default: false
      },
      onlyAdminsCanAddMembers: {
        type: Boolean,
        default: false
      }
    },
    invite: {
      enabled: { type: Boolean, default: false },
      tokenHash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      maxUses: { type: Number, default: null },
      used: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Index for efficient queries
groupSchema.index({ "members.userId": 1 });
groupSchema.index({ admins: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ "invite.tokenHash": 1, "invite.expiresAt": 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  return this.admins.includes(userId);
};

// Method to check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(member => member.userId.toString() === userId.toString());
};

// Method to get user role in group
groupSchema.methods.getUserRole = function(userId) {
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  return member ? member.role : null;
};

const Group = mongoose.model("Group", groupSchema);
export default Group;
