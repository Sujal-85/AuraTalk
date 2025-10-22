import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { sendInvitation, listInvitations, acceptInvitation, declineInvitation, getInvitationStatus, listMyInvitations, listAcceptedPeers, cancelInvitation } from "../controllers/invitation.controller.js";

const router = express.Router();

router.post("/send", protectRoute, sendInvitation);
router.get("/inbox", protectRoute, listInvitations);
router.post("/:id/accept", protectRoute, acceptInvitation);
router.post("/:id/decline", protectRoute, declineInvitation);
router.delete("/:id", protectRoute, cancelInvitation);
router.get("/status/:otherUserId", protectRoute, getInvitationStatus);
router.get("/mine", protectRoute, listMyInvitations);
router.get("/accepted-peers", protectRoute, listAcceptedPeers);

export default router;


