import React from 'react';
import { Heart, MessageCircle, Users, Star, X } from 'lucide-react';

const LogoutConfirmModal = ({ isOpen, onClose, onConfirm, userName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-200 to-pink-200 dark:from-red-900 dark:to-pink-900 rounded-full opacity-20 -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-200 to-purple-200 dark:from-blue-900 dark:to-purple-900 rounded-full opacity-20 translate-y-12 -translate-x-12"></div>
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Sad emoji and main content */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">😢</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Wait, don't go!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            We'll miss you, <span className="font-semibold text-primary">{userName || 'friend'}</span>!
          </p>
        </div>

        {/* Features you'll miss */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-center">
            You'll miss out on:
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900/20 dark:to-red-900/20 rounded-xl">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="text-gray-700 dark:text-gray-300">Your ongoing conversations</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700 dark:text-gray-300">Real-time messaging with friends</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <Users className="w-5 h-5 text-green-500" />
              <span className="text-gray-700 dark:text-gray-300">Video & voice calls</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-gray-700 dark:text-gray-300">Your favorite contacts</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Stay Connected
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Logout Anyway
          </button>
        </div>

        {/* Small encouraging text */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Your friends are waiting for you! 🌟
        </p>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
