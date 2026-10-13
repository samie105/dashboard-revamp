/**
 * Class maps for the redesign-port kit (components/dash/). Kept as literal
 * strings so Tailwind sees every class, and kept here so they can be tested.
 */

export type DashTone = "neutral" | "success" | "warning" | "danger" | "info"

/** Badge/notice colours by meaning. Gold stays reserved for action, so no tone uses --primary. */
export const TONE_CLASSES: Record<DashTone, string> = {
  neutral: "bg-foreground/[0.06] text-muted-foreground",
  info: "bg-foreground/[0.06] text-foreground/85",
  success: "bg-credit/[0.12] text-credit",
  warning: "bg-warning/[0.12] text-warning",
  danger: "bg-debit/[0.12] text-debit",
}

export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl"

/** A table column that only appears from a breakpoint up (the preview's progressive columns). */
export const SHOW_FROM: Record<Breakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
}

export function columnVisibility(showFrom: Breakpoint | undefined): string {
  return showFrom ? SHOW_FROM[showFrom] : ""
}
