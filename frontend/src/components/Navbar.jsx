import { LogOut, MessageSquare, Palette, User, Search, MoreVertical, Camera, Bell, Phone, Settings, Check, X } from "lucide-react"
import { useThemeStore } from "../store/useThemeStore";
import toast from "react-hot-toast";
import {useAuthStore} from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";


const Navbar = () => {
    
  const {logout, authUser} = useAuthStore()
  const { theme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const showBackArrow = location.pathname === "/settings" || location.pathname === "/profile";
  const { selectedUser, invitations, loadInvitations, acceptInvitationAndOpenChat, declineInvitation, initializeInvitationSocket, users, setSelectedUser } = useChatStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const menuRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState(null);
  const notificationPanelRef = useRef(null);
  useEffect(() => {
    if (authUser) {
      loadInvitations();
      initializeInvitationSocket();
    }
  }, [authUser]);

  const handleAccept = async (inv) => {
    try {
      setProcessingInviteId(inv._id);
      await acceptInvitationAndOpenChat(inv._id);
      await loadInvitations();
      setShowNotifications(false);
      toast.success('Invitation accepted');
      return true;
    } catch (err) {
      console.error('Accept invite failed', err);
      toast.error('Failed to accept invitation');
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineClick = async (inv) => {
    try {
      setProcessingInviteId(inv._id);
      await declineInvitation(inv._id);
      await loadInvitations();
      toast('Invitation declined');
    } catch (err) {
      console.error('Decline failed', err);
      toast.error('Failed to decline');
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  // Camera logic
  useEffect(() => {
    let stream;
    if (showCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          stream = s;
          videoRef.current.srcObject = stream;
        });
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  // Add effect to close notifications on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handleClick = (e) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      // Download the image
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'captured-image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Stop the camera
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleCloseCamera = () => {
    // Only stop camera stream if we're not in a video call
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => {
        // Only stop the track if it's specifically from the profile camera modal
        // This prevents interference with video calls
        if (showCamera) {
          track.stop();
        }
      });
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
  };

  return (
    <>
    <header
      className="bg-base-100 fixed w-full h-16 top-0 z-50 backdrop-blur-lg bg-base-100/80">
      <div className="container mx-auto px-4 h-16 flex flex-col justify-center">
        <div className="flex items-center justify-between h-16">
          <div className="flex flex-col gap-2 focus:outline-none">
            <div className="flex items-center gap-2.5">
              {showBackArrow && (
                <button
                  className="p-2 rounded-full hover:bg-base-200 mr-1"
                  onClick={() => navigate(-1)}
                  aria-label="Back"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-lg font-bold select-none focus:border-none focus:outline-none">AuraTalk ✨</h1>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                className="p-2 rounded-full hover:bg-base-200"
                onClick={() => navigate('/themes')}
                aria-label="themes"
              >
                <Palette className="w-6 h-6 " />
              </button>
              <div className="relative">
                 <button
                  className="relative p-2 rounded-full hover:bg-base-200"
                  aria-label={`Notifications (${invitations.length})`}
                  onClick={() => setShowNotifications((v) => !v)}
                >
                  <Bell className="w-6 h-6" />
                  {invitations.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                      {invitations.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div
                    ref={notificationPanelRef}
                    className="absolute right-0 mt-2 bg-base-100 text-base-content border border-base-300 rounded-2xl shadow-2xl p-4 z-[10000] pointer-events-auto w-[min(92vw,32rem)]"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button className="absolute top-3 right-4 text-2xl font-bold text-zinc-500 hover:text-zinc-800" onClick={() => setShowNotifications(false)}>&times;</button>
                    <div className="font-bold text-xl mb-4 text-center">Invitations</div>
                    {invitations.length === 0 ? (
                      <div className="text-zinc-400 text-center">No invitations</div>
                    ) : (
                      <ul className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {invitations.map(inv => {
                          const fromUser = users.find(u => u._id === inv.fromUserId) || {};
                          return (
                            <li key={inv._id} className="bg-base-200/60 hover:bg-base-200 rounded-lg px-4 py-3 shadow-sm w-full flex items-center justify-between gap-3 border border-base-300">
                              <div className="flex items-center gap-3">
                                <img src={fromUser.profilePic || '/avatar.png'} className="w-10 h-10 rounded-full border border-base-300 object-cover" />
                                <div>
                                  <div className="font-semibold text-sm">{fromUser.fullName || 'New user'}</div>
                                  <div className="text-xs text-base-content/60">wants to chat • {new Date(inv.createdAt).toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" disabled={processingInviteId===inv._id} className={`px-3 py-1 rounded text-sm shadow relative z-[10001] ${processingInviteId===inv._id ? 'bg-green-400/60 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500'}`} onClick={async (e) => { e.stopPropagation(); await handleAccept(inv); }}> <Check className="w-4 h-4 inline-block"/> Accept</button>
                                <button type="button" disabled={processingInviteId===inv._id} className={`px-2 py-1 text-sm rounded relative z-[10001] ${processingInviteId===inv._id ? 'text-base-content/40 cursor-not-allowed' : 'text-base-content hover:text-base-content'}`} onClick={(e) => { e.stopPropagation(); handleDeclineClick(inv); }}> <X className="w-4 h-4 inline-block"/> Decline</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Mobile camera and kebab menu */}
            <div className="lg:hidden flex items-center gap-1 relative">
              {/* Notifications button */}
              <div className="relative">
                <button
                  className="relative p-2 rounded-full hover:bg-base-200"
                  aria-label={`Notifications (${invitations.length})`}
                  onClick={() => setShowNotifications((v) => !v)}
                >
                  <Bell className="w-6 h-6" />
                  {invitations.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                      {invitations.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div
                    ref={notificationPanelRef}
                    className="fixed top-16 left-2 right-2 bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-4 z-[9999] w-[calc(100vw-1rem)] max-w-[24rem] sm:w-[min(92vw,24rem)] mx-auto"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button className="absolute top-3 right-4 text-2xl font-bold text-zinc-500 hover:text-zinc-800" onClick={() => setShowNotifications(false)}>&times;</button>
                    <div className="font-bold text-xl mb-4 text-center">Invitations</div>
                    {invitations.length === 0 ? (
                      <div className="text-zinc-400 text-center">No invitations</div>
                    ) : (
                      <ul className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {invitations.map(inv => {
                          const fromUser = users.find(u => u._id === inv.fromUserId) || {};
                          return (
                            <li key={inv._id} className="bg-base-200/60 hover:bg-base-200 rounded-lg px-4 py-3 text-base shadow-sm w-full flex items-center justify-between gap-2 border border-base-300">
                              <div className="flex items-center gap-2">
                                <img src={fromUser.profilePic || '/avatar.png'} className="w-8 h-8 rounded-full object-cover" />
                                <div>
                                  <div className="font-medium">{fromUser.fullName || 'New user'}</div>
                                  <div className="text-xs text-base-content/60">wants to chat • {new Date(inv.createdAt).toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" disabled={processingInviteId===inv._id} className={`btn btn-xs ${processingInviteId===inv._id ? 'btn-disabled' : 'btn-success'}`} onClick={async (e) => { e.stopPropagation(); await handleAccept(inv); }}> <Check className="w-4 h-4"/> Accept</button>
                                <button type="button" disabled={processingInviteId===inv._id} className={`btn btn-xs ${processingInviteId===inv._id ? 'opacity-50 cursor-not-allowed' : 'btn-ghost'}`} onClick={(e) => { e.stopPropagation(); handleDeclineClick(inv); }}> <X className="w-4 h-4"/> Decline</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {/* Camera button */}
              <button
                className="p-2 rounded-full hover:bg-base-200"
                onClick={() => { navigate('/settings')
                setMobileMenuOpen(false); }}
                aria-label="Open Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
              {/* Kebab menu */}
              <button
                className="p-2 rounded-full hover:bg-base-200"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label="Open menu"
              >
                <MoreVertical className="w-6 h-6" />
              </button>
              {mobileMenuOpen && (
                <div ref={menuRef} className="absolute right-0 top-12 mt-2 w-40 bg-base-100 border border-base-300 rounded shadow-lg z-50 flex flex-col">
                  <button className="px-4 py-2 text-left hover:bg-base-200 flex items-center gap-2" onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}>
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button className="px-4 py-2 text-left hover:bg-base-200 flex items-center gap-2" onClick={() => { navigate('/themes'); setMobileMenuOpen(false); }}>
                    <Palette className="w-4 h-4" /> Themes
                  </button>
                  <button className="px-4 py-2 text-left hover:bg-base-200 flex items-center gap-2" onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}>
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button className="px-4 py-2 text-left hover:bg-base-200 flex items-center gap-2" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            onClick={handleCloseCamera}
          />
          
          {/* Modal Content */}
          <div className="relative bg-base-100 rounded-3xl p-6 flex flex-col items-center w-full max-w-[400px] shadow-2xl border border-base-300 animate-in fade-in zoom-in duration-200">
            <button 
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-base-200 transition-colors z-10" 
              onClick={handleCloseCamera}
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="w-full">
              <h3 className="text-2xl font-bold text-center mb-6">Take a Photo</h3>
              
              {!capturedImage ? (
                <div className="space-y-6">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-base-300">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <button 
                    className="btn btn-primary w-full h-14 text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/20 transition-all" 
                    onClick={handleCapture}
                  >
                    Capture & Save
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-base-300">
                    <img 
                      src={capturedImage} 
                      alt="Captured" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      className="btn btn-ghost border-base-300 w-full h-12 rounded-xl" 
                      onClick={() => setCapturedImage(null)}
                    >
                      Retake
                    </button>
                    <button 
                      className="btn btn-primary w-full h-12 rounded-xl" 
                      onClick={handleCloseCamera}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </header>

    {/* Bottom Tab Bar - Mobile only; shown on main routes, hidden when a chat is open */}
    {/\/(messages|updates|calls|settings)\b/.test(location.pathname) && !selectedUser && (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-base-100/90 backdrop-blur border-t border-base-300">
        <div className="grid grid-cols-4">
          <Link to="/messages" className={`flex flex-col items-center justify-center py-2 ${location.pathname.startsWith('/messages') ? 'text-primary' : 'text-base-content/70'}`}>
            <MessageSquare className="w-5 h-5" />
            <span className="text-[11px]">Chats</span>
          </Link>
          <Link to="/updates" className={`flex flex-col items-center justify-center py-2 ${location.pathname.startsWith('/updates') ? 'text-primary' : 'text-base-content/70'}`}>
            <Camera className="w-5 h-5" />
            <span className="text-[11px]">Updates</span>
          </Link>
          {(() => {
            const callsActive = location.pathname.startsWith('/messages') && new URLSearchParams(location.search).get('tab') === 'calls';
            return (
              <Link to="/messages?tab=calls" className={`flex flex-col items-center justify-center py-2 ${callsActive ? 'text-primary' : 'text-base-content/70'}`}>
                <Phone className="w-5 h-5" />
                <span className="text-[11px]">Calls</span>
              </Link>
            );
          })()}
          <Link to="/themes" className={`flex flex-col items-center justify-center py-2 ${location.pathname.startsWith('/settings') ? 'text-primary' : 'text-base-content/70'}`}>
            <Palette className="w-5 h-5" />
            <span className="text-[11px]">Themes</span>
          </Link>
        </div>
      </nav>
    )}
    {/* Spacer to prevent content being hidden behind fixed bottom nav on mobile */}
    {/\/(messages|updates|calls|settings)\b/.test(location.pathname) && !selectedUser && (
      <div className="lg:hidden h-14" />
    )}
    </>
  )
}

export default Navbar