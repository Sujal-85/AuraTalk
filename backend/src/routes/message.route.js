import express from "express"
import { protectRoute } from "../middleware/auth.middleware.js";
import { getUsersForSidebar, getMessages, sendMessage, deleteMessage, updateMessage, markMessagesAsSeen, markMessagesAsRead, deleteChat, getMessageInfo, getGroupMessages, sendGroupMessage } from "../controllers/message.controller.js"; 

const router = express.Router();
router.get("/users", protectRoute, getUsersForSidebar)
router.get("/:id", protectRoute, getMessages)

router.post("/send/:id", protectRoute, sendMessage)
router.delete("/:id", protectRoute, deleteMessage)
router.patch("/:id", protectRoute, updateMessage)
router.post("/seen/:id", protectRoute, markMessagesAsSeen)
router.post("/read/:userId", protectRoute, markMessagesAsRead)
router.delete("/chat/:userId", protectRoute, deleteChat)
router.get("/info/:id", protectRoute, getMessageInfo)

// Group message routes
router.get("/group/:groupId", protectRoute, getGroupMessages)
router.post("/group/:groupId", protectRoute, sendGroupMessage)

export default router;