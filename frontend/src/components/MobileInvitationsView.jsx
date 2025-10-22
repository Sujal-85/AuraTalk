import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { Check, X } from 'lucide-react';

const MobileInvitationsView = ({ onClose }) => {
  const { invitations, users, acceptInvitationAndOpenChat, declineInvitation } = useChatStore();
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 p-4 overflow-auto">
      <div className="max-w-md mx-auto bg-zinc-900 text-white rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invitations</h2>
          <button onClick={onClose} className="text-zinc-400">Close</button>
        </div>
        {invitations.length === 0 ? (
          <div className="text-zinc-400">No invitations</div>
        ) : (
          <ul className="space-y-3">
            {invitations.map(inv => {
              const u = users.find(x => x._id === inv.fromUserId) || {};
              return (
                <li key={inv._id} className="flex items-center justify-between bg-zinc-800 rounded p-3">
                  <div>
                    <div className="font-medium">{u.fullName || 'User'}</div>
                    <div className="text-xs text-zinc-400">wants to chat</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 rounded bg-green-600" onClick={async () => { await acceptInvitationAndOpenChat(inv._id); onClose?.(); }}> <Check/></button>
                    <button className="px-2 py-1 rounded text-zinc-300" onClick={async () => { await declineInvitation(inv._id); }}> <X/></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MobileInvitationsView;



