import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from "react";
import WhatsAppAudioPreview from "./WhatsAppAudioPreview";
import { useChatStore } from "../store/useChatStore";
import MessageInput from "./MessageInput";
import MessageSkeleton from "../Skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { 
  Play, 
  Pause, 
  Volume2, 
  Download, 
  File, 
  Reply, 
  Copy, 
  Forward, 
  Star, 
  CheckSquare, 
  Share2, 
  Edit, 
  Info,
  Trash2,
  Camera,
  Video,
  Ban,
  Check,
  CheckCheck
} from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import MessageInfoModal from "./MessageInfoModal";
import Picker from '@emoji-mart/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  fetchUserPublicKey,
  importPublicKey,
  deriveSharedSecret,
  decryptMessage,
  getPrivateKey
} from "../store/useChatStore";

// Utility: check if string is only 1-3 emojis (no other text)
function isBigEmoji(text) {
  if (!text) return false;
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}|\p{Emoji_Component})+$/gu;
  const clean = text.trim();
  const emojis = Array.from(clean.matchAll(/\p{Emoji}(?:\uFE0F)?/gu));
  return (
    emojis.length > 0 && emojis.length <= 3 &&
    emojis.join('') === clean &&
    emojiRegex.test(clean)
  );
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (err) {
    success = false;
  }
  document.body.removeChild(textArea);
  return success;
}

function getDateLabel(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (today - msgDay) / (1000 * 60 * 60 * 24);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7 && diff > 1) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isProbablyEncrypted(val) {
  return typeof val === 'string' && /^[A-Za-z0-9+/=\-_]+:[A-Za-z0-9+/=\-_]+$/.test(val) && !val.startsWith('http');
}

export const ChatContainer = ({
  searchQuery = "",
  currentMatch = 0,
  setTotalMatches = () => {},
  activeTabView,
  setActiveTabView,
  ...props
}) => {
  const {
    messages,
    getMessages,
    getGroupMessages,
    isMessagesLoading,
    selectedUser,
    selectedGroup,
    subscribeToMessages,
    unsubscribeFromMessages,
    updateMessage,
    deleteMessage,
    users,
    sendMessage,
    sendGroupMessage,
    setSelectedUser,
    setMessages,
    getUsers,
    loadOlderMessages,
    hasMoreMessages,
    isLoadingMore,
    wallpaper,
    wallpaperMode,
    perUserWallpapers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, messageId: null });
  const [replyTo, setReplyTo] = useState(null);
  const [starred, setStarred] = useState({});
  const [selectedMessages, setSelectedMessages] = useState({});
  const [reactions, setReactions] = useState({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardRecipientIds, setForwardRecipientIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessageId, setInfoMessageId] = useState(null);
  const messageRefs = useRef([]);
  const [currentDateLabel, setCurrentDateLabel] = useState("");
  const dateHeaderRefs = useRef({});
  const inputRef = useRef(null);
  const contextMenuRef = useRef(null);
  const chatAreaRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editInputValue, setEditInputValue] = useState("");
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const inputBarRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null);
  const emojiPickerRef = useRef(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [mediaDocsLinksTab, setMediaDocsLinksTab] = useState('media');

  const renderTick = (msg) => {
    if (msg.senderId !== authUser?._id) return null;
    if (msg.seen) {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-label="Seen" />;
    }
    if (msg.delivered) {
      return <CheckCheck className="w-3.5 h-3.5 text-base-content/50" aria-label="Delivered" />;
    }
    return <Check className="w-3.5 h-3.5 text-base-content/50" aria-label="Sent" />;
  };

  const emojiReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return sortedMessages.filter(msg => {
      if (msg.deletedFor && Array.isArray(msg.deletedFor) && msg.deletedFor.includes(authUser._id)) {
        return false;
      }
      return true;
    });
  }, [sortedMessages, authUser._id]);

  useEffect(() => {
    const initialStarred = {};
    const initialReactions = {};
    messages.forEach((msg) => {
      initialStarred[msg._id] = msg.isStarred || false;
      initialReactions[msg._id] = msg.reactions || [];
    });
    setStarred(initialStarred);
    setReactions(initialReactions);
  }, [messages]);

  useEffect(() => {
    unsubscribeFromMessages();
    if (selectedGroup?._id) {
      getGroupMessages(selectedGroup._id);
    } else if (selectedUser?._id && selectedUser._id !== 'ai-bot') {
      getMessages(selectedUser._id);
      subscribeToMessages();
    } else if (selectedUser?._id === 'ai-bot') {
      getMessages('ai-bot');
    }
  }, [selectedUser?._id, selectedGroup?._id, getMessages, getGroupMessages, unsubscribeFromMessages, subscribeToMessages]);

  useEffect(() => {
    let isCancelled = false;
    let intervalId;
    async function poll() {
      if (!authUser || !selectedUser || selectedUser._id === 'ai-bot') return;
      try {
        const res = await axiosInstance.get(`/messages/${selectedUser._id}`, { params: { limit: 30 } });
        let incoming = res.data.messages || [];
        const myPrivateKey = await getPrivateKey(authUser._id);
        const publicKeyCache = new Map();
        const decryptPromises = incoming.map(async (msg) => {
          if (msg.senderId !== 'ai-bot' && msg.text && typeof msg.text === 'string' && msg.text.includes(':')) {
            try {
              let otherUserId = msg.senderId === authUser._id ? msg.receiverId : msg.senderId;
              let otherPublicKey = publicKeyCache.has(otherUserId)
                ? publicKeyCache.get(otherUserId)
                : await fetchUserPublicKey(otherUserId);
              publicKeyCache.set(otherUserId, otherPublicKey);
              const otherPublicKeyImported = await importPublicKey(
                typeof otherPublicKey === 'string' ? JSON.parse(otherPublicKey) : otherPublicKey
              );
              const sharedSecret = await deriveSharedSecret(myPrivateKey, otherPublicKeyImported);
              msg.text = await decryptMessage(msg.text, sharedSecret);
              if (
                msg.replyToText &&
                typeof msg.replyToText === 'string' &&
                /^[A-Za-z0-9+/=\-_]+:[A-Za-z0-9+/=\-_]+$/.test(msg.replyToText)
              ) {
                try { msg.replyToText = await decryptMessage(msg.replyToText, sharedSecret); } catch {}
              }
            } catch (e) {
              msg.text = '[Unable to decrypt]';
            }
          }
          return msg;
        });
        incoming = await Promise.all(decryptPromises);
    
        if (isCancelled) return;
        const current = useChatStore.getState().messages || [];
        let updatedMessages = [...current];
        let hasChanges = false;
        const incomingIdSet = new Set(incoming.map(m => String(m._id)));
        const oldestIncomingTime = incoming.length ? Math.min(...incoming.map(m => new Date(m.createdAt || 0).getTime())) : 0;

        incoming.forEach(inc => {
          const id = String(inc._id);
          const idx = updatedMessages.findIndex(m => String(m._id) === id);
          if (idx >= 0) {
            const existing = updatedMessages[idx];
            let changed = false;
            if (existing.seen !== inc.seen) { existing.seen = inc.seen; changed = true; }
            if (existing.delivered !== inc.delivered) { existing.delivered = inc.delivered; changed = true; }
            const fields = ['text','image','video','audio','document','fileName','isDeletedForEveryone'];
            for (const f of fields) {
              const prevVal = existing[f];
              const nextVal = inc[f];
              if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) { existing[f] = nextVal; changed = true; }
            }
            if (inc.isDeletedForEveryone) {
              if (existing.text !== 'this message is deleted' || existing.image || existing.video || existing.audio || existing.document || existing.fileName) {
                existing.text = 'this message is deleted';
                existing.image = null; existing.video = null; existing.audio = null; existing.document = null; existing.fileName = null;
                changed = true;
              }
            }
            if (changed) hasChanges = true;
          } else {
            hasChanges = true;
            updatedMessages.push(inc);
          }
        });

        // Remove recently deleted messages (that the API filtered out for me)
        if (incoming.length) {
          const beforeFilterLen = updatedMessages.length;
          updatedMessages = updatedMessages.filter(m => {
            const t = new Date(m.createdAt || 0).getTime();
            if (t >= oldestIncomingTime) {
              return incomingIdSet.has(String(m._id));
            }
            return true;
          });
          if (beforeFilterLen !== updatedMessages.length) hasChanges = true;
        }

        if (hasChanges) {
          updatedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          useChatStore.setState({ messages: updatedMessages });
          localStorage.setItem(`chat-messages-${selectedUser._id}`, JSON.stringify(updatedMessages));
        }
        try {
          await axiosInstance.post(`/messages/read/${selectedUser._id}`);
        } catch {}
      } catch {}
    }
    intervalId = setInterval(poll, 250);
    poll();
    return () => { isCancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [authUser, selectedUser]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sortedMessages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };
    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu.visible]);

  useEffect(() => {
    if (!searchQuery) {
      setTotalMatches(0);
      return;
    }
    const matches = sortedMessages.reduce((acc, msg, idx) => {
      if (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        acc.push(idx);
      }
      return acc;
    }, []);
    setTotalMatches(matches.length);
    if (matches.length > 0 && messageRefs.current[matches[currentMatch]]) {
      messageRefs.current[matches[currentMatch]].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchQuery, currentMatch, sortedMessages, setTotalMatches]);

  useLayoutEffect(() => {
    if (contextMenu.visible && contextMenuRef.current && chatAreaRef.current) {
      const menu = contextMenuRef.current;
      const chatRect = chatAreaRef.current.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let newY = contextMenu.y;
      if (contextMenu.y + menuRect.height > chatRect.height) {
        newY = Math.max(0, chatRect.height - menuRect.height - 50);
        setContextMenu((cm) => ({ ...cm, y: newY }))
      }
    }
  }, [contextMenu.visible]);

  const handleContextMenu = (e, messageId) => {
    e.preventDefault();
    e.stopPropagation();
    const chatRect = chatAreaRef.current?.getBoundingClientRect();
    if (chatRect) {
      let x = e.clientX - chatRect.left - 100;
      let y = e.clientY - chatRect.top;
      const menuWidth = 220;
      const menuHeight = 260;

      if (x + menuWidth > chatRect.width) x = chatRect.width - menuWidth;
      if (y + menuHeight > chatRect.height) y = chatRect.height - menuHeight;
      if (x < 0) x = 0;
      if (y < 0) y = 0;

      const inputBarHeight = inputBarRef.current?.offsetHeight || 60;
      if (y + menuHeight > chatRect.height - inputBarHeight) {
        y = chatRect.height - menuHeight - inputBarHeight;
      }

      setContextMenu({ visible: true, x, y, messageId });
    } else {
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, messageId });
    }
  };

  const forwardMessage = async (messageId, recipientId) => {
    try {
      const message = messages.find(m => m._id === messageId);
      if (!message) return false;

      const recipientUser = users.find(u => u._id === recipientId);
      if (!recipientUser) throw new Error("Recipient not found");

      const messageData = {
        text: message.text,
        image: message.image,
        video: message.video,
        audio: message.audio,
        document: message.document,
        fileName: message.fileName,
        isForwarded: true,
        originalSender: message.senderId,
        originalMessageId: message._id,
      };

      const originalSelectedUser = selectedUser;
      await setSelectedUser(recipientUser);
      await sendMessage(messageData);
      await setSelectedUser(originalSelectedUser);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleMenuAction = async (action) => {
    const msg = messages.find((m) => m._id === contextMenu.messageId);
    if (!msg) return setContextMenu({ ...contextMenu, visible: false });

    try {
      switch (action) {
        case "Reply":
          setReplyTo(msg);
          break;
        case "Copy":
          let copyText = "";
          if (msg.text) copyText = msg.text;
          else if (msg.image) copyText = `Image: ${msg.image}`;
          else if (msg.video) copyText = `Video: ${msg.video}`;
          else if (msg.audio) copyText = `Audio: ${msg.audio}`;
          else if (msg.document) copyText = `Document: ${msg.fileName || "Document"} ${msg.document}`;
          else {
            toast.error("No content to copy", { duration: 2000 });
            break;
          }

          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(copyText).then(
              () => toast.success("Copied to clipboard", { duration: 2000 }),
              (err) => {
                if (fallbackCopyTextToClipboard(copyText)) {
                  toast.success("Copied to clipboard (fallback)", { duration: 2000 });
                } else {
                  toast.error("Failed to copy", { duration: 2000 });
                }
              }
            );
          } else {
            if (fallbackCopyTextToClipboard(copyText)) {
              toast.success("Copied to clipboard (fallback)", { duration: 2000 });
            } else {
              toast.error("Failed to copy", { duration: 2000 });
            }
          }
          break;
        case "Forward":
          setShowForwardModal(true);
          break;
        case "Star":
          const newStarredStatus = !starred[msg._id];
          await updateMessage(msg._id, { isStarred: newStarredStatus });
          setStarred((prev) => ({ ...prev, [msg._id]: newStarredStatus }));
          toast.success(newStarredStatus ? "Message starred" : "Message unstarred", { duration: 2000 });
          break;
        case "Select":
          setSelectedMessages((prev) => ({
            ...prev,
            [msg._id]: !prev[msg._id],
          }));
          toast.success(selectedMessages[msg._id] ? "Message unselected" : "Message selected", { duration: 2000 });
          break;
        case "Share":
          if (navigator.share && (msg.text || msg.image || msg.video || msg.audio || msg.document)) {
            const shareData = {
              title: "Shared Message",
              text: msg.text || "Shared media message",
              url: msg.image || msg.video || msg.audio || msg.document,
            };
            await navigator.share(shareData).then(
              () => toast.success("Message shared", { duration: 2000 }),
              () => {
                const content = msg.text || msg.image || msg.video || msg.audio || msg.document || "Shared message";
                navigator.clipboard.writeText(content);
                toast.success("Message content copied to clipboard", { duration: 2000 });
              }
            );
          } else {
            const content = msg.text || msg.image || msg.video || msg.audio || msg.document || "Shared message";
            navigator.clipboard.writeText(content);
            toast.success("Message content copied to clipboard", { duration: 2000 });
          }
          break;
        case "Edit":
          setEditingMessage(msg);
          setEditInputValue(msg.text || "");
          inputRef.current?.focus();
          break;
        case "Info":
          setInfoMessageId(msg._id);
          setShowInfoModal(true);
          break;
        case "Delete":
          setShowDeleteModal(msg._id);
          break;
        default:
          break;
      }
    } catch (error) {
      if (action !== "Delete") {
        toast.error(`Failed to ${action.toLowerCase()}: ${error.message}`, { duration: 2000 });
      }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleEmojiReaction = async (emoji, msgId = contextMenu.messageId) => {
    const prevReactions = reactions[msgId] || [];
    const newReactions = prevReactions.includes(emoji)
      ? prevReactions.filter((e) => e !== emoji)
      : [...prevReactions, emoji];
    await updateMessage(msgId, { reactions: newReactions });
    setReactions((prev) => ({ ...prev, [msgId]: newReactions }));
    toast.success(`${emoji} reaction ${prevReactions.includes(emoji) ? 'removed' : 'added'}`, { duration: 2000 });
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleForward = async () => {
    if (forwardRecipientIds.length === 0) {
      toast.error("Select at least one recipient", { duration: 2000 });
      return;
    }
    try {
      for (const recipientId of forwardRecipientIds) {
        await forwardMessage(contextMenu.messageId, recipientId);
      }
      setShowForwardModal(false);
      setForwardRecipientIds([]);
      toast.success(`Message forwarded to ${forwardRecipientIds.length} recipient${forwardRecipientIds.length > 1 ? 's' : ''}`, { duration: 2000 });
    } catch (error) {
      toast.error("Failed to forward message", { duration: 2000 });
    }
  };

  const handleRecipientToggle = (recipientId) => {
    setForwardRecipientIds((prev) =>
      prev.includes(recipientId) ? prev.filter((id) => id !== recipientId) : [...prev, recipientId]
    );
  };

  const handleDeleteConfirm = async (messageId, forEveryone) => {
    setIsDeleting(messageId);
    try {
      const message = messages.find((m) => m._id === messageId);
      if (!message) throw new Error("Message not found");
  
      if (!forEveryone && message.deletedFor?.includes(authUser._id)) {
        toast.info("Message already deleted for you", { duration: 2000 });
        return;
      }
      if (forEveryone && message.isDeletedForEveryone) {
        toast.info("Message already deleted for everyone", { duration: 2000 });
        return;
      }
  
      await deleteMessage(messageId, { forEveryone });

      // Immediate UI update
      useChatStore.setState((state) => {
        if (forEveryone) {
          return {
            messages: state.messages.map((m) =>
              m._id === messageId
                ? {
                    ...m,
                    text: 'this message is deleted',
                    isDeleted: true,
                    isDeletedForEveryone: true,
                    image: null,
                    video: null,
                    audio: null,
                    document: null,
                    fileName: null,
                  }
                : m
            ),
          };
        }
        return {
          messages: state.messages.filter((m) => m._id !== messageId),
        };
      });
  
      const cachedMessages = JSON.parse(localStorage.getItem(`chat-messages-${selectedUser?._id}`) || "[]");
      let updatedCache;
      if (forEveryone) {
        updatedCache = cachedMessages.map((m) =>
          m._id === messageId ? { ...m, text: "this message is deleted", isDeleted: true, isDeletedForEveryone: true } : m
        );
      } else {
        updatedCache = cachedMessages.map((m) =>
          m._id === messageId ? { ...m, deletedFor: [...(m.deletedFor || []), authUser._id] } : m
        ).filter((m) => !m.deletedFor?.includes(authUser._id));
      }
      localStorage.setItem(`chat-messages-${selectedUser?._id}`, JSON.stringify(updatedCache));
    } catch (error) {
      toast.error("Failed to delete message", { duration: 2000 });
    } finally {
      setIsDeleting(null);
      setShowDeleteModal(null);
      setDeleteForEveryone(false);
    }
  };

  const handleDownload = (url, filename) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${filename || 'file'}`, { duration: 2000 });
    } catch (error) {
      toast.error("Failed to download file", { duration: 2000 });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const isEditable = (msg) => {
    if (!msg || msg.senderId !== authUser._id) return false;
    const now = new Date();
    const msgTime = new Date(msg.createdAt);
    const timeDiff = (now.getTime() - msgTime.getTime()) / (1000 * 60);
    return timeDiff <= 5;
  };

  const handleEditSubmit = async () => {
    if (!editingMessage || !editInputValue.trim()) {
      toast.error("Message cannot be empty", { duration: 2000 });
      return;
    }
    try {
      const res = await axiosInstance.patch(`/messages/${editingMessage._id}`, { text: editInputValue });
      if (res.data && res.data.success) {
        setEditingMessage(null);
        setEditInputValue("");
        toast.success("Message edited", { duration: 2000 });
      } else {
        toast.error("Failed to edit message", { duration: 2000 });
      }
    } catch (err) {
      toast.error("Failed to edit message", { duration: 2000 });
    }
  };

  const handleEditCancel = () => {
    setEditingMessage(null);
    setEditInputValue("");
  };

  const handleOpenEmojiPicker = (messageId) => {
    setShowEmojiPicker(true);
    setEmojiPickerMessageId(messageId);
  };

  const handleEmojiSelect = async (emoji) => {
    if (!emojiPickerMessageId) return;
    await handleEmojiReaction(emoji.native, emojiPickerMessageId);
    setShowEmojiPicker(false);
    setEmojiPickerMessageId(null);
  };

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClickOutside(event) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
        setEmojiPickerMessageId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const isSelectMode = Object.values(selectedMessages).some(Boolean);

  const handleSelectMessage = (id) => {
    setSelectedMessages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCancelSelect = () => setSelectedMessages({});

  const handleStarSelected = () => {
    Object.keys(selectedMessages).forEach((id) => {
      if (selectedMessages[id]) updateMessage(id, { isStarred: true });
    });
    handleCancelSelect();
  };

  const handleCopySelected = () => {
    const texts = sortedMessages.filter(m => selectedMessages[m._id] && m.text).map(m => m.text);
    if (texts.length) navigator.clipboard.writeText(texts.join('\n'));
    handleCancelSelect();
  };

  const handleForwardSelected = () => {
    const firstSelected = Object.keys(selectedMessages).find(id => selectedMessages[id]);
    if (firstSelected) setShowForwardModal(true);
    handleCancelSelect();
  };

  const handleDeleteSelected = () => {
    Object.keys(selectedMessages).forEach((id) => {
      if (selectedMessages[id]) handleDeleteConfirm(id, false);
    });
    handleCancelSelect();
  };

  useEffect(() => {
    if (selectedUser?._id && selectedUser._id !== 'ai-bot') {
      axiosInstance.post(`/messages/read/${selectedUser._id}`).then(() => {
        if (typeof getUsers === 'function') getUsers(false);
      }).catch(() => {});
    }
  }, [selectedUser?._id]);

  useEffect(() => {
    if (!selectedUser?._id || !messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderId === selectedUser._id && lastMsg.readBy && !lastMsg.readBy.includes(authUser._id)) {
      axiosInstance.post(`/messages/read/${selectedUser._id}`).then(() => {
        if (typeof getUsers === 'function') getUsers(false);
      }).catch(() => {});
    }
  }, [messages, selectedUser?._id, authUser._id]);

  const handleSendMessage = async (messageData) => {
    if (selectedUser?._id === 'ai-bot') {
      setIsAiThinking(true);
      try {
        await sendMessage(messageData);
      } finally {
        setIsAiThinking(false);
      }
    } else {
      await sendMessage(messageData);
    }
  };

  const mediaMessages = messages.filter(m => m.image || m.video || m.audio);
  const docsMessages = messages.filter(m => m.document);
  const linksMessages = messages.filter(m => m.text && m.text.match(/https?:\/\//));

  const renderTabBar = () => (
    <div className="block lg:hidden w-full flex border-b border-base-300 bg-base-100 sticky top-0 z-30">
      {['media', 'docs', 'links'].map(tab => (
        <button
          key={tab}
          className={`flex-1 py-2 text-center font-medium transition border-b-2 ${activeTabView === tab ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500'}`}
          onClick={() => setActiveTabView(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
      <button className="px-3 text-gray-400" onClick={() => setActiveTabView(null)}>✕</button>
    </div>
  );

  const renderTabContent = () => {
    let items = [];
    let label = '';
    if (activeTabView === 'media') {
      items = mediaMessages;
      label = 'Media';
    } else if (activeTabView === 'docs') {
      items = docsMessages;
      label = 'Docs';
    } else if (activeTabView === 'links') {
      items = linksMessages;
      label = 'Links';
    }
    return (
      <div className="block lg:hidden w-full h-full flex flex-col bg-base-100">
        {renderTabBar()}
        <div className="p-4">
          <h2 className="font-bold text-lg mb-2">Recent {label}</h2>
          {items.length === 0 && <div className="text-gray-400">No {label.toLowerCase()} found.</div>}
          <div className="grid grid-cols-3 gap-3">
            {activeTabView === 'media' && items.map(m => (
              <img key={m._id} src={m.image || m.video || m.audio} alt="media" className="rounded-lg object-cover w-full h-24 cursor-pointer" onClick={() => window.open(m.image || m.video || m.audio, '_blank')} />
            ))}
            {activeTabView === 'docs' && items.map(m => (
              <a key={m._id} href={m.document} target="_blank" rel="noopener noreferrer" className="block p-2 bg-base-200 rounded-lg truncate text-blue-600 hover:underline">{m.fileName || 'Document'}</a>
            ))}
            {activeTabView === 'links' && items.map(m => (
              <a key={m._id} href={m.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0]} target="_blank" rel="noopener noreferrer" className="block p-2 bg-base-200 rounded-lg truncate text-blue-600 hover:underline">{m.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0]}</a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMediaDocsLinksTabs = () => {
    return (
      <div className="block lg:hidden h-full w-full">
        <div className="flex items-center border-b border-base-300 bg-base-100 sticky top-0 z-10">
          <button
            className={`flex-1 py-2 text-center ${mediaDocsLinksTab === 'media' ? 'font-bold border-b-2 border-primary' : ''}`}
            onClick={() => setMediaDocsLinksTab('media')}
          >
            Media
          </button>
          <button
            className={`flex-1 py-2 text-center ${mediaDocsLinksTab === 'docs' ? 'font-bold border-b-2 border-primary' : ''}`}
            onClick={() => setMediaDocsLinksTab('docs')}
          >
            Docs
          </button>
          <button
            className={`flex-1 py-2 text-center ${mediaDocsLinksTab === 'links' ? 'font-bold border-b-2 border-primary' : ''}`}
            onClick={() => setMediaDocsLinksTab('links')}
          >
            Links
          </button>
          <button
            className="px-3 py-2 text-gray-400 hover:text-gray-700"
            onClick={() => setActiveTabView(null)}
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-120px)] p-4">
          {mediaDocsLinksTab === 'media' && (
            <div>
              {mediaMessages.length === 0 ? (
                <div className="text-center text-gray-400">No media found</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaMessages.map((m) => (
                    <div key={m._id} className="aspect-square bg-base-200 rounded overflow-hidden flex items-center justify-center">
                      {m.image && <img src={m.image} alt="media" className="object-cover w-full h-full" />}
                      {m.video && <video src={m.video} controls className="object-cover w-full h-full" />}
                      {m.audio && <audio src={m.audio} controls className="w-full" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {mediaDocsLinksTab === 'docs' && (
            <div>
              {docsMessages.length === 0 ? (
                <div className="text-center text-gray-400">No documents found</div>
              ) : (
                <ul className="space-y-2">
                  {docsMessages.map((m) => (
                    <li key={m._id} className="bg-base-200 rounded p-2 flex items-center">
                      <span className="mr-2">📄</span>
                      <a href={m.document} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {m.documentName || 'Document'}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {mediaDocsLinksTab === 'links' && (
            <div>
              {linksMessages.length === 0 ? (
                <div className="text-center text-gray-400">No links found</div>
              ) : (
                <ul className="space-y-2">
                  {linksMessages.map((m) => (
                    <li key={m._id} className="bg-base-200 rounded p-2">
                      <a href={m.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0]} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {m.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const chatListRef = useRef(null);
  const prevScrollHeight = useRef(0);

  const handleChatScroll = async (e) => {
    const { scrollTop } = e.target;
    if (scrollTop === 0 && hasMoreMessages && !isLoadingMore && selectedUser?._id && selectedUser._id !== 'ai-bot') {
      prevScrollHeight.current = e.target.scrollHeight;
      await loadOlderMessages(selectedUser._id);
      setTimeout(() => {
        if (chatListRef.current) {
          chatListRef.current.scrollTop = chatListRef.current.scrollHeight - prevScrollHeight.current;
        }
      }, 50);
    }
    setShowScrollDown(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);
  };

  useEffect(() => {
    async function decryptMediaMessages() {
      if (!authUser || !selectedUser || !messages.length) return;
      let otherUserId = selectedUser._id;
      if (otherUserId === 'ai-bot') return;
      const myPrivateKey = await getPrivateKey(authUser._id);
      const otherPublicKeyRaw = await fetchUserPublicKey(otherUserId);
      const otherPublicKey = typeof otherPublicKeyRaw === 'string' ? JSON.parse(otherPublicKeyRaw) : otherPublicKeyRaw;
      const otherPublicKeyImported = await importPublicKey(otherPublicKey);
      const sharedSecret = await deriveSharedSecret(myPrivateKey, otherPublicKeyImported);
      const decrypted = await Promise.all(messages.map(async (msg) => {
        const newMsg = { ...msg };
        for (const field of ['image', 'audio', 'video', 'document']) {
          if (isProbablyEncrypted(newMsg[field])) {
            try {
              newMsg[field] = await decryptMessage(newMsg[field], sharedSecret);
            } catch {
              newMsg[field] = '[Unable to decrypt]';
            }
          }
        }
        return newMsg;
      }));
      setMessages(decrypted);
    }
    decryptMediaMessages();
  }, [messages, authUser, selectedUser, setMessages]);

  useEffect(() => {
    const root = chatListRef.current;
    if (!root) return;

    const entriesIndex = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const topmost = visible[0].target;
          const meta = entriesIndex.get(topmost);
          if (meta && meta.label && meta.label !== currentDateLabel) {
            setCurrentDateLabel(meta.label);
          }
        } else {
          let best = null;
          for (const el of entriesIndex.keys()) {
            const rect = el.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const offsetTop = rect.top - rootRect.top;
            if (offsetTop <= 12) {
              if (!best || offsetTop > best.offsetTop) best = { el, offsetTop };
            }
          }
          if (best) {
            const meta = entriesIndex.get(best.el);
            if (meta && meta.label && meta.label !== currentDateLabel) setCurrentDateLabel(meta.label);
          }
        }
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: [0.5] }
    );

    Object.entries(dateHeaderRefs.current).forEach(([idx, el]) => {
      if (el) {
        const label = el.dataset?.label || el.textContent || "";
        entriesIndex.set(el, { index: Number(idx), label });
        observer.observe(el);
      }
    });

    if (!currentDateLabel && messages.length) {
      const last = messages[messages.length - 1];
      const initial = getDateLabel(last.createdAt);
      if (initial !== currentDateLabel) setCurrentDateLabel(initial);
    }

    return () => observer.disconnect();
  }, [messages, currentDateLabel]);

  const chatBackgroundStyle = useMemo(() => {
    let effective = wallpaper;
    if (wallpaperMode === 'per-chat' && selectedUser?._id) {
      effective = perUserWallpapers?.[selectedUser._id] || wallpaper;
    }
    if (!effective || effective.type === 'none') return {};
    if (effective.type === 'image' && effective.value) {
      return {
        backgroundImage: `url(${effective.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    if (effective.type === 'pattern' && effective.value) {
      return { background: effective.value };
    }
    return {};
  }, [wallpaper, wallpaperMode, perUserWallpapers, selectedUser?._id]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto custom-scrollbar p-2 sm:p-4">
        <MessageSkeleton />
        <MessageInput ref={inputBarRef} replyTo={replyTo} clearReplyTo={() => setReplyTo(null)} onSendMessage={handleSendMessage} isAiThinking={isAiThinking} />
      </div>
    );
  }

  return (
    <div ref={chatAreaRef} className="flex-1 flex flex-col overflow-auto relative p-2 sm:p-4" style={chatBackgroundStyle}>
      {currentDateLabel && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-2 z-30"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
        >
          <div className="px-3 py-1 rounded-full bg-base-200/80 dark:bg-base-300/80 backdrop-blur text-xs font-semibold text-base-content">
            {currentDateLabel}
          </div>
        </div>
      )}
      {activeTabView === 'mediaDocsLinks' && renderMediaDocsLinksTabs()}
      {activeTabView !== 'mediaDocsLinks' && (
        <>
          <div
            ref={chatListRef}
            className="flex-1 overflow-auto custom-scrollbar p-1 sm:p-4 space-y-4"
            onScroll={handleChatScroll}
            style={{ position: "relative" }}
          >
            {isLoadingMore && hasMoreMessages && (
              <div className="flex justify-center py-2">
                <span className="loader inline-block w-6 h-6 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></span>
              </div>
            )}
            {isSelectMode && (
              <div className="sticky top-1 sm:-top-4 z-20 flex items-center justify-between px-4 py-2 rounded-lg bg-white dark:bg-[#202C33] border-b border-gray-200 dark:border-gray-700 shadow-sm" style={{ minHeight: 56 }}>
                <span className="font-medium text-[#111B21] dark:text-[#E9EDEF]">{Object.values(selectedMessages).filter(Boolean).length} selected</span>
                <div className="flex items-center gap-4">
                  <button onClick={handleStarSelected} title="Star">
                    <Star className="w-5 h-5 text-[#111B21] dark:text-[#E9EDEF]" />
                  </button>
                  <button onClick={handleCopySelected} title="Copy">
                    <Copy className="w-5 h-5 text-[#111B21] dark:text-[#E9EDEF]" />
                  </button>
                  <button onClick={handleForwardSelected} title="Forward">
                    <Forward className="w-5 h-5 text-[#111B21] dark:text-[#E9EDEF]" />
                  </button>
                  <button onClick={handleDeleteSelected} title="Delete">
                    <Trash2 className="w-5 h-5 text-[#111B21] dark:text-[#E9EDEF]" />
                  </button>
                  <button className="ml-2 px-3 py-1 rounded-lg bg-[#2A2A2A] border text-white dark:text-white" onClick={handleCancelSelect}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {filteredMessages.map((message, index) => {
              const prevMsg = filteredMessages[index - 1];
              const showDate =
                index === 0 ||
                (prevMsg && new Date(prevMsg.createdAt).toDateString() !== new Date(message.createdAt).toDateString());
              const messageDate = getDateLabel(message.createdAt);
              const hideInlineDate = currentDateLabel === messageDate;

              let isMatch = false;
              let isCurrent = false;
              if (searchQuery && message.text && message.text.toLowerCase().includes(searchQuery.toLowerCase())) {
                const matchIndices = filteredMessages.reduce((acc, msg, idx) => {
                  if (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())) acc.push(idx);
                  return acc;
                }, []);
                isCurrent = matchIndices[currentMatch] === index;
                isMatch = true;
              }

              const isAiChat = selectedUser?._id === 'ai-bot';
              const senderId = typeof message.senderId === 'object' && message.senderId?._id
                ? message.senderId._id
                : message.senderId;
              const isUserMsg = isAiChat
                ? message.senderId === 'me'
                : senderId === authUser._id;
              const isAiMsg = isAiChat && message.senderId === 'ai-bot';
              const chatAlign = isUserMsg ? 'chat-end' : 'chat-start';

              console.log({
                messageId: message._id,
                authUserId: authUser._id,
                messageSenderId: message.senderId,
                senderIdType: typeof message.senderId,
                senderIdValue: senderId,
                isUserMsg,
                chatAlign,
                isGroup: !!selectedGroup,
              });

              return (
                <React.Fragment key={message._id}>
                  {showDate && !hideInlineDate && (
                    <div className="flex justify-center my-2">
                      <span
                        className="px-3 py-1 rounded-full bg-base-200/80 dark:bg-base-300/80 backdrop-blur text-xs font-semibold text-base-content shadow-sm select-none"
                        ref={(el) => {
                          if (el) dateHeaderRefs.current[index] = el;
                          else delete dateHeaderRefs.current[index];
                        }}
                        data-label={messageDate}
                      >
                        {messageDate}
                      </span>
                    </div>
                  )}
                  {showDate && hideInlineDate && (
                    <div className="flex justify-center my-2">
                      <span
                        className="px-3 py-1 rounded-full bg-base-200/80 dark:bg-base-300/80 backdrop-blur text-xs font-semibold text-base-content opacity-0"
                        ref={(el) => {
                          if (el) dateHeaderRefs.current[index] = el;
                          else delete dateHeaderRefs.current[index];
                        }}
                        data-label={messageDate}
                      >
                        {messageDate}
                      </span>
                    </div>
                  )}
                  <div className="relative flex items-center">
                    {isSelectMode && (
                      <span
                        onClick={() => handleSelectMessage(message._id)}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: selectedMessages[message._id] ? 'none' : '2px solid #d1d7db',
                          background: selectedMessages[message._id] ? '#25D366' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          zIndex: 2,
                        }}
                      >
                        {selectedMessages[message._id] && (
                          <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M5 8.5L7 10.5L11 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                    )}
                    <div
                      className={`chat ${chatAlign}`}
                      style={{
                        position: 'relative',
                        marginLeft: isSelectMode ? 40 : 0,
                        width: '100%',
                        transition: 'margin 0.2s',
                      }}
                      ref={el => {
                        if (isMatch) messageRefs.current[index] = el;
                        if (index === filteredMessages.length - 1) messageEndRef.current = el;
                      }}
                    >
                      <div className="chat-image avatar">
                        <div className="size-10 sm:size-10 rounded-full overflow-hidden">
                          {isAiMsg ? (
                            <img
                              src="/aura-logo-rem-bg.png"
                              alt="Aura AI"
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                          ) : isAiChat && isUserMsg ? (
                            <img
                              src={authUser.profilePic || "/avatar.png"}
                              alt="Profile Pic"
                              loading="lazy"
                              onError={e => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                          ) : (
                            <img
                              src={senderId === authUser._id ? authUser.profilePic || "/avatar.png" : (selectedGroup ? (message.senderId?.profilePic || "/avatar.png") : selectedUser?.profilePic || "/avatar.png")}
                              alt="Profile Pic"
                              loading="lazy"
                              onError={e => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        className={`chat-bubble flex flex-col px-3 py-2 rounded-2xl bg-base-200 dark:bg-base-300 shadow max-w-[70vw] sm:max-w-md lg:max-w-lg ${starred[message._id] ? "ring-2 ring-yellow-400" : ""} ${selectedMessages[message._id] ? "bg-primary/20" : ""} ${isMatch ? (isCurrent ? "ring-2 ring-primary" : "") : ""}`}
                        onContextMenu={(e) => handleContextMenu(e, message._id)}
                      >
                        {selectedGroup && senderId !== authUser._id && (
                          <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                            {message.senderId?.fullName || "Unknown User"}
                          </div>
                        )}
                        {selectedGroup && senderId === authUser._id && (
                          <div className="text-xs font-semibold text-primary mb-1">
                            You
                          </div>
                        )}
                        {message.statusReply && (
                          <div className="mb-1 flex items-center">
                            <div className="h-full min-h-[40px] w-1 rounded-l bg-violet-500 mr-2 self-stretch" />
                            <div className="flex-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-2 py-1 flex gap-2 items-center overflow-hidden">
                              {message.statusReply.statusType === 'image' && message.statusReply.mediaUrl && (
                                <img
                                  src={message.statusReply.mediaUrl}
                                  alt="status"
                                  className="w-10 h-10 rounded object-cover shrink-0"
                                />
                              )}
                              {message.statusReply.statusType === 'video' && (
                                <div className="w-10 h-10 rounded bg-violet-200 dark:bg-violet-800 flex items-center justify-center shrink-0">
                                  <span className="text-violet-700 dark:text-violet-200 text-xs font-bold">▶</span>
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-violet-700 dark:text-violet-300 mb-0.5">
                                  {message.statusReply.ownerName ? `${message.statusReply.ownerName}'s status` : 'Status'}
                                </span>
                                <span className="text-xs text-violet-900 dark:text-violet-100 truncate">
                                  {message.statusReply.statusType === 'text'
                                    ? (message.statusReply.text || 'Text status')
                                    : message.statusReply.statusType === 'video'
                                    ? '🎥 Video'
                                    : '🖼 Photo'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {message.replyTo && (
                          <div className="mb-1 flex items-center">
                            <div className="h-8 w-1 rounded-l bg-green-500 mr-2" />
                            <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-2 py-1 flex flex-col justify-center">
                              <span className="text-xs font-bold text-green-700 dark:text-green-300 mb-0.5">
                                {message.replyToSenderId === authUser._id
                                  ? "You"
                                  : selectedGroup
                                    ? (message.replyToSenderName || "Unknown")
                                    : message.replyToSenderId === selectedUser?._id
                                      ? selectedUser?.fullName
                                      : message.replyToSenderName
                                        ? message.replyToSenderName
                                        : "Unknown"}
                              </span>
                              <span className="text-xs text-green-900 dark:text-green-100 truncate">
                                {message.replyToText || "Media/Document"}
                              </span>
                            </div>
                          </div>
                        )}
                        {reactions[message._id]?.length > 0 && (
                          <div className="flex gap-1 mb-1 flex-wrap">
                            {reactions[message._id].map((emoji) => (
                              <span key={emoji} className="text-base sm:text-lg select-none cursor-pointer" onClick={() => handleEmojiReaction(emoji, message._id)}>
                                {emoji}
                              </span>
                            ))}
                            <button
                              className="text-base sm:text-lg opacity-60 p-1"
                              aria-label="More reactions"
                              onClick={() => handleOpenEmojiPicker(message._id)}
                            >+</button>
                          </div>
                        )}
                        {(message.image || message.type === "image") && (
                          <div className="relative group flex justify-center">
                            <img
                              src={message.image || message.content || message.text}
                              alt="Image"
                              className="max-w-full max-h-[200px] sm:max-h-[300px] object-contain rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity bg-zinc-100 dark:bg-zinc-800 shadow-md"
                              loading="lazy"
                              onClick={() => window.open(message.image || message.content || message.text, "_blank")}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
                              <span className="text-gray-500 dark:text-gray-400 text-sm">Image failed to load</span>
                            </div>
                            <button
                              onClick={() => handleDownload(message.image || message.content || message.text, "image.jpg")}
                              className="absolute top-1 right-1 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Download image"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {(message.video || message.type === "video") && (
                          <div className="relative group mb-2 flex justify-center">
                            <video
                              className="max-w-full h-auto max-h-[200px] sm:max-h-[300px] rounded-lg shadow-md"
                              controls
                              preload="metadata"
                              onPlay={() => setPlayingVideo(message._id)}
                              onPause={() => setPlayingVideo(null)}
                              onEnded={() => setPlayingVideo(null)}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            >
                              <source src={message.video || message.content || message.text} type="video/mp4" />
                              <source src={message.video || message.content || message.text} type="video/webm" />
                              <source src={message.video || message.content || message.text} type="video/ogg" />
                              Your browser does not support the video tag.
                            </video>
                            <div className="hidden items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
                              <span className="text-gray-500 dark:text-gray-400 text-sm">Video failed to load</span>
                            </div>
                            <button
                              onClick={() => handleDownload(message.video || message.content || message.text, "video.mp4")}
                              className="absolute top-1 right-1 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Download video"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {(message.audio || message.type === "audio") && (
                          <div className="flex items-center gap-3 mb-2 px-0 py-0">
                            <div className="w-full">
                              <WhatsAppAudioPreview
                                audioUrl={message.audio}
                                hideDeleteButton={true}
                              />
                            </div>
                            <button
                              onClick={() => handleDownload(message.audio, "audio.webm")}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex-shrink-0 transition-colors ml-2"
                              title="Download audio"
                              style={{ minWidth: 32 }}
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {(message.document || message.type === "document") && (
                          <div className="flex items-center gap-3 mb-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl max-w-full sm:max-w-[320px] shadow-sm border border-blue-200 dark:border-blue-700">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                              <File className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {message.fileName || "Document"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {message.fileSize ? formatFileSize(message.fileSize) : 'Document'}
                              </div>
                              {message.document && (
                                <a
                                  href={message.document || message.content || message.text}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline mt-1 block"
                                  title="Open document"
                                >
                                  Open
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => handleDownload(message.document || message.content || message.text, message.fileName || "document")}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0 transition-colors"
                              title="Download document"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {message.text && message.text.toLowerCase() !== "this message is deleted" && (
                          <div
                            className={`break-words text-base-content ${isBigEmoji(message.text) ? "text-5xl sm:text-6xl" : "text-sm sm:text-base"}`}
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(marked(highlightText(message.text, searchQuery))),
                            }}
                          />
                        )}
                        {message.text?.toLowerCase() === "this message is deleted" && (
                          <div className="text-sm sm:text-base flex items-center gap-2 text-base-content">
                            This message was deleted
                          </div>
                        )}
                        <div className="mt-1 self-end flex items-center gap-1">
                          {message.isEdited && (
                            <span className="text-[10px] leading-none text-gray-400 dark:text-gray-500 mr-1">Edited</span>
                          )}
                          <time className="text-xs opacity-60 text-base-content">
                            {formatMessageTime(message.createdAt)}
                          </time>
                          {message.text?.toLowerCase() !== "this message is deleted" && renderTick(message)}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-[#F0F0F0] dark:bg-[#202C33] rounded-xl p-6 w-full max-w-sm shadow-lg">
                  <h2 className="text-xl font-semibold mb-2 text-[#075E54] dark:text-[#25D366]">Delete message?</h2>
                  <p className="mb-4 text-sm text-[#111B21] dark:text-[#E9EDEF]">You can delete messages for everyone or just for yourself.</p>
                  <div className="mb-6">
                    <label className="flex items-center gap-3 mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={!deleteForEveryone}
                        onChange={() => setDeleteForEveryone(false)}
                        className="form-radio h-5 w-5 text-[#075E54] border-gray-300 focus:ring-[#25D366]"
                      />
                      <span className="text-base text-[#111B21] dark:text-[#E9EDEF]">Delete for me</span>
                    </label>
                    {messages.find((m) => m._id === showDeleteModal)?.senderId === authUser._id && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          checked={deleteForEveryone}
                          onChange={() => setDeleteForEveryone(true)}
                          className="form-radio h-5 w-5 text-[#075E54] border-gray-300 focus:ring-[#25D366]"
                        />
                        <span className="text-base text-[#111B21] dark:text-[#E9EDEF]">Delete for everyone</span>
                      </label>
                    )}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      className="flex-1 py-2 rounded bg-[#EA4335] text-white font-semibold hover:bg-[#c62828] transition"
                      onClick={() => handleDeleteConfirm(showDeleteModal, deleteForEveryone)}
                    >
                      Delete
                    </button>
                    <button
                      className="flex-1 py-2 rounded bg-[#F0F0F0] dark:bg-[#202C33] text-[#075E54] dark:text-[#25D366] font-semibold hover:bg-[#e0e0e0] dark:hover:bg-[#263238] transition border border-[#075E54] dark:border-[#25D366]"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            <MessageInfoModal
              messageId={infoMessageId}
              open={showInfoModal}
              onClose={() => setShowInfoModal(false)}
            />
            {showForwardModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-base-100 dark:bg-base-300 rounded-lg p-4 sm:p-6 w-full max-w-[90vw] sm:max-w-md">
                  <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Forward Message</h2>
                  <div className="mb-3 sm:mb-4 max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar">
                    {users.filter(user => user._id !== authUser._id).map((user) => (
                      <label key={user._id} className="flex items-center gap-2 p-2 hover:bg-base-200 dark:hover:bg-base-400 rounded">
                        <input
                          type="checkbox"
                          checked={forwardRecipientIds.includes(user._id)}
                          onChange={() => handleRecipientToggle(user._id)}
                          className="checkbox checkbox-primary w-5 h-5"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full overflow-hidden">
                            <img
                              src={user.profilePic || "/avatar.png"}
                              alt={user.fullName}
                              className="w-full h-full object-cover"
                              onError={e => { e.target.onerror = null; e.target.src = "/avatar.png"; }}
                            />
                          </div>
                          <span className="text-sm sm:text-base font-medium">{user.fullName}</span>
                        </div>
                      </label>
                    ))}
                    {users.filter(user => user._id !== authUser._id).length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-2">No users available to forward to</p>
                        <p className="text-xs text-gray-400">Start a conversation with someone to forward messages</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-600 text-black dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-sm sm:text-base"
                      onClick={() => {
                        setShowForwardModal(false);
                        setForwardRecipientIds([]);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 sm:px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/80 text-sm sm:text-base disabled:opacity-50"
                      onClick={handleForward}
                      disabled={forwardRecipientIds.length === 0}
                    >
                      Forward ({forwardRecipientIds.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
            {editingMessage && (
              <div className="relative w-full px-2 sm:px-4 mb-2 bg-[#F0F0F0] dark:bg-[#202C33] rounded-xl p-3 shadow-md border border-[#075E54] dark:border-[#25D366]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Edit className="w-5 h-5 text-[#075E54] dark:text-[#25D366]" />
                    <span className="text-sm font-semibold text-[#075E54] dark:text-[#25D366]">Editing Message</span>
                  </div>
                  <button
                    className="text-[#075E54] dark:text-[#25D366] hover:text-[#064c45] dark:hover:text-[#1ebb56] transition"
                    onClick={handleEditCancel}
                    aria-label="Cancel edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 p-2 rounded-lg border border-[#075E54] dark:border-[#25D366] bg-white dark:bg-[#2A3942] text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    value={editInputValue}
                    onChange={e => setEditInputValue(e.target.value)}
                    autoFocus
                    placeholder="Edit your message..."
                    onKeyPress={(e) => e.key === "Enter" && handleEditSubmit()}
                  />
                  <button
                    className="px-4 py-2 bg-[#075E54] dark:bg-[#25D366] text-white rounded-lg hover:bg-[#064c45] dark:hover:bg-[#1ebb56] transition disabled:opacity-50"
                    onClick={handleEditSubmit}
                    disabled={!editInputValue.trim()}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="fixed z-[10000]" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                <Picker onEmojiSelect={handleEmojiSelect} theme={document.body.classList.contains('dark') ? 'dark' : 'light'} />
              </div>
            )}
          </div>
          <div className="relative w-full px-2 sm:px-4">
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute right-4 bottom-full mb-2 z-40 bg-primary text-white rounded-full p-3 shadow-lg hover:bg-primary/80 transition"
                aria-label="Scroll to bottom"
              >
                <svg viewBox="0 0 24 24" height="28" width="28" fill="none">
                  <path
                    d="M11 13.6L6.11253 8.71253C5.72003 8.32003 5.08281 8.32285 4.69381 8.7188C4.30964 9.10983 4.31241 9.73741 4.70003 10.125L11.2669 16.6919C11.6718 17.0968 12.3282 17.0968 12.7331 16.6919L19.3 10.125C19.6876 9.73741 19.6904 9.10983 19.3062 8.7188C18.9172 8.32285 18.28 8.32003 17.8875 8.71253L13 13.6L12 14.625L11 13.6Z"
                    fill="currentColor"
                  ></path>
                </svg>
              </button>
            )}
            <MessageInput
              ref={inputBarRef}
              replyTo={replyTo}
              clearReplyTo={() => setReplyTo(null)}
              onSendMessage={handleSendMessage}
              isAiThinking={isAiThinking}
              disabled={false}
            />
          </div>
        </>
      )}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[180px] py-2 select-none"
          style={{
            left: `${contextMenu.x + chatAreaRef.current?.getBoundingClientRect().left}px`,
            top: `${contextMenu.y + chatAreaRef.current?.getBoundingClientRect().top}px`,
          }}
        >
          <div className="flex items-center justify-between px-3 pb-2 border-b border-base-200 dark:border-base-400">
            {emojiReactions.map((emoji) => (
              <button
                key={emoji}
                className="text-base sm:text-lg hover:scale-125 transition-transform p-1"
                onClick={() => handleEmojiReaction(emoji)}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button className="text-base sm:text-lg opacity-60 p-1" aria-label="More reactions" onClick={() => handleOpenEmojiPicker(contextMenu.messageId)}>+</button>
          </div>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
            onClick={() => handleMenuAction("Reply")}
          >
            <Reply className="w-5 h-5" /> Reply
          </button>
          {(messages.find((m) => m._id === contextMenu.messageId)?.text) && (
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
              onClick={() => handleMenuAction("Copy")}
            >
              <Copy className="w-5 h-5" /> Copy
            </button>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
            onClick={() => handleMenuAction("Forward")}
          >
            <Forward className="w-5 h-5" /> Forward
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
            onClick={() => handleMenuAction("Star")}
          >
            <Star className="w-5 h-5" /> {starred[contextMenu.messageId] ? "Unstar" : "Star"}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
            onClick={() => handleMenuAction("Select")}
          >
            <CheckSquare className="w-5 h-5" /> {selectedMessages[contextMenu.messageId] ? "Unselect" : "Select"}
          </button>
          <div className="border-t border-base-200 dark:border-base-400 my-2" />
          {messages.find((m) => m._id === contextMenu.messageId)?.senderId === authUser._id && (
            <>
              {isEditable(messages.find((m) => m._id === contextMenu.messageId)) && (
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
                  onMouseDown={() => handleMenuAction("Edit")}
                >
                  <Edit className="w-5 h-5" /> Edit
                </button>
              )}
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 dark:hover:bg-base-400"
                onClick={() => handleMenuAction("Info")}
              >
                <Info className="w-5 h-5" /> Info
              </button>
            </>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-base-200"
            onClick={() => handleMenuAction("Delete")}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
};

function highlightText(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-300 px-0.5 rounded">{part}</mark> : part
  );
}