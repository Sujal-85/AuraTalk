import {create} from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import {io} from "socket.io-client";
import { useChatStore } from "./useChatStore";
import { auth, googleProvider } from "../lib/firebase";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
} from "firebase/auth";

const Base_url = import.meta.env.VITE_BACKEND_ORIGIN || (import.meta.env.MODE === "development" ? "http://localhost:5001" : "/");
export const useAuthStore = create((set,get) => ({

    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    isSendingVerification: false,
    isSendingMobileVerification: false,
    isVerifyingMobile: false,
    isRequestingPasswordReset: false,
    isResettingPassword: false,
    onlineUsers: [],
    socket: null,

    // Verify email reminder modal state
    verifyEmailModalOpen: false,
    verifyEmailAddress: '',
    setVerifyEmailModal: (open, email = '') => set({ verifyEmailModalOpen: open, verifyEmailAddress: email || get().verifyEmailAddress }),

    checkAuth: async() => {
        try {
            console.log("Checking auth status");
            
            // First check Firebase auth state
            const firebaseUser = await new Promise((resolve) => {
                const unsubscribe = onAuthStateChanged(auth, (user) => {
                    unsubscribe();
                    resolve(user);
                });
            });

            if (!firebaseUser) {
                set({ authUser: null, isCheckingAuth: false });
                return null;
            }

            // Get ID token from Firebase to authenticate with backend
            const idToken = await firebaseUser.getIdToken();
            
            const res = await axiosInstance.get("/auth/check", {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });
            console.log("Auth check response:", res.data);
            set({authUser: res.data});
            // Close verify modal if user is now verified or is a Google user
            if (res.data?.isEmailVerified || res.data?.googleId) {
                set({ verifyEmailModalOpen: false });
            }
            get().connectSocket();
            await ensurePublicKeyOnBackend(res.data);
            return res.data;
        } catch (error) {
            console.log("Error in checkAuth: ", error.message);
            // Don't set authUser to null here to prevent auto-logout loops on network errors
            return null;
        } finally{
            set({isCheckingAuth: false})
        }
    },
    login: async (data) => {
        try {
            console.log("Attempting login with data:", data);
            set({isLoggingIn: true})

            // 1. Firebase Login
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const idToken = await userCredential.user.getIdToken();

            // 2. Backend Login/Sync
            const res = await axiosInstance.post("/auth/login", { ...data, firebaseToken: idToken });
            console.log("Login response:", res.data);
            set({authUser: res.data});
            toast.success("Logged in successfully!");
            // Close verification modal if user is verified or is a Google user
            if (res.data?.isEmailVerified || res.data?.googleId) {
                set({ verifyEmailModalOpen: false });
            }
            get().connectSocket();
            await ensurePublicKeyOnBackend(res.data);
        } catch (error) {
            console.log("Login error:", error);
            const errorMessage = error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' 
                ? "Invalid email or password" 
                : (error.response?.data?.message || error.message || "Login failed");
            
            toast.error(errorMessage);
        }
        finally{
            set({isLoggingIn: false})
        }
    },

    signup: async (data) => {
        set({isSigningUp: true})
        try {
           console.log("Attempting signup with data:", data);

           // 1. Firebase Signup
           const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
           const idToken = await userCredential.user.getIdToken();

           // 2. Send Email Verification
           await sendEmailVerification(userCredential.user);

           // 3. Backend Signup/Sync
           const res = await axiosInstance.post("/auth/signup", { ...data, firebaseToken: idToken });
           console.log("Signup response:", res.data);
           set({authUser: res.data});
           toast.success("Account created! Please check your email for verification.");
           
           if (res.data?.isEmailVerified) {
               set({ verifyEmailModalOpen: false });
           } else {
               try { get().setVerifyEmailModal(true, res.data?.email || data?.email || ''); } catch (e) {
                    console.log("Error setting verify email modal:", e);
               }
           }
           get().connectSocket();
           await ensurePublicKeyOnBackend(res.data);
           return res.data;
        } catch (error) {
            console.log("Signup error:", error);
            const errorMessage = error.code === 'auth/email-already-in-use' 
                ? "Email already in use" 
                : (error.response?.data?.message || error.message || "Signup failed");
            toast.error(errorMessage);
            return null;
        }
        finally{
            set({isSigningUp: false})
        }
    },

    loginWithGoogle: async () => {
        set({ isLoggingIn: true });
        try {
            console.log("Starting Firebase Google login popup...");
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Firebase login success, getting ID token...");
            const idToken = await result.user.getIdToken();
            
            console.log("Sending Firebase token to backend...");
            const res = await axiosInstance.post("/auth/google", { firebaseToken: idToken });
            console.log("Backend login success:", res.data);
            set({ authUser: res.data });
            toast.success("Logged in with Google!");
            get().connectSocket();
            await ensurePublicKeyOnBackend(res.data);
        } catch (error) {
            console.error("Google login full error:", error);
            if (error.code) console.error("Firebase Error Code:", error.code);
            if (error.response) console.error("Backend Error Response:", error.response.data);
            toast.error(`Google login failed: ${error.code || error.message}`);
        } finally {
            set({ isLoggingIn: false });
        }
    },

    // Email verification
    resendVerificationEmail: async (email) => {
        set({ isSendingVerification: true });
        try {
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
                toast.success("Verification email sent!");
            }
            const res = await axiosInstance.post("/auth/resend-verification", { email });
            set({ verifyEmailAddress: email, verifyEmailModalOpen: true });
            return { ok: true };
        } catch (error) {
            const msg = error.response?.data?.message || error.message || "Failed to resend verification email";
            toast.error(msg);
            return { ok: false, message: msg };
        } finally {
            set({ isSendingVerification: false });
        }
    },

    // Password reset
    requestPasswordReset: async (email) => {
        set({ isRequestingPasswordReset: true });
        try {
            await sendPasswordResetEmail(auth, email);
            const res = await axiosInstance.post("/auth/request-password-reset", { email });
            toast.success("Password reset email sent!");
            return true;
        } catch (error) {
            toast.error(error.message || "Failed to send password reset email");
            return false;
        } finally {
            set({ isRequestingPasswordReset: false });
        }
    },

    resetPassword: async (token, newPassword) => {
        set({ isResettingPassword: true });
        try {
            const res = await axiosInstance.post("/auth/reset-password", { token, newPassword });
            toast.success(res.data.message);
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to reset password");
            return false;
        } finally {
            set({ isResettingPassword: false });
        }
    },

    // Mobile verification
    sendMobileVerification: async (mobileNumber) => {
        set({ isSendingMobileVerification: true });
        try {
            const res = await axiosInstance.post("/auth/send-mobile-verification", { mobileNumber });
            toast.success(res.data.message);
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send verification code");
            return false;
        } finally {
            set({ isSendingMobileVerification: false });
        }
    },

    verifyMobile: async (verificationCode) => {
        set({ isVerifyingMobile: true });
        try {
            const res = await axiosInstance.post("/auth/verify-mobile", { verificationCode });
            toast.success(res.data.message);
            
            // Update local user state
            const { authUser } = get();
            if (authUser) {
                set({
                    authUser: {
                        ...authUser,
                        mobileNumber: res.data.user.mobileNumber,
                        isMobileVerified: res.data.user.isMobileVerified
                    }
                });
            }
            
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to verify mobile number");
            return false;
        } finally {
            set({ isVerifyingMobile: false });
        }
    },

    // Update notification preferences
    updateNotificationPreferences: async (preferences) => {
        try {
            const res = await axiosInstance.put("/auth/notification-preferences", preferences);
            toast.success(res.data.message);
            
            // Update local user state
            const { authUser } = get();
            if (authUser) {
                set({
                    authUser: {
                        ...authUser,
                        emailNotifications: res.data.preferences.emailNotifications,
                        smsNotifications: res.data.preferences.smsNotifications
                    }
                });
            }
            
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update notification preferences");
            return false;
        }
    },

    logout: async () => {
            try {
                await signOut(auth);
                await axiosInstance.post("/auth/logout");
                set({authUser: null});
                toast.success("Logged out successfully!");
                get().disconnectSocket();
            } catch (error) {
                toast.error(error.response?.data?.message || "Logout failed");
                
            }
        },
        
    updateProfile: async (data) => {
            
            try {
              set({ isUpdatingProfile: true });
              const res = await axiosInstance.put("/auth/update-profile", data);
              set({ authUser: res.data });
              toast.success("Profile updated successfully");
            } catch (error) {
              console.log("error in update profile:", error);
            //   toast.error(error.response.data.message);
            } finally {
              set({ isUpdatingProfile: false });
            }
          },

    connectSocket: () => {
        const {authUser} = get();
        if (!authUser || !authUser._id || get().socket?.connected) return;
        
        const socket = io(Base_url,{
            query:{
                userId: authUser._id,
            }
        });
        
        socket.on("connect", () => {
            console.log("Socket connected successfully");
            set({socket: socket});
            // Initialize invitation socket listeners after connection
            try {
                useChatStore.getState().initializeInvitationSocket();
            } catch (e) {
                console.error("Failed to initialize invitation socket:", e);
            }
        });
        
        socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
        });
        
        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });
        
        socket.connect();
        
        socket.on("getOnlineUsers", (userIds) => {
            set({onlineUsers: userIds});
        });
    },
    disconnectSocket: () => {
        if(get().socket?.connected) get().socket?.disconnect();
    }


}));

// ECC key generation and storage helpers
async function generateKeyPairIfNeeded(userId) {
  const existing = localStorage.getItem(`ecc-keypair-${userId}`);
  if (existing) return JSON.parse(existing);
  // Generate ECC key pair
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  // Export public key
  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  // Store private key in localStorage (as JWK)
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  localStorage.setItem(`ecc-keypair-${userId}`,
    JSON.stringify({ publicKey: publicKeyJwk, privateKey: privateKeyJwk })
  );
  return { publicKey: publicKeyJwk, privateKey: privateKeyJwk };
}

// Helper to upload publicKey to backend if not present or if changed
async function ensurePublicKeyOnBackend(authUser) {
  if (!authUser || !authUser._id) return;
  const keypair = await generateKeyPairIfNeeded(authUser._id);
  // Always upload if backend publicKey is missing or different
  if (!authUser.publicKey || JSON.stringify(authUser.publicKey) !== JSON.stringify(keypair.publicKey)) {
    await axiosInstance.put("/auth/update-public-key", { publicKey: keypair.publicKey });
  }
}

