"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { compileTeachingExpression, formatMathNumber, type AngleMode } from '@/lib/teaching-math';
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
  type SpeedUnit,
  type TempUnit,
  type PressureUnit,
  type EnergyUnit,
} from '@/lib/classwiz-math';
import { formatTime12 } from '@/lib/format-time';
import './TeachingMath.css';

// ------------------------------- Calculator --------------------------------

function stampTextToBoard(text: string, onStamp?: (text: string) => void) {
  if (onStamp) {
    onStamp(text);
  } else {
    window.dispatchEvent(new CustomEvent('phoenix-stamp-text', { detail: { text } }));
  }
}

export function SingleCalculator({
  id = 'calc-1',
  onStamp,
}: {
  id?: string;
  onStamp?: (text: string) => void;
}) {
  const [expression, setExpression] = useState('');
  const [scientific, setScientific] = useState(false);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [textbookMode, setTextbookMode] = useState(true);
  const [answer, setAnswer] = useState(0);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<{ expression: string; result: string; angleMode: AngleMode }[]>([]);
  const input = useRef<HTMLInputElement>(null);

  function insert(value: string, operator = false) {
    const field = input.current;
    const base = complete && !operator ? '' : expression;
    const start = complete ? base.length : (field?.selectionStart ?? base.length);
    const end = complete ? base.length : (field?.selectionEnd ?? base.length);
    const next = base.slice(0, start) + value + base.slice(end);
    if (next.length > 240) return;
    setExpression(next);
    setComplete(false);
    setError('');
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + value.length, start + value.length);
    });
  }

  function functionKey(name: string) {
    if (complete) {
      setExpression(`${name}(${expression})`);
      setComplete(false);
      setError('');
      input.current?.focus();
    } else {
      insert(`${name}(`);
    }
  }

  async function equals() {
    if (busy) return;
    setBusy(true);
    setError('');
    const submitted = expression;
    try {
      const evaluate = await compileTeachingExpression(submitted, { angleMode, answer });
      const result = evaluate();
      const formatted = formatMathNumber(result);
      setAnswer(result);
      setExpression(formatted);
      setComplete(true);
      setHistory(prev => [{ expression: submitted, result: formatted, angleMode }, ...prev].slice(0, 6));
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not calculate this expression.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setExpression('');
    setComplete(false);
    setError('');
    input.current?.focus();
  }

  function backspace() {
    const field = input.current;
    const start = field?.selectionStart ?? expression.length;
    const end = field?.selectionEnd ?? expression.length;
    setExpression(expression.slice(0, start === end ? Math.max(0, start - 1) : start) + expression.slice(end));
    setComplete(false);
    setError('');
    requestAnimationFrame(() => {
      field?.focus();
      const caret = start === end ? Math.max(0, start - 1) : start;
      field?.setSelectionRange(caret, caret);
    });
  }

  // Natural textbook formatted preview
  const naturalDisplay = useMemo(() => {
    if (!expression) return '';
    return expression
      .replace(/\*/g, ' · ')
      .replace(/\//g, ' / ')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/sqrt\(([^)]+)\)/g, '√($1)');
  }, [expression]);

  return (
    <section
      className="teaching-calculator"
      aria-label="Teaching calculator"
      onKeyDown={event => {
        event.stopPropagation();
        if (event.target !== input.current) return;
        if (event.key === 'Enter' || event.key === '=') {
          event.preventDefault();
          void equals();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          clear();
        } else if (complete && ['+', '-', '*', '/', '^'].includes(event.key)) {
          event.preventDefault();
          insert(event.key, true);
        }
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="math-mode-switch flex-1" aria-label="Calculator mode">
          <button type="button" className="kn-focus" aria-pressed={!scientific} onClick={() => setScientific(false)}>
            Basic
          </button>
          <button type="button" className="kn-focus" aria-pressed={scientific} onClick={() => setScientific(true)}>
            Scientific
          </button>
        </div>
        <button
          type="button"
          onClick={() => setTextbookMode(v => !v)}
          className={`h-9 px-2 rounded-lg text-xs font-semibold border ${
            textbookMode ? 'border-brand bg-brand/10 text-brand-light' : 'border-line text-muted'
          }`}
          title="Toggle Natural Textbook Display"
        >
          {textbookMode ? 'Natural 📖' : 'Standard'}
        </button>
      </div>

      {scientific && (
        <div className="math-mode-switch" aria-label="Angle unit">
          <button type="button" className="kn-focus" aria-pressed={angleMode === 'DEG'} onClick={() => setAngleMode('DEG')}>
            DEG
          </button>
          <button type="button" className="kn-focus" aria-pressed={angleMode === 'RAD'} onClick={() => setAngleMode('RAD')}>
            RAD
          </button>
        </div>
      )}

      {textbookMode && naturalDisplay && (
        <div className="classwiz-textbook-display select-none">
          {naturalDisplay} {complete ? `= ${formatMathNumber(answer)}` : ''}
        </div>
      )}

      <label className="calculator-expression">
        Expression
        <input
          ref={input}
          aria-label="Calculator expression"
          className="kn-focus"
          autoComplete="off"
          spellCheck={false}
          maxLength={240}
          value={expression}
          placeholder="0"
          onChange={event => {
            setExpression(event.target.value);
            setComplete(false);
            setError('');
          }}
        />
      </label>

      <output className="calculator-answer" aria-live="polite">
        {complete ? `Result: ${expression}` : `Ans: ${formatMathNumber(answer)}`}
      </output>

      {error && <p role="alert" className="teaching-math-error">{error}</p>}

      {scientific && (
        <div className="calculator-scientific-keys">
          {['sin', 'cos', 'tan', 'sqrt', 'asin', 'acos', 'atan', 'abs', 'log', 'ln', 'exp', 'factorial'].map(name => (
            <button key={name} type="button" className="kn-focus" onClick={() => functionKey(name)}>
              {name === 'factorial' ? 'n!' : name}
            </button>
          ))}
          {[
            ['π', 'pi'],
            ['e', 'e'],
            ['x²', '^2'],
            ['xʸ', '^'],
          ].map(([label, value]) => (
            <button key={label} type="button" className="kn-focus" onClick={() => insert(value, value.startsWith('^'))}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="calculator-keypad">
        <button type="button" className="kn-focus" onClick={clear}>C</button>
        <button type="button" className="kn-focus" aria-label="Calculator backspace" onClick={backspace}>⌫</button>
        <button type="button" className="kn-focus" onClick={() => insert('(')}>(</button>
        <button type="button" className="kn-focus" onClick={() => insert(')', true)}>)</button>
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '=', '+'].map(key => (
          <button
            key={key}
            type="button"
            disabled={key === '=' && busy}
            className={`kn-focus ${key === '=' ? 'calculator-equals' : ''}`}
            aria-label={key === '=' ? 'Calculate' : key}
            onClick={() => (key === '=' ? void equals() : insert(key === '×' ? '*' : key === '÷' ? '/' : key, ['+', '-', '×', '÷'].includes(key)))}
          >
            {key === '=' && busy ? '…' : key}
          </button>
        ))}
        <button type="button" className="kn-focus" onClick={() => insert('ans')}>Ans</button>
        <button type="button" className="kn-focus" title="Divide preceding value by 100" onClick={() => insert('/100', true)}>%</button>
        <button
          type="button"
          className="kn-focus calculator-sign"
          onClick={() => {
            setExpression(expression ? `-(${expression})` : '-');
            setComplete(false);
            setError('');
            input.current?.focus();
          }}
        >
          ±
        </button>
      </div>

      <button
        type="button"
        className="classwiz-stamp-btn kn-focus"
        onClick={() => {
          const text = complete ? `${history[0]?.expression ?? expression} = ${expression}` : `Result: ${formatMathNumber(answer)}`;
          stampTextToBoard(text, onStamp);
        }}
      >
        <Icon name="board" className="h-4 w-4" />
        <span>1-Tap Stamp to Board</span>
      </button>

      {history.length > 0 && (
        <details className="calculator-history">
          <summary>History</summary>
          <ol>
            {history.map((entry, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="kn-focus"
                  onClick={() => {
                    setExpression(entry.expression);
                    setAngleMode(entry.angleMode);
                    setComplete(false);
                    setError('');
                    input.current?.focus();
                  }}
                >
                  <span>{entry.expression} = <strong>{entry.result}</strong></span>
                  <small>{entry.angleMode}</small>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="kn-focus" onClick={() => setHistory([])}>Clear history</button>
        </details>
      )}
    </section>
  );
}

// ---------------------------- Equation Solver Tab --------------------------

export function EquationSolver({ onStamp }: { onStamp?: (text: string) => void }) {
  const [type, setType] = useState<'quadratic' | 'cubic' | 'linear2' | 'linear3'>('quadratic');

  // Quadratic coefficients: ax² + bx + c = 0
  const [qa, setQa] = useState(1);
  const [qb, setQb] = useState(-5);
  const [qc, setQc] = useState(6);

  // Cubic coefficients: ax³ + bx² + cx + d = 0
  const [ca, setCa] = useState(1);
  const [cb, setCb] = useState(-6);
  const [cc, setCc] = useState(11);
  const [cd, setCd] = useState(-6);

  // 2x2 Linear: a1*x + b1*y = c1, a2*x + b2*y = c2
  const [l2, setL2] = useState({ a1: 2, b1: 1, c1: 7, a2: 1, b2: -1, c2: 2 });

  // 3x3 Linear
  const [l3, setL3] = useState<[[number, number, number, number], [number, number, number, number], [number, number, number, number]]>([
    [1, 1, 1, 6],
    [0, 2, 5, -4],
    [2, 5, -1, 27],
  ]);

  const quadSol = useMemo(() => {
    try {
      return solveQuadratic(qa, qb, qc);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid quadratic input' };
    }
  }, [qa, qb, qc]);

  const cubicSol = useMemo(() => {
    try {
      return solveCubic(ca, cb, cc, cd);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid cubic input' };
    }
  }, [ca, cb, cc, cd]);

  const l2Sol = useMemo(() => {
    try {
      return solveLinear2x2(l2.a1, l2.b1, l2.c1, l2.a2, l2.b2, l2.c2);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid linear input' };
    }
  }, [l2]);

  const l3Sol = useMemo(() => {
    try {
      return solveLinear3x3(l3);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid 3x3 input' };
    }
  }, [l3]);

  function stamp() {
    let text = '';
    if (type === 'quadratic' && !('error' in quadSol)) {
      text = quadSol.formattedSteps.join('\n');
    } else if (type === 'cubic' && !('error' in cubicSol)) {
      text = cubicSol.formattedSteps.join('\n');
    } else if (type === 'linear2' && !('error' in l2Sol)) {
      text = l2Sol.formattedSteps.join('\n');
    } else if (type === 'linear3' && !('error' in l3Sol)) {
      text = l3Sol.formattedSteps.join('\n');
    }
    if (text) stampTextToBoard(text, onStamp);
  }

  return (
    <div className="classwiz-solver-panel">
      <div className="classwiz-tabs">
        <button type="button" aria-pressed={type === 'quadratic'} onClick={() => setType('quadratic')}>ax²+bx+c=0</button>
        <button type="button" aria-pressed={type === 'cubic'} onClick={() => setType('cubic')}>ax³+...+d=0</button>
        <button type="button" aria-pressed={type === 'linear2'} onClick={() => setType('linear2')}>2x2 Linear</button>
        <button type="button" aria-pressed={type === 'linear3'} onClick={() => setType('linear3')}>3x3 Linear</button>
      </div>

      {type === 'quadratic' && (
        <>
          <div className="classwiz-grid-inputs">
            <label className="classwiz-input-field">a<input type="number" value={qa} onChange={e => setQa(Number(e.target.value))} /></label>
            <label className="classwiz-input-field">b<input type="number" value={qb} onChange={e => setQb(Number(e.target.value))} /></label>
            <label className="classwiz-input-field">c<input type="number" value={qc} onChange={e => setQc(Number(e.target.value))} /></label>
          </div>
          <div className="classwiz-solution-box">
            {'error' in quadSol ? (
              <span className="text-red-400">{quadSol.error}</span>
            ) : (
              quadSol.formattedSteps.map((st, i) => <div key={i}>{st}</div>)
            )}
          </div>
        </>
      )}

      {type === 'cubic' && (
        <>
          <div className="classwiz-grid-inputs">
            <label className="classwiz-input-field">a<input type="number" value={ca} onChange={e => setCa(Number(e.target.value))} /></label>
            <label className="classwiz-input-field">b<input type="number" value={cb} onChange={e => setCb(Number(e.target.value))} /></label>
            <label className="classwiz-input-field">c<input type="number" value={cc} onChange={e => setCc(Number(e.target.value))} /></label>
            <label className="classwiz-input-field">d<input type="number" value={cd} onChange={e => setCd(Number(e.target.value))} /></label>
          </div>
          <div className="classwiz-solution-box">
            {'error' in cubicSol ? (
              <span className="text-red-400">{cubicSol.error}</span>
            ) : (
              cubicSol.formattedSteps.map((st, i) => <div key={i}>{st}</div>)
            )}
          </div>
        </>
      )}

      {type === 'linear2' && (
        <>
          <div className="classwiz-grid-inputs">
            <label className="classwiz-input-field">a₁<input type="number" value={l2.a1} onChange={e => setL2({ ...l2, a1: Number(e.target.value) })} /></label>
            <label className="classwiz-input-field">b₁<input type="number" value={l2.b1} onChange={e => setL2({ ...l2, b1: Number(e.target.value) })} /></label>
            <label className="classwiz-input-field">= c₁<input type="number" value={l2.c1} onChange={e => setL2({ ...l2, c1: Number(e.target.value) })} /></label>
            <label className="classwiz-input-field">a₂<input type="number" value={l2.a2} onChange={e => setL2({ ...l2, a2: Number(e.target.value) })} /></label>
            <label className="classwiz-input-field">b₂<input type="number" value={l2.b2} onChange={e => setL2({ ...l2, b2: Number(e.target.value) })} /></label>
            <label className="classwiz-input-field">= c₂<input type="number" value={l2.c2} onChange={e => setL2({ ...l2, c2: Number(e.target.value) })} /></label>
          </div>
          <div className="classwiz-solution-box">
            {'error' in l2Sol ? (
              <span className="text-red-400">{l2Sol.error}</span>
            ) : (
              l2Sol.formattedSteps.map((st, i) => <div key={i}>{st}</div>)
            )}
          </div>
        </>
      )}

      {type === 'linear3' && (
        <>
          <div className="classwiz-solution-box">
            {'error' in l3Sol ? (
              <span className="text-red-400">{l3Sol.error}</span>
            ) : (
              l3Sol.formattedSteps.map((st, i) => <div key={i}>{st}</div>)
            )}
          </div>
        </>
      )}

      <button type="button" className="classwiz-stamp-btn kn-focus" onClick={stamp}>
        <Icon name="board" className="h-4 w-4" />
        <span>Stamp Equation Steps to Board</span>
      </button>
    </div>
  );
}

// ----------------------------- Matrix Solver Tab ----------------------------

export function MatrixSolver({ onStamp }: { onStamp?: (text: string) => void }) {
  const [dim, setDim] = useState<2 | 3>(2);
  const [m2, setM2] = useState<number[][]>([
    [4, 7],
    [2, 6],
  ]);
  const [m3, setM3] = useState<number[][]>([
    [1, 0, 2],
    [2, -1, 3],
    [4, 1, 8],
  ]);

  const matResult = useMemo(() => {
    try {
      return analyzeMatrix(dim === 2 ? m2 : m3);
    } catch (e) {
      return null;
    }
  }, [dim, m2, m3]);

  function updateM2(r: number, c: number, v: number) {
    const next = m2.map(row => [...row]);
    next[r][c] = v;
    setM2(next);
  }

  function updateM3(r: number, c: number, v: number) {
    const next = m3.map(row => [...row]);
    next[r][c] = v;
    setM3(next);
  }

  function stamp() {
    if (!matResult) return;
    const lines = [
      `Matrix ${dim}x${dim}:`,
      (dim === 2 ? m2 : m3).map(r => `[ ${r.join(', ')} ]`).join('\n'),
      `Determinant: det(A) = ${matResult.determinant}`,
      `Transpose Aᵀ:`,
      matResult.transpose.map(r => `[ ${r.join(', ')} ]`).join('\n'),
    ];
    if (matResult.inverse) {
      lines.push('Inverse A⁻¹:');
      lines.push(matResult.inverse.map(r => `[ ${r.join(', ')} ]`).join('\n'));
    } else {
      lines.push('Matrix is singular (no inverse exists).');
    }
    stampTextToBoard(lines.join('\n'), onStamp);
  }

  return (
    <div className="classwiz-solver-panel">
      <div className="classwiz-tabs">
        <button type="button" aria-pressed={dim === 2} onClick={() => setDim(2)}>2x2 Matrix</button>
        <button type="button" aria-pressed={dim === 3} onClick={() => setDim(3)}>3x3 Matrix</button>
      </div>

      <div className="flex justify-center p-2">
        <div className={`grid gap-1.5 ${dim === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {dim === 2
            ? m2.flatMap((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`${r}-${c}`}
                    type="number"
                    className="w-16 rounded border border-line bg-base p-2 text-center text-sm font-bold text-ink"
                    value={val}
                    onChange={e => updateM2(r, c, Number(e.target.value))}
                  />
                )),
              )
            : m3.flatMap((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`${r}-${c}`}
                    type="number"
                    className="w-14 rounded border border-line bg-base p-2 text-center text-xs font-bold text-ink"
                    value={val}
                    onChange={e => updateM3(r, c, Number(e.target.value))}
                  />
                )),
              )}
        </div>
      </div>

      {matResult && (
        <div className="classwiz-solution-box">
          <div>Determinant det(A) = <strong>{matResult.determinant}</strong></div>
          <div className="mt-1 text-muted">Transpose Aᵀ:</div>
          <div>{matResult.transpose.map(r => `[ ${r.join(', ')} ]`).join(' ')}</div>
          <div className="mt-1 text-muted">Inverse A⁻¹:</div>
          <div>
            {matResult.inverse
              ? matResult.inverse.map(r => `[ ${r.join(', ')} ]`).join(' ')
              : 'Singular (det = 0, no inverse)'}
          </div>
        </div>
      )}

      <button type="button" className="classwiz-stamp-btn kn-focus" onClick={stamp}>
        <Icon name="board" className="h-4 w-4" />
        <span>Stamp Matrix to Board</span>
      </button>
    </div>
  );
}

// ------------------------- Science & Base Converter -------------------------

export function ConverterPanel({ onStamp }: { onStamp?: (text: string) => void }) {
  const [tab, setTab] = useState<'units' | 'base'>('units');

  // Units state
  const [category, setCategory] = useState<'speed' | 'temp' | 'pressure' | 'energy'>('speed');
  const [val, setVal] = useState(100);
  const [speedFrom, setSpeedFrom] = useState<SpeedUnit>('km/h');
  const [speedTo, setSpeedTo] = useState<SpeedUnit>('m/s');
  const [tempFrom, setTempFrom] = useState<TempUnit>('C');
  const [tempTo, setTempTo] = useState<TempUnit>('F');
  const [pressFrom, setPressFrom] = useState<PressureUnit>('atm');
  const [pressTo, setPressTo] = useState<PressureUnit>('Pa');
  const [nrgFrom, setNrgFrom] = useState<EnergyUnit>('cal');
  const [nrgTo, setNrgTo] = useState<EnergyUnit>('J');

  // Base state
  const [baseInput, setBaseInput] = useState('255');
  const [baseMode, setBaseMode] = useState<10 | 16 | 2 | 8>(10);

  const convertedUnit = useMemo(() => {
    if (category === 'speed') return `${convertSpeed(val, speedFrom, speedTo)} ${speedTo}`;
    if (category === 'temp') return `${convertTemperature(val, tempFrom, tempTo)} °${tempTo}`;
    if (category === 'pressure') return `${convertPressure(val, pressFrom, pressTo)} ${pressTo}`;
    return `${convertEnergy(val, nrgFrom, nrgTo)} ${nrgTo}`;
  }, [category, val, speedFrom, speedTo, tempFrom, tempTo, pressFrom, pressTo, nrgFrom, nrgTo]);

  const convertedBase = useMemo(() => {
    try {
      return convertBase(baseInput, baseMode);
    } catch {
      return null;
    }
  }, [baseInput, baseMode]);

  function stamp() {
    if (tab === 'units') {
      const fromStr =
        category === 'speed' ? `${val} ${speedFrom}` :
        category === 'temp' ? `${val} °${tempFrom}` :
        category === 'pressure' ? `${val} ${pressFrom}` : `${val} ${nrgFrom}`;
      stampTextToBoard(`Unit Conversion:\n${fromStr} = ${convertedUnit}`, onStamp);
    } else if (convertedBase) {
      stampTextToBoard(
        `Programmer Base Conversion:\nDEC: ${convertedBase.dec}\nHEX: 0x${convertedBase.hex}\nBIN: 0b${convertedBase.formattedBin}\nOCT: 0o${convertedBase.oct}`,
        onStamp,
      );
    }
  }

  return (
    <div className="classwiz-solver-panel">
      <div className="classwiz-tabs">
        <button type="button" aria-pressed={tab === 'units'} onClick={() => setTab('units')}>Physics / Chem Units</button>
        <button type="button" aria-pressed={tab === 'base'} onClick={() => setTab('base')}>Programmer Base</button>
      </div>

      {tab === 'units' ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 text-xs">
            {(['speed', 'temp', 'pressure', 'energy'] as const).map(c => (
              <button
                key={c}
                type="button"
                className={`flex-1 rounded p-1 font-semibold ${category === c ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}
                onClick={() => setCategory(c)}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <label className="classwiz-input-field">
              Value
              <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} />
            </label>
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-muted">From / To</span>
              {category === 'speed' && (
                <div className="flex gap-1">
                  <select value={speedFrom} onChange={e => setSpeedFrom(e.target.value as SpeedUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['km/h', 'm/s', 'mph', 'knot'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select value={speedTo} onChange={e => setSpeedTo(e.target.value as SpeedUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['km/h', 'm/s', 'mph', 'knot'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
              {category === 'temp' && (
                <div className="flex gap-1">
                  <select value={tempFrom} onChange={e => setTempFrom(e.target.value as TempUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['C', 'K', 'F'] as const).map(u => <option key={u} value={u}>°{u}</option>)}
                  </select>
                  <select value={tempTo} onChange={e => setTempTo(e.target.value as TempUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['C', 'K', 'F'] as const).map(u => <option key={u} value={u}>°{u}</option>)}
                  </select>
                </div>
              )}
              {category === 'pressure' && (
                <div className="flex gap-1">
                  <select value={pressFrom} onChange={e => setPressFrom(e.target.value as PressureUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['atm', 'Pa', 'kPa', 'bar', 'mmHg', 'psi'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select value={pressTo} onChange={e => setPressTo(e.target.value as PressureUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['atm', 'Pa', 'kPa', 'bar', 'mmHg', 'psi'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
              {category === 'energy' && (
                <div className="flex gap-1">
                  <select value={nrgFrom} onChange={e => setNrgFrom(e.target.value as EnergyUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['J', 'kJ', 'eV', 'cal', 'kcal', 'kWh'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select value={nrgTo} onChange={e => setNrgTo(e.target.value as EnergyUnit)} className="w-1/2 rounded bg-base border border-line p-1 text-xs">
                    {(['J', 'kJ', 'eV', 'cal', 'kcal', 'kWh'] as const).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="classwiz-solution-box text-center font-bold text-base text-brand-light">
            {convertedUnit}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={baseInput}
              onChange={e => setBaseInput(e.target.value)}
              placeholder="Enter number..."
              className="flex-1 rounded border border-line bg-base p-2 text-sm font-mono text-ink"
            />
            <select
              value={baseMode}
              onChange={e => setBaseMode(Number(e.target.value) as 10 | 16 | 2 | 8)}
              className="rounded bg-base border border-line p-2 text-xs font-semibold"
            >
              <option value={10}>DEC</option>
              <option value={16}>HEX</option>
              <option value={2}>BIN</option>
              <option value={8}>OCT</option>
            </select>
          </div>

          {convertedBase ? (
            <div className="classwiz-solution-box grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted">DEC:</span> <strong>{convertedBase.dec}</strong></div>
              <div><span className="text-muted">HEX:</span> <strong>0x{convertedBase.hex}</strong></div>
              <div><span className="text-muted">OCT:</span> <strong>0o{convertedBase.oct}</strong></div>
              <div className="col-span-2"><span className="text-muted">BIN:</span> <strong>{convertedBase.formattedBin}</strong></div>
            </div>
          ) : (
            <div className="classwiz-solution-box text-red-400">Invalid number for base {baseMode}</div>
          )}
        </div>
      )}

      <button type="button" className="classwiz-stamp-btn kn-focus" onClick={stamp}>
        <Icon name="board" className="h-4 w-4" />
        <span>Stamp Conversion to Board</span>
      </button>
    </div>
  );
}

// ------------------------------ Main Calculator ------------------------------

export function Calculator({ onStamp }: { onStamp?: (text: string) => void }) {
  const [activeTab, setActiveTab] = useState<'calc' | 'eq' | 'matrix' | 'conv'>('calc');
  const [dualMode, setDualMode] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1 pb-1 border-b border-line">
        <div className="classwiz-tabs flex-1">
          <button type="button" aria-pressed={activeTab === 'calc'} onClick={() => setActiveTab('calc')}>🧮 Calc</button>
          <button type="button" aria-pressed={activeTab === 'eq'} onClick={() => setActiveTab('eq')}>📐 Equation</button>
          <button type="button" aria-pressed={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')}>📊 Matrix</button>
          <button type="button" aria-pressed={activeTab === 'conv'} onClick={() => setActiveTab('conv')}>⚡ Convert</button>
        </div>
        <button
          type="button"
          onClick={() => setDualMode(v => !v)}
          className={`h-8 px-2 rounded-lg text-xs font-semibold border ${
            dualMode ? 'border-brand bg-brand text-white shadow' : 'border-line text-muted hover:text-ink'
          }`}
          title="Duplicate / Split Calculator side-by-side"
        >
          {dualMode ? 'Single' : 'Dual ⧉'}
        </button>
      </div>

      {activeTab === 'calc' && (
        dualMode ? (
          <div className="grid grid-cols-2 gap-4">
            <SingleCalculator id="calc-left" onStamp={onStamp} />
            <SingleCalculator id="calc-right" onStamp={onStamp} />
          </div>
        ) : (
          <SingleCalculator id="calc-main" onStamp={onStamp} />
        )
      )}

      {activeTab === 'eq' && <EquationSolver onStamp={onStamp} />}
      {activeTab === 'matrix' && <MatrixSolver onStamp={onStamp} />}
      {activeTab === 'conv' && <ConverterPanel onStamp={onStamp} />}
    </div>
  );
}

// -------------------------------- Timer ------------------------------------

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

export function CountdownTimer() {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [initialDuration, setInitialDuration] = useState(300);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining == null) return;
    const deadline = Date.now() + remaining * 1000;
    const id = window.setInterval(() => {
      const value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(value);
      if (value === 0) setRunning(false);
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const total = remaining ?? minutes * 60 + seconds;
  const mm = pad(total / 60);
  const ss = pad(total % 60);
  const maxSec = Math.max(1, remaining == null ? minutes * 60 + seconds : initialDuration);
  const fraction = Math.min(1, Math.max(0, total / maxSec));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fraction);
  const isUrgent = total <= 10 && total > 0 && running;
  const ringColor = total === 0 ? '#ef4444' : isUrgent ? '#ef4444' : fraction < 0.25 ? '#f59e0b' : '#38bdf8';

  return (
    <div className="w-[236px] text-center">
      <div className="relative mb-3 flex items-center justify-center">
        <svg width="150" height="150" viewBox="0 0 150 150" className="rotate-[-90deg]">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
            style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
          />
        </svg>
        <div className={`absolute inset-0 flex flex-col items-center justify-center font-mono text-3xl font-bold tabular-nums ${isUrgent ? 'animate-pulse text-red-400' : 'text-brand-light'}`}>
          <span>{mm}:{ss}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">{running ? 'Timer' : total === 0 ? 'Done' : 'Set'}</span>
        </div>
      </div>
      {remaining == null && (
        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted">
          <input
            type="number"
            min={0}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(180, +e.target.value || 0)))}
            className="kn-focus w-14 rounded-lg border border-line bg-base px-2 py-1 text-center font-mono text-sm text-ink"
          />
          <span>min</span>
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(e) => setSeconds(Math.max(0, Math.min(59, +e.target.value || 0)))}
            className="kn-focus w-14 rounded-lg border border-line bg-base px-2 py-1 text-center font-mono text-sm text-ink"
          />
          <span>sec</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => {
            if (remaining == null) {
              const dur = minutes * 60 + seconds;
              setInitialDuration(dur);
              setRemaining(dur);
            }
            setRunning((r) => !r);
          }}
          className="kn-focus flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <Icon name={running ? "pause" : "play"} className="h-4 w-4" filled />
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setRemaining(null);
          }}
          className="kn-focus flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-2 text-sm hover:bg-line"
        >
          <Icon name="reset" className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>
  );
}

// ------------------------------ Stopwatch ----------------------------------

export function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setMs((v) => v + 100), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const cs = Math.floor((ms % 1000) / 100);
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000);

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const fraction = ((ms % 60000) / 60000);
  const strokeDashoffset = circumference * (1 - fraction);

  return (
    <div className="w-[236px] text-center">
      <div className="relative mb-3 flex items-center justify-center">
        <svg width="150" height="150" viewBox="0 0 150 150" className="rotate-[-90deg]">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-2xl font-bold tabular-nums text-brand-light">
          <span>{pad(m)}:{pad(s)}</span>
          <span className="text-xs font-semibold text-muted">.{cs}0s</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          className="kn-focus flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <Icon name={running ? "pause" : "play"} className="h-4 w-4" filled />
          {running ? "Stop" : "Start"}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setMs(0);
          }}
          className="kn-focus flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-2 text-sm hover:bg-line"
        >
          <Icon name="reset" className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>
  );
}

// --------------------------------- Clock -----------------------------------

export function AnalogClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourAngle = (h + m / 60) * 30;
  const minAngle = (m + s / 60) * 6;
  const secAngle = s * 6;

  return (
    <div className="grid place-items-center">
      <svg width="180" height="180" viewBox="0 0 200 200" className="drop-shadow-lg">
        <defs>
          <radialGradient id="clock-dial" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#22252e" />
            <stop offset="100%" stopColor="#14161b" />
          </radialGradient>
          <linearGradient id="clock-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f5666" />
            <stop offset="50%" stopColor="#2d313b" />
            <stop offset="100%" stopColor="#636b7d" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="none" stroke="url(#clock-bezel)" strokeWidth="4.5" />
        <circle cx="100" cy="100" r="92" fill="url(#clock-dial)" />
        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const a = (i * 6 * Math.PI) / 180;
          return (
            <line
              key={`min-${i}`}
              x1={100 + Math.sin(a) * 82}
              y1={100 - Math.cos(a) * 82}
              x2={100 + Math.sin(a) * 78}
              y2={100 - Math.cos(a) * 78}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
            />
          );
        })}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const isMajor = i % 3 === 0;
          return (
            <line
              key={`hr-${i}`}
              x1={100 + Math.sin(a) * 82}
              y1={100 - Math.cos(a) * 82}
              x2={100 + Math.sin(a) * (isMajor ? 66 : 72)}
              y2={100 - Math.cos(a) * (isMajor ? 66 : 72)}
              stroke={isMajor ? "#ffffff" : "rgba(255,255,255,0.55)"}
              strokeWidth={isMajor ? "4.5" : "3"}
              strokeLinecap="round"
            />
          );
        })}
        <line
          x1={100 - Math.sin((hourAngle * Math.PI) / 180) * 10}
          y1={100 + Math.cos((hourAngle * Math.PI) / 180) * 10}
          x2={100 + Math.sin((hourAngle * Math.PI) / 180) * 48}
          y2={100 - Math.cos((hourAngle * Math.PI) / 180) * 48}
          stroke="#f4f4f5"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1={100 - Math.sin((minAngle * Math.PI) / 180) * 12}
          y1={100 + Math.cos((minAngle * Math.PI) / 180) * 12}
          x2={100 + Math.sin((minAngle * Math.PI) / 180) * 70}
          y2={100 - Math.cos((minAngle * Math.PI) / 180) * 70}
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1={100 - Math.sin((secAngle * Math.PI) / 180) * 18}
          y1={100 + Math.cos((secAngle * Math.PI) / 180) * 18}
          x2={100 + Math.sin((secAngle * Math.PI) / 180) * 75}
          y2={100 - Math.cos((secAngle * Math.PI) / 180) * 75}
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx={100 + Math.sin((secAngle * Math.PI) / 180) * 56}
          cy={100 - Math.cos((secAngle * Math.PI) / 180) * 56}
          r="5.5"
          fill="#ef4444"
        />
        <circle cx="100" cy="100" r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      <div className="mt-2 text-sm font-semibold tracking-wider tabular-nums text-muted">
        {formatTime12(now)}
      </div>
    </div>
  );
}

// ------------------------- Rotatable guides (ruler etc.) -------------------

export function RotatableGuide({
  kind,
  rotation,
  setRotation,
}: {
  kind: "ruler" | "protractor" | "setsquare" | "compass";
  rotation: number;
  setRotation: (r: number) => void;
}) {
  if (kind === "ruler") {
    const ticks = [];
    for (let i = 0; i <= 40; i++) {
      const x = 20 + i * 11.5;
      const major = i % 5 === 0;
      const yTop = major ? 8 : 18;
      ticks.push(
        <g key={i}>
          {/* Dark high-contrast backing */}
          <line
            x1={x}
            y1={yTop}
            x2={x}
            y2={54}
            stroke="rgba(10, 15, 25, 0.95)"
            strokeWidth={major ? 3.2 : 2.2}
            strokeLinecap="round"
          />
          {/* Vibrant neon cyan graduation */}
          <line
            x1={x}
            y1={yTop}
            x2={x}
            y2={54}
            stroke="#00f0ff"
            strokeWidth={major ? 1.6 : 1.0}
            strokeLinecap="round"
          />
          {major && (
            <text
              x={x}
              y={66}
              fill="#00f0ff"
              stroke="rgba(10, 15, 25, 0.95)"
              strokeWidth="2.8px"
              paintOrder="stroke fill"
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
            >
              {i}
            </text>
          )}
        </g>,
      );
    }
    return (
      <div className="w-[520px]">
        <svg width="500" height="76" viewBox="0 0 500 76">
          <defs>
            <linearGradient id="tool-ruler-acrylic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
              <stop offset="14%" stopColor="rgba(215, 235, 255, 0.22)" />
              <stop offset="85%" stopColor="rgba(190, 220, 255, 0.15)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.38)" />
            </linearGradient>
          </defs>
          {/* Frosted translucent acrylic ruler body */}
          <rect x="6" y="6" width="488" height="60" rx="8" fill="url(#tool-ruler-acrylic)" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1.5" />
          <rect x="7" y="7" width="486" height="58" rx="7" fill="none" stroke="rgba(0, 0, 0, 0.22)" strokeWidth="0.8" />
          <line x1="20" y1="36" x2="480" y2="36" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" strokeDasharray="4 6" />
          {ticks}
        </svg>
        <RotationControls rotation={rotation} setRotation={setRotation} />
      </div>
    );
  }
  if (kind === "protractor") {
    const lines = [];
    for (let deg = 0; deg <= 180; deg += 10) {
      const a = (deg * Math.PI) / 180;
      const major = deg % 30 === 0;
      const r1 = 114;
      const r2 = major ? 92 : 102;
      const x1 = 130 + Math.cos(a) * r1;
      const y1 = 130 - Math.sin(a) * r1;
      const x2 = 130 + Math.cos(a) * r2;
      const y2 = 130 - Math.sin(a) * r2;
      lines.push(
        <g key={deg}>
          {/* Dark high-contrast backing */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(10, 15, 25, 0.95)"
            strokeWidth={major ? 3.4 : 2.2}
            strokeLinecap="round"
          />
          {/* Vibrant neon cyan degree graduation */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#00f0ff"
            strokeWidth={major ? 1.6 : 1.0}
            strokeLinecap="round"
          />
          {major && (
            <text
              x={130 + Math.cos(a) * 78}
              y={134 - Math.sin(a) * 78}
              fill="#00f0ff"
              stroke="rgba(10, 15, 25, 0.95)"
              strokeWidth="2.8px"
              paintOrder="stroke fill"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
            >
              {deg}°
            </text>
          )}
        </g>,
      );
    }
    return (
      <div className="w-[300px]">
        <svg width="280" height="150" viewBox="0 0 260 150">
          <defs>
            <radialGradient id="tool-protractor-acrylic" cx="50%" cy="100%" r="90%">
              <stop offset="0%" stopColor="rgba(190, 220, 255, 0.14)" />
              <stop offset="70%" stopColor="rgba(215, 235, 255, 0.25)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.50)" />
            </radialGradient>
          </defs>
          {/* Frosted translucent acrylic protractor body */}
          <path d="M10 130 A120 120 0 0 1 250 130 Z" fill="url(#tool-protractor-acrylic)" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1.5" />
          <path d="M11 130 A119 119 0 0 1 249 130 Z" fill="none" stroke="rgba(0, 0, 0, 0.22)" strokeWidth="0.8" />
          {/* Frosted inner viewing window */}
          <path d="M70 130 A60 60 0 0 1 190 130 Z" fill="rgba(18, 20, 26, 0.18)" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.2" />
          {lines}
          {/* High-contrast neon baseline */}
          <line x1="10" y1="130" x2="250" y2="130" stroke="rgba(10, 15, 25, 0.95)" strokeWidth="3.6" />
          <line x1="10" y1="130" x2="250" y2="130" stroke="#00f0ff" strokeWidth="2" />
        </svg>
        <RotationControls rotation={rotation} setRotation={setRotation} />
      </div>
    );
  }
  if (kind === "setsquare") {
    return (
      <div className="w-[300px]">
        <svg width="260" height="180" viewBox="0 0 260 180">
          <polygon points="10,170 250,170 10,10" fill="rgba(30,41,59,0.5)" stroke="#94a3b8" strokeWidth="2" />
          <rect x="40" y="120" width="30" height="30" fill="none" stroke="#e5e7eb" strokeWidth="1" />
        </svg>
        <RotationControls rotation={rotation} setRotation={setRotation} />
      </div>
    );
  }
  // compass
  return (
    <div className="w-[300px]">
      <svg width="280" height="200" viewBox="0 0 280 200">
        <circle cx="140" cy="100" r="88" fill="none" stroke="#e11d48" strokeWidth="2" strokeDasharray="6 5" />
        <circle cx="140" cy="100" r="44" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="140" y1="12" x2="140" y2="188" stroke="#e11d48" strokeWidth="2" />
        <circle cx="140" cy="12" r="4" fill="#f4f4f5" />
        <circle cx="140" cy="100" r="3" fill="#f4f4f5" />
      </svg>
      <RotationControls rotation={rotation} setRotation={setRotation} />
    </div>
  );
}

function RotationControls({
  rotation,
  setRotation,
}: {
  rotation: number;
  setRotation: (r: number) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={() => setRotation(rotation - 15)}
        className="kn-focus grid h-7 w-7 place-items-center rounded-md bg-elevated hover:bg-line"
        aria-label="Rotate left"
      >
        <Icon name="redo" className="h-4 w-4" />
      </button>
      <span className="text-xs tabular-nums text-muted">{rotation}°</span>
      <button
        onClick={() => setRotation(rotation + 15)}
        className="kn-focus grid h-7 w-7 place-items-center rounded-md bg-elevated hover:bg-line"
        aria-label="Rotate right"
      >
        <Icon name="undo" className="h-4 w-4" />
      </button>
    </div>
  );
}

// ------------------------------ Spotlight ----------------------------------

export function SpotlightOverlay({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [radius, setRadius] = useState(140);
  useEffect(() => {
    const move = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div className="fixed inset-0 z-40" style={{ cursor: "none" }} onPointerDown={onClose}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, transparent 0%, rgba(0,0,0,0.92) 100%)`,
        }}
      />
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-panel px-4 py-2">
        <span className="text-xs text-muted">Spotlight — move to focus, click to exit</span>
        <input
          type="range"
          min={60}
          max={360}
          value={radius}
          onChange={(e) => setRadius(+e.target.value)}
          className="kn-range w-28"
        />
      </div>
    </div>
  );
}

// ------------------------------ Magnifier ----------------------------------

export function MagnifierOverlay({
  getCanvas,
  onClose,
}: {
  getCanvas: () => HTMLCanvasElement | null;
  onClose: () => void;
}) {
  const lens = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [zoom, setZoom] = useState<number>(2);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    const source = getCanvas();
    const c = lens.current;
    if (!source || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = source.width / source.clientWidth;
    const size = c.width;
    const sx = (pos.x - source.getBoundingClientRect().left) * dpr - size / (2 * zoom);
    const sy = (pos.y - source.getBoundingClientRect().top) * dpr - size / (2 * zoom);
    ctx.clearRect(0, 0, size, size);
    try {
      ctx.drawImage(source, sx, sy, size / zoom, size / zoom, 0, 0, size, size);
      // Reticle center crosshair
      ctx.strokeStyle = "rgba(0, 98, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size / 2 - 12, size / 2);
      ctx.lineTo(size / 2 + 12, size / 2);
      ctx.moveTo(size / 2, size / 2 - 12);
      ctx.lineTo(size / 2, size / 2 + 12);
      ctx.stroke();
    } catch {
      /* ignore */
    }
  }, [getCanvas, pos, zoom]);

  return (
    <div className="fixed inset-0 z-40" onPointerDown={onClose}>
      <canvas
        ref={lens}
        width={240}
        height={240}
        className="pointer-events-none fixed rounded-full border-4 border-brand shadow-2xl backdrop-blur-sm"
        style={{ left: pos.x + 24, top: pos.y + 24 }}
      />
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 text-xs text-muted shadow-2xl pointer-events-auto select-none"
        onPointerDown={e => e.stopPropagation()}
      >
        <span className="font-semibold text-ink">Magnifier Loupe:</span>
        <div className="flex gap-1">
          {([2, 3, 4] as const).map(z => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                zoom === z ? 'bg-brand text-white shadow-md' : 'bg-elevated text-muted hover:text-ink'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-line mx-1" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-400 hover:bg-red-500/30 transition-all"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(
    () => ({
      time: formatTime12(now),
      date: now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
    }),
    [now],
  );
}

export { formatTime12 };
