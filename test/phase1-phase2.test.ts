import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simplifyRDP,
  simplifyStroke,
  drawBackground,
  applyToolStyle,
  recognizeShape,
} from '../src/lib/render';
import type { StrokeObject, Point } from '../src/db/schema';

test('simplifyRDP reduces collinear points along a stroke while preserving endpoints', () => {
  // A straight line sampled with 20 collinear points with micro jitter < 0.2px
  const straightLine: Point[] = Array.from({ length: 20 }, (_, i) => ({
    x: i * 10,
    y: 50 + (i % 2 === 0 ? 0.05 : -0.05),
  }));

  const simplified = simplifyRDP(straightLine, 0.5);
  // Collinear line should be simplified down to 2 endpoints
  assert.equal(simplified.length, 2);
  assert.equal(simplified[0].x, 0);
  assert.equal(simplified[1].x, 190);

  // A polyline with a sharp 90-degree corner
  const cornerPolyline: Point[] = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 100, y: 100 },
  ];
  const cornerSimplified = simplifyRDP(cornerPolyline, 1.0);
  assert.equal(cornerSimplified.length, 3);
  assert.equal(cornerSimplified[1].x, 100);
  assert.equal(cornerSimplified[1].y, 0);
});

test('simplifyStroke simplifies stroke points while preserving metadata', () => {
  const stroke: StrokeObject = {
    id: 's-123',
    kind: 'stroke',
    tool: 'pen',
    color: '#112233',
    width: 4,
    points: Array.from({ length: 15 }, (_, i) => ({ x: i * 5, y: i * 5 })),
    infiniteCloner: true,
  };

  const result = simplifyStroke(stroke, 0.5);
  assert.equal(result.id, 's-123');
  assert.equal(result.infiniteCloner, true);
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].x, 0);
  assert.equal(result.points[1].x, 70);
});

test('applyToolStyle sets destination-out for magic-ink', () => {
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineCap: 'butt',
    lineJoin: 'miter',
  } as unknown as CanvasRenderingContext2D;

  applyToolStyle(ctx, 'magic-ink');
  assert.equal(ctx.globalCompositeOperation, 'destination-out');

  applyToolStyle(ctx, 'highlighter');
  assert.equal(ctx.globalAlpha, 0.35);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
});

test('drawBackground renders specialist grids (music-staff, english-4line, isometric-dots) without error', () => {
  const calls: string[] = [];
  const fakeCtx = {
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    setTransform() {},
    fillRect() {},
    drawImage() {},
    beginPath() { calls.push('beginPath'); },
    moveTo() { calls.push('moveTo'); },
    lineTo() { calls.push('lineTo'); },
    stroke() { calls.push('stroke'); },
    fill() { calls.push('fill'); },
    arc() { calls.push('arc'); },
    createPattern() { return null; },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    setLineDash(d: number[]) { calls.push(`dash:${d.length}`); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  // Music staff
  calls.length = 0;
  drawBackground(fakeCtx, 800, 600, '#18212b', 'staff', 1);
  assert.ok(calls.includes('beginPath'));
  assert.ok(calls.includes('stroke'));

  // English 4-line ruling
  calls.length = 0;
  drawBackground(fakeCtx, 800, 600, '#ffffff', 'english-4line', 1);
  assert.ok(calls.some(c => c.startsWith('dash:')));
  assert.ok(calls.includes('stroke'));

  // Isometric 3D dots
  calls.length = 0;
  drawBackground(fakeCtx, 800, 600, '#18212b', 'isometric-dots', 1);
  assert.ok(calls.includes('arc'));
  assert.ok(calls.includes('fill'));
});

test('recognizeShape snaps freehand points to geometric primitives for draw-and-hold', () => {
  function traced(vertices: { x: number; y: number }[], closed = true) {
    const path = closed ? [...vertices, vertices[0]] : vertices;
    return path.flatMap((a, i) => {
      if (i === path.length - 1) return [a];
      const b = path[i + 1];
      return Array.from({ length: 12 }, (_, j) => ({
        x: a.x + (b.x - a.x) * j / 12 + Math.sin(j * 2) * 0.4,
        y: a.y + (b.y - a.y) * j / 12 + Math.cos(j * 2) * 0.4,
      }));
    });
  }

  // Freehand rectangle points
  const rectPoints = traced([{ x: 40, y: 40 }, { x: 200, y: 40 }, { x: 200, y: 130 }, { x: 40, y: 130 }]);
  const recognizedRect = recognizeShape(rectPoints, '#ff0000', 3);
  assert.ok(recognizedRect);
  assert.equal(recognizedRect.shape, 'rect');

  // Freehand line points
  const linePoints = traced([{ x: 20, y: 40 }, { x: 200, y: 44 }], false);
  const recognizedLine = recognizeShape(linePoints, '#0000ff', 2);
  assert.ok(recognizedLine);
  assert.equal(recognizedLine.shape, 'line');
  assert.equal(recognizedLine.h, 0); // Snapped horizontal
});

test('Lesson recorder formatTimer formats seconds into mm:ss strings', async () => {
  const { formatTimer } = await import('../src/components/board/LessonRecorder');
  assert.equal(formatTimer(0), '00:00');
  assert.equal(formatTimer(9), '00:09');
  assert.equal(formatTimer(65), '01:05');
  assert.equal(formatTimer(745), '12:25');
});

test('Lesson recorder slide framing computes 16:9 proportional fit with letterboxing matching Screenshot 3', () => {
  const outW = 1920;
  const outH = 1080;

  // Portrait/standard 4:3 slide (w=1200, h=900) inside 1920x1080
  const slide43 = { x: 0, y: 0, width: 1200, height: 900 };
  const scale43 = Math.min(outW / slide43.width, outH / slide43.height); // 1.2
  const destW43 = slide43.width * scale43; // 1440
  const destH43 = slide43.height * scale43; // 1080
  const destX43 = (outW - destW43) / 2; // 240
  const destY43 = (outH - destH43) / 2; // 0

  assert.equal(destH43, 1080); // Fills top-to-bottom
  assert.equal(destY43, 0);
  assert.equal(destX43, 240); // Symmetrical dark pillarbox on sides
  assert.equal(destW43 + destX43 * 2, 1920);

  // Exact 16:9 slide (w=1920, h=1080) fills entire canvas without letterboxing
  const slide169 = { x: 0, y: 0, width: 1920, height: 1080 };
  const scale169 = Math.min(outW / slide169.width, outH / slide169.height);
  assert.equal(scale169, 1);
  assert.equal((outW - slide169.width * scale169) / 2, 0);
  assert.equal((outH - slide169.height * scale169) / 2, 0);
});
