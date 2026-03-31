import express from "express";
import { 
    signup, 
    login, 
    logout, 
    checkAuth, 
    updateProfile, 
    updatePassword,
    updatePublicKey,
    getUserPublicKey,
    getWallpaperPrefs,
    updateWallpaperPrefs,
    addWallpaperToLibrary,
    updateWallpaperInLibrary,
    removeWallpaperFromLibrary,
    // New routes
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    sendMobileVerification,
    verifyMobile,
    updateNotificationPreferences
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import passport from "passport";
import "../lib/passport.js";
import { generateToken } from "../lib/utils.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", login);
router.post("/logout", logout);
router.get("/check", protectRoute, checkAuth);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/update-password", protectRoute, updatePassword);
router.put("/update-public-key", protectRoute, updatePublicKey);
router.get("/public-key/:userId", getUserPublicKey);

// Email verification routes
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

// Password reset routes
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Mobile verification routes
router.post("/send-mobile-verification", protectRoute, sendMobileVerification);
router.post("/verify-mobile", protectRoute, verifyMobile);

// Notification preferences
router.put("/notification-preferences", protectRoute, updateNotificationPreferences);

// Wallpaper routes
router.get("/wallpaper-prefs", protectRoute, getWallpaperPrefs);
router.put("/wallpaper-prefs", protectRoute, updateWallpaperPrefs);
router.post("/wallpaper-library", protectRoute, addWallpaperToLibrary);
router.put("/wallpaper-library/:id", protectRoute, updateWallpaperInLibrary);
router.delete("/wallpaper-library/:id", protectRoute, removeWallpaperFromLibrary);



router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login" }), (req, res) => {
  // Successful authentication, issue JWT and redirect or respond with token
  // You can customize this logic as needed
  const user = req.user;
  // generateToken is your JWT function
  generateToken(user._id, res);
  res.redirect("http://localhost:5173"); // Redirect to frontend after login
});

export default router;