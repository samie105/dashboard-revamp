"use client"

/**
 * Shared pieces for the three launchpad pages, in the redesign's language.
 *
 * Kept from the previous preview, because they were right:
 *  · status is NEUTRAL (not money direction, not gold) — except Graduating,
 *    which takes the warning tone because it genuinely is an in-between state
 *  · a paused chain looks different from an unbuilt one, and says why in
 *    operations' own words
 *  · an in-flight launch survives closing the tab, and the pages you'd come
 *    back to offer to resume it
 *
 * New: the reviewer-only tools (the pause switch, the figure-provenance list)
 * live together in one collapsed "Preview controls" panel at the foot of each
 * page, instead of sitting in the flow a buyer reads.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, Copy01Icon, PauseIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { CHAIN_LABEL, CHAIN_ORDER, PAUSE_REASONS, setSolana, useAvailability } from "@/components/launchpad-unauth/availability"
import { IN_FLIGHT, usePendingLaunch } from "@/components/launchpad-unauth/pending-launch"
import { GRADUATION_SOL, PROVENANCE, STATUS_LABEL, type Launch, type LaunchStatus } from "@/components/launchpad-unauth/launch-data"
import { Icon, Panel, PanelTitle } from "@/components/redesign/ui"
import { TokenArt } from "@/components/launchpad-unauth/token-art"

/* ── Avatar ───────────────────────────────────────────────────────────── */

/* Corner radius scales with the mark — one radius for every size turned the
   small ones into circles. */
const AVATAR = { sm: "size-8 rounded-[9px]", md: "size-11 rounded-[12px]", lg: "size-16 rounded-[17px]", xl: "size-20 rounded-[21px]" } as const

/**
 * The uploaded icon, or a generated art mark (TokenArt) — never initials on a
 * gradient, which read as a placeholder. The art is seeded from the MINT, the
 * one thing that's unique per token on Solana (names and tickers can repeat);
 * a draft that has no mint yet seeds from its ticker, so the preview changes
 * as you type it.
 */
export function LaunchAvatar({ launch, size = "md", className }: { launch: Pick<Launch, "symbol" | "iconUrl"> & { mint?: string }; size?: keyof typeof AVATAR; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block shrink-0 overflow-hidden ring-1 ring-white/10", AVATAR[size], className)}>
      {launch.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={launch.iconUrl} alt="" className="size-full object-cover" />
      ) : (
        <TokenArt seed={launch.mint || launch.symbol || "draft"} className="size-full" />
      )}
      {/* A hairline of light on the top edge, so the mark sits IN the card. */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]" />
    </span>
  )
}

/* ── Status ───────────────────────────────────────────────────────────── */

export function StatusPill({ status, className }: { status: LaunchStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]",
        status === "graduating" ? "bg-warning/[0.12] text-warning" : status === "graduated" ? "bg-white/[0.07] text-foreground/75" : "bg-white/[0.07] text-foreground/75",
        className,
      )}
    >
      {status === "live" && (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-credit opacity-60 motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-credit" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </span>
  )
}

/* ── Progress to graduation ───────────────────────────────────────────── */

/** Gold while filling, warm as it nears the top, full when graduated. The bar
 *  animates in, so a grid of cards fills like a row of gauges. */
export function ProgressBar({ bps, status, size = "md", className }: { bps: number; status: LaunchStatus; size?: "sm" | "md" | "lg"; className?: string }) {
  const pct = status === "live" ? Math.min(100, bps / 100) : 100
  return (
    <span className={cn("relative block overflow-hidden rounded-full bg-white/[0.07]", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}>
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "absolute inset-0 origin-left rounded-full",
          status === "graduated" ? "bg-credit/80" : status === "graduating" ? "bg-warning" : pct >= 75 ? "bg-gradient-to-r from-primary to-[#ffb020] shadow-[0_0_12px_rgb(250_190_20/0.5)]" : "bg-primary",
        )}
      />
    </span>
  )
}

export const progressLabel = (bps: number, status: LaunchStatus) => (status === "live" ? `${(bps / 100).toFixed(bps < 1000 ? 1 : 0)}%` : status === "graduating" ? "Full" : "Graduated")

export const GRADUATION = `${GRADUATION_SOL} SOL`

/* ── Copy ─────────────────────────────────────────────────────────────── */

export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {})
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 font-mono text-[11.5px] text-muted-foreground transition-colors hover:border-white/[0.14] hover:text-foreground"
    >
      {label ?? `${value.slice(0, 4)}…${value.slice(-4)}`}
      <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5", copied && "text-credit")} />
    </button>
  )
}

/* ── Availability ─────────────────────────────────────────────────────── */

export function ChainChips({ className }: { className?: string }) {
  const availability = useAvailability()
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {CHAIN_ORDER.map((key) => {
        const a = availability[key]
        return (
          <span
            key={key}
            title={a.state === "paused" ? `${CHAIN_LABEL[key]} launches are paused — ${a.reason ?? ""}` : a.state === "soon" ? `${CHAIN_LABEL[key]} launches aren't available yet` : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              a.state === "live" && "border border-credit/25 bg-credit/[0.07] text-foreground",
              a.state === "paused" && "border border-warning/30 bg-warning/[0.1] text-warning",
              a.state === "soon" && "border border-white/[0.06] text-muted-foreground/50",
            )}
          >
            {a.state === "live" && <span className="size-1.5 rounded-full bg-credit" />}
            {a.state === "paused" && <Icon icon={PauseIcon} className="size-3" strokeWidth={2.4} />}
            {CHAIN_LABEL[key]}
            {a.state !== "live" && <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{a.state === "paused" ? "Paused" : "Soon"}</span>}
          </span>
        )
      })}
    </div>
  )
}

/** Renders nothing while Solana is live. When paused: operations' reason
 *  verbatim, and what the pause does and doesn't touch. */
export function PausedNotice({ compact = false }: { compact?: boolean }) {
  const { solana } = useAvailability()
  if (solana.state !== "paused") return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/[0.07] p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning/[0.15] text-warning">
        <Icon icon={PauseIcon} className="size-4" strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13.5px] font-semibold text-foreground">Solana launches and curve trading are paused</span>
        <span className="text-[12.5px] leading-relaxed text-foreground/80">“{solana.reason ?? "No reason given."}”</span>
        {!compact && <span className="text-[12px] text-muted-foreground">Graduated tokens trade on the open market as normal — the pause only touches the curve.</span>}
      </div>
    </div>
  )
}

/* ── Resume ───────────────────────────────────────────────────────────── */

/** "$TICKER is still launching", only while a launch is in flight. */
export function ResumeBanner({ onResume }: { onResume?: () => void }) {
  const pending = usePendingLaunch()
  if (!pending || !IN_FLIGHT.includes(pending.state)) return null
  const symbol = pending.draft.symbol || "your token"
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] px-4 py-3">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
        <span className="relative size-2.5 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px]">
        <span className="font-semibold">${symbol.toUpperCase()} is still launching</span>
        <span className="text-muted-foreground"> — {pending.state === "signing" ? "waiting for your signature" : "confirming on Solana"}.</span>
      </span>
      {onResume ? (
        <button type="button" onClick={onResume} className="dash-gold-btn h-9 rounded-xl px-4 text-[13px] font-semibold">
          Resume
        </button>
      ) : (
        <Link href={`${PREVIEW_ROUTES.launchpad}/create`} className="dash-gold-btn flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold">
          Resume
        </Link>
      )}
    </motion.div>
  )
}

/* ── Preview controls (reviewer only) ─────────────────────────────────── */

/**
 * Everything a reviewer needs and a buyer never should see, in one collapsed
 * panel: the switch that fakes an operations pause (every launchpad page
 * responds to it), and the list of which figures on this page are sourced
 * versus assumed — the backend spec in waiting.
 */
export function PreviewControls({ page }: { page: "discovery" | "token" | "create" }) {
  const [open, setOpen] = React.useState(false)
  const { solana } = useAvailability()
  const rows = PROVENANCE.filter((p) => p.pages.includes(page))
  const assumed = rows.filter((r) => r.kind === "assumed").length

  return (
    <Panel className="border-dashed">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">Preview controls</span>
          <span className="text-[12px] text-muted-foreground">
            Reviewer tools — not part of the product · {assumed} assumed figure{assumed === 1 ? "" : "s"} on this page
          </span>
        </span>
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-5 border-t border-white/[0.06] p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="flex flex-col gap-3">
                <PanelTitle className="text-[14px]">Simulate an operations pause</PanelTitle>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">Production reads this from OperationalControl. Every launchpad page responds — the create form, every curve ticket, the chain chips.</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSolana({ state: "live" })}
                    className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors", solana.state === "live" ? "border-credit/40 bg-credit/[0.07] text-foreground" : "border-white/[0.07] text-muted-foreground hover:text-foreground")}
                  >
                    Solana live
                  </button>
                  {PAUSE_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSolana({ state: "paused", reason: r })}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition-colors",
                        solana.state === "paused" && solana.reason === r ? "border-warning/40 bg-warning/[0.08] text-foreground" : "border-white/[0.07] text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="font-semibold">Paused · </span>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <PanelTitle className="text-[14px]">Where this page&apos;s figures come from</PanelTitle>
                <ul className="flex flex-col divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
                  {rows.map((r) => (
                    <li key={r.figure} className="flex items-start gap-3 px-3.5 py-2.5">
                      <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]", r.kind === "sourced" ? "bg-credit/[0.1] text-credit" : "bg-warning/[0.12] text-warning")}>{r.kind}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[12.5px] font-semibold text-foreground">{r.figure}</span>
                        <span className="text-[11.5px] text-muted-foreground">{r.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
