"use client";

import { useRef, useState } from 'react';
import type { Point } from '@/db/schema';

export function ResizeHandles({
  bounds,
  screen,
  resize,
  onPreview,
  onCancel,
}: {
  bounds: { x: number; y: number; w: number; h: number };
  screen: (x: number, y: number) => Point;
  resize: (factor: number, anchor: Point) => void;
  onPreview?: (factor: number, anchor: Point) => void;
  onCancel?: () => void;
}) {
  const drag = useRef<{
    start: number;
    anchor: Point;
    screenAnchor: Point;
    initialBounds: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const [factor, setFactor] = useState(1);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);

  const corners = [
    [0, 0], // Top-Left
    [1, 0], // Top-Right
    [1, 1], // Bottom-Right
    [0, 1], // Bottom-Left
  ];

  const initialW = Math.round(drag.current?.initialBounds.w ?? bounds.w);
  const initialH = Math.round(drag.current?.initialBounds.h ?? bounds.h);
  const currentW = Math.round(initialW * factor);
  const currentH = Math.round(initialH * factor);
  const deltaW = currentW - initialW;
  const deltaH = currentH - initialH;
  const percentChange = Math.round((factor - 1) * 100);
  const percentTotal = Math.round(factor * 100);
  const isGrowing = percentChange > 0;
  const isShrinking = percentChange < 0;

  // Screen bounding box for live outline and feedback positioning
  const tl = screen(bounds.x, bounds.y);
  const br = screen(bounds.x + bounds.w, bounds.y + bounds.h);
  const screenBox = {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    w: Math.abs(br.x - tl.x),
    h: Math.abs(br.y - tl.y),
  };

  const feedbackTop = screenBox.y > 110 ? screenBox.y - 14 : screenBox.y + screenBox.h + 64;
  const feedbackLeft = Math.max(160, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - 160, screenBox.x + screenBox.w / 2));

  return (
    <>
      {/* Dynamic ghost preview box with glowing border */}
      {drag.current && (
        <div
          className="kn-resize-preview-box"
          style={{
            left: screenBox.x,
            top: screenBox.y,
            width: screenBox.w,
            height: screenBox.h,
          }}
        />
      )}

      {/* 4 Corner Handles */}
      {corners.map(([x, y], index) => {
        const p = screen(bounds.x + bounds.w * x, bounds.y + bounds.h * y);
        const isActive = activeCorner === index;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Resize selection ${index + 1}`}
            className={`selection-handle ${isActive ? 'is-active' : ''}`}
            style={{
              left: p.x - 8,
              top: p.y - 8,
              touchAction: 'none',
              cursor: index % 2 ? 'nesw-resize' : 'nwse-resize',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const anchor = {
                x: bounds.x + bounds.w * (1 - x),
                y: bounds.y + bounds.h * (1 - y),
              };
              const s = screen(anchor.x, anchor.y);
              const startDist = Math.max(1, Math.hypot(e.clientX - s.x, e.clientY - s.y));
              drag.current = {
                anchor,
                screenAnchor: s,
                start: startDist,
                initialBounds: { ...bounds },
              };
              setActiveCorner(index);
              setFactor(1);
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                const currentDist = Math.hypot(
                  e.clientX - drag.current.screenAnchor.x,
                  e.clientY - drag.current.screenAnchor.y
                );
                const nextFactor = Math.max(0.1, Math.min(10, currentDist / drag.current.start));
                setFactor(nextFactor);
                if (onPreview) {
                  onPreview(nextFactor, drag.current.anchor);
                }
              }
            }}
            onPointerUp={() => {
              if (drag.current) {
                resize(factor, drag.current.anchor);
                drag.current = null;
                setActiveCorner(null);
                setFactor(1);
              }
            }}
            onPointerCancel={() => {
              if (drag.current) {
                if (onCancel) onCancel();
                drag.current = null;
                setActiveCorner(null);
                setFactor(1);
              }
            }}
          />
        );
      })}

      {/* Live animated resize feedback badge */}
      {drag.current && (
        <div
          className="resize-feedback"
          style={{
            left: feedbackLeft,
            top: feedbackTop,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="resize-feedback-header">
            <span
              className={`resize-delta-badge ${
                isGrowing ? 'is-growing' : isShrinking ? 'is-shrinking' : 'is-neutral'
              }`}
            >
              {isGrowing ? `▲ +${percentChange}%` : isShrinking ? `▼ ${percentChange}%` : '100%'}
              <small style={{ opacity: 0.85, fontWeight: 500 }}>({percentTotal}%)</small>
            </span>
            <span className="resize-dimensions">
              <strong>{currentW}</strong> × <strong>{currentH}</strong> px
            </span>
          </div>

          <div className="resize-dimensions" style={{ fontSize: 11, gap: 8 }}>
            <span>Original: {initialW} × {initialH} px</span>
            <span
              className={`resize-dimensions-diff ${
                isGrowing ? 'is-growing' : isShrinking ? 'is-shrinking' : ''
              }`}
            >
              {isGrowing ? `(+${deltaW} × +${deltaH} px)` : isShrinking ? `(${deltaW} × ${deltaH} px)` : '(No change)'}
            </span>
          </div>

          {/* Animated visual scale bar */}
          <div className="resize-scale-bar-track">
            <div className="resize-scale-bar-marker" title="100% baseline" />
            <div
              className="resize-scale-bar-fill"
              style={{
                marginLeft: isShrinking ? `${Math.max(0, factor * 50)}%` : '50%',
                width: isGrowing
                  ? `${Math.min(50, ((factor - 1) / 2) * 50)}%`
                  : isShrinking
                  ? `${Math.min(50, (1 - factor) * 50)}%`
                  : '0%',
                background: isGrowing
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
