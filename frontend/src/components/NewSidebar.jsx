import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { MessageSquare, Palette, LogOut, Phone, Pin, Heart, Archive, Paintbrush, Trash2, CheckSquare, Clock, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import LogoutConfirmModal from './LogoutConfirmModal';
import AutoMessageModal from './AutoMessageModal';

const NewSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, logout } = useAuthStore();
  const { setSelectedUser, selectedUser } = useChatStore();
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, user: null });
  const contextMenuRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAutoMessageModal, setShowAutoMessageModal] = useState(false);

  // Handle logout confirmation
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  // Hide menu on click elsewhere
  useEffect(() => {
    const hideMenu = () => setContextMenu((m) => ({ ...m, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', hideMenu);
    }
    return () => document.removeEventListener('click', hideMenu);
  }, [contextMenu.visible]);

  // Function to adjust context menu position to keep it within viewport
  const adjustContextMenuPosition = (x, y) => {
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Context menu dimensions (approximate)
    const menuWidth = 180; // min-w-[180px]
    const menuHeight = 200; // approximate height
    
    // Adjust x position if it would go beyond right edge
    let adjustedX = x;
    if (x + menuWidth > windowWidth) {
      adjustedX = windowWidth - menuWidth - 10; // 10px padding from edge
    }
    
    // Adjust y position if it would go beyond bottom edge
    let adjustedY = y;
    if (y + menuHeight > windowHeight) {
      adjustedY = windowHeight - menuHeight - 10; // 10px padding from edge
    }
    
    // Ensure menu doesn't go off left or top edges
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);
    
    return { x: adjustedX, y: adjustedY };
  };

  // AI Bot user object
  const aiBotUser = {
    _id: 'ai-bot',
    fullName: 'Aura AI',
    profilePic: null, // We'll use SVG below
    isAIBot: true,
  };

  // Handler for AI bot click
  const handleAIBotClick = () => {
    setSelectedUser(aiBotUser);
    navigate('/'); // Ensure main chat window is shown
  };

  // Handler for AI bot right-click
  const handleAIBotContextMenu = (e) => {
    e.preventDefault();
    
    // Calculate adjusted position to keep menu within viewport
    const adjustedPosition = adjustContextMenuPosition(e.clientX, e.clientY);
    
    setContextMenu({ 
      visible: true, 
      x: adjustedPosition.x, 
      y: adjustedPosition.y, 
      user: aiBotUser 
    });
  };

  return (
    <nav className="hidden lg:flex fixed top-12 left-0 h-[calc(100vh-5rem)] w-16 bg-base-100 flex-col items-center py-4 z-50 select-none">
      <div className="flex flex-col gap-4 flex-1 w-full items-center">
        {/* Chats button */}
        <div className="relative group w-full">
          <button
            className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/messages' ? 'font-bold' : ''}`}
            onClick={() => navigate('/messages')}
          >
            {location.pathname === '/messages' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
            )}
            <MessageSquare className="w-5 h-5 mx-auto" />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Chats</span>
          </button>
        </div>
        {/* Archive button */}
        <div className="relative group w-full">
          <button
            className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/archive' ? 'font-bold' : ''}`}
            onClick={() => navigate('/archive')}
          >
            {location.pathname === '/archive' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
            )}
            <Archive className="w-5 h-5 mx-auto" />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Archive</span>
          </button>
        </div>
        {/* Calls button */}
        <div className="relative group w-full">
          <button
            className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/calls' ? 'font-bold' : ''}`}
            onClick={() => navigate('/calls')}
          >
            {location.pathname === '/calls' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
            )}
            <Phone className="5 h-5 mx-auto" />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Calls</span>
          </button>
        </div>
        {/* Groups button */}
        <div className="relative group w-full">
          <button
            className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/groups' ? 'font-bold' : ''}`}
            onClick={() => navigate('/groups')}
          >
            {location.pathname === '/groups' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
            )}
            <svg className="5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Groups</span>
          </button>
        </div>
        {/* Auto Message button */}
        <div className="relative group w-full">
          <button
            className="relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group"
            onClick={() => setShowAutoMessageModal(true)}
          >
            <Clock className="5 h-5 mx-auto" />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Schedule Message</span>
          </button>
        </div>
        {/* AI Bot button (styled like a user) */}
        <div className="relative group w-full">
          <button
            className={`relative flex flex-col items-center justify-center w-full -py-4  rounded transition group ${selectedUser?._id === 'ai-bot' ? '' : ''}`}
            onClick={handleAIBotClick}
            onContextMenu={handleAIBotContextMenu}
            aria-label="AI Chat"
          >
            {/* Custom SVG Avatar for Aura AI */}
            <span className="w-16 h-16 mx-auto flex items-center justify-center">
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
                      <path d="M865.9,397.8c-1.9-38.3-1.7-76.8-0.1-115.2c0.9-21.2-4.2-34.7-24.7-44.3c-25.8-12.1-49.7-28.1-74.5-42.4   c-25.8-14.9-51.8-29.6-81.3-46.5c0,13.7,0,22.5,0,31.3c0,79.3-1.8,158.6,0.9,237.8c1,28-4,48-24.7,61.1c-8.2-4.7-17.8-7.5-27.9-7.5   c-30.9,0-56,25.1-56,56c0,30.9,25.1,56,56,56c30.9,0,56-25.1,56-55.9c12.9-7.4,25.6-14.6,38.5-21.4c12.1-6.5,15.1-14.2,14.9-27   c-0.6-62.1-0.3-124.2-0.3-186.3v-42.7c13.4,7.1,22.8,12.8,31.7,16.5c26.1,10.3,35.5,27.9,33.7,56.6c-2.7,43.7-0.7,87.6-0.7,135.6   c13.4-7.3,22.8-13.8,33.2-17.8C861.4,433.5,867,419.4,865.9,397.8z M659.1,545.9c-5.1,7.2-13.1,12.1-22.3,13c-1,0.1-2,0.1-3,0.1   c-3.9,0-7.6-0.7-11-2c-11.7-4.4-20-15.8-20-29c0-16.6,13.1-30.2,29.5-31h0c0.5,0,1,0,1.5,0c17.1,0,31,13.9,31,31   C664.8,534.7,662.7,540.9,659.1,545.9z">
                      </path>
                      <path d="M627.3,356.9c0.9-14.9,1.9-29.5,3.1-44c1.2-13.6-3.6-20.4-14.4-27.3c-52.3-33.5-104.1-67.8-156.1-101.8   c-10.6-7-21.3-13.9-35.7-23.4c13.3-7.4,22.9-11.6,31.2-17.5c23-16.2,42.8-14.4,65.9,2.8c35.1,26.2,72.9,48.6,113,74.9   c1.2-15.3,1-26.6,3.3-37.5c4.5-21.7-4.2-34.1-22.9-45c-33.1-19.4-65.2-40.7-96.4-63c-17.2-12.4-31.3-15.5-50.6-3.6   c-24.3,14.9-50.8,26.2-76.2,39.1c-26.6,13.5-53.1,27.1-83.4,42.5c11.4,7.5,18.8,12.3,26.2,17.1c66.3,43.4,131.7,88.4,199.5,129.5   c24.1,14.7,38.2,29.9,37.6,54.7c-17.9,9.3-30.2,28.1-30.2,49.7c0,30.9,25.1,56,56,56s56-25.1,56-56   C653,384.3,642.7,366.9,627.3,356.9z M624,419.3c-2.2,3.8-5.1,7.1-8.7,9.7c-5.1,3.8-11.5,6-18.3,6c-17.1,0-31-13.9-31-31   c0-5.6,1.5-10.8,4-15.3c5.3-9.4,15.4-15.7,27-15.7c12.7,0,23.6,7.6,28.4,18.6c1.7,3.8,2.6,8,2.6,12.4   C628,409.6,626.5,414.8,624,419.3z">
                      </path>
                    </g>
                </g>
              </svg>
            </span>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">AI Chat</span>
          </button>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col gap-4 w-full items-center mb-2">
          <div className="relative group w-full">
            <button
              className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/settings' ? 'font-bold' : ''}`}
              onClick={() => navigate('/themes')}
            >
              {location.pathname === '/themes' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
              )}
              <Palette className="lucide 5 h-5 mx-auto" />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Themes</span>
            </button>
          </div>
          {/* Settings gear below theme */}
          <div className="relative group w-full">
            <button
              className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/settings' ? 'font-bold' : ''}`}
              onClick={() => navigate('/settings')}
            >
              {location.pathname === '/settings' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
              )}
              <Settings className="5 h-5 mx-auto" />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Settings</span>
            </button>
          </div>
          <div className="relative group w-full">
            <button
              className={`relative flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group ${location.pathname === '/profile' ? 'font-bold' : ''}`}
              onClick={() => navigate('/profile')}
            >
              {location.pathname === '/profile' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-green-600 rounded-full" />
              )}
              <img
                src={authUser?.profilePic || '/avatar.png'}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border-2 border-primary mx-auto"
              />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Profile</span>
            </button>
          </div>
          <div className="relative group w-full">
            <button
              className="flex flex-col items-center justify-center w-full py-2 hover:bg-base-200 rounded transition group"
              onClick={handleLogoutClick}
            >
              <LogOut className="5 h-5 mx-auto" />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap">Logout</span>
            </button>
          </div>
        </div>
      </div>
      {/* Context menu for AI bot */}
      {contextMenu.visible && contextMenu.user && contextMenu.user._id === 'ai-bot' && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-base-100 dark:bg-base-300 border border-base-300 dark:border-base-200 rounded-lg shadow-lg min-w-[180px] py-2 select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" disabled><CheckSquare className="w-4 h-4" /> Mark as unread</button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" disabled><Pin className="w-4 h-4"  /> Pin to top</button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" disabled><Heart className="w-4 h-4" /> Add to favorites</button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200" disabled><Archive className="w-4 h-4" /> Archive</button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-yello500 5over:bg-base-200" disabled><Paintbrush className="w-4 h-4" /> Clear messages</button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-base-200" disabled><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      )}
      
      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        userName={authUser?.fullName}
      />
      
      {/* Auto Message Modal */}
      <AutoMessageModal
        isOpen={showAutoMessageModal}
        onClose={() => setShowAutoMessageModal(false)}
      />
    </nav>
  );
};

export default NewSidebar;