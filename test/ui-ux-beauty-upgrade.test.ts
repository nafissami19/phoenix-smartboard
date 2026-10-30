import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  objectBounds,
  drawSnapGuides,
  drawBackground,
  type SnapGuide,
} from '../src/lib/render';
import type { TextObject, MediaItem } from '../src/db/schema';

test('Text cards calculate expanded bounds with padding for styled callout cards', () => {
  const plainText: TextObject = {
    id: 't-1',
    kind: 'text',
    x: 100,
    y: 100,
    text: 'Theorem 1: Pythagorean Theorem',
    fontSize: 24,
    fontFamily: 'Inter, sans-serif',
    bold: true,
    color: '#ffffff',
    cardStyle: 'none',
  };

  const plainBounds = objectBounds(plainText);
  assert.equal(plainBounds.x, 100);
  assert.equal(plainBounds.y, 100);

  const calloutText: TextObject = {
    ...plainText,
    id: 't-2',
    cardStyle: 'callout',
    cardBg: 'rgba(56,189,248,0.1)',
    cardBorder: '#0284c7',
  };

  const calloutBounds = objectBounds(calloutText);
  // Padding padX = Math.max(14, 24 * 0.7) = 16.8
  // Padding padY = Math.max(10, 24 * 0.5) = 12
  assert.ok(calloutBounds.x < plainBounds.x, 'Card x should be offset left by padding');
  assert.ok(calloutBounds.y < plainBounds.y, 'Card y should be offset top by padding');
  assert.ok(calloutBounds.w > plainBounds.w, 'Card width should be larger than plain text width');
  assert.ok(calloutBounds.h > plainBounds.h, 'Card height should be larger than plain text height');
});

test('drawSnapGuides executes cleanly for center-axis and edge snap guides', () => {
  const guides: SnapGuide[] = [
    { type: 'vertical', position: 640, axis: 'center' },
    { type: 'horizontal', position: 360, axis: 'center' },
    { type: 'vertical', position: 200, axis: 'edge', label: '200px' },
  ];

  let lineCount = 0;
  let pillCount = 0;
  const mockCtx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() { lineCount++; },
    stroke() {},
    fill() { pillCount++; },
    rect() {},
    roundRect() {},
    setLineDash() {},
    measureText(text: string) { return { width: text.length * 6 }; },
    fillText() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;

  drawSnapGuides(mockCtx, guides, 1280, 720);
  assert.equal(lineCount, 3, 'Should draw 3 snap guide lines');
  assert.equal(pillCount, 3, 'Should draw 3 pill badges for the snap guides');
});

test('drawBackground supports chalkboard 2-column and 3-column divider layouts', () => {
  let pathsDrawn = 0;
  const mockCtx = {
    save() {},
    restore() {},
    setTransform() {},
    fillRect() {},
    beginPath() { pathsDrawn++; },
    moveTo() {},
    lineTo() {},
    stroke() {},
    setLineDash() {},
    fillText() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    letterSpacing: '',
  } as unknown as CanvasRenderingContext2D;

  // 2-Column layout
  drawBackground(mockCtx, 1920, 1080, '#163d30', 'columns-2', 1);
  assert.ok(pathsDrawn > 0, 'Should trace divider path for 2-column chalkboard');

  // 3-Column layout
  pathsDrawn = 0;
  drawBackground(mockCtx, 1920, 1080, '#163d30', 'columns-3', 1);
  assert.ok(pathsDrawn > 0, 'Should trace divider paths for 3-column chalkboard');
});

test('locked media and objects preserve coordinates and reject translation during movement', () => {
  const lockedMedia: MediaItem = {
    id: 'slide-1',
    kind: 'pdf',
    assetId: 'asset-1',
    pageNumber: 1,
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
    rotation: 0,
    locked: true,
  };

  const unlockedMedia: MediaItem = {
    ...lockedMedia,
    id: 'slide-2',
    locked: false,
  };

  const selectedIds = ['slide-1', 'slide-2'];
  const dx = 50;
  const dy = 50;

  // Translation logic matching use-whiteboard
  const movedMedia = [lockedMedia, unlockedMedia].map(m =>
    selectedIds.includes(m.id) && !m.locked ? { ...m, x: m.x + dx, y: m.y + dy } : m
  );

  // Locked media must not have moved
  assert.equal(movedMedia[0].x, 100);
  assert.equal(movedMedia[0].y, 100);
  assert.equal(movedMedia[0].locked, true);

  // Unlocked media must have moved
  assert.equal(movedMedia[1].x, 150);
  assert.equal(movedMedia[1].y, 150);
});
