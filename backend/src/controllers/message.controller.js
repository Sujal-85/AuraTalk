import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Invitation from "../models/invitation.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { fetchArchivedDirectMessages, fetchArchivedGroupMessages } from "../lib/archiver.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    // For each user, get the last message exchanged with the logged-in user
    const usersWithLastMessage = await Promise.all(
      users.map(async (user) => {
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
          isDeletedForEveryone: { $ne: true },
          deletedFor: { $ne: loggedInUserId }
        })
          .sort({ createdAt: -1 })
          .lean();

        // Count unread messages from this user to the logged-in user
        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          readBy: { $ne: loggedInUserId },
          isDeletedForEveryone: { $ne: true },
          deletedFor: { $ne: loggedInUserId }
        });

        let lastMessage = null;
        if (lastMsg) {
          if (lastMsg.text) {
            lastMessage = { type: "text", content: lastMsg.text, createdAt: lastMsg.createdAt };
          } else if (lastMsg.image) {
            lastMessage = { type: "image", content: lastMsg.image, createdAt: lastMsg.createdAt };
          } else if (lastMsg.video) {
            lastMessage = { type: "video", content: lastMsg.video, createdAt: lastMsg.createdAt };
          } else if (lastMsg.audio) {
            lastMessage = { type: "audio", content: lastMsg.audio, createdAt: lastMsg.createdAt };
          } else if (lastMsg.document) {
            lastMessage = { type: "document", content: lastMsg.document, fileName: lastMsg.fileName, createdAt: lastMsg.createdAt };
          }
        }

        return {
          ...user.toObject(),
          lastMessage,
          unreadCount,
        };
      })
    );

    res.status(200).json(usersWithLastMessage);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 100)); // default 30, max 100
    const before = req.query.before; // ISO date string or messageId

    // Build base query
    let query = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ]
    };

    // If 'before' is provided, filter messages created before that date or messageId
    if (before) {
      // Try to parse as ISO date first, fallback to ObjectId
      let beforeDate = null;
      let beforeId = null;
      if (!isNaN(Date.parse(before))) {
        beforeDate = new Date(before);
        query.createdAt = { $lt: beforeDate };
      } else if (/^[0-9a-fA-F]{24}$/.test(before)) {
        beforeId = before;
        query._id = { $lt: beforeId };
      }
    }

    let dbMessages = await Message.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1); // Fetch one extra to check for more

    // Filter out messages deleted for the current user, unless deleted for everyone
    dbMessages = dbMessages.filter(msg =>
      msg.isDeletedForEveryone || !msg.deletedFor?.map(id => String(id)).includes(String(myId))
    );

    // Replace content for messages deleted for everyone
    dbMessages = dbMessages.map(msg => {
      if (msg.isDeletedForEveryone) {
        return {
          ...msg.toObject(),
          text: "this message is deleted",
          image: null,
          video: null,
          audio: null,
          document: null,
          fileName: null
        };
      }
      return msg;
    });

    // Determine if there are more messages in Mongo
    let dbHasMore = false;
    if (dbMessages.length > limit) {
      dbHasMore = true;
      dbMessages = dbMessages.slice(0, limit);
    }

    // Reverse to chronological order (oldest first)
    dbMessages = dbMessages.reverse();

    // If client is paginating (before provided) and Mongo doesn't have enough older data,
    // fetch remainder from archives stored in Firebase
    let combined = [...dbMessages];
    let hasMore = dbHasMore;
    if (!dbHasMore && before) {
      const remaining = Math.max(0, limit - combined.length);
      if (remaining > 0) {
        const { messages: archived, hasMore: arcMore } = await fetchArchivedDirectMessages({
          myId,
          otherUserId: userToChatId,
          before,
          limit: remaining,
        });
        // archived already oldest->newest and all < before
        combined = [...archived, ...combined];
        hasMore = arcMore; // if archives indicate more older chunks exist
      }
    }

    res.status(200).json({ messages: combined, hasMore });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, video, audio, document, fileName, replyTo: replyToId, replyToText: clientReplyToText, replyToSenderName: clientReplyToSenderName } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Require accepted invitation before allowing messages
    const invite = await Invitation.findOne({
      $or: [
        { fromUserId: senderId, toUserId: receiverId },
        { fromUserId: receiverId, toUserId: senderId },
      ],
    }).lean();
    if (!invite || invite.status !== "accepted") {
      return res.status(403).json({
        error: "Chat not allowed",
        code: "CHAT_INVITE_REQUIRED",
        invitation: invite || null,
      });
    }

    let imageUrl = null;
    let videoUrl = null;
    let audioUrl = null;
    let documentUrl = null;
    let documentName = null;

    // Upload image, video & audio in parallel (if provided)
    const uploadPromises = [];
    if (image) {
      uploadPromises.push(
        cloudinary.uploader.upload(image).then((uploadResponse) => {
          imageUrl = uploadResponse.secure_url;
        })
      );
    }
    if (video) {
      uploadPromises.push(
        cloudinary.uploader.upload(video, { resource_type: "video" }).then((uploadResponse) => {
          videoUrl = uploadResponse.secure_url;
        })
      );
    }
    if (audio) {
      uploadPromises.push(
        cloudinary.uploader.upload(audio, { resource_type: "video" }).then((uploadResponse) => {
          audioUrl = uploadResponse.secure_url;
        })
      );
    }
    if (document) {
      uploadPromises.push(
        cloudinary.uploader.upload(document, { resource_type: "raw" }).then((uploadResponse) => {
          documentUrl = uploadResponse.secure_url;
          documentName = fileName;
        })
      );
    }
    await Promise.all(uploadPromises);

    // WhatsApp-style reply logic
    let replyTo = null;
    let replyToText = null;
    let replyToSenderName = null;
    if (replyToId) {
      replyTo = replyToId;
      const originalMsg = await Message.findById(replyToId);
      if (originalMsg) {
        replyToText = originalMsg.text || originalMsg.fileName || "Media/Document";
        const senderUser = await User.findById(originalMsg.senderId);
        replyToSenderName = senderUser ? senderUser.fullName : "User";
      } else {
        replyToText = clientReplyToText || "Media/Document";
        replyToSenderName = clientReplyToSenderName || "User";
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      video: videoUrl,
      audio: audioUrl,
      document: documentUrl,
      fileName: documentName,
      replyTo,
      replyToText,
      replyToSenderName,
    });

    await newMessage.save();

    // Emit message via socket if receiver is online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      newMessage.delivered = true;
      newMessage.deliveredAt = new Date();
      await newMessage.save();
      io.to(receiverSocketId).emit("newMessage", newMessage);
      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", { messageId: newMessage._id });
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
      const { id } = req.params;
      const userId = req.user._id;
      const { forEveryone } = req.body; // Changed from deleteForEveryone to forEveryone for consistency

      // Validate message ID
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid message ID format" });
      }

      // Find message
      const message = await Message.findById(id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check authorization
      if (String(message.senderId) !== String(userId) && String(message.receiverId) !== String(userId)) {
        return res.status(403).json({ error: "Not authorized to delete this message" });
      }

      if (forEveryone) {
        // Only sender can delete for everyone
        if (String(message.senderId) !== String(userId)) {
          return res.status(403).json({ error: "Only sender can delete for everyone" });
        }
        message.isDeletedForEveryone = true;
        message.deletedFor = [];
        // Clear all content fields
        message.text = "";
        message.image = null;
        message.video = null;
        message.audio = null;
        message.document = null;
        message.fileName = null;
        
        await message.save();
        
        // For "delete for everyone", emit to both sender and receiver
        const receiverSocketId = getReceiverSocketId(message.receiverId);
        const senderSocketId = getReceiverSocketId(message.senderId);
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageDeleted", { messageId: id, deleteForEveryone: true });
        }
        if (senderSocketId && senderSocketId !== receiverSocketId) {
          io.to(senderSocketId).emit("messageDeleted", { messageId: id, deleteForEveryone: true });
        }
      } else {
        // Delete for me - only add to deletedFor array
        if (!message.deletedFor.includes(userId)) {
          message.deletedFor.push(userId);
        }
        
        await message.save();
        
        // For "delete for me", only emit to the user who deleted it (sender of delete request)
        // This ensures the message is removed from their UI immediately
        const userSocketId = getReceiverSocketId(userId);
        if (userSocketId) {
          io.to(userSocketId).emit("messageDeleted", { messageId: id, deleteForEveryone: false });
        }
        // DO NOT emit to the other user - they should keep seeing the original message
      }

      res.status(200).json({ success: true, message: "Message deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };

export const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    // Find message
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only sender or receiver can update
    if (String(message.senderId) !== String(userId) && String(message.receiverId) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized to update this message" });
    }

    // Update allowed fields
    Object.keys(updateData).forEach((key) => {
      message[key] = updateData[key];
    });
    await message.save();

    // Emit update event for real-time editing
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", {
        messageId: message._id,
        text: message.text,
        // add other fields if needed
      });
    }
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId && senderSocketId !== receiverSocketId) {
      io.to(senderSocketId).emit("messageEdited", {
        messageId: message._id,
        text: message.text,
        // add other fields if needed
      });
    }

    res.status(200).json({ success: true, message: "Message updated" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add a new controller to mark all messages as seen in a chat
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    await Message.updateMany(
      { senderId: userToChatId, receiverId: myId, seen: false },
      { $set: { seen: true, seenAt: new Date() } }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark all messages from a specific user as read by the current user
export const markMessagesAsRead = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const chatUserId = req.params.userId;
    // Mark all messages sent to the current user by chatUserId as read
    await Message.updateMany(
      {
        senderId: chatUserId,
        receiverId: currentUserId,
        readBy: { $ne: currentUserId }
      },
      {
        $addToSet: { readBy: currentUserId },
        $set: { seen: true, seenAt: new Date() }
      }
    );
    // Emit messageSeen event to the sender
    const updatedMessages = await Message.find({
      senderId: chatUserId,
      receiverId: currentUserId,
      readBy: currentUserId
    }).select('_id');
    const senderSocketId = getReceiverSocketId(chatUserId);
    if (senderSocketId) {
      // Broadcast seen to all sender sockets for reliability
      io.to(senderSocketId).emit("messageSeen", {
        messageIds: updatedMessages.map(m => m._id),
        userId: currentUserId
      });
    }
    // Also echo to receiver sockets so UI can reflect seen quickly if needed
    const receiverSocketId = getReceiverSocketId(currentUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageSeen", {
        messageIds: updatedMessages.map(m => m._id),
        userId: currentUserId
      });
    }
    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: otherUserId } = req.params;

    // Validate userId
    if (!otherUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // 'Delete for me': Add userId to deletedFor for all messages between the two users
    await Message.updateMany(
      {
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        deletedFor: { $ne: userId }
      },
      { $addToSet: { deletedFor: userId } }
    );

    // Emit chatDeleted event to both users
    const receiverSocketId = getReceiverSocketId(otherUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatDeleted", { userId });
    }
    const senderSocketId = getReceiverSocketId(userId);
    if (senderSocketId && senderSocketId !== receiverSocketId) {
      io.to(senderSocketId).emit("chatDeleted", { userId: otherUserId });
    }

    res.status(200).json({ success: true, message: "Chat deleted" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get message info for context menu
export const getMessageInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid message ID format" });
    }
    const message = await Message.findById(id).populate('readBy', 'fullName profilePic');
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.status(200).json({
      delivered: message.delivered,
      deliveredAt: message.deliveredAt,
      seen: message.seen,
      seenAt: message.seenAt,
      readBy: message.readBy,
      senderId: message.senderId,
      receiverId: message.receiverId,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Group message functions
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user._id;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 100));
    const before = req.query.before;

    // Verify user is a member of the group
    const Group = (await import("../models/group.model.js")).default;
    const group = await Group.findOne({
      _id: groupId,
      "members.userId": myId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found or you are not a member" });
    }

    // Build query for group messages
    let query = { groupId };

    if (before) {
      if (!isNaN(Date.parse(before))) {
        query.createdAt = { $lt: new Date(before) };
      } else if (/^[0-9a-fA-F]{24}$/.test(before)) {
        query._id = { $lt: before };
      }
    }

    let dbMessages = await Message.find(query)
      .populate('senderId', 'fullName profilePic')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    // Filter out messages deleted for the current user
    dbMessages = dbMessages.filter(msg =>
      msg.isDeletedForEveryone || !msg.deletedFor?.map(id => String(id)).includes(String(myId))
    );

    let dbHasMore = dbMessages.length > limit;
    if (dbHasMore) {
      dbMessages = dbMessages.slice(0, limit);
    }

    // Return oldest first for UI
    dbMessages = dbMessages.reverse();

    // If paginating and Mongo ran out, fetch from archives
    let combined = [...dbMessages];
    let hasMore = dbHasMore;
    if (!dbHasMore && before) {
      const remaining = Math.max(0, limit - combined.length);
      if (remaining > 0) {
        const { messages: archived, hasMore: arcMore } = await fetchArchivedGroupMessages({
          groupId,
          userId: myId,
          before,
          limit: remaining,
        });
        combined = [...archived, ...combined];
        hasMore = arcMore;
      }
    }

    res.status(200).json({
      messages: combined,
      hasMore,
    });
  } catch (error) {
    console.error('Error getting group messages:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user._id;
    const { text, image, video, audio, document, fileName, fileSize, replyTo, replyToText, replyToSenderName, isForwarded, originalSender, originalMessageId } = req.body;

    // Verify user is a member of the group
    const Group = (await import("../models/group.model.js")).default;
    const group = await Group.findOne({
      _id: groupId,
      "members.userId": myId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found or you are not a member" });
    }

    // Check if only admins can send messages
    if (group.settings.onlyAdminsCanSendMessages) {
      const isAdmin = group.admins.includes(myId);
      if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can send messages in this group" });
      }
    }

    // Build mentions array by parsing @handles from text using members' full names as handles
    let mentions = [];
    if (text && typeof text === 'string') {
      try {
        const memberIds = group.members.map(m => m.userId);
        const users = await User.find({ _id: { $in: memberIds } }).select('fullName');
        const handleMap = new Map(); // handle -> userId
        users.forEach(u => {
          const handle = String(u.fullName || '')
            .normalize('NFKD')
            .replace(/[^\p{L}\p{N}]+/gu, '')
            .toLowerCase();
          if (handle) handleMap.set(handle, String(u._id));
        });
        const found = new Set();
        const regex = /@([A-Za-z0-9_\.]+)/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
          const token = m[1].toLowerCase();
          // try direct token match; also try token without dots/underscores
          const key1 = token;
          const key2 = token.replace(/[\._]+/g, '');
          const uid = handleMap.get(key1) || handleMap.get(key2);
          if (uid && uid !== String(myId)) found.add(uid);
        }
        mentions = Array.from(found);
      } catch {}
    }

    // Create the message
    const newMessage = new Message({
      senderId: myId,
      groupId,
      text,
      image,
      video,
      audio,
      document,
      fileName,
      fileSize,
      replyTo,
      replyToText,
      replyToSenderName,
      isForwarded,
      originalSender,
      originalMessageId,
      mentions
    });

    const savedMessage = await newMessage.save();
    await savedMessage.populate('senderId', 'fullName profilePic');

    // Emit to group room (future-proof) and to all group members (current clients)
    try { io.to(String(groupId)).emit('newMessage', savedMessage); } catch {}
    const groupMembers = group.members.map(member => member.userId.toString());
    groupMembers.forEach(memberId => {
      const socketId = getReceiverSocketId(memberId);
      if (socketId && memberId !== myId.toString()) {
        io.to(socketId).emit("newMessage", savedMessage);
      }
    });

    // Targeted mention notification
    if (Array.isArray(mentions) && mentions.length > 0) {
      mentions.forEach(uid => {
        const sid = getReceiverSocketId(uid);
        if (sid) {
          io.to(sid).emit('group:mention', { groupId, messageId: savedMessage._id });
        }
      });
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error sending group message:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};