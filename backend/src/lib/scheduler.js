import { sendScheduledMessages } from "../controllers/autoMessage.controller.js";
import { archiveOldData } from "./archiver.js";

// Run the scheduler every minute to check for messages to send
export const startScheduler = () => {
  
  // Check for messages to send every 30 seconds for testing (change back to 60 * 1000 for production)
  setInterval(async () => {
    try {
      await sendScheduledMessages();
    } catch (error) {
    }
  }, 30 * 1000); // 30 seconds for testing
  
  // Also run immediately on startup to catch any missed messages
  sendScheduledMessages().catch(error => {
  });

  const minutes = parseInt(process.env.ARCHIVE_INTERVAL_MINUTES || "60", 10);
  const days = parseInt(process.env.ARCHIVE_RETENTION_DAYS || "3", 10);
  setInterval(async () => {
    try {
      await archiveOldData({ days });
    } catch (e) {
    }
  }, Math.max(5, minutes) * 60 * 1000);
  archiveOldData({ days }).catch(() => {});
};
