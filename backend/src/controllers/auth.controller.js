import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../lib/email.js";
import { sendVerificationSMS } from "../lib/sms.js";
import crypto from "crypto";
import { auth as firebaseAuth } from "../lib/firebaseAdmin.js";

export const signup = async (req, res) => {
  const { fullName, email, password, publicKey, mobileNumber, firebaseToken } = req.body;
  try {
    let firebaseUid = null;
    if (firebaseToken) {
      const decodedToken = await firebaseAuth.verifyIdToken(firebaseToken);
      firebaseUid = decodedToken.uid;
    }

    if (!fullName || !email) {
      return res.status(400).json({ message: "Full name and email are required" });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = password ? await bcrypt.hash(password, salt) : undefined;

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      firebaseUid,
      publicKey: publicKey || null,
      mobileNumber: mobileNumber || null,
      isEmailVerified: !!firebaseToken, // If coming from firebase, consider verified or handle separately
    });

    await newUser.save();
    
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
      isEmailVerified: newUser.isEmailVerified,
      mobileNumber: newUser.mobileNumber,
      isMobileVerified: newUser.isMobileVerified,
    });

  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



export const updatePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required" });
    }

    // Enforce minimum length consistent with schema (8)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await User.findById(userId).select("+password googleId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If account is Google-only (no password set), disallow update via this route
    if (user.googleId && !user.password) {
      return res.status(400).json({ message: "Password update not available for Google sign-in accounts" });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password || "");
    if (!isCurrentValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;
    await user.save();

    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.log("Error in updatePassword:", error);
    return res.status(500).json({ message: "Failed to update password" });
  }
};

export const login = async (req, res) => {
  const { email, password, publicKey, firebaseToken } = req.body;
  try {
    let user;
    
    if (firebaseToken) {
      console.log("Verifying Firebase token in login controller...");
      const decodedToken = await firebaseAuth.verifyIdToken(firebaseToken);
      const firebaseEmail = decodedToken.email;
      console.log("Firebase token verified for email:", firebaseEmail);

      user = await User.findOne({ email: firebaseEmail });
      
      if (!user) {
        console.log("User not found in DB, creating new user from Firebase data...");
        // Auto-signup for Firebase users (Google etc)
        user = new User({
          fullName: decodedToken.name || firebaseEmail.split('@')[0],
          email: firebaseEmail,
          firebaseUid: decodedToken.uid,
          isEmailVerified: decodedToken.email_verified || true,
          profilePic: decodedToken.picture || ""
        });
        await user.save();
        console.log("New user created from Firebase:", user.email);
      } else {
        console.log("User found in DB:", user.email);
        if (!user.firebaseUid) {
          console.log("Updating existing user with firebaseUid...");
          user.firebaseUid = decodedToken.uid;
          await user.save();
        }
      }
    } else {
      console.log("Standard email/password login attempt for:", email);
      user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        console.log("Invalid credentials for:", email);
        return res.status(400).json({ message: "Invalid credentials" });
      }
    }

    console.log("Generating local JWT for user:", user.email);
    generateToken(user._id, res);

    if (publicKey && !user.publicKey) {
      user.publicKey = publicKey;
      await user.save();
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      isEmailVerified: user.isEmailVerified,
      mobileNumber: user.mobileNumber,
      isMobileVerified: user.isMobileVerified,
    });
  } catch (error) {
    console.error("Error in login controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

import { uploadToFirebase } from "../lib/firebaseStorage.js";

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const publicUrl = await uploadToFirebase(profilePic, "profiles");
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: publicUrl },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
      const user = await User.findOne({ email: decodedToken.email });
      if (user) {
        return res.status(200).json(user);
      }
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// Add endpoint to update publicKey after login
export const updatePublicKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ message: "publicKey required" });
    const user = await User.findByIdAndUpdate(userId, { publicKey }, { new: true });
    res.status(200).json({ success: true, publicKey: user.publicKey });
  } catch (error) {
    res.status(500).json({ message: "Failed to update publicKey" });
  }
};

export const getUserPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('publicKey');
    if (!user || !user.publicKey) {
      return res.status(404).json({ message: 'Public key not found' });
    }
    res.status(200).json({ publicKey: user.publicKey });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch public key' });
  }
};

// Wallpaper preferences
export const getWallpaperPrefs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'wallpaperMode wallpaper perUserWallpapers wallpaperLibrary'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({
      wallpaperMode: user.wallpaperMode,
      wallpaper: user.wallpaper,
      perUserWallpapers: Object.fromEntries(user.perUserWallpapers || []),
      wallpaperLibrary: user.wallpaperLibrary || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch wallpaper preferences' });
  }
};

export const updateWallpaperPrefs = async (req, res) => {
  try {
    const { wallpaperMode, wallpaper, perUserWallpapers } = req.body;
    const update = {};
    if (wallpaperMode) update.wallpaperMode = wallpaperMode;
    if (wallpaper) update.wallpaper = wallpaper;
    if (perUserWallpapers) update.perUserWallpapers = perUserWallpapers;
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.status(200).json({
      wallpaperMode: user.wallpaperMode,
      wallpaper: user.wallpaper,
      perUserWallpapers: Object.fromEntries(user.perUserWallpapers || []),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update wallpaper preferences' });
  }
};

export const addWallpaperToLibrary = async (req, res) => {
  try {
    const { item } = req.body; // { id, type, value, label, createdAt }
    if (!item || !item.type || !item.value) {
      return res.status(400).json({ message: 'Invalid wallpaper item' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const id = item.id || `wp-${Date.now()}`;
    const entry = {
      id,
      type: item.type,
      value: item.value,
      label: item.label || '',
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    };
    user.wallpaperLibrary = [entry, ...(user.wallpaperLibrary || [])].slice(0, 100);
    await user.save();
    res.status(200).json({ wallpaperLibrary: user.wallpaperLibrary, added: entry });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add wallpaper' });
  }
};

export const updateWallpaperInLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, label } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.wallpaperLibrary = (user.wallpaperLibrary || []).map((w) =>
      w.id === id ? { ...w.toObject?.() ?? w, value: value ?? w.value, label: label ?? w.label } : w
    );
    await user.save();
    res.status(200).json({ wallpaperLibrary: user.wallpaperLibrary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update wallpaper' });
  }
};

export const removeWallpaperFromLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.wallpaperLibrary = (user.wallpaperLibrary || []).filter((w) => w.id !== id);
    await user.save();
    res.status(200).json({ wallpaperLibrary: user.wallpaperLibrary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove wallpaper' });
  }
};

// Email verification endpoint
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Send welcome email (optional)
    try {
      await sendWelcomeEmail(user.email, user.fullName);
    } catch (error) {
      console.log("Email service not configured or failed:", error.message);
    }

    res.status(200).json({ 
      message: "Email verified successfully! Welcome to Chat App!",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        googleId: user.googleId
      }
    });
  } catch (error) {
    console.log("Error in verifyEmail controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Resend verification email
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();

    // Send new verification email (optional)
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(email, emailVerificationToken, user.fullName);
    } catch (error) {
      console.log("Email service not configured or failed:", error.message);
      emailSent = false;
    }

    if (emailSent) {
      res.status(200).json({ message: "Verification email sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send verification email" });
    }
  } catch (error) {
    console.log("Error in resendVerificationEmail controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Request password reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpires;
    await user.save();

    // Send password reset email (optional)
    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail(email, resetToken, user.fullName);
    } catch (error) {
      console.log("Email service not configured or failed:", error.message);
      emailSent = false;
    }

    if (emailSent) {
      res.status(200).json({ message: "Password reset email sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  } catch (error) {
    console.log("Error in requestPasswordReset controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Reset password with token
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.log("Error in resetPassword controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Send mobile verification code
export const sendMobileVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    // Validate mobile number format (basic validation)
    const mobileRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({ message: "Invalid mobile number format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.mobileNumber = mobileNumber;
    user.mobileVerificationCode = verificationCode;
    user.mobileVerificationExpires = verificationExpires;
    await user.save();

    // Send SMS verification code (optional)
    let smsSent = false;
    try {
      smsSent = await sendVerificationSMS(mobileNumber, verificationCode, user.fullName);
    } catch (error) {
      console.log("SMS service not configured or failed:", error.message);
      smsSent = false;
    }

    if (smsSent) {
      res.status(200).json({ message: "Verification code sent to your mobile number" });
    } else {
      res.status(500).json({ message: "Failed to send verification code" });
    }
  } catch (error) {
    console.log("Error in sendMobileVerification controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Verify mobile number
export const verifyMobile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.mobileVerificationCode || !user.mobileVerificationExpires) {
      return res.status(400).json({ message: "No verification code found" });
    }

    if (user.mobileVerificationExpires < Date.now()) {
      return res.status(400).json({ message: "Verification code has expired" });
    }

    if (user.mobileVerificationCode !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.isMobileVerified = true;
    user.mobileVerificationCode = null;
    user.mobileVerificationExpires = null;
    await user.save();

    res.status(200).json({ 
      message: "Mobile number verified successfully",
      user: {
        _id: user._id,
        mobileNumber: user.mobileNumber,
        isMobileVerified: user.isMobileVerified
      }
    });
  } catch (error) {
    console.log("Error in verifyMobile controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { emailNotifications, smsNotifications } = req.body;

    const updateData = {};
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

    res.status(200).json({
      message: "Notification preferences updated successfully",
      preferences: {
        emailNotifications: user.emailNotifications,
        smsNotifications: user.smsNotifications
      }
    });
  } catch (error) {
    console.log("Error in updateNotificationPreferences controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};