import { useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const KeyResetButton = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [status, setStatus] = useState('');

  const handleResetKeys = async () => {
    setIsResetting(true);
    setStatus('Resetting encryption keys...');

    try {
      // Clear all encryption keys
      Object.keys(localStorage).forEach(key => {
        if (key.includes('ecc-keypair')) {
          localStorage.removeItem(key);
        }
      });

      // Clear chat messages cache
      Object.keys(localStorage).forEach(key => {
        if (key.includes('chat-messages') || key.includes('chat-users')) {
          localStorage.removeItem(key);
        }
      });

      setStatus('Keys cleared! Refreshing page...');
      
      // Wait a moment then refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      setStatus('Error: ' + error.message);
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">E2EE Key Issue Detected</h3>
        </div>
        
        <p className="text-sm mb-3 opacity-90">
          Your encryption keys are mismatched. This will fix decryption errors.
        </p>

        {status && (
          <div className="mb-3 p-2 bg-white/20 rounded text-sm">
            {status}
          </div>
        )}

        <button
          onClick={handleResetKeys}
          disabled={isResetting}
          className="w-full btn btn-sm bg-white text-red-500 hover:bg-gray-100 disabled:opacity-50"
        >
          {isResetting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isResetting ? 'Resetting...' : 'Reset Encryption Keys'}
        </button>

        <p className="text-xs opacity-75 mt-2">
          ⚠️ This will clear all encrypted messages and require re-encryption
        </p>
      </div>
    </div>
  );
};

export default KeyResetButton;

