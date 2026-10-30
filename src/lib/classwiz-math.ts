/**
 * ClassWiz-Style Mathematical Solvers, Matrix Operations, and Scientific Converters.
 * Offline-first, high precision, designed for interactive teaching smartboards.
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ComplexNumber {
  re: number;
  im: number;
}

export interface QuadraticResult {
  delta: number;
  vertex: { x: number; y: number };
  roots: {
    type: 'distinct-real' | 'repeated-real' | 'complex';
    x1: ComplexNumber;
    x2: ComplexNumber;
  };
  formattedSteps: string[];
}

export interface CubicResult {
  discriminant: number;
  roots: ComplexNumber[];
  formattedSteps: string[];
}

export interface Linear2x2Result {
  status: 'unique' | 'infinite' | 'none';
  x?: number;
  y?: number;
  determinant: number;
  formattedSteps: string[];
}

export interface Linear3x3Result {
  status: 'unique' | 'infinite' | 'none';
  x?: number;
  y?: number;
  z?: number;
  determinant: number;
  formattedSteps: string[];
}

export interface MatrixResult {
  determinant: number;
  transpose: number[][];
  inverse?: number[][];
  isSingular: boolean;
}

// -----------------------------------------------------------------------------
// Number & String Helpers
// -----------------------------------------------------------------------------

export function roundClean(value: number, precision = 6): number {
  if (Math.abs(value) < 1e-12) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function formatComplex(c: ComplexNumber, precision = 4): string {
  const re = roundClean(c.re, precision);
  const im = roundClean(c.im, precision);
  if (im === 0) return `${re}`;
  if (re === 0) return `${im === 1 ? '' : im === -1 ? '-' : im}i`;
  const sign = im > 0 ? '+' : '-';
  const absIm = Math.abs(im);
  return `${re} ${sign} ${absIm === 1 ? '' : absIm}i`;
}

// -----------------------------------------------------------------------------
// 1. Quadratic Equation Solver: ax^2 + bx + c = 0
// -----------------------------------------------------------------------------

export function solveQuadratic(a: number, b: number, c: number): QuadraticResult {
  if (Math.abs(a) < 1e-12) {
    throw new Error('Coefficient "a" cannot be 0 in a quadratic equation.');
  }

  const delta = b * b - 4 * a * c;
  const xv = -b / (2 * a);
  const yv = c - (b * b) / (4 * a);

  const steps: string[] = [
    `Equation: ${a}x² + (${b})x + (${c}) = 0`,
    `Discriminant: Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${roundClean(delta)}`,
    `Vertex: (${roundClean(xv)}, ${roundClean(yv)})`,
  ];

  if (delta > 1e-12) {
    const sqrtD = Math.sqrt(delta);
    const x1 = (-b + sqrtD) / (2 * a);
    const x2 = (-b - sqrtD) / (2 * a);
    steps.push(`Δ > 0 → Two distinct real roots:`);
    steps.push(`x₁ = (-(${b}) + √${roundClean(delta)}) / (2 · ${a}) = ${roundClean(x1)}`);
    steps.push(`x₂ = (-(${b}) - √${roundClean(delta)}) / (2 · ${a}) = ${roundClean(x2)}`);
    return {
      delta: roundClean(delta),
      vertex: { x: roundClean(xv), y: roundClean(yv) },
      roots: {
        type: 'distinct-real',
        x1: { re: roundClean(x1), im: 0 },
        x2: { re: roundClean(x2), im: 0 },
      },
      formattedSteps: steps,
    };
  } else if (Math.abs(delta) <= 1e-12) {
    const x = -b / (2 * a);
    steps.push(`Δ = 0 → One repeated real root:`);
    steps.push(`x = -(${b}) / (2 · ${a}) = ${roundClean(x)}`);
    return {
      delta: 0,
      vertex: { x: roundClean(xv), y: roundClean(yv) },
      roots: {
        type: 'repeated-real',
        x1: { re: roundClean(x), im: 0 },
        x2: { re: roundClean(x), im: 0 },
      },
      formattedSteps: steps,
    };
  } else {
    const re = -b / (2 * a);
    const im = Math.sqrt(-delta) / (2 * a);
    steps.push(`Δ < 0 → Two complex conjugate roots:`);
    steps.push(`x₁ = ${formatComplex({ re, im })}`);
    steps.push(`x₂ = ${formatComplex({ re, im: -im })}`);
    return {
      delta: roundClean(delta),
      vertex: { x: roundClean(xv), y: roundClean(yv) },
      roots: {
        type: 'complex',
        x1: { re: roundClean(re), im: roundClean(im) },
        x2: { re: roundClean(re), im: roundClean(-im) },
      },
      formattedSteps: steps,
    };
  }
}

// -----------------------------------------------------------------------------
// 2. Cubic Equation Solver: ax^3 + bx^2 + cx + d = 0
// -----------------------------------------------------------------------------

export function solveCubic(a: number, b: number, c: number, d: number): CubicResult {
  if (Math.abs(a) < 1e-12) {
    throw new Error('Coefficient "a" cannot be 0 in a cubic equation.');
  }

  // Normalize to x^3 + Bx^2 + Cx + D = 0
  const B = b / a;
  const C = c / a;
  const D = d / a;

  // Substitute x = t - B/3 to get depressed cubic: t^3 + pt + q = 0
  const p = C - (B * B) / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const delta = (q * q) / 4 + (p * p * p) / 27;

  const steps: string[] = [
    `Equation: ${a}x³ + (${b})x² + (${c})x + (${d}) = 0`,
    `Depressed cubic: t³ + (${roundClean(p)})t + (${roundClean(q)}) = 0`,
    `Discriminant: Δ = (q/2)² + (p/3)³ = ${roundClean(delta)}`,
  ];

  const roots: ComplexNumber[] = [];

  if (delta > 1e-12) {
    // 1 real root, 2 complex conjugate roots
    const sqrtDelta = Math.sqrt(delta);
    const u = Math.cbrt(-q / 2 + sqrtDelta);
    const v = Math.cbrt(-q / 2 - sqrtDelta);
    const t1 = u + v;
    const realPart = -(u + v) / 2;
    const imagPart = ((u - v) * Math.sqrt(3)) / 2;

    roots.push({ re: roundClean(t1 - B / 3), im: 0 });
    roots.push({ re: roundClean(realPart - B / 3), im: roundClean(imagPart) });
    roots.push({ re: roundClean(realPart - B / 3), im: roundClean(-imagPart) });

    steps.push('Δ > 0 → 1 real root and 2 complex roots:');
    roots.forEach((r, idx) => steps.push(`x${idx + 1} = ${formatComplex(r)}`));
  } else if (Math.abs(delta) <= 1e-12) {
    // All real roots, at least 2 are equal
    const u = Math.cbrt(-q / 2);
    const t1 = 2 * u;
    const t2 = -u;

    roots.push({ re: roundClean(t1 - B / 3), im: 0 });
    roots.push({ re: roundClean(t2 - B / 3), im: 0 });
    roots.push({ re: roundClean(t2 - B / 3), im: 0 });

    steps.push('Δ = 0 → 3 real roots (with repetition):');
    roots.forEach((r, idx) => steps.push(`x${idx + 1} = ${formatComplex(r)}`));
  } else {
    // 3 distinct real roots (casus irreducibilis)
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const factor = 2 * Math.cbrt(r);

    for (let k = 0; k < 3; k++) {
      const tk = factor * Math.cos((phi + 2 * Math.PI * k) / 3);
      roots.push({ re: roundClean(tk - B / 3), im: 0 });
    }

    steps.push('Δ < 0 → 3 distinct real roots:');
    roots.forEach((r, idx) => steps.push(`x${idx + 1} = ${formatComplex(r)}`));
  }

  return {
    discriminant: roundClean(delta),
    roots,
    formattedSteps: steps,
  };
}

// -----------------------------------------------------------------------------
// 3. Simultaneous Equations Solver: 2x2 & 3x3
// -----------------------------------------------------------------------------

export function solveLinear2x2(
  a1: number, b1: number, c1: number,
  a2: number, b2: number, c2: number,
): Linear2x2Result {
  const D = a1 * b2 - a2 * b1;
  const Dx = c1 * b2 - c2 * b1;
  const Dy = a1 * c2 - a2 * c1;

  const steps = [
    `System:`,
    `  ${a1}x + ${b1}y = ${c1}`,
    `  ${a2}x + ${b2}y = ${c2}`,
    `Determinants: D = ${roundClean(D)}, Dx = ${roundClean(Dx)}, Dy = ${roundClean(Dy)}`,
  ];

  if (Math.abs(D) < 1e-12) {
    if (Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12) {
      steps.push('D = 0 and Dx = Dy = 0 → Infinite solutions (dependent equations)');
      return { status: 'infinite', determinant: 0, formattedSteps: steps };
    }
    steps.push('D = 0 and (Dx ≠ 0 or Dy ≠ 0) → No solution (inconsistent / parallel lines)');
    return { status: 'none', determinant: 0, formattedSteps: steps };
  }

  const x = Dx / D;
  const y = Dy / D;
  steps.push(`Cramer's Rule:`);
  steps.push(`  x = Dx / D = ${roundClean(Dx)} / ${roundClean(D)} = ${roundClean(x)}`);
  steps.push(`  y = Dy / D = ${roundClean(Dy)} / ${roundClean(D)} = ${roundClean(y)}`);

  return {
    status: 'unique',
    x: roundClean(x),
    y: roundClean(y),
    determinant: roundClean(D),
    formattedSteps: steps,
  };
}

export function solveLinear3x3(
  matrix: [[number, number, number, number], [number, number, number, number], [number, number, number, number]],
): Linear3x3Result {
  const [[a1, b1, c1, d1], [a2, b2, c2, d2], [a3, b3, c3, d3]] = matrix;

  const det3x3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const D = det3x3([
    [a1, b1, c1],
    [a2, b2, c2],
    [a3, b3, c3],
  ]);

  const Dx = det3x3([
    [d1, b1, c1],
    [d2, b2, c2],
    [d3, b3, c3],
  ]);

  const Dy = det3x3([
    [a1, d1, c1],
    [a2, d2, c2],
    [a3, d3, c3],
  ]);

  const Dz = det3x3([
    [a1, b1, d1],
    [a2, b2, d2],
    [a3, b3, d3],
  ]);

  const steps = [
    `System:`,
    `  ${a1}x + ${b1}y + ${c1}z = ${d1}`,
    `  ${a2}x + ${b2}y + ${c2}z = ${d2}`,
    `  ${a3}x + ${b3}y + ${c3}z = ${d3}`,
    `Determinants: D = ${roundClean(D)}, Dx = ${roundClean(Dx)}, Dy = ${roundClean(Dy)}, Dz = ${roundClean(Dz)}`,
  ];

  if (Math.abs(D) < 1e-12) {
    if (Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12 && Math.abs(Dz) < 1e-12) {
      steps.push('D = 0 and Dx = Dy = Dz = 0 → Infinite solutions');
      return { status: 'infinite', determinant: 0, formattedSteps: steps };
    }
    steps.push('D = 0 with non-zero minor → No unique solution (parallel/inconsistent planes)');
    return { status: 'none', determinant: 0, formattedSteps: steps };
  }

  const x = Dx / D;
  const y = Dy / D;
  const z = Dz / D;

  steps.push(`Cramer's Rule:`);
  steps.push(`  x = Dx / D = ${roundClean(x)}`);
  steps.push(`  y = Dy / D = ${roundClean(y)}`);
  steps.push(`  z = Dz / D = ${roundClean(z)}`);

  return {
    status: 'unique',
    x: roundClean(x),
    y: roundClean(y),
    z: roundClean(z),
    determinant: roundClean(D),
    formattedSteps: steps,
  };
}

// -----------------------------------------------------------------------------
// 4. Matrix Operations: 2x2 & 3x3
// -----------------------------------------------------------------------------

export function analyzeMatrix(m: number[][]): MatrixResult {
  const n = m.length;
  if (n !== 2 && n !== 3) {
    throw new Error('Only 2x2 and 3x3 matrices are supported.');
  }

  // Transpose
  const transpose = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => roundClean(m[c][r])),
  );

  let det = 0;
  let inverse: number[][] | undefined;

  if (n === 2) {
    det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) > 1e-12) {
      inverse = [
        [roundClean(m[1][1] / det), roundClean(-m[0][1] / det)],
        [roundClean(-m[1][0] / det), roundClean(m[0][0] / det)],
      ];
    }
  } else {
    // 3x3 determinant
    det =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if (Math.abs(det) > 1e-12) {
      // Adjugate matrix
      const adj: number[][] = [
        [
          m[1][1] * m[2][2] - m[1][2] * m[2][1],
          -(m[0][1] * m[2][2] - m[0][2] * m[2][1]),
          m[0][1] * m[1][2] - m[0][2] * m[1][1],
        ],
        [
          -(m[1][0] * m[2][2] - m[1][2] * m[2][0]),
          m[0][0] * m[2][2] - m[0][2] * m[2][0],
          -(m[0][0] * m[1][2] - m[0][2] * m[1][0]),
        ],
        [
          m[1][0] * m[2][1] - m[1][1] * m[2][0],
          -(m[0][0] * m[2][1] - m[0][1] * m[2][0]),
          m[0][0] * m[1][1] - m[0][1] * m[1][0],
        ],
      ];

      inverse = adj.map(row => row.map(val => roundClean(val / det)));
    }
  }

  return {
    determinant: roundClean(det),
    transpose,
    inverse,
    isSingular: Math.abs(det) <= 1e-12,
  };
}

// -----------------------------------------------------------------------------
// 5. Scientific Unit & Programmer Base Converters
// -----------------------------------------------------------------------------

export type SpeedUnit = 'km/h' | 'm/s' | 'mph' | 'knot';
export type TempUnit = 'C' | 'K' | 'F';
export type PressureUnit = 'Pa' | 'kPa' | 'atm' | 'bar' | 'mmHg' | 'psi';
export type EnergyUnit = 'J' | 'kJ' | 'eV' | 'cal' | 'kcal' | 'kWh';

const SPEED_TO_MS: Record<SpeedUnit, number> = {
  'm/s': 1,
  'km/h': 1 / 3.6,
  'mph': 0.44704,
  'knot': 0.514444,
};

export function convertSpeed(value: number, from: SpeedUnit, to: SpeedUnit): number {
  const ms = value * SPEED_TO_MS[from];
  return roundClean(ms / SPEED_TO_MS[to], 6);
}

export function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value;
  // Convert from -> Celsius
  let c = value;
  if (from === 'K') c = value - 273.15;
  else if (from === 'F') c = ((value - 32) * 5) / 9;

  // Convert Celsius -> to
  if (to === 'C') return roundClean(c, 4);
  if (to === 'K') return roundClean(c + 273.15, 4);
  return roundClean((c * 9) / 5 + 32, 4);
}

const PRESSURE_TO_PA: Record<PressureUnit, number> = {
  Pa: 1,
  kPa: 1000,
  atm: 101325,
  bar: 100000,
  mmHg: 133.322368,
  psi: 6894.757,
};

export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): number {
  const pa = value * PRESSURE_TO_PA[from];
  return roundClean(pa / PRESSURE_TO_PA[to], 6);
}

const ENERGY_TO_J: Record<EnergyUnit, number> = {
  J: 1,
  kJ: 1000,
  eV: 1.602176634e-19,
  cal: 4.184,
  kcal: 4184,
  kWh: 3600000,
};

export function convertEnergy(value: number, from: EnergyUnit, to: EnergyUnit): number {
  const joules = value * ENERGY_TO_J[from];
  return roundClean(joules / ENERGY_TO_J[to], 6);
}

export interface BaseConversionResult {
  dec: string;
  hex: string;
  bin: string;
  oct: string;
  formattedBin: string;
}

export function convertBase(input: string, fromBase: 10 | 16 | 2 | 8 = 10): BaseConversionResult {
  const clean = input.trim();
  if (!clean) {
    return { dec: '0', hex: '0', bin: '0', oct: '0', formattedBin: '0000 0000' };
  }

  const num = parseInt(clean, fromBase);
  if (isNaN(num)) {
    throw new Error(`Invalid number "${clean}" for base ${fromBase}`);
  }

  // 32-bit unsigned representation
  const unsigned = num >>> 0;
  const dec = String(num);
  const hex = unsigned.toString(16).toUpperCase();
  const bin = unsigned.toString(2);
  const oct = unsigned.toString(8);

  // Group binary in 4-bit nibbles padded to 8, 16, or 32 bits
  const bitLen = Math.max(8, Math.ceil(bin.length / 4) * 4);
  const padded = bin.padStart(bitLen, '0');
  const formattedBin = (padded.match(/.{1,4}/g) ?? [padded]).join(' ');

  return { dec, hex, bin, oct, formattedBin };
}
