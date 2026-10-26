import {useApp} from '@/lib/app-context';
import {interfaceSettings,type InterfaceSettings} from '@/lib/interface-settings';
import {useEffect,useRef,useState} from 'react';
import {Icon} from '@/components/Icon';

export function TeachingControls({layout,onLayout,onCustomize}:{
  layout:'bottom'|'top'|'left'|'right';onLayout:(value:'bottom'|'top'|'left'|'right')=>void;
  onCustomize:()=>void;
}) {
  const {profile,updateProfile}=useApp();const ui=interfaceSettings(profile.ui);
  const update=(key:keyof InterfaceSettings,value:boolean)=>{void updateProfile({ui:{...ui,[key]:value}});};
  const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="teaching-controls" ref={ref}>
    <button aria-label="Teaching controls" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="settings" className="h-5 w-5"/></button>
    {open&&<section className="teaching-options kn-pop" aria-label="Teaching controls options">
      <strong>Teaching controls</strong>
      <button type="button" onClick={()=>{setOpen(false);onCustomize();}}>Customize all controls</button>
      
      <fieldset className="kn-visible-controls"><legend>Show controls</legend>{[{id:'showFullscreen',label:'Fullscreen'},{id:'showCustomize',label:'Tool editor'},{id:'showTime',label:'Time'},{id:'showSlideControls',label:'Slide navigation'},{id:'showMenu',label:'Main menu'},{id:'showToolbar',label:'Drawing tools'}].map(item=><label key={item.id}><input type="checkbox" aria-label={`Show ${item.label}`} checked={ui[item.id as keyof InterfaceSettings] as boolean} onChange={event=>update(item.id as keyof InterfaceSettings,event.target.checked)}/>{item.label}</label>)}</fieldset>
      <button onClick={()=>setOpen(false)}>Done</button>
    </section>}
  </div>;
}
