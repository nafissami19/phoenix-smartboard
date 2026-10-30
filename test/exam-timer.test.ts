import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NSU_EXAM_TIMER_PRESET,
  DEFAULT_EXAM_PRESETS,
  calculateTotalExamDurationMinutes,
  formatDurationLabel,
  formatTimeRemaining,
  loadExamPresets,
  saveExamPresets,
  loadActiveExamPresetId,
  saveActiveExamPresetId,
  type ExamPreset,
} from '../src/lib/exam-timers';

test('defines the NSU Exam Timer preset with exact 4 sections (25m, 75m, 30m, 20m)', () => {
  assert.ok(NSU_EXAM_TIMER_PRESET);
  assert.equal(NSU_EXAM_TIMER_PRESET.title, 'NSU Exam Timer');
  assert.equal(NSU_EXAM_TIMER_PRESET.sections.length, 4);

  const [secA, secB, secC, secD] = NSU_EXAM_TIMER_PRESET.sections;
  assert.equal(secA.name, 'Section A');
  assert.equal(secA.durationMinutes, 25);

  assert.equal(secB.name, 'Section B');
  assert.equal(secB.durationMinutes, 75);

  assert.equal(secC.name, 'Section C');
  assert.equal(secC.durationMinutes, 30);

  assert.equal(secD.name, 'Section D');
  assert.equal(secD.durationMinutes, 20);

  const totalMinutes = calculateTotalExamDurationMinutes(NSU_EXAM_TIMER_PRESET);
  assert.equal(totalMinutes, 150); // 2h 30m
});

test('formats duration labels accurately', () => {
  assert.equal(formatDurationLabel(150), '2h 30m');
  assert.equal(formatDurationLabel(60), '1h');
  assert.equal(formatDurationLabel(45), '45m');
  assert.equal(formatDurationLabel(75), '1h 15m');
});

test('formats remaining seconds to MM:SS and HH:MM:SS', () => {
  assert.equal(formatTimeRemaining(0), '00:00');
  assert.equal(formatTimeRemaining(59), '00:59');
  assert.equal(formatTimeRemaining(60), '01:00');
  assert.equal(formatTimeRemaining(25 * 60), '25:00');
  assert.equal(formatTimeRemaining(75 * 60), '01:15:00');
  assert.equal(formatTimeRemaining(150 * 60), '02:30:00');
});

test('loads default presets with only NSU preset when localStorage is absent or empty', () => {
  const presets = loadExamPresets();
  assert.equal(presets.length, 1);
  assert.equal(presets[0].id, NSU_EXAM_TIMER_PRESET.id);
  assert.equal(presets[0].title, 'NSU Exam Timer');
});

test('saves and loads active preset id fallback', () => {
  // In node environment without window, defaults to NSU preset id
  const activeId = loadActiveExamPresetId();
  assert.equal(activeId, NSU_EXAM_TIMER_PRESET.id);
});
