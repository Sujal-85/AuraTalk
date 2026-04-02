import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "../Skeletons/SidebarSkeleton";
import { Users, Menu, Image as ImageIcon, Video as VideoIcon, File, Download, Archive, Star, Bell, Pin, Heart, CheckSquare, MessageCirclePlus, Bot, RotateCcw } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import * as ScrollArea from '@radix-ui/react-scroll-area';
import ConfirmModal from './ConfirmModal';
import DOMPurify from 'dompurify';

// Import E2EE helpers (copy from useChatStore.js)

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

export const ArchiveSidebar = () => {
  const { archivedUsers, selectedUser, setSelectedUser, isUsersLoading, unarchiveUser, isArchived } = useChatStore();
  const { onlineUsers, authUser, socket } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, user: null });

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);

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

  // Filter archived users based on search
  const filteredArchivedUsers = search.trim()
    ? archivedUsers.filter(user => user.fullName.toLowerCase().includes(search.toLowerCase()))
    : archivedUsers;

  // Add this state near the top of ArchiveSidebar
  const [decryptedLastMessages, setDecryptedLastMessages] = useState({});

  // Add this effect to decrypt last messages when archived users change
  useEffect(() => {
    async function decryptAllLastMessages() {
      if (!authUser) return;
      const newDecrypted = {};
      const { smartDecrypt } = useChatStore.getState();
      
      for (const user of filteredArchivedUsers) {
        const lastMsg = user.lastMessage;
        const msgText = lastMsg?.text ?? lastMsg?.content;
        
        if (lastMsg && typeof msgText === 'string') {
          try {
            newDecrypted[user._id] = await smartDecrypt(msgText, user._id);
          } catch (e) {
            newDecrypted[user._id] = msgText;
          }
        }
      }
      setDecryptedLastMessages(newDecrypted);
    }
    decryptAllLastMessages();
    // eslint-disable-next-line
  }, [filteredArchivedUsers, authUser]);

  // Handler for right-click
  const handleContextMenu = (e, user) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      user,
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

  const handleUnarchive = (userId) => {
    unarchiveUser(userId);
    toast.success('Chat unarchived!');
  };

  if (isUsersLoading) return <SidebarSkeleton />;

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
          relative fixed left-0 top-0 h-full bg-base-100 shadow-lg z-50 flex flex-col select-none
          lg:static lg:translate-x-0
        `}
      >
        {/* Close button for mobile */}
        <div className="flex items-center p-4 border-b border-base-300 lg:hidden">
          <button onClick={() => setIsOpen(false)} className="mr-2">
            <span className="text-2xl">×</span>
          </button>
          <div className="font-bold text-lg">Archived Chats</div>
        </div>

        {/* Mobile search bar */}
        <div className="lg:hidden px-4 pt-2 pb-1">
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input
              type="text"
              className="pl-10 pr-4 py-2 rounded-full bg-base-200 text-base w-full focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
              placeholder="Search Archived Chats"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop header */}
        <div className="border-b border-base-300 w-full p-4 lg:p-5 hidden lg:flex items-center gap-2">
          <Archive className="size-6" />
          <span className="font-medium">Archived Chats</span>
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
              placeholder="Search Archived Chats"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Archived chats list */}
        <div className="flex-1 flex flex-col overflow-auto custom-scrollbar select-none mt-4">
          {filteredArchivedUsers.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              <Archive className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
              <p className="text-lg font-medium">No archived chats</p>
              <p className="text-sm text-zinc-400 mt-2">Archived chats will appear here</p>
            </div>
          ) : (
            filteredArchivedUsers.map((user) => (
              <div
                key={user._id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-base-200 transition ${selectedUser?._id === user._id ? "bg-base-200" : ""}`}
                onClick={() => setSelectedUser(user)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user });
                }}
              >
                <div className="relative">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.name}
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
                        {user.lastMessage?.createdAt ? formatLastMessageDate(user.lastMessage.createdAt) : ""}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                    <span className="truncate w-0 flex-1">
                      {user.lastMessage ? (
                        user.lastMessage.type === "text" ? (
                          <div
                            className="truncate"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(decryptedLastMessages[user._id] ?? user.lastMessage.content) }}
                          />
                        ) : user.lastMessage.type === "image" ? (<><ImageIcon className="w-4 h-4 inline mr-1" /> Image</>)
                          : user.lastMessage.type === "video" ? (<><VideoIcon className="w-4 h-4 inline mr-1" /> Video</>)
                          : user.lastMessage.type === "document" ? (<><File className="w-4 h-4 inline mr-1" /> Document</>)
                          : ""
                      ) : ""}
                    </span>
                    {user.unreadCount > 0 && user._id !== selectedUser?._id && (
                      <span className="ml-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow">
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drag handle for resizing */}
        <div
          onMouseDown={startResizing}
          className="absolute top-0 right-0 h-full w-5 cursor-ew-resize z-50 transition-colors"
          style={{ userSelect: "none" }}
        />
      </aside>

      {/* Context menu for archived users */}
      {contextMenu.visible && contextMenu.user && (
        <div
          className="fixed z-50 bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[180px] py-2 select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" 
            onClick={() => { 
              handleUnarchive(contextMenu.user._id); 
              setContextMenu({ ...contextMenu, visible: false }); 
            }}
          >
            <RotateCcw className="w-4 h-4" /> Unarchive
          </button>
        </div>
      )}
    </>
  );
}; 