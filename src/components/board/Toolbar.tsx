import type {SelectionSettings} from '@/lib/selection-region';
import {SOLIDS,projectedSolid,type SolidKind} from '@/lib/solid-shapes';
import {loadPenMenu,loadCustomPens,PEN_STORE_ITEMS} from '@/lib/brush-presets';
import './CustomPens.css';
import {brushSettings} from '@/lib/brush-presets';
import {interfaceSettings} from '@/lib/interface-settings';
import {Note3Artwork} from './Note3Artwork';
import {CustomSelect} from '@/components/CustomSelect';
import {BrushSizePreview} from './BrushSizePreview';
import {SlideToErase} from './SlideToErase';
import type {EraserMode} from '@/lib/eraser-modes';
import {themeIconSource,type ThemeIconId} from '@/lib/theme-pack';
import {useApp} from '@/lib/app-context';
import {PenIllustration} from './PenIllustration';
import {ToolPopover} from './ToolPopover';
import type {LessonRecorderHandle} from './LessonRecorder';
import {useI18n} from '@/lib/i18n';
"use client";

import { useEffect, useRef, useState } from "react";
import "./ShapePalette.css";
import { Icon, type IconName } from "@/components/Icon";
import {
  HIGHLIGHTER_COLORS,
  LASER_COLORS,
  INK_COLORS,
  type ActiveTool,
  type Pen,
} from "@/lib/constants";

const MAIN_TOOLS: { id: ActiveTool; icon: IconName; label: string }[] = [
  { id: "select", icon: "select", label: "Select" },
  { id: "pan", icon: "hand", label: "Hand" },
  { id: "pen", icon: "pen", label: "Pen" },
  { id: "eraser", icon: "eraser", label: "Eraser" },
  { id: "text", icon: "text", label: "Text" },
];

const SHAPES: { id: ActiveTool; icon: IconName; label: string }[] = [
  {id:"auto-shape",icon:"autoShape",label:"Auto shape"},
  { id: "line", icon: "line", label: "Line" },
  { id: "rect", icon: "rect", label: "Rectangle" },
  { id: "ellipse", icon: "ellipse", label: "Ellipse" },
  { id: "arrow", icon: "arrow", label: "Arrow" },
  { id: "circle", icon: "circle", label: "Circle" },
  { id: "triangle", icon: "triangle", label: "Triangle" },
  { id: "righttriangle", icon: "righttriangle", label: "Right triangle" },
  { id: "diamond", icon: "diamond", label: "Diamond" },
  { id: "parallelogram", icon: "parallelogram", label: "Parallelogram" },
  { id: "trapezoid", icon: "trapezoid", label: "Trapezoid" },
  { id: "pentagon", icon: "pentagon", label: "Pentagon" },
  { id: "hexagon", icon: "hexagon", label: "Hexagon" },
  { id: "star", icon: "star", label: "Star" },
];

export function Toolbar({
  tool,
  setTool,
  pen,
  setPen,
  eraserSize,
  setEraserSize,
  undo,
  redo,
  canUndo,
  canRedo,
  selectionSettings,onSelectionSettings,onAddSolid,onOpenTreasure,eraserMode,onEraserMode,palmEraser,onPalmEraser,dualNibMode,onDualNibMode,onClearAnnotations,onOpenBoardTools,boardToolsActive,recorder,
}: {
  selectionSettings:SelectionSettings;onSelectionSettings:(value:SelectionSettings)=>void;
  onAddSolid:(kind:SolidKind)=>void;
  tool: ActiveTool;
  setTool: (t: ActiveTool) => void;
  pen: Pen;
  setPen: (p: Pen) => void;
  eraserSize: number;
  setEraserSize: (n: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenTreasure?: () => void;eraserMode:EraserMode;onEraserMode:(mode:EraserMode)=>void;palmEraser:boolean;onPalmEraser:(enabled:boolean)=>void;dualNibMode?:boolean;onDualNibMode?:(enabled:boolean)=>void;onClearAnnotations:()=>void;onOpenBoardTools?: () => void;boardToolsActive?: boolean;
  recorder?: LessonRecorderHandle;
}) {
  const { t } = useI18n();
  const [penMenu,setPenMenu]=useState(loadPenMenu),[customPens,setCustomPens]=useState(loadCustomPens);
  useEffect(()=>{const update=()=>{setPenMenu(loadPenMenu());setCustomPens(loadCustomPens());};window.addEventListener('phoenix-pen-store-updated',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('phoenix-pen-store-updated',update);window.removeEventListener('storage',update);};},[]);
  const {profile}=useApp();
  const {toolPopupOnFirstClick}=interfaceSettings(profile.ui);
  const lastToolClick=useRef<string|null>(null);
  const openSettings=(id:string,active:boolean,open:boolean)=>{const show=toolPopupOnFirstClick||(active&&lastToolClick.current===id);lastToolClick.current=id;return show?!(active&&open):false;};
  const brushSizes=useRef<Record<string,number>>((()=>{try{return JSON.parse(localStorage.getItem('phoenix-brush-sizes')??'{}');}catch{return {};}})());
  const chooseBrush=(id:string,nextTool:ActiveTool)=>{
    const old=tool==='pen'?(pen.brush??'normal'):tool;
    brushSizes.current[old]=pen.size;
    const defaults:Record<string,number>={normal:4,pencil:3,paint:16,chinese:12,crayon:12,chalk:14,'oil-pastel':16,'oil-paint':20,highlighter:20,laser:5,stamp:24,calligraphy:8,marker:14,charcoal:16,watercolor:18,airbrush:24,gel:3};
    const saved=brushSizes.current[id];const size=Number.isFinite(saved)?Math.min(40,Math.max(1,saved)):defaults[id]??4;
    try{localStorage.setItem('phoenix-brush-sizes',JSON.stringify(brushSizes.current));}catch{}
    const nextColor = nextTool === 'laser' && (!pen.color || ['#1f2937','#1e1e1e','#000000','#94a3b8'].includes(pen.color.toLowerCase())) ? '#ff1744' : pen.color;
    setTool(nextTool);setPen({...pen,color:nextColor,size,customPenId:undefined,opacity:1,...(nextTool==='pen'?{brush:id as Pen['brush'],brushSettings:brushSettings(id as Pen['brush']),customPenId:undefined,opacity:1}:{})});
  };
  useEffect(()=>{if(tool==='pen'||tool==='highlighter'||tool==='laser'){brushSizes.current[tool==='pen'?(pen.brush??'normal'):tool]=pen.size;try{localStorage.setItem('phoenix-brush-sizes',JSON.stringify(brushSizes.current));}catch{}}},[tool,pen.brush,pen.size]);
  useEffect(()=>{if(tool!=='pen')return;const available=pen.customPenId?customPens.some(p=>p.id===pen.customPenId&&p.enabled!==false):penMenu.includes(pen.brush??'normal');if(!available)setPen({...pen,brush:'normal',brushSettings:brushSettings('normal'),customPenId:undefined,size:4,opacity:1});},[penMenu,customPens,tool,pen.customPenId,pen.brush]);
  const [touchOpen,setTouchOpen]=useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  // moreOpen removed
  const [pinned,setPinned]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem('phoenix-toolbar-pins')??'[]');return Array.isArray(value)?value.filter(id=>['Select','Text','Shapes','Redo','Tools'].includes(id)):[];}catch{return [];}});
  useEffect(()=>{try{localStorage.setItem('phoenix-toolbar-pins',JSON.stringify(pinned));}catch{}},[pinned]);
  const [shapeGroup,setShapeGroup]=useState<"2d"|"3d">("2d");
  const [shapeOpen, setShapeOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const isPen = tool === "pen" || tool === "highlighter" || tool === "marker" || tool === "laser";
  const isShape = SHAPES.some((s) => s.id === tool);

  useEffect(()=>{
    if(!shapeOpen&&!optionsOpen&&!recorderOpen)return;
    const outside=(event:PointerEvent)=>{if(!(event.target as Element).closest('[data-toolbar-surface]')){setShapeOpen(false);setOptionsOpen(false);setRecorderOpen(false);}};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setShapeOpen(false);setOptionsOpen(false);setRecorderOpen(false);}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[shapeOpen,optionsOpen,recorderOpen]);

  return (
    <>
      {tool==='select'&&optionsOpen&&<ToolPopover anchor="Select"><section data-toolbar-surface className="kn-more-tools kn-select-options" aria-label="Selection options"><header><strong>Select</strong><button type="button" aria-label="Close selection options" onClick={()=>setOptionsOpen(false)}><Icon name="close"/></button></header><div className="kn-selection-modes">{([{mode:'rectangle',label:'Square select',icon:'rect'},{mode:'lasso',label:'Custom select',icon:'lasso'}] as const).map(item=><button key={item.mode} type="button" aria-label={item.label} aria-pressed={selectionSettings.mode===item.mode} onClick={()=>onSelectionSettings({...selectionSettings,mode:item.mode})}><Icon name={item.icon}/><span>{item.label}</span></button>)}</div><label className="kn-smart-object"><input type="checkbox" aria-label="Smart object selection" checked={selectionSettings.smart} onChange={e=>onSelectionSettings({...selectionSettings,smart:e.target.checked})}/>Smart object</label><small>{selectionSettings.smart?'Touch part of an object to select it completely.':'Select enclosed ink segments. Enclose shapes, text and documents completely.'}</small></section></ToolPopover>}
      {/* Pen / eraser options floating above the toolbar */}
      {isPen && optionsOpen && (<ToolPopover anchor="Pen">
        <div data-toolbar-surface aria-label="Pen options" className="kn-tool-options kn-pop kn-scroll absolute bottom-24 left-1/2 max-h-[calc(100dvh-168px)] w-[330px] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur">
          <div className="kn-options-heading mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {tool === "highlighter" ? "Highlighter" : tool === "laser" ? "Laser pointer" : "Pen"}
            </span>
            {tool !== "laser" && (<label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={pen.smartShapes}
                onChange={(e) => setPen({ ...pen, smartShapes: e.target.checked })}
                className="accent-brand"
              />
              Smart shapes
            </label>)}
          </div>
          <div className="kn-pen-family" aria-label="Pen type">{PEN_STORE_ITEMS.filter(item=>penMenu.includes(item.id)).map(item=><button key={item.id} type="button" aria-label={item.label.toLowerCase()==='crayon'?'crayon':item.label} aria-pressed={item.tool==='pen'?tool==='pen'&&!pen.customPenId&&(pen.brush??'normal')===item.id:tool===item.tool} onClick={()=>{chooseBrush(item.id,item.tool as ActiveTool);}}><ToolArtwork id={item.id} icon="pen" color={pen.color} palette/><span>{item.label}</span></button>)}</div>
          {tool==='pen'&&pen.brush==='stamp'&&<div className="kn-stamp-options">{(['smile','star','heart','sun'] as const).map(stamp=><button type="button" key={stamp} aria-label={`Stamp ${stamp}`} aria-pressed={(pen.stamp??'smile')===stamp} onClick={()=>setPen({...pen,stamp,size:Math.max(20,pen.size)})}><StampGlyph kind={stamp}/><span>{stamp}</span></button>)}</div>}
          <div className={`mb-3 grid ${tool === "laser" ? "grid-cols-6" : "grid-cols-5"} gap-1.5`}>
            {(tool === "laser" ? LASER_COLORS : tool === "highlighter" ? HIGHLIGHTER_COLORS : INK_COLORS).map((c) => (
              <button
                key={c}
                onClick={() => setPen({ ...pen, color: c })}
                type="button"
                className={`kn-ink-swatch h-11 w-full rounded-md border-2 transition ${
                  pen.color === c ? "scale-110 border-white" : "border-line"
                }`}
                style={{ background: c,minWidth:tool==='laser'?38:44,minHeight:44,width:'100%',boxShadow:tool==='laser'&&pen.color===c?`0 0 14px ${c}`:undefined }}
                aria-label={`color ${c}`}
              />
            ))}
          </div>
<BrushSizePreview size={pen.size} color={pen.color} eraser={false} toolKey={`${tool}-${pen.brush}`}/>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{tool === 'laser' ? 'Beam: ' : 'Size: '}{pen.size}px</span>
            <input
              type="range"
              min={1}
              max={40}
              aria-label="Pen size" value={pen.size}
              onChange={(e) => setPen({ ...pen, size: +e.target.value })}
              className="kn-range flex-1"
            />
            <span
              className="grid h-6 w-6 place-items-center rounded-full"
              style={{ background: pen.color }}
            >
              <span className="block rounded-full bg-black/0" style={{ width: pen.size, height: pen.size }} />
            </span>
          </div>
{tool !== 'laser' && <label className="mt-3 grid gap-2 text-sm">Opacity: {Math.round(pen.opacity*100)}%<input className="kn-range" type="range" aria-label="Pen opacity" min={.05} max={1} step={.05} value={pen.opacity} onChange={e=>setPen({...pen,opacity:+e.target.value})}/></label>}<div className="custom-pen-menu" aria-label="Saved pens">{customPens.filter(p=>p.enabled!==false).map(p=><button key={p.id} type="button" aria-label={`Use pen ${p.name}`} aria-pressed={pen.customPenId===p.id} onClick={()=>{setTool('pen');setPen({...pen,brush:p.brush,brushSettings:{...p.settings},customPenId:p.id,color:p.color,size:p.size,opacity:p.opacity,pressure:p.pressure,smartShapes:false});}}><PenIllustration kind={p.brush} color={p.color}/>{p.name}</button>)}</div>
<label className="mt-3 flex min-h-11 items-center justify-between text-sm">Custom color<input style={{width:44,height:44}} aria-label="Custom ink color" type="color" value={pen.color} onChange={e=>setPen({...pen,color:e.target.value})}/></label><button data-touch-settings className="kn-touch-settings" aria-label="Writing and touch settings" aria-expanded={touchOpen} onClick={()=>setTouchOpen(v=>!v)}>Writing &amp; touch<Icon name="chevronRight"/></button>{touchOpen&&<ToolPopover anchor="Writing and touch settings" selector="[data-touch-settings]"><section data-toolbar-surface className="kn-more-tools" aria-label="Writing and touch"><header><strong>Writing &amp; touch</strong><button aria-label="Close writing and touch" onClick={()=>setTouchOpen(false)}><Icon name="close"/></button></header>          <div className="mb-4 grid gap-3 text-sm">
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Enable palm eraser" checked={palmEraser} onChange={e=>onPalmEraser(e.target.checked)}/>Palm eraser</label>
            {onDualNibMode && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Dual-nib smartboard pen" checked={dualNibMode ?? false} onChange={e=>onDualNibMode(e.target.checked)}/>Dual-nib smartboard pen</label>}
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={pen.pressure !== false} onChange={e=>setPen({...pen,pressure:e.target.checked})}/> Pen pressure</label>
            <label className="grid gap-2">Stylus side button<CustomSelect aria-label="Stylus side button" value={pen.barrelButton??'eraser'} onChange={e=>setPen({...pen,barrelButton:e.target.value as Pen['barrelButton']})}><option value="eraser">Temporary eraser</option><option value="pan">Temporary hand</option><option value="none">Ignore</option></CustomSelect></label><label className="grid gap-2">Touch <CustomSelect className="w-full" style={{minHeight:44}} aria-label="Touch behavior" value={pen.touchMode ?? 'draw'} onChange={e=>setPen({...pen,touchMode:e.target.value as Pen['touchMode']})}><option value="draw">Finger drawing</option><option value="pan">Finger pans</option><option value="reject">Pen only / reject touch</option></CustomSelect></label>
            <label className="grid gap-2">Two fingers <CustomSelect className="w-full" style={{minHeight:44}} aria-label="Two finger gesture" value={pen.gestureMode??'pan-zoom'} onChange={e=>setPen({...pen,gestureMode:e.target.value as Pen['gestureMode']})}><option value="pan-zoom">Pan + pinch zoom</option><option value="pan">Pan only</option><option value="off">Ignore second touch</option></CustomSelect></label>
          </div>
</section></ToolPopover>}
        </div></ToolPopover>
      )}

      {tool === "eraser" && optionsOpen && (<ToolPopover anchor="Eraser">
        <div data-toolbar-surface aria-label="Eraser options" className="kn-tool-options kn-pop kn-scroll absolute bottom-24 left-1/2 max-h-[calc(100dvh-168px)] w-[260px] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur">
          <div className="kn-eraser-modes" aria-label="Eraser modes">{[
            {id:'ink',label:'Custom eraser',icon:'eraser'},
            {id:'selection',label:'Selection eraser',icon:'selectionEraser'},
            {id:'object',label:'Smart object eraser',icon:'objectEraser'},
            {id:'all',label:'Slide to erase',icon:'clearAnnotations'},
          ].map(mode=><button type="button" key={mode.id} aria-label={mode.label} title={mode.label} aria-pressed={eraserMode===mode.id} onClick={()=>onEraserMode(mode.id as EraserMode)}><Icon name={mode.icon as IconName}/></button>)}</div>
          {eraserMode==='all'&&<SlideToErase onErase={onClearAnnotations}/>}
          <button className="kn-palm-toggle" role="switch" aria-label="Palm eraser" title="Palm eraser" aria-checked={palmEraser} onClick={()=>onPalmEraser(!palmEraser)}><Icon name="hand"/><span className="kn-switch" aria-hidden="true"><span/></span></button>
          <BrushSizePreview size={eraserSize} color={pen.color} eraser={true} toolKey={`eraser-${eraserMode}`}/>
          {(eraserMode==='ink'||eraserMode==='object')&&<>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={8}
              max={160}
              aria-label="Eraser size"
              value={eraserSize}
              onChange={(e) => setEraserSize(+e.target.value)}
              className="kn-range flex-1"
            />
            <output className="text-sm tabular-nums text-ink" aria-label="Eraser size in pixels">{eraserSize}</output>
          </div></>}
        </div></ToolPopover>
      )}

      {recorderOpen && recorder && (
        <ToolPopover anchor="Record" selector='.kn-main-tools button[data-tool-id="record"]'>
          <div
            data-toolbar-surface
            aria-label="Lesson recording"
            className="kn-tool-options kn-pop kn-scroll absolute bottom-24 left-1/2 w-[310px] max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-2xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    recorder.state === "recording"
                      ? "bg-red-500 animate-pulse"
                      : recorder.state === "paused"
                      ? "bg-amber-400"
                      : "bg-muted"
                  }`}
                />
                <strong className="text-sm font-semibold text-ink">Lesson Recording</strong>
              </div>
              <button
                type="button"
                style={{ minWidth: 36, minHeight: 36 }}
                aria-label="Close recording options"
                onClick={() => setRecorderOpen(false)}
                className="kn-focus grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink transition-colors"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            {recorder.state === "idle" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  Captures the 1080p slide worksheet and your voice synchronously. Zooming or panning the canvas will not shake or distort the recording.
                </p>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface/50 p-2.5">
                  <span className="text-xs font-medium text-ink">Microphone Audio</span>
                  <button
                    type="button"
                    onClick={() => recorder.setMicEnabled((prev) => !prev)}
                    aria-label={recorder.micEnabled ? "Microphone enabled (click to mute)" : "Microphone disabled (click to enable)"}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      recorder.micEnabled ? "bg-brand/20 text-brand-light" : "bg-elevated text-muted line-through"
                    }`}
                  >
                    <Icon name={recorder.micEnabled ? "mic" : "micOff"} className="h-3.5 w-3.5" />
                    <span>{recorder.micEnabled ? "MIC ON" : "MIC OFF"}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void recorder.start()}
                  className="kn-focus flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-500 transition-colors"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white shadow-sm animate-pulse" />
                  <span>Start Recording</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface/50 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        recorder.state === "recording" ? "bg-red-500 animate-ping" : "bg-amber-400"
                      }`}
                    />
                    <span className="font-mono text-base font-bold tabular-nums text-ink">
                      {recorder.formatTimer(recorder.seconds)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted uppercase">
                    {recorder.state === "recording" ? "Recording Slide" : "Paused"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={recorder.pauseResume}
                    aria-label={recorder.state === "recording" ? "Pause recording" : "Resume recording"}
                    className="kn-focus flex items-center justify-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold text-ink hover:bg-surface transition-colors"
                  >
                    <Icon name={recorder.state === "recording" ? "pause" : "play"} className="h-4 w-4" />
                    <span>{recorder.state === "recording" ? "Pause" : "Resume"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      recorder.stop();
                      setRecorderOpen(false);
                    }}
                    aria-label="Stop recording and download"
                    className="kn-focus flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-red-500 transition-colors"
                  >
                    <span className="h-2 w-2 rounded-sm bg-white" />
                    <span>Done &amp; Save</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </ToolPopover>
      )}

      <div data-toolbar-surface style={{ '--active-ink': pen.color } as React.CSSProperties} className="kn-main-tools pointer-events-auto flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-center gap-1 rounded-2xl border border-line bg-panel/95 p-1.5 shadow-2xl backdrop-blur">
        {MAIN_TOOLS.filter(tItem=>tItem.id!=="pan"&&tItem.id!=="text").map((tItem) => (
          <ToolButton
            key={tItem.id}
            active={tItem.id==="pen"?isPen:tool === tItem.id}
            onClick={() => { setShapeOpen(false);setTouchOpen(false);setRecorderOpen(false);setOptionsOpen((tItem.id==="pen"||tItem.id==="eraser"||tItem.id==="select")?openSettings(tItem.id,tItem.id==="pen"?isPen:tool===tItem.id,optionsOpen):false);if(tItem.id!=="pen"||!isPen)setTool(tItem.id); }}
            secondary={tItem.id==="select"||tItem.id==="text"} pinned={pinned.includes(tItem.label)} art={tItem.id==="pen"?(tool==="laser"?"laser":tool==="highlighter"?"highlighter":pen.brush??"normal"):undefined} color={pen.color}
            icon={tItem.icon}
            label={t(tItem.id, tItem.label)}
          />
        ))}

        {/* Shapes popover */}
        <div className={`relative kn-responsive-secondary ${pinned.includes("Shapes")?"kn-pinned":""}`}>
          <ToolButton
            active={isShape}
            onClick={() => {setShapeOpen(openSettings('shapes',isShape,shapeOpen));if(!isShape)setTool('auto-shape');setOptionsOpen(false);setTouchOpen(false);setRecorderOpen(false);}}
            icon="shapes"
            label={t("shapes", "Shapes")}
          />
          {shapeOpen && (<ToolPopover anchor="Shapes">
            <section className="kn-shape-palette kn-pop" aria-label="Shape palette">
              <header><strong>{t("shapes", "Shapes")}</strong><button type="button" style={{minWidth:44,minHeight:44}} aria-label="Close shape palette" onClick={()=>setShapeOpen(false)}><Icon name="close"/></button></header>
              <div className="kn-shape-tabs" role="tablist" aria-label="Shape groups">{(['2d','3d'] as const).map(group=><button type="button" role="tab" key={group} aria-selected={shapeGroup===group} onClick={()=>setShapeGroup(group)}>{group.toUpperCase()} shapes</button>)}</div>
              <div className="kn-shape-groups" onTouchStart={e=>{e.currentTarget.dataset.swipeX=String(e.touches[0].clientX);}} onTouchEnd={e=>{const dx=e.changedTouches[0].clientX-Number(e.currentTarget.dataset.swipeX);if(Math.abs(dx)>55)setShapeGroup(dx<0?'3d':'2d');}}><div className="kn-shape-grid">
                {shapeGroup==='2d'?SHAPES.map(s=><button type="button" key={s.id} aria-label={s.label} aria-pressed={tool===s.id} title={s.label} onClick={()=>setTool(s.id)} className={tool===s.id?'is-active':''}><Icon name={s.icon}/><span>{s.label}</span></button>):SOLIDS.map(kind=><button type="button" key={kind} aria-label={`Add 3D ${kind}`} onClick={()=>{onAddSolid(kind);setShapeOpen(false);}}><SolidIcon kind={kind}/><span>{kind.replaceAll('-',' ')}</span></button>)}
              </div></div>
              <div className="kn-shape-properties">
                <label>Stroke <input type="color" aria-label="Shape stroke color" value={pen.color} onChange={e=>setPen({...pen,color:e.target.value})}/></label>
                <label>Fill <input type="checkbox" aria-label="Fill shapes" checked={pen.shapeFill??false} onChange={e=>setPen({...pen,shapeFill:e.target.checked})}/><input type="color" aria-label="Shape fill color" disabled={!pen.shapeFill} value={pen.shapeFillColor??pen.color} onChange={e=>setPen({...pen,shapeFillColor:e.target.value})}/></label>
                <label className="kn-shape-width">Width <input type="range" min="1" max="24" aria-label="Shape stroke width" value={pen.shapeWidth??pen.size} onChange={e=>setPen({...pen,shapeWidth:+e.target.value})}/><output>{pen.shapeWidth??pen.size}px</output></label>
                <label className="kn-shape-style">Line <CustomSelect aria-label="Shape line style" value={pen.shapeDash??'solid'} onChange={e=>setPen({...pen,shapeDash:e.target.value as Pen['shapeDash']})}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></CustomSelect></label>
                <label className="kn-shape-style">Fill style <CustomSelect aria-label="Shape fill style" disabled={!pen.shapeFill} value={pen.shapeFillStyle??'solid'} onChange={e=>setPen({...pen,shapeFillStyle:e.target.value as Pen['shapeFillStyle']})}><option value="solid">Solid</option><option value="hachure">Hatched</option><option value="crosshatch">Crosshatched</option></CustomSelect></label>
                <label className="kn-shape-width">Corners <input type="range" min="0" max="48" aria-label="Rectangle corner radius" value={pen.shapeRoundness??0} onChange={e=>setPen({...pen,shapeRoundness:Number(e.target.value)})}/><output>{pen.shapeRoundness??0}px</output></label>
              </div>
            </section></ToolPopover>
          )}
        </div>

        <ToolButton active={tool==='pan'} onClick={()=>{lastToolClick.current='pan';setTool('pan');setOptionsOpen(false);setShapeOpen(false);setRecorderOpen(false);}} icon="hand" label={t("pan", "Hand")}/>
        <ToolButton active={tool==='text'} secondary pinned={pinned.includes('Text')} onClick={()=>{lastToolClick.current='text';setOptionsOpen(false);setTool('text');setShapeOpen(false);setRecorderOpen(false);}} icon="text" label={t("text", "Text")}/>

        <div className="mx-1 h-8 w-px bg-line" />

        <ToolButton onClick={undo} icon="undo" label={t("undo", "Undo")} disabled={!canUndo} />
        <ToolButton secondary pinned={pinned.includes("Redo")} onClick={redo} icon="redo" label={t("redo", "Redo")} disabled={!canRedo} />

        <div className="mx-1 h-8 w-px bg-line" />
        <ToolButton active={boardToolsActive} onClick={()=>{setOptionsOpen(false);setShapeOpen(false);setRecorderOpen(false);onOpenBoardTools?.();}} icon="board" label={t("board_tools", "Board & tools")}/>
        {recorder && (
          <ToolButton
            dataToolId="record"
            active={recorder.state === "recording" || recorder.state === "paused" || recorderOpen}
            onClick={() => {
              setOptionsOpen(false);
              setShapeOpen(false);
              setTouchOpen(false);
              setRecorderOpen((prev) => !prev);
            }}
            icon="record"
            label={recorder.state === "recording" ? `${t("record", "Recording")} (${recorder.formatTimer(recorder.seconds)})` : t("record", "Record")}
            color={recorder.state === "recording" ? "#ef4444" : undefined}
          />
        )}
      </div>

    </>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  disabled,
  art,
  color,
  secondary,
  pinned,
  dataToolId,
}: {
  dataToolId?: string;
  art?: string;
  color?: string;
  secondary?: boolean;
  pinned?: boolean;
  active?: boolean;
  onClick: () => void;
  icon: IconName;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-tool-id={dataToolId}
      style={{ minWidth: 44, minHeight: 44, ...(active && color ? { "--active-ink": color } : {}) } as React.CSSProperties}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`${secondary ? "kn-responsive-secondary" : ""} ${pinned ? "kn-pinned" : ""} kn-focus relative grid h-11 w-11 place-items-center rounded-xl transition disabled:opacity-30 ${
        active
          ? dataToolId === "record"
            ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
            : "bg-brand text-white shadow-lg"
          : "text-muted hover:bg-elevated hover:text-ink"
      }`}
    >
      <ToolArtwork id={art ?? (icon === "hand" ? "hand" : icon === "toolbox" ? "tools" : icon)} icon={icon} color={color} />
      {dataToolId === "record" && active && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white shadow-sm animate-ping" />
      )}
    </button>
  );
}

function ToolArtwork({id,icon,color,palette=false}:{id:string;icon:IconName;color?:string;palette?:boolean}){const {profile}=useApp();const key=id==='normal'?'pen':id;const source=(palette?themeIconSource(profile.theme,`${key}Preview` as ThemeIconId):undefined)??themeIconSource(profile.theme,key as ThemeIconId);if(source)return <img alt="" className="kn-theme-tool-image" src={source}/>;if(profile.theme?.appearance==='org-note3'&&!['chalk','oil-pastel','oil-paint','calligraphy','marker','charcoal','watercolor','airbrush','gel'].includes(id))return <Note3Artwork name={key}/>;if(['normal','pen','pencil','paint','chinese','crayon','chalk','oil-pastel','oil-paint','highlighter','laser','stamp','calligraphy','marker','charcoal','watercolor','airbrush','gel'].includes(id))return <PenIllustration kind={id} color={color}/>;return <Icon name={icon} className="h-5 w-5"/>;}
function StampGlyph({kind}:{kind:string}){return <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">{kind==='star'?<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>:kind==='heart'?<path d="M12 21C-5 10 5-1 12 7c7-8 17 3 0 14z"/>:<><circle cx="12" cy="12" r="8"/>{kind==='smile'?<><path d="M8 10h1m6 0h1M8 14q4 5 8 0"/></>:<path d="M12 0v3m0 18v3M0 12h3m18 0h3M3 3l2 2m14 14 2 2M3 21l2-2M19 5l2-2"/>}</>}</svg>;}

function SolidIcon({kind}:{kind:SolidKind}){const {vertices,faces}=projectedSolid({kind,yaw:30,pitch:-20,roll:0,wireframe:false});return <svg viewBox="-2 -2 4 4" fill="none" stroke="currentColor" strokeWidth=".06" aria-hidden="true">{faces.map((face,i)=><polygon key={i} points={face.indices.map(j=>`${vertices[j].x},${vertices[j].y}`).join(' ')} fill="var(--color-panel)"/>)}</svg>;}
