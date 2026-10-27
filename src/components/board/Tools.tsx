"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { compileTeachingExpression, formatMathNumber, type AngleMode } from '@/lib/teaching-math';
import { formatTime12 } from '@/lib/format-time';
import './TeachingMath.css';

// ------------------------------- Calculator --------------------------------

export function Calculator() {
  const [expression,setExpression]=useState('');
  const [scientific,setScientific]=useState(false),[angleMode,setAngleMode]=useState<AngleMode>('DEG');
  const [answer,setAnswer]=useState(0),[complete,setComplete]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [history,setHistory]=useState<{expression:string;result:string;angleMode:AngleMode}[]>([]);
  const input=useRef<HTMLInputElement>(null);
  function insert(value:string,operator=false) {
    const field=input.current;
    const base=complete&&!operator?'':expression;
    const start=complete?base.length:(field?.selectionStart??base.length),end=complete?base.length:(field?.selectionEnd??base.length);
    const next=base.slice(0,start)+value+base.slice(end);
    if(next.length>240)return;
    setExpression(next);setComplete(false);setError('');
    requestAnimationFrame(()=>{field?.focus();field?.setSelectionRange(start+value.length,start+value.length);});
  }
  function functionKey(name:string) {
    if(complete){setExpression(`${name}(${expression})`);setComplete(false);setError('');input.current?.focus();}
    else insert(`${name}(`);
  }
  async function equals() {
    if(busy)return;setBusy(true);setError('');
    const submitted=expression;
    try {
      const evaluate=await compileTeachingExpression(submitted,{angleMode,answer});
      const result=evaluate(),formatted=formatMathNumber(result);
      setAnswer(result);setExpression(formatted);setComplete(true);
      setHistory(previous=>[{expression:submitted,result:formatted,angleMode},...previous].slice(0,6));
      requestAnimationFrame(()=>{input.current?.focus();input.current?.select();});
    }catch(failure){setError(failure instanceof Error?failure.message:'Could not calculate this expression.');}
    finally{setBusy(false);}
  }
  function clear(){setExpression('');setComplete(false);setError('');input.current?.focus();}
  function backspace(){const field=input.current;const start=field?.selectionStart??expression.length,end=field?.selectionEnd??expression.length;setExpression(expression.slice(0,start===end?Math.max(0,start-1):start)+expression.slice(end));setComplete(false);setError('');requestAnimationFrame(()=>{field?.focus();const caret=start===end?Math.max(0,start-1):start;field?.setSelectionRange(caret,caret);});}
  return <section className="teaching-calculator" aria-label="Teaching calculator" onKeyDown={event=>{
    event.stopPropagation();
    if(event.target!==input.current)return;
    if(event.key==='Enter'||event.key==='='){event.preventDefault();void equals();}
    else if(event.key==='Escape'){event.preventDefault();clear();}
    else if(complete&&['+','-','*','/','^'].includes(event.key)){event.preventDefault();insert(event.key,true);}
  }}>
    <div className="math-mode-switch" aria-label="Calculator mode"><button className="kn-focus" aria-pressed={!scientific} onClick={()=>setScientific(false)}>Basic</button><button className="kn-focus" aria-pressed={scientific} onClick={()=>setScientific(true)}>Scientific</button></div>
    {scientific&&<div className="math-mode-switch" aria-label="Angle unit"><button className="kn-focus" aria-pressed={angleMode==='DEG'} onClick={()=>setAngleMode('DEG')}>DEG</button><button className="kn-focus" aria-pressed={angleMode==='RAD'} onClick={()=>setAngleMode('RAD')}>RAD</button></div>}
    <label className="calculator-expression">Expression<input ref={input} aria-label="Calculator expression" className="kn-focus" autoComplete="off" spellCheck={false} maxLength={240} value={expression} placeholder="0" onChange={event=>{setExpression(event.target.value);setComplete(false);setError('');}}/></label>
    <output className="calculator-answer" aria-live="polite">{complete?`Result: ${expression}`:`Ans: ${formatMathNumber(answer)}`}</output>
    {error&&<p role="alert" className="teaching-math-error">{error}</p>}
    {scientific&&<div className="calculator-scientific-keys">{['sin','cos','tan','sqrt','asin','acos','atan','abs','log','ln','exp','factorial'].map(name=><button key={name} className="kn-focus" onClick={()=>functionKey(name)}>{name==='factorial'?'n!':name}</button>)}{[['π','pi'],['e','e'],['x²','^2'],['xʸ','^']].map(([label,value])=><button key={label} className="kn-focus" onClick={()=>insert(value,value.startsWith('^'))}>{label}</button>)}</div>}
    <div className="calculator-keypad"><button className="kn-focus" onClick={clear}>C</button><button className="kn-focus" aria-label="Calculator backspace" onClick={backspace}>⌫</button><button className="kn-focus" onClick={()=>insert('(')}>(</button><button className="kn-focus" onClick={()=>insert(')',true)}>)</button>
      {['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','=','+'].map(key=><button key={key} disabled={key==='='&&busy} className={`kn-focus ${key==='='?'calculator-equals':''}`} aria-label={key==='='?'Calculate':key} onClick={()=>key==='='?void equals():insert(key==='×'?'*':key==='÷'?'/':key,['+','-','×','÷'].includes(key))}>{key==='='&&busy?'…':key}</button>)}
      <button className="kn-focus" onClick={()=>insert('ans')}>Ans</button><button className="kn-focus" title="Divide the preceding value by 100" onClick={()=>insert('/100',true)}>%</button><button className="kn-focus calculator-sign" onClick={()=>{setExpression(expression?`-(${expression})`:'-');setComplete(false);setError('');input.current?.focus();}}>±</button>
    </div>
    {scientific&&<p className="teaching-math-hint">Trig uses {angleMode==='DEG'?'degrees':'radians'}. log = base 10; ln = natural log. Close parentheses before =.</p>}
    {history.length>0&&<details className="calculator-history"><summary>History</summary><ol>{history.map((entry,index)=><li key={index}><button className="kn-focus" onClick={()=>{setExpression(entry.expression);setAngleMode(entry.angleMode);setComplete(false);setError('');input.current?.focus();}}><span>{entry.expression} = <strong>{entry.result}</strong></span><small>{entry.angleMode}</small></button></li>)}</ol><button className="kn-focus" onClick={()=>setHistory([])}>Clear history</button></details>}
  </section>;
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
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const source = getCanvas();
      const c = lens.current;
      if (!source || !c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = source.width / source.clientWidth;
      const zoom = 1.8;
      const size = c.width;
      const sx = (e.clientX - source.getBoundingClientRect().left) * dpr - size / (2 * zoom);
      const sy = (e.clientY - source.getBoundingClientRect().top) * dpr - size / (2 * zoom);
      ctx.clearRect(0, 0, size, size);
      try {
        ctx.drawImage(source, sx, sy, size / zoom, size / zoom, 0, 0, size, size);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [getCanvas]);
  return (
    <div className="fixed inset-0 z-40" onPointerDown={onClose}>
      <canvas
        ref={lens}
        width={220}
        height={220}
        className="pointer-events-none fixed rounded-full border-4 border-brand shadow-2xl"
        style={{ left: pos.x + 24, top: pos.y + 24 }}
      />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-xs text-muted">
        Magnifier — move to zoom, click to exit
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
