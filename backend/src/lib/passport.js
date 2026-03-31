import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import { uploadToFirebase } from "./firebaseStorage.js";
import axios from "axios";

// Initialize Google OAuth strategy only if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Normalize data from Google
          const email = (profile.emails?.[0]?.value || "").toLowerCase().trim();
          let user = await User.findOne({ googleId: profile.id });
          const googlePhoto = profile.photos?.[0]?.value;
          let uploadedProfilePic = null;

          if (!user) {
            // Try to link with an existing account by email to avoid duplicate key error
            let existingByEmail = email ? await User.findOne({ email }) : null;
            if (existingByEmail) {
              existingByEmail.googleId = profile.id;
              existingByEmail.isEmailVerified = true; // Google emails are verified
              // Set Google photo directly to avoid delaying login; optional upload can be done later
              if (googlePhoto && existingByEmail.profilePic !== googlePhoto) {
                existingByEmail.profilePic = googlePhoto;
              }
              user = await existingByEmail.save();
            } else {
              // Create a new user if no conflicts
              user = await User.create({
                googleId: profile.id,
                fullName: profile.displayName,
                email,
                profilePic: googlePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}`,
                isEmailVerified: true,
              });
            }
          } else if (googlePhoto && user.profilePic !== googlePhoto) {
            // Update to latest Google photo (non-blocking upload handled best-effort below)
            user.profilePic = googlePhoto;
            await user.save();
          }

          // Best-effort: upload to Firebase Storage after we've ensured login proceeds
          // Do not block OAuth completion on image upload
          if (googlePhoto) {
            (async () => {
              try {
                const response = await axios.get(googlePhoto, { responseType: 'arraybuffer', timeout: 4000 });
                const base64Image = `data:image/jpeg;base64,${Buffer.from(response.data, 'binary').toString('base64')}`;
                const uploadedProfilePic = await uploadToFirebase(base64Image, "profiles");
                if (uploadedProfilePic && user && user.profilePic !== uploadedProfilePic) {
                  user.profilePic = uploadedProfilePic;
                  await user.save();
                }
              } catch (_) {
                // ignore avatar upload errors/timeouts
              }
            })();
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  console.log('Google OAuth strategy initialized successfully');
} else {
  console.log('Google OAuth not configured - Google sign-in features will be disabled');
}