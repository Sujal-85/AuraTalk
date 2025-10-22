import Navbar from "./components/Navbar";
// Email verification modal disabled per product decision
// import VerifyEmailModal from "./components/VerifyEmailModal";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import NewSidebar from './components/NewSidebar';

import HomePage from "./pages/HomePage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import ThemePage from "./pages/ThemePage";
import UpdatesPage from "./pages/UpdatesPage";
import GroupsPage from "./pages/GroupsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import {useThemeStore} from "./store/useThemeStore" ;
import {Toaster} from "react-hot-toast";
import {useAuthStore} from "./store/useAuthStore" 
import { useEffect, useState } from "react";
import {Loader} from "lucide-react";
import CallModal from "./components/CallModal";
import { useChatStore } from "./store/useChatStore";
import AudioUnlocker from "./components/AudioUnlocker";

const MainLayout = () => {
  const { theme } = useThemeStore();
  const { authUser } = useAuthStore();
  const { callState, localStream, remoteStream, handleAccept, handleDecline, handleEnd, handleCall, handleToggleMute, handleToggleVideo, pendingCaller, callStartTime, selectedUser } = useChatStore();
  return (
    <div data-theme={theme}>
      <AudioUnlocker />
      {authUser && <NewSidebar />}
      <div className="min-h-screen bg-base-100 lg:pl-16">
        <Outlet />
      </div>
      <CallModal
        isOpen={callState.isModalOpen}
        isIncoming={callState.isIncoming}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onEnd={handleEnd}
        localStream={localStream}
        remoteStream={remoteStream}
        status={callState.status}
        error={callState.error}
        onRetry={() => handleCall(callState.isVideoCall)}
        isVideoCall={callState.isVideoCall}
        isMuted={callState.isMuted}
        isVideoHidden={callState.isVideoHidden}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        callerName={callState.isIncoming ? pendingCaller?.name : selectedUser?.fullName}
        callerAvatar={
          callState.isIncoming
            ? pendingCaller?.avatar || pendingCaller?.profilePic || "/avatar.png"
            : selectedUser?.profilePic || "/avatar.png"
        }
        callStartTime={callStartTime}
      />
      <Toaster
        toastOptions={{
          duration: 4000,
          style: {
            zIndex: 99999,
            background: 'var(--toast-bg, #222)',
            color: 'var(--toast-color, #fff)',
            fontSize: '1rem',
            boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          },
          success: {
            style: {
              background: 'var(--toast-success-bg, #22c55e)',
              color: 'var(--toast-success-color, #fff)',
            },
          },
          error: {
            style: {
              background: 'var(--toast-error-bg, #ef4444)',
              color: 'var(--toast-error-color, #fff)',
            },
          },
        }}
      />
    </div>
  );
};

const App = () => {
  const { authUser, isCheckingAuth, checkAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const { loadWallpaperPrefs } = useChatStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => {
    if (authUser) {
      loadWallpaperPrefs();
      // Initialize invitation socket when user is authenticated
      try {
        useChatStore.getState().initializeInvitationSocket();
      } catch (e) {
        console.error("Failed to initialize invitation socket:", e);
      }
      
      // Periodically check auth status to sync verification status
      const interval = setInterval(() => {
        if (authUser && !authUser.isEmailVerified && !authUser.googleId && window.location.pathname !== '/verify-email') {
          checkAuth();
        }
      }, 10000); // Check every 10 seconds if user is not verified and not on verification page
      
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);
  // Email verification UI disabled
  if (isCheckingAuth && !authUser) return (
    <div className="flex items-center justify-center h-screen">
      <Loader className="size-10 animate-spin" />
    </div>
  );
  return (
    <>
      <div data-theme={theme}>
        <Navbar />
      </div>
      <Toaster />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/messages" />} />
          <Route path="/messages" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
          <Route path="/calls" element={authUser ? <HomePage showCalls={true} /> : <Navigate to="/login" />} />
          <Route path="/groups" element={authUser ? <GroupsPage /> : <Navigate to="/login" />} />
          <Route path="/archive" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
          <Route path="/updates" element={authUser ? <UpdatesPage /> : <Navigate to="/login" />} />
          <Route path="/themes" element={<ThemePage/>} />
          <Route path="/settings" element={authUser ? <SettingsPage /> : <Navigate to="/login" />} />
          <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        </Route>
        <Route path="/signup" element={!authUser ? <SignupPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        {/* Email verification route disabled */}
        {/* <Route path="/verify-email" element={<EmailVerificationPage />} /> */}
        <Route path="/reset-password" element={<PasswordResetPage />} />
      </Routes>
    </>
  );
};
export default App;


