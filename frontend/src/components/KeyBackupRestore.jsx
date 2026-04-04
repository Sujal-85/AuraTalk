import React, { useState, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Download, Upload, Shield, AlertTriangle, X, Lock, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function KeyBackupRestore({ onClose, mode = 'auto' }) {
  const { downloadKeyBackup, importKeyBackupFromFile } = useChatStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('backup');
  const fileInputRef = useRef(null);

  const handleBackup = async (e) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsExporting(true);
    try {
      const success = await downloadKeyBackup(password);
      if (success) {
        setPassword('');
        setConfirmPassword('');
        // Don't close - user might want to do more
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!password) {
      toast.error('Enter the backup password first');
      return;
    }
    
    setIsImporting(true);
    try {
      const success = await importKeyBackupFromFile(file, password);
      if (success && onClose) {
        setTimeout(onClose, 1500); // Close after success
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Shield className="w-5 h-5" />
            <h2 className="font-semibold">Encryption Key Backup</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Without this backup, your messages cannot be read if you clear browser data or switch devices.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'backup'
                ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            Backup Keys
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'restore'
                ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            Restore Keys
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'backup' ? (
            <form onSubmit={handleBackup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Create Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  This password encrypts your backup. Don't forget it!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isExporting || !password || password !== confirmPassword}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Encrypted Backup
                  </>
                )}
              </button>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                <strong>Keep this file safe:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li>Store it in cloud storage (Google Drive, iCloud)</li>
                  <li>Email it to yourself</li>
                  <li>Save to a USB drive</li>
                </ul>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Backup Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the password you used for backup"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".backup,.json"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || !password}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Decrypting...
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4" />
                    Select Backup File
                  </>
                )}
              </button>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                <strong>Restoring will:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li>Replace your current keys with backup keys</li>
                  <li>Allow you to decrypt old messages</li>
                  <li>Not affect new messages</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
