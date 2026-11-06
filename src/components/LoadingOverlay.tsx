import {useState} from 'react';

/**
 * Blocking operation feedback. `progress` (0..1) renders a determinate bar; omit it for an indeterminate one.
 * Pass `onCancel` only where the operation can really stop (e.g. between files/pages).
 */
export function LoadingOverlay({detail,progress,onCancel,cancelLabel='Cancel'}:{detail?:string;progress?:number|null;onCancel?:()=>void;cancelLabel?:string}){
  const [cancelling,setCancelling]=useState(false);
  const known=typeof progress==='number'&&Number.isFinite(progress),value=known?Math.max(0,Math.min(1,progress)):undefined;
  return <div className="kn-operation-loading" role="status" aria-live="polite" aria-busy="true"><div>
    <span className="kn-loading-spinner" aria-hidden="true"/><strong>Please wait</strong>{detail&&<small>{detail}</small>}
    {/* No value attribute = indeterminate progress bar. */}
    <progress className="h-2 w-64 max-w-full accent-brand" aria-label={detail||'Working'} max={1} {...(known?{value}:{})}/>
    {known&&<small className="tabular-nums text-muted" aria-hidden="true">{Math.round(value!*100)}%</small>}
    {onCancel&&<button type="button" disabled={cancelling} onClick={()=>{setCancelling(true);onCancel();}} className="kn-focus min-h-11 rounded-lg border border-line bg-panel px-5 text-sm font-semibold text-ink hover:bg-elevated disabled:opacity-60" style={{cursor:'pointer'}}>{cancelling?'Cancelling…':cancelLabel}</button>}
  </div></div>;
}
