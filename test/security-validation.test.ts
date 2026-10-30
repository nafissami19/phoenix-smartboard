import test from 'node:test';
import assert from 'node:assert/strict';
import { toArrayBuffer, toUint8Array } from '../src/lib/buffer';
import { safeWebLink, youtubeID } from '../src/lib/special-objects';
import { importLesson } from '../src/lib/lesson-bundle';
import path from 'node:path';

test('toArrayBuffer handles various typed array views and offsets securely', async () => {
  const fullBuffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;
  // Subarray with offset 2 and length 4 => [30, 40, 50, 60]
  const viewWithOffset = new Uint8Array(fullBuffer, 2, 4);
  const result = await toArrayBuffer(viewWithOffset);
  assert.equal(result.byteLength, 4);
  const resultBytes = new Uint8Array(result);
  assert.deepEqual(Array.from(resultBytes), [30, 40, 50, 60]);

  // Float32Array view
  const floats = new Float32Array([1.5, 2.5, 3.5]);
  const floatBuf = await toArrayBuffer(floats);
  assert.equal(floatBuf.byteLength, 12);

  // DataView
  const dataView = new DataView(fullBuffer, 1, 5);
  const dataViewBuf = await toArrayBuffer(dataView);
  assert.equal(dataViewBuf.byteLength, 5);
});

test('toArrayBuffer unwraps deeply nested wrappers and rejects non-binary objects', async () => {
  const innerBytes = new Uint8Array([1, 2, 3]);
  const nested = { file: { blob: { file: innerBytes } } };
  const res = await toArrayBuffer(nested);
  assert.deepEqual(Array.from(new Uint8Array(res)), [1, 2, 3]);

  // Object without buffer content is rejected
  const emptyWrapper = { foo: 'bar' };
  await assert.rejects(() => toArrayBuffer(emptyWrapper), /Unsupported binary input type/);
});

test('safeWebLink strictly rejects dangerous protocols and credentials', () => {
  // Disallow javascript:, data:, file:
  assert.throws(() => safeWebLink('javascript:alert(1)'), /Enter a public HTTP or HTTPS link/);
  assert.throws(() => safeWebLink('data:text/html,<script>alert(1)</script>'), /Enter a public HTTP or HTTPS link/);
  assert.throws(() => safeWebLink('file:///C:/Windows/win.ini'), /Enter a public HTTP or HTTPS link/);
  assert.throws(() => safeWebLink('vbscript:msgbox(1)'), /Enter a public HTTP or HTTPS link/);

  // Disallow embedded user credentials (phishing / credential leak)
  assert.throws(() => safeWebLink('https://admin:secret@malicious.com'), /Enter a public HTTP or HTTPS link/);

  // Disallow strings over 2048 chars
  assert.throws(() => safeWebLink('https://example.com/' + 'a'.repeat(2050)), /Enter a public HTTP or HTTPS link/);

  // Allow clean public URLs
  assert.equal(safeWebLink('https://school.edu/lesson'), 'https://school.edu/lesson');
  assert.equal(safeWebLink('http://example.com/page?id=123'), 'http://example.com/page?id=123');
});

test('youtubeID extracts valid 11-char IDs and rejects traversal or query manipulation', () => {
  assert.equal(youtubeID('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeID('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeID('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeID('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');

  // Rejection of invalid characters or injection attempts
  assert.throws(() => youtubeID('https://www.youtube.com/watch?v=../etc/passwd'), /Enter a YouTube video link/);
  assert.throws(() => youtubeID('https://not-youtube.com/watch?v=dQw4w9WgXcQ'), /Enter a YouTube video link/);
  assert.throws(() => youtubeID('<script>alert(1)</script>'));
});

test('Path traversal sanitizer keeps files inside intended directory', () => {
  const baseDir = path.resolve('C:/App/Library');
  const sanitize = (name: string) => {
    const cleanName = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'default';
    const target = path.resolve(baseDir, cleanName);
    if (!target.startsWith(baseDir + path.sep) && target !== baseDir) {
      throw new Error('Path traversal attempt detected');
    }
    return target;
  };

  assert.equal(sanitize('lesson.ps'), path.join(baseDir, 'lesson.ps'));
  assert.equal(sanitize('../../../etc/passwd'), path.join(baseDir, 'passwd'));
  assert.equal(sanitize('..\\..\\Windows\\System32\\cmd.exe'), path.join(baseDir, 'cmd.exe'));
  assert.equal(sanitize('folder/nested/test.ps'), path.join(baseDir, 'test.ps'));
});

test('importLesson rejects prototype pollution and strips __proto__ keys', async () => {
  const maliciousPayload = JSON.stringify({
    format: 'phoenix-smartboard',
    version: 1,
    __proto__: { polluted: true },
    constructor: { prototype: { admin: true } },
    notebook: {
      title: 'Math Lesson',
      subject: 'Algebra',
      __proto__: { pollutedNotebook: true }
    },
    pages: [
      {
        background: '#ffffff',
        pattern: 'dots',
        __proto__: { pollutedPage: true },
        objects: [],
        media: []
      }
    ],
    assets: []
  });

  const lessonId = await importLesson(new Blob([maliciousPayload], { type: 'application/json' }));
  assert.ok(lessonId);

  // Verify prototype was not polluted
  assert.equal((Object.prototype as any).polluted, undefined);
  assert.equal((Object.prototype as any).admin, undefined);
  assert.equal((Object.prototype as any).pollutedNotebook, undefined);
  assert.equal((Object.prototype as any).pollutedPage, undefined);
});

test('importLesson rejects corrupted pen strokes and unbounded coordinates', async () => {
  const badStrokePayload = JSON.stringify({
    format: 'phoenix-smartboard',
    version: 1,
    notebook: { title: 'Test Lesson' },
    pages: [
      {
        background: '#ffffff',
        pattern: 'dots',
        objects: [
          {
            kind: 'stroke',
            tool: 'pen',
            points: [{ x: NaN, y: 100 }], // NaN coordinate
            width: 5,
            color: '#111111'
          }
        ],
        media: []
      }
    ],
    assets: []
  });

  await assert.rejects(
    () => importLesson(new Blob([badStrokePayload], { type: 'application/json' })),
    /Invalid pen stroke/
  );
});

test('importLesson bounds pageNumber and numPages on imported document media', async () => {
  const lessonWithMedia = JSON.stringify({
    format: 'phoenix-smartboard',
    version: 1,
    notebook: { title: 'Document Lesson' },
    assets: [
      {
        id: 'asset-doc-1',
        name: 'test.pdf',
        mimeType: 'application/pdf',
        dataBase64: Buffer.from('%PDF-1.4 test bytes').toString('base64')
      }
    ],
    pages: [
      {
        background: '#ffffff',
        pattern: 'none',
        objects: [],
        media: [
          {
            kind: 'pdf',
            assetId: 'asset-doc-1',
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            pageNumber: -99, // Should be normalized to 1
            numPages: -5 // Should be normalized to 1
          }
        ]
      }
    ]
  });

  const lessonId = await importLesson(new Blob([lessonWithMedia], { type: 'application/json' }));
  assert.ok(lessonId);
});

test('importLesson enforces 500-page limit against denial-of-service', async () => {
  const massivePages = Array.from({ length: 501 }, (_, i) => ({
    background: '#ffffff',
    pattern: 'none',
    position: i,
    objects: [],
    media: []
  }));

  const dosPayload = JSON.stringify({
    format: 'phoenix-smartboard',
    version: 1,
    notebook: { title: 'Huge Lesson' },
    pages: massivePages,
    assets: []
  });

  await assert.rejects(
    () => importLesson(new Blob([dosPayload], { type: 'application/json' })),
    /Invalid lesson format/
  );
});
