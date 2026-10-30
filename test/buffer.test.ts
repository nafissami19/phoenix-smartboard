import test from 'node:test';
import assert from 'node:assert/strict';
import { toArrayBuffer, toUint8Array } from '../src/lib/buffer.js';

test('toArrayBuffer handles direct ArrayBuffer', async () => {
  const buf = new ArrayBuffer(8);
  const result = await toArrayBuffer(buf);
  assert.equal(result, buf);
});

test('toArrayBuffer handles Uint8Array and subarray with offset', async () => {
  const original = new Uint8Array([10, 20, 30, 40, 50]);
  const sub = original.subarray(1, 4);
  const resultBuf = await toArrayBuffer(sub);
  const resultView = new Uint8Array(resultBuf);
  assert.equal(resultView.length, 3);
  assert.equal(resultView[0], 20);
  assert.equal(resultView[1], 30);
  assert.equal(resultView[2], 40);
});

test('toArrayBuffer handles Blob and File', async () => {
  const blob = new Blob(['Hello Phoenix!'], { type: 'text/plain' });
  const resultBuf = await toArrayBuffer(blob);
  const text = new TextDecoder().decode(resultBuf);
  assert.equal(text, 'Hello Phoenix!');
});

test('toArrayBuffer handles wrapper objects { file: ... } and { blob: ... }', async () => {
  const blob = new Blob(['Wrapped file content'], { type: 'text/plain' });
  const wrapper1 = { file: blob };
  const wrapper2 = { blob };
  const wrapper3 = { data: new Uint8Array([1, 2, 3]) };

  assert.equal(new TextDecoder().decode(await toArrayBuffer(wrapper1)), 'Wrapped file content');
  assert.equal(new TextDecoder().decode(await toArrayBuffer(wrapper2)), 'Wrapped file content');
  assert.deepEqual(Array.from(new Uint8Array(await toArrayBuffer(wrapper3))), [1, 2, 3]);
});

test('toArrayBuffer handles base64 string and data URL', async () => {
  const dataUrl = 'data:application/octet-stream;base64,AQIDBA==';
  const rawBase64 = 'AQIDBA==';

  const res1 = await toArrayBuffer(dataUrl);
  const res2 = await toArrayBuffer(rawBase64);

  assert.deepEqual(Array.from(new Uint8Array(res1)), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(new Uint8Array(res2)), [1, 2, 3, 4]);
});

test('toArrayBuffer falls back gracefully if blob.arrayBuffer is undefined', async () => {
  const blob = new Blob(['fallback test']);
  const legacyBlob = Object.create(blob);
  legacyBlob.arrayBuffer = undefined;

  const resultBuf = await toArrayBuffer(legacyBlob);
  const text = new TextDecoder().decode(resultBuf);
  assert.equal(text, 'fallback test');
});

test('toUint8Array produces Uint8Array directly', async () => {
  const direct = new Uint8Array([5, 6, 7]);
  assert.equal(await toUint8Array(direct), direct);

  const fromBlob = await toUint8Array(new Blob(['ABC']));
  assert.deepEqual(Array.from(fromBlob), [65, 66, 67]);
});
