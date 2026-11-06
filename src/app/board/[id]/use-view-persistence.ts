import {useCallback,useEffect,useRef,useState} from 'react';
import {saveLessonDefaultView} from '@/lib/work-journal';
import type {View} from '@/lib/use-whiteboard';

const VIEW_SAVE_DELAY=300;

/**
 * Persists the board view per slide without touching localStorage on every pan
 * frame: writes are debounced, flushed on slide change, page hide and unmount.
 * `settled` is the last persisted view, for consumers (slide previews) that must
 * not recompute at gesture cadence.
 */
export function useViewPersistence({lessonId,pageId,view,viewSync,enabled}:{lessonId:string;pageId?:string;view:View;viewSync:boolean;enabled:boolean}){
  const [settled,setSettled]=useState<{pageId?:string;view:View}>({pageId,view});
  const pending=useRef<(()=>void)|null>(null),timer=useRef<number|null>(null),lastPage=useRef<string|undefined>(undefined);
  const flush=useCallback(()=>{
    if(timer.current!==null){window.clearTimeout(timer.current);timer.current=null;}
    const write=pending.current;pending.current=null;write?.();
  },[]);
  useEffect(()=>{
    if(!enabled||!pageId)return;
    pending.current=()=>{try{localStorage.setItem('phoenix-view:'+pageId,JSON.stringify(view));if(viewSync)saveLessonDefaultView(lessonId,view);}catch{/* Storage full or blocked: the view simply is not remembered. */}setSettled({pageId,view});};
    // A newly opened slide is recorded at once; continuous panning is debounced.
    if(lastPage.current!==pageId){lastPage.current=pageId;flush();return;}
    if(timer.current!==null)window.clearTimeout(timer.current);
    timer.current=window.setTimeout(flush,VIEW_SAVE_DELAY);
  },[enabled,pageId,view,viewSync,lessonId,flush]);
  // Leaving a slide (or the board) writes its last view before the next one loads.
  useEffect(()=>()=>flush(),[pageId,flush]);
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',flush);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',flush);document.removeEventListener('visibilitychange',hidden);};
  },[flush]);
  return {settledView:settled,flushView:flush};
}
