import AutoMessage from "../models/autoMessage.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId } from "../lib/socket.js";
import { io } from "../lib/socket.js";

// Create a new auto message
export const createAutoMessage = async (req, res) => {
  try {
    const { receiverId, message, scheduledAt } = req.body;
    const senderId = req.user._id;


    // Validate scheduled time is in the future
    const scheduledDateTime = new Date(scheduledAt);
    const now = new Date();
    
    
    if (scheduledDateTime <= now) {
      return res.status(400).json({ error: "Scheduled time must be in the future" });
    }

    const autoMessage = await AutoMessage.create({
      senderId,
      receiverId,
      message,
      scheduledAt: scheduledDateTime,
    });


    // Populate sender and receiver details
    await autoMessage.populate('senderId receiverId', 'fullName profilePic');

    res.status(201).json(autoMessage);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all auto messages for the logged-in user
export const getAutoMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const filter = { senderId: userId };
    if (status) {
      filter.status = status;
    }

    const autoMessages = await AutoMessage.find(filter)
      .populate('receiverId', 'fullName profilePic')
      .sort({ scheduledAt: 1 });

    res.json(autoMessages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update an auto message
export const updateAutoMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    const autoMessage = await AutoMessage.findById(id);
    if (!autoMessage) {
      return res.status(404).json({ error: "Auto message not found" });
    }

    // Only sender can update their auto message
    if (String(autoMessage.senderId) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized to update this auto message" });
    }

    // If status is already sent, don't allow updates
    if (autoMessage.status === "sent") {
      return res.status(400).json({ error: "Cannot update already sent message" });
    }

    // If updating scheduledAt, validate it's in the future
    if (updateData.scheduledAt) {
      const newScheduledTime = new Date(updateData.scheduledAt);
      const now = new Date();
      
      if (newScheduledTime <= now) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
    }

    Object.keys(updateData).forEach((key) => {
      autoMessage[key] = updateData[key];
    });

    await autoMessage.save();
    await autoMessage.populate('receiverId', 'fullName profilePic');

    res.json(autoMessage);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete an auto message
export const deleteAutoMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const autoMessage = await AutoMessage.findById(id);
    if (!autoMessage) {
      return res.status(404).json({ error: "Auto message not found" });
    }

    // Only sender can delete their auto message
    if (String(autoMessage.senderId) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized to delete this auto message" });
    }

    // If status is already sent, don't allow deletion
    if (autoMessage.status === "sent") {
      return res.status(400).json({ error: "Cannot delete already sent message" });
    }

    await AutoMessage.findByIdAndDelete(id);
    res.json({ message: "Auto message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Function to send scheduled messages (called by scheduler)
export const sendScheduledMessages = async () => {
  try {
    const now = new Date();

    // First, let's see ALL pending messages regardless of time
    const allPendingMessages = await AutoMessage.find({ status: "pending" });
    
    if (allPendingMessages.length > 0) {
      allPendingMessages.forEach((msg, index) => {
      });
    }

    // Find all pending messages that should be sent (scheduled time has passed)
    const pendingMessages = await AutoMessage.find({
      status: "pending",
      scheduledAt: { $lte: now }
    }).populate('senderId receiverId', 'fullName profilePic');


    for (const autoMessage of pendingMessages) {
      try {

        // Create the actual message
        const newMessage = new Message({
          senderId: autoMessage.senderId._id,
          receiverId: autoMessage.receiverId._id,
          text: autoMessage.message,
        });

        await newMessage.save();
        console.log(`[Scheduler] Message details:`, {
          senderId: newMessage.senderId,
          receiverId: newMessage.receiverId,
          text: newMessage.text,
          createdAt: newMessage.createdAt
        });

        // Update auto message status
        autoMessage.status = "sent";
        autoMessage.sentAt = new Date();
        await autoMessage.save();

        // Emit socket event if receiver is online
        const receiverSocketId = getReceiverSocketId(autoMessage.receiverId._id);
        
        if (receiverSocketId) {
          newMessage.delivered = true;
          newMessage.deliveredAt = new Date();
          await newMessage.save();
          
          // Populate the message before sending
          await newMessage.populate('senderId receiverId', 'fullName profilePic');
          
          io.to(receiverSocketId).emit("newMessage", newMessage);
          console.log(`[Scheduler] Emitted message:`, {
            id: newMessage._id,
            text: newMessage.text,
            senderId: newMessage.senderId,
            receiverId: newMessage.receiverId
          });
          
          // Emit delivery confirmation to sender
          const senderSocketId = getReceiverSocketId(autoMessage.senderId._id);
          if (senderSocketId) {
            io.to(senderSocketId).emit("messageDelivered", { messageId: newMessage._id });
          }
        } else {
        }

      } catch (error) {
        
        // Mark as failed
        autoMessage.status = "failed";
        autoMessage.errorMessage = error.message;
        await autoMessage.save();
      }
    }
  } catch (error) {
  }
};

// Test endpoint to manually trigger scheduler (for debugging)
export const testScheduler = async (req, res) => {
  try {
    await sendScheduledMessages();
    res.json({ message: "Scheduler triggered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to trigger scheduler" });
  }
};

// Test endpoint to create a test auto message (for debugging)
export const createTestMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the first user that's not the current user
    const otherUser = await User.findOne({ _id: { $ne: userId } });
    if (!otherUser) {
      return res.status(400).json({ error: "No other users found" });
    }
    
    // Schedule for 2 minutes from now
    const scheduledTime = new Date(Date.now() + 2 * 60 * 1000);
    
    
    const autoMessage = await AutoMessage.create({
      senderId: userId,
      receiverId: otherUser._id,
      message: "This is a test auto message!",
      scheduledAt: scheduledTime,
    });
    
    await autoMessage.populate('receiverId', 'fullName profilePic');
    
    
    res.json({ 
      message: "Test auto message created successfully",
      autoMessage,
      scheduledFor: scheduledTime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create test message" });
  }
};

// Test endpoint to create an immediate auto message (for debugging)
export const createImmediateTestMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the first user that's not the current user
    const otherUser = await User.findOne({ _id: { $ne: userId } });
    if (!otherUser) {
      return res.status(400).json({ error: "No other users found" });
    }
    
    // Schedule for 10 seconds from now (should be picked up immediately)
    const scheduledTime = new Date(Date.now() + 10 * 1000);
    
    
    const autoMessage = await AutoMessage.create({
      senderId: userId,
      receiverId: otherUser._id,
      message: "This is an immediate test auto message!",
      scheduledAt: scheduledTime,
    });
    
    await autoMessage.populate('receiverId', 'fullName profilePic');
    
    
    res.json({ 
      message: "Immediate test auto message created successfully",
      autoMessage,
      scheduledFor: scheduledTime.toISOString(),
      currentTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create immediate test message" });
  }
};

// Debug endpoint to check auto messages (for debugging)
export const debugAutoMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    
    // Get all auto messages for this user
    const allMessages = await AutoMessage.find({ senderId: userId })
      .populate('receiverId', 'fullName profilePic')
      .sort({ scheduledAt: 1 });
    
    // Get pending messages
    const pendingMessages = await AutoMessage.find({ 
      senderId: userId, 
      status: "pending" 
    }).populate('receiverId', 'fullName profilePic');
    
    // Get messages due now
    const dueMessages = await AutoMessage.find({
      senderId: userId,
      status: "pending",
      scheduledAt: { $lte: now }
    }).populate('receiverId', 'fullName profilePic');
    
    // Get ALL pending messages in the entire database (for debugging)
    const allPendingInDB = await AutoMessage.find({ status: "pending" });
    
    res.json({
      currentTime: now.toISOString(),
      totalMessages: allMessages.length,
      pendingMessages: pendingMessages.length,
      dueMessages: dueMessages.length,
      allPendingInDatabase: allPendingInDB.length,
      allMessages: allMessages,
      pendingMessages: pendingMessages,
      dueMessages: dueMessages,
      allPendingInDB: allPendingInDB.map(msg => ({
        id: msg._id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        scheduledAt: msg.scheduledAt.toISOString(),
        message: msg.message,
        status: msg.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to check auto messages" });
  }
};
