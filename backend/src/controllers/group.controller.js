import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { randomBytes, createHash } from "crypto";

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const userId = req.user._id;

    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: "Group name and member IDs are required" });
    }

    // Add creator to members if not already included
    const allMemberIds = [...new Set([...memberIds, userId.toString()])];

    // Verify all users exist
    const users = await User.find({ _id: { $in: allMemberIds } });
    if (users.length !== allMemberIds.length) {
      return res.status(400).json({ error: "Some users not found" });
    }

    const group = new Group({
      name,
      description: description || "",
      createdBy: userId,
      admins: [userId],
      members: allMemberIds.map(memberId => ({
        userId: memberId,
        role: memberId === userId.toString() ? "admin" : "member"
      }))
    });

    await group.save();

    // Populate user details for response
    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.status(201).json(group);
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
};

// Create/rotate invite link (admin only)
export const createInvite = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { expiresInMinutes = 72 * 60, maxUses = null } = req.body || {};
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, isActive: true, "members.userId": userId });
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!group.isAdmin(userId)) return res.status(403).json({ error: "Only admins can create invites" });

    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = expiresInMinutes ? new Date(Date.now() + expiresInMinutes * 60 * 1000) : null;

    group.invite = {
      enabled: true,
      tokenHash,
      expiresAt,
      maxUses: maxUses || null,
      used: 0,
    };
    await group.save();

    return res.status(200).json({ token, expiresAt, maxUses: group.invite.maxUses });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create invite" });
  }
};

// Join a group using invite token
export const joinByInvite = async (req, res) => {
  try {
    const { token } = req.body || {};
    const userId = req.user._id;
    if (!token) return res.status(400).json({ error: "Token required" });
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const now = new Date();
    const group = await Group.findOne({
      isActive: true,
      "invite.enabled": true,
      "invite.tokenHash": tokenHash,
      $or: [ { "invite.expiresAt": null }, { "invite.expiresAt": { $gt: now } } ],
    });
    if (!group) return res.status(400).json({ error: "Invalid or expired invite" });

    const alreadyMember = group.members.some(m => String(m.userId) === String(userId));
    if (alreadyMember) return res.status(200).json({ message: "Already a member", groupId: group._id });

    if (group.invite.maxUses && group.invite.used >= group.invite.maxUses) {
      return res.status(400).json({ error: "Invite has reached its usage limit" });
    }

    group.members.push({ userId, role: "member" });
    group.invite.used = (group.invite.used || 0) + 1;
    await group.save();

    return res.status(200).json({ message: "Joined group", groupId: group._id });
  } catch (error) {
    return res.status(500).json({ error: "Failed to join by invite" });
  }
};

// Mute group for current user
export const muteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { durationMinutes = 480 } = req.body || {}; // default 8h
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, isActive: true, "members.userId": userId });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = group.members.find(m => String(m.userId) === String(userId));
    if (!member) return res.status(403).json({ error: "Not a member" });

    member.mutedUntil = new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000);
    await group.save();
    return res.status(200).json({ mutedUntil: member.mutedUntil });
  } catch (error) {
    return res.status(500).json({ error: "Failed to mute group" });
  }
};

export const unmuteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const group = await Group.findOne({ _id: groupId, isActive: true, "members.userId": userId });
    if (!group) return res.status(404).json({ error: "Group not found" });
    const member = group.members.find(m => String(m.userId) === String(userId));
    if (!member) return res.status(403).json({ error: "Not a member" });
    member.mutedUntil = null;
    await group.save();
    return res.status(200).json({ mutedUntil: null });
  } catch (error) {
    return res.status(500).json({ error: "Failed to unmute group" });
  }
};

export const setGroupNotificationTone = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { tone } = req.body || {};
    const userId = req.user._id;
    const group = await Group.findOne({ _id: groupId, isActive: true, "members.userId": userId });
    if (!group) return res.status(404).json({ error: "Group not found" });
    const member = group.members.find(m => String(m.userId) === String(userId));
    if (!member) return res.status(403).json({ error: "Not a member" });
    member.notificationTone = tone || "";
    await group.save();
    return res.status(200).json({ notificationTone: member.notificationTone });
  } catch (error) {
    return res.status(500).json({ error: "Failed to set notification tone" });
  }
};

// Get all groups for a user
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      "members.userId": userId,
      isActive: true
    }).populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]).sort({ updatedAt: -1 });

    res.json(groups);
  } catch (error) {
    console.error("Get user groups error:", error);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
};

// Get a specific group
export const getGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    }).populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json(group);
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({ error: "Failed to fetch group" });
  }
};

// Update group information
export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user can edit group info
    if (group.settings.onlyAdminsCanEditInfo && !group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can edit group information" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (avatar !== undefined) updateData.avatar = avatar;

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      updateData,
      { new: true }
    ).populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(updatedGroup);
  } catch (error) {
    console.error("Update group error:", error);
    res.status(500).json({ error: "Failed to update group" });
  }
};

// Add members to group
export const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: "Member IDs are required" });
    }

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user can add members
    if (group.settings.onlyAdminsCanAddMembers && !group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    // Verify users exist
    const users = await User.find({ _id: { $in: memberIds } });
    if (users.length !== memberIds.length) {
      return res.status(400).json({ error: "Some users not found" });
    }

    // Add new members (avoid duplicates)
    const existingMemberIds = group.members.map(m => m.userId.toString());
    const newMembers = memberIds
      .filter(id => !existingMemberIds.includes(id))
      .map(id => ({ userId: id, role: "member" }));

    if (newMembers.length === 0) {
      return res.status(400).json({ error: "All users are already members" });
    }

    group.members.push(...newMembers);
    await group.save();

    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(group);
  } catch (error) {
    console.error("Add members error:", error);
    res.status(500).json({ error: "Failed to add members" });
  }
};

// Remove members from group
export const removeMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: "Member IDs are required" });
    }

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    if (!group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    // Cannot remove the last admin
    const remainingAdmins = group.admins.filter(adminId => 
      !memberIds.includes(adminId.toString())
    );
    if (remainingAdmins.length === 0) {
      return res.status(400).json({ error: "Cannot remove all admins" });
    }

    // Remove members
    group.members = group.members.filter(member => 
      !memberIds.includes(member.userId.toString())
    );

    // Remove from admins if they were admins
    group.admins = group.admins.filter(adminId => 
      !memberIds.includes(adminId.toString())
    );

    await group.save();

    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(group);
  } catch (error) {
    console.error("Remove members error:", error);
    res.status(500).json({ error: "Failed to remove members" });
  }
};

// Make member admin
export const makeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    if (!group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can make other members admin" });
    }

    // Find the member
    const member = group.members.find(m => m.userId.toString() === memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Make admin
    member.role = "admin";
    if (!group.admins.includes(member.userId)) {
      group.admins.push(member.userId);
    }

    await group.save();

    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(group);
  } catch (error) {
    console.error("Make admin error:", error);
    res.status(500).json({ error: "Failed to make member admin" });
  }
};

// Remove admin role
export const removeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    if (!group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can remove admin role" });
    }

    // Cannot remove admin role from creator
    if (group.createdBy.toString() === memberId) {
      return res.status(400).json({ error: "Cannot remove admin role from group creator" });
    }

    // Find the member
    const member = group.members.find(m => m.userId.toString() === memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Remove admin role
    member.role = "member";
    group.admins = group.admins.filter(adminId => adminId.toString() !== memberId);

    await group.save();

    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(group);
  } catch (error) {
    console.error("Remove admin error:", error);
    res.status(500).json({ error: "Failed to remove admin role" });
  }
};

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Remove from members
    group.members = group.members.filter(member => 
      member.userId.toString() !== userId.toString()
    );

    // Remove from admins if they were admin
    group.admins = group.admins.filter(adminId => 
      adminId.toString() !== userId.toString()
    );

    // If no members left, deactivate group
    if (group.members.length === 0) {
      group.isActive = false;
    }

    await group.save();

    res.json({ message: "Left group successfully" });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ error: "Failed to leave group" });
  }
};

// Update group settings
export const updateGroupSettings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { settings } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    if (!group.isAdmin(userId)) {
      return res.status(403).json({ error: "Only admins can update group settings" });
    }

    // Update settings
    if (settings) {
      group.settings = { ...group.settings, ...settings };
    }

    await group.save();

    await group.populate([
      { path: "members.userId", select: "fullName profilePic" },
      { path: "admins", select: "fullName profilePic" },
      { path: "createdBy", select: "fullName profilePic" }
    ]);

    res.json(group);
  } catch (error) {
    console.error("Update group settings error:", error);
    res.status(500).json({ error: "Failed to update group settings" });
  }
};
