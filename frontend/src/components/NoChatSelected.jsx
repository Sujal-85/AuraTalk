import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { MessageSquare, Image as ImageIcon, Video as VideoIcon, File, Paintbrush, Trash2, PanelTopOpen, Archive, Star, Pin, Heart, CheckSquare, X, MessageCirclePlus, Phone, RefreshCw, SkipBackIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import UserSelectModal from "./UserSelectModal";
import AIChatModal from "./AIChatModal";
import DOMPurify from 'dompurify';

// E2EE helpers (copy from useChatStore.js)
async function fetchUserPublicKey(userId) {
  const res = await axiosInstance.get(`/auth/public-key/${userId}`);
  return res.data.publicKey;
}
async function importPublicKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}
async function importPrivateKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}
async function deriveSharedSecret(privateKey, publicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function decryptMessage(ciphertext, sharedSecret) {
  try {
    const [ivB64, ctB64] = ciphertext.split(":");
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    const dec = new TextDecoder();
    const plain = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedSecret,
      ct
    );
    return dec.decode(plain);
  } catch (e) {
    return '[Unable to decrypt]';
  }
}
async function getPrivateKey(userId) {
  const keypair = JSON.parse(localStorage.getItem(`ecc-keypair-${userId}`));
  if (!keypair || !keypair.privateKey) return null;
  return await importPrivateKey(keypair.privateKey);
}

function formatLastMessageDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();

  // Remove time for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diff = (today - messageDay) / (1000 * 60 * 60 * 24);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  // Format as DD/MM/YYYY
  return date.toLocaleDateString("en-GB");
}

const NoChatSelected = () => {
  // All hooks must be at the top, before any return
  const {
    getUsers,
    users,
    archivedUsers,
    archiveUser,
    unarchiveUser,
    setSelectedUser,
    isUsersLoading,
    deleteChat,
    pinUser,
    unpinUser,
    isUserPinned,
    addFavorite,
    removeFavorite,
    favorites,
    aiMessages,
    handleCall,
    isFavorite,
    messages,
    selectedUser,
    invitations,
    acceptedPeers,
    loadAcceptedPeers,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { theme } = useThemeStore();
  const [search, setSearch] = useState("");
  const firstLoad = useRef(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, user: null });
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatDismissed, setNewChatDismissed] = useState(() => {
    try {
      return localStorage.getItem('newChatDismissed') === '1';
    } catch { return false; }
  });
  const [hiddenUserIds, setHiddenUserIds] = useState(() => {
    const stored = localStorage.getItem('hiddenUserIds');
    return stored ? JSON.parse(stored) : [];
  });
  const [showArchivePage, setShowArchivePage] = useState(false);
  const [archiveContextMenu, setArchiveContextMenu] = useState({ visible: false, x: 0, y: 0, user: null });
  const archiveMenuRef = useRef(null);
  const [showAIChatModal, setShowAIChatModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [mainTab, setMainTab] = useState("chats"); // 'chats' | 'updates' | 'calls'
  const location = useLocation();
  const [callHistory, setCallHistory] = useState([]);
  const [isCallHistoryLoading, setIsCallHistoryLoading] = useState(false);
  const contextMenuRef = useRef(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const longPressTimeout = useRef(null);
  const { authUser: storeAuthUser } = useAuthStore();
  const [decryptedLastMessages, setDecryptedLastMessages] = useState({});
  const { selectedUser: storeSelectedUser } = useChatStore();

  // Check if user is new and has no invitations
  useEffect(() => { try { loadAcceptedPeers(); } catch {} }, [loadAcceptedPeers]);
  const isNewUserWithNoInvitations = useMemo(() => {
    // Hide all users until at least one peer is accepted for chatting
    const hasAnyPeer = Array.isArray(acceptedPeers) && acceptedPeers.length > 0;
    return authUser && !hasAnyPeer;
  }, [authUser, acceptedPeers]);

  // Auto-open UserSelectModal for new users with no invitations (once, unless user dismisses)
  useEffect(() => {
    if (isNewUserWithNoInvitations && !showNewChatModal && !newChatDismissed) {
      setShowNewChatModal(true);
    }
  }, [isNewUserWithNoInvitations, showNewChatModal, newChatDismissed]);

  // Reset dismissal when user gains any accepted peers
  useEffect(() => {
    if (Array.isArray(acceptedPeers) && acceptedPeers.length > 0 && newChatDismissed) {
      try { localStorage.removeItem('newChatDismissed'); } catch {}
      setNewChatDismissed(false);
    }
  }, [acceptedPeers, newChatDismissed]);

  useEffect(() => {
    if (firstLoad.current) {
      getUsers();
      firstLoad.current = false;
    }
    const interval = setInterval(() => {
      getUsers(false); // pass false to not set loading
    }, 1000);
    return () => clearInterval(interval);
  }, [getUsers]);

  // Listen for ?tab=calls|updates|chats to control internal tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'calls' || tab === 'updates' || tab === 'chats') {
      setMainTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    if (!window.socket || !onlineUsers) return;

    const handleNewMessage = (message) => {
      const authUser = JSON.parse(localStorage.getItem('authUser'));
      const otherUserId = message.senderId === authUser?._id ? message.recipientId : message.senderId;
      if (hiddenUserIds.includes(otherUserId)) {
        setHiddenUserIds((prev) => {
          const updated = prev.filter(id => id !== otherUserId);
          localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
          return updated;
        });
      }
    };

    window.socket.on('newMessage', handleNewMessage);
    return () => window.socket.off('newMessage', handleNewMessage);
  }, [hiddenUserIds, onlineUsers]);

  useEffect(() => {
    if (!archiveContextMenu.visible) return;
    const handleClick = (e) => {
      if (archiveMenuRef.current && !archiveMenuRef.current.contains(e.target)) {
        setArchiveContextMenu((cm) => ({ ...cm, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      if (archiveMenuRef.current) {
        document.removeEventListener('mousedown', handleClick);
      }
    };
  }, [archiveContextMenu.visible]);

  useEffect(() => {
    if (mainTab === 'calls') {
      setIsCallHistoryLoading(true);
      axiosInstance.get('/calls')
        .then(res => setCallHistory(Array.isArray(res.data) ? res.data : []))
        .catch(() => setCallHistory([]))
        .finally(() => setIsCallHistoryLoading(false));
    }
  }, [mainTab]);

  useEffect(() => {
    if (contextMenu.visible && contextMenuRef.current) {
      const menu = contextMenuRef.current;
      const rect = menu.getBoundingClientRect();
      let newX = contextMenu.x;
      let newY = contextMenu.y;
      if (rect.right > window.innerWidth) {
        newX = window.innerWidth - rect.width - 8;
      }
      if (rect.bottom > window.innerHeight) {
        newY = window.innerHeight - rect.height - 8;
      }
      if (newX !== contextMenu.x || newY !== contextMenu.y) {
        setContextMenu(cm => ({ ...cm, x: newX, y: newY }));
      }
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleScroll = () => setContextMenu(cm => ({ ...cm, visible: false }));
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu.visible]);

  useEffect(() => {
    if (showArchivePage) {
      setContextMenu((m) => ({ ...m, visible: false }));
    }
  }, [showArchivePage]);

  // Decrypt last messages for all users (like Sidebar)
  useEffect(() => {
    async function decryptAllLastMessages() {
      if (!authUser) return;
      const newDecrypted = {};
      for (const user of users) {
        const lastMsg = user.lastMessage;
        // For all types, try to decrypt if content is a string and looks encrypted
        const msgText = lastMsg?.text ?? lastMsg?.content;
        if (
          lastMsg &&
          typeof msgText === 'string' &&
          msgText.includes(':') &&
          ['text', 'image', 'video', 'audio', 'document'].includes(lastMsg.type)
        ) {
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
            newDecrypted[user._id] = /^[\x20-\x7E]+$/.test(msgText) ? msgText : '[Unable to decrypt]';
          }
        } else if (lastMsg && typeof msgText === 'string') {
          newDecrypted[user._id] = msgText;
        }
      }
      setDecryptedLastMessages(newDecrypted);
    }
    decryptAllLastMessages();
    // eslint-disable-next-line
  }, [users, authUser]);

  // Helper to get the last message for the selected user from the messages array
  function getLastMessageForSelectedUser() {
    if (!selectedUser) return null;
    const relevantMessages = messages.filter(
      m => (m.senderId === selectedUser._id || m.recipientId === selectedUser._id)
    );
    if (relevantMessages.length === 0) return null;
    // Sort by createdAt descending
    const sorted = [...relevantMessages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted[0];
  }

  if (isUsersLoading) return <div className="flex justify-center items-center h-full">Loading...</div>;

  // Filter and sort users for mobile
  const baseUsers = isNewUserWithNoInvitations ? [] : users;
  // Show only users with accepted invitations
  const acceptedOnlyUsers = Array.isArray(acceptedPeers) && acceptedPeers.length > 0
    ? baseUsers.filter(user => acceptedPeers.includes(user._id))
    : baseUsers;
  const filteredUsers = search.trim()
    ? acceptedOnlyUsers.filter(user => user.fullName.toLowerCase().includes(search.toLowerCase()))
    : acceptedOnlyUsers;

  // Filter out hidden users
  let visibleUsers = filteredUsers.filter(user => !hiddenUserIds.includes(user._id));

  // Apply tab filtering
  if (activeTab === "unread") {
    visibleUsers = visibleUsers.filter(user => user.unreadCount > 0);
  } else if (activeTab === "favourites") {
    visibleUsers = visibleUsers.filter(user => favorites.includes(user._id));
  }

  const sortedUsers = [...visibleUsers].sort((a, b) => {
    const aOnline = onlineUsers.includes(a._id);
    const bOnline = onlineUsers.includes(b._id);
    if (aOnline === bOnline) return 0;
    return aOnline ? -1 : 1;
  });

  const handleClearMessages = async (userId) => {
    if (window.confirm("Are you sure you want to clear all messages with this user? This cannot be undone.")) {
      await deleteChat(userId);
    }
  };

  const handleMarkAsUnread = async (userId) => {
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
    pinUser(userId);
    getUsers(false);
  };

  const handleUnpin = (userId) => {
    unpinUser(userId);
    getUsers(false);
  };

  const handleAddToFavorites = (userId) => {
    addFavorite(userId);
    toast.success("Added to favorites");
  };

  const handleArchive = (userId) => {
    archiveUser(userId);
    toast.success("Chat archived");
  };

  const handleDeleteChat = (userId) => {
    setHiddenUserIds((prev) => {
      const updated = [...prev, userId];
      localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
      toast.success('User deleted!', { id: 'user-deleted' });
      return updated;
    });
    // Optionally, close chat if open (not needed in NoChatSelected)
  };

  const archivedUnreadCount = archivedUsers ? archivedUsers.filter(u => u.unreadCount > 0).length : 0;

  // When rendering the user list, get last message and time for AI bot
  const getLastMessageForUser = (user) => {
    if (user._id === 'ai-bot') {
      if (aiMessages && aiMessages.length > 0) {
        const lastMsg = aiMessages[aiMessages.length - 1];
        return {
          content: lastMsg.text,
          createdAt: lastMsg.createdAt,
          type: lastMsg.type || 'text',
        };
      }
      return null;
    }
    return user.lastMessage || null;
  };

  // Editing bar actions (example: delete, archive, pin)
  const handleDeleteSelected = () => {
    // Implement delete logic for selectedUsers
    setSelectedUsers([]);
  };
  const handleArchiveSelected = () => {
    // Implement archive logic for selectedUsers
    setSelectedUsers([]);
  };
  const handlePinSelected = () => {
    // Implement pin logic for selectedUsers
    setSelectedUsers([]);
  };

  return (
    <>
      {/* Mobile: User List */}
      {mainTab === 'chats' && (
        <div className="block lg:hidden w-full flex flex-1 flex-col items-center justify-start  overflow-y-auto select-none pb-28" data-theme={theme}>
          <div className="max-w-lg w-full">
            {/* Mobile search bar */}
            {!showArchivePage && (
              <div className="block lg:hidden px-0 pt-0 pb-3">
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
                {/* Mobile action buttons aligned with desktop style */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="w-full bg-green-500 hover:bg-green-600 text-black px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                    onClick={() => setShowNewChatModal(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-plus"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>
                    Add Users
                  </button>
                  <button
                    className="w-full bg-base-300 hover:bg-base-400 text-base-content px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                    onClick={() => setSelectedUser({ _id: 'ai-bot', fullName: 'Aura AI', profilePic: '/aura-logo.png', isAIBot: true })}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    AI Chat
                  </button>
                </div>
              </div>
            )}

            {/* Tab buttons for All, Unread, Favourites (mobile only, above archive bar) */}
            {!showArchivePage && (
              <div className="flex gap-2 mb-4">
                <button
                  className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "all" ? "bg-green-200 text-zinc-900 " : "bg-transparent text-gray-700 "}`}
                  onClick={() => { setActiveTab("all"); setContextMenu((m) => ({ ...m, visible: false })); }}
                >
                  All
                </button>
                <button
                  className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "unread" ? "bg-green-200 text-zinc-900 " : "bg-transparent text-gray-700 "}`}
                  onClick={() => { setActiveTab("unread"); setContextMenu((m) => ({ ...m, visible: false })); }}
                >
                  Unread
                </button>
                <button
                  className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "favourites" ? "bg-green-200 text-zinc-900" : "bg-transparent text-gray-700 "}`}
                  onClick={() => { setActiveTab("favourites"); setContextMenu((m) => ({ ...m, visible: false })); }}
                >
                  Favourites
                </button>
                {/* <button
                  className={`px-4 py-1 rounded-full border border-gray-800  transition font-medium ${activeTab === "archive" ? "bg-green-300 text-green-800 " : " text-gray-700"}`}
                  onClick={() => { setActiveTab("archive"); setContextMenu((m) => ({ ...m, visible: false })); }}
                >
                  Archive
                </button> */}
              </div>
            )}
            {/* Archive Bar (now below search bar) */}
            {!showArchivePage && (
              <div className="w-full flex items-center gap-2 px-4 py-2 bg-base-200 rounded-lg mb-4 cursor-pointer hover:bg-base-300 transition" onClick={() => setShowArchivePage(true)}>
                <PanelTopOpen className="w-5 h-5 text-zinc-500" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Archived</span>
                {archivedUnreadCount > 0 && (
                  <span className="ml-auto bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-full px-2 py-0.5 text-xs font-bold">{archivedUnreadCount}</span>
                )}
              </div>
            )}


            {/* Main User List or Archive Page */}
            {showArchivePage ? (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-4">
                  <button className="text-zinc-500 hover:text-zinc-800" onClick={() => { setShowArchivePage(false); setContextMenu((m) => ({ ...m, visible: false })); }}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button>
                  <h2 className="text-lg font-bold flex items-center gap-2"><PanelTopOpen className="w-5 h-5" /> Archived</h2>
                </div>
                <div className="text-center text-base text-sm text-zinc-400 mb-4">
                  These chats stay archived when new messages are received.
                </div>
                {archivedUsers?.length === 0 ? (
                  <div className="text-center text-zinc-400">No archived chats</div>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {archivedUsers.map(user => (
                      <li
                        key={user._id}
                        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-base-200 rounded-lg transition relative"
                        onClick={() => { setSelectedUser(user); setShowArchivePage(false); }}
                        onContextMenu={e => {
                          e.preventDefault();
                          setArchiveContextMenu({ visible: true, x: e.clientX, y: e.clientY, user });
                        }}
                        onTouchStart={e => {
                          // Long press for mobile
                          const timeout = setTimeout(() => {
                            setArchiveContextMenu({ visible: true, x: e.touches[0].clientX, y: e.touches[0].clientY, user });
                          }, 600);
                          const clear = () => clearTimeout(timeout);
                          e.target.addEventListener('touchend', clear, { once: true });
                          e.target.addEventListener('touchmove', clear, { once: true });
                        }}
                      >
                        <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex justify-between items-center w-full">
                            <span className="font-medium truncate">{user.fullName}</span>
                            <span className="flex flex-col items-end gap-1 min-w-[40px]">
                              <span className="text-xs text-zinc-400">
                                {getLastMessageForUser(user)?.createdAt ? formatLastMessageDate(getLastMessageForUser(user).createdAt) : ""}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                            <span className="truncate w-0 flex-1 text-left">
                              {getLastMessageForUser(user) ? (
                                getLastMessageForUser(user).content === "this message is deleted" ? (
                                  <span className="italic text-gray-500">This message is deleted</span>
                                ) : getLastMessageForUser(user).type === "image" ? (<><ImageIcon className="w-4 h-4 inline mr-1" /> Image</>)
                                  : getLastMessageForUser(user).type === "video" ? (<><VideoIcon className="w-4 h-4 inline mr-1" /> Video</>)
                                  : getLastMessageForUser(user).type === "audio" ? (<><File className="w-4 h-4 inline mr-1" /> Audio</>)
                                  : getLastMessageForUser(user).type === "document" ? (<><File className="w-4 h-4 inline mr-1" /> Document</>)
                                  : getLastMessageForUser(user).type === "text" ? (
                                    <div
                                      className="truncate"
                                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getLastMessageForUser(user).content) }}
                                    />
                                  ) : getLastMessageForUser(user).content
                              ) : ""}
                            </span>
                            {user.unreadCount > 0 && (
                              <span className="ml-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow">
                                {user.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Archive Context Menu */}
                {archiveContextMenu.visible && archiveContextMenu.user && (
                  <div
                    ref={archiveMenuRef}
                    className="fixed z-50 bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[100px] py-2 select-none"
                    style={{ top: archiveContextMenu.y, left: archiveContextMenu.x }}
                    onClick={() => setArchiveContextMenu({ ...archiveContextMenu, visible: false })}
                  >
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={e => { e.stopPropagation(); unarchiveUser(archiveContextMenu.user._id); setArchiveContextMenu({ ...archiveContextMenu, visible: false }); }}><PanelTopOpen className="w-4 h-4" /> Unarchive</button>
                  </div>
                )}
              </div>
            ) : (
              sortedUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => setSelectedUser(user)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200 transition-colors rounded-lg mb-2"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user });
                  }}
                >
                  <div className="relative">
                    <img
                      src={user._id === 'ai-bot' ? '/aura-logo.png' : (user.profilePic || '/avatar.png')}
                      alt={user.fullName}
                      className="size-10 object-cover rounded-full"
                      onError={e => {
                        if (user._id !== 'ai-bot') {
                          e.target.onerror = null;
                          e.target.src = '/avatar.png';
                        }
                      }}
                    />
                    {onlineUsers.includes(user._id) && (
                      <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-white" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium truncate">{user.fullName}</span>
                      <span className="flex flex-col items-end gap-1 min-w-[40px]">
                        <span className="text-xs text-zinc-400">
                          {getLastMessageForUser(user)?.createdAt ? formatLastMessageDate(getLastMessageForUser(user).createdAt) : ""}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                      <span className="truncate w-0 flex-1 text-left">
                        {getLastMessageForUser(user) ? (
                          getLastMessageForUser(user).content === "this message is deleted" ? (
                            <span className="italic text-gray-500">This message is deleted</span>
                          ) : getLastMessageForUser(user).type === "image" ? (<><ImageIcon className="w-4 h-4 inline mr-1" /> Image</>)
                            : getLastMessageForUser(user).type === "video" ? (<><VideoIcon className="w-4 h-4 inline mr-1" /> Video</>)
                            : getLastMessageForUser(user).type === "audio" ? (<><File className="w-4 h-4 inline mr-1" /> Audio</>)
                            : getLastMessageForUser(user).type === "document" ? (<><File className="w-4 h-4 inline mr-1" /> Document</>)
                            : getLastMessageForUser(user).type === "text" ? (
                              <div
                                className="truncate"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(decryptedLastMessages[user._id] ?? getLastMessageForUser(user).content) }}
                              />
                            ) : (decryptedLastMessages[user._id] ?? getLastMessageForUser(user).content)
                        ) : ""}
                      </span>
                      {user.unreadCount > 0 && (
                        <span className="ml-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow">
                          {user.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
            {sortedUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-4">
                {isNewUserWithNoInvitations ? "User not added - Start by adding users to begin chatting" : "No users found"}
              </div>
            )}
          </div>
        </div>
      )}
      {mainTab === 'updates' && (
        <div className="block lg:hidden w-full flex flex-1 flex-col bg-base-100/50 select-none">
          {/* Header with back button */}
          <div className="flex items-center gap-3 px-4 pt-6 pb-4">
            <button 
              onClick={() => setMainTab('chats')}
              className="p-2 hover:bg-base-200 rounded-full transition-colors"
              title="Back to Chats"
            >
              <svg className="w-6 h-6 text-base-content" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-base-content">Updates</h1>
          </div>
          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-zinc-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-2" />
            <div className="text-lg font-semibold mb-1">Updates</div>
            <div className="text-sm">Status and news will appear here.</div>
          </div>
        </div>
      )}
      {mainTab === 'calls' && (
        <div className="block lg:hidden w-full flex flex-col min-h-screen bg-base-100/50 text-base-content">
          {/* Header with back button */}
          <div className="px-4 pt-6 pb-2 text-base-content">
            <div className="flex items-center gap-3 mb-2">
              <button 
                onClick={() => setMainTab('chats')}
                className="p-2 hover:bg-base-200 rounded-full transition-colors"
                title="Back to Chats"
              >
                <svg className="w-6 h-6 text-base-content" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="text-3xl font-extrabold text-base-content">Calls</div>
            </div>
            <div className="text-xl font-bold text-base-content mt-2 mb-2 ml-12">Recent</div>
          </div>
          {/* Scrollable Calls List */}
          <div className="flex-1 min-h-0 flex flex-col">
            {selectedUsers.length > 0 && (
              <div className="fixed top-0 left-0 w-full z-50 flex items-center bg-base-200 border-b border-base-300 px-2 py-2 shadow-lg">
                <span className="font-bold text-lg mr-4">{selectedUsers.length}</span>
                <button className="p-2" onClick={handlePinSelected} title="Pin">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 3v12"/><path d="M18 3v12"/><path d="M6 15l6 6 6-6"/></svg>
                </button>
                <button className="p-2" onClick={handleArchiveSelected} title="Archive">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/></svg>
                </button>
                <button className="p-2" onClick={handleDeleteSelected} title="Delete">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
                <button className="ml-auto p-2" onClick={() => setSelectedUsers([])} title="Cancel">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}
            <ul className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto px-2 pb-28 ">
              {(Array.isArray(callHistory) ? callHistory : []).map(call => {
                const user = call.receiver || call.caller || {};
                const isMissed = call.status === "missed";
                const isOutgoing = call.direction === "outgoing";
                const callType = call.type === "video" ? "video" : "voice";
                const directionIcon = isOutgoing
                  ? <svg className="w-4 h-4 mr-1 inline-block" fill="none" stroke="#25D366" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  : <svg className="w-4 h-4 mr-1 inline-block" fill="none" stroke={isMissed ? '#F44336' : '#25D366'} strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
                const date = new Date(call.startedAt);
                const now = new Date();
                let timeStr = '';
                if (date.toDateString() === now.toDateString()) {
                  timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                } else {
                  const yesterday = new Date(now);
                  yesterday.setDate(now.getDate() - 1);
                  if (date.toDateString() === yesterday.toDateString()) {
                    timeStr = `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                  } else {
                    timeStr = `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                  }
                }
                const callIcon = (
                  <button
                    className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 group"
                    title="Voice Call"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setTimeout(() => handleCall(false), 0);
                    }}
                  >
                    <svg className="w-6 h-6 text-base-content/70 group-hover:text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92V19a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3 5.18 2 2 0 0 1 5 3h2.09a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 0 1-.45 2.11l-.27.27a16 16 0 0 0 6.29 6.29l.27-.27a2 2 0 0 1 2.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0 1 22 16.92z" /></svg>
                  </button>
                );
                const videoIcon = (
                  <button
                    className="p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 group"
                    title="Video Call"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setTimeout(() => handleCall(true), 0);
                    }}
                  >
                    <svg className="w-6 h-6 text-base-content/70 group-hover:text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="2" /><path d="M17 9l4 2v2l-4 2V9z" /></svg>
                  </button>
                );
                return (
                  <li
                    key={call._id}
                    className={`flex items-center gap-3 py-2 px-2  rounded-lg hover:bg-base-200 transition ${selectedUsers.includes(user._id) ? 'bg-green-900/30' : ''}`}
                    onTouchStart={e => {
                      if (selectedUsers.length === 0) {
                        longPressTimeout.current = setTimeout(() => {
                          setSelectedUsers([user._id]);
                        }, 600); // 600ms for long press
                      }
                    }}
                    onTouchEnd={e => {
                      clearTimeout(longPressTimeout.current);
                    }}
                    onClick={() => {
                      if (selectedUsers.length > 0) {
                        setSelectedUsers(sel =>
                          sel.includes(user._id)
                            ? sel.filter(id => id !== user._id)
                            : [...sel, user._id]
                        );
                      }
                    }}
                  >
                    <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left ">
                      <div className="flex items-center gap-2 font-semibold text-lg text-base-content truncate">
                        {directionIcon}
                        <span className={`truncate max-w-[200px] sm:max-w-[280px] ${isMissed ? 'text-red-500' : 'text-base-content'}`}>{user.fullName || 'Unknown'}</span>
                      </div>
                      <div className="text-sm text-base-content/70">{timeStr}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {callType === 'video' ? videoIcon : callIcon}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* Removed: Encryption message bar from Calls tab */}
        </div>
      )}
      {/* Chats tab encryption message at bottom (mobile) */}
      {mainTab === 'chats' && (
        <div className="block lg:hidden w-full text-center text-xs text-zinc-400 py-2 fixed bottom-0 left-0 bg-base-100 border-t border-base-300 z-30">
          <span className="inline-flex items-center gap-1"><svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Your personal calls are <span className="text-green-500 font-semibold">end-to-end encrypted</span></span>
        </div>
      )}
      {/* Desktop: Welcome */}
      <div className="hidden lg:flex w-full h-full min-h-[calc(100vh-4rem)] flex-1 flex-col items-center justify-center bg-base-100/50 select-none relative z-10" data-theme={theme}>
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center gap-4 mb-4">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-bounce"
              >
                <MessageSquare className="w-8 h-8 text-primary " />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold">
            {isNewUserWithNoInvitations ? "User not added" : "Welcome to AuraTalk✨"}
          </h2>
          <p className="text-base-content/60">
            {isNewUserWithNoInvitations 
              ? "Start by adding users to begin chatting" 
              : "Select a conversation from the sidebar to start chatting"
            }
          </p>
          {/* Desktop Action Buttons */}
          <div className="flex flex-col gap-3 mt-6">
            <button
              className="bg-green-500 hover:bg-green-600 text-black px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              onClick={() => setShowNewChatModal(true)}
            >
              <MessageCirclePlus className="w-5 h-5" />
              {isNewUserWithNoInvitations ? "Add Users" : "New Chat"}
            </button>
            <button
              className="bg-base-300 hover:bg-base-400 text-base-content px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              onClick={() => setShowAIChatModal(true)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              AI Chat
            </button>
          </div>
        </div>
      </div>
      {contextMenu.visible && contextMenu.user && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[180px] py-2 select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200"
            onClick={() => {
              if (isFavorite(contextMenu.user._id)) {
                removeFavorite(contextMenu.user._id);
              } else {
                addFavorite(contextMenu.user);
              }
              setContextMenu(cm => ({ ...cm, visible: false }));
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {isFavorite(contextMenu.user._id) ? 'Remove from Favourites' : 'Add to Favourites'}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200"
            onClick={() => {
              setSelectedUsers(sel => sel.includes(contextMenu.user._id) ? sel : [...sel, contextMenu.user._id]);
              setContextMenu(cm => ({ ...cm, visible: false }));
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
            Select
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={async () => { await handleMarkAsUnread(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><CheckSquare className="w-4 h-4" /> Mark as unread</button>
          {isUserPinned(contextMenu.user._id) ? (
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleUnpin(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Pin className="w-4 h-4"  /> Unpin</button>
          ) : (
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handlePinToTop(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Pin className="w-4 h-4" /> Pin to top</button>
          )}
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleAddToFavorites(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Heart className="w-4 h-4" /> Add to favorites</button>
          {/* Hide Archive and Delete for AI bot */}
          {contextMenu.user._id !== 'ai-bot' && (
            <>
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" onClick={() => { handleArchive(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Archive className="w-4 h-4" /> Archive</button>
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-yellow-600 hover:bg-base-200" onClick={() => { handleClearMessages(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Paintbrush className="w-4 h-4" /> Clear messages</button>
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-base-200" onClick={() => { handleDeleteChat(contextMenu.user._id); setContextMenu({ ...contextMenu, visible: false }); }}><Trash2 className="w-4 h-4" /> Delete</button>
            </>
          )}
        </div>
      )}
      {/* Floating AI Chat Button - only on mobile */}
      {mainTab !== 'calls' && (
        <div className="fixed bottom-36 right-5 z-50 block lg:hidden w-20 h-20 rounded-full ">
          <button
            className="rounded-full shadow-lg mt-1 w-full h-full flex items-center justify-center transition-all duration-200"
            onClick={() => setSelectedUser({
              _id: 'ai-bot',
              fullName: 'Aura AI',
              profilePic: '/aura-logo.png',
              isAIBot: true
            })}
            title="AI Chat"
          >
            {/* Use the same SVG as in the sidebar */}
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
        </div>
      )}
      {/* Floating New Chat Button - only on mobile */}
      <div className="fixed bottom-20 right-8 z-50 block lg:hidden">
        <button
          className="bg-green-500 hover:bg-green-600 text-black rounded-full shadow-lg p-4 flex items-center justify-center transition-all duration-200"
          onClick={() => setShowNewChatModal(true)}
          title="New Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-plus-icon lucide-message-square-plus"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>
        </button>
      </div>
      {showNewChatModal && (
        <UserSelectModal
          onClose={() => {
            setShowNewChatModal(false);
            setNewChatDismissed(true);
            try { localStorage.setItem('newChatDismissed', '1'); } catch {}
          }}
          onSelectUser={(user) => {
            setSelectedUser(user);
            setShowNewChatModal(false);
            setHiddenUserIds((prev) => {
              const updated = prev.filter(id => id !== user._id);
              localStorage.setItem('hiddenUserIds', JSON.stringify(updated));
              return updated;
            });
          }}
          users={users}
        />
      )}
      {showAIChatModal && (
        <AIChatModal onClose={() => setShowAIChatModal(false)} />
      )}
      {/* Fixed bottom tab bar for mobile
      <div className="block lg:hidden fixed bottom-0 left-0 w-full bg-base-200 border-t border-base-300 flex justify-around items-center h-16 z-50">
        <button
          className={`flex flex-col items-center justify-center flex-1 h-full ${mainTab === 'chats' ? ' text-base-content bg-primary' : 'text-zinc-400'}`}
          onClick={() => setMainTab('chats')}
        >
          <MessageSquare className="w-7 h-7 mx-auto" />
          <span className="text-xs font-semibold">Chats</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center flex-1 h-full ${mainTab === 'updates' ? ' text-base-content bg-primary' : 'text-zinc-400'}`}
          onClick={() => setMainTab('updates')}
        >
          <RefreshCw className="w-7 h-7 mx-auto" />
          <span className="text-xs font-semibold">Updates</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center flex-1 h-full text-base-content ${mainTab === 'calls' ? ' text-base-content bg-primary' : 'text-zinc-400'}`}
          onClick={() => setMainTab('calls')}
        >
          <Phone className="w-7 h-7 mx-auto" />
          <span className="text-xs font-semibold">Calls</span>
        </button>
      </div> */}
    </>
  );
};

export default NoChatSelected;