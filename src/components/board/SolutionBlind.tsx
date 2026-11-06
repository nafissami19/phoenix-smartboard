import React, { useState, useRef } from "react";
import { Icon } from "@/components/Icon";

export function SolutionBlind({
  onClose,
}: {
  onClose: () => void;
}) {
  const [height, setHeight] = useState(260);
  const [width, setWidth] = useState(500);
  const [position, setPosition] = useState({ x: 120, y: 140 });
  const [stepCount, setStepCount] = useState(0);

  const draggingWindow = useRef(false);
  const draggingHandle = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, initialH: 260, posX: 0, posY: 0 });

  const handleHeaderMouseDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button")) return;
    draggingWindow.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialH: height,
      posX: position.x,
      posY: position.y,
    };
    const move = (ev: PointerEvent) => {
      if (!draggingWindow.current) return;
      setPosition({
        x: Math.max(12, Math.min(window.innerWidth - 160, dragStart.current.posX + (ev.clientX - dragStart.current.x))),
        y: Math.max(12, Math.min(window.innerHeight - 80, dragStart.current.posY + (ev.clientY - dragStart.current.y))),
      });
    };
    const up = () => {
      draggingWindow.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleBottomHandleMouseDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    draggingHandle.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialH: height,
      posX: position.x,
      posY: position.y,
    };
    const move = (ev: PointerEvent) => {
      if (!draggingHandle.current) return;
      const newHeight = Math.max(48, Math.min(700, dragStart.current.initialH + (ev.clientY - dragStart.current.y)));
      setHeight(newHeight);
    };
    const up = () => {
      draggingHandle.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const revealNextStep = () => {
    setHeight((prev) => Math.max(48, prev - 55));
    setStepCount((s) => s + 1);
  };

  const coverNextStep = () => {
    setHeight((prev) => Math.min(650, prev + 55));
    setStepCount((s) => Math.max(0, s - 1));
  };

  const revealAll = () => {
    setHeight(48);
  };

  const resizeByKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 55 : 15;
    if (e.key === "ArrowDown") setHeight((h) => Math.min(700, h + step));
    else if (e.key === "ArrowUp") setHeight((h) => Math.max(48, h - step));
    else return;
    e.preventDefault();
  };

  const coverAll = () => {
    setHeight(320);
    setStepCount(0);
  };

  return (
    <div
      role="region"
      aria-label="Solution Blind"
      style={{ left: position.x, top: position.y, width }}
      className="pointer-events-auto fixed z-(--z-panel) select-none shadow-2xl rounded-2xl border border-line bg-panel/95 backdrop-blur-md overflow-hidden transition-all duration-75 flex flex-col"
    >
      {/* Header */}
      <div
        onPointerDown={handleHeaderMouseDown}
        className="flex touch-none items-center justify-between gap-2 px-3 py-2 cursor-grab active:cursor-grabbing border-b border-line bg-muted/15"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Icon name="blind" className="h-4 w-4 text-brand-light" />
          <span>Solution Blind {stepCount > 0 ? `(Revealed ${stepCount})` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={revealNextStep}
            title="Reveal next step (drop blind)"
            className="kn-focus px-2 py-0.5 text-xs font-semibold rounded bg-brand text-on-brand hover:bg-brand-hover transition-colors"
          >
            Next step ↓
          </button>
          <button
            type="button"
            onClick={coverNextStep}
            title="Cover step (pull blind up)"
            aria-label="Cover step (pull blind up)"
            className="kn-focus px-2 py-0.5 text-xs font-semibold rounded border border-line text-muted hover:text-ink hover:bg-elevated transition-colors"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={height <= 60 ? coverAll : revealAll}
            title={height <= 60 ? "Cover all" : "Reveal all"}
            className="kn-focus px-2 py-0.5 text-xs font-semibold rounded border border-line text-muted hover:text-ink hover:bg-elevated transition-colors"
          >
            {height <= 60 ? "Cover all" : "Reveal all"}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close blind"
            aria-label="Close solution blind"
            className="kn-focus grid min-h-8 min-w-8 place-items-center rounded p-1 text-muted hover:text-danger hover:bg-elevated transition-colors"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Blind Shutter Surface */}
      <div
        style={{ height: height - 44 }}
        className="relative transition-all bg-gradient-to-b from-panel-2 to-panel border-b border-line/40 flex flex-col justify-between p-4 overflow-hidden shadow-inner group"
      >
        {/* Shutter Slat Lines */}
        <div className="absolute inset-0 opacity-15 pointer-events-none flex flex-col justify-between py-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-b border-white/50 w-full" />
          ))}
        </div>

        {/* Whole shutter is one real button (keyboard + AT); the pull bar sits above it as a sibling. */}
        <button
          type="button"
          onClick={revealNextStep}
          aria-label="Reveal next step"
          className="kn-focus absolute inset-0 z-[1] cursor-pointer"
        />
        <div className="pointer-events-none z-10 text-center text-xs text-muted/70 group-hover:text-ink group-focus-within:text-ink transition-colors" aria-hidden="true">
          Tap surface to reveal worked solution step-by-step
        </div>

        {/* Tactile Pull Bar */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Blind height"
          aria-valuemin={48}
          aria-valuemax={700}
          aria-valuenow={height}
          tabIndex={0}
          onKeyDown={resizeByKey}
          onPointerDown={handleBottomHandleMouseDown}
          className="kn-focus relative z-10 flex touch-none items-center justify-center gap-1 py-1 rounded bg-elevated/70 hover:bg-overlay cursor-ns-resize transition-colors"
        >
          <div className="h-1 w-12 rounded-full bg-white/40" />
        </div>
      </div>
    </div>
  );
}
