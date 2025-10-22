import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getUserGroups,
  getGroup,
  updateGroup,
  addMembers,
  removeMembers,
  makeAdmin,
  removeAdmin,
  leaveGroup,
  updateGroupSettings,
  createInvite,
  joinByInvite,
  muteGroup,
  unmuteGroup,
  setGroupNotificationTone
} from "../controllers/group.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Create a new group
router.post("/", createGroup);

// Get all groups for the authenticated user
router.get("/", getUserGroups);

// Get a specific group
router.get("/:groupId", getGroup);

// Update group information
router.put("/:groupId", updateGroup);

// Add members to group
router.post("/:groupId/members", addMembers);

// Remove members from group
router.delete("/:groupId/members", removeMembers);

// Make a member admin
router.post("/:groupId/admin", makeAdmin);

// Remove admin role
router.delete("/:groupId/admin", removeAdmin);

// Leave group
router.post("/:groupId/leave", leaveGroup);

// Update group settings
router.put("/:groupId/settings", updateGroupSettings);

// Create invite token (admin only)
router.post("/:groupId/invite", createInvite);

// Join by invite token (no groupId in path)
router.post("/join", joinByInvite);

// Notification preferences for current user in group
router.post("/:groupId/mute", muteGroup);
router.post("/:groupId/unmute", unmuteGroup);
router.post("/:groupId/notification-tone", setGroupNotificationTone);

export default router;
