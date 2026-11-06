export type DockEdge='auto'|'bottom'|'top'|'left'|'right';
/** Board-chrome size. 'auto' leaves --ui-scale to CSS (grows on very wide panels); a number pins it. */
export const UI_SCALES=[1,1.25,1.5,1.75] as const;
export type UiScale='auto'|typeof UI_SCALES[number];
export function parseUiScale(value:unknown):UiScale{const n=typeof value==='string'&&value.trim()!==''?Number(value):value;return UI_SCALES.find(scale=>scale===n)??'auto';}
/** Apply on start and whenever the setting changes. Auto removes the inline override so CSS media queries decide. */
export function applyUiScale(scale:UiScale,root:{style:Pick<CSSStyleDeclaration,'setProperty'|'removeProperty'>}|undefined=typeof document==='undefined'?undefined:document.documentElement){
 if(!root)return;if(scale==='auto')root.style.removeProperty('--ui-scale');else root.style.setProperty('--ui-scale',String(scale));
 if(typeof window!=='undefined')window.dispatchEvent(new Event('phoenix-popup-layout'));
}
export type InterfaceSettings={uiScale:UiScale;menuEdge:DockEdge;slidesEdge:DockEdge;showFullscreen:boolean;showCustomize:boolean;showTime:boolean;showSlideControls:boolean;showMenu:boolean;showToolbar:boolean;flipToolsOnSwap:boolean;flipMenuOnSwap:boolean;toolPopupOnFirstClick:boolean;popupGap:number};
export function interfaceSettings(value:unknown):InterfaceSettings{
 const input=value&&typeof value==='object'?value as Partial<InterfaceSettings>:{};
 const edge=(v:unknown):DockEdge=>["bottom","top","left","right"].includes(String(v))?v as DockEdge:"auto";
 return{uiScale:parseUiScale(input.uiScale),menuEdge:edge(input.menuEdge),slidesEdge:edge(input.slidesEdge),toolPopupOnFirstClick:input.toolPopupOnFirstClick===true,showFullscreen:input.showFullscreen!==false,showCustomize:input.showCustomize!==false,showTime:input.showTime!==false,showSlideControls:input.showSlideControls!==false,showMenu:input.showMenu!==false,showToolbar:input.showToolbar!==false,flipToolsOnSwap:input.flipMenuOnSwap!==false,flipMenuOnSwap:input.flipMenuOnSwap!==false,popupGap:typeof input.popupGap==='number'&&Number.isFinite(input.popupGap)?Math.max(0,Math.min(64,input.popupGap)):0};
}
