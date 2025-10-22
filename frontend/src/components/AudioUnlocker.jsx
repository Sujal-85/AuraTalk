import { useRef, useEffect, useState } from "react";

function AudioUnlocker() {
  const audioRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked && audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      });
    }
  }, [unlocked]);

  if (unlocked) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        background: "rgba(0,0,0,0.7)", color: "#fff", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
      onClick={() => setUnlocked(true)}
    >
      <audio ref={audioRef} src="/ringtone.mp3" />
      <div style={{ fontSize: 20, textAlign: "center" }}>
        Tap anywhere to enable call sounds
      </div>
    </div>
  );
}
export default AudioUnlocker; 