import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import GroupSelectModal from "./GroupSelectModal";
import toast from "react-hot-toast";

const UserSelectModal = ({ onClose, onSelectUser, users }) => {
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState("create");
  const { sendInvitation, loadAcceptedPeers, acceptedPeers, outgoingInvites } = useChatStore();
  const { authUser } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => { 
    loadAcceptedPeers(); 
  }, [loadAcceptedPeers]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    axiosInstance.get('/messages/users')
      .then(res => { 
        if (mounted) setAllUsers(Array.isArray(res.data) ? res.data : []); 
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const sourceUsers = allUsers.length ? allUsers : (users || []);
  const filteredUsers = sourceUsers
    .filter(user => user._id !== 'ai-bot')
    .filter(user => user.fullName.toLowerCase().includes(search.toLowerCase()));

  const handleCreateGroup = () => {
    setGroupModalMode("create");
    setShowGroupModal(true);
  };

  const handleSelectGroup = () => {
    setGroupModalMode("select");
    setShowGroupModal(true);
  };

  const handleGroupSelect = (group) => {
    // Handle group selection - you can modify this based on your needs
    onSelectUser({ ...group, isGroup: true });
    onClose();
  };

  const handleSendInvitation = async (userId) => {
    try {
      await sendInvitation(userId);
      toast.success('Invitation sent successfully!');
    } catch (error) {
      toast.error('Failed to send invitation');
    }
  };

  if (showGroupModal) {
    return (
      <GroupSelectModal
        onClose={() => setShowGroupModal(false)}
        onSelectGroup={handleGroupSelect}
        mode={groupModalMode}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div data-theme={theme} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              New Chat
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Group Actions */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCreateGroup}
              className="flex items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">New Group</span>
            </button>
            <button
              onClick={handleSelectGroup}
              className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Select Group</span>
            </button>
          </div>
        </div>

        {/* Search Section */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Search contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Users List */}
        <div className="overflow-y-auto max-h-[calc(90vh-280px)]">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Contacts
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Loading contacts...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No contacts found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(user => {
                  const isAccepted = acceptedPeers.includes(user._id);
                  const hasOutgoingInvite = outgoingInvites && outgoingInvites[user._id];
                  
                  return (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <img
                          src={user.profilePic || '/avatar.png'}
                          alt={user.fullName}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAccepted ? 'Contact' : 'Not connected'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAccepted ? (
                          <button
                            onClick={() => { onSelectUser(user); onClose(); }}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-full transition-colors"
                          >
                            Chat
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendInvitation(user._id)}
                            disabled={hasOutgoingInvite}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              hasOutgoingInvite
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                          >
                            {hasOutgoingInvite ? 'Sent' : 'Invite'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSelectModal; 