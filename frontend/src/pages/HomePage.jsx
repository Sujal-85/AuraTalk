import { Sidebar } from "../components/Siderbar";
import { ArchiveSidebar } from "../components/ArchiveSidebar";
import NoChatSelected from "../components/NoChatSelected";
import { ChatContainer } from "../components/ChatContainer";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useState, useEffect, useRef } from "react";
import ChatHeader from "../components/ChatHeader";
import GroupChatHeader from "../components/GroupChatHeader";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { PhoneIncoming, PhoneOutgoing, MessageCircle, Video, Phone, X } from "lucide-react";
import { useThemeStore } from '../store/useThemeStore';
import { axiosInstance } from "../lib/axios";
import { toast } from "react-hot-toast";

const HomePage = () => {
  const { selectedUser, selectedGroup, handleCall, setSelectedUser, setSelectedGroup, favorites, removeFavorite, users, archivedUsers, isArchived } = useChatStore();
  const { authUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [selectedCall, setSelectedCall] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const showCalls = location.pathname === "/calls";
  const { theme } = useThemeStore();
  const callListRef = useRef(null);
  const [callContextMenu, setCallContextMenu] = useState({ visible: false, x: 0, y: 0, call: null });
  const [callSearch, setCallSearch] = useState("");
  const [callHistory, setCallHistory] = useState([]);
  const callContextMenuRef = useRef(null);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [activeTabView, setActiveTabView] = useState(null);

  // List of dark themes (add more if needed)
  const DARK_THEMES = [
    'dark', 'black', 'dracula', 'night', 'dim', 'nord', 'forest', 'luxury', 'cyberpunk', 'synthwave', 'halloween', 'business', 'coffee', 'sunset'
  ];
  const isDark = DARK_THEMES.includes(theme);

  const onPrevMatch = () => {
    setCurrentMatch((prev) => (prev - 1 + totalMatches) % totalMatches);
  };
  const onNextMatch = () => {
    setCurrentMatch((prev) => (prev + 1) % totalMatches);
  };

  useEffect(() => {
    setCurrentMatch(0);
  }, [searchQuery, totalMatches]);

  useEffect(() => {
    if (!callContextMenu.visible) return;
    const handleClick = (e) => {
      if (
        callContextMenuRef.current &&
        !callContextMenuRef.current.contains(e.target)
      ) {
        setCallContextMenu((m) => ({ ...m, visible: false }));
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callContextMenu.visible]);

  // Call Info Panel for main area
  const renderCallInfo = () => {
    const call = selectedCall;
    const user = (call.caller && call.caller._id === authUser?._id) ? call.receiver : (call.caller || {});
    const isMissed = call.status === "missed";
    const isIncoming = call.direction === "incoming";
    const callType = call.type === "video" ? "video call" : "voice call";
    const icon = isIncoming
      ? <PhoneIncoming className={`w-5 h-5 inline ${isMissed ? "text-red-500" : "text-zinc-400"}`} />
      : <PhoneOutgoing className={`w-5 h-5 inline ${isMissed ? "text-red-500" : "text-zinc-400"}`} />;
    // Format day
    const date = new Date(call.startedAt);
    const day = date.toLocaleDateString(undefined, { weekday: 'long' });
    // Format time
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Format duration
    let durationStr = "";
    if (call.duration && call.duration > 0) {
      const min = Math.floor(call.duration / 60);
      const sec = call.duration % 60;
      if (min > 0) {
        durationStr = `${min} minute${min > 1 ? 's' : ''}${sec > 0 ? ' ' : ''}`;
      }
      if (sec > 0) {
        durationStr += `${sec} second${sec !== 1 ? 's' : ''}`;
      }
    }
    return (
      <div data-theme={theme} className="flex flex-col h-full w-full">
        <div className="w-full flex flex-col h-full">
          <div className="flex-1 flex flex-col h-full">
            <div className="w-full h-full flex flex-col">
              <div className="w-full flex justify-end">
                <button className="p-4 text-zinc-400 hover:text-zinc-500" onClick={() => setSelectedCall(null)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className={`w-full max-w-4xl rounded-lg mx-auto mt-0 ${isDark ? '' : ''} bg-base-100`} style={{ background: isDark ? '#1A1A1A' : undefined }}>
                <div className="flex flex-col sm:flex-row items-center px-4 sm:px-8 pt-6 sm:pt-8 pb-2 sm:pb-4 gap-4 sm:gap-0">
                  <img src={user.profilePic || "/avatar.png"} alt="avatar" className="w-16 h-16 sm:w-14 sm:h-14 rounded-full object-cover bg-zinc-200" />
                  <div className="sm:ml-4 flex-1 w-full text-center sm:text-left">
                    <div className="text-base sm:text-lg font-normal text-zinc-400">{user.fullName || "Unknown"}</div>
                  </div>
                  <div className="flex gap-4 text-zinc-400 mt-2 sm:mt-0">
                    <span
                      onClick={() => {
                        setSelectedUser(user);
                        navigate("/messages");
                      }}
                    >
                      <MessageCircle className="w-6 h-6 sm:w-5 sm:h-5 cursor-pointer hover:text-primary" />
                    </span>
                    <Video className="w-6 h-6 sm:w-5 sm:h-5 cursor-pointer hover:text-primary" onClick={() => { setSelectedUser(user); setTimeout(() => handleCall(true), 0); }} />
                    <Phone className="w-6 h-6 sm:w-5 sm:h-5 cursor-pointer hover:text-primary" onClick={() => { setSelectedUser(user); setTimeout(() => handleCall(false), 0); }} />
                  </div>
                </div>
   
                <div className="px-4 sm:px-8 py-2 sm:py-4">
                  <div className="text-zinc-400 mb-1 sm:mb-2 text-sm sm:text-base">{day}</div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 text-sm sm:text-base text-zinc-400">
                      {icon}
                      <span>{isIncoming ? "Incoming" : "Outgoing"} {callType} at {time}</span>
                    </div>
                    <div className="text-zinc-400 font-bold whitespace-nowrap text-sm sm:text-base">{durationStr}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom context menu for call history
  const handleCallItemContextMenu = (e, call) => {
    e.preventDefault();
    setCallContextMenu({ visible: true, x: e.clientX, y: e.clientY, call });
  };
  const handleClearCall = async (callId) => {
    if (window.confirm('Are you sure you want to clear this call history?')) {
      try {
        await axiosInstance.delete(`/calls/${callId}`);
        setCallHistory((prev) => prev.filter((c) => c._id !== callId));
        toast.success('Call history cleared');
      } catch {
        toast.error('Failed to clear call history');
      }
    }
    setCallContextMenu((m) => ({ ...m, visible: false }));
  };
  const handleVoiceCall = (call) => {
    const user = call.receiver?._id === selectedUser?._id ? call.caller : call.receiver;
    setSelectedUser(user);
    setTimeout(() => handleCall(false), 0);
    setCallContextMenu((m) => ({ ...m, visible: false }));
  };
  const handleVideoCall = (call) => {
    const user = call.receiver?._id === selectedUser?._id ? call.caller : call.receiver;
    setSelectedUser(user);
    setTimeout(() => handleCall(true), 0);
    setCallContextMenu((m) => ({ ...m, visible: false }));
  };


  // Map favorite user IDs to user objects
  const favoriteUsers = users.filter(user => favorites.includes(user._id));

  // Format date for call history
  const formatCallHistoryDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const callDate = new Date(date);
    callDate.setHours(0, 0, 0, 0);

    if (callDate.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } else if (callDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // For archive sidebar selection
  const isArchiveRoute = location.pathname === '/archive';
  const isArchivedSelected = isArchiveRoute && selectedUser && isArchived(selectedUser._id);

  return (
    <div data-theme={theme} className="h-screen sm:bg-base-200">
      <div className="flex items-center justify-center pt-16 sm:pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-8xl h-[calc(100vh-6rem)]">
          <div className="flex h-full rounded-lg overflow-hidden">
            {isArchiveRoute ? (
              <div className='hidden lg:block'>
                <ArchiveSidebar />
              </div>
            ) : (
              <div className='hidden lg:block'>
                <Sidebar showCalls={showCalls} setSelectedCall={setSelectedCall} onCallItemContextMenu={handleCallItemContextMenu} />
              </div>
            )}
            <div className="flex-1 flex flex-col h-full">
              {isArchiveRoute ? (
                isArchivedSelected ? (
                  <>
                    <ChatHeader
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      showSearch={showSearch}
                      setShowSearch={setShowSearch}
                      currentMatch={currentMatch}
                      totalMatches={totalMatches}
                      onPrevMatch={onPrevMatch}
                      onNextMatch={onNextMatch}
                      onTabChange={setActiveTabView}
                    />
                    <ChatContainer
                      searchQuery={searchQuery}
                      currentMatch={currentMatch}
                      setTotalMatches={setTotalMatches}
                      activeTabView={activeTabView}
                      setActiveTabView={setActiveTabView}
                    />
                  </>
                ) : (
                  <div className="w-full max-w-2xl mx-auto flex flex-1 items-center justify-center flex-col min-h-[60vh]">
                    <h1 className="text-zinc-400 text-center text-3xl font-bold">Archived Chats</h1>
                    <span className="text-zinc-400 text-center py-4">Select an archived chat to view messages.</span>
                  </div>
                )
              ) : showCalls ? (
                selectedCall ? (
                  <div className="flex flex-col h-full w-full">
                    <div className="flex flex-col h-full w-full">
                      {renderCallInfo()}
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-2xl mx-auto flex flex-1 items-center justify-center flex-col min-h-[60vh]">
                    <h1 className="text-zinc-400 text-center text-3xl font-bold">Call History</h1>
                    <span className="text-zinc-400 text-center py-4">Please select a call to view its detailed information.</span>
                    {/* Recent Section */}
                  </div>
                )
              ) : (
                !selectedUser && !selectedGroup ? <NoChatSelected /> : (
                  <>
                    {selectedGroup ? (
                      <GroupChatHeader
                        group={selectedGroup}
                        onBack={() => setSelectedGroup(null)}
                      />
                    ) : (
                      <ChatHeader
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        showSearch={showSearch}
                        setShowSearch={setShowSearch}
                        currentMatch={currentMatch}
                        totalMatches={totalMatches}
                        onPrevMatch={onPrevMatch}
                        onNextMatch={onNextMatch}
                        onTabChange={setActiveTabView}
                      />
                    )}
                    <ChatContainer
                      searchQuery={searchQuery}
                      currentMatch={currentMatch}
                      setTotalMatches={setTotalMatches}
                      activeTabView={activeTabView}
                      setActiveTabView={setActiveTabView}
                    />
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
