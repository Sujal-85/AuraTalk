import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addCall, getCallHistory, deleteCall } from "../controllers/call.controller.js";

const router = express.Router();

router.post("/", protectRoute, addCall);
router.get("/", protectRoute, getCallHistory);
router.delete("/:id", protectRoute, deleteCall);

export default router; 