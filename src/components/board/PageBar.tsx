import {ThemeIcon as Icon} from "./ThemeIcon";
import "./SlidesPanel.css";
export function PageBar({pageIndex,pageCount,onAdd,onGo,onToggleThumbs,thumbsOpen,onSwap,onApplyViewToAll,onFitToScreen}: {pageIndex:number;pageCount:number;onAdd:()=>void;onGo:(index:number)=>void;onToggleThumbs:()=>void;thumbsOpen:boolean;onSwap:()=>void;onApplyViewToAll?:()=>void;onFitToScreen?:()=>void;}) {
  return <nav className="kn-page-navigation pointer-events-auto" aria-label="Page navigation">
    <button type="button" className="kn-focus kn-page-add" onClick={onAdd} aria-label="Add page" title="Add page"><Icon name="plus"/></button>
    <div className="kn-page-side-group" style={{right:thumbsOpen?'324px':undefined}}>
      <button type="button" className="kn-page-side kn-page-side-prev kn-focus" aria-label="Previous slide" disabled={pageIndex<=0} onClick={()=>onGo(pageIndex-1)}><Icon name="chevronLeft"/></button>
      <button type="button" className="kn-page-side kn-page-side-next kn-focus" aria-label={pageIndex>=pageCount-1?'Create next slide':'Next slide'} onClick={()=>pageIndex>=pageCount-1?onAdd():onGo(pageIndex+1)}><Icon name="chevronRight"/></button>
    </div>
    <button type="button" className="kn-focus" onClick={()=>onGo(pageIndex-1)} disabled={pageIndex<=0} data-ui="prev-page" aria-label="Previous page" title="Previous page"><Icon name="chevronLeft"/></button>
    <button type="button" className="kn-focus kn-page-counter" onClick={onToggleThumbs} aria-label="Open slides" aria-expanded={thumbsOpen} title="Pages"><Icon name="layers"/><strong>{pageIndex+1} / {pageCount}</strong></button>
    <button type="button" className="kn-focus" onClick={()=>onGo(pageIndex+1)} disabled={pageIndex>=pageCount-1} data-ui="next-page" aria-label="Next page" title="Next page"><Icon name="chevronRight"/></button>
    {onFitToScreen && <button type="button" className="kn-focus" onClick={onFitToScreen} aria-label="Fit slide to screen" title="Fit slide to screen"><Icon name="fit"/></button>}
    {onApplyViewToAll && <button type="button" className="kn-focus kn-page-sync" onClick={onApplyViewToAll} aria-label="Apply zoom and alignment to all slides" title="Apply this zoom and alignment to all slides"><Icon name="sync"/></button>}
    <button type="button" className="kn-side-switch kn-focus" onClick={onSwap} data-ui="swap-controls" aria-label="Swap menu and slide controls" title="Swap sides"><Icon name="flipHorizontal"/></button>
  </nav>;
}