import { useEffect, useRef, useState } from 'react';
import { FloatingWindow } from './FloatingWindow';
import './ClassroomTools.css';

// ------------------------------ Classroom Noise Meter -----------------------

export function NoiseMeter({ onClose }: { onClose: () => void }) {
  const [level, setLevel] = useState<number>(30);
  const [threshold, setThreshold] = useState<number>(65);
  const [isAlert, setIsAlert] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let audioCtx: AudioContext | undefined;
    let stream: MediaStream | undefined;
    let timer: number | undefined;

    async function initAudio() {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const check = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale roughly to 20 - 100 dB
          const approxDb = Math.round(20 + (avg / 255) * 80);
          setLevel(prev => Math.round(prev * 0.7 + approxDb * 0.3));

          if (approxDb > threshold) {
            setIsAlert(true);
          } else {
            setIsAlert(false);
          }

          timer = window.requestAnimationFrame(check);
        };
        check();
      } catch {
        setError('Microphone access denied or audio analyser unavailable.');
      }
    }

    void initAudio();
    return () => {
      if (timer) window.cancelAnimationFrame(timer);
      stream?.getTracks().forEach(t => t.stop());
      void audioCtx?.close();
    };
  }, [threshold]);

  const trafficState = level > threshold ? 'red' : level > threshold - 15 ? 'yellow' : 'green';

  return (
    <FloatingWindow title="Classroom noise meter" initialX={window.innerWidth - 320} initialY={240} width={280} onClose={onClose}>
      <div className="noise-meter-container select-none p-2">
        <div className="noise-meter-traffic-light">
          <div
            className={`noise-light bg-emerald-500 text-emerald-400 ${trafficState === 'green' ? 'is-active' : ''}`}
            title="Quiet / Good Study Level"
          />
          <div
            className={`noise-light bg-amber-400 text-amber-300 ${trafficState === 'yellow' ? 'is-active' : ''}`}
            title="Moderate Whispering"
          />
          <div
            className={`noise-light bg-red-500 text-red-400 ${trafficState === 'red' ? 'is-active animate-pulse' : ''}`}
            title="Too Noisy!"
          />
        </div>

        <div className="text-3xl font-black tabular-nums tracking-tight text-brand-light">
          {level} <span className="text-sm font-semibold text-muted">dB</span>
        </div>

        {isAlert && (
          <div className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 animate-bounce">
            🤫 Shh! Quiet Please!
          </div>
        )}

        <div className="w-full">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Noise Threshold:</span>
            <span className="font-bold text-ink">{threshold} dB</span>
          </div>
          <input
            type="range"
            min={40}
            max={90}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="kn-range w-full"
          />
        </div>

        <p className="text-[11px] text-muted">
          Adjust the threshold slider to match your classroom's quiet study expectations.
        </p>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      </div>
    </FloatingWindow>
  );
}

// ------------------------------ Cinema Spotlight Dimmer -----------------------

export function SpotlightDimmer({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300,
  }));
  const [size, setSize] = useState(280);
  const [shape, setShape] = useState<'circle' | 'rect'>('circle');
  const [opacity, setOpacity] = useState(0.75);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const onPointerDownAperture = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMoveAperture = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({
      x: Math.max(size / 4, Math.min(window.innerWidth - size / 4, dragStart.current.posX + dx)),
      y: Math.max(size / 4, Math.min(window.innerHeight - size / 4, dragStart.current.posY + dy)),
    });
  };

  const onPointerUpAperture = (e: React.PointerEvent) => {
    isDragging.current = false;
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  };

  const rectW = size;
  const rectH = Math.round(size * 0.65);

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden" role="dialog" aria-label="Cinema Spotlight Dimmer">
      {/* Darkened backdrop with aperture mask */}
      <svg className="fixed inset-0 h-full w-full pointer-events-none z-40">
        <defs>
          <mask id="cinema-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {shape === 'circle' ? (
              <circle cx={pos.x} cy={pos.y} r={size / 2} fill="black" />
            ) : (
              <rect
                x={pos.x - rectW / 2}
                y={pos.y - rectH / 2}
                width={rectW}
                height={rectH}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`rgba(0, 0, 0, ${opacity})`}
          mask="url(#cinema-spotlight-mask)"
        />
      </svg>

      {/* Draggable glowing aperture boundary */}
      <div
        className="fixed z-40 cursor-grab active:cursor-grabbing pointer-events-auto border-2 border-brand-light/80 shadow-[0_0_32px_rgba(56,189,248,0.35)] transition-shadow hover:shadow-[0_0_48px_rgba(56,189,248,0.55)]"
        style={{
          left: shape === 'circle' ? pos.x - size / 2 : pos.x - rectW / 2,
          top: shape === 'circle' ? pos.y - size / 2 : pos.y - rectH / 2,
          width: shape === 'circle' ? size : rectW,
          height: shape === 'circle' ? size : rectH,
          borderRadius: shape === 'circle' ? '9999px' : '14px',
        }}
        onPointerDown={onPointerDownAperture}
        onPointerMove={onPointerMoveAperture}
        onPointerUp={onPointerUpAperture}
        onPointerCancel={onPointerUpAperture}
        title="Drag spotlight to focus attention"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-white/40 tracking-wider pointer-events-none uppercase">
          Drag
        </div>
      </div>

      {/* Floating control pill */}
      <div
        className="fixed z-50 flex items-center gap-2.5 rounded-full border border-white/20 bg-slate-900/90 backdrop-blur-xl px-4 py-2 text-white shadow-2xl pointer-events-auto"
        style={{
          left: Math.max(16, Math.min(window.innerWidth - 380, pos.x - 170)),
          top: pos.y + (shape === 'circle' ? size / 2 : rectH / 2) + 16 > window.innerHeight - 70
            ? Math.max(16, pos.y - (shape === 'circle' ? size / 2 : rectH / 2) - 56)
            : pos.y + (shape === 'circle' ? size / 2 : rectH / 2) + 16,
        }}
      >
        <div className="flex items-center rounded-lg bg-white/10 p-0.5 text-xs font-semibold">
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition ${shape === 'circle' ? 'bg-brand text-white shadow' : 'text-white/70 hover:text-white'}`}
            onClick={() => setShape('circle')}
          >
            Circle
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition ${shape === 'rect' ? 'bg-brand text-white shadow' : 'text-white/70 hover:text-white'}`}
            onClick={() => setShape('rect')}
          >
            Rect
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-white/80">
          <span>Size:</span>
          <input
            type="range"
            min={140}
            max={560}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="kn-range w-20 accent-brand-light"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-white/80">
          <span>Dim:</span>
          <input
            type="range"
            min={0.4}
            max={0.92}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="kn-range w-16 accent-brand-light"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Spotlight"
          className="ml-1 rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
