// WCAG 2.x colour contrast helpers for runtime theme tokens. Pure functions.
export type RGB = [number, number, number];
const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i;

export function parseHex(value: string): RGB | undefined {
  const match = HEX.exec(value.trim());
  if (!match) return undefined;
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}
export const toHex = (rgb: RGB) => '#' + rgb.map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');

/** Same result as CSS `color-mix(in srgb, a weight, b)` for opaque colours. */
export function mixHex(a: string, b: string, weight: number): string {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return a;
  const w = Math.max(0, Math.min(1, weight));
  return toHex([0, 1, 2].map(i => x[i] * w + y[i] * (1 - w)) as RGB);
}

export function relativeLuminance(value: string): number {
  const rgb = parseHex(value);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a), y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Lighten (dark modes) or darken (light modes) `color` in small steps until it
 * reaches `target` contrast against `background`; returns the first passing mix. */
export function readableOn(color: string, background: string, mode: 'light' | 'dark', target = 4.5, step = 0.04): string {
  const toward = mode === 'dark' ? '#ffffff' : '#000000';
  for (let amount = 0; amount <= 1 + 1e-9; amount += step) {
    const candidate = mixHex(color, toward, 1 - amount);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return toward;
}

export const DARK_INK = '#0b0f1a';
/** White or dark ink, whichever contrasts more with `background`. */
export function onColor(background: string): string {
  return contrastRatio('#ffffff', background) >= contrastRatio(DARK_INK, background) ? '#ffffff' : DARK_INK;
}
