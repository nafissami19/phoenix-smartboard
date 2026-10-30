"use client";

import '@/components/workspace.css';
import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import { interruptedSessions, finishSession, type WorkSession } from '@/lib/work-journal';
import { CustomSelect } from '@/components/CustomSelect';
import { localRequest } from "@/lib/local-store";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { useApp } from "@/lib/app-context";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/Icon";
import { BrandMark } from '@/components/BrandMark';
import { importPdfPages } from "@/lib/pdf-pages";
import { Modal } from "@/components/board/Panels";
import { COVER_COLORS } from "@/lib/constants";
import type { Notebook, Page } from "@/db/schema";
import { drawBackground, drawObject } from "@/lib/render";
import { loadBackgroundImage } from "@/lib/background-image";
import { ExamTimerModal } from "@/components/exam/ExamTimerModal";

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center bg-base text-muted">Loading…</div>
      }
    >
      <LibraryInner />
    </Suspense>
  );
}

function LibraryInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { profile } = useApp();
  const { push } = useToast();
  const { t } = useI18n();

  const [interrupted, setInterrupted] = useState<WorkSession[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(search.get("new") === "1");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cover, setCover] = useState(COVER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('phoenix-library-view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<'lessons' | 'trash'>('lessons');
  const [trashList, setTrashList] = useState<Array<{ id: string; lessonId: string; savedAt: number; blob: Blob }>>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [examTimerOpen, setExamTimerOpen] = useState(false);

  const visible = notebooks
    .filter(n => (filter === 'all' || n.subject === filter) && `${n.title} ${n.subject}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'pages' ? b.pageCount - a.pageCount : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const subjects = [...new Set(notebooks.map(n => n.subject))].sort();
  const setLayout = (layout: 'grid' | 'list') => {
    setView(layout);
    try {
      localStorage.setItem('phoenix-library-view', layout);
    } catch {}
  };

  useEffect(() => {
    if (search.get('new') === '1') setCreating(true);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await localRequest("/api/notebooks", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load lessons");
      const data = (await res.json()) as { notebooks: Notebook[] };
      setNotebooks(data.notebooks);
      const sessions = await interruptedSessions();
      setInterrupted(sessions.filter(s => data.notebooks.some(n => n.id === s.lessonId)));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const { listTrashSnapshots } = await import('@/lib/local-store');
      const items = await listTrashSnapshots();
      setTrashList(items);
    } catch {
      push('Could not load recovery snapshots.', 'error');
    } finally {
      setTrashLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  const handleRestore = async (id: string) => {
    setBusy(true);
    try {
      const { restoreTrashSnapshot } = await import('@/lib/local-store');
      const restoredId = await restoreTrashSnapshot(id);
      push('Lesson restored successfully!', 'success');
      await load();
      await loadTrash();
      setActiveTab('lessons');
      router.push(`/board/${restoredId}`);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not restore lesson.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePermanent = async (id: string) => {
    if (!confirm('Permanently delete this backup snapshot? This cannot be undone.')) return;
    setBusy(true);
    try {
      const { deleteTrashSnapshot } = await import('@/lib/local-store');
      await deleteTrashSnapshot(id);
      push('Backup snapshot permanently deleted.', 'info');
      await loadTrash();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not delete snapshot.', 'error');
    } finally {
      setBusy(false);
    }
  };

  async function create() {
    setBusy(true);
    let createdNotebookId: string | null = null;
    try {
      const lessonTitle = (pdfFile ? pdfFile.name.replace(/\.pdf$/i, "") : "").trim() || "Untitled lesson";
      const res = await localRequest("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: lessonTitle, subject: "General", coverColor: cover }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Could not create the lesson.");
      }
      const data = (await res.json()) as { notebook?: Notebook; error?: string };
      if (!data.notebook) throw new Error(data.error || "Could not create the lesson.");
      const notebook = data.notebook;
      createdNotebookId = notebook.id;
      if (pdfFile) await importPdfPages(notebook.id, pdfFile, true);
      setPdfFile(null);
      setCreating(false);
      router.push(`/board/${notebook.id}`);
    } catch (error) {
      if (createdNotebookId) {
        try {
          await localRequest(`/api/notebooks/${createdNotebookId}`, { method: "DELETE" });
        } catch {
          // Ignore rollback failure
        }
      }
      const msg = error instanceof Error ? error.message : "Could not create the lesson.";
      console.error("Lesson creation failed:", error);
      push(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await localRequest(`/api/notebooks/${id}`, { method: "DELETE" });
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      void loadTrash();
      push("Lesson deleted. You can restore it from Trash / Recovery.", "success");
    } catch {
      push("Could not delete the lesson.", "error");
    }
  }

  return (
    <div className="kn-workspace kn-scroll h-dvh w-full overflow-y-auto bg-base">
      <div className="kn-workspace-inner">
        <header className="kn-workspace-header">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-md">
              <BrandMark className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{profile.appName}</h1>
              <p className="text-sm text-muted">
                Your lessons & boards
              </p>
            </div>
          </div>
          <div className="kn-workspace-actions">
            <LanguageToggle />
            <button
              onClick={() => router.push("/onboarding")}
              className="kn-focus flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:bg-elevated hover:text-ink"
            >
              <Icon name="settings" className="h-4 w-4" />
              {t("settings")}
            </button>
            <button
              onClick={() => setExamTimerOpen(true)}
              className="kn-focus flex items-center gap-2 rounded-xl border border-line bg-panel-2/80 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-elevated hover:border-brand/40 transition-colors shadow-sm"
              title="Open Exam Timer & Clock System"
            >
              <Icon name="timer" className="h-4 w-4 text-brand" />
              Exam Timer
            </button>
            <button
              onClick={() => setCreating(true)}
              className="kn-focus flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Icon name="plus" className="h-4 w-4" />
              {t("new_lesson")}
            </button>
          </div>
        </header>

        <div className="flex gap-2 border-b border-line pb-3 mb-5" role="tablist" aria-label="Library views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lessons'}
            className={`kn-focus px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'lessons' ? 'bg-brand text-white shadow-sm' : 'bg-panel text-muted hover:text-ink'}`}
            onClick={() => setActiveTab('lessons')}
          >
            {t("lessons")} ({notebooks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'trash'}
            className={`kn-focus px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'trash' ? 'bg-brand text-white shadow-sm' : 'bg-panel text-muted hover:text-ink'}`}
            onClick={() => { setActiveTab('trash'); void loadTrash(); }}
          >
            {t("trash_recovery")} ({trashList.length})
          </button>
        </div>

        {activeTab === 'trash' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Deleted Lessons & Automatic Recovery Snapshots</h2>
                <p className="text-xs text-muted mt-0.5">
                  Phoenix preserves up to 3 generations of deleted lessons in your device recovery store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadTrash()}
                className="kn-focus flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                <Icon name="sync" className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            {trashLoading ? (
              <div className="p-8 text-center text-sm text-muted">Checking recovery store...</div>
            ) : trashList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-12 text-center">
                <h3 className="font-semibold text-ink">Trash is empty</h3>
                <p className="mt-1 text-sm text-muted">
                  Deleted lessons and automatic snapshots will appear here so you can restore them anytime.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trashList.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-line bg-panel p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-light">
                          {Math.round(item.blob.size / 1024)} KB
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(item.savedAt).toLocaleDateString()} {new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="font-semibold text-ink mt-3 break-all">
                        Lesson {item.lessonId.slice(0, 12)}…
                      </h3>
                      <p className="text-xs text-muted mt-1 font-mono">Snapshot ID: {item.id.slice(0, 8)}</p>
                    </div>
                    <div className="mt-5 flex items-center gap-2 pt-3 border-t border-line">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRestore(item.id)}
                        className="kn-focus flex-1 rounded-xl bg-brand py-2 text-center text-xs font-semibold text-white hover:bg-brand-dark transition-colors disabled:opacity-50"
                      >
                        {t("restore")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDeletePermanent(item.id)}
                        className="kn-focus rounded-xl border border-line px-3 py-2 text-xs text-muted hover:bg-elevated hover:text-red-400 transition-colors disabled:opacity-50"
                        title={t("delete_permanent")}
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>

        {interrupted.length > 0 && (
          <section className="mb-5 rounded-xl border border-line bg-panel p-4" aria-label="Interrupted lessons">
            <strong>Continue interrupted work</strong>
            <p className="mb-3 text-sm text-muted">
              {interrupted.length > 1
                ? 'Your recent lessons and unfinished drawings are available to review.'
                : 'Your last lesson and any unfinished drawing are available to review.'}
            </p>
            <div className="flex flex-col gap-2.5">
              {interrupted.slice(0, 3).map((session, index) => (
                <div
                  key={session.lessonId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-panel-2/70 px-3.5 py-2.5 transition-colors hover:border-line"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink truncate">
                        {notebooks.find(n => n.id === session.lessonId)?.title ?? session.title}
                      </span>
                      {index === 0 && interrupted.length > 1 && (
                        <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                          Latest
                        </span>
                      )}
                    </div>
                    {session.activity && (
                      <small className="block text-xs text-muted truncate mt-0.5">{session.activity}</small>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="kn-focus rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
                      onClick={() => router.push(`/board/${session.lessonId}`)}
                    >
                      {index === 0 ? 'Open last lesson' : 'Open lesson'}
                    </button>
                    <button
                      aria-label="Dismiss interrupted lesson"
                      className="kn-focus grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink transition-colors"
                      onClick={() => {
                        void finishSession(session.lessonId).then(() =>
                          setInterrupted(list => list.filter(s => s.lessonId !== session.lessonId))
                        );
                      }}
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !loadError && notebooks.length > 0 && (
          <>
            <div className="kn-library-summary" aria-label="Library overview">
              <div><strong>{notebooks.length}</strong><span>{t("lessons")}</span></div>
              <div><strong>{notebooks.reduce((sum, n) => sum + n.pageCount, 0)}</strong><span>{t("pages")}</span></div>
              <div><strong>{subjects.length}</strong><span>{t("subjects")}</span></div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("your_lessons")}</h2>
              <span className="text-sm text-muted" role="status">{visible.length} of {notebooks.length}</span>
            </div>
            <div className="kn-library-filters">
              <label className="relative">
                <span className="sr-only">{t("search_lessons")}</span>
                <input className="kn-focus" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("search_lessons")} />
                {query && (
                  <button aria-label="Clear search" className="absolute right-1 top-0 grid w-10 place-items-center text-muted" onClick={() => setQuery('')}>
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                )}
              </label>
              <CustomSelect aria-label="Filter by subject" value={filter} onChange={e => setFilter(e.target.value)} className="kn-focus min-h-11 rounded-xl border border-line bg-panel px-3 py-2">
                <option value="all">All subjects</option>
                {subjects.map(s => <option key={s}>{s}</option>)}
              </CustomSelect>
              <CustomSelect aria-label="Sort lessons" value={sort} onChange={e => setSort(e.target.value)} className="kn-focus min-h-11 rounded-xl border border-line bg-panel px-3 py-2">
                <option value="recent">Recently updated</option>
                <option value="title">Title A to Z</option>
                <option value="pages">Most pages</option>
              </CustomSelect>
              <div className="flex gap-1 rounded-xl border border-line p-1" aria-label="Lesson layout">
                {(['grid', 'list'] as const).map(layout => (
                  <button
                    key={layout}
                    aria-label={`${layout === 'grid' ? 'Grid' : 'List'} view`}
                    aria-pressed={view === layout}
                    onClick={() => setLayout(layout)}
                    className={`kn-focus grid w-11 place-items-center rounded-lg ${view === layout ? 'bg-elevated text-ink' : 'text-muted'}`}
                  >
                    <Icon name={layout === 'grid' ? 'shapes' : 'menu'} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="kn-lesson-grid" role="status" aria-label="Loading lessons">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-64 rounded-2xl border border-line bg-panel">
                <div className="h-36 bg-panel-2" />
                <div className="m-5 h-4 w-2/3 rounded bg-elevated" />
                <div className="mx-5 h-3 w-1/3 rounded bg-elevated" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-line bg-panel p-10 text-center">
            <h2 className="text-lg font-semibold">Could not load your lessons</h2>
            <p className="mt-2 text-sm text-muted">Your saved lessons have not been changed.</p>
            <button className="kn-focus mt-5 rounded-xl bg-brand px-5 py-2 text-white" onClick={() => void load()}>Try again</button>
          </div>
        ) : notebooks.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <h3 className="font-semibold">No matching lessons</h3>
            <p className="mt-2 text-sm text-muted">Try another title or subject.</p>
            <button onClick={() => { setQuery(''); setFilter('all'); }} className="kn-focus mt-4 rounded-xl border border-line px-4 py-2">Clear filters</button>
          </div>
        ) : (
          <div className={view === 'grid' ? 'kn-lesson-grid' : 'kn-lesson-list'}>
            {visible.map(n => (
              <NotebookCard key={n.id} notebook={n} onOpen={() => router.push(`/board/${n.id}`)} onDelete={() => remove(n.id)} />
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {creating && (
        <Modal title="New lesson" icon={<Icon name="plus" className="h-5 w-5 text-brand-light" />} onClose={() => setCreating(false)}>
          <div className="space-y-4">
            <label className="block text-sm">
              Start from PDF (optional)
              <input
                aria-label="Start lesson from PDF"
                type="file"
                accept=".pdf,application/pdf"
                disabled={busy}
                onChange={e => { setPdfFile(e.target.files?.[0] ?? null); }}
                className="mt-2 block w-full"
              />
              <span className="mt-1 block text-xs text-muted">One PDF page per board page, ready to annotate. Up to 25 MB / 1500 pages.</span>
            </label>
            <div>
              <label className="mb-2 block text-sm font-medium">Cover colour</label>
              <div className="flex flex-wrap gap-2">
                {COVER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCover(c)}
                    className={`h-9 w-9 rounded-lg border-2 transition ${cover === c ? "scale-110 border-ink" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="kn-focus rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-elevated">
                Cancel
              </button>
              <button onClick={create} disabled={busy} className="kn-focus rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                {busy ? "Creating…" : "Create & open"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {examTimerOpen && (
        <ExamTimerModal onClose={() => setExamTimerOpen(false)} />
      )}
    </div>
  );
}

/**
 * Slide 1 Thumbnail Canvas Preview Component.
 * Fetches slide 1 of the lesson and renders its tactile background, textures,
 * and objects onto an HTML5 canvas. Falls back smoothly to the cover color.
 */
function Slide1Thumbnail({
  notebookId,
  coverColor,
  title,
  pageCount,
}: {
  notebookId: string;
  coverColor: string;
  title: string;
  pageCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSlide1() {
      try {
        const res = await localRequest(`/api/notebooks/${notebookId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { pages?: Page[] };
        const page1 = data.pages?.[0];
        if (!page1 || cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Render at 320x180 resolution (16:9 ratio)
        canvas.width = 320;
        canvas.height = 180;
        const scale = 320 / 1280;

        let bgImg: HTMLImageElement | undefined;
        if (page1.backgroundImage) {
          try {
            bgImg = await loadBackgroundImage(page1.backgroundImage);
          } catch {}
        }
        if (cancelled) return;

        // Draw slide background and tactile textures/grid
        drawBackground(
          ctx,
          1280,
          720,
          page1.background || coverColor,
          page1.pattern || 'none',
          scale,
          bgImg
        );

        // Draw slide 1 objects scaled
        ctx.save();
        ctx.scale(scale, scale);
        for (const obj of page1.objects || []) {
          drawObject(ctx, obj);
        }
        ctx.restore();

        if (!cancelled) {
          setRendered(true);
        }
      } catch {
        // Fallback to stylized cover if anything fails
      }
    }

    void loadSlide1();
    return () => {
      cancelled = true;
    };
  }, [notebookId, coverColor]);

  return (
    <div className={`kn-lesson-cover ${rendered ? 'has-thumbnail' : ''}`} style={{ background: coverColor }}>
      {/* Background canvas for slide 1 */}
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        className={`kn-lesson-thumbnail-canvas transition-opacity duration-300 ${rendered ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />

      {/* Fallback initial letter when thumbnail is not yet rendered */}
      {!rendered && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute bottom-3 left-4 text-3xl font-bold text-white/90 drop-shadow">
            {title.slice(0, 1).toUpperCase()}
          </span>
        </>
      )}

      {/* Top right page counter badge */}
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white/95 backdrop-blur border border-white/10 shadow-sm">
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
      </span>

      {/* Slide 1 indicator pill */}
      {rendered && (
        <span className="absolute bottom-2.5 left-3 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-white/90 backdrop-blur border border-white/10 shadow-sm">
          Slide 1
        </span>
      )}
    </div>
  );
}

/**
 * Returns vibrant frosted subject pill badge styles with luminous colors.
 */
function getSubjectTagBadge(subject: string) {
  const norm = subject.trim().toLowerCase();
  if (norm.includes('math')) {
    return 'text-cyan-300 bg-cyan-950/50 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.22)]';
  }
  if (norm.includes('chem')) {
    return 'text-amber-300 bg-amber-950/50 border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.22)]';
  }
  if (norm.includes('phys')) {
    return 'text-emerald-300 bg-emerald-950/50 border-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.22)]';
  }
  if (norm.includes('bio')) {
    return 'text-lime-300 bg-lime-950/50 border-lime-400/40 shadow-[0_0_12px_rgba(163,230,53,0.22)]';
  }
  if (norm.includes('eng') || norm.includes('lit')) {
    return 'text-purple-300 bg-purple-950/50 border-purple-400/40 shadow-[0_0_12px_rgba(192,132,252,0.22)]';
  }
  if (norm.includes('hist') || norm.includes('soc')) {
    return 'text-rose-300 bg-rose-950/50 border-rose-400/40 shadow-[0_0_12px_rgba(251,113,133,0.22)]';
  }
  return 'text-sky-300 bg-sky-950/50 border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.22)]';
}

function NotebookCard({
  notebook,
  onOpen,
  onDelete,
}: {
  notebook: Notebook;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  // Interactive 3D perspective hover cards
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotX = (-y * 12).toFixed(2);
    const rotY = (x * 12).toFixed(2);
    setTiltStyle({
      transform: `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.025, 1.025, 1.025)`,
      transition: 'transform 0.08s ease-out',
    });
    setGlarePos({
      x: (x + 0.5) * 100,
      y: (y + 0.5) * 100,
      opacity: 0.16,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
    });
    setGlarePos(g => ({ ...g, opacity: 0 }));
  };

  return (
    <>
      <div
        className="kn-lesson-card"
        style={tiltStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Specular glare overlay */}
        <div
          className="kn-lesson-glare pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glarePos.opacity}), transparent 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        <button onClick={onOpen} className="kn-focus block w-full text-left">
          <Slide1Thumbnail
            notebookId={notebook.id}
            coverColor={notebook.coverColor}
            title={notebook.title}
            pageCount={notebook.pageCount}
          />
          <div className="kn-lesson-info p-4 pr-16">
            <div className="mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md border ${getSubjectTagBadge(notebook.subject)}`}>
                #{notebook.subject}
              </span>
            </div>
            <h3 className="truncate text-base font-semibold">{notebook.title}</h3>
            <p className="mt-2 text-xs text-faint">
              Updated {new Date(notebook.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          className="kn-focus kn-lesson-delete grid h-11 w-11 place-items-center z-20"
          aria-label="Delete"
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
      {confirmDelete && (
        <Modal title="Delete lesson" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm">
            Delete "{notebook.title}"? A recovery snapshot is saved before removal; keep an external backup for important lessons.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="rounded-lg border border-line px-4 py-2" onClick={() => setConfirmDelete(false)}>
              Keep lesson
            </button>
            <button
              className="rounded-lg bg-brand px-4 py-2 text-white"
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
            >
              Delete lesson
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-line py-20 text-center">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-panel-2">
        <Icon name="board" className="h-8 w-8 text-muted" />
      </span>
      <h2 className="text-lg font-semibold">No lessons yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Create your first board to start writing, importing PDFs and teaching with smart tools.
      </p>
      <button onClick={onCreate} className="kn-focus mt-5 flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        <Icon name="plus" className="h-4 w-4" />
        New lesson
      </button>
    </div>
  );
}
