import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { X } from 'lucide-react';
import { axiosInstance } from '../lib/axios';

const OutgoingInvitesModal = ({ onClose }) => {
  const { outgoingInvites, users, sendInvitation } = useChatStore();
  const list = Object.values(outgoingInvites || {});

  const handleCancel = async (inviteId) => {
    try {
      await axiosInstance.delete(`/invitations/${inviteId}`);
      useChatStore.setState((state) => {
        const next = { ...state.outgoingInvites };
        for (const key of Object.keys(next)) {
          if (next[key]._id === inviteId) delete next[key];
        }
        return { outgoingInvites: next };
      });
    } catch (e) {
      console.error('Failed to cancel invite', e);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-zinc-900 text-white rounded-2xl p-4 w-full max-w-md border border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Sent Invitations</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"> <X /></button>
        </div>
        {list.length === 0 ? (
          <div className="text-zinc-400">No outgoing invitations</div>
        ) : (
          <ul className="space-y-3">
            {list.map(inv => {
              const u = users.find(x => x._id === inv.toUserId) || {};
              return (
                <li key={inv._id} className="flex items-center justify-between bg-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <img src={u.profilePic || '/avatar.png'} className="w-10 h-10 rounded-full" />
                    <div>
                      <div className="font-medium">{u.fullName || 'User'}</div>
                      <div className="text-xs text-zinc-400">{inv.status}</div>
                    </div>
                  </div>
                   <div className="flex items-center gap-3">
                     <div className="text-xs text-zinc-400">{new Date(inv.createdAt).toLocaleString()}</div>
                     <button className="btn btn-xs btn-ghost text-red-400" onClick={() => handleCancel(inv._id)}>Cancel</button>
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

export default OutgoingInvitesModal;


