import mongoose from "mongoose";
import crypto from 'crypto';

const userSchema = new mongoose.Schema(

    {
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        clerkId: {
            type: String,
            unique: true,
            sparse: true,
        },
        firebaseUid: {
            type: String,
            unique: true,
            sparse: true,
        },
        fullName: {
            type:String,
            required: true,

        },
        password: {
            type: String,
            minlength: 8,
            required: function() { return !this.googleId && !this.clerkId && !this.firebaseUid; },
        },
        profilePic:{
            type: String,
            default: "",
        },
        // Email verification fields
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            default: null,
        },
        emailVerificationExpires: {
            type: Date,
            default: null,
        },
        // Mobile notification fields
        mobileNumber: {
            type: String,
            default: null,
        },
        isMobileVerified: {
            type: Boolean,
            default: false,
        },
        mobileVerificationCode: {
            type: String,
            default: null,
        },
        mobileVerificationExpires: {
            type: Date,
            default: null,
        },
        // Notification preferences
        emailNotifications: {
            type: Boolean,
            default: true,
        },
        smsNotifications: {
            type: Boolean,
            default: true,
        },
        // Password reset fields
        passwordResetToken: {
            type: String,
            default: null,
        },
        passwordResetExpires: {
            type: Date,
            default: null,
        },
        publicKey: {
            type: Object, // JWK format
            default: null,
        },
        // Chat wallpaper preferences
        wallpaperMode: {
            type: String,
            enum: ['global', 'per-chat'],
            default: 'global',
        },
        // { type: 'none'|'image'|'pattern', value: string }
        wallpaper: {
            type: Object,
            default: { type: 'none', value: '' },
        },
        // Map of userId -> { type, value }
        perUserWallpapers: {
            type: Map,
            of: Object,
            default: {},
        },
        // Saved wallpapers library for the user
        wallpaperLibrary: [
            {
                id: { type: String, required: true },
                type: { type: String, enum: ['image', 'pattern'], required: true },
                value: { type: String, required: true },
                label: { type: String, default: '' },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true
    }

);

userSchema.pre('save', async function (next) {
  if (!this.publicKey) {
    // Generate ECC keypair (P-256)
    const { publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'jwk' },
      privateKeyEncoding: { type: 'pkcs8', format: 'jwk' }
    });
    this.publicKey = publicKey;
  }
  next();
});

const User = mongoose.model("User", userSchema);
export default User;

