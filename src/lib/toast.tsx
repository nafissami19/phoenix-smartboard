import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/Icon";

export type ToastTone = "info" | "error" | "success" | "warn";
type Toast = { id: number; message: string; tone: ToastTone; leaving?: boolean };

/** Auto-dismiss delays (ms). Errors stay long enough to read and act on; hover/focus pauses all of them. */
export const TOAST_DURATION: Record<ToastTone, number> = { info: 5000, success: 4000, warn: 7000, error: 10000 };
const EXIT_MS = 180;

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void }>({
  push: () => {},
});

const TONE_STYLE: Record<ToastTone, { accent: string; badge: string; label: string }> = {
  error: { accent: "border-l-danger", badge: "bg-danger-subtle text-danger", label: "Error" },
  warn: { accent: "border-l-warn", badge: "bg-warn-subtle text-warn", label: "Warning" },
  success: { accent: "border-l-success", badge: "bg-success-subtle text-success", label: "Success" },
  info: { accent: "border-l-info", badge: "bg-info/15 text-info", label: "Info" },
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  const paths = {
    error: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M15 9l-6 6", "M9 9l6 6"],
    warn: ["M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z", "M12 9v4", "M12 17h.01"],
    success: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M8 12.5l2.7 2.7L16 9.8"],
    info: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M12 16v-4", "M12 8h.01"],
  }[tone];
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{paths.map((d) => <path key={d} d={d} />)}</svg>;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const remaining = useRef(TOAST_DURATION[toast.tone]), started = useRef(0), timer = useRef<number | undefined>(undefined);
  const held = useRef({ hover: false, focus: false }), dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; });
  const run = useCallback(() => { window.clearTimeout(timer.current); started.current = Date.now(); timer.current = window.setTimeout(() => dismiss.current(toast.id), remaining.current); }, [toast.id]);
  const sync = (patch: Partial<typeof held.current>) => {
    const before = held.current.hover || held.current.focus; held.current = { ...held.current, ...patch }; const after = held.current.hover || held.current.focus;
    if (!before && after) { window.clearTimeout(timer.current); remaining.current = Math.max(1500, remaining.current - (Date.now() - started.current)); }
    else if (before && !after) run();
  };
  useEffect(() => { run(); return () => window.clearTimeout(timer.current); }, [run]);
  const style = TONE_STYLE[toast.tone];
  return (
    <div
      data-tone={toast.tone}
      onPointerEnter={() => sync({ hover: true })}
      onPointerLeave={() => sync({ hover: false })}
      onFocus={() => sync({ focus: true })}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) sync({ focus: false }); }}
      className={`pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-line border-l-4 ${style.accent} bg-panel py-1.5 pl-3 pr-1 text-sm text-ink shadow-3 transition duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none ${toast.leaving ? "translate-y-2 opacity-0" : "motion-safe:animate-fadeIn"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.badge}`}><ToneIcon tone={toast.tone} /></span>
      <span className="min-w-0 flex-1 py-1.5 leading-snug"><span className="sr-only">{style.label}: </span>{toast.message}</span>
      <button type="button" aria-label="Dismiss notification" title="Dismiss" className="kn-focus grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted hover:bg-elevated hover:text-ink" onClick={() => dismiss.current(toast.id)}><Icon name="close" className="h-4 w-4" /></button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const recent=useRef(new Map<string,number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const key=tone+message,now=Date.now();if(now-(recent.current.get(key)??0)<5000)return;
    recent.current.set(key,now);if(recent.current.size>40)recent.current.delete(recent.current.keys().next().value!);
    const id = idRef.current++;
    setToasts((prev) => [...prev.filter((t) => !t.leaving).slice(-2), { id, message, tone }]);
  }, []);

  const value = useMemo(() => ({ push }), [push]);
  const list = (urgent: boolean) => toasts.filter((t) => (t.tone === "error") === urgent).map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />);

  // Both live regions are always mounted so screen readers register them before the first message arrives.
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed left-1/2 z-(--z-toast) flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}
      >
        <div role="alert" aria-live="assertive" aria-atomic="false" aria-relevant="additions" className="flex w-full flex-col gap-2">{list(true)}</div>
        <div role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions" className="flex w-full flex-col gap-2">{list(false)}</div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
