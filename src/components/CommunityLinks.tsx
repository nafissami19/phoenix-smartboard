import { BRANDING } from '@/config/branding';

export function CommunityLinks() {
  return (
    <nav aria-label={`${BRANDING.APP_NAME} community`} className="rounded-xl border border-line p-4 text-left">
      <h3 className="mb-3 text-sm font-semibold">Community & Resources</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={BRANDING.CREDITS.DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="kn-focus flex min-h-11 items-center gap-3 rounded-lg border border-line bg-base px-3 py-2 text-sm hover:bg-elevated"
        >
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e63946] font-bold text-white">
            P
          </span>
          <span>Source & Documentation</span>
          <span aria-hidden="true" className="ml-auto text-muted">↗</span>
        </a>
        <a
          href={BRANDING.CREDITS.RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="kn-focus flex min-h-11 items-center gap-3 rounded-lg border border-line bg-base px-3 py-2 text-sm hover:bg-elevated"
        >
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2a9d8f] font-bold text-white">
            📦
          </span>
          <span>Releases & Downloads</span>
          <span aria-hidden="true" className="ml-auto text-muted">↗</span>
        </a>
      </div>
      <section className="mt-4 border-t border-line pt-4" aria-label={`About ${BRANDING.APP_NAME}`}>
        <h3 className="mb-2 text-sm font-semibold">{BRANDING.APP_NAME}</h3>
        <p className="mb-3 text-xs text-muted">{BRANDING.APP_SLOGAN}</p>
        <a
          href={BRANDING.CREDITS.ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="kn-focus inline-flex min-h-11 items-center rounded-lg border border-line bg-base px-4 py-2 text-xs font-medium text-ink hover:bg-elevated"
        >
          Report an issue or feature request ↗
        </a>
      </section>
    </nav>
  );
}
