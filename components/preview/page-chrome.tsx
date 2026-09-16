/**
 * Shared furniture for the design-preview pages.
 *
 * No "use client" and no hooks on purpose — these render inside server
 * components, which also rules out <HugeiconsIcon> (a forwardRef with no
 * client directive). The one icon here is inline SVG for that reason.
 */

/** A section rule — the label, then a hairline running to the end of the row.
 *  Cheap, and it does what four more card titles could not: it groups. */
export function SectionRule({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/50" />
      {note && <span className="shrink-0 text-[11px] text-muted-foreground/70">{note}</span>}
    </div>
  )
}

/**
 * The standing disclaimer. These pages are reachable WITHOUT a session and
 * every figure on them is invented, so each one says so once, at the top,
 * rather than letting someone read a stranger's portfolio into it.
 */
export function PreviewNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2.5">
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5.2v.01M8 7.4v3.4" />
      </svg>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Design preview.</span> {children}
      </p>
    </div>
  )
}
