"use client"

/**
 * The bridge page body: the form, and beside it the lane you've picked
 * (path, liquidity, limits), what's moving right now, and what moved before.
 *
 * "Moving now" is live: each in-flight transfer advances through its stages
 * and counts its ETA down after mount, then lands in "Arrived". Starting
 * values come from the data file, so the server render is still fixed.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight01Icon, Clock01Icon, DropletIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import {
  DEFAULT_ROUTE,
  HISTORY,
  IN_FLIGHT,
  STAGES,
  ago,
  chainById,
  formatAmount,
  formatDuration,
  quoteRoute,
  routeById,
  type BridgeRecord,
  type Route,
  type StageKey,
} from "@/components/bridge-unauth/bridge-data"
import { BridgeTicket, chainMark } from "@/components/bridge-unauth/ticket"
import { Figure, Icon, MoreLink, Panel, PanelTitle } from "@/components/redesign/ui"

/* ── Lane card ────────────────────────────────────────────────────────── */

function LaneCard({ route }: { route: Route }) {
  const from = chainById(route.from)
  const to = chainById(route.to)
  const eta = quoteRoute(route, 0).etaSeconds
  // How much of the destination's pool the per-transfer max could take —
  // a lane near the edge is one where big transfers start failing.
  const depth = Math.min(1, route.maxAmount / route.liquidity)

  return (
    <Panel className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <PanelTitle className="text-[16px]">Lane</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">via {route.relay}</span>
      </div>

      {/* The path, drawn: source → relay → destination, with a packet
          travelling along it. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={route.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
        >
          <span className="flex flex-col items-center gap-2 text-center">
            <CoinAvatar symbol={chainMark(route.from)} size="lg" className="size-12 ring-1 ring-white/10" />
            <span className="text-[12.5px] font-semibold text-foreground">{from.name}</span>
            <span className="text-[11px] text-muted-foreground">{route.asset}</span>
          </span>
          <span className="relative mx-1 flex h-12 items-center">
            <span className="h-px w-full border-t border-dashed border-primary/35" />
            <motion.span
              animate={{ left: ["0%", "100%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/[0.08] bg-[#121212] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
              ~{formatDuration(eta)}
            </span>
          </span>
          <span className="flex flex-col items-center gap-2 text-center">
            <CoinAvatar symbol={chainMark(route.to)} size="lg" className="size-12 ring-1 ring-white/10" />
            <span className="text-[12.5px] font-semibold text-foreground">{to.name}</span>
            <span className="text-[11px] text-muted-foreground">{route.receiveAsset}</span>
          </span>
        </motion.div>
      </AnimatePresence>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
        {[
          { k: "Fee", v: route.feePct === 0 ? "Free" : `${(route.feePct * 100).toFixed(2)}%` },
          { k: "Minimum", v: `${route.minAmount} ${route.asset}` },
          { k: "Maximum", v: `${route.maxAmount.toLocaleString("en-US")}` },
          { k: "Finality", v: `${from.confirmations} blocks` },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-1 bg-[#111] px-3.5 py-3">
            <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
            <dd className="truncate text-[13.5px] font-semibold tabular-nums text-foreground">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Icon icon={DropletIcon} className="size-3.5" />
            Liquidity on {to.name}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {route.liquidity.toLocaleString("en-US")} {route.receiveAsset}
          </span>
        </div>
        <span className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.span
            key={route.id}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 - depth }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className={cn("absolute inset-0 origin-left rounded-full", depth > 0.5 ? "bg-warning" : "bg-credit/80")}
          />
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          {depth > 0.5 ? "Thin — large transfers may need to wait for liquidity." : "Deep — even a maximum-size transfer fits comfortably."}
        </span>
      </div>
    </Panel>
  )
}

/* ── Moving now (live) ────────────────────────────────────────────────── */

type Live = { id: string; routeId: string; amount: number; receive: number; stage: number; pct: number; eta: number }

const STAGE_INDEX: Record<StageKey, number> = { source: 0, relay: 1, destination: 2 }

function useLiveTransfers() {
  const [items, setItems] = React.useState<Live[]>(() =>
    IN_FLIGHT.map((t) => ({ id: t.id, routeId: t.routeId, amount: t.amount, receive: t.receive, stage: STAGE_INDEX[t.stage], pct: t.stagePct, eta: t.etaSeconds })),
  )
  React.useEffect(() => {
    // Real seconds: the ETA counts down one per second, and a stage takes
    // ~50s (2% a tick) — slow enough that someone opening the page sees
    // transfers moving, not a list that has already said "All arrived".
    const t = window.setInterval(() => {
      setItems((list) =>
        list.map((x) => {
          if (x.stage >= STAGES.length) return x
          const pct = x.pct + 2
          const eta = Math.max(0, x.eta - 1)
          return pct >= 100 ? { ...x, stage: x.stage + 1, pct: 0, eta } : { ...x, pct, eta }
        }),
      )
    }, 1000)
    return () => window.clearInterval(t)
  }, [])
  return items
}

function MovingNow() {
  const items = useLiveTransfers()
  const moving = items.filter((x) => x.stage < STAGES.length).length

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <PanelTitle className="text-[16px]">Moving now</PanelTitle>
          {moving > 0 && (
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
          )}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">{moving > 0 ? `${moving} in flight` : "All arrived"}</span>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((x) => {
          const r = routeById(x.routeId)
          const arrived = x.stage >= STAGES.length
          const stage = STAGES[Math.min(x.stage, STAGES.length - 1)]
          // Overall progress across the three stages, for the single bar.
          const overall = arrived ? 100 : ((x.stage + x.pct / 100) / STAGES.length) * 100
          return (
            <li key={x.id} className={cn("flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors duration-500", arrived ? "border-credit/25 bg-credit/[0.04]" : "border-white/[0.07] bg-white/[0.02]")}>
              <div className="flex items-center gap-3">
                <span className="flex shrink-0 items-center -space-x-2">
                  <CoinAvatar symbol={chainMark(r.from)} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
                  <CoinAvatar symbol={chainMark(r.to)} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">
                    <Figure mask="••••">{`${formatAmount(x.amount, 4)} ${r.asset}`}</Figure>
                    <span className="font-medium text-muted-foreground"> → {chainById(r.to).name}</span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">{arrived ? `Arrived as ${formatAmount(x.receive, 4)} ${r.receiveAsset}` : `${stage.label} · ${stage.detail(r)}`}</span>
                </span>
                <span className={cn("flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums", arrived ? "text-credit" : "text-foreground/80")}>
                  <Icon icon={arrived ? Tick02Icon : Clock01Icon} className="size-3.5" strokeWidth={arrived ? 2.6 : 1.8} />
                  {arrived ? "Done" : `~${formatDuration(x.eta)}`}
                </span>
              </div>
              <div className="flex gap-1">
                {STAGES.map((s, i) => (
                  <span key={s.key} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <span
                      className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear", arrived || i < x.stage ? "bg-credit/80" : "bg-primary")}
                      style={{ width: `${arrived || i < x.stage ? 100 : i === x.stage ? x.pct : 0}%` }}
                    />
                  </span>
                ))}
              </div>
              <span className="sr-only">{Math.round(overall)}% complete</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ── History ──────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<BridgeRecord["status"], string> = {
  completed: "bg-credit/[0.1] text-credit",
  refunded: "bg-warning/[0.12] text-warning",
  failed: "bg-debit/[0.12] text-debit",
}

function History() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex items-center justify-between px-2">
        <PanelTitle className="text-[16px]">Recent bridges</PanelTitle>
        <MoreLink icon={ArrowRight01Icon} href={PREVIEW_ROUTES.transactions}>
          All
        </MoreLink>
      </div>
      <ul className="flex flex-col">
        {HISTORY.map((h) => {
          const r = routeById(h.routeId)
          return (
            <li key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.025]">
              <span className="flex shrink-0 -space-x-2.5">
                <CoinAvatar symbol={chainMark(r.from)} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
                <CoinAvatar symbol={chainMark(r.to)} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                  <span className="truncate">
                    {chainById(r.from).name} → {chainById(r.to).name}
                  </span>
                  <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]", STATUS_STYLE[h.status])}>{h.status}</span>
                </span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {r.relay} · took {formatDuration(h.tookSeconds)} · {ready ? ago(h.minutesAgo) : " "}
                </span>
              </span>
              <span className="flex flex-col items-end tabular-nums">
                <span className={cn("text-[13px] font-semibold", h.status === "completed" ? "text-credit" : "text-muted-foreground")}>
                  <Figure mask="••••">{h.status === "completed" ? `+${formatAmount(h.receive, 4)} ${r.receiveAsset}` : "Returned"}</Figure>
                </span>
                <span className="text-[12px] text-muted-foreground">
                  <Figure mask="••••">{`${formatAmount(h.amount, 4)} ${r.asset}`}</Figure>
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function BridgeWorkspace() {
  const [routeId, setRouteId] = React.useState(DEFAULT_ROUTE)
  const route = routeById(routeId)

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <BridgeTicket route={route} onRoute={setRouteId} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <div className="rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
          <LaneCard route={route} />
        </div>
        <div className="rise grid grid-cols-1 items-start gap-4 md:gap-5 2xl:grid-cols-2" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
          <MovingNow />
          <History />
        </div>
      </div>
    </div>
  )
}
