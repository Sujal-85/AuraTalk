import React from "react";

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-[fadeInScale_0.25s_ease] bg-white dark:bg-base-300 rounded-2xl shadow-2xl p-7 w-full max-w-md border border-zinc-200 dark:border-zinc-700 relative">
        {/* Warning Icon */}
        <div className="flex justify-center mb-3">
          <div className="bg-red-100 dark:bg-red-900 rounded-full p-3 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01"/></svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-2 text-red-700 dark:text-red-400">{title}</h2>
        <p className="mb-7 text-center text-base-content/80 text-gray-700 dark:text-gray-200">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold shadow hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            className="px-6 py-2 rounded-lg bg-gray-100 dark:bg-base-200 text-gray-800 dark:text-white font-semibold shadow hover:bg-gray-200 dark:hover:bg-base-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition"
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
        {/* Animation keyframes */}
        <style>{`
          @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ConfirmModal; 