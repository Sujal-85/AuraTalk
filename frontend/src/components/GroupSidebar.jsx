import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import SidebarSkeleton from "../Skeletons/SidebarSkeleton";
import { Users, Image as ImageIcon, Video as VideoIcon, File, Plus } from "lucide-react";
import DOMPurify from "dompurify";

function formatLastMessageDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (today - messageDay) / (1000 * 60 * 60 * 24);
  if (diff === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB");
}

export const GroupSidebar = ({ onCreateGroupClick }) => {
  const { groups, loadGroupsForSidebar, selectedGroup, setSelectedGroup } = useChatStore();
  const [search, setSearch] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);

  useEffect(() => { loadGroupsForSidebar(); }, [loadGroupsForSidebar]);

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

  const filteredGroups = (Array.isArray(groups) ? groups : []).filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!Array.isArray(groups)) return <SidebarSkeleton />;

  return (
    <aside
      ref={sidebarRef}
      style={{ width: sidebarWidth, minWidth: 400, maxWidth: 500 }}
      className="relative fixed left-0 top-0 h-full bg-base-100 shadow-lg z-50 flex flex-col select-none lg:static lg:translate-x-0"
    >
      <div className="border-b border-base-300 w-full p-4 lg:p-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium">Groups</span>
        </div>
        <button
          onClick={onCreateGroupClick}
          className="btn btn-sm btn-primary gap-1 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="hidden lg:flex px-5 pt-3 pb-1">
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input
            type="text"
            className="pl-10 pr-4 py-2 rounded-full bg-base-200 text-base w-full focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
            placeholder="Search Groups"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-auto custom-scrollbar select-none mt-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-lg font-medium">No groups</p>
            <p className="text-sm text-zinc-400 mt-2">Your groups will appear here</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group._id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-base-200 transition ${selectedGroup?._id === group._id ? "bg-base-200" : ""}`}
              onClick={() => setSelectedGroup(group)}
            >
              <div className="relative">
                {group.avatar ? (
                  <img src={group.avatar} alt={group.name} className="size-10 object-cover rounded-full" />
                ) : (
                  <div className="size-10 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{group.name?.charAt(0)?.toUpperCase() || "G"}</span>
                  </div>
                )}
              </div>
              <div className="text-left w-full">
                <div className="font-medium flex items-center justify-between w-full">
                  <span className="truncate">{group.name}</span>
                  <span className="flex flex-col items-end min-w-[40px] gap-1">
                    <span className="text-xs text-zinc-400 mt-1">
                      {group.lastMessage?.createdAt ? formatLastMessageDate(group.lastMessage.createdAt) : ""}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between w-full text-sm text-zinc-400">
                  <span className="truncate w-0 flex-1">
                    {group.lastMessage ? (
                      group.lastMessage.type === "text" ? (
                        <div
                          className="truncate"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(group.lastMessage.content) }}
                        />
                      ) : group.lastMessage.type === "image" ? (
                        <><ImageIcon className="w-4 h-4 inline mr-1" /> Image</>
                      ) : group.lastMessage.type === "video" ? (
                        <><VideoIcon className="w-4 h-4 inline mr-1" /> Video</>
                      ) : group.lastMessage.type === "document" ? (
                        <><File className="w-4 h-4 inline mr-1" /> Document</>
                      ) : (
                        ""
                      )
                    ) : (
                      ""
                    )}
                  </span>
                  {group.unreadCount > 0 && group._id !== selectedGroup?._id && (
                    <span className="ml-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold shadow">
                      {group.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 h-full w-5 cursor-ew-resize z-50 transition-colors"
        style={{ userSelect: "none" }}
      />
    </aside>
  );
};

export default GroupSidebar;
