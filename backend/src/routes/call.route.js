import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addCall, getCallHistory, deleteCall, markCallAsRead } from "../controllers/call.controller.js";

const router = express.Router();

router.post("/", protectRoute, addCall);
router.get("/", protectRoute, getCallHistory);
router.patch("/:id/read", protectRoute, markCallAsRead);
router.delete("/:id", protectRoute, deleteCall);

export default router;