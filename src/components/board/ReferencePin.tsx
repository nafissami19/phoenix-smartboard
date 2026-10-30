"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@/components/Icon";

export interface PinnedCard {
  id: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

export function ReferencePin({
  getCanvas,
  active,
  onClose,
}: {
  getCanvas: () => HTMLCanvasElement | null;
  active: boolean;
  onClose: () => void;
}) {
  const [pinned, setPinned] = useState<PinnedCard | null>(() => {
    try {
      const stored = localStorage.getItem("phoenix-pinned-card");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [collapsed, setCollapsed] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropCurrent, setCropCurrent] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState({ x: 24, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (pinned) {
      try {
        localStorage.setItem("phoenix-pinned-card", JSON.stringify(pinned));
      } catch {}
    } else {
      try {
        localStorage.removeItem("phoenix-pinned-card");
      } catch {}
    }
  }, [pinned]);

  const startCrop = () => {
    setIsCropping(true);
    setCropStart(null);
    setCropCurrent(null);
  };

  const cancelCrop = () => {
    setIsCropping(false);
    setCropStart(null);
    setCropCurrent(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    setCropStart({ x: e.clientX, y: e.clientY });
    setCropCurrent({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStart) return;
    setCropCurrent({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    if (!isCropping || !cropStart || !cropCurrent) return;
    const x = Math.min(cropStart.x, cropCurrent.x);
    const y = Math.min(cropStart.y, cropCurrent.y);
    const w = Math.abs(cropCurrent.x - cropStart.x);
    const h = Math.abs(cropCurrent.y - cropStart.y);

    if (w < 10 || h < 10) {
      setIsCropping(false);
      setCropStart(null);
      setCropCurrent(null);
      return;
    }

    const canvas = getCanvas();
    if (!canvas) {
      setIsCropping(false);
      return;
    }

    // High DPI crop
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.round(w * scaleX);
    cropCanvas.height = Math.round(h * scaleY);
    const ctx = cropCanvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(
        canvas,
        (x - rect.left) * scaleX,
        (y - rect.top) * scaleY,
        w * scaleX,
        h * scaleY,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
      const url = cropCanvas.toDataURL("image/png");
      const card: PinnedCard = {
        id: crypto.randomUUID(),
        title: "Pinned Question / Reference",
        imageUrl: url,
        width: Math.min(360, Math.max(200, w)),
        height: Math.min(480, Math.max(120, h)),
        createdAt: Date.now(),
      };
      setPinned(card);
      setCollapsed(false);
    }

    setIsCropping(false);
    setCropStart(null);
    setCropCurrent(null);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPosition({
        x: Math.max(12, Math.min(window.innerWidth - 120, ev.clientX - dragOffset.current.x)),
        y: Math.max(12, Math.min(window.innerHeight - 80, ev.clientY - dragOffset.current.y)),
      });
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!active && !pinned) return null;

  return (
    <>
      {/* Interactive Crop Overlay */}
      {isCropping && (
        <div
          className="fixed inset-0 z-50 cursor-crosshair select-none bg-black/40"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur">
            Drag to crop any question, diagram, or formula to pin it across slides
            <button
              onClick={cancelCrop}
              className="ml-3 rounded bg-red-600/80 px-2 py-0.5 text-xs text-white hover:bg-red-500"
            >
              Cancel
            </button>
          </div>
          {cropStart && cropCurrent && (
            <div
              className="absolute border-2 border-brand-light bg-brand/10 shadow-2xl"
              style={{
                left: Math.min(cropStart.x, cropCurrent.x),
                top: Math.min(cropStart.y, cropCurrent.y),
                width: Math.abs(cropCurrent.x - cropStart.x),
                height: Math.abs(cropCurrent.y - cropStart.y),
              }}
            />
          )}
        </div>
      )}

      {/* PiP Reference Card */}
      {pinned && (
        <div
          role="region"
          aria-label="Pinned Reference"
          style={{ left: position.x, top: position.y }}
          className="pointer-events-auto fixed z-40 transition-shadow select-none shadow-2xl rounded-2xl border border-line bg-panel/95 backdrop-blur-md overflow-hidden"
        >
          {/* Header */}
          <div
            onMouseDown={handleHeaderMouseDown}
            className="flex items-center justify-between gap-2 px-3 py-2 cursor-grab active:cursor-grabbing border-b border-line bg-muted/10"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Icon name="pin" className="h-4 w-4 text-brand-light" />
              <span>{collapsed ? "Question Ref" : pinned.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startCrop}
                aria-label="Crop new region"
                title="Crop new region from board"
                className="kn-focus rounded p-1 text-muted hover:text-ink hover:bg-elevated transition-colors"
              >
                <Icon name="crop" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? "Expand reference" : "Collapse reference"}
                title={collapsed ? "Expand" : "Collapse"}
                className="kn-focus rounded p-1 text-muted hover:text-ink hover:bg-elevated transition-colors"
              >
                <Icon name={collapsed ? "plus" : "minus"} className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinned(null);
                  onClose();
                }}
                aria-label="Unpin reference"
                title="Close and unpin"
                className="kn-focus rounded p-1 text-muted hover:text-red-400 hover:bg-elevated transition-colors"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {!collapsed && (
            <div className="p-2 max-h-[70vh] max-w-[85vw] overflow-auto">
              <img
                src={pinned.imageUrl}
                alt="Pinned Question"
                className="rounded-lg border border-line shadow-inner max-w-full max-h-[50vh] object-contain"
                style={{ width: pinned.width }}
              />
            </div>
          )}
        </div>
      )}

      {/* Button to start crop if active but no pinned item */}
      {active && !pinned && !isCropping && (
        <div
          style={{ left: position.x, top: position.y }}
          className="pointer-events-auto fixed z-40 rounded-2xl border border-line bg-panel p-4 shadow-2xl backdrop-blur-md flex flex-col gap-2 max-w-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-1.5">
              <Icon name="pin" className="h-4 w-4 text-brand-light" /> Reference Pin
            </span>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink p-1"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted">
            Pin a question, problem statement, or diagram to keep it visible in Picture-in-Picture across all lesson slides.
          </p>
          <button
            type="button"
            onClick={startCrop}
            className="kn-focus flex items-center justify-center gap-2 rounded-xl bg-brand py-2 text-xs font-semibold text-white hover:bg-brand-dark transition-colors"
          >
            <Icon name="crop" className="h-4 w-4" /> Crop Region from Board
          </button>
        </div>
      )}
    </>
  );
}
