"use client";

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

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    draggingWindow.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialH: height,
      posX: position.x,
      posY: position.y,
    };
    const move = (ev: MouseEvent) => {
      if (!draggingWindow.current) return;
      setPosition({
        x: Math.max(12, Math.min(window.innerWidth - 160, dragStart.current.posX + (ev.clientX - dragStart.current.x))),
        y: Math.max(12, Math.min(window.innerHeight - 80, dragStart.current.posY + (ev.clientY - dragStart.current.y))),
      });
    };
    const up = () => {
      draggingWindow.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handleBottomHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    draggingHandle.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialH: height,
      posX: position.x,
      posY: position.y,
    };
    const move = (ev: MouseEvent) => {
      if (!draggingHandle.current) return;
      const newHeight = Math.max(48, Math.min(700, dragStart.current.initialH + (ev.clientY - dragStart.current.y)));
      setHeight(newHeight);
    };
    const up = () => {
      draggingHandle.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
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

  const coverAll = () => {
    setHeight(320);
    setStepCount(0);
  };

  return (
    <div
      role="region"
      aria-label="Solution Blind"
      style={{ left: position.x, top: position.y, width }}
      className="pointer-events-auto fixed z-40 select-none shadow-2xl rounded-2xl border border-line bg-panel/95 backdrop-blur-md overflow-hidden transition-all duration-75 flex flex-col"
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between gap-2 px-3 py-2 cursor-grab active:cursor-grabbing border-b border-line bg-muted/15"
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
            className="kn-focus px-2 py-0.5 text-xs font-semibold rounded bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            Next step ↓
          </button>
          <button
            type="button"
            onClick={coverNextStep}
            title="Cover step (pull blind up)"
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
            className="kn-focus rounded p-1 text-muted hover:text-red-400 hover:bg-elevated transition-colors"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Blind Shutter Surface */}
      <div
        onClick={revealNextStep}
        style={{ height: height - 44 }}
        className="relative cursor-pointer transition-all bg-gradient-to-b from-slate-800 to-slate-900 border-b border-line/40 flex flex-col justify-between p-4 overflow-hidden shadow-inner group"
      >
        {/* Shutter Slat Lines */}
        <div className="absolute inset-0 opacity-15 pointer-events-none flex flex-col justify-between py-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-b border-white/50 w-full" />
          ))}
        </div>

        <div className="z-10 text-center text-xs text-muted/70 group-hover:text-ink transition-colors">
          Tap surface to reveal worked solution step-by-step
        </div>

        {/* Tactile Pull Bar */}
        <div
          onMouseDown={handleBottomHandleMouseDown}
          className="z-10 flex items-center justify-center gap-1 py-1 rounded bg-slate-700/60 hover:bg-slate-600/80 cursor-ns-resize transition-colors"
        >
          <div className="h-1 w-12 rounded-full bg-white/40" />
        </div>
      </div>
    </div>
  );
}
