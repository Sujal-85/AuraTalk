import { useEffect, useState, useRef, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "../Skeletons/SidebarSkeleton";
import CallSkeleton from "../Skeletons/CallSkeleton";
import { Users, Menu, Image as ImageIcon, Video as VideoIcon, File, Download, PhoneIncoming, PhoneOutgoing, PhoneMissed, MessageCircle, Video, Phone, X, Paintbrush, Trash2, Archive, Star, Bell, Pin, Heart, CheckSquare, MessageCirclePlus, Bot, User, Copy, Check, Send } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import * as ScrollArea from '@radix-ui/react-scroll-area';
import ConfirmModal from './ConfirmModal';
import UserSelectModal from './UserSelectModal';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  fetchUserPublicKey,
  importPublicKey,
  deriveSharedSecret,
  decryptMessage,
  getPrivateKey
} from "../store/useChatStore";

function formatLastMessageDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (today - messageDay) / (1000 * 60 * 60 * 24);
  if (diff === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB");
}

function formatCallHistoryDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (today - messageDay) / (1000 * 60 * 60 * 24);
  if (diff === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB");
}

// NOTE: Using the shared `UserSelectModal` component (with Invite/Chat buttons)

export const Sidebar = ({ showCalls = false, setSelectedCall, onCallItemContextMenu }) => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, isCallHistoryLoading, callLogs, deleteChat, pinUser, unpinUser, isUserPinned, favorites, addFavorite, removeFavorite, isFavorite, archiveUser, unarchiveUser, isArchived, selectedCalls, isCallSelectionMode, toggleCallSelection, selectAllCalls, clearCallSelection, setCallSelectionMode, deleteSelectedCalls, acceptedPeers, loadAcceptedPeers, sendInvitation, groups, loadGroupsForSidebar, selectedGroup, setSelectedGroup } = useChatStore();
  const { onlineUsers, authUser, socket } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(288); // 72 * 4 = 288px (default)
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });

  const [search, setSearch] = useState("");

  const [callHistory, setCallHistory] = useState([]);
  const [callSearch, setCallSearch] = useState("");

  // Context menu for call items
  const [callContextMenu, setCallContextMenu] = useState({ visible: false, x: 0, y: 0, call: null });
  const callContextMenuRef = useRef(null);

  const [showAllFavorites, setShowAllFavorites] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Initialize hiddenUserIds from localStorage ONCE
  const [hiddenUserIds, setHiddenUserIds] = useState(() => {
    const stored = localStorage.getItem('hiddenUserIds');
    return stored ? JSON.parse(stored) : [];
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // AI bot removal state
  const [aiBotVisible, setAiBotVisible] = useState(true);

  // Add this at the top of the user list rendering
  const aiBotUser = {
    _id: 'ai-bot',
    fullName: 'Aura AI',
    profilePic: '/aura-logo.png', // Use your bot avatar here
    isAIBot: true,
    lastMessage: {
      content: 'Hi! I am your AI assistant.',
      createdAt: new Date().toISOString(),
      type: 'text',
    },
    unreadCount: 0,
  };

  const [activeTab, setActiveTab] = useState("all");

  // Add this state near the top of Sidebar
  const [decryptedLastMessages, setDecryptedLastMessages] = useState({});

  const { messages } = useChatStore();

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await getUsers();
      await loadAcceptedPeers();
      await loadGroupsForSidebar();
      // Ensure accepted peers are present in users list (in case they were missing due to caching/archived filters)
      try {
        const peers = useChatStore.getState().acceptedPeers || [];
        const currentUsers = useChatStore.getState().users || [];
        const missing = peers.filter(id => !currentUsers.some(u => u._id === id));
        if (missing.length > 0) {
          const res = await axiosInstance.get('/messages/users');
          const fetched = Array.isArray(res.data) ? res.data : [];
          const toAdd = fetched.filter(u => missing.includes(u._id));
          if (toAdd.length > 0 && mounted) {
            useChatStore.setState((state) => ({ users: [...state.users, ...toAdd] }));
          }
        }
      } catch (e) {
        // ignore
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authUser && socket) {
      useChatStore.getState().initializeCallSocket();
      useChatStore.getState().initializeInvitationSocket();
    }
    // eslint-disable-next-line
  }, [authUser, socket]);

  useEffect(() => {
    const fetchCalls = async (showLoading = false) => {
      try {
        if (showLoading) {
          useChatStore.setState({ isCallHistoryLoading: true });
        }
        const res = await axiosInstance.get("/calls");
        setCallHistory(res.data);
      } catch (error) {
        setCallHistory([]);
      } finally {
        if (showLoading) {
          useChatStore.setState({ isCallHistoryLoading: false });
        }
      }
    };
    
    if (showCalls) {
      fetchCalls(true);
    }
  }, [showCalls]);

  // Listen for new messages to unhide users
  useEffect(() => {
    if (!socket || !authUser) return;

    const handleNewMessage = (message) => {
      const otherUserId = message.senderId === authUser._id ? message.recipientId : message.senderId;
      if (hiddenUserIds.includes(otherUserId)) {
        setHiddenUserIds((prev) => {
          const updated = prev.filter(id => id !== otherUserId);
          localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
          getUsers(false); // Refresh user list to update sidebar
          return updated;
        });
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => socket.off('newMessage', handleNewMessage);
  }, [socket, authUser, hiddenUserIds, users, getUsers]);

  // Handle resize events
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing.current && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        setSidebarWidth(Math.max(200, Math.min(newWidth, 500)));
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
    };

    if (isResizing.current) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing.current]);

  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
  };

  // Filter and sort users
  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  // Apply search filter
  const searchedUsers = search.trim()
    ? filteredUsers.filter(user => user.fullName.toLowerCase().includes(search.toLowerCase()))
    : filteredUsers;

  // Memoize finalSortedUsers
  const finalSortedUsers = useMemo(() => {
    const pinnedUserIds = users.filter(user => isUserPinned(user._id)).map(user => user._id);
    const pinnedUsers = users.filter(user => pinnedUserIds.includes(user._id));
    const nonPinnedUsers = users.filter(user => !pinnedUserIds.includes(user._id));
    const onlineNonPinned = nonPinnedUsers.filter(user => onlineUsers.includes(user._id));
    const offlineNonPinned = nonPinnedUsers.filter(user => !onlineUsers.includes(user._id));
    return [...pinnedUsers, ...onlineNonPinned, ...offlineNonPinned];
  }, [users, onlineUsers, isUserPinned]);

  // Get favourite user objects
  let favoriteUsers = users.filter(user => favorites.includes(user._id));
  // Ensure AI bot appears in favorites if favorited, even if not in users
  if (favorites.includes('ai-bot') && !favoriteUsers.some(u => u._id === 'ai-bot')) {
    favoriteUsers = [aiBotUser, ...favoriteUsers];
  }

  // Replace the definition of displayedUsers with a useMemo
  const displayedUsers = useMemo(() => {
    let visibleUsers = finalSortedUsers.filter(user => !hiddenUserIds.includes(user._id));
    // Only show accepted peers in sidebar (AI bot excluded)
    visibleUsers = visibleUsers.filter(user => acceptedPeers.includes(user._id));
    if (activeTab === "unread") {
      visibleUsers = visibleUsers.filter(user => user.unreadCount > 0);
    } else if (activeTab === "favourites") {
      visibleUsers = visibleUsers.filter(user => favorites.includes(user._id));
    }
    return visibleUsers.filter(user => user.fullName.toLowerCase().includes(search.toLowerCase()));
  }, [finalSortedUsers, hiddenUserIds, activeTab, favorites, search, acceptedPeers]);

  // Deduplicate displayedUsers by _id to avoid duplicate React keys
  const uniqueDisplayedUsers = useMemo(() => {
    const seen = new Set();
    const out = [];
    
    // Add users only (groups have their own section now)
    for (const u of displayedUsers) {
      if (!u || !u._id) continue;
      const userKey = `user-${u._id}`;
      if (seen.has(userKey)) continue;
      seen.add(userKey);
      out.push({ ...u, isGroup: false, uniqueKey: userKey });
    }
    
    return out;
  }, [displayedUsers, search]);

  // Handler for right-click
  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      message,
    });
  };

  // Hide menu on click elsewhere
  useEffect(() => {
    const hideMenu = () => setContextMenu((m) => ({ ...m, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener("click", hideMenu);
    }
    return () => document.removeEventListener("click", hideMenu);
  }, [contextMenu.visible]);

  // Example handler for Copy
  const handleCopy = () => {
    if (contextMenu.message?.text) {
      navigator.clipboard.writeText(contextMenu.message.text);
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  const handleClearMessages = async (userId) => {
    if (userId === 'ai-bot') {
      // Clear AI messages from localStorage and update state
      localStorage.removeItem('aiMessages');
      useChatStore.setState({ aiMessages: [], messages: [] });
      toast.success('AI chat cleared!');
      return;
    }
    if (window.confirm("Are you sure you want to clear all messages with this user? This cannot be undone.")) {
      await deleteChat(userId);
    }
  };

  // Add stub handlers for new actions
  const handleMarkAsUnread = async (userId) => {
    // If there are unread messages, mark as read
    const user = users.find(u => u._id === userId);
    if (!user) return;
    if (user.unreadCount > 0) {
      try {
        await axiosInstance.post(`/messages/read/${userId}`);
        toast.success("Marked as read");
        getUsers(false);
      } catch (e) {
        toast.error("Failed to mark as read");
      }
    } else {
      toast("No unread messages");
    }
  };
  const handlePinToTop = (userId) => {
    // If pinning AI bot, ensure it's in users array
    if (userId === 'ai-bot' && !users.some(u => u._id === 'ai-bot')) {
      useChatStore.setState({ users: [aiBotUser, ...users] });
    }
    pinUser(userId);
    getUsers(false);
  };
  const handleUnpin = (userId) => {
    unpinUser(userId);
    getUsers(false);
  };
  const handleAddToFavorites = (userId) => {
    // If favoriting AI bot, ensure it's in users array and pass full object
    if (userId === 'ai-bot') {
      if (!users.some(u => u._id === 'ai-bot')) {
        useChatStore.setState({ users: [aiBotUser, ...users] });
      }
      addFavorite(aiBotUser);
      toast.success('AI chat added to Favourites!');
    } else {
      addFavorite(users.find(u => u._id === userId));
      toast.success('Added to Favourites!');
    }
    getUsers(false);
  };
  const handleArchive = (userId) => {
    if (userId === 'ai-bot') {
      toast.error('Cannot archive AI bot');
      return;
    }
    archiveUser(userId);
    toast.success('Chat archived!');
  };
  const handleUnarchive = (userId) => {
    unarchiveUser(userId);
    toast.success('Chat unarchived!');
  };
  const handleDeleteChat = (userId) => {
    if (userId === 'ai-bot') {
      // Remove AI chat from sidebar (local only)
      setAiBotVisible(false);
      setSelectedUser(null);
      toast.success('AI chat removed from sidebar!');
      return;
    }
    setHiddenUserIds((prev) => {
      const updated = [...prev, userId];
      localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
      toast.success('User deleted!', { id: 'user-deleted' });
      return updated;
    });
    if (selectedUser && selectedUser._id === userId) {
      setSelectedUser(null);
    }
  };

  // Call history list item click handler
  const handleCallItemClick = (call) => {
    if (setSelectedCall) {
      setSelectedCall(call);
    }
    
    // Also select the user for the sidebar (handle self-calls properly)
    let targetUserId;
    
    // If it's a self-call (caller and receiver are the same), use that user
    if (call.receiver?._id === call.caller?._id) {
      targetUserId = call.receiver?._id || call.caller?._id;
    } else {
      // For regular calls, find the other user (not the current auth user)
      if (call.receiver?._id === authUser?._id) {
        targetUserId = call.caller?._id;
      } else {
        targetUserId = call.receiver?._id;
      }
    }
    
    const user = users.find(u => u._id === targetUserId);
    if (user) {
      setSelectedUser(user);
    }
    
    // Reset context menu when clicking an item
    setCallContextMenu({ visible: false });
    
    // If this is a missed call, mark it as read
    if (call.status === 'missed' && call._id) {
      markCallAsRead(call._id);
    }
  };
  
  // Mark call as read
  const markCallAsRead = async (callId) => {
    try {
      await axiosInstance.patch(`/calls/${callId}/read`);
      // Update local state to reflect the change
      setCallHistory(prev => 
        prev.map(call => 
          call._id === callId ? { ...call, status: 'read' } : call
        )
      );
    } catch (error) {
    }
  };

  // Call history list item context menu handler
  const handleCallContextMenuAction = async (action, call) => {
    try {
      switch (action) {
        case 'delete':
          // Delete call log from backend
          await axiosInstance.delete(`/calls/${call._id}`);
          // Update local state
          setCallHistory(prev => prev.filter(c => c._id !== call._id));
          toast.success('Call log deleted');
          break;
          
        case 'call_back':
          // Handle call back - select the user and initiate call
          if (call.receiver?._id || call.caller?._id) {
            const targetUserId = call.receiver?._id || call.caller?._id;
            const user = users.find(u => u._id === targetUserId);
            if (user) {
              // First select the user
              setSelectedUser(user);
              // Then initiate the call
              setTimeout(() => {
                useChatStore.getState().handleCall(call.type === 'video');
              }, 100);
              toast(`Calling ${user.fullName}...`);
            } else {
              toast.error('User not found');
            }
          }
          break;
          
        case 'view_profile':
          // Handle view profile - open call details in sidebar like normal call click
          if (call.receiver?._id || call.caller?._id) {
            // For self-calls, we need to handle the case where both caller and receiver are the same
            let targetUserId;
            
            // If it's a self-call (caller and receiver are the same), use that user
            if (call.receiver?._id === call.caller?._id) {
              targetUserId = call.receiver?._id || call.caller?._id;
            } else {
              // For regular calls, find the other user (not the current auth user)
              if (call.receiver?._id === authUser?._id) {
                targetUserId = call.caller?._id;
              } else {
                targetUserId = call.receiver?._id;
              }
            }
            
            const user = users.find(u => u._id === targetUserId);
            if (user) {
              // Select the user to open their profile/chat in the sidebar
              setSelectedUser(user);
              // Also set the selected call for call details
              if (setSelectedCall) {
                setSelectedCall(call);
              }
              toast(`Viewing ${user.fullName}'s profile`);
            } else {
              // If user not found in users list, it might be the auth user (self-call)
              if (targetUserId === authUser?._id) {
                // For self-calls, we can still set the selected call
                if (setSelectedCall) {
                  setSelectedCall(call);
                }
                toast(`Viewing your call details`);
              } else {
                toast.error('User not found');
              }
            }
          }
          break;
          
        case 'mark_as_read':
          if (call.status === 'missed') {
            await markCallAsRead(call._id);
            toast.success('Marked as read');
          }
          break;
          
        case 'copy_number':
          if (call.receiver?.phoneNumber) {
            navigator.clipboard.writeText(call.receiver.phoneNumber);
            toast.success('Phone number copied to clipboard');
          }
          break;
          
        default:
          break;
      }
    } catch (error) {
      toast.error('Failed to complete action');
    } finally {
      setCallContextMenu({ visible: false });
    }
  };

  // Filter and sort call history
  const filteredCallHistory = useMemo(() => {
    if (!callSearch.trim()) return callHistory;
    const searchTerm = callSearch.toLowerCase();
    return callHistory.filter(call => {
      const user = call.receiver || call.caller || {};
      return (
        user.fullName?.toLowerCase().includes(searchTerm) ||
        call.status?.toLowerCase().includes(searchTerm) ||
        call.type?.toLowerCase().includes(searchTerm) ||
        (call.direction && call.direction.toLowerCase().includes(searchTerm))
      );
    });
  }, [callHistory, callSearch]);
  
  // Group call history by date
  const groupedCallHistory = useMemo(() => {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (Array.isArray(filteredCallHistory)) {
      filteredCallHistory.forEach(call => {
        const callDate = new Date(call.startedAt || call.createdAt);
        let dateKey;
        
        if (callDate.toDateString() === today.toDateString()) {
          dateKey = 'Today';
        } else if (callDate.toDateString() === yesterday.toDateString()) {
          dateKey = 'Yesterday';
        } else {
          dateKey = callDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        }
        
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        
        groups[dateKey].push(call);
      });
    }
    
    return groups;
  }, [filteredCallHistory]);

  // Context menu for call items
  const handleCallItemContextMenu = (e, call) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close any existing context menu
    setCallContextMenu({ visible: false });
    
    // Set position and data for new context menu
    const x = e.clientX;
    const y = e.clientY;
    
    // Use a small timeout to ensure the menu appears in the correct position
    setTimeout(() => {
      setCallContextMenu({ 
        visible: true, 
        x, 
        y, 
        call,
        // Add user info for display
        user: call.receiver || call.caller
      });
    }, 10);
  };
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

  // Debug logs for favorites and users

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      handleDeleteChat(userToDelete._id);
    }
    setShowConfirm(false);
    setUserToDelete(null);
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setUserToDelete(null);
  };

  // Add this effect to decrypt last messages when users change
  useEffect(() => {
    async function decryptAllLastMessages() {
      if (!authUser) return;
      const newDecrypted = {};
      for (const user of displayedUsers) {
        const lastMsg = user.lastMessage;
        // For all types, try to decrypt if content is a string and looks encrypted
        const msgText = lastMsg?.text ?? lastMsg?.content;
        if (
          lastMsg &&
          typeof msgText === 'string'
        ) {
          const looksEncrypted = /^[A-Za-z0-9+/=\-_]+:[A-Za-z0-9+/=\-_]+$/.test(msgText);
          const isUrl = /^https?:\/\//i.test(msgText);
          const shouldAttemptDecrypt = lastMsg.type === 'text' && looksEncrypted && !isUrl;
          if (shouldAttemptDecrypt) {
            try {
              // Skip AI bot and system users
              if (user._id === 'ai-bot' || lastMsg.senderId === 'ai-bot') {
                newDecrypted[user._id] = msgText;
                continue;
              }
              let otherUserId;
              if (lastMsg.senderId && lastMsg.senderId === authUser._id) {
                otherUserId = user._id;
              } else if (lastMsg.senderId) {
                otherUserId = lastMsg.senderId;
              } else {
                otherUserId = user._id;
              }
              if (!otherUserId || otherUserId === 'undefined') {
                newDecrypted[user._id] = '[Unable to decrypt]';
                continue;
              }
              const myPrivateKey = await getPrivateKey(authUser._id);
              const otherPublicKeyRaw = await fetchUserPublicKey(otherUserId);
              const otherPublicKey = typeof otherPublicKeyRaw === 'string' ? JSON.parse(otherPublicKeyRaw) : otherPublicKeyRaw;
              const otherPublicKeyImported = await importPublicKey(otherPublicKey);
              const sharedSecret = await deriveSharedSecret(myPrivateKey, otherPublicKeyImported);
              newDecrypted[user._id] = await decryptMessage(msgText, sharedSecret);
            } catch (e) {
              newDecrypted[user._id] = (/^[\x20-\x7E]+$/.test(msgText) || isUrl) ? msgText : '[Unable to decrypt]';
            }
          } else {
            newDecrypted[user._id] = msgText;
          }
        }
      }
      setDecryptedLastMessages(newDecrypted);
    }
    decryptAllLastMessages();
    // eslint-disable-next-line
  }, [displayedUsers, authUser]);

  // Helper to get the last message for a user from the messages array
  function getLastMessageForUser(userId) {
    const relevantMessages = messages.filter(
      m => (m.senderId === userId || m.receiverId === userId)
    );
    if (relevantMessages.length === 0) return null;
    const sorted = [...relevantMessages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted[0];
  }

  if (isUsersLoading) return <SidebarSkeleton />;

  if (showCalls) {
    // Call History List
    return (
      <div className="h-full flex flex-col" style={{ width: sidebarWidth, minWidth: 400, maxWidth: 500 }}>
        <div className="p-4 font-bold text-lg select-none flex items-center justify-between">
          <span className="text-base-content">Call History</span>
          {!isCallSelectionMode && (
            <button
              onClick={() => setCallSelectionMode(true)}
              className="btn btn-sm btn-ghost"
              title="Select calls to delete"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-4 pb-2">
          <input
            type="text"
            className="input input-bordered w-full h-9 text-sm"
            placeholder="Search calls..."
            value={callSearch}
            onChange={e => setCallSearch(e.target.value)}
          />
        </div>
        {/* Favorites Section below search bar */}
        <div className="px-4 pt-2 pb-2">
          <div className="font-semibold text-base mb-2">Favorites</div>
          {favoriteUsers.length === 0 ? (
            <div className="text-zinc-400">No favorites yet</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                
                {favoriteUsers.slice(0, 1).map(user => (
                  <div key={user._id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-base-200">
                    <img
                      src={user.profilePic || "/avatar.png"}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="font-medium">{user.fullName}</span>
                  </div>
                ))}
              </div>
              {favoriteUsers.length > 1 && (
                <div className="px-2 pt-1">
                  <button className="text-green-600 font-medium text-base hover:underline" onClick={() => setShowAllFavorites(true)}>
                    More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {/* Modal for all favorites */}
        {showAllFavorites && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-base-100 rounded-lg shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <div className="font-semibold text-lg">All Favorites</div>
                <button onClick={() => setShowAllFavorites(false)} className="text-zinc-500 hover:text-zinc-700">Close</button>
              </div>
              <div className="flex flex-col gap-2">
                {favoriteUsers.map(user => (
                  <div key={user._id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-base-200">
                    <img
                      src={user.profilePic || "/avatar.png"}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="font-medium">{user.fullName}</span>
                    <button onClick={() => removeFavorite(user._id)} className="ml-auto text-xs text-red-500">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Call Selection Header */}
        {isCallSelectionMode && (
          <div className="px-4 py-4 bg-zinc-800/50 border-b border-zinc-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-zinc-200">
                    {selectedCalls.length} call{selectedCalls.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={() => {
                    const allCallIds = Object.values(groupedCallHistory).flat().map(call => call._id).filter(Boolean);
                    if (selectedCalls.length === allCallIds.length) {
                      clearCallSelection();
                    } else {
                      selectAllCalls(allCallIds);
                    }
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  {selectedCalls.length === Object.values(groupedCallHistory).flat().filter(call => call._id).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={deleteSelectedCalls}
                  disabled={selectedCalls.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={clearCallSelection}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Call history list */}
        <div className="flex-1 overflow-auto custom-scrollbar select-none text-base-content">
          {isCallHistoryLoading ? (
            <CallSkeleton />
          ) : Object.keys(groupedCallHistory).length === 0 ? (
            <div className="text-center text-base-content py-8">
              <Phone className="w-12 h-12 mx-auto text-zinc-400 mb-2" />
              <p>No call history found</p>
              <p className="text-sm text-zinc-500 mt-1">Your call history will appear here</p>
            </div>
          ) : (
            Object.entries(groupedCallHistory).map(([date, calls]) => (
              <div key={date} className="mb-2">
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-base-content">{date}</span>
                </div>
                {calls.map(call => {
                  const user = call.receiver || call.caller || {};
                  const isMissed = call.status === "missed";
                  const isIncoming = call.direction === "incoming";
                  
                  // Determine icon and colors based on call status and direction
                  let icon, label, iconColor, labelColor;
                  
                  if (isMissed) {
                    iconColor = "text-red-500";
                    labelColor = "text-red-500";
                    label = "Missed";
                    icon = <PhoneMissed className={`w-4 h-4 ${iconColor}`} />;
                  } else {
                    iconColor = isIncoming ? "text-green-500" : "text-blue-500";
                    labelColor = "text-zinc-400";
                    label = isIncoming ? "Incoming" : "Outgoing";
                    icon = isIncoming 
                      ? <PhoneIncoming className={`w-4 h-4 ${iconColor}`} /> 
                      : <PhoneOutgoing className={`w-4 h-4 ${iconColor}`} />;
                  }
                  
                  // Format call duration if available
                  const duration = call.duration 
                    ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}`
                    : '';
                  
                  return (
                    <div
                      key={call._id || `call-${call.startedAt}-${user._id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 cursor-pointer select-none ${
                        selectedCalls.includes(call._id) 
                          ? 'bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-400 shadow-sm' 
                          : 'hover:bg-zinc-800/30'
                      }`}
                      onClick={(e) => {
                        if (isCallSelectionMode) {
                          e.preventDefault();
                          if (call._id) {
                            toggleCallSelection(call._id);
                          }
                        } else {
                          handleCallItemClick(call);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (!isCallSelectionMode) {
                          handleCallItemContextMenu(e, call);
                        }
                      }}
                    >
                      <div className="relative">
                        {isCallSelectionMode && call._id ? (
                          <div className="w-10 h-10 flex items-center justify-center">
                            <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                              selectedCalls.includes(call._id) 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'border-zinc-500 hover:border-blue-400'
                            }`}>
                              {selectedCalls.includes(call._id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <img 
                              src={user.profilePic || "/avatar.png"} 
                              alt={user.fullName} 
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                            {isMissed && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-base-100"></div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium truncate transition-colors ${
                            selectedCalls.includes(call._id) ? 'text-blue-200' : 'text-base-content'
                          }`}>{user.fullName || 'Unknown'}</span>
                          <span className={`text-xs whitespace-nowrap ml-2 transition-colors ${
                            selectedCalls.includes(call._id) ? 'text-blue-300' : 'text-zinc-400'
                          }`}>{formatCallHistoryDate(call.startedAt || call.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`flex items-center gap-1 transition-colors ${
                            selectedCalls.includes(call._id) 
                              ? (isMissed ? 'text-red-400' : 'text-blue-300')
                              : labelColor
                          }`}>
                            {icon}
                            <span className="text-xs">{label}</span>
                          </span>
                          {duration && (
                            <span className="text-xs text-zinc-500">• {duration}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          
          {/* Call Context Menu */}
          {callContextMenu.visible && (
            <div 
              ref={callContextMenuRef}
              className="fixed z-50 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                left: `${callContextMenu.x}px`,
                top: `${callContextMenu.y}px`,
                transform: 'translateY(-100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {callContextMenu.call?.receiver?.phoneNumber && (
                <button
                  onClick={() => handleCallContextMenuAction('call_back', callContextMenu.call)}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call Back
                </button>
              )}
              
              <button
                onClick={() => handleCallContextMenuAction('view_profile', callContextMenu.call)}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <User className="w-4 h-4 mr-2" />
                View Profile
              </button>
              
              {callContextMenu.call?.receiver?.phoneNumber && (
                <button
                  onClick={() => handleCallContextMenuAction('copy_number', callContextMenu.call)}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Number
                </button>
              )}
              
              {callContextMenu.call?.status === 'missed' && (
                <button
                  onClick={() => handleCallContextMenuAction('mark_as_read', callContextMenu.call)}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Read
                </button>
              )}
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              
              <button
                onClick={() => handleCallContextMenuAction('delete', callContextMenu.call)}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Call
              </button>
            </div>
          )}
        </div>
        <div
          onMouseDown={startResizing}
          className="absolute top-0 right-0 h-full w-3 hover-bg-white cursor-ew-resize z-50 transition-colors"
          style={{ userSelect: "none" }}
        />
      </div>
    );
  }

  if (!showCalls) {
    // Messages tab: render only the main chat list, no favorites row
    return (
      <>
        {/* Backdrop for mobile */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          style={{ width: sidebarWidth, minWidth: 400, maxWidth: 500 }}
          className={`
            relative fixed left-0 top-0 h-full bg-base-100 z-50 flex flex-col select-none
            lg:static lg:translate-x-0 lg:shadow-2xl shadow-2xl
          `}
        >
          {/* Close button for mobile */}
          <div className="flex items-center p-4 border-b border-base-300 lg:hidden">
            <button onClick={() => setIsOpen(false)} className="mr-2">
              <span className="text-2xl">×</span>
            </button>
            <div className="font-bold text-lg">Auratalk</div>
          </div>
          {/* Mobile search bar, only show if no chat is open */}
          <div className="lg:hidden px-4 pt-2 pb-1">
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
              <input
                type="text"
                className="pl-10 pr-4 py-2 rounded-full bg-base-200 text-base w-full focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
                placeholder="Search Users"
                value={search}
                onChange={e => { setSearch(e.target.value); setContextMenu((m) => ({ ...m, visible: false })); }}
              />
            </div>
          </div>

          {/* Mobile action buttons */}
          <div className="lg:hidden px-4 pt-2 pb-2 gap-2 flex">
            <button
              className="flex-1 bg-green-500 hover:bg-green-600 text-black px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              onClick={() => setShowNewChatModal(true)}
            >
              <MessageCirclePlus className="w-4 h-4" />
              Add Users
            </button>
            <button
              className="flex-1 bg-base-300 hover:bg-base-400 text-base-content px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              onClick={() => {
                setSelectedUser({
                  _id: 'ai-bot',
                  fullName: 'Aura AI',
                  profilePic: '/aura-logo.png',
                  isAIBot: true
                });
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              AI Chat
            </button>
          </div>
          {/* Desktop header */}
          <div className="border-b border-base-300 w-full p-4 lg:p-5 hidden lg:flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium">Contacts</span>
          </div>
          {/* Desktop search bar */}
          <div className="hidden lg:flex px-5 pt-3 pb-1">
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
              <input
                type="text"
                className="pl-10 pr-4 py-2 rounded-full bg-base-200 text-base w-full focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
                placeholder="Search Users"
                value={search}
                onChange={e => { setSearch(e.target.value); setContextMenu((m) => ({ ...m, visible: false })); }}
              />
            </div>
          </div>

          {/* Action buttons for adding users */}
          <div className="hidden lg:flex px-5 pt-2 pb-2 gap-2">
            <button
              className="flex-1 bg-green-500 hover:bg-green-600 text-black px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              onClick={() => setShowNewChatModal(true)}
            >
              <MessageCirclePlus className="w-4 h-4" />
              Add Users
            </button>
            <button
              className="flex-1 bg-base-300 hover:bg-base-400 text-base-content px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              onClick={() => {
                setSelectedUser({
                  _id: 'ai-bot',
                  fullName: 'Aura AI',
                  profilePic: '/aura-logo.png',
                  isAIBot: true
                });
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              AI Chat
            </button>
          </div>

          {/* Main chat list below favorites section */}
          <div className="flex-1 flex flex-col overflow-auto custom-scrollbar select-none">
            {/* Tab buttons for All, Unread, Favourites */}
            <div className="flex gap-2 px-4 pt-2 pb-2">
              <button
                className={`px-4 py-1 rounded-full border border-gray-800 transition font-medium ${activeTab === "all" ? "bg-green-300 text-green-800 " : " text-gray-700 "}`}
                onClick={() => { setActiveTab("all"); setContextMenu((m) => ({ ...m, visible: false })); }}
              >
                All
              </button>
              <button
                className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "unread" ? "bg-green-300 text-green-800 " : "text-gray-700 "}`}
                onClick={() => { setActiveTab("unread"); setContextMenu((m) => ({ ...m, visible: false })); }}
              >
                Unread
              </button>
              <button
                className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "favourites" ? "bg-green-300 text-green-800 " : " text-gray-700"}`}
                onClick={() => { setActiveTab("favourites"); setContextMenu((m) => ({ ...m, visible: false })); }}
              >
                Favourites
              </button>
            </div>
            
            {/* Groups Section */}
            {Array.isArray(groups) && groups.length > 0 && (
              <div className="px-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-base-content/70">Groups</h3>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="text-xs text-green-500 hover:text-green-400"
                    title="Create New Group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1">
                  {groups
                    .filter(group => group.name.toLowerCase().includes(search.toLowerCase()))
                    .map(group => (
                      <div
                        key={`group-${group._id}`}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-base-200 transition rounded-lg ${
                          selectedGroup?._id === group._id ? "bg-base-200" : ""
                        }`}
                        onClick={() => {
                          setSelectedGroup(group);
                          setSelectedUser(null);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user: { ...group, isGroup: true } });
                        }}
                      >
                        <div className="relative">
                          {group.avatar ? (
                            <img
                              src={group.avatar}
                              alt={group.name}
                              className="size-10 object-cover rounded-full"
                              onError={e => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                          ) : (
                            <div className="size-10 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {group.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate flex items-center gap-1">
                              <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              {group.name}
                            </span>
                            <span className="text-xs text-base-content/60">
                              {group.lastMessage ? formatLastMessageDate(group.lastMessage.createdAt) : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-base-content/60">
                            <span className="truncate flex-1">
                              {group.lastMessage ? (
                                group.lastMessage.type === "image" ? "🖼️ Image" :
                                group.lastMessage.type === "video" ? "🎥 Video" :
                                group.lastMessage.type === "audio" ? "🎵 Audio" :
                                group.lastMessage.type === "document" ? "📄 Document" :
                                group.lastMessage.content || "Media"
                              ) : "No messages yet"}
                            </span>
                            {group.unreadCount > 0 && (
                              <span className="ml-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                                {group.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {/* Individual Chats Section */}
            <div className="px-4 py-2">
              <h3 className="text-sm font-semibold text-base-content/70 mb-2">Individual Chats</h3>
            </div>
            
            {/* Empty State - Show when no groups and no users */}
            {(!Array.isArray(groups) || groups.length === 0) && uniqueDisplayedUsers.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-base-content mb-2">No Chats Available</h3>
                <p className="text-sm text-base-content/60 mb-4">
                  Start by adding users or creating groups to begin chatting
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Start New Chat
                </button>
              </div>
            )}
            
            {/* Render AI bot as the first chat in the list, only if visible */}
            {aiBotVisible && (
              <div
                key={aiBotUser._id}
                className={`flex items-center gap-3 px-4 py-1 cursor-pointer hover:bg-base-200 transition ${selectedUser?._id === aiBotUser._id ? "bg-base-200" : ""}`}
                onClick={() => setSelectedUser(aiBotUser)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user: aiBotUser });
                }}
              >
                <div className="relative">
                <svg width="55" height="55" viewBox="0 0 350 250.7614769349202"
                  className="looka-1j8o68f">
                    <defs id="SvgjsDefs1011">
                    </defs>
                    <g id="SvgjsG1012" featurekey="e7LhAk-0" transform="matrix(0.1763890611651924,0,0,0.1763890611651924,86.81428940875875,-11.291747504091246)"
                    fill="#680747">
                      <g xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path d="M371,409c-30.6,0-55.5,24.6-56,55.1c-14.4,7.7-28.5,15-42.8,22c-12.3,6.1-15.5,13.7-15.8,26.5    c-1.5,62.1-3.9,124.2-6,186.3c-0.4,12.7-0.8,25.4-1.4,42.7c-13.2-7.5-21.8-13.5-31.2-17.6c-25.8-11.2-34.5-29.1-31.8-57.7    c4.2-43.6,3.7-87.6,5.3-135.5c-13.7,6.9-23.3,13-33.7,16.7c-20.9,7.4-27,21.3-26.6,43c0.6,38.4-0.9,76.9-3.8,115.1    c-1.6,21.2,3,34.8,23.2,45.1c25.3,13,48.7,29.8,73,44.8c25.3,15.7,50.7,31.3,79.7,49.2c0.5-13.7,0.8-22.5,1-31.2    c2.7-79.2,7.1-158.5,7.1-237.7c0-29.9,6.4-50.5,31.3-62.7c8.4,5,18.2,7.9,28.6,7.9c30.9,0,56-25.1,56-56S401.9,409,371,409z     M371,496c-0.2,0-0.3,0-0.4,0h0c-16.9-0.2-30.5-14-30.5-31c0-6.3,1.9-12.1,5.1-17c0,0,0,0,0,0c5.5-8.4,15.1-14,25.9-14h0.1    c2.9,0,5.6,0.4,8.3,1.1c13,3.7,22.6,15.7,22.6,29.9C402,482.1,388.1,496,371,496z">
                          </path>
                          <path d="M462,307c-11,0-21.2,3.2-29.9,8.7c-10.7-6.9-21.1-13.8-31.5-20.8c-11.3-7.7-19.6-6.8-30.9-0.8    c-54.8,29.2-110.1,57.5-165.3,86.1c-11.3,5.9-22.5,11.7-37.9,19.7c0.1-15.2,1.1-25.6,0.1-35.8c-2.9-27.9,8.4-44.4,34.7-56    c40-17.7,78.1-39.7,120.7-61.8c-12.7-8.6-22.7-13.9-31.1-21.2c-16.7-14.6-31.8-13.1-50.5-2.1c-33.1,19.4-67.4,36.9-102.2,53.1    c-19.2,9-28.9,19.7-28,42.3c1.1,28.5-2.1,57-3.3,85.6c-1.3,29.8-2.4,59.6-3.8,93.6c12.1-6.3,19.9-10.3,27.7-14.4    c70.3-36.5,141.6-71.5,210.6-110.4c24-13.5,43.7-18.4,64.5-6.9v0c1.4,29.6,26,53.3,55.9,53.3c30.9,0,56-25.1,56-56    S492.9,307,462,307z M492.9,365.8c-1.4,15.8-14.7,28.2-30.9,28.2c-8.3,0-15.9-3.3-21.5-8.7c-5.9-5.6-9.5-13.6-9.5-22.3    c0-15.8,11.8-28.8,27.1-30.8c1.3-0.2,2.6-0.3,3.9-0.3c13.7,0,25.4,9,29.5,21.4c1,3,1.5,6.3,1.5,9.6    C493,363.9,493,364.9,492.9,365.8z">
                          </path>
                        </g>
                        <path d="M677,824.7c-67.8-41.2-134.6-83.9-203.7-122.7c-25.9-14.6-40.7-30.1-39.3-57.4c18.8-9,31.8-28.3,31.8-50.5   c0-30.9-25.1-56-56-56s-56,25.1-56,56c0,19.1,9.6,35.9,24.2,46c-0.4,17.7-0.9,34.8-1.8,51.8c-0.7,13.7,4.3,20.3,15.3,26.8   c53.4,31.7,106.3,64.3,159.4,96.5c10.8,6.6,21.7,13.2,36.5,22.2c-13,7.8-22.5,12.3-30.6,18.5c-22.4,17-42.3,15.8-65.9-0.6   c-35.9-25-74.5-46.1-115.5-71c-0.7,15.3-0.1,26.7-2,37.6c-3.8,21.8,5.3,33.9,24.4,44.3c33.7,18.3,66.5,38.5,98.5,59.8   c17.7,11.8,31.8,14.4,50.7,1.9c23.8-15.7,49.9-27.8,74.9-41.6c26.1-14.4,52.2-28.8,82-45.3C692,833.8,684.5,829.2,677,824.7z    M409.8,625.1c-16.7,0-30.4-13.3-31-29.9v0c0-0.4,0-0.7,0-1.1c0-0.7,0-1.3,0.1-2c0,0,0-0.1,0-0.1v-0.1c0.5-6.6,3-12.6,6.9-17.4   c5.7-7,14.3-11.4,24-11.4c17.1,0,31,13.9,31,31c0,7.4-2.6,14.3-7,19.6C428,620.7,419.4,625.1,409.8,625.1z">
                        </path>
                        <path d="M896.8,489.8c-11.9,6.7-19.6,11-27.2,15.3c-69.1,38.9-139.1,76.2-206.8,117.4c-24.6,15-44.9,20.4-67.3,7.4   c0.2-1.9,0.3-3.8,0.3-5.8c0-30.9-25.1-56-56-56s-56,25.1-56,56c0,30.9,25.1,56,56,56c8,0,15.6-1.7,22.5-4.7h0   c15.1,9,29.7,17.8,44.1,26.9c11.6,7.3,19.8,6.2,30.9-0.2c53.8-31,108.1-61.2,162.3-91.6c11.1-6.2,22.1-12.5,37.2-20.9   c0.4,15.2-0.3,25.6,1.1,35.8c3.8,27.8-6.9,44.6-32.8,57.2c-39.4,19.1-76.7,42.3-118.5,65.9c13,8.1,23.2,13.2,31.8,20.2   c17.2,14,32.2,12,50.5,0.4c32.4-20.5,66.1-39.2,100.4-56.5c18.9-9.6,28.2-20.7,26.5-43.2c-2-28.4,0.2-57.1,0.4-85.7   C896.4,553.6,896.5,523.8,896.8,489.8z M539.8,655.1c-13.2,0-24.5-8.3-29-20c-1.3-3.4-2-7.1-2-11c0-17.1,13.9-31,31-31   c13.7,0,25.4,9,29.5,21.3c1,3,1.5,6.3,1.5,9.7C570.8,641.2,556.8,655.1,539.8,655.1z">
                        </path>
                        <path d="M865.9,397.8c-1.9-38.3-1.7-76.8-0.1-115.2c0.9-21.2-4.2-34.7-24.7-44.3c-25.8-12.1-49.7-28.1-74.5-42.4   c-25.8-14.9-51.8-29.6-81.3-46.5c0,13.7,0,22.5,0,31.3c0,79.3-1.8,158.6,0.9,237.8c1,28-4,48-24.7,61.1c-8.2-4.7-17.8-7.5-27.9-7.5   c-30.9,0-56,25.1-56,56c0,30.9,25.1,56,56,56c30.9,0,56-25.1,56-55.9c12.9-7.4,25.6-14.6,38.5-21.4c12.1-6.5,15.1-14.2,14.9-27   c-0.6-62.1-0.3-124.2-0.3-186.3v-42.7c13.4,7.1,22.2,12.8,31.7,16.5c26.1,10.3,35.5,27.9,33.7,56.6c-2.7,43.7-0.7,87.6-0.7,135.6   c13.4-7.3,22.8-13.8,33.2-17.8C861.4,433.5,867,419.4,865.9,397.8z M659.1,545.9c-5.1,7.2-13.1,12.1-22.3,13c-1,0.1-2,0.1-3,0.1   c-3.9,0-7.6-0.7-11-2c-11.7-4.4-20-15.8-20-29c0-16.6,13.1-30.2,29.5-31h0c0.5,0,1,0,1.5,0c17.1,0,31,13.9,31,31   C664.8,534.7,662.7,540.9,659.1,545.9z">
                        </path>
                        <path d="M627.3,356.9c0.9-14.9,1.9-29.5,3.1-44c1.2-13.6-3.6-20.4-14.4-27.3c-52.3-33.5-104.1-67.8-156.1-101.8   c-10.6-7-21.3-13.9-35.7-23.4c13.3-7.4,22.9-11.6,31.2-17.5c23-16.2,42.8-14.4,65.9,2.8c35.1,26.2,72.9,48.6,113,74.9   c1.2-15.3,1-26.6,3.3-37.5c4.5-21.7-4.2-34.1-22.9-45c-33.1-19.4-65.2-40.7-96.4-63c-17.2-12.4-31.3-15.5-50.6-3.6   c-24.3,14.9-50.8,26.2-76.2,39.1c-26.6,13.5-53.1,27.1-83.4,42.5c11.4,7.5,18.8,12.3,26.2,17.1c66.3,43.4,131.7,88.4,199.5,129.5   c24.1,14.7,38.2,29.9,37.6,54.7c-17.9,9.3-30.2,28.1-30.2,49.7c0,30.9,25.1,56,56,56s56-25.1,56-56   C653,384.3,642.7,366.9,627.3,356.9z M624,419.3c-2.2,3.8-5.1,7.1-8.7,9.7c-5.1,3.8-11.5,6-18.3,6c-17.1,0-31-13.9-31-31   c0-5.6,1.5-10.8,4-15.3c5.3-9.4,15.4-15.7,27-15.7c12.7,0,23.6,7.6,28.4,18.6c1.7,3.8,2.6,8,2.6,12.4   C628,409.6,626.5,414.8,624,419.3z">
                        </path>
                      </g>
                  </g>
                </svg>
                  <span className="absolute bottom-0 left-0 size-3 bg-blue-500 rounded-full ring-2 ring-white" />
                </div>
                <div className="text-left w-full">
                  <div className="font-medium flex items-center justify-between w-full">
                    <span className="truncate">{aiBotUser.fullName}</span>
                    <span className="flex flex-col items-end min-w-[40px] gap-1">
                      <span className="text-xs text-zinc-400 mt-1">
                        {/* Optionally show a static date or nothing */}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                    <span className="truncate w-0 flex-1">
                      {aiBotUser.lastMessage.content}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {uniqueDisplayedUsers.map((user) => (
              <div
                key={user.uniqueKey}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-base-200 transition ${
                  selectedUser?._id === user._id ? "bg-base-200" : ""
                }`}
                onClick={() => {
                  setSelectedUser(user);
                  setSelectedGroup(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user });
                }}
              >
                <div className="relative">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-10 object-cover rounded-full"
                    onError={e => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                  />
                  {onlineUsers.includes(user._id) && (
                    <span
                      className="absolute bottom-0 left-0 size-3 bg-green-500 rounded-full ring-2 ring-white"
                    />
                  )}
                </div>
                <div className="text-left w-full">
                  <div className="font-medium flex items-center justify-between w-full">
                    <span className="truncate">{user.fullName}</span>
                    <span className="flex flex-col items-end min-w-[40px] gap-1">
                      <span className="text-xs text-zinc-400 mt-1">
                        {user.lastMessage ? formatLastMessageDate(user.lastMessage.createdAt) : ""}
                      </span>
                      {isUserPinned(user._id) && (
                        <Pin className="w-4 h-4" style={{ color: '#2A2A2A' }} />
                      )}
                    </span>
                  </div>
                  {/* Desktop: Last message, Mobile: Online/Offline */}
                  <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                    <span className="truncate w-0 flex-1">
                      {user.lastMessage ? (
                        user.lastMessage.type === "image" ? (<><ImageIcon className="w-4 h-4 inline mr-1" /> Image</>)
                          : user.lastMessage.type === "video" ? (<><VideoIcon className="w-4 h-4 inline mr-1" /> Video</>)
                          : user.lastMessage.type === "audio" ? (<><File className="w-4 h-4 inline mr-1" /> Audio</>)
                          : user.lastMessage.type === "document" ? (<><File className="w-4 h-4 inline mr-1" /> Document</>)
                          : user.lastMessage.type === "text" ? (
                            <div
                              className="truncate"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(decryptedLastMessages[user._id] ?? user.lastMessage.text ?? user.lastMessage.content) }}
                            />
                          ) : (decryptedLastMessages[user._id] ?? user.lastMessage.text ?? user.lastMessage.content)
                      ) : ""}
                    </span>
                    {user.unreadCount > 0 && user._id !== selectedUser?._id && (
                      <span className="ml-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow">
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                  {user.lastMessage && user.lastMessage.type === "document" && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-base-200 rounded-lg w-48 sm:w-auto sm:max-w-[200px] lg:max-w-[300px]">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <File className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={user.lastMessage.document}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium underline truncate block"
                          title={user.lastMessage.fileName || "Document"}
                        >
                          {user.lastMessage.fileName || "Document"}
                        </a>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Implement download logic here
                        }}
                        className="ml-2 p-1 rounded hover:bg-primary/10"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
                {uniqueDisplayedUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-4">
                {Array.isArray(groups) && groups.length > 0 ? "No individual chats available" : "No chats available"}
              </div>
            )}
          </div>

          {/* Floating AI Bot Button ABOVE new chat button */}
          {/* <div className="absolute bottom-16 right-5 z-40 w-16 h-16 rounded-full bg-black ">
            <button
              className=" text-white rounded-full shadow-lg mt-1 w-full h-full flex items-center justify-center transition-all duration-200"
              onClick={() => {
                setSelectedUser({
                  _id: 'ai-bot',
                  fullName: 'Aura AI',
                  profilePic: '/aura-logo.png',
                  isAIBot: true
                });
              }}
              title="AI Chat"
            >
              <svg width="100" height="100" viewBox="0 0 350 250.7614769349202"
                className="looka-1j8o68f">
                  <defs id="SvgjsDefs1011">
                  </defs>
                  <g id="SvgjsG1012" featurekey="e7LhAk-0" transform="matrix(0.1763890611651924,0,0,0.1763890611651924,86.81428940875875,-11.291747504091246)"
                  fill="#680747">
                    <g xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path d="M371,409c-30.6,0-55.5,24.6-56,55.1c-14.4,7.7-28.5,15-42.8,22c-12.3,6.1-15.5,13.7-15.8,26.5    c-1.5,62.1-3.9,124.2-6,186.3c-0.4,12.7-0.8,25.4-1.4,42.7c-13.2-7.5-21.8-13.5-31.2-17.6c-25.8-11.2-34.5-29.1-31.8-57.7    c4.2-43.6,3.7-87.6,5.3-135.5c-13.7,6.9-23.3,13-33.7,16.7c-20.9,7.4-27,21.3-26.6,43c0.6,38.4-0.9,76.9-3.8,115.1    c-1.6,21.2,3,34.8,23.2,45.1c25.3,13,48.7,29.8,73,44.8c25.3,15.7,50.7,31.3,79.7,49.2c0.5-13.7,0.8-22.5,1-31.2    c2.7-79.2,7.1-158.5,7.1-237.7c0-29.9,6.4-50.5,31.3-62.7c8.4,5,18.2,7.9,28.6,7.9c30.9,0,56-25.1,56-56S401.9,409,371,409z     M371,496c-0.2,0-0.3,0-0.4,0h0c-16.9-0.2-30.5-14-30.5-31c0-6.3,1.9-12.1,5.1-17c0,0,0,0,0,0c5.5-8.4,15.1-14,25.9-14h0.1    c2.9,0,5.6,0.4,8.3,1.1c13,3.7,22.6,15.7,22.6,29.9C402,482.1,388.1,496,371,496z">
                          </path>
                        <path d="M462,307c-11,0-21.2,3.2-29.9,8.7c-10.7-6.9-21.1-13.8-31.5-20.8c-11.3-7.7-19.6-6.8-30.9-0.8    c-54.8,29.2-110.1,57.5-165.3,86.1c-11.3,5.9-22.5,11.7-37.9,19.7c0.1-15.2,1.1-25.6,0.1-35.8c-2.9-27.9,8.4-44.4,34.7-56    c40-17.7,78.1-39.7,120.7-61.8c-12.7-8.6-22.7-13.9-31.1-21.2c-16.7-14.6-31.8-13.1-50.5-2.1c-33.1,19.4-67.4,36.9-102.2,53.1    c-19.2,9-28.9,19.7-28,42.3c1.1,28.5-2.1,57-3.3,85.6c-1.3,29.8-2.4,59.6-3.8,93.6c12.1-6.3,19.9-10.3,27.7-14.4    c70.3-36.5,141.6-71.5,210.6-110.4c24-13.5,43.7-18.4,64.5-6.9v0c1.4,29.6,26,53.3,55.9,53.3c30.9,0,56-25.1,56-56    S492.9,307,462,307z M492.9,365.8c-1.4,15.8-14.7,28.2-30.9,28.2c-8.3,0-15.9-3.3-21.5-8.7c-5.9-5.6-9.5-13.6-9.5-22.3    c0-15.8,11.8-28.8,27.1-30.8c1.3-0.2,2.6-0.3,3.9-0.3c13.7,0,25.4,9,29.5,21.4c1,3,1.5,6.3,1.5,9.6    C493,363.9,493,364.9,492.9,365.8z">
                          </path>
                      </g>
                      <path d="M677,824.7c-67.8-41.2-134.6-83.9-203.7-122.7c-25.9-14.6-40.7-30.1-39.3-57.4c18.8-9,31.8-28.3,31.8-50.5   c0-30.9-25.1-56-56-56s-56,25.1-56,56c0,19.1,9.6,35.9,24.2,46c-0.4,17.7-0.9,34.8-1.8,51.8c-0.7,13.7,4.3,20.3,15.3,26.8   c53.4,31.7,106.3,64.3,159.4,96.5c10.8,6.6,21.7,13.2,36.5,22.2c-13,7.8-22.5,12.3-30.6,18.5c-22.4,17-42.3,15.8-65.9-0.6   c-35.9-25-74.5-46.1-115.5-71c-0.7,15.3-0.1,26.7-2,37.6c-3.8,21.8,5.3,33.9,24.4,44.3c33.7,18.3,66.5,38.5,98.5,59.8   c17.7,11.8,31.8,14.4,50.7,1.9c23.8-15.7,49.9-27.8,74.9-41.6c26.1-14.4,52.2-28.8,82-45.3C692,833.8,684.5,829.2,677,824.7z    M409.8,625.1c-16.7,0-30.4-13.3-31-29.9v0c0-0.4,0-0.7,0-1.1c0-0.7,0-1.3,0.1-2c0,0,0-0.1,0-0.1v-0.1c0.5-6.6,3-12.6,6.9-17.4   c5.7-7,14.3-11.4,24-11.4c17.1,0,31,13.9,31,31c0,7.4-2.6,14.3-7,19.6C428,620.7,419.4,625.1,409.8,625.1z">
                      </path>
                      <path d="M896.8,489.8c-11.9,6.7-19.6,11-27.2,15.3c-69.1,38.9-139.1,76.2-206.8,117.4c-24.6,15-44.9,20.4-67.3,7.4   c0.2-1.9,0.3-3.8,0.3-5.8c0-30.9-25.1-56-56-56s-56,25.1-56,56c0,30.9,25.1,56,56,56c8,0,15.6-1.7,22.5-4.7h0   c15.1,9,29.7,17.8,44.1,26.9c11.6,7.3,19.8,6.2,30.9-0.2c53.8-31,108.1-61.2,162.3-91.6c11.1-6.2,22.1-12.5,37.2-20.9   c0.4,15.2-0.3,25.6,1.1,35.8c3.8,27.8-6.9,44.6-32.8,57.2c-39.4,19.1-76.7,42.3-118.5,65.9c13,8.1,23.2,13.2,31.8,20.2   c17.2,14,32.2,12,50.5,0.4c32.4-20.5,66.1-39.2,100.4-56.5c18.9-9.6,28.2-20.7,26.5-43.2c-2-28.4,0.2-57.1,0.4-85.7   C896.4,553.6,896.5,523.8,896.8,489.8z M539.8,655.1c-13.2,0-24.5-8.3-29-20c-1.3-3.4-2-7.1-2-11c0-17.1,13.9-31,31-31   c13.7,0,25.4,9,29.5,21.3c1,3,1.5,6.3,1.5,9.7C570.8,641.2,556.8,655.1,539.8,655.1z">
                      </path>
                      <path d="M865.9,397.8c-1.9-38.3-1.7-76.8-0.1-115.2c0.9-21.2-4.2-34.7-24.7-44.3c-25.8-12.1-49.7-28.1-74.5-42.4   c-25.8-14.9-51.8-29.6-81.3-46.5c0,13.7,0,22.5,0,31.3c0,79.3-1.8,158.6,0.9,237.8c1,28-4,48-24.7,61.1c-8.2-4.7-17.8-7.5-27.9-7.5   c-30.9,0-56,25.1-56,56c0,30.9,25.1,56,56,56c30.9,0,56-25.1,56-55.9c12.9-7.4,25.6-14.6,38.5-21.4c12.1-6.5,15.1-14.2,14.9-27   c-0.6-62.1-0.3-124.2-0.3-186.3v-42.7c13.4,7.1,22.2,12.8,31.7,16.5c26.1,10.3,35.5,27.9,33.7,56.6c-2.7,43.7-0.7,87.6-0.7,135.6   c13.4-7.3,22.8-13.8,33.2-17.8C861.4,433.5,867,419.4,865.9,397.8z M659.1,545.9c-5.1,7.2-13.1,12.1-22.3,13c-1,0.1-2,0.1-3,0.1   c-3.9,0-7.6-0.7-11-2c-11.7-4.4-20-15.8-20-29c0-16.6,13.1-30.2,29.5-31h0c0.5,0,1,0,1.5,0c17.1,0,31,13.9,31,31   C664.8,534.7,662.7,540.9,659.1,545.9z">
                      </path>
                      <path d="M627.3,356.9c0.9-14.9,1.9-29.5,3.1-44c1.2-13.6-3.6-20.4-14.4-27.3c-52.3-33.5-104.1-67.8-156.1-101.8   c-10.6-7-21.3-13.9-35.7-23.4c13.3-7.4,22.9-11.6,31.2-17.5c23-16.2,42.8-14.4,65.9,2.8c35.1,26.2,72.9,48.6,113,74.9   c1.2-15.3,1-26.6,3.3-37.5c4.5-21.7-4.2-34.1-22.9-45c-33.1-19.4-65.2-40.7-96.4-63c-17.2-12.4-31.3-15.5-50.6-3.6   c-24.3,14.9-50.8,26.2-76.2,39.1c-26.6,13.5-53.1,27.1-83.4,42.5c11.4,7.5,18.8,12.3,26.2,17.1c66.3,43.4,131.7,88.4,199.5,129.5   c24.1,14.7,38.2,29.9,37.6,54.7c-17.9,9.3-30.2,28.1-30.2,49.7c0,30.9,25.1,56,56,56s56-25.1,56-56   C653,384.3,642.7,366.9,627.3,356.9z M624,419.3c-2.2,3.8-5.1,7.1-8.7,9.7c-5.1,3.8-11.5,6-18.3,6c-17.1,0-31-13.9-31-31   c0-5.6,1.5-10.8,4-15.3c5.3-9.4,15.4-15.7,27-15.7c12.7,0,23.6,7.6,28.4,18.6c1.7,3.8,2.6,8,2.6,12.4   C628,409.6,626.5,414.8,624,419.3z">
                      </path>
                    </g>
                </g>
              </svg>
            </button>
          </div> */}
          {/* Floating New Chat Button INSIDE sidebar */}
          <div className="absolute bottom-4 right-7 z-40">
            <button
              className="bg-green-500 hover:bg-green-600 text-bold text-black rounded-full shadow-lg p-3 flex items-center justify-center transition-all duration-200"
              onClick={() => setShowNewChatModal(true)}
              title="New Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-plus-icon lucide-message-square-plus"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>
            </button>
          </div>
          {/* Drag handle for resizing */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 right-0 h-full w-5  cursor-ew-resize z-50 transition-colors"
            style={{ userSelect: "none" }}
          />
        </aside>
        {contextMenu.visible && contextMenu.user && (
          <div
            className="fixed z-50 bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[180px] py-2 select-none"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.user._id !== 'ai-bot' && (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={async () => { await handleMarkAsUnread(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><CheckSquare className="w-4 h-4" /> Mark as unread</button>
            )}
            {isUserPinned(contextMenu.user._id) ? (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleUnpin(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Pin className="w-4 h-4"  /> Unpin</button>
            ) : (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handlePinToTop(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Pin className="w-4 h-4"  /> Pin to top</button>
            )}
            {isFavorite(contextMenu.user._id) ? (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { removeFavorite(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Heart className="w-4 h-4" /> Remove from favorites</button>
            ) : (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleAddToFavorites(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Heart className="w-4 h-4" /> Add to favorites</button>
            )}
            {isArchived(contextMenu.user._id) ? (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleUnarchive(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Archive className="w-4 h-4" /> Unarchive</button>
            ) : (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleArchive(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Archive className="w-4 h-4" /> Archive</button>
            )}
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-yellow-600 hover:bg-base-200" onClick={() => { handleClearMessages(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Paintbrush className="w-4 h-4" /> Clear messages</button>
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-base-200" onClick={() => handleDeleteClick(contextMenu.user)}><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        )}
        {callContextMenu.visible && (
          <div
            ref={callContextMenuRef}
            className="fixed z-50 bg-white border border-zinc-200 rounded shadow-lg py-1 px-2"
            style={{ top: callContextMenu.y, left: callContextMenu.x }}
          >
            {callContextMenu.call && (() => {
              const user = callContextMenu.call.receiver || callContextMenu.call.caller || {};
              return isFavorite(user._id)
                ? <div
                    className="px-4 py-2 hover:bg-zinc-100 cursor-pointer"
                    onClick={() => { removeFavorite(user._id); setCallContextMenu({ ...callContextMenu, visible: false }); }}
                  >Remove from Favorites</div>
                : <div
                    className="px-4 py-2 hover:bg-zinc-100 cursor-pointer"
                    onClick={() => { handleAddToFavorites(user._id); setCallContextMenu({ ...callContextMenu, visible: false }); }}
                  >Add to Favorites</div>
            })()}
          </div>
        )}
        {/* New Chat Modal */}
        {showNewChatModal && (
          <UserSelectModal
            onClose={() => setShowNewChatModal(false)}
            onSelectUser={(user) => {
              setSelectedUser(user);
              setShowNewChatModal(false);
              // Unhide user when starting a new chat
              setHiddenUserIds((prev) => {
                const updated = prev.filter(id => id !== user._id);
                localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
                getUsers(false); // Refresh user list
                return updated;
              });
            }}
            users={users}
          />
        )}
        <ConfirmModal
          open={showConfirm}
          title={`Delete the user "${userToDelete?.fullName || ''}"?`}
          message="Messages will be removed from all your devices."
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="hidden lg:flex flex-col h-full bg-base-100 border-r border-base-200 select-none"
      style={{ width: sidebarWidth }}
    >
      {/* ... header, search, etc ... */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          {/* Place the main user/chat list here. Find the main mapping over users/calls and move it inside this viewport. */}
          {/* ... user/call list rendering ... */}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex bg-transparent p-1 select-none touch-none w-0 data-[state=hidden]:opacity-20 transition-opacity duration-300"
        >
          <ScrollArea.Thumb className="bg-border relative flex-1 rounded-full" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
      {/* ... footer, resize handle, etc ... */}
    </div>
  );
}