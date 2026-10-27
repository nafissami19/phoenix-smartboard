import {useEffect, useRef, useState} from 'react';
import type {PointerEvent as Pointer} from 'react';
import {arcEdges, angleDelta, type GuideEdge} from '@/lib/guide-geometry';
import type {Point} from '@/db/schema';
import './geometry.css';
import {fitInstrument} from '@/lib/instrument-bounds';

type Kind='ruler'|'protractor'|'setsquare'|'compass';
type Action='move'|'rotate'|'resize'|'ray'|'sweep';
type Drag={action:Action;pointer:number;start:Point;origin:Point;angle:number;size:number;last:number;sweep:number};
const RAD=Math.PI/180, INK='var(--guide-ink,#153848)';

/** Only attached grips intercept input. The transparent body lets board ink through. */
export function GeometryOverlay({kind,onClose,onEdges,onDraw,pxPerMm}:{pxPerMm?:number;kind:Kind;onClose:()=>void;onEdges:(id:string,edges:GuideEdge[])=>void;onDraw:(edges:GuideEdge[],circle?:{center:Point;radius:number})=>void}) {
 const saved=useRef<{x:number;y:number;angle:number;size:number;width:number;height:number}|null>(null);
 if(saved.current===null){try{const v=JSON.parse(localStorage.getItem(`phoenix-instrument-${kind}`)??'null');if(v&&[v.x,v.y,v.angle,v.size,v.width,v.height].every(Number.isFinite)&&v.size>0&&v.width>0&&v.height>0)saved.current=v;}catch{}}
 const [pos,setPos]=useState(()=>saved.current?{x:saved.current.x*innerWidth/saved.current.width,y:saved.current.y*innerHeight/saved.current.height}:{x:Math.min(380,innerWidth*.4),y:Math.min(350,innerHeight*.5)});
 const [angle,setAngle]=useState(saved.current?.angle??0),[size,setSize]=useState(saved.current?.size??Math.min(kind==='protractor'?210:360,window.innerWidth*(kind==='protractor'?.26:.6))),[included,setIncluded]=useState(60);
 useEffect(()=>{try{localStorage.setItem(`phoenix-instrument-${kind}`,JSON.stringify({...pos,angle,size,width:innerWidth,height:innerHeight}));}catch{}},[kind,pos,angle,size]);
 const [sweep,setSweep]=useState<{start:number;amount:number}|null>(null),[active,setActive]=useState<Action|null>(null);
 const drag=useRef<Drag|null>(null),latest=useRef(onEdges);latest.current=onEdges;
 const label={ruler:'Ruler',protractor:'Protractor',setsquare:'Set square',compass:'Compass'}[kind],height=size*.65,radius=size/2;
 const point=(x:number,y:number):Point=>({x:pos.x+x*Math.cos(angle*RAD)-y*Math.sin(angle*RAD),y:pos.y+x*Math.sin(angle*RAD)+y*Math.cos(angle*RAD)});
 const edges:GuideEdge[]=kind==='compass'?[]:kind==='setsquare'?[{a:pos,b:point(size,0)},{a:pos,b:point(0,-height)},{a:point(size,0),b:point(0,-height)}]:kind==='protractor'?[{a:point(-size,0),b:point(size,0)},{a:pos,b:point(size*Math.cos(-included*RAD),size*Math.sin(-included*RAD))}]:[{a:pos,b:point(size,0)},{a:point(0,48),b:point(size,48)}];
 useEffect(()=>{latest.current(kind,edges);},[kind,pos.x,pos.y,angle,size,included]);
 useEffect(()=>()=>latest.current(kind,[]),[kind]);
 useEffect(()=>{
  const fit=()=>{const fitted=fitInstrument(kind,size,angle,pos,{width:window.innerWidth,height:window.innerHeight});if(Math.abs(fitted.size-size)>.1)setSize(fitted.size);if(Math.abs(fitted.origin.x-pos.x)>.1||Math.abs(fitted.origin.y-pos.y)>.1)setPos(fitted.origin);};
  fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);
 },[kind,size,angle,pos.x,pos.y]);
 function start(e:Pointer<SVGGElement>,action:Action){if(e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={action,pointer:e.pointerId,start:{x:e.clientX,y:e.clientY},origin:pos,angle,size,last:Math.atan2(e.clientY-pos.y,e.clientX-pos.x),sweep:0};setActive(action);if(action==='sweep')setSweep({start:angle*RAD,amount:0});}
 function move(e:Pointer<SVGGElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.preventDefault();const theta=Math.atan2(e.clientY-d.origin.y,e.clientX-d.origin.x);
  if(d.action==='move')setPos({x:Math.max(35,Math.min(window.innerWidth-35,d.origin.x+e.clientX-d.start.x)),y:Math.max(80,Math.min(window.innerHeight-115,d.origin.y+e.clientY-d.start.y))});
  else if(d.action==='rotate'){d.sweep+=angleDelta(d.last,theta);d.last=theta;setAngle(Math.round((d.angle+d.sweep/RAD)*10)/10);}
  else if(d.action==='resize'){const distance=Math.hypot(e.clientX-d.origin.x,e.clientY-d.origin.y),initial=Math.max(1,Math.hypot(d.start.x-d.origin.x,d.start.y-d.origin.y));setSize(Math.max(80,Math.min(Math.min(700,window.innerWidth*(kind==='protractor'?.45:.9)),d.size*distance/initial)));}
  else if(d.action==='ray')setIncluded(Math.round(Math.max(1,Math.min(179,-angleDelta(angle*RAD,theta)/RAD))));
  else {d.sweep+=angleDelta(d.last,theta);d.last=theta;setAngle(d.angle+d.sweep/RAD);setSweep({start:d.angle*RAD,amount:d.sweep});}
 }
 function finish(e:Pointer<SVGGElement>,cancelled=false){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;if(!cancelled&&d.action==='sweep'&&Math.abs(d.sweep)>.025){if(Math.abs(d.sweep)>=Math.PI*1.95)onDraw([],{center:d.origin,radius:d.size/2});else onDraw(arcEdges(d.origin,d.size/2,d.angle*RAD,d.sweep));}drag.current=null;setActive(null);setSweep(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 function grip(action:Action,x:number,y:number,title:string){return <g className={`instrument-grip ${active===action?'is-active':''}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={title} onPointerDown={e=>start(e,action)} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const delta=e.key==='ArrowLeft'||e.key==='ArrowDown'?-5:5;if(action==='rotate')setAngle(v=>v+delta);else if(action==='resize')setSize(v=>Math.max(80,v+delta));else if(action==='ray')setIncluded(v=>Math.max(1,Math.min(179,v+delta)));else if(action==='move')setPos(p=>({x:p.x+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0),y:p.y+(e.key==='ArrowUp'?-10:e.key==='ArrowDown'?10:0)}));}}>
  <title>{title}{action==='sweep'?': drag around the centre to draw':': drag to adjust'}</title><circle className="instrument-hit" r="22"/><circle className="instrument-grip-disc" r="13"/>
  {action==='move'?<path d="M-6 0H6M0-6V6M-6 0l3-3m-3 3l3 3M6 0L3-3m3 3L3 3M0-6L-3-3m3-3l3 3M0 6l-3-3m3 3l3-3"/>:action==='rotate'||action==='ray'?<path d="M-6 1a6 6 0 1 0 2-5M-7-5v5h5"/>:action==='resize'?<path d="M-6 6L6-6M-6 1v5h5M1-6h5v5"/>:<path d="M-5 6l2-5 7-7 3 3-7 7-5 2ZM2-4l3 3"/>}
 </g>;}
 const closeAt=kind==='protractor'?{x:35,y:32}:kind==='setsquare'?{x:28,y:-height+24}:kind==='compass'?{x:-30,y:32}:{x:27,y:24};
 const arc=sweep?arcEdges(pos,radius,sweep.start,sweep.amount):[];

 return <div className="geometry-overlay direct-instrument" aria-label={`${label} on board`}>
  <svg className="geometry-surface" width="100%" height="100%">
   <defs>
    {/* Frosted Translucent Acrylic Gradients */}
    <linearGradient id="kn-overlay-ruler-acrylic" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor="#ffffff" stopOpacity="0.48"/>
     <stop offset="12%" stopColor="#c5e4f3" stopOpacity="0.26"/>
     <stop offset="85%" stopColor="#9fcde5" stopOpacity="0.18"/>
     <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4"/>
    </linearGradient>

    <radialGradient id="kn-overlay-protractor-acrylic" cx="50%" cy="100%" r="100%">
     <stop offset="0%" stopColor="#9fcde5" stopOpacity="0.16"/>
     <stop offset="55%" stopColor="#c5e4f3" stopOpacity="0.25"/>
     <stop offset="90%" stopColor="#e0f2fe" stopOpacity="0.34"/>
     <stop offset="100%" stopColor="#ffffff" stopOpacity="0.52"/>
    </radialGradient>

    <linearGradient id="kn-overlay-setsquare-acrylic" x1="0" y1="0" x2="1" y2="1">
     <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45"/>
     <stop offset="45%" stopColor="#c5e4f3" stopOpacity="0.22"/>
     <stop offset="100%" stopColor="#9fcde5" stopOpacity="0.16"/>
    </linearGradient>
   </defs>

   {arc.length>0&&<path className="instrument-arc-preview" d={`M${arc[0].a.x} ${arc[0].a.y} ${arc.map(e=>`L${e.b.x} ${e.b.y}`).join(' ')}`}/>}
   
   <g transform={`translate(${pos.x} ${pos.y}) rotate(${angle})`} fill="none" stroke={INK} strokeWidth="1.5">
   
   {/* Virtual Ruler with frosted translucent acrylic effect and dual-stroke neon millimeter graduations */}
   {kind==='ruler'&&<>
    <rect width={size} height="48" rx="4" fill="url(#kn-overlay-ruler-acrylic)" stroke="rgba(255, 255, 255, 0.65)" strokeWidth="1.2"/>
    <line x1="2" y1="1" x2={size-2} y2="1" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1" strokeLinecap="round"/>
    {Array.from({length:Math.floor(size/(pxPerMm?pxPerMm*2:10))+1},(_,i)=>{
     const x=i*(pxPerMm?pxPerMm*2:10);
     const isMajor=i%5===0;
     const tickH=isMajor?18:10;
     return (
      <g key={i}>
       {/* Dark backing line for high contrast against light/whiteboard backgrounds */}
       <line x1={x} y1="0" x2={x} y2={tickH} stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2.5" strokeLinecap="round"/>
       <line x1={x} y1="48" x2={x} y2={48-(isMajor?11:7)} stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2.5" strokeLinecap="round"/>
       {/* Neon cyan center line for high contrast and vibrant glow against dark boards */}
       <line x1={x} y1="0" x2={x} y2={tickH} stroke="#00f0ff" strokeWidth="1.2" strokeLinecap="round"/>
       <line x1={x} y1="48" x2={x} y2={48-(isMajor?11:7)} stroke="#00f0ff" strokeWidth="1.2" strokeLinecap="round"/>
       {isMajor&&<text x={x+3} y="29" fontSize="10" fontWeight="bold" paintOrder="stroke fill" stroke="rgba(15, 23, 42, 0.95)" strokeWidth="2.5px" fill="#00f0ff">{i*(pxPerMm?2:10)}{pxPerMm?'mm':''}</text>}
      </g>
     );
    })}
    {grip('move',size/2,24,'Move ruler')}
    {grip('resize',size,24,'Resize ruler')}
    {grip('rotate',size-55,24,'Rotate ruler')}
   </>}

   {/* Set square with frosted translucent acrylic effect and high-contrast markings */}
   {kind==='setsquare'&&<>
    <path d={`M0 0H${size}L0 ${-height}Z M28 -28H${Math.max(32,size-100)}L28 ${Math.min(-32,-height+65)}Z`} fill="url(#kn-overlay-setsquare-acrylic)" fillRule="evenodd" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1.2"/>
    <path d="M0 -24h24v24" stroke="rgba(255, 255, 255, 0.75)" strokeWidth="1"/>
    {Array.from({length:Math.floor(size/20)},(_,i)=>{
     const x=i*20;
     return (
      <g key={i}>
       <line x1={x} y1="0" x2={x} y2="-10" stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2.5" strokeLinecap="round"/>
       <line x1={x} y1="0" x2={x} y2="-10" stroke="#00f0ff" strokeWidth="1.2" strokeLinecap="round"/>
      </g>
     );
    })}
    {grip('move',30,-35,'Move set square')}
    {grip('resize',size-22,-10,'Resize set square')}
    {grip('rotate',20,-height+65,'Rotate set square')}
   </>}

   {/* Virtual Protractor with frosted translucent acrylic effect and neon degree graduations */}
   {kind==='protractor'&&<>
    <path d={`M${-size} 0A${size} ${size} 0 0 1 ${size} 0Z`} fill="url(#kn-overlay-protractor-acrylic)" stroke="rgba(255, 255, 255, 0.65)" strokeWidth="1.2"/>
    <path d={`M${-size*.5} 0A${size*.5} ${size*.5} 0 0 1 ${size*.5} 0Z`} fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1"/>
    {Array.from({length:37},(_,i)=>{
     const a=i*5*RAD;
     const isMajor=i%2===0;
     const r=size-(isMajor?19:10);
     const cos=Math.cos(a), sin=-Math.sin(a);
     return (
      <g key={i}>
       <line x1={size*cos} y1={size*sin} x2={r*cos} y2={r*sin} stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2.5" strokeLinecap="round"/>
       <line x1={size*cos} y1={size*sin} x2={r*cos} y2={r*sin} stroke="#00f0ff" strokeWidth="1.2" strokeLinecap="round"/>
       {i%6===0&&<text x={(size-32)*cos} y={(size-32)*sin+4} fontSize="11" fontWeight="bold" textAnchor="middle" paintOrder="stroke fill" stroke="rgba(15, 23, 42, 0.95)" strokeWidth="2.5px" fill="#00f0ff">{i*5}°</text>}
      </g>
     );
    })}
    {/* Angle baseline and ray line */}
    <path d={`M0 0H${size}`} stroke="rgba(15, 23, 42, 0.85)" strokeWidth="3"/>
    <path d={`M0 0H${size}`} stroke="#00f0ff" strokeWidth="1.6"/>
    <path d={`M0 0L${size*Math.cos(-included*RAD)} ${size*Math.sin(-included*RAD)}`} stroke="rgba(15, 23, 42, 0.9)" strokeWidth="3.6"/>
    <path d={`M0 0L${size*Math.cos(-included*RAD)} ${size*Math.sin(-included*RAD)}`} stroke="#ffaa00" strokeWidth="2"/>
    {/* Angle badge */}
    <rect x="-24" y="-30" width="48" height="20" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.2"/>
    <text x="0" y="-16" stroke="none" fill="#00f0ff" fontSize="13" fontWeight="bold" textAnchor="middle">{included}°</text>
    {grip('move',0,32,'Move protractor')}
    {grip('rotate',size,0,'Rotate protractor')}
    {grip('resize',-size,0,'Resize protractor')}
    {grip('ray',(size-18)*Math.cos(-included*RAD),(size-18)*Math.sin(-included*RAD),'Adjust protractor angle')}
   </>}

   {/* Virtual Compass */}
   {kind==='compass'&&<>
    <circle r={radius} stroke="#00f0ff" strokeDasharray="4 7" strokeOpacity=".5" strokeWidth="1.5"/>
    <path d={`M0 0L${radius*.5} -${Math.min(85,radius*.5)}L${radius} 0`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" stroke="#1e293b"/>
    <path d={`M0 0L${radius*.5} -${Math.min(85,radius*.5)}L${radius} 0`} strokeWidth="3" stroke="#00f0ff"/>
    <path d={`M0 0H${radius}`} stroke="#00f0ff" strokeDasharray="3 4" strokeWidth="1.2"/>
    <text x={radius/2} y="22" textAnchor="middle" fill="#00f0ff" paintOrder="stroke fill" stroke="rgba(15, 23, 42, 0.95)" strokeWidth="2.5px" fontWeight="bold" fontSize="12">r {Math.round(radius)} px</text>
    {grip('move',0,0,'Move compass')}
    {grip('resize',radius/2,-Math.min(85,radius*.5),'Resize compass radius')}
    {grip('sweep',radius,0,'Draw compass arc')}
   </>}

   <g className="instrument-grip instrument-close" transform={`translate(${closeAt.x} ${closeAt.y})`} role="button" tabIndex={0} aria-label={`Close ${label.toLowerCase()}`} onClick={onClose} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClose();}}}>
    <title>Close {label.toLowerCase()}</title>
    <circle className="instrument-hit" r="18"/>
    <circle className="instrument-grip-disc" r="11"/>
    <path d="M-4-4L4 4M-4 4L4-4"/>
   </g>
   
   <text className="instrument-measure" x={kind==='protractor'?0:kind==='compass'?size/4:size/2} y={kind==='protractor'?64:kind==='setsquare'?24:kind==='compass'?44:70} textAnchor="middle">{label} · {Math.round(angle)}°</text>
   </g>
  </svg>
 </div>;
}
