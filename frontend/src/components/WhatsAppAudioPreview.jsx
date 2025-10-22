import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Trash2, Download } from "lucide-react";
import { downloadMedia } from '../utils/download';

const formatTime = (secs) => {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(1, "0");
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

export default function WhatsAppAudioPreview({ audioUrl, onDelete, hideDeleteButton }) {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!audioUrl) return;
    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#25d366",
      progressColor: "#128c7e",
      barWidth: 2,
      barRadius: 2,
      height: 32,
      responsive: true,
      cursorWidth: 1,
      cursorColor: "#128c7e",
      interact: true,
      normalize: true,
      partialRender: true,
      backend: "MediaElement",
    });
    wavesurfer.current.load(audioUrl);
    wavesurfer.current.on("ready", () => {
      setDuration(wavesurfer.current.getDuration());
    });
    wavesurfer.current.on("audioprocess", () => {
      setCurrent(wavesurfer.current.getCurrentTime());
    });
    wavesurfer.current.on("seek", () => {
      setCurrent(wavesurfer.current.getCurrentTime());
    });
    wavesurfer.current.on("finish", () => {
      setPlaying(false);
      setCurrent(duration);
    });
    return () => {
      wavesurfer.current && wavesurfer.current.destroy();
    };
    // eslint-disable-next-line
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!wavesurfer.current) return;
    if (playing) {
      wavesurfer.current.pause();
      setPlaying(false);
    } else {
      wavesurfer.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="max-w-[420px] w-full flex items-center gap-3 border border-zinc-800 rounded-xl px-3 py-2 shadow-sm bg-transparent">
      <button
        onClick={handlePlayPause}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-white hover:bg-primary/90 transition"
        type="button"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>
      <div ref={waveformRef} className="flex-1 min-w-0" />
      <span className="text-xs font-mono text-zinc-700 w-12 text-right">
        {formatTime(current)}
      </span>
      {!hideDeleteButton && (
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full bg-gradient-to-r flex items-center justify-center transition-all"
          type="button"
          aria-label="Remove Audio"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
}
