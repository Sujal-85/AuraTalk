import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import { startScheduler } from "./lib/scheduler.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import callRoutes from "./routes/call.route.js";
import autoMessageRoutes from "./routes/autoMessage.route.js";
import invitationRoutes from "./routes/invitation.route.js";
import groupRoutes from "./routes/group.route.js";
import {app, server} from "./lib/socket.js";
import passport from "passport";
import aiRoute from './routes/ai.route.js';
dotenv.config();

const port = process.env.PORT || 5001;

// ✅ Increase payload size limit to 50MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cookieParser());

app.use(
    cors({
        origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174,https://aura-talk.vercel.app")
            .split(",")
            .map((o) => o.trim()),
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true,
    })
);

app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/auto-messages", autoMessageRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/groups", groupRoutes);
app.use('/api', aiRoute);

server.listen(port, '0.0.0.0', () => {
    connectDB();
    startScheduler();
    console.log(`Server listening on port ${port}`);
});
