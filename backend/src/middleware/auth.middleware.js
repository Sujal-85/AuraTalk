import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { auth as firebaseAuth } from "../lib/firebaseAdmin.js";

export const protectRoute = async (req, res, next) => {
try {
    if (process.env.NODE_ENV !== "production") {
        console.log("Auth middleware called");
    }
    
    let user = null;
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.jwt;

    // 1. Try Firebase Token from Authorization Header
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
            const decodedToken = await firebaseAuth.verifyIdToken(idToken);
            user = await User.findOne({ email: decodedToken.email }).select("-password");
            if (user && process.env.NODE_ENV !== "production") {
                console.log("Authenticated via Firebase token:", user.email);
            }
        } catch (firebaseError) {
            if (process.env.NODE_ENV !== "production") {
                console.log("Firebase token verification failed:", firebaseError.message);
            }
        }
    }

    // 2. Try Local JWT from Cookie (if not already authenticated via Firebase)
    if (!user && cookieToken) {
        try {
            const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET);
            user = await User.findById(decoded.userId).select("-password");
            if (user && process.env.NODE_ENV !== "production") {
                console.log("Authenticated via local JWT cookie:", user.email);
            }
        } catch (jwtError) {
            if (process.env.NODE_ENV !== "production") {
                console.log("Local JWT verification failed:", jwtError.message);
            }
        }
    }

    if (!user) {
        if (process.env.NODE_ENV !== "production") {
            console.log("No valid authentication found");
        }
        return res.status(401).json({message: "Unauthorized - No valid token provided"});
    }

    req.user = user;
    next();

} catch (error) {
    console.log("Auth middleware error:", error.message);
    return res.status(401).json({message: "Unauthorized - Token Error"});
}
}