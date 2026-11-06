import {notifyPreferencesChanged} from '@/lib/preferences';
export type PerformanceMode='auto'|'2gb'|'4gb'|'8gb'|'4k';
export type PerformanceTier='low'|'balanced'|'high'|'ultra';
export type PerformanceProfile={tier:PerformanceTier;label:string;canvasDpr:number;maxCanvasPixels:number;pdfRenderWidth:number;pdfPagePixels:number;mediaCachePixels:number;imageCachePixels:number;maxPdfDocuments:number;thumbnailWidth:number;prefetchPages:number;undoSteps:number;checkpointMs:number;autosaveMs:number};
const profiles:Record<PerformanceTier,PerformanceProfile>={
 low:{tier:'low',label:'2 GB / low memory',canvasDpr:1,maxCanvasPixels:2_500_000,pdfRenderWidth:1600,pdfPagePixels:2_000_000,mediaCachePixels:6_000_000,imageCachePixels:6_000_000,maxPdfDocuments:1,thumbnailWidth:192,prefetchPages:0,undoSteps:20,checkpointMs:1000,autosaveMs:800},
 balanced:{tier:'balanced',label:'4 GB / balanced',canvasDpr:1.5,maxCanvasPixels:6_000_000,pdfRenderWidth:2560,pdfPagePixels:5_500_000,mediaCachePixels:16_000_000,imageCachePixels:16_000_000,maxPdfDocuments:2,thumbnailWidth:240,prefetchPages:1,undoSteps:35,checkpointMs:600,autosaveMs:500},
 high:{tier:'high',label:'8 GB / higher memory',canvasDpr:2,maxCanvasPixels:9_500_000,pdfRenderWidth:3840,pdfPagePixels:8_500_000,mediaCachePixels:24_000_000,imageCachePixels:24_000_000,maxPdfDocuments:3,thumbnailWidth:320,prefetchPages:2,undoSteps:60,checkpointMs:350,autosaveMs:300},
 ultra:{tier:'ultra',label:'Smart Board 4K Ultra HD',canvasDpr:2,maxCanvasPixels:12_000_000,pdfRenderWidth:3840,pdfPagePixels:9_000_000,mediaCachePixels:32_000_000,imageCachePixels:32_000_000,maxPdfDocuments:3,thumbnailWidth:320,prefetchPages:2,undoSteps:60,checkpointMs:350,autosaveMs:300},
};
let memoryHint:number|undefined,pressure=false;const listeners=new Set<()=>void>();
export function profileForMemory(gb?:number,mode:PerformanceMode='auto',constrained=false):PerformanceProfile{
 if(constrained||mode==='2gb')return profiles.low;
 if(mode==='4k')return profiles.ultra;
 if(mode==='8gb')return profiles.high;
 if(mode==='4gb')return profiles.balanced;
 if(gb!==undefined&&gb<=2.5)return profiles.low;
 if(gb!==undefined&&gb>=6)return profiles.high;
 if(typeof window!=='undefined'){
  const isLargeScreen=(window.screen?.width>=2560||window.innerWidth>=2560||document.documentElement.hasAttribute('data-smartboard'));
  if(isLargeScreen&&(gb===undefined||gb>=3.5))return profiles.high;
 }
 return profiles.balanced;
}
export function readPerformancePreferences():{mode:PerformanceMode}{let value:string|null=null;try{value=globalThis.localStorage?.getItem('phoenix-performance-mode')??null;}catch{}return {mode:value==='2gb'||value==='4gb'||value==='8gb'||value==='4k'?value:'auto'};}
export function getPerformanceProfile(){const browserMemory=typeof navigator==='undefined'?undefined:(navigator as Navigator&{deviceMemory?:number}).deviceMemory;return profileForMemory(memoryHint??browserMemory,readPerformancePreferences().mode,pressure);}
export function effectivePerformanceTier(){return getPerformanceProfile().tier;}
function notify(){for(const listener of listeners)listener();if(typeof window!=='undefined'){document.documentElement.dataset.performance=getPerformanceProfile().tier;window.dispatchEvent(new Event('phoenix-performance-changed'));}}
export function setPerformanceMode(mode:PerformanceMode){if(!['auto','2gb','4gb','8gb','4k'].includes(mode))return;try{localStorage.setItem('phoenix-performance-mode',mode);notifyPreferencesChanged();}catch{}pressure=false;notify();}
export function setDeviceMemoryHint(gb:number){if(!Number.isFinite(gb)||gb<=0)return;memoryHint=gb;notify();}
export function subscribePerformance(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
if(typeof window!=='undefined'){window.addEventListener('phoenix-memory-pressure',()=>{pressure=true;notify();});document.documentElement.dataset.performance=getPerformanceProfile().tier;}

let pointerActive=false,lastInteraction=0;
export function isUserInteracting(withinMs=1500){return pointerActive||Date.now()-lastInteraction<withinMs;}
if(typeof window!=='undefined'){
 const activity=()=>{lastInteraction=Date.now();};
 window.addEventListener('pointerdown',()=>{pointerActive=true;activity();},{passive:true});
 window.addEventListener('pointermove',()=>{if(pointerActive)activity();},{passive:true});
 const release=()=>{pointerActive=false;activity();};window.addEventListener('pointerup',release,{passive:true});window.addEventListener('pointercancel',release,{passive:true});window.addEventListener('blur',()=>{pointerActive=false;});
}
