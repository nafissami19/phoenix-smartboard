import {ThemeIcon as Icon} from "./ThemeIcon";
import "./SlidesPanel.css";
export function PageBar({pageIndex,pageCount,onAdd,onGo,onToggleThumbs,thumbsOpen,onSwap,onFitToScreen}: {pageIndex:number;pageCount:number;onAdd:()=>void;onGo:(index:number)=>void;onToggleThumbs:()=>void;thumbsOpen:boolean;onSwap:()=>void;onFitToScreen?:()=>void;}) {
  return <nav className="kn-page-navigation pointer-events-auto" aria-label="Page navigation">
    <button type="button" className="kn-focus kn-page-add" onClick={onAdd} aria-label="Add page" title="Add page"><Icon name="plus"/></button>
    <button type="button" className="kn-focus" onClick={()=>onGo(pageIndex-1)} disabled={pageIndex<=0} data-ui="prev-page" aria-label="Previous page" title="Previous page"><Icon name="chevronLeft"/></button>
    <button type="button" className="kn-focus kn-page-counter" onClick={onToggleThumbs} aria-label="Open slides" aria-expanded={thumbsOpen} title="Pages"><Icon name="layers"/><strong>{pageIndex+1} / {pageCount}</strong></button>
    <button type="button" className="kn-focus" onClick={()=>onGo(pageIndex+1)} disabled={pageIndex>=pageCount-1} data-ui="next-page" aria-label="Next page" title="Next page"><Icon name="chevronRight"/></button>
    {onFitToScreen && <button type="button" className="kn-focus" onClick={onFitToScreen} aria-label="Fit slide to screen" title="Fit slide to screen"><Icon name="fit"/></button>}
    <button type="button" className="kn-side-switch kn-focus" onClick={onSwap} data-ui="swap-controls" aria-label="Swap menu and slide controls" title="Swap sides"><Icon name="flipHorizontal"/></button>
  </nav>;
}