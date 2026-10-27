import {StoreCredits} from './StoreCredits';
import {PHOENIX_CREDITS} from '@/lib/store-credits';
import {BackgroundGallery} from './BackgroundGallery';
import './background-gallery.css';
import {useEffect,useRef,useState} from 'react';
import type {AppProfile} from '@/db/schema';
import {BOARD_PRESETS,type BoardPreset} from '@/lib/board-presets';
import {drawBackground} from '@/lib/render';
import {loadBackgroundImage} from '@/lib/background-image';
import {themeImage} from '@/lib/theme-pack';
const textures=new Map<string,string>();
export function presetTexture(id:string){
  if(id!=='chalk'&&id!=='paper'&&id!=='blueprint'&&id!=='cream'&&id!=='math')return undefined;
  let source=textures.get(id);if(source)return source;
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d')!;
  let seed=1729;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

  if(id==='chalk'){
    ctx.fillStyle='#163d30';ctx.fillRect(0,0,1280,720);
    for(let i=0;i<50;i++){
      const cx=rand()*1280,cy=rand()*720,r=25+rand()*70;
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0,'rgba(235,255,240,0.035)');g.addColorStop(1,'rgba(235,255,240,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    }
    for(let i=0;i<4500;i++){
      const x=rand()*1280,y=rand()*720,s=0.5+rand()*1.5;
      ctx.fillStyle=`rgba(245,255,244,${0.02+rand()*0.06})`;ctx.fillRect(x,y,s,s);
    }
  }else if(id==='blueprint'){
    ctx.fillStyle='#193e61';ctx.fillRect(0,0,1280,720);
    ctx.strokeStyle='rgba(0,212,255,0.18)';ctx.lineWidth=1;
    ctx.beginPath();
    for(let x=0;x<=1280;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,720);}
    for(let y=0;y<=720;y+=32){ctx.moveTo(0,y);ctx.lineTo(1280,y);}
    ctx.stroke();
    ctx.strokeStyle='rgba(0,212,255,0.42)';ctx.lineWidth=1.4;
    ctx.beginPath();
    for(let x=0;x<=1280;x+=160){ctx.moveTo(x,0);ctx.lineTo(x,720);}
    for(let y=0;y<=720;y+=160){ctx.moveTo(0,y);ctx.lineTo(1280,y);}
    ctx.stroke();
    ctx.strokeStyle='rgba(0,235,255,0.75)';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let x=0;x<=1280;x+=160){
      for(let y=0;y<=720;y+=160){
        ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);
      }
    }
    ctx.stroke();
  }else{
    ctx.fillStyle=id==='cream'?'#faf1da':id==='math'?'#e9f1f7':'#fffdf5';
    ctx.fillRect(0,0,1280,720);
    for(let i=0;i<3500;i++){
      const x=rand()*1280,y=rand()*720;
      ctx.fillStyle='rgba(130,95,45,0.025)';ctx.fillRect(x,y,rand()*2+1,1);
    }
    ctx.strokeStyle='rgba(215,75,75,0.3)';ctx.setLineDash([4,4]);ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(72,0);ctx.lineTo(72,720);ctx.stroke();
    ctx.strokeStyle='rgba(120,100,70,0.18)';ctx.beginPath();ctx.moveTo(0,64);ctx.lineTo(1280,64);ctx.stroke();
    ctx.setLineDash([]);
  }
  source=canvas.toDataURL('image/png');textures.set(id,source);return source;
}
function PresetPreview({preset}:{preset:BoardPreset}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{let cancelled=false;const ctx=ref.current?.getContext('2d');if(!ctx)return;const source=preset.image??presetTexture(preset.id);const paint=(image?:HTMLImageElement)=>{if(cancelled)return;drawBackground(ctx,240,96,preset.background,preset.pattern,1,image);ctx.fillStyle=preset.ink;ctx.font='italic 24px Georgia';ctx.fillText('Aa',16,38);};paint();if(source)void loadBackgroundImage(source).then(paint).catch(()=>{});return()=>{cancelled=true;};},[preset]);
  return <canvas aria-hidden="true" ref={ref} width={240} height={96} style={{width:'100%',height:64,objectFit:'cover'}}/>;
}
export function BoardPresets({value,onChange,onlyGallery=false}:{value:Partial<AppProfile>;onChange:(patch:Partial<AppProfile>)=>void;onlyGallery?:boolean}){
  const [creator,setCreator]=useState(value.teacherName||'Local creator'),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),input=useRef<HTMLInputElement>(null);
  const saved=value.boardPresets??[],presets=[...(value.theme?.boards??BOARD_PRESETS),...saved].filter((p,i,list)=>list.findIndex(item=>item.id===p.id)===i);
  if(onlyGallery)return <BackgroundGallery onChange={onChange}/>;
  return <section aria-label="Board presets" className="space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{presets.map(p=><button key={p.id} type="button" aria-label={`Apply preset ${p.name}`} aria-pressed={value.boardBg===p.background&&value.boardPattern===p.pattern&&value.boardImage===(p.image??presetTexture(p.id))} onClick={()=>onChange({boardBg:p.background,boardPattern:p.pattern,defaultPenColor:p.ink,boardImage:p.image??presetTexture(p.id),boardCredits:p.credits??PHOENIX_CREDITS})} className="kn-focus overflow-hidden rounded-lg border border-line text-left"><PresetPreview preset={p}/><span className="block px-2 py-2 text-xs font-medium">{p.name}</span><StoreCredits compact credits={p.credits??PHOENIX_CREDITS}/></button>)}</div>
    <BackgroundGallery onChange={onChange}/>
    <label className="block text-xs">Board color<input aria-label="Custom default board color" type="color" value={value.boardBg??'#18212b'} onChange={e=>onChange({boardBg:e.target.value,boardImage:undefined})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-base p-1"/></label>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="min-h-11 rounded-lg border border-line px-3" onClick={()=>input.current?.click()}>{busy?'Preparing image…':'Background image'}</button>{value.boardImage&&<button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={()=>onChange({boardImage:undefined})}>Remove image</button>}</div>
    <p className="text-xs text-muted">PNG, JPEG or WebP up to 64 MB. Automatically resized to fit 1280 x 720 and compressed under 550 KB; proportions are preserved.</p>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{onChange({boardImage:await themeImage(file),boardCredits:{author:creator.trim()||'Local creator',addedBy:value.teacherName?.trim()||'Local user'}});setError('');}catch(error){setError((error as Error).message);}finally{setBusy(false);e.target.value='';}}}/>
    {error&&<p role="alert">{error}</p>}
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs">Preset name<input aria-label="Board preset name" maxLength={48} value={name} onChange={e=>setName(e.target.value)} placeholder="My classroom board" className="mt-1 w-full rounded-lg border border-line bg-base px-3 py-2"/></label><label className="min-w-0 flex-1 text-xs">Creator<input aria-label="Background creator" value={creator} onChange={e=>setCreator(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-line bg-base px-3 py-2"/></label><button type="button" disabled={!name.trim()||!creator.trim()||saved.length>=12} className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40" onClick={()=>{onChange({boardPresets:[...saved,{id:crypto.randomUUID(),name:name.trim(),background:value.boardBg??'#18212b',pattern:value.boardPattern??'dots',ink:value.defaultPenColor??'#f4f4f5',image:value.boardImage,credits:value.boardCredits??{author:creator.trim(),addedBy:value.teacherName?.trim()||'Local user'}}]});setName('');}}>Save preset</button></div>
    {saved.length>0&&<div className="flex flex-wrap gap-2">{saved.map(p=><button key={p.id} type="button" aria-label={`Remove preset ${p.name}`} onClick={()=>onChange({boardPresets:saved.filter(item=>item.id!==p.id)})} className="min-h-11 rounded border border-line px-2 text-xs text-muted">{p.name} ×</button>)}</div>}
  </section>;
}
