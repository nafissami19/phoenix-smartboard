import {useRef,useState} from 'react';

const FLUIDS = {
  water: { name: 'Water', density: 1.0, colorTop: '#38bdf8', colorBottom: '#0284c7', statusColor: '#38bdf8' },
  oil: { name: 'Oil', density: 0.92, colorTop: '#fde047', colorBottom: '#ca8a04', statusColor: '#facc15' },
  mercury: { name: 'Mercury', density: 13.6, colorTop: '#cbd5e1', colorBottom: '#64748b', statusColor: '#94a3b8' },
  honey: { name: 'Honey', density: 1.42, colorTop: '#fb923c', colorBottom: '#c2410c', statusColor: '#f97316' },
} as const;
type FluidType = keyof typeof FLUIDS;

export function ScienceLab({onInsert}:{onInsert:(url:string,width:number,height:number)=>Promise<void>}) {
  const [fluidKey,setFluidKey]=useState<FluidType>('water');
  const [volume,setVolume]=useState(250),[mass,setMass]=useState(100),[density,setDensity]=useState(1),[immersed,setImmersed]=useState(false);
  const svg=useRef<SVGSVGElement>(null),[error,setError]=useState('');
  
  const fluid=FLUIDS[fluidKey];
  const fluidDensity=fluid.density;
  const neutral=Math.abs(density-fluidDensity)<0.001;
  const floats=density<fluidDensity;
  const displacement=immersed?(floats?Math.min(mass/fluidDensity,mass):Math.min(mass/density,mass)):0;
  const total=volume+displacement, surface=270-Math.min(500,total)/500*220;
  const objectHeight=Math.min(85,25+Math.cbrt(mass/density)*7);
  const objectY=immersed?(floats?surface-objectHeight*(1-density/fluidDensity):neutral?(surface+270-objectHeight)/2:270-objectHeight):12;

  async function insert(){
    try{
      setError('');
      const markup=new XMLSerializer().serializeToString(svg.current!);
      const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
      try{await onInsert(url,360,320);}finally{URL.revokeObjectURL(url);}
    }catch{setError('Could not insert this experiment.');}
  }

  return (
    <div className="science-lab space-y-3 text-ink">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <p className="text-xs font-semibold text-muted">{fluid.name} displacement & buoyancy (ρ = {fluidDensity} g/mL)</p>
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-brand-light">
          {Math.min(500,total).toFixed(1)} mL
        </span>
      </div>

      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-panel p-1">
        {(Object.keys(FLUIDS) as FluidType[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${fluidKey === key ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'}`}
            onClick={() => setFluidKey(key)}
          >
            {FLUIDS[key].name} ({FLUIDS[key].density})
          </button>
        ))}
      </div>

      <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width="360" height="320" viewBox="0 0 360 320" className="h-auto w-full overflow-hidden rounded-xl border border-line shadow-inner" aria-label="Fluid displacement experiment">
        <defs>
          <linearGradient id="lab-bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c0e12"/>
            <stop offset="100%" stopColor="#141720"/>
          </linearGradient>
          <linearGradient id="lab-fluid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fluid.colorTop} stopOpacity="0.82"/>
            <stop offset="100%" stopColor={fluid.colorBottom} stopOpacity="0.92"/>
          </linearGradient>
          <linearGradient id="glass-glare" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25"/>
            <stop offset="15%" stopColor="#ffffff" stopOpacity="0.05"/>
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.05"/>
            <stop offset="100%" stopColor={fluid.colorTop} stopOpacity="0.2"/>
          </linearGradient>
          <linearGradient id="block-wood" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706"/>
            <stop offset="100%" stopColor="#b45309"/>
          </linearGradient>
          <linearGradient id="block-metal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#64748b"/>
          </linearGradient>
        </defs>

        <rect width="360" height="320" fill="url(#lab-bg)"/>

        {/* Liquid with curved surface meniscus */}
        <path d={`M95 ${surface} Q175 ${surface + 3} 255 ${surface} V270 H95 Z`} fill="url(#lab-fluid)"/>
        
        {/* Ambient liquid bubbles */}
        {immersed && (
          <g fill="#ffffff" fillOpacity="0.4">
            <circle cx="130" cy={Math.min(260, surface + 30)} r="2" />
            <circle cx="210" cy={Math.min(250, surface + 45)} r="2.5" />
            <circle cx="170" cy={Math.min(265, surface + 20)} r="1.5" />
          </g>
        )}

        {/* Glass beaker body */}
        <path d="M85 40 h15 v230 q0 12 12 12 h126 q12 0 12-12 V40 h15" stroke="rgba(255,255,255,0.45)" strokeWidth="3.5" fill="url(#glass-glare)"/>
        <path d="M92 40 h6 v228 q0 8 8 8 h138 q8 0 8-8 V40 h6" stroke={`${fluid.colorTop}44`} strokeWidth="1.5" fill="none"/>

        {/* Measurement graduations */}
        {[100,200,300,400,500].map(v => (
          <g key={v}>
            <line x1="225" y1={270 - v / 500 * 220} x2="252" y2={270 - v / 500 * 220} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
            <text x="260" y={274 - v / 500 * 220} fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.8)" fontFamily="ui-monospace,monospace">{v} mL</text>
          </g>
        ))}

        {/* Floating / Immersed object */}
        <rect x="145" y={objectY} width="55" height={objectHeight} rx="6" fill={floats ? "url(#block-wood)" : "url(#block-metal)"} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
        <line x1="147" y1={objectY + 3} x2="198" y2={objectY + 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>

        {/* Status text */}
        <text x="18" y="306" fill={fluid.statusColor} fontSize="12" fontWeight="600" fontFamily="system-ui,sans-serif">
          {immersed ? (neutral ? '● Neutral buoyancy' : floats ? '▲ Floating' : '▼ Settled on bottom') : '○ Ready outside liquid'}
        </text>
      </svg>

      <div className="space-y-2 rounded-xl border border-line bg-panel p-3 text-xs">
        <label className="flex items-center justify-between gap-3">
          <span>{fluid.name} volume: <strong className="font-mono text-ink">{volume} mL</strong></span>
          <input aria-label={`${fluid.name} volume`} type="range" min="50" max="450" step="10" value={volume} onChange={e=>setVolume(+e.target.value)} className="w-1/2 accent-brand"/>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Object mass: <strong className="font-mono text-ink">{mass} g</strong></span>
          <input aria-label="Object mass" type="range" min="10" max="200" step="5" value={mass} onChange={e=>setMass(+e.target.value)} className="w-1/2 accent-brand"/>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Object density: <strong className="font-mono text-ink">{density.toFixed(1)} g/mL</strong></span>
          <input aria-label="Object density" type="range" min="0.2" max="15" step="0.1" value={density} onChange={e=>setDensity(+e.target.value)} className="w-1/2 accent-brand"/>
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-line bg-base px-3 py-2 text-xs text-muted">
        <span>Displacement: <strong className="font-mono text-ink">{displacement.toFixed(1)} mL</strong></span>
        <span>Buoyant force: <strong className="font-mono text-ink">{(displacement*fluidDensity*9.81/1000).toFixed(2)} N</strong></span>
        {total > 500 && <span className="font-semibold text-amber-400">Overflow: {(total-500).toFixed(1)} mL</span>}
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow hover:bg-brand-dark" onClick={()=>setImmersed(!immersed)}>
          {immersed ? 'Lift object out' : 'Immerse in liquid'}
        </button>
        <button className="rounded-xl border border-line bg-elevated px-4 py-2.5 text-xs font-semibold text-ink hover:bg-line" onClick={()=>void insert()}>
          Insert diagram
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}