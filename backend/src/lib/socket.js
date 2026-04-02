import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// Build allowed origins from environment variable + fallback to localhost
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Socket.IO: Blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS`));
      }
    },
    credentials: true,
  },
  // Allow both polling and websocket transports
  transports: ["polling", "websocket"],
  // Ping settings to detect dead connections faster
  pingTimeout: 60000,
  pingInterval: 25000,
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
      receiverSocketIds.forEach(id => {
        io.to(id).emit("call:offer", { ...data });
      });
      console.log(`Call offer broadcast to ${receiverSocketIds.length} sockets for user ${to}`);
    }
  });

  socket.on("call:answer", ({ to, ...data }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(id => {
        io.to(id).emit("call:answer", { ...data });
      });
      console.log(`Call answer broadcast to ${receiverSocketIds.length} sockets for user ${to}`);
    }
  });

  socket.on("call:ice-candidate", ({ to, ...data }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(id => {
        io.to(id).emit("call:ice-candidate", { ...data });
      });
    }
  });

  socket.on("call:decline", ({ to }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(id => {
        io.to(id).emit("call:decline");
      });
    }
  });

  socket.on("call:end", ({ to }) => {
    const receiverSocketIds = userSocketMap[to];
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(id => {
        io.to(id).emit("call:end");
      });
    }
  });
});

export { io, app, server };