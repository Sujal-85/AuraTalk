import React, { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import MessageInput from "./MessageInput";

const PopupChatContainer = ({ popupUser }) => {
  const { authUser, socket } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef(null);

  // Fetch messages for popupUser on mount
  useEffect(() => {
    if (!popupUser) return;
    setIsLoading(true);
    axiosInstance.get(`/messages/${popupUser._id}`)
      .then(res => setMessages(res.data))
      .finally(() => setIsLoading(false));
  }, [popupUser?._id]);

  // Real-time updates for popupUser only
  useEffect(() => {
    if (!popupUser || !socket) return;
    const handleNewMessage = (msg) => {
      if (
        (msg.senderId === popupUser._id && msg.receiverId === authUser._id) ||
        (msg.senderId === authUser._id && msg.receiverId === popupUser._id)
      ) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [popupUser?._id, socket, authUser._id]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Send message for popupUser
  const handleSendMessage = async (messageData) => {
    if (!popupUser) return;
    try {
      const res = await axiosInstance.post(`/messages/send/${popupUser._id}`, messageData);
      setMessages(prev => [...prev, res.data]);
    } catch (error) {}
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg._id || idx} className={`mb-2 ${msg.senderId === authUser._id ? "text-right" : "text-left"}`}>
              <div className={`inline-block px-3 py-2 rounded-lg ${msg.senderId === authUser._id ? "bg-green-600 text-white" : "bg-gray-700 text-white"}`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>
      <div className="p-2 border-t">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default PopupChatContainer;