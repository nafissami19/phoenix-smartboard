import {drawSolid} from './render-solid';
import {isSolid} from './solid-shapes';
import {brushSettings} from './brush-presets';


import {penOutline,drawStamp,laserOpacity,brushTexture,paintBristles} from './pen-strokes';
import type {
  BoardObject,
  Point,
  ShapeObject,
  StrokeObject,
  TextObject,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Pure canvas drawing + geometry helpers for the whiteboard. Kept free of
// React so the logic is easy to reason about and reuse.
// ---------------------------------------------------------------------------

export type Bounds = { x: number; y: number; w: number; h: number };

export function applyToolStyle(ctx: CanvasRenderingContext2D, tool: string) {
  switch (tool) {
    case "highlighter":
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "square";
      ctx.lineJoin = "round";
      break;
    case "marker":
      ctx.globalAlpha = 0.85;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      break;
    case "magic-ink":
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      break;
    default:
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
  }
}

export function drawLaserStroke(ctx: CanvasRenderingContext2D, stroke: StrokeObject, baseAlpha = 1) {
  const pts = stroke.points;
  if (!pts.length) return;
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const opacity = laserOpacity(stroke, performance.now(), reducedMotion);
  if (opacity <= 0.001) return;

  const laserColor = stroke.color && !['#1f2937','#000000','#1e1e1e'].includes(stroke.color.toLowerCase())
    ? stroke.color
    : '#ff1744';
  const width = Math.max(2, stroke.width);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    const p = pts[0];
    const r = Math.max(width / 2, 2.5);
    ctx.save();
    ctx.globalAlpha = baseAlpha * opacity * 0.45;
    ctx.shadowColor = laserColor;
    ctx.shadowBlur = Math.max(22, width * 4.5);
    ctx.fillStyle = laserColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = baseAlpha * opacity * 0.92;
    ctx.shadowColor = laserColor;
    ctx.shadowBlur = Math.max(10, width * 2);
    ctx.fillStyle = laserColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = baseAlpha * opacity;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.2, r * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  const path = new Path2D();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const cx = pts[i].x;
    const cy = pts[i].y;
    const mx = (cx + pts[i + 1].x) / 2;
    const my = (cy + pts[i + 1].y) / 2;
    path.quadraticCurveTo(cx, cy, mx, my);
  }
  const last = pts[pts.length - 1];
  path.lineTo(last.x, last.y);

  // Layer 1: Wide radiant glow aura (Bloom)
  ctx.save();
  ctx.globalAlpha = baseAlpha * opacity * 0.42;
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = Math.max(14, width * 2.8);
  ctx.shadowColor = laserColor;
  ctx.shadowBlur = Math.max(22, width * 4.5);
  ctx.stroke(path);
  ctx.restore();

  // Layer 2: Vibrant energetic sheath
  ctx.save();
  ctx.globalAlpha = baseAlpha * opacity * 0.92;
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = Math.max(3.5, width * 1.2);
  ctx.shadowColor = laserColor;
  ctx.shadowBlur = Math.max(9, width * 1.8);
  ctx.stroke(path);
  ctx.restore();

  // Layer 3: Scorching white-hot plasma core
  ctx.save();
  ctx.globalAlpha = baseAlpha * opacity * 0.98;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.6, width * 0.36);
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 4;
  ctx.stroke(path);
  ctx.restore();

  ctx.restore();
}

// Draws a smoothed freehand stroke using mid-point quadratic curves.
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: StrokeObject) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  const inheritedAlpha = ctx.globalAlpha * Math.max(0,Math.min(1,stroke.opacity??1));
  applyToolStyle(ctx, stroke.tool);
  ctx.globalAlpha *= inheritedAlpha;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;

  if(stroke.tool==='laser'){drawLaserStroke(ctx,stroke,inheritedAlpha);ctx.restore();return;}
  if(stroke.brush==='stamp'){
    let previous:{x:number;y:number}|undefined;for(const p of pts){if(previous&&dist(previous,p)<Math.max(12,stroke.width*1.4))continue;drawStamp(ctx,stroke.stamp??'smile',p.x,p.y,Math.max(12,stroke.width),stroke.color);previous=p;}ctx.restore();return;
  }
  if(stroke.tool==='pen'){
    const outline=penOutline(stroke);
    if(outline.length){
      ctx.beginPath();ctx.moveTo(outline[0][0],outline[0][1]);for(let i=1;i<outline.length;i++)ctx.lineTo(outline[i][0],outline[i][1]);ctx.closePath();
      const kind=stroke.brush??'normal',grain=brushSettings(kind,stroke.brushSettings).grain;
      const textured=['paint','oil-paint','crayon','oil-pastel','chalk','pencil','charcoal','watercolor','airbrush'].includes(kind);
      ctx.fillStyle=stroke.color;
      const base=kind==='pencil'?.14:kind==='crayon'?.7:kind==='chalk'?.62:kind==='oil-pastel'?.84:kind==='paint'?.65:kind==='oil-paint'?.93:kind==='charcoal'?.82:kind==='watercolor'?.55:kind==='airbrush'?.4:1;
      ctx.globalAlpha=inheritedAlpha*(textured?1-grain*(1-base):1);ctx.fill();
      if(textured&&grain>0&&!['paint','oil-paint','watercolor'].includes(kind)){const pigment=brushTexture(ctx,kind,stroke.color);if(pigment){ctx.fillStyle=pigment;ctx.globalAlpha=inheritedAlpha*grain;ctx.fill();}}
      if(kind==='paint'||kind==='oil-paint'||kind==='watercolor'){ctx.globalAlpha=inheritedAlpha;paintBristles(ctx,stroke,grain);}

    }
    ctx.restore();return;
  }

  if (pts.length === 1) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(stroke.width / 2, 0.5), 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const cx = pts[i].x;
    const cy = pts[i].y;
    const mx = (cx + pts[i + 1].x) / 2;
    const my = (cy + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(cx, cy, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a = size;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - a * Math.cos(angle - Math.PI / 7),
    y2 - a * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    x2 - a * Math.cos(angle + Math.PI / 7),
    y2 - a * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
}

/** Polygon points remain inside the dragged rectangle, including reverse drags. */
export function shapeVertices(shape: Pick<ShapeObject, "shape" | "x" | "y" | "w" | "h">): Point[] {
  const {x, y, w, h} = shape;
  if (shape.shape === "triangle") return [{x:x+w/2,y}, {x:x+w,y:y+h}, {x,y:y+h}];
  if (shape.shape === "righttriangle") return [{x,y}, {x:x+w,y:y+h}, {x,y:y+h}];
  if (shape.shape === "parallelogram") return [{x:x+w*.25,y}, {x:x+w,y}, {x:x+w*.75,y:y+h}, {x,y:y+h}];
  if (shape.shape === "trapezoid") return [{x:x+w*.25,y}, {x:x+w*.75,y}, {x:x+w,y:y+h}, {x,y:y+h}];
  if (shape.shape === "diamond") return [{x:x+w/2,y}, {x:x+w,y:y+h/2}, {x:x+w/2,y:y+h}, {x,y:y+h/2}];
  const sides = shape.shape === "star" ? 10 : shape.shape === "pentagon" ? 5 : 6;
  return Array.from({length:sides}, (_, i) => {
    const radius = shape.shape === "star" && i % 2 ? 0.42 : 1;
    const angle = 2 * Math.PI * i / sides - Math.PI / 2;
    return {x:x+w/2+Math.cos(angle)*w/2*radius, y:y+h/2+Math.sin(angle)*h/2*radius};
  });
}

function traceClosedShape(ctx:CanvasRenderingContext2D,shape:ShapeObject) {
  const {x,y,w,h}=shape;ctx.beginPath();
  if(shape.shape==='rect'){
    const radius=Math.max(0,Math.min(shape.roundness??0,Math.abs(w)/2,Math.abs(h)/2));
    if(radius){ctx.roundRect(Math.min(x,x+w),Math.min(y,y+h),Math.abs(w),Math.abs(h),radius);}else ctx.rect(x,y,w,h);
  }else if(shape.shape==='ellipse'||shape.shape==='circle'){
    ctx.ellipse(x+w/2,y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);
  }else{
    shapeVertices(shape).forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
  }
}

function hatchFill(ctx:CanvasRenderingContext2D,shape:ShapeObject){
  ctx.save();ctx.clip();ctx.setLineDash([]);ctx.strokeStyle=shape.fillColor??shape.color;
  ctx.lineWidth=Math.max(1,shape.width*.5);ctx.lineCap='butt';
  const x=Math.min(shape.x,shape.x+shape.w),y=Math.min(shape.y,shape.y+shape.h),w=Math.abs(shape.w),h=Math.abs(shape.h);
  // Bound work on unusually large imported shapes without changing their geometry.
  const gap=Math.max(8,shape.width*3,(w+h)/1200);
  ctx.beginPath();
  for(let d=-h;d<=w;d+=gap){ctx.moveTo(x+d,y);ctx.lineTo(x+d+h,y+h);}
  if(shape.fillStyle==='crosshatch')for(let d=0;d<=w+h;d+=gap){ctx.moveTo(x+d,y);ctx.lineTo(x+d-h,y+h);}
  ctx.stroke();ctx.restore();
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeObject) {
  if(isSolid(shape)){drawSolid(ctx,shape);return;}

  ctx.save();
  const {x,y,w,h}=shape;ctx.translate(x+w/2,y+h/2);ctx.rotate(shape.rotation);if(shape.mirrorX||shape.mirrorY)ctx.scale(shape.mirrorX?-1:1,shape.mirrorY?-1:1);ctx.translate(-(x+w/2),-(y+h/2));
  ctx.globalAlpha=1;ctx.strokeStyle=shape.color;ctx.fillStyle=shape.fillColor??shape.color;ctx.lineWidth=shape.width;
  ctx.setLineDash(shape.dash==='dashed'?[shape.width*4,shape.width*3]:shape.dash==='dotted'?[0,shape.width*3]:[]);
  ctx.lineCap='round';ctx.lineJoin='round';
  if(shape.shape==='line'||shape.shape==='arrow'){
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);ctx.stroke();
    if(shape.shape==='arrow'){ctx.fillStyle=shape.color;ctx.setLineDash([]);drawArrowHead(ctx,x,y,x+w,y+h,Math.max(shape.width*4,12));}
  }else{
    traceClosedShape(ctx,shape);
    if(shape.filled){
      if(shape.fillStyle==='hachure'||shape.fillStyle==='crosshatch'){hatchFill(ctx,shape);traceClosedShape(ctx,shape);}else ctx.fill();
    }
    ctx.stroke();
  }
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

export function drawText(ctx: CanvasRenderingContext2D, item: TextObject) {
  ctx.save();
  if(item.rotation||item.mirrorX||item.mirrorY){const b=rawObjectBounds(item,ctx),cx=b.x+b.w/2,cy=b.y+b.h/2;ctx.translate(cx,cy);ctx.rotate(item.rotation??0);ctx.scale(item.mirrorX?-1:1,item.mirrorY?-1:1);ctx.translate(-cx,-cy);}
  ctx.globalAlpha = 1;
  const mathStack = "'Cambria Math', 'Noto Sans Math', 'STIX Two Math', 'KaTeX_Math', 'Times New Roman', serif";
  const family = item.fontFamily && item.fontFamily !== 'sans-serif' ? `${item.fontFamily}, ${mathStack}` : `system-ui, -apple-system, sans-serif, ${mathStack}`;
  const font = `${item.italic ? "italic " : ""}${item.bold ? "700 " : ""}${item.fontSize}px ${family}`;
  ctx.font = font;
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, item.text, 1200);
  const lineHeight = item.fontSize * 1.25;

  const hasCard = Boolean(item.cardStyle && item.cardStyle !== 'none');
  if (hasCard) {
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const padX = Math.max(14, item.fontSize * 0.7);
    const padY = Math.max(10, item.fontSize * 0.5);
    const cardW = maxW + padX * 2;
    const cardH = lines.length * lineHeight + padY * 2;
    const cardX = item.x - padX;
    const cardY = item.y - padY;

    ctx.save();
    if (item.cardStyle === 'minimal') {
      ctx.fillStyle = item.cardBg || (isColorDark(item.color) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)');
      ctx.strokeStyle = item.cardBorder || (isColorDark(item.color) ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.stroke();
    } else if (item.cardStyle === 'callout') {
      ctx.fillStyle = item.cardBg || (isColorDark(item.color) ? 'rgba(56, 189, 248, 0.1)' : 'rgba(14, 165, 233, 0.08)');
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 6);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();

      ctx.fillStyle = item.cardBorder || '#0284c7';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, 4, cardH, [6, 0, 0, 6]);
      else ctx.rect(cardX, cardY, 4, cardH);
      ctx.fill();
    } else if (item.cardStyle === 'sticky') {
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = item.cardBg || '#fef08a';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 4);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = (item.cardStyle === 'sticky' && (!item.color || item.color === '#ffffff' || item.color === '#f8fafc')) ? '#1c1917' : item.color;
  lines.forEach((line, i) => {
    ctx.fillText(line, item.x, item.y + i * lineHeight);
  });
  ctx.restore();
}

export function drawObject(ctx: CanvasRenderingContext2D, obj: BoardObject) {
  switch (obj.kind) {
    case "stroke":
      drawStroke(ctx, obj);
      break;
    case "shape":
      drawShape(ctx, obj);
      break;
    case "text":
      drawText(ctx, obj);
      break;
  }
}

// Cached procedural surface textures for tactile school environments
let chalkboardPattern: CanvasPattern | null = null;
let moleskinePattern: CanvasPattern | null = null;

function getChalkboardPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (chalkboardPattern) return chalkboardPattern;
  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const c = tile.getContext('2d');
  if (!c) return null;
  let seed = 42891;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 40; i++) {
    const rx = rand() * 256, ry = rand() * 256, r = 15 + rand() * 45;
    const g = c.createRadialGradient(rx, ry, 0, rx, ry, r);
    g.addColorStop(0, 'rgba(235, 255, 240, 0.035)');
    g.addColorStop(1, 'rgba(235, 255, 240, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(rx, ry, r, 0, Math.PI * 2); c.fill();
  }
  for (let i = 0; i < 900; i++) {
    const x = rand() * 256, y = rand() * 256, s = 0.5 + rand() * 1.5;
    c.fillStyle = `rgba(245, 255, 245, ${0.03 + rand() * 0.08})`;
    c.fillRect(x, y, s, s);
  }
  chalkboardPattern = ctx.createPattern(tile, 'repeat');
  return chalkboardPattern;
}

function getMoleskinePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (moleskinePattern) return moleskinePattern;
  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const c = tile.getContext('2d');
  if (!c) return null;
  let seed = 81395;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 800; i++) {
    const x = rand() * 256, y = rand() * 256, len = 1 + rand() * 3, angle = rand() * Math.PI;
    c.strokeStyle = `rgba(140, 110, 70, ${0.02 + rand() * 0.035})`;
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    c.stroke();
  }
  moleskinePattern = ctx.createPattern(tile, 'repeat');
  return moleskinePattern;
}

// Fixed-to-screen background fill + optional grid/dots/lines pattern.
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  pattern: string,
  dpr: number,
  image?:CanvasImageSource|null,
) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  if(image)ctx.drawImage(image,0,0,w,h);

  const hex = color.toLowerCase();
  const isChalk = hex === '#163d30' || hex === '#1e4a3c' || (hex.startsWith('#16') && isColorDark(color));
  const isBlueprint = hex === '#193e61' || hex === '#102e4c' || hex === '#1a4168';
  const isMoleskine = ['#faf1da', '#fffdf5', '#fffaf0', '#f5f1e6', '#fdfaf2'].includes(hex);

  // 1. Dark Green Chalkboard: subtle dusty chalkboard grain
  if (isChalk && !image) {
    const pat = getChalkboardPattern(ctx);
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // 2. Warm Moleskine Paper: subtle warm ivory texture with faint dotted margins
  if (isMoleskine && !image) {
    const pat = getMoleskinePattern(ctx);
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(215, 75, 75, 0.28)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 100, 70, 0.18)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(w, 56);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Blueprint Mode: Cyan grid with coordinate hashes for engineering & physics
  if (isBlueprint && (pattern === 'grid' || pattern === 'none' || !pattern)) {
    ctx.save();
    const step = 32;
    const majorStep = 160;
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += majorStep) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += majorStep) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 235, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += majorStep) {
      for (let y = 0; y <= h; y += majorStep) {
        ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  if (pattern && pattern !== "none" && !(isBlueprint && pattern === 'grid')) {
    const step = 32;
    const isDark = isColorDark(color);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1;

    if(pattern==='staff'||pattern==='music-staff'){
      ctx.beginPath();
      const rows = 5;
      const gap = 12;
      const staffHeight = (rows - 1) * gap;
      const step = staffHeight + 48;
      for (let y = 48; y < h - 20; y += step) {
        for (let n = 0; n < rows; n++) {
          ctx.moveTo(32, y + n * gap);
          ctx.lineTo(w - 32, y + n * gap);
        }
        ctx.moveTo(32, y);
        ctx.lineTo(32, y + staffHeight);
        ctx.moveTo(w - 32, y);
        ctx.lineTo(w - 32, y + staffHeight);
      }
      ctx.stroke();
    } else if (pattern === 'handwriting' || pattern === 'english-4line' || pattern === '4line') {
      ctx.save();
      const topGap = 16;
      const midGap = 16;
      const botGap = 16;
      const setHeight = topGap + midGap + botGap;
      const step = setHeight + 36;
      for (let y = 36; y < h - 20; y += step) {
        ctx.strokeStyle = isDark ? "rgba(255,100,100,0.22)" : "rgba(220,50,50,0.25)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.strokeStyle = isDark ? "rgba(100,180,255,0.25)" : "rgba(30,120,220,0.3)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y + topGap);
        ctx.lineTo(w, y + topGap);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = isDark ? "rgba(100,180,255,0.35)" : "rgba(30,120,220,0.4)";
        ctx.beginPath();
        ctx.moveTo(0, y + topGap + midGap);
        ctx.lineTo(w, y + topGap + midGap);
        ctx.stroke();

        ctx.strokeStyle = isDark ? "rgba(255,100,100,0.22)" : "rgba(220,50,50,0.25)";
        ctx.beginPath();
        ctx.moveTo(0, y + setHeight);
        ctx.lineTo(w, y + setHeight);
        ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === 'isometric-dots' || pattern === 'isometric-3d') {
      const dx = 32;
      const dy = dx * Math.sqrt(3) / 2;
      let rowIndex = 0;
      for (let y = dy; y < h; y += dy) {
        const xOffset = (rowIndex % 2 === 1) ? dx / 2 : 0;
        for (let x = xOffset; x < w; x += dx) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        rowIndex++;
      }
    } else if(pattern==='isometric'){
      ctx.beginPath();for(let x=-h*2;x<w+h*2;x+=40){ctx.moveTo(x,0);ctx.lineTo(x+h/1.732,h);ctx.moveTo(x,0);ctx.lineTo(x-h/1.732,h);}for(let y=0;y<h;y+=34.64){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
    }else if (pattern === "grid") {
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else if (pattern === "dots") {
      for (let x = step; x < w; x += step) {
        for (let y = step; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === "lines") {
      ctx.beginPath();
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else if (pattern === 'columns-2' || pattern === 'chalkboard-2col') {
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 44);
      ctx.lineTo(w / 2, h - 36);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText("PART 1", 32, 28);
      ctx.fillText("PART 2", w / 2 + 32, 28);
      ctx.restore();
    } else if (pattern === 'columns-3' || pattern === 'chalkboard-3col') {
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w / 3, 44);
      ctx.lineTo(w / 3, h - 36);
      ctx.moveTo((2 * w) / 3, 44);
      ctx.lineTo((2 * w) / 3, h - 36);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText("SECTION 1", 32, 28);
      ctx.fillText("SECTION 2", w / 3 + 32, 28);
      ctx.fillText("SECTION 3", (2 * w) / 3 + 32, 28);
      ctx.restore();
    }
  }

  // Subtle canvas perimeter vignette for physical smartboard depth
  const isDarkCanvas = isColorDark(color);
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDarkCanvas ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.05)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

export function isColorDark(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

// ----------------------------- geometry / hit ------------------------------

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
 * Reduces point count of backgrounded or completed strokes while preserving stroke fidelity.
 */
export function simplifyRDP(points: Point[], epsilon = 1.0): Point[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  const start = points[0];
  const last = points[end];

  for (let i = 1; i < end; i++) {
    const d = distToSegment(points[i], start, last);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = simplifyRDP(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyRDP(points.slice(index), epsilon);
    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [start, last];
  }
}

export function simplifyStroke(stroke: StrokeObject, epsilon = 1.0): StrokeObject {
  if (stroke.points.length <= 2) return stroke;
  return { ...stroke, points: simplifyRDP(stroke.points, epsilon) };
}

export function pointNearStroke(p: Point, stroke: StrokeObject, tol: number): boolean {
  const pts = stroke.points;
  const effTol = tol + stroke.width / 2;
  if (pts.length === 1) return dist(p, pts[0]) <= effTol;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= effTol) return true;
  }
  return false;
}

export function objectBounds(obj:BoardObject,ctx?:CanvasRenderingContext2D):Bounds {
  const b=rawObjectBounds(obj,ctx);if(obj.kind!=='text'||!obj.rotation)return b;
  const cx=b.x+b.w/2,cy=b.y+b.h/2,c=Math.cos(obj.rotation),s=Math.sin(obj.rotation);
  const pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([x,y])=>({x:cx+(x-cx)*c-(y-cy)*s,y:cy+(x-cx)*s+(y-cy)*c}));
  const x=Math.min(...pts.map(p=>p.x)),y=Math.min(...pts.map(p=>p.y));return{x,y,w:Math.max(...pts.map(p=>p.x))-x,h:Math.max(...pts.map(p=>p.y))-y};
}
const strokeBoundsCache=new WeakMap<StrokeObject,{points:Point[];count:number;lastX:number;lastY:number;width:number;bounds:Bounds}>();
function rawObjectBounds(obj: BoardObject, ctx?: CanvasRenderingContext2D): Bounds {
  if (obj.kind === "stroke") {
    const pts = obj.points;
    if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    const last=pts[pts.length-1],cached=strokeBoundsCache.get(obj);
    if(cached&&cached.points===pts&&cached.count===pts.length&&cached.lastX===last.x&&cached.lastY===last.y&&cached.width===obj.width)return cached.bounds;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = obj.width / 2;
    const bounds={ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    strokeBoundsCache.set(obj,{points:pts,count:pts.length,lastX:last.x,lastY:last.y,width:obj.width,bounds});return bounds;
  }
  if (obj.kind === "shape") {
    const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
    const c = Math.cos(obj.rotation), s = Math.sin(obj.rotation);
    const corners = [[obj.x,obj.y],[obj.x+obj.w,obj.y],[obj.x+obj.w,obj.y+obj.h],[obj.x,obj.y+obj.h]];
    const rotated = corners.map(([x,y])=>({x:cx+(x-cx)*c-(y-cy)*s,y:cy+(x-cx)*s+(y-cy)*c}));
    const x = Math.min(...rotated.map(p=>p.x)), y = Math.min(...rotated.map(p=>p.y));
    return {x,y,w:Math.max(...rotated.map(p=>p.x))-x,h:Math.max(...rotated.map(p=>p.y))-y};
  }
  // text
  const hasCard = Boolean(obj.cardStyle && obj.cardStyle !== 'none');
  const padX = hasCard ? Math.max(14, obj.fontSize * 0.7) : 0;
  const padY = hasCard ? Math.max(10, obj.fontSize * 0.5) : 0;
  if (ctx) {
    ctx.save();
    const mathStack = "'Cambria Math', 'Noto Sans Math', 'STIX Two Math', 'KaTeX_Math', 'Times New Roman', serif";
    const family = obj.fontFamily && obj.fontFamily !== 'sans-serif' ? `${obj.fontFamily}, ${mathStack}` : `system-ui, -apple-system, sans-serif, ${mathStack}`;
    ctx.font = `${obj.italic ? "italic " : ""}${obj.bold ? "700 " : ""}${obj.fontSize}px ${family}`;
    const lines = wrapLines(ctx, obj.text, 1200);
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    ctx.restore();
    return { x: obj.x - padX, y: obj.y - padY, w: maxW + padX * 2, h: lines.length * obj.fontSize * 1.25 + padY * 2 };
  }
  const maxW = obj.text.length * obj.fontSize * 0.6;
  return { x: obj.x - padX, y: obj.y - padY, w: maxW + padX * 2, h: obj.fontSize * 1.25 + padY * 2 };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Eraser: does the eraser circle hit this object?
export function objectHitByEraser(obj: BoardObject, center: Point, radius: number): boolean {
  if (obj.kind === "stroke") return pointNearStroke(center, obj, radius);
  const b = objectBounds(obj);
  // Circle vs AABB
  const cx = Math.max(b.x, Math.min(center.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(center.y, b.y + b.h));
  return dist(center, { x: cx, y: cy }) <= radius;
}

// --------------------------- shape recognition ---------------------------

/** Uniform sampling avoids over-weighting places where the pen paused. */
function samplePath(points:Point[],count=64):Point[]{
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+dist(points[i-1],points[i]));
  const total=lengths.at(-1)!;let segment=1;
  return Array.from({length:count},(_,i)=>{
    const target=total*i/(count-1);while(segment<points.length-1&&lengths[segment]<target)segment++;
    const a=points[segment-1],b=points[segment],t=(target-lengths[segment-1])/Math.max(1e-9,lengths[segment]-lengths[segment-1]);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  });
}

/** Geometry-only recognition. Uncertain paths stay editable ink, never guessed text. */
export function recognizeShape(points:Point[],color:string,width:number):ShapeObject|null{
  if(points.length<6||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  let clean:Point[]=[];for(const p of points)if(!clean.length||dist(p,clean.at(-1)!)>.2)clean.push(p);if(clean.length<5)return null;
  if(clean.length>4096){const all=clean;clean=Array.from({length:4096},(_,i)=>all[Math.round(i*(all.length-1)/4095)]);}
  const xs=clean.map(p=>p.x),ys=clean.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys);
  const w=Math.max(...xs)-minX,h=Math.max(...ys)-minY,diag=Math.hypot(w,h);if(diag<45)return null;
  const first=clean[0],last=clean.at(-1)!;let length=0;for(let i=1;i<clean.length;i++)length+=dist(clean[i-1],clean[i]);
  const gap=dist(first,last),tolerance=Math.max(3,Math.min(width*1.5,8),diag*.025);
  const base:ShapeObject={id:'',kind:'shape',shape:'line',x:minX,y:minY,w,h,color,width,filled:false,rotation:0};
  function linear(kind:'line'|'arrow',end:Point){
    const dx=end.x-first.x,dy=end.y-first.y,angle=Math.atan2(dy,dx),snapped=Math.round(angle/(Math.PI/4))*Math.PI/4;
    const a=Math.abs(angle-snapped)<Math.PI/30?snapped:angle,distance=Math.hypot(dx,dy);
    return {...base,shape:kind,x:first.x,y:first.y,w:Math.cos(a)*distance,h:Math.sin(a)*distance};
  }
  // A line must both follow its chord and avoid a detour/backtrack.
  if(gap/Math.max(length,1)>.94&&clean.every(p=>distToSegment(p,first,last)<=tolerance))return linear('line',last);
  // One continuous arrow stroke: straight shaft followed by wings on opposite sides of its tip.
  let tipIndex=0;for(let i=1;i<clean.length;i++)if(dist(first,clean[i])>dist(first,clean[tipIndex]))tipIndex=i;
  const tip=clean[tipIndex],shaft=dist(first,tip);
  if(tipIndex>=3&&tipIndex<clean.length-3&&shaft>60&&shaft>diag*.65&&clean.slice(0,tipIndex+1).every(p=>distToSegment(p,first,tip)<=tolerance)){
    const ux=(tip.x-first.x)/shaft,uy=(tip.y-first.y)/shaft;
    const wings=clean.slice(tipIndex+1).map(p=>({back:-(p.x-tip.x)*ux-(p.y-tip.y)*uy,side:(p.x-tip.x)*-uy+(p.y-tip.y)*ux}));
    const valid=wings.filter(p=>p.back>shaft*.05&&p.back<shaft*.4&&Math.abs(p.side)>shaft*.055&&Math.abs(p.side)<shaft*.3);
    if(valid.some(p=>p.side>0)&&valid.some(p=>p.side<0)&&wings.every(p=>p.back>=-tolerance&&p.back<shaft*.5&&Math.abs(p.side)<shaft*.35)&&length<shaft*2.4)return linear('arrow',tip);
  }
  // Closed figures must have substantial size/area and a small seam.
  if(w<38||h<38||gap>diag*.10)return null;
  let area=0;for(let i=0;i<clean.length;i++){const a=clean[i],b=clean[(i+1)%clean.length];area+=a.x*b.y-b.x*a.y;}
  if(Math.abs(area)/2<w*h*.24)return null;
  const closed=gap>.2?[...clean,first]:clean,samples=samplePath(closed),candidates:{shape:ShapeObject['shape'];score:number;rotation:number;x?:number;y?:number;w?:number;h?:number}[]=[];
  function polygonCandidate(kind:ShapeObject['shape'],vertices:Point[],rotation=0){
    const errors=samples.map(p=>Math.min(...vertices.map((a,i)=>distToSegment(p,a,vertices[(i+1)%vertices.length]))));
    const perimeter=vertices.reduce((v,a,i)=>v+dist(a,vertices[(i+1)%vertices.length]),0);
    const score=errors.reduce((v,e)=>v+e,0)/samples.length/diag;
    const coverage=vertices.every((a,i)=>samples.some(p=>distToSegment(p,a,vertices[(i+1)%vertices.length])<diag*.04));
    if(score<.027&&Math.max(...errors)<diag*.075&&length/perimeter>.75&&length/perimeter<1.28&&coverage)candidates.push({shape:kind,score,rotation});
  }
  polygonCandidate('rect',[{x:minX,y:minY},{x:minX+w,y:minY},{x:minX+w,y:minY+h},{x:minX,y:minY+h}]);
  for(const kind of ['diamond','triangle','righttriangle','pentagon','hexagon','star','trapezoid','parallelogram'] as const){
    const vertices=shapeVertices({...base,shape:kind});polygonCandidate(kind,vertices);
    if(kind==='triangle'){
      // An upside-down triangle keeps the same drag bounds.
      polygonCandidate(kind,vertices.map(p=>({x:2*(minX+w/2)-p.x,y:2*(minY+h/2)-p.y})),Math.PI);
    }
  }
  for(let degrees=15;degrees<180;degrees+=15){
    const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=minX+w/2,cy=minY+h/2;
    const local=clean.map(p=>({x:(p.x-cx)*c+(p.y-cy)*s,y:-(p.x-cx)*s+(p.y-cy)*c}));
    const lx=Math.min(...local.map(p=>p.x)),ly=Math.min(...local.map(p=>p.y)),lw=Math.max(...local.map(p=>p.x))-lx,lh=Math.max(...local.map(p=>p.y))-ly;
    const ox=cx+(lx+lw/2)*c-(ly+lh/2)*s,oy=cy+(lx+lw/2)*s+(ly+lh/2)*c;
    for(const kind of ['rect','triangle','righttriangle','pentagon','hexagon','star','trapezoid','parallelogram'] as const){
      const template={...base,shape:kind,x:ox-lw/2,y:oy-lh/2,w:lw,h:lh};
      const vertices=kind==='rect'?[{x:template.x,y:template.y},{x:template.x+lw,y:template.y},{x:template.x+lw,y:template.y+lh},{x:template.x,y:template.y+lh}]:shapeVertices(template);
      const rotated=vertices.map(p=>({x:ox+(p.x-ox)*c-(p.y-oy)*s,y:oy+(p.x-ox)*s+(p.y-oy)*c}));
      const start=candidates.length;polygonCandidate(kind,rotated,angle);
      if(candidates.length>start){const candidate=candidates[candidates.length-1];candidate.score+=.003;Object.assign(candidate,{x:template.x,y:template.y,w:lw,h:lh});}
    }
  }
  const radial=samples.map(p=>Math.abs(Math.hypot((p.x-minX-w/2)/(w/2),(p.y-minY-h/2)/(h/2))-1));
  const angles=new Set(samples.map(p=>Math.floor((Math.atan2((p.y-minY-h/2)/(h/2),(p.x-minX-w/2)/(w/2))+Math.PI)/(2*Math.PI)*16)%16));
  const ellipsePerimeter=Math.PI*(3*(w/2+h/2)-Math.sqrt((3*w/2+h/2)*(w/2+3*h/2)));
  const radialMean=radial.reduce((v,e)=>v+e,0)/radial.length;
  if(radialMean<.055&&Math.max(...radial)<.12&&angles.size>=14&&length/ellipsePerimeter>.8&&length/ellipsePerimeter<1.2)candidates.push({shape:Math.abs(w/h-1)<.08?'circle':'ellipse',score:radialMean*.35,rotation:0});
  candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];
  if(!best)return null;const result={...base,shape:best.shape,rotation:best.rotation,x:best.x??base.x,y:best.y??base.y,w:best.w??base.w,h:best.h??base.h};
  if(result.shape==='rect'&&result.w<result.h){const cx=result.x+result.w/2,cy=result.y+result.h/2;[result.w,result.h]=[result.h,result.w];result.x=cx-result.w/2;result.y=cy-result.h/2;result.rotation=(result.rotation+Math.PI/2)%Math.PI;}
  return result;
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  label?: string;
  axis?: 'center' | 'edge';
}

export function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  viewW: number,
  viewH: number,
) {
  if (!guides || guides.length === 0) return;
  ctx.save();
  for (const guide of guides) {
    const isCenter = guide.axis === 'center';
    const color = isCenter ? '#f43f5e' : '#00e5ff'; // magenta for center axis, cyan for edges
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    if (guide.type === 'vertical') {
      ctx.moveTo(guide.position, 0);
      ctx.lineTo(guide.position, viewH);
    } else {
      ctx.moveTo(0, guide.position);
      ctx.lineTo(viewW, guide.position);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Pill badge
    const label = guide.label ?? (isCenter ? 'CENTER' : `${Math.round(guide.position)}px`);
    ctx.font = '600 10px system-ui, sans-serif';
    const textMetrics = ctx.measureText(label);
    const pillW = textMetrics.width + 12;
    const pillH = 18;
    let px = guide.type === 'vertical' ? guide.position - pillW / 2 : 24;
    let py = guide.type === 'vertical' ? 24 : guide.position - pillH / 2;
    px = Math.max(4, Math.min(viewW - pillW - 4, px));
    py = Math.max(4, Math.min(viewH - pillH - 4, py));

    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pillW, pillH, 9);
    else ctx.rect(px, py, pillW, pillH);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + pillW / 2, py + pillH / 2);
  }
  ctx.restore();
}
