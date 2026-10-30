export interface ExamSection {
  id: string;
  name: string;
  durationMinutes: number;
}

export interface ExamPreset {
  id: string;
  title: string;
  description?: string;
  sections: ExamSection[];
  isBuiltin?: boolean;
  createdAt: number;
}

export const NSU_EXAM_TIMER_PRESET: ExamPreset = {
  id: "nsu-exam-preset",
  title: "NSU Exam Timer",
  description: "Standard 4-section exam: Section A (25m), Section B (75m), Section C (30m), Section D (20m)",
  isBuiltin: true,
  createdAt: 1700000000000,
  sections: [
    { id: "sec-a", name: "Section A", durationMinutes: 25 },
    { id: "sec-b", name: "Section B", durationMinutes: 75 },
    { id: "sec-c", name: "Section C", durationMinutes: 30 },
    { id: "sec-d", name: "Section D", durationMinutes: 20 },
  ],
};

export const DEFAULT_EXAM_PRESETS: ExamPreset[] = [
  NSU_EXAM_TIMER_PRESET,
];

const PRESETS_STORAGE_KEY = "phoenix_exam_presets_v1";
const ACTIVE_PRESET_ID_KEY = "phoenix_exam_active_preset_v1";

export function loadExamPresets(): ExamPreset[] {
  if (typeof window === "undefined") return DEFAULT_EXAM_PRESETS;
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_EXAM_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Filter out deleted non-NSU builtin presets (midterm, 1hr)
      const sanitized = parsed.filter(
        (p: ExamPreset) => p.id !== "midterm-2part-preset" && p.id !== "standard-1hr-preset"
      );
      // Ensure NSU preset is always present as the first preset
      const hasNsu = sanitized.some((p: ExamPreset) => p.id === NSU_EXAM_TIMER_PRESET.id);
      if (!hasNsu) {
        return [NSU_EXAM_TIMER_PRESET, ...sanitized];
      }
      return sanitized.length > 0 ? sanitized : DEFAULT_EXAM_PRESETS;
    }
    return DEFAULT_EXAM_PRESETS;
  } catch {
    return DEFAULT_EXAM_PRESETS;
  }
}

export function saveExamPresets(presets: ExamPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("Failed to save exam presets to localStorage:", err);
  }
}

export function loadActiveExamPresetId(): string {
  if (typeof window === "undefined") return NSU_EXAM_TIMER_PRESET.id;
  try {
    return localStorage.getItem(ACTIVE_PRESET_ID_KEY) || NSU_EXAM_TIMER_PRESET.id;
  } catch {
    return NSU_EXAM_TIMER_PRESET.id;
  }
}

export function saveActiveExamPresetId(presetId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_PRESET_ID_KEY, presetId);
  } catch (err) {
    console.error("Failed to save active exam preset id:", err);
  }
}

export function calculateTotalExamDurationMinutes(preset: ExamPreset): number {
  return preset.sections.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
}

export function formatDurationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function formatTimeRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Play a high-clarity bell chime using Web Audio API oscillator synthesis.
 * Safe for offline usage without downloading audio files.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playSectionChangeChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const tones = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (major chord chime)

  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.12);

    gain.gain.setValueAtTime(0, now + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.3, now + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.75);
  });
}

export function playExamFinishedChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Victorious 5-note fanfare chime
  const tones = [523.25, 659.25, 783.99, 1046.5, 1318.51];

  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + i * 0.14);

    gain.gain.setValueAtTime(0, now + i * 0.14);
    gain.gain.linearRampToValueAtTime(0.35, now + i * 0.14 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.14);
    osc.stop(now + i * 0.14 + 1.3);
  });
}
