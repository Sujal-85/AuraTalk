import { useEffect, useRef, useState } from "react";

const ringtoneUrl = "/ringtone.mp3";

const CallModal = ({
  isOpen,
  isIncoming,
  onAccept,
  onDecline,
  onEnd,
  localStream,
  remoteStream,
  status = "Connecting...",
  error = "",
  onRetry,
  isVideoCall = false,
  isMuted = false,
  isVideoHidden = false,
  onToggleMute,
  onToggleVideo,
  callerName = "",
  callerAvatar = "",
  callStartTime = null,
  callId = null, // Add callId prop
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const ringtoneRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);
  const [noRemoteAudio, setNoRemoteAudio] = useState(false);
  const [showUnlockBanner, setShowUnlockBanner] = useState(false);

  useEffect(() => {
    if (callStartTime) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    } else {
      setDuration(0);
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callStartTime]);

  useEffect(() => {
    if (isOpen && isIncoming && ringtoneRef.current) {
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(() => {
        setShowUnlockBanner(true);
      });
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [isOpen, isIncoming]);

  const handleUnlockAudio = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.play().then(() => {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        setShowUnlockBanner(false);
      });
    }
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current
        .play()
        .then(() => console.log("[CallModal] Local video play started"))
        .catch((err) => console.error("[CallModal] Local video play failed:", err));
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current
        .play()
        .then(() => console.log("[CallModal] Remote video play started"))
        .catch((err) => console.error("[CallModal] Remote video play failed:", err));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current
        .play()
        .catch((err) => console.error("[CallModal] Remote audio play failed:", err));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteStream) {
      setNoRemoteAudio(remoteStream.getAudioTracks().length === 0);
    } else {
      setNoRemoteAudio(false);
    }
  }, [remoteStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col items-center">
        {showUnlockBanner && (
          <div
            className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-2 rounded shadow-lg z-50 cursor-pointer animate-bounce"
            onClick={handleUnlockAudio}
          >
            Click here to enable call sounds
          </div>
        )}
        {isIncoming && (
          <div className="flex flex-col items-center mb-4">
            <img
              src={callerAvatar || "/avatar.png"}
              alt={callerName}
              className="w-20 h-20 rounded-full border-2 border-primary mb-2 object-cover"
            />
            <div className="font-semibold text-lg">{callerName}</div>
          </div>
        )}
        {isVideoCall ? (
          <div className="relative w-full">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-64 bg-gray-900 rounded-lg object-cover border border-gray-300"
              style={{ background: "#222" }}
            />
            <div className="absolute bottom-4 left-4 w-1/3">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-20 bg-gray-900 rounded-lg object-cover border border-gray-300 ${isVideoHidden ? "opacity-30 grayscale" : ""}`}
                style={{ background: "#222" }}
              />
            </div>
            <div className="flex gap-3 mt-2 justify-center">
              <button
                className={`btn btn-sm ${isMuted ? "btn-warning" : "btn-ghost"}`}
                onClick={onToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M9 9v6h4l5 5V4l-5 5H9z" fill="#f59e42" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M9 9v6h4l5 5V4l-5 5H9z" fill="#6366f1" />
                  </svg>
                )}
              </button>
              <button
                className={`btn btn-sm ${isVideoHidden ? "btn-warning" : "btn-ghost"}`}
                onClick={onToggleVideo}
                title={isVideoHidden ? "Show Video" : "Hide Video"}
                disabled={!localStream?.getVideoTracks().length}
              >
                {isVideoHidden ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4Z" fill="#f59e42" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4Z" fill="#6366f1" />
                  </svg>
                )}
              </button>
            </div>
            <div className="text-gray-500 text-sm mt-2 text-center">Video Call</div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 1a5 5 0 0 1 5 5v5a5 5 0 0 1-10 0V6a5 5 0 0 1 5-5Zm7 10.5V11a7 7 0 0 1-14 0v.5A5.5 5.5 0 0 0 4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1a5.5 5.5 0 0 0-1-5.5Z"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="text-gray-500 text-sm">Audio Call</div>
          </div>
        )}
        <audio ref={remoteAudioRef} autoPlay controls={false} hidden />
        <audio ref={ringtoneRef} src={ringtoneUrl} loop style={{ display: "none" }} />
        {callStartTime && (
          <div className="mt-2 text-center text-sm text-primary font-mono">
            {Math.floor(duration / 60)
              .toString()
              .padStart(2, "0")}
            :
            {(duration % 60).toString().padStart(2, "0")}
          </div>
        )}
        {isVideoCall && noRemoteAudio && (
          <div className="mt-2 text-center text-red-500 text-xs">
            No audio detected from the other side. Please check their microphone.
          </div>
        )}
        <div className="mt-4 text-center text-lg font-medium text-gray-800">{status}</div>
        {error && (
          <div className="mt-2 text-center text-red-500 text-sm">
            {error}
            {onRetry && (
              <button className="btn btn-sm btn-primary ml-2" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}
        <div className="flex gap-4 mt-6">
          {isIncoming ? (
            <>
              <button className="btn btn-success btn-md" onClick={onAccept}>
                Accept
              </button>
              <button className="btn btn-error btn-md" onClick={onDecline}>
                Decline
              </button>
            </>
          ) : (
            <button className="btn btn-error btn-md" onClick={onEnd}>
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;