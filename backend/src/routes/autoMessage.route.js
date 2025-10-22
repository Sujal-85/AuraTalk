import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
  createAutoMessage, 
  getAutoMessages, 
  updateAutoMessage, 
  deleteAutoMessage,
  testScheduler,
  debugAutoMessages,
  createTestMessage,
  createImmediateTestMessage
} from "../controllers/autoMessage.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Create a new auto message
router.post("/", createAutoMessage);

// Get all auto messages for the logged-in user
router.get("/", getAutoMessages);

// Update an auto message
router.put("/:id", updateAutoMessage);

// Delete an auto message
router.delete("/:id", deleteAutoMessage);

// Test endpoint to manually trigger scheduler (for debugging)
router.post("/test-scheduler", testScheduler);

// Debug endpoint to check auto messages (for debugging)
router.get("/debug", debugAutoMessages);

// Test endpoint to create a test auto message (for debugging)
router.post("/create-test", createTestMessage);

// Test endpoint to create an immediate auto message (for debugging)
router.post("/create-immediate-test", createImmediateTestMessage);

export default router;
