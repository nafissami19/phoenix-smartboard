import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime12 } from '../src/lib/format-time';

test('formatTime12 formats times in 12-hour format with AM and PM', () => {
  // Midnight
  assert.equal(formatTime12(new Date(2026, 9, 27, 0, 0)), '12:00 AM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 0, 5)), '12:05 AM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 0, 45)), '12:45 AM');

  // Morning
  assert.equal(formatTime12(new Date(2026, 9, 27, 1, 0)), '1:00 AM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 9, 5)), '9:05 AM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 11, 59)), '11:59 AM');

  // Noon
  assert.equal(formatTime12(new Date(2026, 9, 27, 12, 0)), '12:00 PM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 12, 30)), '12:30 PM');

  // Afternoon & Evening
  assert.equal(formatTime12(new Date(2026, 9, 27, 13, 0)), '1:00 PM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 18, 15)), '6:15 PM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 22, 49)), '10:49 PM');
  assert.equal(formatTime12(new Date(2026, 9, 27, 23, 59)), '11:59 PM');
});
