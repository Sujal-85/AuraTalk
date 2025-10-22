import Invitation from "../models/invitation.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const sendInvitation = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { toUserId } = req.body;
    console.log(`Sending invitation from ${fromUserId} to ${toUserId}`);
    
    if (!toUserId) return res.status(400).json({ message: "toUserId is required" });
    if (String(fromUserId) === String(toUserId)) {
      return res.status(400).json({ message: "Cannot invite yourself" });
    }

    let invitation = await Invitation.findOne({ fromUserId, toUserId });
    if (!invitation) {
      invitation = await Invitation.create({ fromUserId, toUserId, status: "pending" });
      console.log(`Created new invitation: ${invitation._id}`);
    } else if (invitation.status !== "pending") {
      invitation.status = "pending";
      await invitation.save();
      console.log(`Updated existing invitation: ${invitation._id}`);
    }

    const receiverSocketId = getReceiverSocketId(String(toUserId));
    const senderSocketId = getReceiverSocketId(String(fromUserId));
    
    console.log(`Emitting invitation:new to receiver ${toUserId} (socket: ${receiverSocketId})`);
    console.log(`Emitting invitation:sent to sender ${fromUserId} (socket: ${senderSocketId})`);
    
    if (receiverSocketId) io.to(receiverSocketId).emit("invitation:new", invitation);
    if (senderSocketId) io.to(senderSocketId).emit("invitation:sent", invitation);

    return res.status(201).json(invitation);
  } catch (err) {
    console.error("Error sending invitation:", err);
    if (err && err.code === 11000) {
      const existing = await Invitation.findOne({ fromUserId: req.user._id, toUserId: req.body.toUserId });
      return res.status(200).json(existing);
    }
    return res.status(500).json({ message: "Failed to send invitation" });
  }
};

export const listInvitations = async (req, res) => {
  try {
    const userId = req.user._id;
    const invites = await Invitation.find({ toUserId: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(invites);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load invitations" });
  }
};

// All invitations where I am sender or receiver
export const listMyInvitations = async (req, res) => {
  try {
    const userId = req.user._id;
    const invites = await Invitation.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json(invites);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load my invitations" });
  }
};

// Return array of userIds that have accepted invitation with me
export const listAcceptedPeers = async (req, res) => {
  try {
    const userId = req.user._id;
    const invites = await Invitation.find({
      status: "accepted",
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).lean();
    const peers = invites.map((inv) =>
      String(inv.fromUserId) === String(userId) ? String(inv.toUserId) : String(inv.fromUserId)
    );
    return res.json({ peers });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load accepted peers" });
  }
};

export const acceptInvitation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    console.log(`Accepting invitation ${id} by user ${userId}`);
    
    const invite = await Invitation.findById(id);
    if (!invite) {
      console.log(`Invitation ${id} not found`);
      return res.status(404).json({ message: "Invitation not found" });
    }
    
    if (String(invite.toUserId) !== String(userId)) {
      console.log(`User ${userId} not authorized to accept invitation ${id}`);
      return res.status(403).json({ message: "Not authorized" });
    }
    
    invite.status = "accepted";
    await invite.save();
    console.log(`Invitation ${id} accepted successfully`);

    const fromSocket = getReceiverSocketId(String(invite.fromUserId));
    const toSocket = getReceiverSocketId(String(invite.toUserId));
    
    console.log(`Emitting invitation:accepted to fromUserId: ${invite.fromUserId} (socket: ${fromSocket})`);
    console.log(`Emitting invitation:accepted to toUserId: ${invite.toUserId} (socket: ${toSocket})`);
    
    if (fromSocket) io.to(fromSocket).emit("invitation:accepted", invite);
    if (toSocket) io.to(toSocket).emit("invitation:accepted", invite);

    return res.json(invite);
  } catch (err) {
    console.error("Error accepting invitation:", err);
    return res.status(500).json({ message: "Failed to accept invitation" });
  }
};

export const declineInvitation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const invite = await Invitation.findById(id);
    if (!invite) return res.status(404).json({ message: "Invitation not found" });
    if (String(invite.toUserId) !== String(userId)) return res.status(403).json({ message: "Not authorized" });
    invite.status = "declined";
    await invite.save();

    const fromSocket = getReceiverSocketId(String(invite.fromUserId));
    if (fromSocket) io.to(fromSocket).emit("invitation:declined", invite);
    const toSocket = getReceiverSocketId(String(invite.toUserId));
    if (toSocket) io.to(toSocket).emit("invitation:declined", invite);

    return res.json(invite);
  } catch (err) {
    return res.status(500).json({ message: "Failed to decline invitation" });
  }
};

// Allow sender or receiver to cancel/delete an invitation
export const cancelInvitation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const invite = await Invitation.findById(id);
    if (!invite) return res.status(404).json({ message: "Invitation not found" });
    // allow either sender or receiver to cancel
    if (String(invite.fromUserId) !== String(userId) && String(invite.toUserId) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await Invitation.findByIdAndDelete(id);

    const fromSocket = getReceiverSocketId(String(invite.fromUserId));
    if (fromSocket) io.to(fromSocket).emit("invitation:cancelled", invite);
    const toSocket = getReceiverSocketId(String(invite.toUserId));
    if (toSocket) io.to(toSocket).emit("invitation:cancelled", invite);

    return res.json({ message: 'Invitation cancelled' });
  } catch (err) {
    return res.status(500).json({ message: "Failed to cancel invitation" });
  }
};

export const getInvitationStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    const invite = await Invitation.findOne({
      $or: [
        { fromUserId: userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: userId },
      ],
    }).lean();
    return res.json({ invitation: invite || null });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get invitation status" });
  }
};


