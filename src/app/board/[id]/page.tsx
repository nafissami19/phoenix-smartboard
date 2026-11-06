import {getPerformanceProfile} from '@/lib/performance';
import {notifyPreferencesChanged} from '@/lib/preferences';
import {BRANDING} from '@/config/branding';
import {InsertSpecialObject,SpecialObjectsLayer} from '@/components/board/SpecialObjects';
import {createSolid,isSolid,type SolidKind} from '@/lib/solid-shapes';
import {SolidControls} from '@/components/board/SolidControls';
import {BoardChemistryLayer,EquipmentControls} from '@/components/board/BoardChemistry';
import {createEquipment,isEquipment,VESSELS,type Vessel} from '@/lib/chemistry-equipment';
import {MenuScreenContext} from '@/components/board/MenuScreen';
import {warmPdfPages} from '@/lib/media';
import {checkpoint,acknowledge,lastWorkActivity,setWorkActivity,unfinishedEdits,recordSession,finishSession,savedPageView,savedLessonDefaultView,saveLessonDefaultView,savedLessonDefaultFrame,saveLessonDefaultFrame,applyViewToAllPages,isViewSyncEnabled,setViewSyncEnabled,type EditCheckpoint,type PageEdit} from '@/lib/work-journal';
import {LoadingOverlay} from '@/components/LoadingOverlay';
import {interfaceSettings} from '@/lib/interface-settings';
import {newPageStyle} from '@/lib/new-page-style';
import {BoardTooltips} from '@/components/board/BoardTooltips';
import {persistentObjects} from '@/lib/pen-strokes';
import {ThemeSettings} from '@/components/ThemeSettings';
import {controlContrast,controlPalette,BUILTIN_THEMES} from '@/lib/theme-pack';
import {ControlLayoutEditor} from '@/components/board/ControlLayoutEditor';
import {TeachingPreferences} from '@/components/TeachingPreferences';
import {useLessonRecorder} from '@/components/board/LessonRecorder';
import {ExamTimerModal} from '@/components/exam/ExamTimerModal';

import { LocalAssistant } from "@/components/board/LocalAssistant";
import { ResizeHandles } from "@/components/board/ResizeHandles";
import { GeometryOverlay } from "@/components/board/GeometryOverlay";

import { exportLessonPDF, type PDFScope, type ExportProgress } from "@/lib/lesson-export";
import { SubjectTools, type SubjectTool } from "@/components/board/SubjectTools";
import { exportLesson } from "@/lib/lesson-bundle";
import { fileToBase64, uid } from "@/lib/constants";
import { localRequest } from "@/lib/local-store";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "@/lib/navigation";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/lib/toast";
import { useWhiteboard } from "@/lib/use-whiteboard";
import { Icon } from "@/components/Icon";
import { BrandMark } from '@/components/BrandMark';
import { LeftDock, FileMenu, type DockId } from "@/components/board/LeftDock";
import { TreasureBox } from "@/components/board/TreasureBox";
import { Toolbar } from "@/components/board/Toolbar";
import { PageBar } from "@/components/board/PageBar";
import { SlidesPanel } from "@/components/board/SlidesPanel";
import { SelectionBar } from "@/components/board/SelectionBar";
import { SettingsPanel, HelpPanel, AboutPanel, Modal as Dialog } from "@/components/board/Panels";
import { ImportPanel } from "@/components/board/ImportPanel";
import { ExportPanel, download } from "@/components/board/ExportPanel";
import { FloatingWindow } from "@/components/board/FloatingWindow";
import { ReferencePin } from "@/components/board/ReferencePin";
import { SolutionBlind } from "@/components/board/SolutionBlind";
import { NoiseMeter, SpotlightDimmer } from "@/components/board/ClassroomTools";
import {
  AnalogClock,
  Calculator,
  CountdownTimer,
  MagnifierOverlay,
  SpotlightOverlay,
  Stopwatch,
  useNow,
} from "@/components/board/Tools";
import {FLOATING_TOOLS, type FloatingToolId, type MediaItem } from "@/lib/constants";
import type { Notebook, Page } from "@/db/schema";
import { useI18n } from "@/lib/i18n";
import { usePrint } from "./use-print";
import { useViewPersistence } from "./use-view-persistence";
import { useBoardKeyboard } from "./use-board-keyboard";
import { BoardLoadState } from "./BoardLoadState";

type Modal = "special" | "settings" | "help" | "about" | "import" | "export" | "board-tools" | "exam-timer" | null;

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const { profile,updateProfile } = useApp();
  const { push } = useToast();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState<string|null>(null);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const { t } = useI18n();
  const pagesRef=useRef(pages);pagesRef.current=pages;
  const [background, setBackground] = useState("#18212b");
  const [pageImage,setPageImage]=useState<string|undefined>();
  const pageImageRef=useRef(pageImage);pageImageRef.current=pageImage;
  const [pattern, setPattern] = useState("dots");
  const [panel, setPanel] = useState<DockId | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [chemistryDose,setChemistryDose]=useState(25);
  const [openTools,setOpenTools]=useState<Set<FloatingToolId>>(()=>{try{const stored=JSON.parse(localStorage.getItem('phoenix-open-tools')??'[]');return new Set(Array.isArray(stored)?stored.filter(id=>id!=='screenshot'&&FLOATING_TOOLS.some(t=>t.id===id)):[]);}catch{return new Set();}});
  useEffect(()=>{try{localStorage.setItem('phoenix-open-tools',JSON.stringify([...openTools].filter(id=>id!=='screenshot')));}catch{}},[openTools]);
  const [thumbsOpen, setThumbsOpen] = useState(()=>window.innerWidth>=1000);
  const [presenting, setPresenting] = useState(false);
  const [slidesSide,setSlidesSide]=useState<'left'|'right'>(()=>{try{return localStorage.getItem('phoenix-slides-side')==='left'?'left':'right';}catch{return 'right';}});
  useEffect(()=>{try{localStorage.setItem('phoenix-slides-side',slidesSide);window.dispatchEvent(new Event('phoenix-popup-layout'));}catch{}},[slidesSide]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [operation,setOperation]=useState<string|null>(null);
  const [textValue, setTextValue] = useState("");
  const [toolbarLayout]=useState<'bottom'|'top'|'left'|'right'>(()=>{try{const s=localStorage.getItem('phoenix-toolbar-layout');return ['bottom','top','left','right'].includes(s||'')?(s as any):'left';}catch{return 'left';}});
  useEffect(()=>{try{localStorage.setItem('phoenix-toolbar-layout',toolbarLayout);notifyPreferencesChanged();window.dispatchEvent(new Event('phoenix-popup-layout'));}catch{/* Layout remains usable when storage is unavailable. */}},[toolbarLayout]);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const [subjectTool, setSubjectTool] = useState<SubjectTool | null>(null);

  const pageIdRef = useRef<string | null>(null);
  const addingPage=useRef(false);
  const navigatingPage=useRef(false);
  const frameRef=useRef<Page['importFrame']>(undefined);
  const bgRef = useRef(background);
  const patternRef = useRef(pattern);
  bgRef.current = background;
  patternRef.current = pattern;
  const pendingRef = useRef<EditCheckpoint | null>(null);
  const saveQueue=useRef<Promise<void>>(Promise.resolve());
  const [lastActivity,setLastActivity]=useState<string|undefined>();
  useEffect(()=>{if(operation)void setWorkActivity(id,operation).catch(()=>{});},[operation,id]);
  const [recoveryEdits,setRecoveryEdits]=useState<EditCheckpoint[]>([]);
  const [slowSave,setSlowSave]=useState(false);
  const [boardDragging, setBoardDragging] = useState(false);
  const boardDragCounter = useRef(0);
  useEffect(()=>{if(saveState!=='saving'){setSlowSave(false);return;}const timer=setTimeout(()=>setSlowSave(true),500);return()=>clearTimeout(timer);},[saveState]);
  const saveTimer = useRef<number | null>(null);

  const currentPage = pages[index] ?? null;

  // ------------------------------ persistence ------------------------------

  const captureEdit=useCallback((objects:Page['objects'],media:MediaItem[],bg:string,pat:string):EditCheckpoint|null=>{
    const pageId=pageIdRef.current;if(!pageId)return null;
    return {pageId,lessonId:id,revision:crypto.randomUUID(),savedAt:Date.now(),partial:false,edit:structuredClone({objects:persistentObjects(objects),media,background:bg,pattern:pat,backgroundImage:pageImageRef.current??'',importFrame:frameRef.current})};
  },[id]);
  const saveNow = useCallback((objects:Page['objects'],media:MediaItem[],bg:string,pat:string,entry?:EditCheckpoint)=>{
    const snapshot=entry??captureEdit(objects,media,bg,pat);if(!snapshot)return Promise.resolve();
    const staged=entry?Promise.resolve():checkpoint(snapshot,{detached:true});
    setSaveState('saving');
    const run=saveQueue.current.catch(()=>{}).then(async()=>{
      await staged.catch(()=>{});
      try{
        const response=await localRequest(`/api/pages/${snapshot.pageId}`,{method:'PUT',body:JSON.stringify(snapshot.edit)});
        if(!response.ok)throw new Error('Save failed');
        await acknowledge(snapshot.pageId,snapshot.revision);
        setPages(list=>list.map(page=>page.id===snapshot.pageId?{...page,...snapshot.edit}:page));
        setSaveState(pendingRef.current?'dirty':'saved');
      }catch(error){setSaveState('dirty');throw error;}
    });saveQueue.current=run;return run;
  },[captureEdit]);
  const flushSave=useCallback(async()=>{
    if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
    // Wait for an already-started write before switching pages, even if no timer remains.
    while(pendingRef.current){const p=pendingRef.current;pendingRef.current=null;
      try{await saveNow(p.edit.objects,p.edit.media,p.edit.background,p.edit.pattern,p);}catch(error){if(!pendingRef.current)pendingRef.current=p;throw error;}
    }
    await saveQueue.current;
  },[saveNow]);
  const handleContentChange=useCallback((objects:Page['objects'],media:MediaItem[])=>{
    const entry=captureEdit(objects,media,bgRef.current,patternRef.current);if(!entry)return;
    pendingRef.current=entry;void checkpoint(entry,{detached:true}).catch(()=>push('Recovery checkpoint could not be saved. Free storage and keep this lesson open.','error'));
    setSaveState('dirty');if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=window.setTimeout(()=>{void flushSave().catch(()=>push('Autosave failed. Your edits remain in the recovery journal.','error'));},getPerformanceProfile().autosaveMs);
  },[captureEdit,flushSave,push]);
  const lastDraftCheckpoint=useRef(0);
  const handleDraftChange=useCallback((objects:Page['objects'],media:MediaItem[])=>{
    const now=Date.now();if(now-lastDraftCheckpoint.current<getPerformanceProfile().checkpointMs)return;lastDraftCheckpoint.current=now;
    const entry=captureEdit(objects,media,bgRef.current,patternRef.current);if(entry)void checkpoint({...entry,partial:true},{detached:true}).catch(()=>{});
  },[captureEdit]);

  const [viewSync, setViewSync] = useState(() => isViewSyncEnabled(id));
  const [applyingView, setApplyingView] = useState(false);

  const wb = useWhiteboard({
    watermark:profile.watermark,defaultPenColor:profile.defaultPenColor,
    initialObjects: [],
    initialMedia: [],
    background,
    backgroundImage:pageImage,
    pattern,
    onContentChange: handleContentChange,
    onDraftChange:handleDraftChange,
    isViewLocked: viewSync,
  });
  // Latest board for window listeners and async flows that must not re-subscribe per frame.
  const wbRef=useRef(wb);wbRef.current=wb;
  /** Serialises a storage write behind any in-flight autosave. */
  const enqueueWrite=useCallback((write:()=>Promise<unknown>)=>{const run=saveQueue.current.catch(()=>{}).then(write).then(()=>{});saveQueue.current=run;return run;},[]);

  const getSlideFrame = useCallback(() => {
    if (frameRef.current && frameRef.current.width > 0 && frameRef.current.height > 0) {
      return frameRef.current;
    }
    const doc = wb.media.find((m) => ['pdf', 'image', 'docx'].includes(m.kind)) ?? wb.media[0];
    if (doc && doc.width > 0 && doc.height > 0) {
      return { x: doc.x, y: doc.y, width: doc.width, height: doc.height };
    }
    const b = wb.contentBounds?.();
    if (b && b.w > 20 && b.h > 20) {
      return { x: b.x, y: b.y, width: b.w, height: b.h };
    }
    return { x: -960, y: -540, width: 1920, height: 1080 };
  }, [wb.media, wb.contentBounds]);

  const recorder = useLessonRecorder({
    renderSlideScene: wb.renderSlideScene,
    getSlideFrame,
    lessonTitle: notebook?.title || "Lesson",
  });

  const handleApplyViewToAll = useCallback(async () => {
    if (applyingView) return;
    setApplyingView(true);
    try {
      await flushSave();
      // Read the board and slide list after the save settles, not from a stale render.
      const board = wbRef.current, pages = pagesRef.current, view = board.getView();
      let currentMedia = board.media;
      if (isViewSyncEnabled(id)) {
        currentMedia = currentMedia.map(m => ['pdf', 'image', 'docx'].includes(m.kind) ? { ...m, locked: true } : m);
        board.commitMedia(currentMedia);
      }
      const currentDoc = currentMedia.find(m => ['pdf', 'image', 'docx'].includes(m.kind)) ?? currentMedia[0];
      const targetFrame = currentDoc
        ? { x: currentDoc.x, y: currentDoc.y, width: currentDoc.width, height: currentDoc.height }
        : (frameRef.current ?? null);

      if (targetFrame) {
        frameRef.current = targetFrame;
        saveLessonDefaultFrame(id, targetFrame);
      }

      let nextPages = pages;
      if (currentDoc && targetFrame) {
        const sourceAspect = (currentDoc.width > 0 && currentDoc.height > 0) ? currentDoc.width / currentDoc.height : 0;
        nextPages = pages.map(p => {
          if (p.id === pageIdRef.current) {
            return { ...p, media: currentMedia, importFrame: targetFrame };
          }
          if (!p.media || p.media.length === 0) {
            return { ...p, importFrame: targetFrame };
          }
          const targetDoc = p.media.find(m => m.assetId === currentDoc.assetId) ??
                            p.media.find(m => m.kind === currentDoc.kind) ??
                            p.media[0];
          if (!targetDoc) {
            return { ...p, importFrame: targetFrame };
          }

          const targetAspect = (targetDoc.width > 0 && targetDoc.height > 0) ? targetDoc.width / targetDoc.height : 0;
          let w = targetFrame.width;
          let h = targetFrame.height;
          let x = targetFrame.x;
          let y = targetFrame.y;

          if (targetAspect > 0 && sourceAspect > 0 && Math.abs(targetAspect - sourceAspect) > 0.05) {
            const scale = Math.min(targetFrame.width / targetDoc.width, targetFrame.height / targetDoc.height);
            w = targetDoc.width * scale;
            h = targetDoc.height * scale;
            x = targetFrame.x + (targetFrame.width - w) / 2;
            y = targetFrame.y + (targetFrame.height - h) / 2;
          }

          const updatedMedia = p.media.map(m => m.id === targetDoc.id ? {
            ...m,
            x,
            y,
            width: w,
            height: h,
            rotation: currentDoc.rotation ?? 0,
            mirrorX: currentDoc.mirrorX,
            mirrorY: currentDoc.mirrorY,
            locked: isViewSyncEnabled(id) ? true : m.locked,
          } : m);

          return { ...p, media: updatedMedia, importFrame: targetFrame };
        });

        const res = await localRequest(`/api/notebooks/${id}/pages/layout`, {
          method: 'PUT',
          body: JSON.stringify({
            pages: nextPages.map(p => ({
              id: p.id,
              media: p.media,
              importFrame: p.importFrame,
            })),
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { pages?: Page[] };
          if (Array.isArray(data.pages)) {
            nextPages = data.pages;
          }
        } else {
          for (const p of nextPages) {
            await localRequest(`/api/pages/${p.id}`, {
              method: 'PUT',
              body: JSON.stringify({ media: p.media, importFrame: p.importFrame }),
            }).catch(() => {});
          }
        }
        setPages(nextPages);
      }

      if (view) {
        applyViewToAllPages(id, pages.map(p => p.id), view);
      }

      if (currentDoc) {
        push(`Applied slide position, size (${Math.round(currentDoc.width)}×${Math.round(currentDoc.height)}), and zoom to all ${pages.length} slides.`, 'success');
      } else if (view) {
        push(`Applied ${Math.round(view.scale * 100)}% zoom and position to all ${pages.length} slides.`, 'success');
      }
    } catch {
      push('Could not apply alignment to all slides. Please try again.', 'error');
    } finally {
      setApplyingView(false);
    }
  }, [applyingView, flushSave, id, push]);

  const toggleViewSync = useCallback(() => {
    // Decide first, then run side effects once (never inside a state updater).
    const next = !viewSync;
    setViewSync(next);
    setViewSyncEnabled(id, next);
    const lockDocs = (list: MediaItem[]) => list.map(m => ['pdf', 'image', 'docx'].includes(m.kind) ? { ...m, locked: next } : m);
    // Immediately lock or unlock slide media on the active board.
    const nextCurrentMedia = lockDocs(wb.media);
    wb.commitMedia(nextCurrentMedia);
    // The active slide uses the live board media, not its last-saved copy.
    const nextPages = pages.map(p => ({ ...p, media: p.id === pageIdRef.current ? nextCurrentMedia : lockDocs(p.media ?? []) }));
    setPages(nextPages);
    // Persist behind any in-flight autosave so writes cannot interleave.
    void enqueueWrite(async () => {
      let failed = 0;
      for (const p of nextPages) {
        const response = await localRequest(`/api/pages/${p.id}`, { method: 'PUT', body: JSON.stringify({ media: p.media, importFrame: p.importFrame }) }).catch(() => null);
        if (!response?.ok) failed++;
      }
      if (failed) push(`Could not save the slide lock on ${failed} slide${failed === 1 ? '' : 's'}. Try again.`, 'error');
    });
    if (next) {
      void handleApplyViewToAll();
      push('Slide locked in place. Slide movement and canvas pan are locked.', 'success');
    } else {
      push('Slide unlocked. You can now move, zoom, and reposition.', 'info');
    }
  }, [viewSync, id, wb.media, wb.commitMedia, pages, enqueueWrite, handleApplyViewToAll, push]);

  // -------------------------------- loading --------------------------------

  const [previewSize,setPreviewSize]=useState({width:1280,height:720});
  useEffect(()=>{const canvas=wb.canvasRef.current;if(!canvas)return;let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const width=canvas.clientWidth,height=canvas.clientHeight;if(width&&height)setPreviewSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});});};const observer=new ResizeObserver(update);observer.observe(canvas);update();return()=>{observer.disconnect();cancelAnimationFrame(frame);};},[loading]);
  // View writes are debounced; previews follow the settled view instead of every pan frame.
  const {settledView,flushView}=useViewPersistence({lessonId:id,pageId:currentPage?.id,view:wb.view,viewSync,enabled:!loading});
  const previewFrames=useMemo(()=>{
    const defaultV = savedLessonDefaultView(id), syncOn = isViewSyncEnabled(id);
    const activeView = settledView.pageId===currentPage?.id ? settledView.view : undefined;
    return Object.fromEntries(pages.map(page=>{
      const view=(page.id===currentPage?.id&&activeView?activeView:(syncOn?(defaultV??activeView??savedPageView(page.id)):(savedPageView(page.id)??defaultV)))??{tx:0,ty:0,scale:1};
      return [page.id,{x:-view.tx/view.scale,y:-view.ty/view.scale,width:previewSize.width/view.scale,height:previewSize.height/view.scale,zoom:view.scale}];
    }));
  }, [pages,currentPage?.id,settledView,previewSize,id,viewSync]);
  const loadPageIntoBoard = useCallback(
    (i: number, list: Page[]) => {
      const pg = list[i];
      if (!pg) return;
      flushView();
      pageIdRef.current = pg.id;
      lastDraftCheckpoint.current=0;
      frameRef.current=pg.importFrame;
      setIndex(i);
      bgRef.current=pg.background;patternRef.current=pg.pattern;
      try{localStorage.setItem('phoenix-last-page:'+id,pg.id);}catch{}
      void recordSession({lessonId:id,pageId:pg.id,title:notebook?.title??'Last lesson',active:true,updatedAt:Date.now()}).catch(()=>{});
      setBackground(pg.background || profile.boardBg || "#18212b");
      setPattern(pg.pattern || profile.boardPattern || "dots");
      pageImageRef.current=pg.backgroundImage;setPageImage(pg.backgroundImage);
      const syncOn = isViewSyncEnabled(id);
      const defaultView = savedLessonDefaultView(id);
      const defaultFrame = savedLessonDefaultFrame(id);
      let mediaToLoad = (pg.media ?? []).map(m =>
        syncOn && ['pdf', 'image', 'docx'].includes(m.kind) ? { ...m, locked: true } : m
      );

      if (syncOn && defaultFrame && mediaToLoad.length > 0) {
        const doc = mediaToLoad.find(m => ['pdf', 'image', 'docx'].includes(m.kind)) ?? mediaToLoad[0];
        if (doc && (Math.abs(doc.x - defaultFrame.x) > 1 || Math.abs(doc.y - defaultFrame.y) > 1 || Math.abs(doc.width - defaultFrame.width) > 2 || Math.abs(doc.height - defaultFrame.height) > 2)) {
          const docAspect = (doc.width > 0 && doc.height > 0) ? doc.width / doc.height : 0;
          const frameAspect = defaultFrame.width / defaultFrame.height;
          let w = defaultFrame.width;
          let h = defaultFrame.height;
          let x = defaultFrame.x;
          let y = defaultFrame.y;
          if (docAspect > 0 && Math.abs(docAspect - frameAspect) > 0.05) {
            const scale = Math.min(defaultFrame.width / doc.width, defaultFrame.height / doc.height);
            w = doc.width * scale;
            h = doc.height * scale;
            x = defaultFrame.x + (defaultFrame.width - w) / 2;
            y = defaultFrame.y + (defaultFrame.height - h) / 2;
          }
          mediaToLoad = mediaToLoad.map(m => m.id === doc.id ? { ...m, x, y, width: w, height: h } : m);
          frameRef.current = defaultFrame;
        }
      }

      const view = syncOn
        ? (defaultView ?? wb.getView() ?? savedPageView(pg.id))
        : (savedPageView(pg.id) ?? defaultView);
      wb.reset(pg.objects ?? [], mediaToLoad, !view);
      if (view) {
        wb.restoreView(view);
      } else if (pg.importFrame) {
        window.setTimeout(() => {
          if (pageIdRef.current === pg.id) {
            wb.fitToBounds(pg.importFrame!, 40);
          }
        }, 100);
      }
    },
    [wb.reset, wb.restoreView, wb.getView, wb.fitToBounds, flushView, id, notebook?.title],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);setLoadError(null);
    (async () => {
      try {
        const res = await localRequest(`/api/notebooks/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 404 ? "This lesson no longer exists on this device." : "The lesson could not be read from storage.");
        const data = (await res.json()) as { notebook: Notebook; pages: Page[] };
        if (!alive) return;
        let pgs = Array.isArray(data.pages) ? data.pages : [];
        // A lesson with no slides would leave nothing to save strokes into; create the first one.
        if (!pgs.length) {
          const created = await localRequest(`/api/notebooks/${id}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          if (!created.ok) throw new Error("The lesson has no slides and a first slide could not be created.");
          pgs = ((await created.json()) as { pages: Page[] }).pages;
          if (!alive) return;
        }
        setNotebook(data.notebook);
        setPages(pgs);
        let last:string|null=null;try{last=localStorage.getItem('phoenix-last-page:'+id);}catch{}
        loadPageIntoBoard(Math.max(0,pgs.findIndex(p=>p.id===last)),pgs);
        const unfinished=await unfinishedEdits(id),activity=await lastWorkActivity(id);if(alive){setRecoveryEdits(unfinished);setLastActivity(activity);}
      } catch (error) {
        if (alive) {setLoadError(error instanceof Error && error.message ? error.message : "Could not open this lesson.");push("Could not open this lesson.", "error");}
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadAttempt]);
  useEffect(() => () => {
    void finishSession(id).catch(()=>{});
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); void flushSave().catch(()=>{}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(()=>{
    const neighbors=[...(pages[index-1]?.media??[]),...(pages[index+1]?.media??[])].filter(m=>m.kind==='pdf');
    for(const media of currentPage?.media??[])if(media.kind==='pdf')for(const number of [media.pageNumber-1,media.pageNumber+1])if(number>0&&number<=(media.numPages??0))neighbors.push({...media,pageNumber:number});
    return warmPdfPages(neighbors.slice(0,2));
  },[index,pages.length,currentPage?.id,currentPage?.media]);
  const recoverWork=async()=>{
    try{
      const {saveRecovery}=await import('@/lib/recovery');await saveRecovery(id);
      for(const entry of recoveryEdits){const response=await localRequest(`/api/pages/${entry.pageId}`,{method:'PUT',body:JSON.stringify(entry.edit)});if(!response.ok)throw new Error('Recovery page no longer exists');await acknowledge(entry.pageId,entry.revision);}
      const response=await localRequest(`/api/notebooks/${id}`),data=await response.json();setPages(data.pages);loadPageIntoBoard(Math.max(0,data.pages.findIndex((p:Page)=>p.id===recoveryEdits[0]?.pageId)),data.pages);setRecoveryEdits([]);
    }catch{push('Could not restore the interrupted work. The recovery copy has been kept.','error');}
  };
  useEffect(() => {
    const save = () => { if (document.visibilityState === 'hidden') void flushSave().catch(()=>{}); };
    // Electron's main process flushes the board before closing; a veto there would block the close.
    const exit = (event: BeforeUnloadEvent) => { if (pendingRef.current) { if (!window.phoenixDeviceLibrary) { event.preventDefault(); event.returnValue = ''; } void flushSave().catch(()=>{}); } };
    const deviceFlush=(event:Event)=>{(event as CustomEvent<{pending:Promise<unknown>[]}>).detail.pending.push(flushSave());};
    window.addEventListener('phoenix-flush-board',deviceFlush);document.addEventListener('visibilitychange', save); window.addEventListener('beforeunload', exit);
    return () => { window.removeEventListener('phoenix-flush-board',deviceFlush);document.removeEventListener('visibilitychange', save); window.removeEventListener('beforeunload', exit); void flushSave().catch(()=>{}); };
  }, [flushSave]);

  // ------------------------------ page actions -----------------------------

  const goTo = useCallback(
    async (i: number) => {
      if (i < 0 || i >= pages.length || i === index || navigatingPage.current) return;
      navigatingPage.current = true;
      try {
        window.dispatchEvent(new Event('phoenix-pause-media'));
        await flushSave();
        const target = pages[i];
        if (!target) return;
        const response = await localRequest(`/api/pages/${target.id}`);
        if (!response.ok) return;
        const { page } = await response.json();
        const refreshed = pages.map(p => p.id === page.id ? page : p);
        setPages(refreshed); loadPageIntoBoard(i, refreshed);
      } finally {
        navigatingPage.current = false;
      }
    },
    [pages, index, flushSave, loadPageIntoBoard],
  );

  const ui=interfaceSettings(profile.ui);
  const addPage = useCallback(async () => {
    if(addingPage.current)return;
    addingPage.current=true;
    try {
      await flushSave();
      const res = await localRequest(`/api/notebooks/${id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...newPageStyle(profile,{...pages[index],background:bgRef.current,pattern:patternRef.current,backgroundImage:pageImageRef.current}),backgroundImage:newPageStyle(profile,{...pages[index],background:bgRef.current,pattern:patternRef.current,backgroundImage:pageImageRef.current}).backgroundImage??'',afterPageId:pageIdRef.current}),
      });
      if(!res.ok)throw new Error('Could not add the slide');
      const { page,pages:next } = (await res.json()) as { page: Page;pages:Page[] };
      setPages(next);
      loadPageIntoBoard(next.findIndex(item=>item.id===page.id), next);
    } catch {
      push("Could not add a page.", "error");
    } finally {addingPage.current=false;}
  }, [pages,index,profile, id, flushSave, loadPageIntoBoard, push]);

  const deletePage = useCallback(async (slideIndex=index) => {
    if (pages.length <= 1 || !pages[slideIndex]) return;
    try {
      await flushSave();
      const response=await localRequest(`/api/pages/${pages[slideIndex].id}`, { method: "DELETE" });
      if(!response.ok)throw new Error("Could not delete slide");
      const next = pages.filter((_, i) => i !== slideIndex);
      setPages(next);
      const active=next.findIndex(page=>page.id===pageIdRef.current);
      loadPageIntoBoard(active>=0?active:Math.min(slideIndex,next.length-1), next);
    } catch {
      push("Could not delete the page.", "error");
    }
  }, [pages, index, currentPage, flushSave, loadPageIntoBoard, push]);

  const reorderPages = useCallback(async (pageIds:string[]) => {
    await flushSave();
    const active=pageIdRef.current;
    const response=await localRequest(`/api/notebooks/${id}/pages/reorder`,{method:'PUT',body:JSON.stringify({pageIds})});
    if(!response.ok)throw new Error('Could not save the slide order. Try again.');
    const {pages:ordered}=await response.json() as {pages:Page[]};
    setPages(ordered);setIndex(Math.max(0,ordered.findIndex(page=>page.id===active)));
  },[id,flushSave]);

  const duplicatePage = useCallback(async (slideIndex:number) => {
    const source=pages[slideIndex];if(!source)return;
    try {
      // Save the source first; the store copies it and inserts the copy after it in one transaction.
      await flushSave();
      const created=await localRequest(`/api/pages/${source.id}/duplicate`,{method:'POST'});
      if(!created.ok)throw new Error('Could not duplicate this slide.');
      const {page:copy}=await created.json() as {page:Page};
      const listed=await localRequest(`/api/notebooks/${id}`).then(response=>response.ok?response.json() as Promise<{pages:Page[]}>:null).catch(()=>null);
      const ordered=listed?.pages?.some(page=>page.id===copy.id)?listed.pages:(()=>{const next=pagesRef.current.filter(page=>page.id!==copy.id),at=next.findIndex(page=>page.id===source.id);next.splice(at+1,0,copy);return next;})();
      setPages(ordered);loadPageIntoBoard(Math.max(0,ordered.findIndex(page=>page.id===copy.id)),ordered);
    } catch(error) {push(error instanceof Error?error.message:'Could not duplicate this slide.','error');}
  },[pages,id,flushSave,loadPageIntoBoard,push]);

  // -------------------------------- import ---------------------------------

  const handleImport = useCallback(
    (items: MediaItem[],frame?:Page["importFrame"]) => {
      if(frame)frameRef.current=frame;
      for (const item of items) wb.addMedia(item);
      // Import placement changes the document, never the current zoom.
    },
    [wb.addMedia],
  );

  // -------------------------------- export ---------------------------------

  const exportPNG = useCallback(async () => {
    setOperation('Exporting image');await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    try{const url = wb.exportPNG();
    if (url) download(url, `${notebook?.title ?? "page"}-p${index + 1}.png`);}finally{setOperation(null);void setWorkActivity(id,undefined).catch(()=>{});}
  }, [wb.exportPNG, notebook, index, id]);

  const exportPDF = useCallback(async (scope:PDFScope,onProgress:(progress:ExportProgress)=>void) => {
    await flushSave();
    const response=await localRequest(`/api/notebooks/${id}`);
    if(!response.ok)throw new Error('The lesson could not be read. Please try again.');
    const data=await response.json() as {pages:Page[]};
    const snapshot=data.pages.map(page=>page.id===pageIdRef.current?{...page,objects:persistentObjects(wb.objects),media:wb.media,background:bgRef.current,pattern:patternRef.current,backgroundImage:pageImageRef.current,importFrame:frameRef.current}:page);
    const chosen=scope==='all'?snapshot:snapshot.filter(page=>page.id===pageIdRef.current);
    return exportLessonPDF(chosen,{title:notebook?.title??'lesson',scope,pageNumber:index+1,watermark:profile.watermark,onProgress});
  }, [flushSave,id,wb.objects,wb.media,notebook,index,profile.watermark]);

  const exportJSON = useCallback(async () => {
    setOperation('Exporting editable lesson');await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    try { await flushSave(); const blob = await exportLesson(id); download(URL.createObjectURL(blob), `${notebook?.title ?? "lesson"}${BRANDING.FILE_EXTENSION}`); push("Editable lesson and files exported.", "success"); }
    catch { push("Could not export the lesson.", "error"); }finally{setOperation(null);void setWorkActivity(id,undefined).catch(()=>{});}
  }, [id, notebook, flushSave, push]);

  const exportENB = useCallback(async () => {
    await flushSave();
    const response=await localRequest(`/api/notebooks/${id}`);
    if(!response.ok)throw new Error('Could not read the lesson.');
    const {pages}=await response.json() as {pages:Page[]};
    const {exportEnb}=await import('@/lib/enb');
    const blob=await exportEnb(id,pages);
    download(URL.createObjectURL(blob),`${notebook?.title??'lesson'}.enb`);
  },[flushSave,id,notebook]);

  const printPage = usePrint(wb.renderToCanvas, push, notebook?.title);

  // -------------------------------- menus ----------------------------------

  const displayAnnotationAvailable = typeof window !== 'undefined' && !!window.phoenixDisplay;
  const startDisplayAnnotation = useCallback(() => {
    const display = window.phoenixDisplay;
    if (!display) return;
    // Save first so annotating over other apps never strands unsaved board edits.
    void flushSave().then(() => display.start()).catch(error => push(error instanceof Error && error.message ? `Display annotation could not start: ${error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}` : 'Display annotation could not start.', 'error'));
  }, [flushSave, push]);

  const onFileAction = useCallback(
    (action: string) => {
      switch (action) {
        case "new":
          void flushSave().then(() => router.push("/library?new=1")).catch(()=>push("Save failed. Please keep this lesson open.", "error"));
          break;
        case "open":
        case "exit":
          void flushSave().then(() => router.push("/library")).catch(()=>push("Save failed. Please keep this lesson open.", "error"));
          break;
        case "save":
          void flushSave().catch(() => push("Autosave failed. Your edits are still in memory. Free storage and try again.", "error"));

          break;
        case "saveas":
          exportJSON();
          break;
        case "special":
          setModal("special");
          break;
        case "import":
          setModal("import");
          break;
        case "export":
          setModal("export");
          break;
        case "print":
          printPage();
          break;
        case "themes":
          setModal("board-tools");
          break;
        case "settings":
          setModal("settings");
          break;
        case "help":
          setModal("help");
          break;
        case "about":
          setModal("about");
          break;
        case "exam-timer":
          setModal("exam-timer");
          break;
        case "display-annotation":
          startDisplayAnnotation();
          break;
      }
    },
    [router, flushSave, push, exportJSON, printPage, startDisplayAnnotation],
  );

  const toggleTool = useCallback((toolId: FloatingToolId) => {
    if (toolId === "screenshot") {
      exportPNG();
      return;
    }
    setOpenTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }, [exportPNG]);

  // ----------------------------- keyboard ----------------------------------

  useBoardKeyboard({board:wb,panelOpen:!!panel,closePanel:()=>setPanel(null),save:flushSave,push,goTo,index});

  // reset text draft when a new text editor opens
  useEffect(() => {
    if (wb.editingText) setTextValue(wb.editingText.value);
  }, [wb.editingText]);

  const selectedObject =
    wb.selection?.kind === "object" ? wb.objects.find((o) => o.id === wb.selection!.id) : undefined;
  const selectedMedia =
    wb.selection?.kind === "media" ? wb.media.find((m) => m.id === wb.selection!.id) : undefined;

  const centerWorld = useCallback(() => {
    const canvas = wb.canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return wb.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [wb.canvasRef, wb.screenToWorld]);
  const centerWorldRef = useRef(centerWorld); centerWorldRef.current = centerWorld;

  // Stamp listeners are registered once and read the latest board through refs.
  useEffect(() => {
    const onStampText = (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      if (!custom.detail?.text) return;
      const center = centerWorldRef.current(), board = wbRef.current;
      board.addObjects([
        {
          id: uid(),
          kind: 'text',
          x: center.x - 200,
          y: center.y - 40,
          text: custom.detail.text,
          color: board.pen.color,
          fontSize: 22,
          fontFamily: 'Arial',
          bold: false,
        },
      ]);
    };

    const onStampImage = async (e: Event) => {
      const custom = e as CustomEvent<{ dataUrl: string; width: number; height: number }>;
      const { dataUrl, width, height } = custom.detail ?? {};
      if (!dataUrl) return;
      // The snapshot belongs to the slide that was open when it was taken.
      const targetPageId = pageIdRef.current, center = centerWorldRef.current();
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const response = await localRequest('/api/assets', {
          method: 'POST',
          body: JSON.stringify({
            notebookId: id,
            name: 'Teaching snapshot',
            mimeType: blob.type,
            dataBase64: await fileToBase64(blob),
          }),
        });
        if (!response.ok) throw new Error('asset');
        const { asset } = await response.json();
        const scale = Math.min(1, 700 / width, 550 / height);
        const item: MediaItem = {
          id: uid(),
          kind: 'image',
          assetId: asset.id,
          x: center.x - (width * scale) / 2,
          y: center.y - (height * scale) / 2,
          width: width * scale,
          height: height * scale,
          rotation: 0,
          pageNumber: 1,
        };
        if (!targetPageId || pageIdRef.current === targetPageId) { wbRef.current.addMedia(item); return; }
        // The teacher moved on: append to the original slide without disturbing the open one.
        let added = false;
        await enqueueWrite(async () => {
          const read = await localRequest(`/api/pages/${targetPageId}`).catch(() => null);
          if (!read?.ok) return;
          const { page } = await read.json() as { page: Page };
          const media = [...(page.media ?? []), item];
          const saved = await localRequest(`/api/pages/${targetPageId}`, { method: 'PUT', body: JSON.stringify({ media }) }).catch(() => null);
          if (!saved?.ok) return;
          added = true;
          setPages(list => list.map(p => p.id === targetPageId ? { ...p, media } : p));
        });
        if (!added) throw new Error('save');
        push('Snapshot added to the slide it was taken from.', 'success');
      } catch {
        push('Could not add the snapshot to the board. Please try again.', 'error');
      }
    };

    window.addEventListener('phoenix-stamp-text', onStampText);
    window.addEventListener('phoenix-stamp-image', onStampImage);
    return () => {
      window.removeEventListener('phoenix-stamp-text', onStampText);
      window.removeEventListener('phoenix-stamp-image', onStampImage);
    };
  }, [id, enqueueWrite, push]);

  if (loading || !notebook) {
    return <BoardLoadState error={loading ? null : loadError ?? (notebook ? null : "Could not open this lesson.")} onRetry={() => setLoadAttempt(n => n + 1)} onBack={() => router.push("/library")} />;
  }

  function addSolid(kind:SolidKind){const center=centerWorld(),object=createSolid(kind,center.x-100,center.y-100,wb.pen.color);object.fillColor=wb.pen.shapeFillColor??'#6296bd';wb.addObjects([object]);wb.setTool('select');wb.setSelection({kind:'object',id:object.id});}
  function addEquipment(vessel:Vessel,reagent?:'Water'|'HCl'|'NaOH') {
    const center=centerWorld(),count=wb.objects.filter(isEquipment).length;
    const spacing=Math.min(190,Math.max(45,(innerWidth-150)/3))/wb.view.scale;
    const offset=innerWidth<600?(count%2?1:-1)*innerWidth/4/wb.view.scale:((count%3)-1)*spacing;
    const object=createEquipment(vessel,center.x-VESSELS[vessel].w/2+offset,center.y-140+Math.floor(count%6/3)*70,wb.pen.color,reagent);
    wb.addObjects([object]);wb.setTool('select');wb.setSelection({kind:'object',id:object.id});setSubjectTool(null);setPanel(null);
  }
  const handleBoardDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    boardDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setBoardDragging(true);
    }
  };

  const handleBoardDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    boardDragCounter.current--;
    if (boardDragCounter.current <= 0) {
      setBoardDragging(false);
      boardDragCounter.current = 0;
    }
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleBoardDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBoardDragging(false);
    boardDragCounter.current = 0;
    if (operation) return;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (/\.(pptx|ppt|odp)$/i.test(file.name)) {
      try {
        await flushSave();
        setOperation(`Converting ${file.name} to high-fidelity PDF…`);
        const { convertPptxToPdf } = await import('@/lib/pptx-to-pdf');
        const { importPdfPages } = await import('@/lib/pdf-pages');
        const result = await convertPptxToPdf(file, (curr, tot) => {
          setOperation(`Converting slide ${curr} of ${tot}: ${file.name}…`);
        });
        setOperation(`Importing slides into lesson…`);
        await importPdfPages(id, result.pdfBlob, false);
        const response = await localRequest(`/api/notebooks/${id}`);
        const data = await response.json();
        setNotebook(data.notebook);
        setPages(data.pages);
        loadPageIntoBoard(pages.length, data.pages);
        push(`Imported ${result.slideCount} slides with exact fidelity!`, 'success');
      } catch (err) {
        push(err instanceof Error ? err.message : 'Could not import presentation.', 'error');
      } finally {
        setOperation(null);
      }
    } else if (/\.pdf$/i.test(file.name)) {
      try {
        await flushSave();
        setOperation(`Importing ${file.name}…`);
        const { importPdfPages } = await import('@/lib/pdf-pages');
        const added = await importPdfPages(id, file, false);
        const response = await localRequest(`/api/notebooks/${id}`);
        const data = await response.json();
        setNotebook(data.notebook);
        setPages(data.pages);
        loadPageIntoBoard(pages.length, data.pages);
        push(`Imported ${added} pages from PDF!`, 'success');
      } catch (err) {
        push(err instanceof Error ? err.message : 'Could not import PDF.', 'error');
      } finally {
        setOperation(null);
      }
    }
  };

  const guideWindows: { id: FloatingToolId; title: string; icon: string; width: number; kind: "ruler" | "protractor" | "setsquare" | "compass" }[] = [
    { id: "ruler", title: "Ruler", icon: "📏", width: 560, kind: "ruler" },
    { id: "protractor", title: "Protractor", icon: "📐", width: 320, kind: "protractor" },
    { id: "setsquare", title: "Set square", icon: "📊", width: 320, kind: "setsquare" },
    { id: "compass", title: "Compass", icon: "🧭", width: 320, kind: "compass" },
  ];

  return (
    <div data-drawing={wb.isDrawing} data-menu-edge={ui.menuEdge} data-slides-edge={ui.slidesEdge} data-toolbar-layout={toolbarLayout} data-slides-side={slidesSide} data-flip-tools={ui.flipToolsOnSwap} data-show-fullscreen={ui.showFullscreen} data-show-customize={ui.showCustomize} data-show-time={ui.showTime} data-show-slides={ui.showSlideControls} data-show-menu={ui.showMenu} data-show-toolbar={ui.showToolbar} onDragEnter={handleBoardDragEnter} onDragLeave={handleBoardDragLeave} onDragOver={handleBoardDragOver} onDrop={handleBoardDrop} className="kn-board fixed inset-0 flex flex-col bg-base" style={{'--control-panel':controlPalette(profile.theme??BUILTIN_THEMES[0],background).panel,'--control-ink':controlPalette(profile.theme??BUILTIN_THEMES[0],background).ink,'--control-line':controlPalette(profile.theme??BUILTIN_THEMES[0],background).line,'--guide-ink':(parseInt(background.slice(1,3),16)*.299+parseInt(background.slice(3,5),16)*.587+parseInt(background.slice(5,7),16)*.114)<125?'#e5f3fa':'#153848'} as React.CSSProperties}>
      {operation&&<LoadingOverlay detail={operation}/>}
      {boardDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base/85 backdrop-blur-md border-4 border-dashed border-brand p-8 pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center max-w-md p-6 rounded-3xl bg-panel border border-brand/40 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shadow-inner">
              <Icon name="board" className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Drop presentation or PDF to add slides</h3>
              <p className="text-xs text-muted mt-1">
                Converts PowerPoint (.pptx) or PDF into high-fidelity slides in this lesson.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full">
              <span>✨ Exact Visual Fidelity</span>
            </div>
          </div>
        </div>
      )}
      {/* ---------------------------- Top bar ---------------------------- */}
      {!presenting && (
        <details className="board-meta"><summary aria-label="Lesson details" title="Lesson details"><Icon name="doc" className="h-5 w-5"/></summary>
        <header className="board-header" aria-label="Lesson details">
          <div className="board-header-row">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <BrandMark className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{profile.appName}</span>
            <BoardTime/>
            <button type="button" aria-label="Close lesson details" title="Close"
              onClick={(e) => { const details = e.currentTarget.closest('details'); if (details) details.open = false; }}
              className="kn-focus grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
          <label className="board-header-field">
            <span>Lesson title</span>
            <input
              value={notebook.title}
              onChange={(e) => setNotebook({ ...notebook, title: e.target.value })}
              onBlur={() =>
                localRequest(`/api/notebooks/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: notebook.title, subject: notebook.subject }),
                })
              }
              aria-label="Lesson title"
              className="kn-focus"
            />
          </label>
          <div className="board-header-row">
            <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-semibold text-muted">{notebook.subject}</span>
            <span className="flex-1" />
            <SaveBadge state={saveState} />
          </div>
          <div className="board-header-row board-header-actions">
            <span className="text-xs font-semibold text-muted">Zoom</span>
            <button onClick={wb.zoomOut} className="kn-focus grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink" aria-label="Zoom out">
              <Icon name="zoomOut" className="h-5 w-5" />
            </button>
            <button onClick={wb.resetView} aria-label="Reset board view" title="Return to the original board position"
              className="kn-focus min-h-11 rounded-lg px-2 text-sm font-semibold tabular-nums hover:bg-elevated">
              {Math.round(wb.view.scale * 100)}%
            </button>
            <button onClick={wb.zoomIn} className="kn-focus grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink" aria-label="Zoom in">
              <Icon name="zoomIn" className="h-5 w-5" />
            </button>
            {displayAnnotationAvailable && (
              <button type="button" onClick={startDisplayAnnotation} data-action="display-annotation"
                className="kn-focus ml-auto flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-elevated hover:text-ink"
                title={t('display_annotation')}>
                <Icon name="pen" className="h-4 w-4" />
                <span>{t('display_annotation')}</span>
              </button>
            )}
          </div>
        </header>
        </details>
      )}

      {/* ---------------------------- Board ---------------------------- */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={wb.attachCanvas}
          data-tool={wb.tool}
          className="kn-canvas-surface absolute inset-0 h-full w-full"
          onDoubleClick={wb.onDoubleClick}
          onPointerDown={wb.onPointerDown}
          onPointerMove={wb.onPointerMove}
          onPointerUp={wb.onPointerUp}
          onPointerCancel={wb.onPointerCancel}
          onPointerLeave={wb.onPointerLeave}
          onLostPointerCapture={wb.onPointerCancel}
        />

        {wb.shapeFeedback&&<div className="kn-shape-feedback" role="status">{wb.shapeFeedback}</div>}
        {/* Selection actions */}
        {wb.selection && (
          <SelectionBar
            children={isSolid(selectedObject)&&wb.selectedIds.length===1?<SolidControls object={selectedObject} onChange={wb.changeObjects}/>:isEquipment(selectedObject)&&wb.selectedIds.length===1?<EquipmentControls key={selectedObject.id} object={selectedObject} objects={wb.objects} onChange={wb.changeObjects} onAdd={addEquipment} dose={chemistryDose} onDose={setChemistryDose}/>:undefined}
            anchor={wb.selectionBounds?{...wb.worldToScreen(wb.selectionBounds.x,wb.selectionBounds.y),width:wb.selectionBounds.w*wb.view.scale,height:wb.selectionBounds.h*wb.view.scale}:{x:12,y:100,width:0,height:0}}
            count={wb.selectedIds.length}
            onResize={wb.resizeSelected}
            onTransform={wb.transformSelected}
            onSelectAll={wb.selectAll}
            selection={wb.selection}
            object={selectedObject}
            media={selectedMedia}
            onDelete={wb.deleteSelected}
            onDuplicate={wb.duplicateSelected}
            onRecolor={wb.recolorSelected}
            isLocked={wb.isSelectionLocked}
            onToggleLock={wb.toggleLockSelected}
            isGrouped={wb.isSelectionGrouped}
            onGroup={wb.groupSelected}
            onUngroup={wb.ungroupSelected}
            isInfiniteCloner={wb.isSelectionInfiniteCloner}
            onToggleInfiniteCloner={wb.toggleInfiniteClonerSelected}
            onShapeProperties={wb.updateShapeSelected}
            onMediaProperties={wb.updateMediaSelected}
            onPlaceMedia={(align,fit)=>{const center=centerWorld();const frame=frameRef.current??{x:center.x-640,y:center.y-360,width:1280,height:720};wb.placeSelectedMedia(frame,align,fit);if(fit)wb.centerBounds(frame);}}
            onPdfPage={(delta) => {
              if (selectedMedia?.kind === "pdf") {
                void wb.setPdfPage(selectedMedia.id, selectedMedia.pageNumber + delta).catch(()=>push('Could not open this PDF page.','error'));
              }
            }}
            onDeselect={() => wb.setSelection(null)}
            onEditText={wb.editSelectedText}
            onTextProperties={wb.updateTextSelected}
          />
        )}

        <SpecialObjectsLayer items={wb.media} scale={wb.view.scale} worldToScreen={wb.worldToScreen} onChange={wb.changeMedia} onSelect={id=>{if(!id)setThumbsOpen(false);wb.setTool('select');wb.setSelection(id?{kind:'media',id}:null);}} onRemove={wb.removeMedia}/>
        <BoardChemistryLayer objects={wb.objects} selected={isEquipment(selectedObject)?selectedObject:undefined} worldToScreen={wb.worldToScreen} screenToWorld={wb.screenToWorld} scale={wb.view.scale} onChange={wb.changeObjects} dose={chemistryDose}/>
        {wb.selection && !selectedMedia?.locked && !viewSync && wb.selectionBounds && (
          <ResizeHandles
            bounds={wb.selectionBounds}
            screen={wb.worldToScreen}
            resize={wb.commitResize}
            onPreview={wb.previewResize}
            onCancel={wb.cancelResize}
          />
        )}
        {/* Text editor overlay */}
        {wb.editingText && (
          <textarea data-board-text
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={() => wb.commitText(wb.editingText!.id, textValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                wb.commitText(wb.editingText!.id, textValue);
              }
              if (e.key === "Escape") {
                // Escape finishes editing and keeps what was typed (an empty box is removed).
                e.preventDefault();
                e.stopPropagation();
                wb.commitText(wb.editingText!.id, textValue);
              }
            }}
            placeholder="Type…"
            style={{
              position: "fixed",
              left: Math.max(12,Math.min(wb.editingText.screenX,window.innerWidth-260)),
              top: Math.max(72,Math.min(wb.editingText.screenY,(window.visualViewport?.height??window.innerHeight)-(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height'))||0)-120)),
              fontSize: 28,
              color: wb.pen.color,
              background: "rgba(0,0,0,0.35)",
              border: "1px dashed var(--color-brand)",
              borderRadius: 8,
              padding: "2px 6px",
              minWidth: 220,
              maxWidth: 'calc(100vw - 24px)',
              minHeight: 44,
              outline: "none",
              resize: "both",
              zIndex: 55,
            }}
          />
        )}

        <BoardTooltips/><ControlLayoutEditor/>
        {profile.ai?.enabled&&<button className="local-assistant-launch" onClick={()=>setAssistantOpen(value=>!value)} aria-label="Local assistant">AI assistant</button>}
        {assistantOpen&&<LocalAssistant onClose={()=>setAssistantOpen(false)} onInsert={text=>{const center=centerWorld();wb.addObjects([{id:uid(),kind:'text',x:center.x-220,y:center.y,text,color:wb.pen.color,fontSize:24,fontFamily:'Arial',bold:false}]);}}/>}
        {subjectTool && <SubjectTools onAddEquipment={addEquipment} onInsertText={text=>{const center=centerWorld();wb.addObjects([{id:uid(),kind:'text',x:center.x-220,y:center.y,text,color:wb.pen.color,fontSize:24,fontFamily:'Arial',bold:false}]);}} tool={subjectTool} onClose={() => setSubjectTool(null)} onInsert={async (url,width,height) => {
          const blob = await (await fetch(url)).blob();
          const response = await localRequest('/api/assets', {method:'POST',body:JSON.stringify({notebookId:id,name:'Teaching diagram',mimeType:blob.type,dataBase64:await fileToBase64(blob)})});
          if (!response.ok) { push('Could not insert this diagram.', 'error'); return; }
          const {asset} = await response.json(); const center=centerWorld(); const scale=Math.min(1,700/width,550/height);
          wb.addMedia({id:uid(),kind:'image',assetId:asset.id,x:center.x-width*scale/2,y:center.y-height*scale/2,width:width*scale,height:height*scale,rotation:0,pageNumber:1});
        }}/>}
        {/* Floating subject tools */}
        {guideWindows.map((g) =>
          openTools.has(g.id) ? (
            <GeometryOverlay key={g.id} kind={g.kind} pxPerMm={profile.calibrationPxPerMm} onClose={() => toggleTool(g.id)} onEdges={wb.setGuideEdges} onDraw={(edges,circle)=>{
                if(circle){const center=wb.screenToWorld(circle.center.x,circle.center.y),radius=circle.radius/wb.view.scale;wb.addObjects([{id:uid(),kind:'shape',shape:'ellipse',x:center.x-radius,y:center.y-radius,w:radius*2,h:radius*2,color:wb.pen.color,width:wb.pen.size,filled:false,rotation:0}]);}
                else if(g.kind==='compass'&&edges.length)wb.addObjects([{id:uid(),kind:'stroke',tool:'pen',color:wb.pen.color,width:wb.pen.size,points:[wb.screenToWorld(edges[0].a.x,edges[0].a.y),...edges.map(edge=>wb.screenToWorld(edge.b.x,edge.b.y))]}]);
                else wb.addObjects(edges.map(edge=>{const a=wb.screenToWorld(edge.a.x,edge.a.y),b=wb.screenToWorld(edge.b.x,edge.b.y);return {id:uid(),kind:'shape',shape:'line',x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y,color:wb.pen.color,width:wb.pen.size,filled:false,rotation:0};}));
              }}/>

          ) : null,
        )}
        {openTools.has("calculator") && (
          <FloatingWindow title="Calculator" icon="🧮" initialX={window.innerWidth - 320} initialY={90} onClose={() => toggleTool("calculator")}>
            <Calculator />
          </FloatingWindow>
        )}
        {openTools.has("timer") && (
          <FloatingWindow title="Timer" icon="⏳" initialX={window.innerWidth - 320} initialY={420} onClose={() => toggleTool("timer")}>
            <CountdownTimer />
          </FloatingWindow>
        )}
        {openTools.has("stopwatch") && (
          <FloatingWindow title="Stopwatch" icon="⏱️" initialX={80} initialY={90} onClose={() => toggleTool("stopwatch")}>
            <Stopwatch />
          </FloatingWindow>
        )}
        {openTools.has("clock") && (
          <FloatingWindow title="Clock" icon="🕐" initialX={80} initialY={420} width={230} onClose={() => toggleTool("clock")}>
            <AnalogClock />
          </FloatingWindow>
        )}
        {openTools.has("spotlight") && <SpotlightDimmer onClose={() => toggleTool("spotlight")} />}
        {openTools.has("magnifier") && (
          <MagnifierOverlay getCanvas={() => wb.canvasRef.current} onClose={() => toggleTool("magnifier")} />
        )}
        {openTools.has("pin") && (
          <ReferencePin getCanvas={() => wb.canvasRef.current} active={openTools.has("pin")} onClose={() => toggleTool("pin")} />
        )}
        {openTools.has("blind") && (
          <SolutionBlind onClose={() => toggleTool("blind")} />
        )}
        {openTools.has("noise-meter") && (
          <NoiseMeter onClose={() => toggleTool("noise-meter")} />
        )}

        {/* Dock + menus */}
        {!presenting && (
          <>
            <div className="menu-dock">
              <LeftDock
                active={panel}
                onOpen={(d) => {setThumbsOpen(false);if(d==='import'||d==='export'){setPanel('file');setModal(d);}else {setModal(null);setPanel((p) => (p === d ? null : d));}}}
                onSave={()=>onFileAction('save')}
              />
              {panel === "file" && (
                <FileMenu appName={profile.appName} onAction={onFileAction} onClose={() => {setPanel(null);setModal(null);}} />
              )}
            </div>
            {panel === "treasure" && (
              <TreasureBox onOpenBackgrounds={()=>{setPanel(null);setModal("board-tools");}} onOpenExamTimer={()=>{setPanel(null);setModal("exam-timer");}} onSubjectTool={tool=>setSubjectTool(tool)} openTools={openTools} onToggle={toggleTool} onClose={() => setPanel(null)} />
            )}
          </>
        )}

        {thumbsOpen && <SlidesPanel previewFrames={previewFrames} pages={pages} activePageId={currentPage?.id??''}
          onGo={i=>{void goTo(i).catch(()=>push('Could not save your edits. Keep this slide open.','error'));}}
          onReorder={reorderPages} onClose={()=>setThumbsOpen(false)} onAdd={addPage} onDuplicate={duplicatePage} onDelete={deletePage}
          onApplyViewToAll={handleApplyViewToAll} applyingView={applyingView} viewSync={viewSync} onToggleViewSync={toggleViewSync}/>}

        {/* Bottom toolbar + page bar */}
        <div className="board-toolbar" data-layout={toolbarLayout}>
          <Toolbar selectionSettings={wb.selectionSettings} onSelectionSettings={wb.setSelectionSettings} onAddSolid={addSolid}
            tool={wb.tool}
            setTool={wb.setTool}
            pen={wb.pen}
            setPen={wb.setPen}
            eraserSize={wb.eraserSize}
            eraserMode={wb.eraserMode} onEraserMode={wb.setEraserMode}
            palmEraser={wb.palmEraser} onPalmEraser={wb.setPalmEraser}
            dualNibMode={wb.dualNibMode} onDualNibMode={wb.setDualNibMode}
            onClearAnnotations={wb.clearAnnotations}
            setEraserSize={wb.setEraserSize}
            undo={wb.undo}
            redo={wb.redo}
            canUndo={wb.canUndo}
            canRedo={wb.canRedo}
            onOpenTreasure={() => {setThumbsOpen(false);setPanel((p) => (p === "treasure" ? null : "treasure"));}}
            recorder={recorder}
          />
        </div>
        <div className="page-toolbar">
          <PageBar
            pageIndex={index}
            pageCount={pages.length}
            onAdd={addPage}
            onGo={i=>{void goTo(i).catch(()=>push('Could not save this slide. Please try again.','error'));}}
            onSwap={()=>setSlidesSide(side=>side==='left'?'right':'left')}
            onToggleThumbs={() => {setPanel(null);setThumbsOpen((o) => !o);}}
            thumbsOpen={thumbsOpen}
            onFitToScreen={wb.fitToContent}
          />
        </div>

        {/* Present exit */}
        {presenting && (
          <button
            onClick={() => setPresenting(false)}
            className="kn-focus absolute right-6 top-4 z-40 flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 text-sm text-muted backdrop-blur hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
            Exit present
          </button>
        )}
      </div>

      {/* ---------------------------- Modals ---------------------------- */}
      <MenuScreenContext.Provider value={panel==='file'&&modal!==null}>
      {modal === "settings" && (
        <SettingsPanel onClose={() => setModal(null)} onOpenBoard={() => setModal("board-tools")} />
      )}
      {(slowSave||wb.processing)&&<LoadingOverlay detail="Processing and saving your edits..."/>}
      {(recoveryEdits.length>0||lastActivity)&&<Dialog title="Interrupted work" onClose={()=>{setRecoveryEdits([]);setLastActivity(undefined);}} width={460}><p className="mb-4 text-sm">{lastActivity&&<span className="mb-2 block">Last operation: {lastActivity}. Open the saved lesson to review it; an interrupted import or export can be started again.</span>}{recoveryEdits.length>0?'An unfinished edit was saved before this lesson closed. Restore it, or keep the last saved pages.':'Your saved pages are ready to open.'}</p><div className="flex gap-3">{recoveryEdits.length>0&&<button className="kn-focus rounded-lg bg-brand p-3 text-white" onClick={()=>{void recoverWork().then(()=>{setLastActivity(undefined);void setWorkActivity(id,undefined);});}}>Restore unfinished work</button>}<button className="kn-focus rounded-lg border border-line p-3" onClick={()=>{const entries=recoveryEdits;void Promise.all(entries.map(e=>acknowledge(e.pageId,e.revision))).then(()=>{setRecoveryEdits([]);setLastActivity(undefined);void setWorkActivity(id,undefined);});}}>Keep saved pages</button></div></Dialog>}
      {modal === "board-tools" && (
        <Dialog
          title="Board & themes"
          icon={<Icon name="board" className="h-5 w-5 text-brand-light" />}
          onClose={() => setModal(null)}
          width={700}
        >
            <TeachingPreferences
              value={{ ...profile, boardBg: background, boardPattern: pattern, boardImage: pageImage }}
              onChange={patch => {
                if (patch.boardCredits) void updateProfile({ boardCredits: patch.boardCredits });
                if (patch.boardBg) { setBackground(patch.boardBg); bgRef.current = patch.boardBg; }
                if (patch.boardPattern) { setPattern(patch.boardPattern); patternRef.current = patch.boardPattern; }
                if ('boardImage' in patch) { pageImageRef.current = patch.boardImage; setPageImage(patch.boardImage); }
                if (patch.defaultPenColor) wb.setPen({ ...wb.pen, color: patch.defaultPenColor });
                if (patch.boardPresets) void updateProfile({ boardPresets: patch.boardPresets });
                void updateProfile(patch).catch(e => push(e.message, 'error'));
                void saveNow(wb.objects, wb.media, bgRef.current, patternRef.current).catch(e => push(e.message, 'error'));
              }}
              onThemeChange={patch => {
                void updateProfile(patch).catch(e => push(e.message, 'error'));
              }}
            />
        </Dialog>
      )}
      {modal === "help" && <HelpPanel onClose={() => setModal(null)} />}
      {modal === "about" && <AboutPanel onClose={() => setModal(null)} />}
      {modal === "special" && <InsertSpecialObject notebookId={id} center={centerWorld()} onAdd={wb.addMedia} onClose={()=>setModal(null)}/>}
      {modal === "import" && (
        <ImportPanel
          notebookId={id}
          center={centerWorld()}
          onImport={handleImport}
            beforeImport={flushSave}
            onPagesImported={async()=>{const response=await localRequest(`/api/notebooks/${id}`);const data=await response.json();setNotebook(data.notebook);setPages(data.pages);loadPageIntoBoard(pages.length,data.pages);}}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "export" && (
        <ExportPanel
          onClose={() => setModal(null)}
          pageTitle={`${notebook.title} · page ${index + 1}`}
          pageCount={pages.length}
          onPNG={exportPNG}
          onPDF={exportPDF}
          onJSON={exportJSON}
          onENB={exportENB}
        />
      )}
      {modal === "exam-timer" && (
        <ExamTimerModal onClose={() => setModal(null)} />
      )}
      </MenuScreenContext.Provider>
    </div>
  );
}

function SaveBadge({ state }: { state: "saved" | "saving" | "dirty" }) {
  const map = {
    saved: { text: "Saved", dotCls: "bg-success", textCls: "text-success font-semibold" },
    saving: { text: "Saving…", dotCls: "bg-warn motion-safe:animate-pulse", textCls: "text-warn font-semibold" },
    dirty: { text: "Unsaved", dotCls: "bg-danger", textCls: "text-danger font-semibold" },
  } as const;
  const s = map[state];
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-panel/80 px-3 py-1 text-xs backdrop-blur shadow-sm sm:flex">
      <span className={`h-2 w-2 rounded-full transition-all duration-300 ${s.dotCls}`} />
      <span className={s.textCls}>{s.text}</span>
    </span>
  );
}

function BoardTime(){return <span className="shrink-0 text-xs tabular-nums text-muted">{useNow().time}</span>;}
