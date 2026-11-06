import {Icon} from '@/components/Icon';

/** Full-screen state shown while a lesson opens, or when it could not be opened. */
export function BoardLoadState({error,onRetry,onBack}:{error?:string|null;onRetry:()=>void;onBack:()=>void}){
  if(error)return <div className="grid h-dvh w-full place-items-center bg-base p-4 text-ink">
    <div role="alert" className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-6 text-center shadow-2xl">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-panel-2"><Icon name="doc" className="h-7 w-7 text-muted"/></div>
      <h1 className="text-lg font-semibold">This lesson could not be opened</h1>
      <p className="text-sm text-muted">{error}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="kn-focus rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>Retry</button>
        <button type="button" className="kn-focus rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-elevated" onClick={onBack}>Back to library</button>
      </div>
    </div>
  </div>;
  return <div className="grid h-dvh w-full place-items-center bg-base">
    <div className="flex flex-col items-center gap-4" role="status">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand shadow-[0_0_50px_-8px_var(--color-brand-glow)]">
        <Icon name="pen" className="h-8 w-8 text-white" />
      </div>
      <p className="text-sm text-muted">Opening lesson…</p>
    </div>
  </div>;
}
