import { useEffect, useRef, useState } from 'react';
import { useStatusStore } from '../store/useStatusStore';
import { useAuthStore } from '../store/useAuthStore';
import { Camera, Plus, Trash2, Upload } from 'lucide-react';
import StatusViewer from '../components/StatusViewer';

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

const UpdatesPage = () => {
  const { authUser } = useAuthStore();
  const { myStatuses, feedStatuses, isLoading, fetchFeed, fetchMine, postTextStatus, postMediaStatus, deleteStatus } = useStatusStore();
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);
  const [viewer, setViewer] = useState(null); // { statuses, initialIndex }

  useEffect(() => {
    fetchMine();
    fetchFeed();
  }, [fetchMine, fetchFeed]);

  const handlePostText = async () => {
    if (!text.trim()) return;
    await postTextStatus(text.trim());
    setText('');
  };

  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await postMediaStatus(file);
    e.target.value = '';
  };

  const openViewer = (statuses, initialIndex) => setViewer({ statuses, initialIndex });
  const closeViewer = () => setViewer(null);

  return (
    <div className="container mx-auto px-4 pt-20 pb-24 max-w-lg">
      {viewer && (
        <StatusViewer
          statuses={viewer.statuses}
          initialIndex={viewer.initialIndex}
          onClose={closeViewer}
        />
      )}
      <h2 className="text-xl font-bold mb-3">Updates</h2>

      {/* Create status */}
      <div className="mb-5 p-3 rounded-xl border border-base-300 bg-base-100">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img src={authUser?.profilePic || '/avatar.png'} alt="me" />
            </div>
          </div>
          <div className="flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input input-sm input-bordered w-full"
              placeholder="Share a status (text)"
              maxLength={200}
            />
          </div>
          <button className="btn btn-sm btn-primary" onClick={handlePostText} disabled={!text.trim()}>Post</button>
          <button className="btn btn-sm btn-ghost" onClick={handlePickFile} title="Upload image/video">
            <Upload className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* My statuses */}
      {myStatuses?.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-base-content/70 mb-2">My Status</div>
          <div className="space-y-2">
            {myStatuses.map((s, i) => (
              <div
                key={s._id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/60 cursor-pointer"
                onClick={() => openViewer(myStatuses.map(st => ({ ...st, userId: { _id: authUser?._id, fullName: authUser?.fullName, profilePic: authUser?.profilePic } })), i)}
              >
                <div className="avatar">
                  <div className="w-12 rounded-full ring ring-secondary ring-offset-base-100 ring-offset-2 overflow-hidden">
                    {s.type === 'image' ? (
                      <img src={s.mediaUrl} alt="status" />
                    ) : s.type === 'video' ? (
                      <video src={s.mediaUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-base-200 text-xs px-2 text-center">{s.text}</div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.type === 'text' ? (s.text || 'Text status') : s.type}</div>
                  <div className="text-xs text-base-content/60">{timeAgo(s.createdAt)}</div>
                </div>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={e => { e.stopPropagation(); deleteStatus(s._id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent updates */}
      <div className="mb-2 text-sm font-semibold text-base-content/70">Recent updates</div>
      <div className="space-y-2">
        {isLoading && (
          <div className="text-sm text-base-content/60">Loading…</div>
        )}
        {!isLoading && feedStatuses?.length === 0 && (
          <div className="text-sm text-base-content/60">No updates</div>
        )}
        {feedStatuses.map((item, i) => (
          <div
            key={item._id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/60 cursor-pointer"
            onClick={() => openViewer(feedStatuses, i)}
          >
            <div className="avatar">
              <div className="w-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                <img src={item.userId?.profilePic || item.userAvatar || '/avatar.png'} alt={item.userId?.fullName || item.userName} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{item.userId?.fullName || item.userName}</div>
              <div className="text-xs text-base-content/60">{timeAgo(item.createdAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              {item.likes?.length > 0 && (
                <span className="text-xs text-base-content/60">{item.likes.length} ❤</span>
              )}
              <span className="text-xs text-base-content/70 capitalize">{item.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpdatesPage;
