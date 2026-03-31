import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import statusRoutes from './routes/status.route.js';
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import { validateEnv } from "./lib/envValidator.js";

dotenv.config();
validateEnv();

const port = process.env.PORT || 5001;

// ✅ Security Headers - DISABLED for troubleshooting COOP/Network Error
// app.use(helmet({
//   contentSecurityPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   crossOriginOpenerPolicy: false,
//   crossOriginEmbedderPolicy: false,
// }));

// ✅ Rate Limiting - Temporarily disabled for troubleshooting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: "Too many requests from this IP, please try again after 15 minutes",
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// });

// Apply limiter to all auth routes
// app.use("/api/auth", limiter);

// ✅ Increase payload size limit to 50MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure cookie parser with debugging
app.use(cookieParser());

// Add middleware to log incoming cookies
app.use((req, res, next) => {
    console.log("Incoming cookies:", req.cookies);
    next();
});

app.use(
    cors({
        origin: true, // Allow any origin during debugging
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        credentials: true,
        optionsSuccessStatus: 200
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
app.use('/api/status', statusRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

server.listen(port, '0.0.0.0', () => {
    connectDB();
    startScheduler();
    console.log(`Server listening on port ${port}`);
});
