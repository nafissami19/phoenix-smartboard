import {useCallback, useId, useRef, useState} from 'react';
import {CustomSelect} from '@/components/CustomSelect';
import {EMPTY_SOLUTION,drainSolution,pourSolution,solutionPH,indicatorColor,type Indicator,type Reagent} from '@/lib/chemistry-beaker';

interface BeakerBubble {
  id: number;
  cx: number;
  cy: number;
  r: number;
  dur: number;
  delay: number;
}

export function ChemistryBeaker({onInsert}:{onInsert:(url:string,width:number,height:number)=>Promise<void>}) {
  const [solution,setSolution]=useState(()=>pourSolution(EMPTY_SOLUTION,'Water',100));
  const [dose,setDose]=useState(25);
  const [concentration,setConcentration]=useState(.1);
  const [indicator,setIndicator]=useState<Indicator>('Universal');
  const [custom,setCustom]=useState('#58a9df');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  
  // Wave wobble and bubbling state
  const [wobble,setWobble]=useState(0);
  const [tilt,setTilt]=useState(0);
  const [bubbles,setBubbles]=useState<BeakerBubble[]>([]);
  const dragRef=useRef<{startX:number;lastX:number;lastTime:number}|null>(null);
  const animRef=useRef<number|null>(null);
  const bubbleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const svg=useRef<SVGSVGElement>(null);
  const clip=useId().replace(/:/g,'');
  const ph=solutionPH(solution);
  const color=indicatorColor(ph,indicator,custom);
  const top=245-solution.volumeMl/500*190;

  const startWaveDecay = useCallback((initialWobble: number, initialTilt: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let w = initialWobble;
    let t = initialTilt;
    let step = 0;
    const tick = () => {
      step += 0.22;
      w = w * 0.88 * Math.cos(step);
      t = t * 0.84;
      setWobble(w);
      setTilt(t);
      if (Math.abs(w) > 0.2 || Math.abs(t) > 0.2) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setWobble(0);
        setTilt(0);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const triggerBubbles = useCallback(() => {
    const count = 16;
    const newBubbles: BeakerBubble[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      cx: 175 + Math.random() * 165,
      cy: Math.max(top + 15, 235 - Math.random() * 55),
      r: 1.8 + Math.random() * 2.8,
      dur: 0.9 + Math.random() * 0.8,
      delay: Math.random() * 0.35,
    }));
    setBubbles(newBubbles);
    startWaveDecay(9, 2.5);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => {
      setBubbles([]);
    }, 2400);
  }, [top, startWaveDecay]);

  function pour(reagent:Reagent){
    setSolution(value=>pourSolution(value,reagent,dose,concentration));
    triggerBubbles();
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, lastX: e.clientX, lastTime: performance.now() };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dt = Math.max(1, performance.now() - dragRef.current.lastTime);
    const dx = e.clientX - dragRef.current.lastX;
    const totalDx = e.clientX - dragRef.current.startX;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastTime = performance.now();
    const vel = (dx / dt) * 16;
    const targetWobble = Math.max(-20, Math.min(20, vel * 1.6));
    const targetTilt = Math.max(-10, Math.min(10, totalDx * 0.12));
    setWobble(targetWobble);
    setTilt(targetTilt);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    startWaveDecay(wobble, tilt);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  async function insert(){
    if(!svg.current||busy)return;
    setBusy(true);
    setError('');
    let url='';
    try{
      url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg.current)],{type:'image/svg+xml'}));
      await onInsert(url,520,310);
    }catch{
      setError('Could not insert this experiment.');
    }finally{
      if(url)URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  return <section className="experiment-content" aria-label="Interactive chemistry beaker">
    <svg
      ref={svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 520 310"
      width="520"
      height="310"
      className="experiment-diagram cursor-grab active:cursor-grabbing"
      role="img"
      aria-label={`Chemistry beaker: ${solution.volumeMl} mL, pH ${ph===null?'empty':ph.toFixed(2)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <clipPath id={clip}>
          <path d="M150 45H365V232Q365 245 352 245H163Q150 245 150 232Z"/>
        </clipPath>
        <style>{`
          @keyframes kn-beaker-bubble-rise {
            0% { transform: translateY(0) scale(0.85); opacity: 0; }
            20% { opacity: 0.75; }
            80% { opacity: 0.6; }
            100% { transform: translateY(-55px) scale(1.15); opacity: 0; }
          }
          .kn-bubble-unit {
            transform-origin: center;
          }
        `}</style>
      </defs>
      <rect width="520" height="310" fill="#f4f7f9" rx="12"/>

      {/* Tiltable beaker assembly with wave wobble */}
      <g transform={`rotate(${tilt} 257.5 245)`}>
        {/* Beaker fluid contents */}
        <g clipPath={`url(#${clip})`}>
          {solution.volumeMl > 0 && (
            <>
              {/* Meniscus wave wobble path */}
              <path
                d={`M 148 ${Math.max(45, top - wobble * 0.6)}
                    Q 203.5 ${Math.max(45, top - wobble)} 257.5 ${Math.max(45, top)}
                    Q 311.5 ${Math.max(45, top + wobble)} 367 ${Math.max(45, top + wobble * 0.6)}
                    L 367 248 L 148 248 Z`}
                fill={color}
                fillOpacity=".72"
              />
              {/* Meniscus surface highlight */}
              <path
                d={`M 150 ${Math.max(45, top - wobble * 0.6)}
                    Q 203.5 ${Math.max(45, top - wobble)} 257.5 ${Math.max(45, top)}
                    Q 311.5 ${Math.max(45, top + wobble)} 365 ${Math.max(45, top + wobble * 0.6)}`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="2.5"
              />
              {/* Translucent liquid bubbles when mixing reagents */}
              {bubbles.map(b => (
                <circle
                  key={b.id}
                  cx={b.cx}
                  cy={b.cy}
                  r={b.r}
                  fill="rgba(255, 255, 255, 0.45)"
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth="0.8"
                  className="kn-bubble-unit"
                  style={{
                    animation: `kn-beaker-bubble-rise ${b.dur}s ease-out ${b.delay}s infinite`,
                  }}
                />
              ))}
            </>
          )}
        </g>

        {/* Glass outline and reflections */}
        <path d="M132 42H150V232Q150 250 168 250H347Q365 250 365 232V42L384 35" fill="none" stroke="#315569" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M163 52V226" stroke="#fff" strokeWidth="4" strokeOpacity=".7"/>
        {[100,200,300,400,500].map(n=><g key={n}><path d={`M333 ${245-n/500*190}H360`} stroke="#315569"/><text x="325" y={249-n/500*190} textAnchor="end" fontFamily="Arial" fontSize="12" fill="#254357">{n}</text></g>)}
      </g>

      <text x="257" y="280" textAnchor="middle" fontFamily="Arial" fontSize="17" fill="#183c36">{solution.volumeMl} mL / 500 mL</text>
      <text x="257" y="302" textAnchor="middle" fontFamily="Arial" fontSize="13" fill="#183c36">{indicator==='None'?'Custom liquid colour':indicator+' indicator'}{ph!==null?' - pH '+ph.toFixed(2):''}</text>
    </svg>
    <div className="experiment-presets" role="group" aria-label="Pour reagent">{(['Water','HCl','NaOH'] as const).map(reagent=><button type="button" key={reagent} onClick={()=>pour(reagent)}>Add {reagent}</button>)}</div>
    <label className="experiment-slider"><span>Pour amount<strong>{dose} mL</strong></span><input aria-label="Pour amount" type="range" min="1" max="100" value={dose} onChange={e=>setDose(Number(e.target.value))}/></label>
    <label className="experiment-slider"><span>Reagent concentration<strong>{concentration.toFixed(2)} mol/L</strong></span><input aria-label="Reagent concentration" type="range" min="0.01" max="1" step="0.01" value={concentration} onChange={e=>setConcentration(Number(e.target.value))}/></label>
    <label className="experiment-field">Indicator<CustomSelect aria-label="Beaker indicator" value={indicator} onChange={e=>setIndicator(e.target.value as Indicator)}>{(['Universal','Litmus','Phenolphthalein','None'] as const).map(name=><option key={name} value={name}>{name==='None'?'Custom colour':name}</option>)}</CustomSelect></label>
    {indicator==='None'&&<label className="experiment-field">Liquid colour<input type="color" aria-label="Liquid colour" value={custom} onChange={e=>setCustom(e.target.value)}/></label>}
    <dl className="experiment-readings"><div><dt>pH at 25 C</dt><dd><output aria-label="Beaker pH">{ph===null?'Empty':ph.toFixed(2)}</output></dd></div><div><dt>Neutralised amount</dt><dd>{(Math.min(solution.acidMol,solution.baseMol)*1000).toFixed(2)} mmol</dd></div></dl>
    {solution.spilledMl>0&&<p role="status">Overflow: {solution.spilledMl.toFixed(0)} mL. Spilled solution is removed from the model.</p>}
    <div className="experiment-presets"><button type="button" disabled={!solution.volumeMl} onClick={()=>setSolution(value=>drainSolution(value,dose))}>Drain {dose} mL</button><button type="button" onClick={()=>setSolution({...EMPTY_SOLUTION})}>Empty beaker</button><button type="button" onClick={()=>{setSolution(pourSolution(EMPTY_SOLUTION,'Water',100));setDose(25);setConcentration(.1);setIndicator('Universal');}}>Reset experiment</button></div>
    <p className="experiment-note">Ideal, fully mixed HCl / NaOH solutions at 25 C. Pouring conserves solute; draining removes a proportional amount. Indicator colours are illustrative. This model excludes weak acids, heating, gas and precipitation reactions.</p>
    <button type="button" className="experiment-primary kn-focus" disabled={busy} onClick={()=>void insert()}>{busy?'Inserting...':'Insert beaker snapshot'}</button>{error&&<p role="alert">{error}</p>}
  </section>;
}
