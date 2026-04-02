import { create } from "zustand";
import { persist } from "zustand/middleware";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { v4 as uuidv4 } from "uuid"; // Import UUID for unique call IDs

// Safe storage wrapper to prevent crashes when localStorage quota is exceeded
const safeStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name) ?? sessionStorage.getItem(name);
    } catch {
      try { return sessionStorage.getItem(name); } catch { return null; }
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('[persist] LocalStorage quota exceeded for', name, '- falling back to sessionStorage');
        try { sessionStorage.setItem(name, value); } catch {}
      } else {
        console.warn('[persist] setItem error for', name, e);
      }
    }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch {}
    try { sessionStorage.removeItem(name); } catch {}
  },
};

// --- E2EE Helpers (no long-lived cache to avoid stale keys) ---
async function fetchUserPublicKey(userId) {
  // Always fetch fresh to avoid using a stale key after a contact resets keys
  const res = await axiosInstance.get(`/auth/public-key/${userId}`, {
    // Prevent intermediate caches
    headers: { 'Cache-Control': 'no-cache' },
  });
  console.log('[E2EE] Fetched public key for', userId, res.data.publicKey);
  return res.data.publicKey;
}

async function importPublicKey(jwk) {
  console.log('[E2EE] Importing public key JWK:', jwk);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

async function importPrivateKey(jwk) {
  console.log('[E2EE] Importing private key JWK:', jwk);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

async function deriveSharedSecret(privateKey, publicKey) {
  console.log('[E2EE] Deriving shared secret');
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

async function encryptMessage(plainText, sharedSecret) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedSecret,
    enc.encode(plainText)
  );
  
  // Robust Base64 conversion
  const ivB64 = btoa(String.fromCharCode.apply(null, iv));
  const ctB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(ciphertext)));
  
  const result = `${ivB64}:${ctB64}`;
  console.log('[E2EE] Encrypted text:', result);
  return result;
}

async function decryptMessage(ciphertext, sharedSecret) {
  try {
    const [ivB64, ctB64] = ciphertext.split(":");
    if (!ivB64 || !ctB64) throw new Error("Invalid ciphertext format");

    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    
    const dec = new TextDecoder();
    const plain = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedSecret,
      ct
    );
    const decoded = dec.decode(plain);
    console.log('[E2EE] Decrypted text:', decoded);
    return decoded;
  } catch (e) {
    console.error('[E2EE] Decryption error:', e, 'Ciphertext:', ciphertext);
    throw e;
  }
}

async function getPrivateKey(userId) {
  const keypair = JSON.parse(localStorage.getItem(`ecc-keypair-${userId}`));
  if (!keypair || !keypair.privateKey) return null;
  return await importPrivateKey(keypair.privateKey);
}

export const useChatStore = create(
  persist(
    (set, get) => ({
      messages: [],
      hasMoreMessages: true,
      isLoadingMore: false,
      oldestLoadedMessage: null,
      users: [],
      selectedUser: null,
      selectedGroup: null,
      groups: [],
      isUsersLoading: false,
      isMessagesLoading: false,
      isCallHistoryLoading: false,
      callLogs: [],
      pinnedUsers: [],
      acceptedPeers: [], // userIds with accepted invitations
      invitations: [], // pending invitations for auth user
      outgoingInvites: {}, // { userId: invitation }
      sharedSecrets: {}, // { userId: CryptoKey } - IN-MEMORY ONLY
      inFlightSecrets: {}, // Internal: { userId: Promise<CryptoKey> }
      archivedUsers: [],
      favorites: [],
       // Chat wallpaper settings (persisted)
       // Global wallpaper retained for backwards compatibility
       // wallpaper: { type: 'none' | 'image' | 'pattern', value: string }
       wallpaperMode: 'global', // 'global' | 'per-chat'
       wallpaper: { type: 'none', value: '' }, // global wallpaper
       perUserWallpapers: {}, // { [userId]: { type, value } }
       // Saved wallpapers library for long-term persistence
       // Each item: { id, type: 'image'|'pattern', value, label?, createdAt }
       wallpaperLibrary: [],
       // Load wallpaper prefs from backend
       loadWallpaperPrefs: async () => {
         try {
           const res = await axiosInstance.get('/auth/wallpaper-prefs');
           set({
             wallpaperMode: res.data.wallpaperMode || 'global',
             wallpaper: res.data.wallpaper || { type: 'none', value: '' },
             perUserWallpapers: res.data.perUserWallpapers || {},
             wallpaperLibrary: res.data.wallpaperLibrary || [],
           });
         } catch (e) {
           // ignore
         }
       },
       setWallpaper: async (wallpaper) => {
         set({ wallpaper });
         try { await axiosInstance.put('/auth/wallpaper-prefs', { wallpaper }); } catch {}
       },
       clearWallpaper: async () => {
         set({ wallpaper: { type: 'none', value: '' } });
         try { await axiosInstance.put('/auth/wallpaper-prefs', { wallpaper: { type: 'none', value: '' } }); } catch {}
       },
       setWallpaperMode: async (mode) => {
         set({ wallpaperMode: mode });
         try { await axiosInstance.put('/auth/wallpaper-prefs', { wallpaperMode: mode }); } catch {}
       },
       setUserWallpaper: async (userId, wallpaper) => {
         set((state) => ({ perUserWallpapers: { ...state.perUserWallpapers, [userId]: wallpaper } }));
         try {
           const perUserWallpapers = get().perUserWallpapers;
           await axiosInstance.put('/auth/wallpaper-prefs', { perUserWallpapers });
         } catch {}
       },
       clearUserWallpaper: async (userId) => {
         set((state) => {
           const next = { ...state.perUserWallpapers };
           delete next[userId];
           return { perUserWallpapers: next };
         });
         try {
           const perUserWallpapers = get().perUserWallpapers;
           await axiosInstance.put('/auth/wallpaper-prefs', { perUserWallpapers });
         } catch {}
       },
       addWallpaperToLibrary: async (item) => {
         try {
           const res = await axiosInstance.post('/auth/wallpaper-library', { item });
           set({ wallpaperLibrary: res.data.wallpaperLibrary || [] });
         } catch {}
       },
       removeWallpaperFromLibrary: async (id) => {
         try {
           const res = await axiosInstance.delete(`/auth/wallpaper-library/${id}`);
           set({ wallpaperLibrary: res.data.wallpaperLibrary || [] });
         } catch {}
       },
       renameWallpaperInLibrary: async (id, label) => {
         try {
           const res = await axiosInstance.put(`/auth/wallpaper-library/${id}`, { label });
           set({ wallpaperLibrary: res.data.wallpaperLibrary || [] });
         } catch {}
       },
       updateWallpaperInLibrary: async (id, value) => {
         try {
           const res = await axiosInstance.put(`/auth/wallpaper-library/${id}`, { value });
           set({ wallpaperLibrary: res.data.wallpaperLibrary || [] });
         } catch {}
       },
      selectedCalls: [],
      isCallSelectionMode: false,
      callState: {
        isModalOpen: false,
        isIncoming: false,
        status: "",
        error: "",
        isVideoCall: false,
        isMuted: false,
        isVideoHidden: false,
        callHasEnded: false,
        callEndedByMe: false,
        startTime: null,
        callId: null, // Add callId to track unique calls
      },
      callStartTime: null,
      localStream: null,
      remoteStream: null,
      peerConnectionRef: null,
      pendingCaller: null,
      iceCandidateBuffer: [],
      isReconnecting: false,
      iceServers: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // Note: Add valid TURN servers here for production
        ],
      },

      // --- Call Log Management ---
      getCallHistory: async (page = 1) => {
        set({ isCallHistoryLoading: true });
        try {
          const res = await axiosInstance.get(`/calls/history?page=${page}`);
          const { calls: newCalls, hasMore } = res.data;
          set(state => {
            const combined = page === 1 ? newCalls : [...state.callLogs, ...newCalls];
            // Deduplicate call logs by callId (preferring newest) or _id
            const seenIds = new Set();
            const seenCallIds = new Set();
            const uniqueCalls = combined.filter(call => {
              if (call.callId) {
                if (seenCallIds.has(call.callId)) return false;
                seenCallIds.add(call.callId);
              }
              if (call._id) {
                if (seenIds.has(call._id)) return false;
                seenIds.add(call._id);
              }
              return true;
            });
            return {
              callLogs: uniqueCalls.slice(0, 100),
              hasMoreCalls: hasMore,
              isCallHistoryLoading: false
            };
          });
        } catch (error) {
          console.error("Error fetching call history:", error);
          set({ isCallHistoryLoading: false });
          toast.error("Failed to load call history");
        }
      },

      addCallLogToBackend: async (callData) => {
        try {
          console.log("Sending call log to backend:", callData);
          const res = await axiosInstance.post("/calls", callData);
          console.log("Call log response:", res.data);
          set(state => {
            const filtered = state.callLogs.filter(log => log.callId !== callData.callId && log._id !== res.data._id);
            return {
              callLogs: [res.data, ...filtered].slice(0, 100),
            };
          });
          return res.data;
        } catch (error) {
          console.error("Failed to add call log:", error.response?.data || error.message);
          const tempLog = {
            ...callData,
            _id: `temp-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set(state => {
            const filtered = state.callLogs.filter(log => log.callId !== callData.callId);
            return {
              callLogs: [tempLog, ...filtered].slice(0, 100),
            };
          });
          return tempLog;
        }
      },

      // --- Call Selection Functions ---
      toggleCallSelection: (callId) => set((state) => ({
        selectedCalls: state.selectedCalls.includes(callId)
          ? state.selectedCalls.filter(id => id !== callId)
          : [...state.selectedCalls, callId],
      })),

      selectAllCalls: (callIds) => set({ selectedCalls: callIds }),

      clearCallSelection: () => set({ selectedCalls: [], isCallSelectionMode: false }),

      setCallSelectionMode: (mode) => set({ isCallSelectionMode: mode }),

      deleteSelectedCalls: async () => {
        const { selectedCalls } = get();
        if (selectedCalls.length === 0) return;
        try {
          await Promise.all(
            selectedCalls.map(callId => axiosInstance.delete(`/calls/${callId}`))
          );
          set(state => ({
            callLogs: state.callLogs.filter(call => !selectedCalls.includes(call._id)),
            selectedCalls: [],
            isCallSelectionMode: false,
          }));
          toast.success(`${selectedCalls.length} call log(s) deleted`);
        } catch (error) {
          console.error('Error deleting selected calls:', error);
          toast.error('Failed to delete some call logs');
        }
      },

      addFavorite: (user) => set((state) => {
        if (state.favorites.includes(user._id)) return state;
        const userExists = state.users.some(u => u._id === user._id);
        return {
          favorites: [...state.favorites, user._id],
          users: userExists ? state.users : [...state.users, user],
        };
      }),

      removeFavorite: (userId) => set((state) => ({
        favorites: state.favorites.filter(id => id !== userId),
      })),

      isFavorite: (userId) => get().favorites.includes(userId),

      isUserPinned: (userId) => get().pinnedUsers.includes(userId),

      pinUser: (userId) => set((state) => {
        if (state.pinnedUsers.includes(userId)) return state;
        const newPinned = [...state.pinnedUsers, userId];
        localStorage.setItem("pinned-users", JSON.stringify(newPinned));
        return { pinnedUsers: newPinned };
      }),

      unpinUser: (userId) => set((state) => {
        const newPinned = state.pinnedUsers.filter(id => id !== userId);
        localStorage.setItem("pinned-users", JSON.stringify(newPinned));
        return { pinnedUsers: newPinned };
      }),

      deleteChat: async (userId) => {
        try {
          await axiosInstance.delete(`/messages/chat/${userId}`);
          set((state) => ({
            messages: state.selectedUser?._id === userId ? [] : state.messages,
            users: state.users.filter(u => u._id !== userId),
            selectedUser: state.selectedUser?._id === userId ? null : state.selectedUser,
          }));
          toast.success("Chat deleted successfully");
        } catch (error) {
          console.error("Error deleting chat:", error);
          toast.error("Failed to delete chat");
        }
      },

      archiveUser: (userId) => set((state) => {
        if (userId === 'ai-bot') return state;
        const user = state.users.find(u => u._id === userId);
        if (!user) return state;
        const updatedUsers = state.users.filter(u => u._id !== userId);
        const updatedArchivedUsers = [...state.archivedUsers, user];
        const updatedSelectedUser = state.selectedUser?._id === userId ? null : state.selectedUser;
        return {
          users: updatedUsers,
          archivedUsers: updatedArchivedUsers,
          selectedUser: updatedSelectedUser,
        };
      }),

      unarchiveUser: (userId) => set((state) => {
        if (userId === 'ai-bot') return state;
        const archivedUser = state.archivedUsers.find(u => u._id === userId);
        if (!archivedUser) return state;
        const updatedArchivedUsers = state.archivedUsers.filter(u => u._id !== userId);
        const updatedUsers = [...state.users, archivedUser];
        return {
          users: updatedUsers,
          archivedUsers: updatedArchivedUsers,
        };
      }),

      isArchived: (userId) => get().archivedUsers.some(u => u._id === userId),

      getUsers: async (showLoading = true) => {
        if (showLoading) set({ isUsersLoading: true });
        if (!showLoading) {
          const cached = localStorage.getItem('chat-users');
          if (cached) set({ users: JSON.parse(cached) });
        }
        try {
          const res = await axiosInstance.get("/messages/users");
          const currentArchivedUsers = get().archivedUsers;
          const nonArchivedUsers = (res.data || []).filter(user => 
            !currentArchivedUsers.some(archivedUser => archivedUser._id === user._id)
          );
          const aiBot = {
            _id: 'ai-bot',
            fullName: 'Aura AI',
            profilePic: '/avatar.png',
            isAIBot: true,
          };
          const usersWithAI = nonArchivedUsers; // Do not inject AI into lists feeding user selection
          const pinnedUsers = get().pinnedUsers;
          const combined = [
            ...usersWithAI.filter(u => pinnedUsers.includes(u._id)),
            ...usersWithAI.filter(u => !pinnedUsers.includes(u._id)),
          ];
          
          // Stricter deduplication by _id to prevent React key warnings
          const seen = new Set();
          const sorted = combined.filter(u => {
            if (!u || !u._id || seen.has(u._id)) return false;
            seen.add(u._id);
            return true;
          });

          const prev = localStorage.getItem('chat-users');
          if (!prev || prev !== JSON.stringify(sorted)) {
            set({ users: sorted });
            localStorage.setItem('chat-users', JSON.stringify(sorted));
          }
        } catch (error) {
          const cached = localStorage.getItem('chat-users');
          if (cached) set({ users: JSON.parse(cached) });
        } finally {
          if (showLoading) set({ isUsersLoading: false });
        }
      },

      loadAcceptedPeers: async () => {
        try {
          const res = await axiosInstance.get('/invitations/accepted-peers');
          set({ acceptedPeers: res.data?.peers || [] });
        } catch {}
      },

      // --- Invitations ---
      loadInvitations: async () => {
        try {
          const res = await axiosInstance.get('/invitations/inbox');
          set({ invitations: res.data || [] });
        } catch {}
      },
      loadMyInvitations: async () => {
        try {
          const res = await axiosInstance.get('/invitations/mine');
          set({ myInvitations: res.data || [] });
        } catch {}
      },
      getInvitationStatus: async (otherUserId) => {
        try {
          const res = await axiosInstance.get(`/invitations/status/${otherUserId}`);
          return res.data.invitation || null;
        } catch { return null; }
      },
      sendInvitation: async (toUserId) => {
        try {
          // optimistic outgoing state
          const temp = { _id: `temp-${Date.now()}`, toUserId, status: 'pending', createdAt: new Date().toISOString() };
          set((state) => ({ outgoingInvites: { ...state.outgoingInvites, [toUserId]: temp } }));
          const res = await axiosInstance.post('/invitations/send', { toUserId });
          set((state) => ({ outgoingInvites: { ...state.outgoingInvites, [toUserId]: res.data } }));
          return res.data;
        } catch (e) {
          toast.error('Failed to send invitation');
          throw e;
        }
      },
      acceptInvitation: async (inviteId) => {
        try {
          const res = await axiosInstance.post(`/invitations/${inviteId}/accept`);
          const invite = res.data;
          // remove invitation from inbox
          set((state) => ({ invitations: state.invitations.filter(i => i._id !== inviteId) }));
          // optimistically add accepted peer to local list
          try {
            const peerId = String(invite.fromUserId) === String(useAuthStore.getState().authUser?._id) ? String(invite.toUserId) : String(invite.fromUserId);
            set((state) => ({ acceptedPeers: Array.from(new Set([...state.acceptedPeers, peerId])) }));
            // Ensure the user object exists in users list
            const usr = get().users.find(u => u._id === peerId);
            if (!usr) {
              // fetch that user from backend and append
              try {
                const usersRes = await axiosInstance.get('/messages/users');
                const list = Array.isArray(usersRes.data) ? usersRes.data : [];
                const found = list.find(u => u._id === peerId);
                if (found) {
                  set((state) => {
                    if (state.users.some(u => u._id === found._id)) return state;
                    return { users: [...state.users, found] };
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}
          // also refresh accepted peers from backend to be safe
          try { await get().loadAcceptedPeers(); } catch (e) {}
          toast.success('Invitation accepted');
          return invite;
        } catch (e) { toast.error('Failed to accept'); throw e; }
      },

      // Unified helper: accept an invitation and open the chat for both desktop and mobile
      acceptInvitationAndOpenChat: async (inviteId) => {
        try {
          const { acceptInvitation, loadAcceptedPeers, users, setSelectedUser, getUsers } = get();
          
          // Accept the invitation first
          const invite = await acceptInvitation(inviteId);
          console.log("Invitation accepted:", invite);
          
          // Refresh accepted peers and users
          await Promise.all([
            loadAcceptedPeers().catch(e => console.error("Failed to load accepted peers:", e)),
            getUsers(false).catch(e => console.error("Failed to get users:", e))
          ]);
          
          // Determine the peer id (other user)
          const authUser = useAuthStore.getState().authUser;
          const peerId = String(invite.fromUserId) === String(authUser?._id) ? String(invite.toUserId) : String(invite.fromUserId);
          console.log("Peer ID:", peerId);
          
          // Ensure user object exists
          let peer = get().users.find(u => u._id === peerId) || null;
          if (!peer) {
            try {
              const res = await axiosInstance.get('/messages/users');
              const list = Array.isArray(res.data) ? res.data : [];
              peer = list.find(u => u._id === peerId) || null;
              if (peer && !get().users.some(u => u._id === peer._id)) {
                set({ users: [...get().users, peer] });
              }
            } catch (e) {
              console.error("Failed to fetch user:", e);
            }
          }
          
          if (peer) {
            await setSelectedUser(peer);
            console.log("Selected user:", peer);
          } else {
            console.error("Peer not found for ID:", peerId);
          }
          
          return invite;
        } catch (error) {
          console.error("Error in acceptInvitationAndOpenChat:", error);
          toast.error("Failed to accept invitation");
          throw error;
        }
      },
      declineInvitation: async (inviteId) => {
        try {
          const res = await axiosInstance.post(`/invitations/${inviteId}/decline`);
          set((state) => ({ invitations: state.invitations.filter(i => i._id !== inviteId) }));
          toast('Invitation declined');
          return res.data;
        } catch (e) { toast.error('Failed to decline'); throw e; }
      },
      initializeInvitationSocket: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) {
          console.warn("Socket not available for invitation listeners");
          return;
        }
        
        console.log("Initializing invitation socket listeners");
        
        // Remove existing listeners to prevent duplicates
        socket.off('invitation:new');
        socket.off('invitation:accepted');
        socket.off('invitation:declined');
        socket.off('invitation:sent');
        
        socket.on('invitation:new', (inv) => {
          console.log("New invitation received:", inv);
          set((state) => ({ invitations: [inv, ...state.invitations] }));
          toast.success('New chat invitation');
          if (window.Notification && Notification.permission === 'granted') {
            const fromUserId = inv.fromUserId;
            // try to show name if available
            const from = get().users.find(u => u._id === fromUserId) || {};
            const title = `${from.fullName || 'New invitation'}`;
            const body = `${from.fullName ? 'wants to chat' : 'You have a new invitation'}`;
            new Notification(title, { body, icon: from.profilePic || '/avatar.png' });
          }
        });
        
        socket.on('invitation:sent', (inv) => {
          console.log("Invitation sent:", inv);
          // mark outgoing as sent/ pending
          const toId = inv.toUserId || inv.to;
          if (!toId) return;
          set((state) => ({ outgoingInvites: { ...state.outgoingInvites, [toId]: inv } }));
        });
        
        socket.on('invitation:accepted', (inv) => {
          console.log("Invitation accepted:", inv);
          set((state) => {
            const nextOutgoing = { ...state.outgoingInvites };
            if (inv.toUserId && nextOutgoing[inv.toUserId]) delete nextOutgoing[inv.toUserId];
            if (inv.fromUserId && nextOutgoing[inv.fromUserId]) delete nextOutgoing[inv.fromUserId];
            return { outgoingInvites: nextOutgoing };
          });
          
          // Refresh data
          try { get().loadAcceptedPeers(); } catch (e) { console.error("Failed to load accepted peers:", e); }
          
          // Ensure the accepted peer appears in the users list for the sidebar
          (async () => {
            try {
              const authUser = useAuthStore.getState().authUser;
              const peerId = String(inv.fromUserId) === String(authUser?._id) ? String(inv.toUserId) : String(inv.fromUserId);
              const existing = get().users.find(u => u._id === peerId);
              if (!existing) {
                const res = await axiosInstance.get('/messages/users');
                const fetched = Array.isArray(res.data) ? res.data : [];
                const found = fetched.find(u => u._id === peerId);
                if (found) {
                  set((state) => {
                    if (state.users.some(u => u._id === found._id)) return state;
                    return { users: [...state.users, found] };
                  });
                }
              }
            } catch (e) {
              console.error("Failed to update users list:", e);
            }
          })();
        });
        
        socket.on('invitation:declined', (inv) => {
          console.log("Invitation declined:", inv);
          toast.error('Invitation declined');
        });
        
        console.log("Invitation socket listeners initialized");
      },

      aiMessages: JSON.parse(localStorage.getItem('aiMessages') || '[]'),

      // --- E2EE Store Helpers ---
      getSharedSecret: async (otherUserId, forceRefresh = false) => {
        const { sharedSecrets, inFlightSecrets } = get();
        
        // If we have a secret and not forcing refresh, return it
        if (!forceRefresh && sharedSecrets[otherUserId]) {
          return sharedSecrets[otherUserId];
        }

        // If a derivation is already in flight for this user, return that promise
        if (!forceRefresh && inFlightSecrets[otherUserId]) {
          return await inFlightSecrets[otherUserId];
        }

        const derivationPromise = (async () => {
          try {
            const { authUser } = useAuthStore.getState();
            if (!authUser) throw new Error("Auth user missing");

            const privateKey = await getPrivateKey(authUser._id);
            if (!privateKey) throw new Error("Private key missing locally");

            const publicKeyJWK = await fetchUserPublicKey(otherUserId);
            const publicKey = await importPublicKey(
              typeof publicKeyJWK === 'string' ? JSON.parse(publicKeyJWK) : publicKeyJWK
            );

            const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
            
            // Clean up inFlight and update sharedSecrets
            set((state) => {
              const nextInFlight = { ...state.inFlightSecrets };
              delete nextInFlight[otherUserId];
              return {
                sharedSecrets: { ...state.sharedSecrets, [otherUserId]: sharedSecret },
                inFlightSecrets: nextInFlight
              };
            });
            return sharedSecret;
          } catch (error) {
            set((state) => {
              const nextInFlight = { ...state.inFlightSecrets };
              delete nextInFlight[otherUserId];
              return { inFlightSecrets: nextInFlight };
            });
            throw error;
          }
        })();

        set((state) => ({
          inFlightSecrets: { ...state.inFlightSecrets, [otherUserId]: derivationPromise }
        }));

        return await derivationPromise;
      },

      smartEncrypt: async (plainText, otherUserId) => {
        if (!plainText) return plainText;
        try {
          const secret = await get().getSharedSecret(otherUserId);
          return await encryptMessage(plainText, secret);
        } catch (error) {
          console.warn("[E2EE] First encryption attempt failed, retrying with fresh key...", error);
          try {
            const freshSecret = await get().getSharedSecret(otherUserId, true);
            return await encryptMessage(plainText, freshSecret);
          } catch (retryError) {
            console.error("[E2EE] Encryption failed after retry:", retryError);
            throw retryError;
          }
        }
      },

      smartDecrypt: async (msg, otherUserId) => {
        if (!msg || !msg.text || typeof msg.text !== "string" || !msg.text.includes(":")) return msg?.text || "";
        
        try {
          // Attempt 1: Use current secret
          const secret = await get().getSharedSecret(otherUserId);
          return await decryptMessage(msg.text, secret);
        } catch (error) {
          console.warn("[E2EE] First decryption attempt failed, retrying with fresh key...", error);
          try {
            // Attempt 2: Force refresh public key and retry
            const freshSecret = await get().getSharedSecret(otherUserId, true);
            return await decryptMessage(msg.text, freshSecret);
          } catch (retryError) {
            console.error("[E2EE] Decryption failed after retry:", retryError);
            return "[Message Decryption Error]";
          }
        }
      },

      getMessages: async (userId, { limit = 30, before } = {}) => {
        set({ isMessagesLoading: true, hasMoreMessages: true, oldestLoadedMessage: null });
        try {
          if (userId === 'ai-bot') {
            set({ messages: get().aiMessages, hasMoreMessages: false });
          } else {
            const params = { limit };
            if (before) params.before = before;
            const res = await axiosInstance.get(`/messages/${userId}`, { params });
            let msgs = res.data.messages || [];
            const authUser = useAuthStore.getState().authUser;
            const decryptPromises = msgs.map(async (msg) => {
              if (msg.senderId !== 'ai-bot' && msg.text && msg.text.includes(':')) {
                let otherUserId = msg.senderId === authUser._id ? msg.receiverId : msg.senderId;
                msg.text = await get().smartDecrypt(msg, otherUserId);
                
                // Also decrypt replyToText if needed
                if (msg.replyToText && typeof msg.replyToText === 'string' && msg.replyToText.includes(':')) {
                  msg.replyToText = await get().smartDecrypt({ text: msg.replyToText }, otherUserId);
                }
              }
              return msg;
            });
            msgs = await Promise.all(decryptPromises);
            set({
              messages: msgs,
              hasMoreMessages: res.data.hasMore,
              oldestLoadedMessage: (msgs && msgs.length > 0) ? msgs[0] : null,
              isMessagesLoading: false,
            });
            localStorage.setItem(`chat-messages-${userId}`, JSON.stringify(msgs));
          }
        } catch (error) {
          console.error('Error loading messages:', error);
          if (userId !== 'ai-bot' && !before) {
            const cached = localStorage.getItem(`chat-messages-${userId}`);
            if (cached) {
              set({
                messages: JSON.parse(cached),
                hasMoreMessages: false,
                oldestLoadedMessage: null,
              });
            }
          }
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      loadOlderMessages: async (userId, { limit = 30 } = {}) => {
        const { messages, oldestLoadedMessage, hasMoreMessages, isLoadingMore } = get();
        if (!hasMoreMessages || isLoadingMore || !oldestLoadedMessage) return;
        set({ isLoadingMore: true });
        try {
          const before = (oldestLoadedMessage && oldestLoadedMessage.createdAt) || (messages && messages[0] && messages[0].createdAt);
          const res = await axiosInstance.get(`/messages/${userId}`, { params: { limit, before } });
          let incoming = res.data.messages || [];
          
          const authUser = useAuthStore.getState().authUser;
          const decryptPromises = incoming.map(async (msg) => {
            if (msg.senderId !== 'ai-bot' && msg.text && msg.text.includes(':')) {
              let otherUserId = msg.senderId === authUser._id ? msg.receiverId : msg.senderId;
              msg.text = await get().smartDecrypt(msg, otherUserId);
              if (msg.replyToText && typeof msg.replyToText === 'string' && msg.replyToText.includes(':')) {
                msg.replyToText = await get().smartDecrypt({ text: msg.replyToText }, otherUserId);
              }
            }
            return msg;
          });
          incoming = await Promise.all(decryptPromises);

          if (incoming.length > 0) {
            const newMessages = [...incoming, ...messages];
            set({
              messages: newMessages,
              hasMoreMessages: res.data.hasMore,
              oldestLoadedMessage: incoming[0],
            });
            localStorage.setItem(`chat-messages-${userId}`, JSON.stringify(newMessages));
          }
        } catch (error) {
          console.error("Error loading older messages:", error);
        } finally {
          set({ isLoadingMore: false });
        }
      },

      sendMessage: async (messageData) => {
        const { selectedUser, selectedGroup, messages, aiMessages } = get();
        if (selectedUser && selectedUser._id === 'ai-bot') {
          const userMsg = {
            _id: `user-${Date.now()}`,
            senderId: 'me',
            text: messageData.text,
            createdAt: new Date().toISOString(),
            isAI: false,
          };
          set({ messages: [...aiMessages, userMsg], aiMessages: [...aiMessages, userMsg] });
          try {
            const res = await axiosInstance.post('/ai-chat', { message: messageData.text });
            const aiMsg = {
              _id: `ai-${Date.now()}`,
              senderId: 'ai-bot',
              text: res.data.response,
              createdAt: new Date().toISOString(),
              isAI: true,
            };
            set((state) => {
              const updated = [...state.aiMessages, aiMsg];
              localStorage.setItem('aiMessages', JSON.stringify(updated));
              return { messages: updated, aiMessages: updated };
            });
          } catch (error) {
            const aiMsg = {
              _id: `ai-${Date.now()}`,
              senderId: 'ai-bot',
              text: 'Sorry, I could not get a response.',
              createdAt: new Date().toISOString(),
              isAI: true,
            };
            set((state) => {
              const updated = [...state.aiMessages, aiMsg];
              localStorage.setItem('aiMessages', JSON.stringify(updated));
              return { messages: updated, aiMessages: updated };
            });
          }
        } else if (selectedUser) {
          try {
            const payload = { ...messageData };
            
            // Encrypt text if present
            if (payload.text) {
              payload.text = await get().smartEncrypt(payload.text, selectedUser._id);
            }
            
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
            const sentMessage = res.data;
            
            // For immediate UI display, keep the plaintext
            if (sentMessage.text && messageData.text) {
              sentMessage.text = messageData.text;
            }
            
            // Decrypt any other fields that might come back encrypted (like replyToText)
            if (sentMessage.replyToText && typeof sentMessage.replyToText === 'string' && sentMessage.replyToText.includes(':')) {
               sentMessage.replyToText = await get().smartDecrypt({ text: sentMessage.replyToText }, selectedUser._id);
            }

            const newMessages = [...messages, sentMessage];
            set((state) => ({
              messages: newMessages,
              users: state.users.map((user) =>
                user._id === sentMessage.receiverId || user._id === sentMessage.senderId
                  ? { ...user, lastMessage: { ...sentMessage, content: sentMessage.text || 'Media' } }
                  : user
              ),
              archivedUsers: state.archivedUsers.map((user) =>
                user._id === sentMessage.receiverId || user._id === sentMessage.senderId
                  ? { ...user, lastMessage: { ...sentMessage, content: sentMessage.text || 'Media' } }
                  : user
              ),
            }));
            localStorage.setItem(`chat-messages-${selectedUser._id}`, JSON.stringify(newMessages));
          } catch (error) {
            const data = error.response?.data;
            if (data?.code === 'CHAT_INVITE_REQUIRED') {
              toast.error('Invitation required. Sending invite...');
              try {
                await axiosInstance.post('/invitations/send', { toUserId: selectedUser._id });
                toast.success('Invitation sent. Wait for acceptance to start chatting.');
              } catch {}
            }
            console.error("[DEBUG] Send message error:", data || error.message);
            throw error;
          }
        } else if (selectedGroup) {
          // Handle group message sending
          try {
            const res = await axiosInstance.post(`/messages/group/${selectedGroup._id}`, messageData);
            const sentMessage = res.data;
            
            const newMessages = [...messages, sentMessage];
            set((state) => ({
              messages: newMessages,
              groups: state.groups.map((group) =>
                group._id === selectedGroup._id
                  ? { ...group, lastMessage: { ...sentMessage, content: sentMessage.text || 'Media' } }
                  : group
              ),
            }));
            localStorage.setItem(`chat-messages-group-${selectedGroup._id}`, JSON.stringify(newMessages));
          } catch (error) {
            console.error("[DEBUG] Send group message error:", error);
            toast.error('Failed to send message to group');
            throw error;
          }
        }
      },

      subscribeToMessages: () => {
        const { selectedUser } = get();
        if (!selectedUser) {
          console.log("No selected user, skipping subscription");
          return;
        }
        const socket = useAuthStore.getState().socket;
        if (!socket) {
          console.log("Socket not initialized");
          return;
        }
        socket.off("newMessage");
        socket.off("messageDeleted");
        socket.off("chatDeleted");
        socket.off("messageSeen");
        socket.off("messageDelivered");
        const authUser = useAuthStore.getState().authUser;
        socket.on("newMessage", async (newMessage) => {
          const { selectedUser, messages } = get();
          const isForSelectedUser = 
            (newMessage.senderId === selectedUser?._id) || 
            (newMessage.receiverId === selectedUser?._id);

          if (isForSelectedUser) {
            // Decrypt incoming message
            const otherUserId = newMessage.senderId === useAuthStore.getState().authUser?._id 
              ? newMessage.receiverId 
              : newMessage.senderId;
            
            newMessage.text = await get().smartDecrypt(newMessage, otherUserId);
            
            // Also decrypt replyToText if needed
            if (newMessage.replyToText && typeof newMessage.replyToText === 'string' && newMessage.replyToText.includes(':')) {
              newMessage.replyToText = await get().smartDecrypt({ text: newMessage.replyToText }, otherUserId);
            }

            set({ messages: [...messages, newMessage] });
          }
          // If this chat is currently open for the receiver, mark messages as read immediately
          try {
            const currentSelected = get().selectedUser;
            if (currentSelected && currentSelected._id === newMessage.senderId) {
              await axiosInstance.post(`/messages/read/${newMessage.senderId}`);
            }
          } catch (e) {
            // ignore
          }
        });
        socket.on("messageDeleted", ({ messageId, deleteForEveryone }) => {
          console.log(`Received messageDeleted for messageId: ${messageId}, deleteForEveryone: ${deleteForEveryone}`);
          set((state) => {
            if (deleteForEveryone) {
              return {
                messages: state.messages.map(msg =>
                  msg._id === messageId
                    ? {
                        ...msg,
                        text: "this message is deleted",
                        isDeleted: true,
                        isDeletedForEveryone: true,
                        image: null,
                        video: null,
                        audio: null,
                        document: null,
                        fileName: null,
                      }
                    : msg
                ),
              };
            }
            return {
              messages: state.messages.filter(msg => msg._id !== messageId),
            };
          });
        });
        socket.on("chatDeleted", ({ userId, initiator }) => {
          set((state) => {
            if (state.selectedUser && state.selectedUser._id === userId) {
              return { messages: [], selectedUser: null };
            }
            return {};
          });
          if (initiator === authUser?._id) {
            toast.success("Chat deleted");
          }
        });
         socket.on("messageSeen", ({ messageIds }) => {
          try {
            const idSet = new Set((messageIds || []).map((id) => String(id)));
            set((state) => ({
              messages: state.messages.map((msg) =>
                idSet.has(String(msg._id)) ? { ...msg, seen: true } : msg
              ),
            }));
          } catch {}
        });
         // Also locally mark outgoing messages as seen when I open the chat to the other user
         // This keeps the UI in sync even if the socket event is delayed
         const selectedUserNow = get().selectedUser;
         if (selectedUserNow && selectedUserNow._id) {
           (async () => {
             try {
               await axiosInstance.post(`/messages/read/${selectedUserNow._id}`);
             } catch {}
           })();
         }
        socket.on("messageDelivered", ({ messageId }) => {
          set((state) => ({
            messages: state.messages.map((msg) =>
              String(msg._id) === String(messageId) ? { ...msg, delivered: true } : msg
            ),
          }));
        });
        socket.on("messageEdited", ({ messageId, text }) => {
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg._id === messageId ? { ...msg, text } : msg
            ),
          }));
        });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
          console.log("Unsubscribing from socket events");
          socket.off("newMessage");
          socket.off("messageDeleted");
        }
      },

      setSelectedUser: async (selectedUser) => {
        if (!selectedUser) {
          set({ selectedUser: null });
          return;
        }
        try {
          await axiosInstance.post(`/messages/read/${selectedUser._id}`);
        } catch (error) {
          console.error('Failed to mark messages as read:', error);
        }
        set((state) => ({
          selectedUser,
          selectedGroup: null, // Clear selected group when user is selected
          users: state.users.map((user) =>
            user._id === selectedUser._id ? { ...user, unreadCount: 0 } : user
          ),
          archivedUsers: state.archivedUsers.map((user) =>
            user._id === selectedUser._id ? { ...user, unreadCount: 0 } : user
          ),
        }));
      },

      deleteMessage: async (messageId, { forEveryone = false } = {}) => {
        const { selectedUser, aiMessages, messages } = get();
        if (selectedUser?._id === 'ai-bot') {
          const updated = aiMessages.filter(msg => msg._id !== messageId);
          localStorage.setItem('aiMessages', JSON.stringify(updated));
          set({ aiMessages: updated, messages: updated });
          toast.success("Message deleted");
          return;
        }
        try {
          console.log("[DEBUG] deleteMessage called for:", messageId, { forEveryone });
          await axiosInstance.delete(`/messages/${messageId}`, { data: { forEveryone } });
          if (!forEveryone) {
            set((state) => ({
              messages: state.messages.filter((msg) => msg._id !== messageId),
            }));
            toast.success("Message deleted");
          }
        } catch (error) {
          console.error("[DEBUG] Delete error:", error.response?.data || error.message);
          toast.error("Failed to delete message");
          throw error;
        }
      },

      updateMessage: async (messageId, updateData) => {
        const { selectedUser, aiMessages, messages } = get();
        if (selectedUser && selectedUser._id === 'ai-bot') {
          const updated = aiMessages.map(msg =>
            msg._id === messageId ? { ...msg, ...updateData } : msg
          );
          localStorage.setItem('aiMessages', JSON.stringify(updated));
          set({ aiMessages: updated, messages: updated });
        } else {
          try {
            const res = await axiosInstance.patch(`/messages/${messageId}`, updateData);
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg._id === messageId ? { ...msg, ...updateData } : msg
              ),
            }));
            return res.data;
          } catch (error) {
            toast.error(error.response?.data?.error || "Failed to update message");
            throw error;
          }
        }
      },

      deleteChat: async (userId) => {
        if (userId === 'ai-bot') {
          localStorage.removeItem('aiMessages');
          set({ aiMessages: [], messages: [] });
          toast.success('AI chat cleared!');
          return;
        }
        try {
          await axiosInstance.delete(`/messages/chat/${userId}`);
          const { selectedUser, messages } = get();
          if (selectedUser && selectedUser._id === userId) {
            const preservedMessages = messages.filter(msg => msg.isDeletedForEveryone);
            set({ messages: preservedMessages });
          }
          const cachedMessages = JSON.parse(localStorage.getItem(`chat-messages-${userId}`) || '[]');
          const preservedCachedMessages = cachedMessages.filter(msg => msg.isDeletedForEveryone);
          localStorage.setItem(`chat-messages-${userId}`, JSON.stringify(preservedCachedMessages));
          set((state) => {
            const updateUserLastMessage = (user) => {
              if (user._id !== userId) return user;
              if (user.lastMessage && !user.lastMessage.isDeletedForEveryone) {
                return { ...user, lastMessage: null };
              }
              return user;
            };
            return {
              users: state.users.map(updateUserLastMessage),
              archivedUsers: state.archivedUsers.map(updateUserLastMessage),
            };
          });
          toast.success('Chat cleared successfully!');
        } catch (error) {
          console.error('Failed to clear chat:', error);
          toast.error(error.response?.data?.error || 'Failed to clear chat');
          throw error;
        }
      },

      setCallState: (newState) => set((state) => ({ callState: { ...state.callState, ...newState } })),

      setLocalStream: (stream) => set({ localStream: stream }),

      setRemoteStream: (stream) => set({ remoteStream: stream }),

      setPendingCaller: (caller) => set({ pendingCaller: caller }),

      setCallStartTime: (time) => set({ callStartTime: time }),

      resetCallState: () => {
        const { localStream, peerConnectionRef } = get();
        set({
          callStartTime: null,
          callState: {
            isModalOpen: false,
            isIncoming: false,
            status: "",
            error: "",
            isVideoCall: false,
            isMuted: false,
            isVideoHidden: false,
            callHasEnded: false,
            callEndedByMe: false,
            startTime: null,
            callId: null, // Reset callId
          },
          pendingCaller: null,
          iceCandidateBuffer: [],
          isReconnecting: false,
          remoteStream: null,
        });
        if (peerConnectionRef) {
          try {
            peerConnectionRef.close();
          } catch (e) {
            console.warn("[Call] Error closing peerConnection:", e);
          }
          set({ peerConnectionRef: null });
        }
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            try {
              if (track.readyState === "live") track.stop();
            } catch (e) {
              console.warn("[Call] Error stopping local track:", e);
            }
          });
          set({ localStream: null });
        }
      },

      setupPeerConnection: () => {
        const { iceServers, pendingCaller, selectedUser, isReconnecting, resetCallState, setRemoteStream, iceCandidateBuffer } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            { urls: "stun:stun.ekiga.net" },
            { urls: "stun:stun.ideasip.com" },
            { urls: "stun:stun.rixtelecom.se" },
            { urls: "stun:stun.schlund.de" },
            { urls: "stun:stun.stunprotocol.org:3478" },
            { urls: "stun:stun.voiparound.com" },
            { urls: "stun:stun.voipbuster.com" },
            { urls: "stun:stun.voipstunt.com" },
            { urls: "stun:stun.voxgratia.org" },
          ],
          iceCandidatePoolSize: 10,
        });

        // Use a persistent remote description set flag and buffer
        let isRemoteDescriptionSet = false;
        const candidateBuffer = [];

        set({ peerConnectionRef: pc });
        console.log("[Call] PeerConnection created", pc);

        // ICE candidates will be handled globally in initializeCallSocket to avoid duplication


        // This should be called by the signaling handlers once setRemoteDescription is done
        pc.onRemoteDescriptionSet = async () => {
          isRemoteDescriptionSet = true;
          console.log("[Call] Remote description set, processing", candidateBuffer.length, "buffered candidates");
          while (candidateBuffer.length > 0) {
            const candidate = candidateBuffer.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("[Call] Error adding buffered candidate", e);
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("call:ice-candidate", {
              candidate: event.candidate,
              to: pendingCaller?.from || selectedUser?._id,
              callId: get().callState.callId
            });
          }
        };

        pc.ontrack = (e) => {
          console.log("[Call] ontrack event, remoteStream tracks:", e.streams[0]?.getTracks().map(t => t.kind), e.streams[0]);
          setRemoteStream(e.streams[0]);
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[Call] ICE connection state:", pc.iceConnectionState);
          switch (pc.iceConnectionState) {
            case "failed":
            case "disconnected":
              if (!isReconnecting) {
                get().setCallState({
                  status: "Reconnecting...",
                  error: "Connection lost. Attempting to reconnect...",
                });
                get().attemptReconnect();
              }
              break;
            case "connected":
              get().setCallState({ status: "In call", error: "" });
              set({ isReconnecting: false });
              const currentTime = Date.now();
              set({
                callStartTime: get().callStartTime || currentTime,
                callState: {
                  ...get().callState,
                  startTime: get().callState.startTime || currentTime,
                },
              });
              break;
            case "closed":
              resetCallState();
              break;
          }
        };
        return pc;
      },

      attemptReconnect: () => {
        set({ isReconnecting: true });
        const { peerConnectionRef, resetCallState, setCallState } = get();
        if (peerConnectionRef) {
          peerConnectionRef.restartIce();
          setTimeout(() => {
            if (peerConnectionRef.iceConnectionState === "failed") {
              setCallState({ error: "Reconnection failed. Please end and retry.", status: "" });
              resetCallState();
            }
          }, 5000);
        }
      },

      handleCall: async (isVideo, targetUserOverride = null) => {
        const { setCallState, setLocalStream, setupPeerConnection } = get();
        const selectedUser = targetUserOverride || get().selectedUser;
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;

        if (!selectedUser || !authUser || !socket) {
          toast.error("Cannot start call: missing user or socket");
          return;
        }
        const callId = uuidv4(); // Generate unique call ID
        try {
          setCallState({
            isModalOpen: true,
            isIncoming: false,
            status: isVideo ? "Starting video call..." : "Starting voice call...",
            isVideoCall: isVideo,
            error: "",
            callId, // Set callId
          });
          let constraints = isVideo
            ? { audio: true, video: { width: 640, height: 480 } }
            : { audio: true, video: false };
          let localStream;
          try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err) {
            if (isVideo && (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError')) {
              toast.error('Video unavailable, falling back to audio call.');
              constraints = { audio: true, video: false };
              localStream = await navigator.mediaDevices.getUserMedia(constraints);
              setCallState((prev) => ({ ...prev, isVideoCall: false }));
            } else {
              let userMsg = "Failed to start call: ";
              if (err.name === 'NotAllowedError') {
                userMsg += 'Camera or microphone access denied. Please allow permission.';
              } else if (err.name === 'NotFoundError') {
                userMsg += 'No camera or microphone found. Please connect a device.';
              } else if (err.name === 'NotReadableError') {
                userMsg += 'Camera or microphone is already in use by another application.';
              } else {
                userMsg += err.message || err;
              }
              toast.error(userMsg);
              setCallState({
                isModalOpen: false,
                isIncoming: false,
                status: "",
                isVideoCall: false,
                error: userMsg,
                callId: null,
              });
              return;
            }
          }
          setLocalStream(localStream);
          const pc = setupPeerConnection();
          localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });

          // Wait for remote description if we were doing a re-offer, but for a new call
          // we just create the offer.
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit("call:offer", {
            to: selectedUser._id,
            from: authUser._id,
            name: authUser.fullName,
            avatar: authUser.profilePic,
            offer,
            isVideoCall: isVideo && constraints.video !== false,
            callId,
          });

          get().addCallLogToBackend({
            receiver: selectedUser._id,
            type: isVideo && constraints.video !== false ? "video" : "audio",
            direction: "outgoing",
            status: "initiated",
            startedAt: Date.now(),
            callId,
          });
        } catch (err) {
          console.error("[Call] handleCall error:", err);
          let userMsg = "Failed to start call: " + (err.message || err);
          toast.error(userMsg);
          get().resetCallState();
        }
      },


      initializeCallSocket: () => {
        const { resetCallState, setPendingCaller, setCallState, setCallStartTime, setupPeerConnection, setLocalStream, setRemoteStream, addCallLogToBackend } = get();
        const socket = useAuthStore.getState().socket;
        console.log("[Call] Initializing call socket", socket);
        if (!socket) return;

        socket.off("call:offer");
        socket.off("call:answer");
        socket.off("call:ice-candidate");
        socket.off("call:decline");
        socket.off("call:end");
        socket.off("call:missed");

        socket.on("call:offer", (data) => {
          console.log("[Call] Received call offer:", data);
          resetCallState();
          setPendingCaller(data);
          setCallState({
            isModalOpen: true,
            callHasEnded: false,
            isIncoming: true,
            status: `${data.name} is calling...`,
            isVideoCall: data.isVideoCall || false,
            startTime: Date.now(),
            callId: data.callId, // Set callId from offer
          });
          if (window.Notification && Notification.permission === "granted") {
            new Notification(`${data.name} is calling you${data.isVideoCall ? ' (video call)' : ''}!`, {
              body: 'Click to answer or decline.',
              icon: '/avatar.png',
            });
          }
        });

        socket.on("call:answer", async (data) => {
          const { peerConnectionRef, setCallState, addCallLogToBackend, callState } = get();
          if (peerConnectionRef) {
            // Guard: only set remote description if we are in a state that expects an answer
            if (peerConnectionRef.signalingState === "have-local-offer") {
              try {
                await peerConnectionRef.setRemoteDescription(new RTCSessionDescription(data.answer));
                if (peerConnectionRef.onRemoteDescriptionSet) await peerConnectionRef.onRemoteDescriptionSet();
                console.log("[Call] Remote description (answer) set successfully");
              } catch (e) {
                console.error("[Call] Failed to set remote description (answer):", e);
              }
            } else {
              console.warn("[Call] Received answer while in signaling state:", peerConnectionRef.signalingState);
            }
          }
          setCallState({ status: "In call", error: "" });
          // Update call log to "answered" for caller
          if (callState.callId) {
            addCallLogToBackend({
              receiver: get().selectedUser?._id,
              type: data.isVideoCall ? "video" : "audio",
              direction: "outgoing",
              status: "answered",
              startedAt: callState.startTime || Date.now(),
              callId: callState.callId,
            });
          }
        });

        socket.on("call:ice-candidate", async ({ candidate }) => {
          const { peerConnectionRef } = get();
          try {
            if (peerConnectionRef.remoteDescription && peerConnectionRef.remoteDescription.type && peerConnectionRef.signalingState !== "closed") {
              await peerConnectionRef.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              console.log("[WebRTC] Buffering ICE candidate because remoteDescription is not set");
              get().iceCandidateBuffer.push(candidate);
            }
          } catch (e) {
            console.error("[WebRTC] Error adding received ice candidate", e);
          }
        });

        socket.on("call:decline", (data) => {
          const { callState, resetCallState } = get();
          toast.error("Call was declined");
          if (callState.callId) {
            addCallLogToBackend({
              receiver: get().selectedUser?._id,
              type: callState.isVideoCall ? "video" : "audio",
              direction: callState.isIncoming ? "incoming" : "outgoing",
              status: "declined",
              startedAt: callState.startTime || Date.now(),
              endedAt: Date.now(),
              callId: callState.callId,
            });
          }
          resetCallState();
        });

        socket.on("call:missed", (data) => {
          const { resetCallState } = get();
          if (data.callId) {
            addCallLogToBackend({
              receiver: get().selectedUser?._id || data.from,
              type: data.isVideoCall ? "video" : "audio",
              direction: "incoming",
              status: "missed",
              startedAt: data.startedAt || Date.now(),
              endedAt: Date.now(),
              callId: data.callId,
            });
          }
          resetCallState();
        });

        socket.on("call:end", (data) => {
          const { callHasEnded, callEndedByMe, selectedUser, callState, resetCallState, addCallLogToBackend } = get();
          if (!callHasEnded) {
            if (!callEndedByMe && callState.callId) {
              toast("Call ended");
              addCallLogToBackend({
                receiver: selectedUser?._id,
                type: callState.isVideoCall ? "video" : "audio",
                direction: callState.isIncoming ? "incoming" : "outgoing",
                status: "ended",
                duration: callState.startTime ? Math.floor((Date.now() - callState.startTime) / 1000) : 0,
                startedAt: callState.startTime || Date.now(),
                endedAt: Date.now(),
                callId: callState.callId,
              });
            }
            setCallState({ callHasEnded: true });
            resetCallState();
          }
        });
      },

      handleAccept: async () => {
        const { pendingCaller, setCallState, setLocalStream, setupPeerConnection, addCallLogToBackend } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        if (!pendingCaller || !authUser || !socket) {
          toast.error("Cannot accept call: missing caller or socket");
          return;
        }
        try {
          setCallState({
            isModalOpen: true,
            isIncoming: false,
            status: pendingCaller.isVideoCall ? "Connecting video call..." : "Connecting audio call...",
            isVideoCall: !!pendingCaller.isVideoCall,
            error: "",
            callId: pendingCaller.callId, // Preserve callId
          });
          let constraints = pendingCaller.isVideoCall
            ? { audio: true, video: { width: 640, height: 480 } }
            : { audio: true, video: false };
          let localStream;
          try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err) {
            if (pendingCaller.isVideoCall && (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError')) {
              toast.error('Video unavailable, falling back to audio call.');
              constraints = { audio: true, video: false };
              localStream = await navigator.mediaDevices.getUserMedia(constraints);
              setCallState((prev) => ({ ...prev, isVideoCall: false }));
            } else {
              let userMsg = "Failed to accept call: ";
              if (err.name === 'NotAllowedError') {
                userMsg += 'Camera or microphone access denied. Please allow permission.';
              } else if (err.name === 'NotFoundError') {
                userMsg += 'No camera or microphone found. Please connect a device.';
              } else if (err.name === 'NotReadableError') {
                userMsg += 'Camera or microphone is already in use by another application.';
              } else {
                userMsg += err.message || err;
              }
              toast.error(userMsg);
              setCallState({
                isModalOpen: false,
                isIncoming: false,
                status: "",
                isVideoCall: false,
                error: userMsg,
                callId: null,
              });
              return;
            }
          }
          setLocalStream(localStream);
          setLocalStream(localStream);
          
          let pc = get().peerConnectionRef;
          if (!pc) pc = setupPeerConnection();

          localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });

          // CRITICAL: Must set remote description (the offer) BEFORE creating an answer
          // If we haven't set it yet, do it now.
          if (pc.signalingState !== "have-remote-offer") {
             try {
                await pc.setRemoteDescription(new RTCSessionDescription(pendingCaller.offer));
                console.log("[Call] Remote description (offer) set in handleAccept");
                if (pc.onRemoteDescriptionSet) await pc.onRemoteDescriptionSet();
             } catch (e) {
                console.error("[Call] Failed to set remote description in handleAccept:", e);
                throw new Error("Failed to set remote description from caller.");
             }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("call:answer", {
            to: pendingCaller.from,
            answer,
            isVideoCall: !!pendingCaller.isVideoCall,
            callId: pendingCaller.callId
          });

          setCallState({ status: "In call", error: "" });
          
          addCallLogToBackend({
            receiver: pendingCaller.from,
            type: pendingCaller.isVideoCall ? "video" : "audio",
            direction: "incoming",
            status: "answered",
            startedAt: Date.now(),
            callId: pendingCaller.callId,
          });
        } catch (err) {
          console.error("[Call] handleAccept error:", err);
          toast.error("Failed to accept call: " + (err.message || err));
          get().resetCallState();
        }
      },

      handleDecline: () => {
        const { pendingCaller, resetCallState, callState } = get();
        const socket = useAuthStore.getState().socket;
        if (pendingCaller && socket && callState.callId) {
          socket.emit("call:decline", {
            to: pendingCaller.from,
            callId: callState.callId, // Include callId
          });
          // Log the declined call for callee
          get().addCallLogToBackend({
            receiver: pendingCaller.from,
            type: callState.isVideoCall ? "video" : "audio",
            direction: "incoming",
            status: "declined",
            startedAt: callState.startTime || Date.now(),
            endedAt: Date.now(),
            callId: callState.callId,
          });
        }
        resetCallState();
      },

      handleEnd: () => {
        const { pendingCaller, selectedUser, callState, resetCallState, addCallLogToBackend } = get();
        const socket = useAuthStore.getState().socket;
        const to = pendingCaller?.from || selectedUser?._id;
        if (to && socket && callState.callId) {
          socket.emit("call:end", {
            to,
            callId: callState.callId, // Include callId
          });
          // Log the ended call
          if (!callState.callHasEnded) {
            addCallLogToBackend({
              receiver: selectedUser?._id || pendingCaller?.from,
              type: callState.isVideoCall ? "video" : "audio",
              direction: callState.isIncoming ? "incoming" : "outgoing",
              status: "ended",
              duration: callState.startTime ? Math.floor((Date.now() - callState.startTime) / 1000) : 0,
              startedAt: callState.startTime || Date.now(),
              endedAt: Date.now(),
              callId: callState.callId,
            });
          }
        }
        set({ callEndedByMe: true });
        resetCallState();
      },

      handleToggleMute: () => {
        const { localStream, callState, setCallState } = get();
        if (localStream) {
          const audioTracks = localStream.getAudioTracks();
          if (audioTracks.length > 0) {
            const newMuted = !callState.isMuted;
            audioTracks.forEach(track => {
              track.enabled = !newMuted;
            });
            setCallState({ isMuted: newMuted });
          }
        }
      },

      handleToggleVideo: () => {
        const { localStream, callState, setCallState } = get();
        if (localStream) {
          const videoTracks = localStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const newHidden = !callState.isVideoHidden;
            videoTracks.forEach(track => {
              track.enabled = !newHidden;
            });
            setCallState({ isVideoHidden: newHidden });
          }
        }
      },

      // --- Group Management ---
      loadGroups: async () => {
        try {
          const res = await axiosInstance.get('/groups');
          const groups = Array.isArray(res.data) ? res.data : [];
          // Deduplicate groups by _id
          const seen = new Set();
          const uniqueGroups = groups.filter(g => {
            if (!g._id || seen.has(g._id)) return false;
            seen.add(g._id);
            return true;
          });
          set({ groups: uniqueGroups });
        } catch (error) {
          console.error('Error loading groups:', error);
        }
      },

      createGroup: async (groupData) => {
        try {
          const res = await axiosInstance.post('/groups', groupData);
          const newGroup = res.data;
          set(state => ({
            groups: [newGroup, ...state.groups.filter(g => g._id !== newGroup._id)]
          }));
          return newGroup;
        } catch (error) {
          console.error('Error creating group:', error);
          throw error;
        }
      },

      setSelectedGroup: (group) => {
        set({ selectedGroup: group, selectedUser: null });
      },

      // Group messaging functions
      sendGroupMessage: async (messageData) => {
        const { selectedGroup, messages } = get();
        if (!selectedGroup) return;

        try {
          const res = await axiosInstance.post(`/messages/group/${selectedGroup._id}`, messageData);
          const sentMessage = res.data;
          
          const newMessages = [...messages, sentMessage];
          set((state) => ({
            messages: newMessages,
            groups: state.groups.map((group) =>
              group._id === selectedGroup._id
                ? { ...group, lastMessage: { ...sentMessage, content: sentMessage.text || 'Media' } }
                : group
            ),
          }));
          
          localStorage.setItem(`chat-messages-group-${selectedGroup._id}`, JSON.stringify(newMessages));
        } catch (error) {
          console.error('Error sending group message:', error);
          toast.error('Failed to send message');
          throw error;
        }
      },

      getGroupMessages: async (groupId, { limit = 30, before } = {}) => {
        set({ isMessagesLoading: true, hasMoreMessages: true, oldestLoadedMessage: null });
        try {
          const params = { limit };
          if (before) params.before = before;
          const res = await axiosInstance.get(`/messages/group/${groupId}`, { params });
          let msgs = res.data.messages || [];
          
          set({
            messages: msgs,
            hasMoreMessages: res.data.hasMore,
            oldestLoadedMessage: (msgs && msgs.length > 0) ? msgs[0] : null,
            isMessagesLoading: false,
          });
          localStorage.setItem(`chat-messages-group-${groupId}`, JSON.stringify(msgs));
        } catch (error) {
          console.error('Error loading group messages:', error);
          const cached = localStorage.getItem(`chat-messages-group-${groupId}`);
          if (cached) {
            set({
              messages: JSON.parse(cached),
              hasMoreMessages: false,
              oldestLoadedMessage: null,
            });
          }
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      // Load groups with last messages for sidebar
      loadGroupsForSidebar: async () => {
        try {
          const res = await axiosInstance.get('/groups');
          const groups = Array.isArray(res.data) ? res.data : [];
          
          // Deduplicate groups by _id
          const seen = new Set();
          const uniqueGroups = groups.filter(g => {
            if (!g._id || seen.has(g._id)) return false;
            seen.add(g._id);
            return true;
          });
          
          // For each group, get the last message
          const groupsWithLastMessage = await Promise.all(
            uniqueGroups.map(async (group) => {
              try {
                const msgRes = await axiosInstance.get(`/messages/group/${group._id}?limit=1`);
                const lastMsg = msgRes.data.messages?.[0];
                
                let lastMessage = null;
                if (lastMsg) {
                  if (lastMsg.text) {
                    lastMessage = { type: "text", content: lastMsg.text, createdAt: lastMsg.createdAt };
                  } else if (lastMsg.image) {
                    lastMessage = { type: "image", content: lastMsg.image, createdAt: lastMsg.createdAt };
                  } else if (lastMsg.video) {
                    lastMessage = { type: "video", content: lastMsg.video, createdAt: lastMsg.createdAt };
                  } else if (lastMsg.audio) {
                    lastMessage = { type: "audio", content: lastMsg.audio, createdAt: lastMsg.createdAt };
                  } else if (lastMsg.document) {
                    lastMessage = { type: "document", content: lastMsg.document, fileName: lastMsg.fileName, createdAt: lastMsg.createdAt };
                  }
                }

                return {
                  ...group,
                  lastMessage,
                  unreadCount: 0, // TODO: Implement group unread count
                  isGroup: true
                };
              } catch (error) {
                return {
                  ...group,
                  lastMessage: null,
                  unreadCount: 0,
                  isGroup: true
                };
              }
            })
          );
          
          set({ groups: groupsWithLastMessage });
        } catch (error) {
          console.error('Error loading groups for sidebar:', error);
        }
      },

      updateGroup: async (groupId, updateData) => {
        try {
          const res = await axiosInstance.put(`/groups/${groupId}`, updateData);
          const updatedGroup = res.data;
          set(state => ({
            groups: state.groups.map(g => g._id === groupId ? updatedGroup : g),
            selectedGroup: state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup
          }));
          return updatedGroup;
        } catch (error) {
          console.error('Error updating group:', error);
          throw error;
        }
      },

      addGroupMembers: async (groupId, memberIds) => {
        try {
          const res = await axiosInstance.post(`/groups/${groupId}/members`, { memberIds });
          const updatedGroup = res.data;
          set(state => ({
            groups: state.groups.map(g => g._id === groupId ? updatedGroup : g),
            selectedGroup: state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup
          }));
          return updatedGroup;
        } catch (error) {
          console.error('Error adding group members:', error);
          throw error;
        }
      },

      removeGroupMembers: async (groupId, memberIds) => {
        try {
          const res = await axiosInstance.delete(`/groups/${groupId}/members`, { data: { memberIds } });
          const updatedGroup = res.data;
          set(state => ({
            groups: state.groups.map(g => g._id === groupId ? updatedGroup : g),
            selectedGroup: state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup
          }));
          return updatedGroup;
        } catch (error) {
          console.error('Error removing group members:', error);
          throw error;
        }
      },

      leaveGroup: async (groupId) => {
        try {
          await axiosInstance.post(`/groups/${groupId}/leave`);
          set(state => ({
            groups: state.groups.filter(g => g._id !== groupId),
            selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup
          }));
        } catch (error) {
          console.error('Error leaving group:', error);
          throw error;
        }
      },

      makeAdmin: async (groupId, memberId) => {
        try {
          const res = await axiosInstance.post(`/groups/${groupId}/admin`, { memberId });
          const updatedGroup = res.data;
          set(state => ({
            groups: state.groups.map(g => g._id === groupId ? updatedGroup : g),
            selectedGroup: state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup
          }));
          return updatedGroup;
        } catch (error) {
          console.error('Error making admin:', error);
          throw error;
        }
      },

      removeAdmin: async (groupId, memberId) => {
        try {
          const res = await axiosInstance.delete(`/groups/${groupId}/admin`, { data: { memberId } });
          const updatedGroup = res.data;
          set(state => ({
            groups: state.groups.map(g => g._id === groupId ? updatedGroup : g),
            selectedGroup: state.selectedGroup?._id === groupId ? updatedGroup : state.selectedGroup
          }));
          return updatedGroup;
        } catch (error) {
          console.error('Error removing admin:', error);
          throw error;
        }
      },
    }),
    {
      name: "chat-store",
      storage: safeStorage,
      // Persist only lightweight keys; large collections are cached separately to avoid quota issues
      partialize: (state) => ({
        selectedUser: state.selectedUser,
        aiMessages: state.aiMessages, // already capped externally
        pinnedUsers: state.pinnedUsers,
        archivedUsers: state.archivedUsers,
        favorites: state.favorites,
        // Persist wallpaper settings so they survive refresh
        wallpaperMode: state.wallpaperMode,
        wallpaper: state.wallpaper,
        perUserWallpapers: state.perUserWallpapers,
        wallpaperLibrary: state.wallpaperLibrary,
      }),
      version: 1,
    }
  )
);

export {
  fetchUserPublicKey,
  importPublicKey,
  importPrivateKey,
  deriveSharedSecret,
  decryptMessage,
  getPrivateKey,
};