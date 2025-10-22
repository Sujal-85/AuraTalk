import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import GroupSelectModal from "../components/GroupSelectModal";
import GroupSidebar from "../components/GroupSidebar";
import GroupChatHeader from "../components/GroupChatHeader";
import { ChatContainer } from "../components/ChatContainer";
import toast from "react-hot-toast";

const GroupsPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { groups, loadGroups, setSelectedGroup, selectedGroup } = useChatStore();
  const { authUser } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    loadGroupsData();
  }, []);

  const loadGroupsData = async () => {
    try {
      setLoading(true);
      await loadGroups();
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    toast.success(`Selected group: ${group.name}`);
  };

  const handleCreateGroup = (group) => {
    toast.success(`Group "${group.name}" created successfully!`);
    loadGroupsData(); // Refresh the groups list
  };

  const getGroupAvatar = (group) => {
    if (group.avatar) {
      return group.avatar;
    }
    return null; // Will use the fallback div
  };

  const getMemberNames = (group) => {
    if (!group.members || group.members.length === 0) return "No members";
    
    const memberNames = group.members
      .filter(member => member.userId._id !== authUser?._id)
      .slice(0, 3)
      .map(member => member.userId.fullName);
    
    if (memberNames.length === 0) return "You";
    if (group.members.length > 4) {
      return `${memberNames.join(", ")} and ${group.members.length - 4} others`;
    }
    return memberNames.join(", ");
  };

  return (
    <div data-theme={theme} className="h-screen sm:bg-base-200">

      {/* Content */}
      <div className="flex items-center justify-center pt-16 sm:pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-8xl h-[calc(100vh-6rem)]">
          <div className="flex h-full rounded-lg overflow-hidden">
            <div className='hidden lg:block'>
              <GroupSidebar onCreateGroupClick={() => setShowCreateModal(true)} />
            </div>
            <div className="flex-1 flex flex-col h-full">
              {loading ? (
                <div className="w-full max-w-2xl mx-auto flex flex-1 items-center justify-center flex-col min-h-[60vh]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
                  <p className="text-gray-500 dark:text-gray-400 mt-4">Loading groups...</p>
                </div>
              ) : selectedGroup ? (
                <>
                  <GroupChatHeader
                    group={selectedGroup}
                    onBack={() => setSelectedGroup(null)}
                  />
                  <ChatContainer />
                </>
              ) : (
                <div className="w-full max-w-2xl mx-auto flex flex-1 items-center justify-center flex-col min-h-[60vh]">
                  <h1 className="text-zinc-400 text-center text-3xl font-bold">Groups</h1>
                  <span className="text-zinc-400 text-center py-4">Select a group to view messages.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <GroupSelectModal
          onClose={() => setShowCreateModal(false)}
          onSelectGroup={handleCreateGroup}
          mode="create"
        />
      )}
    </div>
  );
};

export default GroupsPage;
