import express from "express";
import { getFeed, getMine, postStatus, deleteStatus, toggleLike, addComment } from "../controllers/status.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/feed", protectRoute, getFeed);
router.get("/mine", protectRoute, getMine);
router.post("/", protectRoute, upload.single("file"), postStatus);
router.delete("/:id", protectRoute, deleteStatus);
router.post("/:id/like", protectRoute, toggleLike);
router.post("/:id/comment", protectRoute, addComment);

export default router;
