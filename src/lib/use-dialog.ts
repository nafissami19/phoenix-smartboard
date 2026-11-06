import {useEffect,useRef,type RefObject} from 'react';

const FOCUSABLE='a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';
/** Visible, enabled, tabbable descendants in DOM order. */
export function focusableIn(root:HTMLElement){return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el=>!el.closest('[inert],[hidden],[aria-hidden="true"]')&&el.getClientRects().length>0);}

/** Open modal dialogs, newest last: only the top one handles Escape and traps Tab. */
const modalStack:object[]=[];

export type DialogOptions<T extends HTMLElement>={
  open?:boolean;onClose?:()=>void;
  /** Modal: traps Tab and closes on Escape from anywhere. Non-modal: Escape only when focus is inside. */
  modal?:boolean;
  /** Where focus goes on open: first focusable (default), the container itself, or nowhere. A function decides at open time. */
  initialFocus?:'first'|'container'|false|(()=>'first'|'container'|false);
  /** Escape handling; false leaves it to the caller. */
  escape?:boolean;
  restoreFocus?:boolean;
  ref?:RefObject<T|null>;
};

/**
 * Dialog focus management: moves focus into the container on open, traps Tab (modal), closes on Escape
 * and returns focus to the previously focused element on close (only if focus is still inside / was lost).
 */
export function useDialog<T extends HTMLElement=HTMLDivElement>({open=true,onClose,modal=true,initialFocus='first',escape=true,restoreFocus=true,ref:external}:DialogOptions<T>={}):RefObject<T|null>{
  const own=useRef<T>(null),ref=external??own,close=useRef(onClose),focusMode=useRef(initialFocus);
  useEffect(()=>{close.current=onClose;focusMode.current=initialFocus;});
  useEffect(()=>{
    const root=ref.current;if(!open||!root)return;
    const token={},previous=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;
    if(modal)modalStack.push(token);
    const mode=typeof focusMode.current==='function'?focusMode.current():focusMode.current;
    if(mode&&!root.contains(document.activeElement)){
      const target=mode==='container'?root:(root.querySelector<HTMLElement>('[data-autofocus]')??focusableIn(root)[0]??root);
      if(target===root&&!root.hasAttribute('tabindex'))root.tabIndex=-1;
      target.focus({preventScroll:true});
    }
    const top=()=>modalStack[modalStack.length-1]===token;
    const onKey=(event:KeyboardEvent)=>{
      if(event.isComposing)return;
      const inside=root.contains(event.target as Node);
      if(event.key==='Escape'&&escape&&!event.defaultPrevented&&(modal?top():inside)){event.preventDefault();close.current?.();return;}
      if(event.key!=='Tab'||!modal||!top())return;
      const items=focusableIn(root),active=document.activeElement;
      if(!items.length){event.preventDefault();if(!root.hasAttribute('tabindex'))root.tabIndex=-1;root.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&(active===first||active===root||!root.contains(active))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(active===last||!root.contains(active))){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',onKey);
    return()=>{
      document.removeEventListener('keydown',onKey);const index=modalStack.indexOf(token);if(index>=0)modalStack.splice(index,1);
      const active=document.activeElement;
      if(restoreFocus&&previous?.isConnected&&(!active||active===document.body||!active.isConnected||root.contains(active)))previous.focus({preventScroll:true});
    };
  },[open,modal,escape,restoreFocus,ref]);
  return ref;
}
