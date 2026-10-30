"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/lib/toast";

export function formatTimer(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export interface LessonRecorderHandle {
  state: "idle" | "recording" | "paused";
  micEnabled: boolean;
  setMicEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  seconds: number;
  start: () => Promise<void>;
  pauseResume: () => void;
  stop: () => void;
  formatTimer: (totalSec: number) => string;
}

export function useLessonRecorder({
  renderSlideScene,
  getSlideFrame,
  getCanvas,
  lessonTitle,
}: {
  renderSlideScene?: (
    targetCanvas: HTMLCanvasElement,
    slideFrame: { x: number; y: number; width: number; height: number },
  ) => void;
  getSlideFrame?: () => { x: number; y: number; width: number; height: number };
  getCanvas?: () => HTMLCanvasElement | null;
  lessonTitle?: string;
}): LessonRecorderHandle {
  const { push } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLoopActive = useRef(false);

  const stopTracks = useCallback(() => {
    isLoopActive.current = false;
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    recordingCanvasRef.current = null;
  }, []);

  const start = async () => {
    let canvas: HTMLCanvasElement | null = null;

    if (renderSlideScene) {
      canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      recordingCanvasRef.current = canvas;
      const initialFrame = getSlideFrame ? getSlideFrame() : { x: -960, y: -540, width: 1920, height: 1080 };
      renderSlideScene(canvas, initialFrame);
    } else if (getCanvas) {
      canvas = getCanvas();
    }

    if (!canvas) {
      push("Whiteboard canvas is not ready for recording.", "error");
      return;
    }

    const captureStream =
      canvas.captureStream?.bind(canvas) ||
      (canvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream?.bind(canvas);

    if (!captureStream) {
      push("Screen/canvas recording is not supported on this browser.", "error");
      return;
    }

    try {
      const canvasStream = captureStream(30);
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      if (micEnabled && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = micStream;
          micStream.getAudioTracks().forEach((track) => tracks.push(track));
        } catch {
          push("Microphone permission was not granted; recording video only.", "info");
        }
      }

      const combinedStream = new MediaStream(tracks);
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const selectedMime = mimeTypes.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";

      const recorder = new MediaRecorder(combinedStream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTracks();
        const mime = selectedMime || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        if (blob.size > 0) {
          const safeTitle = (lessonTitle || "lesson")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_")
            .slice(0, 40);
          const filename = `${safeTitle}-${new Date().toISOString().slice(0, 10)}-${Date.now()}.webm`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1000);
          push(`Lesson recording downloaded (${Math.round(blob.size / 1024)} KB)`, "success");
        }
      };

      // Start continuous slide scene render loop
      if (renderSlideScene && recordingCanvasRef.current) {
        isLoopActive.current = true;
        const target = recordingCanvasRef.current;
        const tick = () => {
          if (!isLoopActive.current) return;
          const frame = getSlideFrame ? getSlideFrame() : { x: -960, y: -540, width: 1920, height: 1080 };
          renderSlideScene(target, frame);
          animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);

        // Backup 15fps interval to guarantee captureStream stays alive if window loses focus
        intervalRef.current = window.setInterval(() => {
          if (!isLoopActive.current) return;
          const frame = getSlideFrame ? getSlideFrame() : { x: -960, y: -540, width: 1920, height: 1080 };
          renderSlideScene(target, frame);
        }, 66);
      }

      recorder.start(1000);
      setState("recording");
      setSeconds(0);
      push("Lesson recording started (1080p slide & voice)", "info");
    } catch (err) {
      stopTracks();
      push(err instanceof Error ? err.message : "Could not start lesson recording.", "error");
    }
  };

  const pauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      push("Recording paused", "info");
    } else if (state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      push("Recording resumed", "info");
    }
  };

  const stop = () => {
    if (!mediaRecorderRef.current || state === "idle") return;
    mediaRecorderRef.current.stop();
    setState("idle");
    setSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (state === "recording") {
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  return {
    state,
    micEnabled,
    setMicEnabled,
    seconds,
    start,
    pauseResume,
    stop,
    formatTimer,
  };
}

export function LessonRecorder({
  getCanvas,
  renderSlideScene,
  getSlideFrame,
  lessonTitle,
}: {
  getCanvas?: () => HTMLCanvasElement | null;
  renderSlideScene?: (
    targetCanvas: HTMLCanvasElement,
    slideFrame: { x: number; y: number; width: number; height: number },
  ) => void;
  getSlideFrame?: () => { x: number; y: number; width: number; height: number };
  lessonTitle?: string;
}) {
  const recorder = useLessonRecorder({
    getCanvas,
    renderSlideScene,
    getSlideFrame,
    lessonTitle,
  });

  return (
    <div
      role="region"
      aria-label="Lesson recorder"
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-panel/95 px-3 py-1 shadow-lg backdrop-blur"
    >
      {recorder.state === "idle" ? (
        <>
          <button
            type="button"
            onClick={() => void recorder.start()}
            className="kn-focus flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-ink hover:bg-elevated transition-colors"
            title="Start lesson recording (captures 1080p slide & mic)"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm animate-pulse" />
            <span>Record</span>
          </button>
          <button
            type="button"
            onClick={() => recorder.setMicEnabled(!recorder.micEnabled)}
            aria-label={recorder.micEnabled ? "Microphone enabled (click to mute)" : "Microphone disabled (click to enable)"}
            title={recorder.micEnabled ? "Microphone included" : "Microphone excluded"}
            className={`kn-focus rounded-full p-1 text-xs transition-colors ${
              recorder.micEnabled ? "text-brand-light hover:bg-elevated" : "text-muted line-through hover:bg-elevated"
            }`}
          >
            <span className="text-[11px] font-medium font-mono">{recorder.micEnabled ? "MIC" : "NO MIC"}</span>
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 px-1.5 py-0.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                recorder.state === "recording" ? "bg-red-500 animate-ping" : "bg-amber-400"
              }`}
            />
            <span className="font-mono text-xs font-bold tabular-nums text-ink">
              {recorder.formatTimer(recorder.seconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={recorder.pauseResume}
            aria-label={recorder.state === "recording" ? "Pause recording" : "Resume recording"}
            title={recorder.state === "recording" ? "Pause" : "Resume"}
            className="kn-focus rounded-full p-1 text-muted hover:bg-elevated hover:text-ink transition-colors"
          >
            <Icon name={recorder.state === "recording" ? "pause" : "play"} className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={recorder.stop}
            aria-label="Stop recording and download"
            title="Stop & save"
            className="kn-focus flex items-center gap-1 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
          >
            <span className="h-2 w-2 rounded-sm bg-white" />
            <span>Done</span>
          </button>
        </>
      )}
    </div>
  );
}
