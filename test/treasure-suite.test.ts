import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveQuadratic,
  solveCubic,
  solveLinear2x2,
  solveLinear3x3,
  analyzeMatrix,
  convertSpeed,
  convertTemperature,
  convertPressure,
  convertEnergy,
  convertBase,
} from '../src/lib/classwiz-math.ts';
import { FLOATING_TOOLS } from '../src/lib/constants.ts';
import { arcEdges } from '../src/lib/guide-geometry.ts';

test('solveQuadratic: distinct real roots (x² - 5x + 6 = 0)', () => {
  const result = solveQuadratic(1, -5, 6);
  assert.equal(result.delta, 1);
  assert.equal(result.roots.type, 'distinct-real');
  assert.equal(result.roots.x1.re, 3);
  assert.equal(result.roots.x2.re, 2);
  assert.equal(result.vertex.x, 2.5);
  assert.equal(result.vertex.y, -0.25);
  assert.ok(result.formattedSteps.length >= 4);
});

test('solveQuadratic: repeated real root (x² - 4x + 4 = 0)', () => {
  const result = solveQuadratic(1, -4, 4);
  assert.equal(result.delta, 0);
  assert.equal(result.roots.type, 'repeated-real');
  assert.equal(result.roots.x1.re, 2);
  assert.equal(result.roots.x2.re, 2);
  assert.equal(result.vertex.x, 2);
  assert.equal(result.vertex.y, 0);
});

test('solveQuadratic: complex conjugate roots (x² + 2x + 5 = 0)', () => {
  const result = solveQuadratic(1, 2, 5);
  assert.equal(result.delta, -16);
  assert.equal(result.roots.type, 'complex');
  assert.equal(result.roots.x1.re, -1);
  assert.equal(result.roots.x1.im, 2);
  assert.equal(result.roots.x2.re, -1);
  assert.equal(result.roots.x2.im, -2);
});

test('solveCubic: 3 distinct real roots (x³ - 6x² + 11x - 6 = 0 => (x-1)(x-2)(x-3))', () => {
  const result = solveCubic(1, -6, 11, -6);
  assert.equal(result.roots.length, 3);
  const realParts = result.roots.map(r => Math.round(r.re)).sort((a, b) => a - b);
  assert.deepEqual(realParts, [1, 2, 3]);
});

test('solveLinear2x2: unique solution (2x + y = 7, x - y = 2 => x=3, y=1)', () => {
  const result = solveLinear2x2(2, 1, 7, 1, -1, 2);
  assert.equal(result.status, 'unique');
  assert.equal(result.x, 3);
  assert.equal(result.y, 1);
  assert.equal(result.determinant, -3);
});

test('solveLinear2x2: parallel lines / no solution (2x + 4y = 8, x + 2y = 10)', () => {
  const result = solveLinear2x2(2, 4, 8, 1, 2, 10);
  assert.equal(result.status, 'none');
  assert.equal(result.determinant, 0);
});

test('solveLinear3x3: unique solution (x+y+z=6, 2y+5z=-4, 2x+5y-z=27)', () => {
  const result = solveLinear3x3([
    [1, 1, 1, 6],
    [0, 2, 5, -4],
    [2, 5, -1, 27],
  ]);
  assert.equal(result.status, 'unique');
  assert.equal(result.x, 5);
  assert.equal(result.y, 3);
  assert.equal(result.z, -2);
});

test('analyzeMatrix: 2x2 determinant and inverse', () => {
  const m = [
    [4, 7],
    [2, 6],
  ];
  const res = analyzeMatrix(m);
  assert.equal(res.determinant, 10);
  assert.equal(res.isSingular, false);
  assert.deepEqual(res.inverse, [
    [0.6, -0.7],
    [-0.2, 0.4],
  ]);
  assert.deepEqual(res.transpose, [
    [4, 2],
    [7, 6],
  ]);
});

test('analyzeMatrix: 3x3 determinant and inverse', () => {
  const m = [
    [1, 0, 2],
    [2, -1, 3],
    [4, 1, 8],
  ];
  const res = analyzeMatrix(m);
  // det = 1(-11) - 0 + 2(6) = -11 + 12 = 1
  assert.equal(res.determinant, 1);
  assert.equal(res.isSingular, false);
  assert.ok(res.inverse);
});

test('convertSpeed, convertTemperature, convertPressure, convertEnergy', () => {
  // Speed
  assert.equal(convertSpeed(100, 'km/h', 'm/s'), 27.777778);
  assert.equal(convertSpeed(10, 'm/s', 'km/h'), 36);

  // Temp
  assert.equal(convertTemperature(100, 'C', 'F'), 212);
  assert.equal(convertTemperature(0, 'C', 'K'), 273.15);
  assert.equal(convertTemperature(32, 'F', 'C'), 0);

  // Pressure
  assert.equal(convertPressure(1, 'atm', 'Pa'), 101325);
  assert.equal(convertPressure(1, 'bar', 'kPa'), 100);

  // Energy
  assert.equal(convertEnergy(1, 'cal', 'J'), 4.184);
  assert.equal(convertEnergy(1, 'kWh', 'J'), 3600000);
});

test('convertBase: decimal, hex, binary, octal conversion', () => {
  const res = convertBase('255', 10);
  assert.equal(res.dec, '255');
  assert.equal(res.hex, 'FF');
  assert.equal(res.bin, '11111111');
  assert.equal(res.oct, '377');
  assert.equal(res.formattedBin, '1111 1111');
});

test('FLOATING_TOOLS registry includes new math & classroom tools', () => {
  const ids = FLOATING_TOOLS.map((t: { id: string }) => t.id);
  assert.ok(ids.includes('noise-meter'), 'noise-meter tool registered');
});

test('arcEdges produces continuous guide edge segments along arc', () => {
  const center = { x: 200, y: 200 };
  const radius = 100;
  const edges = arcEdges(center, radius, 0, Math.PI);
  assert.ok(edges.length > 10, 'generates smooth segments');
  // Verify first and last point
  assert.ok(Math.abs(edges[0].a.x - 300) < 1e-4);
  assert.ok(Math.abs(edges[0].a.y - 200) < 1e-4);
  assert.ok(Math.abs(edges[edges.length - 1].b.x - 100) < 1e-4);
  assert.ok(Math.abs(edges[edges.length - 1].b.y - 200) < 1e-4);
});

test('solveCubic: 1 real root and 2 complex roots (x³ - 1 = 0)', () => {
  const res = solveCubic(1, 0, 0, -1);
  assert.equal(res.roots.length, 3);
  assert.equal(res.roots[0].re, 1);
  assert.equal(res.roots[0].im, 0);
  assert.equal(res.roots[1].re, -0.5);
  assert.ok(Math.abs(res.roots[1].im - 0.866) < 0.01);
});

test('analyzeMatrix: singular 2x2 matrix (det = 0, no inverse)', () => {
  const m = [
    [2, 4],
    [1, 2],
  ];
  const res = analyzeMatrix(m);
  assert.equal(res.determinant, 0);
  assert.equal(res.isSingular, true);
  assert.equal(res.inverse, undefined);
});

