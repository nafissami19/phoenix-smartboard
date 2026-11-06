import {useEffect,useRef,useState,type RefObject} from 'react';

/** True once the element has come within `margin` of the viewport (latches; never flips back). */
export function useNearViewport<T extends Element>(margin='300px'):[RefObject<T|null>,boolean]{
  const ref=useRef<T>(null),[near,setNear]=useState(false);
  useEffect(()=>{
    const node=ref.current;if(near||!node)return;
    if(typeof IntersectionObserver==='undefined'){setNear(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:margin});
    observer.observe(node);return()=>observer.disconnect();
  },[near,margin]);
  return[ref,near];
}
