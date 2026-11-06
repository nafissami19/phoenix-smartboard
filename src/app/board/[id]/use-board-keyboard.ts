import {useEffect,useRef} from 'react';
import type {ActiveTool} from '@/lib/constants';
import type {Selection} from '@/lib/use-whiteboard';

export type BoardKeyboardState={
  board:{undo:()=>void;redo:()=>void;selection:Selection;deleteSelected:()=>void;setSelection:(next:Selection)=>void;setTool:(tool:ActiveTool)=>void};
  panelOpen:boolean;closePanel:()=>void;
  save:()=>Promise<void>;push:(message:string,tone?:'info'|'error'|'success')=>void;
  goTo:(index:number)=>Promise<void>;index:number;
};

const TOOL_KEYS:Record<string,ActiveTool>={v:'select',p:'pen',h:'highlighter',e:'eraser',l:'laser',t:'text'};

/** Board shortcuts. The window listener is registered once; handlers read the latest state from a ref. */
export function useBoardKeyboard(state:BoardKeyboardState){
  const latest=useRef(state);latest.current=state;
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const {board,panelOpen,closePanel,save,push,goTo,index}=latest.current;
      const target=e.target as HTMLElement;
      const typing=!!target.closest?.('input, textarea, select, [role=combobox], [role=listbox], [contenteditable]:not([contenteditable="false"])');
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
        e.preventDefault();
        void save().catch(()=>push('Autosave failed. Your edits are still in memory. Free storage and try again.','error'));
        return;
      }
      if(e.defaultPrevented||typing||document.querySelector('dialog[open]'))return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)board.redo();else board.undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();board.redo();return;}
      if(e.key==='Delete'||e.key==='Backspace'){if(board.selection){e.preventDefault();board.deleteSelected();}return;}
      if(e.key==='Escape'){if(panelOpen)closePanel();else board.setSelection(null);return;}
      if(e.key==='PageDown'||e.key==='PageUp'){
        e.preventDefault();void goTo(index+(e.key==='PageDown'?1:-1)).catch(()=>push('Could not save your edits.','error'));return;
      }
      const tool=TOOL_KEYS[e.key.toLowerCase()];
      if(tool)board.setTool(tool);
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);
}
