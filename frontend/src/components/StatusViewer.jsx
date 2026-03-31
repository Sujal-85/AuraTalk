import { useEffect, useRef, useState, useCallback } from 'react';
import { Heart, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStatusStore } from '../store/useStatusStore';
import { useAuthStore } from '../store/useAuthStore';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

const DURATION = 30000;

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const StatusViewer = ({ statuses, initialIndex = 0, onClose }) => {
  const { authUser } = useAuthStore();
  const { likeStatus, commentStatus } = useStatusStore();

  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [localStatuses, setLocalStatuses] = useState(statuses);
  const [submitting, setSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const elapsedRef = useRef(0);
  const commentInputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const current = localStatuses[index];

  // Single clean timer effect — no duplicate intervals
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (isPaused) return;

    const savedElapsed = elapsedRef.current;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = savedElapsed + (Date.now() - startTime);
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        elapsedRef.current = 0;
        setIndex(prev => {
          if (prev < localStatuses.length - 1) return prev + 1;
          onCloseRef.current();
          return prev;
        });
      }
    }, 50);

    return () => {
      elapsedRef.current = savedElapsed + (Date.now() - startTime);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isPaused]);

  // Brief mount guard so tap zones don't fire on the same click that opened the viewer
  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  const goNext = useCallback(() => {
    setIndex(prev => {
      if (prev < localStatuses.length - 1) return prev + 1;
      onCloseRef.current();
      return prev;
    });
  }, [localStatuses.length]);

  const goPrev = useCallback(() => {
    setIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleLike = async () => {
    const result = await likeStatus(current._id);
    if (result) {
      setLocalStatuses(prev =>
        prev.map(s => s._id === current._id ? { ...s, likes: result.likes } : s)
      );
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);

    const ownerId = current?.userId?._id || current?.userId;

    // Post comment to status
    const comment = await commentStatus(current._id, commentText.trim());
    if (comment) {
      setLocalStatuses(prev =>
        prev.map(s =>
          s._id === current._id
            ? { ...s, comments: [...(s.comments || []), comment] }
            : s
        )
      );
    }

    // Also send as a chat message to the status owner (WhatsApp-style)
    if (ownerId && ownerId.toString() !== authUser?._id?.toString()) {
      try {
        await axiosInstance.post(`/messages/send/${ownerId}`, {
          text: commentText.trim(),
          statusReply: {
            statusType: current.type,
            text: current.text || null,
            mediaUrl: current.mediaUrl || null,
            ownerName: ownerName,
          },
        });
        toast.success('Reply sent as message', { duration: 2000 });
      } catch {
        // silently ignore chat send failure
      }
    }

    setCommentText('');
    setSubmitting(false);
  };

  const handleInputFocus = () => setIsPaused(true);
  const handleInputBlur = () => setIsPaused(false);

  const isLiked = current?.likes?.some(
    id => (typeof id === 'object' ? id._id || id : id)?.toString() === authUser?._id?.toString()
  );

  const owner = current?.userId;
  const ownerName = owner?.fullName || owner?.name || 'User';
  const ownerPic = owner?.profilePic || '/avatar.png';

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm h-[90vh] max-h-[700px] rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-black select-none"
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerLeave={() => setIsPaused(false)}
      >
        {/* ── TOP BAR (in flex flow, not absolute) ── */}
        <div className="shrink-0 bg-black z-20 px-3 pt-3 pb-2">
          {/* Progress bars */}
          <div className="flex gap-1 mb-2">
            {localStatuses.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{
                    width:
                      i < index ? '100%' :
                      i === index ? `${progress}%` :
                      '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* User info row */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white shrink-0">
              <img src={ownerPic} alt={ownerName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">{ownerName}</div>
              <div className="text-white/70 text-xs">{timeAgo(current.createdAt)}</div>
            </div>
            <button
              className="text-white/80 hover:text-white p-1"
              onMouseDown={e => { e.stopPropagation(); onClose(); }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── CONTENT (fills remaining space) ── */}
        <div className="flex-1 relative overflow-hidden">
          {current.type === 'image' && (
            <img src={current.mediaUrl} alt="status" className="w-full h-full object-cover" draggable={false} />
          )}
          {current.type === 'video' && (
            <video
              src={current.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop={false}
              muted={false}
              playsInline
              draggable={false}
            />
          )}
          {current.type === 'text' && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8">
              <p className="text-white text-xl font-semibold text-center leading-relaxed break-words">
                {current.text}
              </p>
            </div>
          )}

          {/* Left tap zone — go back */}
          {isReady && (
            <button
              className="absolute left-0 top-0 w-1/3 h-full opacity-0"
              onClick={e => { e.stopPropagation(); goPrev(); }}
            />
          )}
          {/* Right tap zone — go forward */}
          {isReady && (
            <button
              className="absolute right-0 top-0 w-1/3 h-full opacity-0"
              onClick={e => { e.stopPropagation(); goNext(); }}
            />
          )}

          {/* Navigation arrows */}
          {index > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition"
              onClick={e => { e.stopPropagation(); goPrev(); }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {index < localStatuses.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition"
              onClick={e => { e.stopPropagation(); goNext(); }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── BOTTOM BAR (in flex flow, not absolute) ── */}
        <div className="shrink-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-4 pt-3 z-20">
          {/* Input + like row */}
          <div className="flex items-center gap-2">
            <input
              ref={commentInputRef}
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder="Add a comment…"
              className="flex-1 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 text-sm rounded-full px-4 py-2 border border-white/20 outline-none focus:border-white/60 transition"
            />
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={handleComment}
              disabled={!commentText.trim() || submitting}
              className="shrink-0 bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white rounded-full p-2 transition"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={handleLike}
              className={`shrink-0 rounded-full p-2 transition ${isLiked ? 'text-red-500' : 'text-white/80 hover:text-red-400'}`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500' : ''}`} />
            </button>
          </div>

          {/* Like count */}
          {current.likes?.length > 0 && (
            <div className="text-xs text-white/60 mt-1 pl-1">
              {current.likes.length} {current.likes.length === 1 ? 'like' : 'likes'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusViewer;
