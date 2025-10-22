import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  const socketIds = userSocketMap[userId];
  const result = socketIds && socketIds.length > 0 ? socketIds[0] : null;
  console.log(`Getting socket ID for user ${userId}:`, result, `(available: ${socketIds?.length || 0})`);
  return result;
}

// used to store online users
const userSocketMap = {}; // {userId: [socketId, ...]}

io.on("connection", (socket) => {

  const userId = socket.handshake.query.userId;
  console.log(`Socket connected: ${socket.id} for user: ${userId}`);
  
  if (userId) {
    if (!userSocketMap[userId]) userSocketMap[userId] = [];
    userSocketMap[userId].push(socket.id);
    console.log(`User ${userId} socket map updated:`, userSocketMap[userId]);
  }

  // Emit all userIds with at least one socket
  const onlineUsers = Object.keys(userSocketMap).filter(uid => userSocketMap[uid].length > 0);
  console.log(`Emitting online users:`, onlineUsers);
  io.emit("getOnlineUsers", onlineUsers);

  // --- Group room membership ---
  socket.on('groups:joinRooms', ({ groupIds }) => {
    try {
      if (Array.isArray(groupIds)) {
        groupIds.forEach((gid) => {
          const room = String(gid);
          socket.join(room);
        });
      }
    } catch {}
  });
  socket.on('groups:leaveRooms', ({ groupIds }) => {
    try {
      if (Array.isArray(groupIds)) {
        groupIds.forEach((gid) => {
          const room = String(gid);
          socket.leave(room);
        });
      }
    } catch {}
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id} for user: ${userId}`);
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId] = userSocketMap[userId].filter(id => id !== socket.id);
      if (userSocketMap[userId].length === 0) {
        delete userSocketMap[userId];
      }
      console.log(`User ${userId} socket map after disconnect:`, userSocketMap[userId] || 'removed');
    }
    const onlineUsers = Object.keys(userSocketMap).filter(uid => userSocketMap[uid].length > 0);
    console.log(`Emitting online users after disconnect:`, onlineUsers);
    io.emit("getOnlineUsers", onlineUsers);
  });

  // --- WebRTC Call Signaling ---
  socket.on("call:offer", ({ to, ...data }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      io.to(receiverSocketIds[0]).emit("call:offer", { ...data });
    } else {
    }
  });

  socket.on("call:answer", ({ to, ...data }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      io.to(receiverSocketIds[0]).emit("call:answer", { ...data });
    }
  });

  socket.on("call:ice-candidate", ({ to, ...data }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      io.to(receiverSocketIds[0]).emit("call:ice-candidate", { ...data });
    }
  });

  socket.on("call:decline", ({ to }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      io.to(receiverSocketIds[0]).emit("call:decline");
    }
  });

  socket.on("call:end", ({ to }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      io.to(receiverSocketIds[0]).emit("call:end");
    }
  });
});

export { io, app, server };