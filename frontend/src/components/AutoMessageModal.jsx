import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, User, MessageSquare, Calendar, Send, Trash2 } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

const AutoMessageModal = ({ isOpen, onClose }) => {
  const { users } = useChatStore();
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'manage'
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, messageId: null });
  const contextMenuRef = useRef(null);

  // Get current date and time for min values
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  useEffect(() => {
    if (isOpen) {
      // Set default time to 1 hour from now
      const defaultTime = new Date(now.getTime() + 60 * 60 * 1000);
      setScheduledDate(defaultTime.toISOString().split('T')[0]);
      setScheduledTime(defaultTime.toTimeString().slice(0, 5));
      
      // Load scheduled messages
      loadScheduledMessages();
    }
  }, [isOpen]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
      }
    };
    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu.visible]);

  const loadScheduledMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const response = await axiosInstance.get('/auto-messages');
      setScheduledMessages(response.data);
    } catch (error) {
      toast.error('Failed to load scheduled messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedUser || !message.trim() || !scheduledDate || !scheduledTime) {
      toast.error('Please fill in all fields');
      return;
    }

    
    // Use laptop's current timezone - no conversion needed
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    

    if (scheduledDateTime <= now) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post('/auto-messages', {
        receiverId: selectedUser,
        message: message.trim(),
        scheduledAt: scheduledDateTime.toISOString(),
      });

      toast.success('Message scheduled successfully!');
      // Reset form
      setSelectedUser('');
      setMessage('');
      setScheduledDate('');
      setScheduledTime('');
      // Reload scheduled messages
      loadScheduledMessages();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to schedule message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUserData = users.find(user => user._id === selectedUser);

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this scheduled message?')) {
      return;
    }
    
    try {
      await axiosInstance.delete(`/auto-messages/${messageId}`);
      toast.success('Scheduled message deleted');
      loadScheduledMessages();
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      toast.error(apiMessage || 'Failed to delete scheduled message');
    }
  };

  const handleContextMenu = (e, messageId) => {
    e.preventDefault();
    // Only allow deleting pending messages
    const target = scheduledMessages.find((m) => m._id === messageId);
    if (!target || target.status !== 'pending') {
      toast.error('Only pending messages can be deleted');
      return;
    }
    // Position relative to the viewport since the menu is fixed
    const x = e.clientX;
    const y = e.clientY;
    setContextMenu({ visible: true, x, y, messageId });
  };

  const handleContextMenuAction = async (action, messageId) => {
    if (action === 'delete') {
      await handleDeleteMessage(messageId);
    }
    
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Auto Messages</h2>
              <p className="text-sm text-base-content/70">Schedule and manage automatic messages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-base-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-base-300">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'text-primary border-b-2 border-primary'
                : 'text-base-content/70 hover:text-base-content'
            }`}
          >
            Schedule New
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'manage'
                ? 'text-primary border-b-2 border-primary'
                : 'text-base-content/70 hover:text-base-content'
            }`}
          >
            Manage ({scheduledMessages.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'schedule' ? (
          <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Recipient Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4" />
                Recipient
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="w-full p-3 border border-base-300 rounded-lg bg-base-100 text-left flex items-center justify-between hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {selectedUserData ? (
                      <>
                        <img
                          src={selectedUserData.profilePic || '/avatar.png'}
                          alt={selectedUserData.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span>{selectedUserData.fullName}</span>
                      </>
                    ) : (
                      <span className="text-base-content/50">Select a recipient</span>
                    )}
                  </div>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showUserDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                    {users
                      .filter(user => user._id !== 'ai-bot')
                      .map(user => (
                        <button
                          key={user._id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(user._id);
                            setShowUserDropdown(false);
                          }}
                          className="w-full p-3 flex items-center gap-3 hover:bg-base-200 transition-colors"
                        >
                          <img
                            src={user.profilePic || '/avatar.png'}
                            alt={user.fullName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span>{user.fullName}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="w-4 h-4" />
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full p-3 border border-base-300 rounded-lg bg-base-100 resize-none h-32 focus:border-primary focus:outline-none transition-colors"
                maxLength={1000}
              />
              <div className="text-xs text-base-content/50 text-right">
                {message.length}/1000
              </div>
            </div>

            {/* Date and Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4" />
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={currentDate}
                  className="w-full p-3 border border-base-300 rounded-lg bg-base-100 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  Time
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full p-3 border border-base-300 rounded-lg bg-base-100 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Preview */}
            {selectedUserData && scheduledDate && scheduledTime && (
              <div className="p-4 bg-base-200 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Preview</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-base-content/70">To:</span> {selectedUserData.fullName}</p>
                  <p><span className="text-base-content/70">When:</span> {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}</p>
                  <p><span className="text-base-content/70">Message:</span> {message || 'No message'}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !selectedUser || !message.trim() || !scheduledDate || !scheduledTime}
              className="w-full p-3 bg-primary text-primary-content rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isLoading ? 'Scheduling...' : 'Schedule Message'}
            </button>
          </form>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scheduledMessages.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-base-content/30 mb-4" />
                <p className="text-base-content/70">No scheduled messages</p>
                <p className="text-sm text-base-content/50">Schedule your first message to get started</p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                {scheduledMessages.map((scheduledMsg) => (
                  <div 
                    key={scheduledMsg._id} 
                    className="p-4 border border-base-300 rounded-lg hover:border-primary/30 transition-colors cursor-pointer relative"
                    onContextMenu={(e) => handleContextMenu(e, scheduledMsg._id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={scheduledMsg.receiverId.profilePic || '/avatar.png'}
                          alt={scheduledMsg.receiverId.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium">{scheduledMsg.receiverId.fullName}</p>
                          <p className="text-sm text-base-content/70">
                            {new Date(scheduledMsg.scheduledAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          scheduledMsg.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                          scheduledMsg.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                          scheduledMsg.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {scheduledMsg.status}
                        </span>
                        {scheduledMsg.status === 'pending' && (
                          <button
                            onClick={() => handleDeleteMessage(scheduledMsg._id)}
                            className="p-1 hover:bg-base-200 rounded transition-colors"
                            title="Delete"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-base-content/80">{scheduledMsg.message}</p>
                  </div>
                ))}

                {/* Context Menu */}
                {contextMenu.visible && (
                  <div
                    ref={contextMenuRef}
                    className="fixed z-[60] bg-base-100 border border-base-300 rounded-lg shadow-lg min-w-[140px] py-2 select-none"
                    style={{
                      left: `${contextMenu.x}px`,
                      top: `${contextMenu.y}px`,
                    }}
                  >
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      onClick={() => handleContextMenuAction('delete', contextMenu.messageId)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoMessageModal;
