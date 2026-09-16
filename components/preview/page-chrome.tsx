/**
 * Shared furniture for the design-preview pages.
 *
 * No "use client" and no hooks on purpose — these render inside server
 * components, which also rules out <HugeiconsIcon> (a forwardRef with no
 * client directive). The one icon here is inline SVG for that reason.
 */

/* SectionRule now lives in the design system — three pages had grown the
   same copy. Re-exported so the preview pages import it from one place. */
export { SectionRule } from "@/components/ui/system"

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
