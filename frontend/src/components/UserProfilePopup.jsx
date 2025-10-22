import { X, Phone, Video, MessageCircle } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const UserProfilePopup = ({ user, isOpen, onClose, onCall }) => {
  const { onlineUsers } = useAuthStore();
  const { handleCall } = useChatStore();

  if (!isOpen || !user) return null;

  const isOnline = user._id === 'ai-bot' || onlineUsers.includes(user._id);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Popup Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-base-100 rounded-lg shadow-xl z-50 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-lg font-semibold">Contact Info</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-base-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Section */}
        <div className="p-6 text-center">
          <div className="avatar mb-4">
            <div className="w-24 h-24 rounded-full mx-auto">
              {user._id === 'ai-bot' ? (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 350 250.7614769349202" className="text-white">
                    <defs id="SvgjsDefs1011"></defs>
                    <g id="SvgjsG1012" featurekey="e7LhAk-0" transform="matrix(0.1763890611651924,0,0,0.1763890611651924,86.81428940875875,-11.291747504091246)" fill="currentColor">
                      <g xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path d="M371,409c-30.6,0-55.5,24.6-56,55.1c-14.4,7.7-28.5,15-42.8,22c-12.3,6.1-15.5,13.7-15.8,26.5    c-1.5,62.1-3.9,124.2-6,186.3c-0.4,12.7-0.8,25.4-1.4,42.7c-13.2-7.5-21.8-13.5-31.2-17.6c-25.8-11.2-34.5-29.1-31.8-57.7    c4.2-43.6,3.7-87.6,5.3-135.5c-13.7,6.9-23.3,13-33.7,16.7c-20.9,7.4-27,21.3-26.6,43c0.6,38.4-0.9,76.9-3.8,115.1    c-1.6,21.2,3,34.8,23.2,45.1c25.3,13,48.7,29.8,73,44.8c25.3,15.7,50.7,31.3,79.7,49.2c0.5-13.7,0.8-22.5,1-31.2    c2.7-79.2,7.1-158.5,7.1-237.7c0-29.9,6.4-50.5,31.3-62.7c8.4,5,18.2,7.9,28.6,7.9c30.9,0,56-25.1,56-56S401.9,409,371,409z     M371,496c-0.2,0-0.3,0-0.4,0h0c-16.9-0.2-30.5-14-30.5-31c0-6.3,1.9-12.1,5.1-17c0,0,0,0,0,0c5.5-8.4,15.1-14,25.9-14h0.1    c2.9,0,5.6,0.4,8.3,1.1c13,3.7,22.6,15.7,22.6,29.9C402,482.1,388.1,496,371,496z"></path>
                          <path d="M462,307c-11,0-21.2,3.2-29.9,8.7c-10.7-6.9-21.1-13.8-31.5-20.8c-11.3-7.7-19.6-6.8-30.9-0.8    c-54.8,29.2-110.1,57.5-165.3,86.1c-11.3,5.9-22.5,11.7-37.9,19.7c0.1-15.2,1.1-25.6,0.1-35.8c-2.9-27.9,8.4-44.4,34.7-56    c40-17.7,78.1-39.7,120.7-61.8c-12.7-8.6-22.7-13.9-31.1-21.2c-16.7-14.6-31.8-13.1-50.5-2.1c-33.1,19.4-67.4,36.9-102.2,53.1    c-19.2,9-28.9,19.7-28,42.3c1.1,28.5-2.1,57-3.3,85.6c-1.3,29.8-2.4,59.6-3.8,93.6c12.1-6.3,19.9-10.3,27.7-14.4    c70.3-36.5,141.6-71.5,210.6-110.4c24-13.5,43.7-18.4,64.5-6.9v0c1.4,29.6,26,53.3,55.9,53.3c30.9,0,56-25.1,56-56    S492.9,307,462,307z M492.9,365.8c-1.4,15.8-14.7,28.2-30.9,28.2c-8.3,0-15.9-3.3-21.5-8.7c-5.9-5.6-9.5-13.6-9.5-22.3    c0-15.8,11.8-28.8,27.1-30.8c1.3-0.2,2.6-0.3,3.9-0.3c13.7,0,25.4,9,29.5,21.4c1,3,1.5,6.3,1.5,9.6    C493,363.9,493,364.9,492.9,365.8z"></path>
                        </g>
                      </g>
                    </g>
                  </svg>
                </div>
              ) : (
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName || "User"}
                  className="w-full h-full object-cover rounded-full"
                />
              )}
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-1">{user.fullName}</h3>
          <p className="text-sm text-base-content/70 mb-4">
            {user._id === 'ai-bot' ? (
              <span className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                AI Assistant
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            )}
          </p>

          {/* Action Buttons */}
          {user._id !== 'ai-bot' && (
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => {
                  handleCall(false);
                  onClose();
                }}
                className="flex flex-col items-center gap-1 p-3 hover:bg-base-200 rounded-lg transition-colors"
                title="Voice Call"
              >
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs">Call</span>
              </button>

              <button
                onClick={() => {
                  handleCall(true);
                  onClose();
                }}
                className="flex flex-col items-center gap-1 p-3 hover:bg-base-200 rounded-lg transition-colors"
                title="Video Call"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs">Video</span>
              </button>

              <button
                onClick={onClose}
                className="flex flex-col items-center gap-1 p-3 hover:bg-base-200 rounded-lg transition-colors"
                title="Message"
              >
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs">Message</span>
              </button>
            </div>
          )}
        </div>

        {/* User Details */}
        <div className="px-6 pb-6">
          <div className="space-y-4">
            {user.email && (
              <div>
                <label className="text-sm font-medium text-base-content/70">Email</label>
                <p className="text-sm">{user.email}</p>
              </div>
            )}
            
            {user._id !== 'ai-bot' && (
              <div>
                <label className="text-sm font-medium text-base-content/70">Status</label>
                <p className="text-sm">{isOnline ? 'Available' : 'Last seen recently'}</p>
              </div>
            )}

            {user._id === 'ai-bot' && (
              <div>
                <label className="text-sm font-medium text-base-content/70">About</label>
                <p className="text-sm">I'm your AI assistant, here to help you with any questions or tasks!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UserProfilePopup;
