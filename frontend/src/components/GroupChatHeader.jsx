import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import toast from "react-hot-toast";

const GroupChatHeader = ({ group, onBack }) => {
  const [showMembers, setShowMembers] = useState(false);
  const { authUser } = useAuthStore();
  const { theme } = useThemeStore();
  const { leaveGroup, removeGroupMembers, makeAdmin, removeAdmin } = useChatStore();

  const isAdmin = group?.admins?.some(admin => admin._id === authUser?._id);
  const isCreator = group?.createdBy?._id === authUser?._id;

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    
    try {
      await leaveGroup(group._id);
      toast.success("Left group successfully");
      onBack();
    } catch (error) {
      toast.error("Failed to leave group");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    try {
      await removeGroupMembers(group._id, [memberId]);
      toast.success("Member removed successfully");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const handleMakeAdmin = async (memberId) => {
    try {
      await makeAdmin(group._id, memberId);
      toast.success("Member made admin successfully");
    } catch (error) {
      toast.error("Failed to make member admin");
    }
  };

  const handleRemoveAdmin = async (memberId) => {
    try {
      await removeAdmin(group._id, memberId);
      toast.success("Admin role removed successfully");
    } catch (error) {
      toast.error("Failed to remove admin role");
    }
  };

  return (
    <div data-theme={theme} className="border-b border-base-300 ">
      {/* Main Header */}
      <div className="flex items-center justify-between p-2 ">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center gap-3">
            {group?.avatar ? (
              <img
                src={group.avatar}
                alt={group.name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-base-content font-semibold text-sm">
                  {group?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            
            <div>
              <h2 className="text-lg font-semibold text-base-content ">
                {group?.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {group?.members?.length || 0} members
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center text-base-content hover:text-black  gap-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="p-2 bg-base-200 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-base-content " fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
          
          <button
            onClick={handleLeaveGroup}
            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Members Section */}
      {showMembers && (
        <div className="text-base-content  border-t border-base-300  dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-base-content">
              Group Members ({group?.members?.length || 0})
            </h3>
            {isAdmin && (
              <button className="text-sm text-base-content hover:text-green-700 dark:hover:text-green-300">
                Add Members
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {group?.members?.map(member => {
              const isMemberAdmin = group.admins?.some(admin => admin._id === member.userId._id);
              const canManage = isAdmin && member.userId._id !== authUser?._id;
              const isCurrentUser = member.userId._id === authUser?._id;

              return (
                <div
                  key={member.userId._id}
                  className="flex items-center justify-between p-2 rounded-lg text-white hover:text-black hover:bg-base-content"
                >
                  <div className="flex items-center gap-3 ">
                    <img
                      src={member.userId.profilePic || '/avatar.png'}
                      alt={member.userId.fullName}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium ">
                        {member.userId.fullName}
                        {isCurrentUser && " (You)"}
                      </p>
                      <div className="flex items-center gap-2">
                        {isMemberAdmin && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                            Admin
                          </span>
                        )}
                        {group.createdBy?._id === member.userId._id && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                            Creator
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center text-base-content gap-1">
                      {isMemberAdmin ? (
                        <button
                          onClick={() => handleRemoveAdmin(member.userId._id)}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMakeAdmin(member.userId._id)}
                          className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        >
                          Make Admin
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMember(member.userId._id)}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {group?.description && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {group.description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupChatHeader;
