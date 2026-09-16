"use client"

/**
 * In-flight transfers, and the history under them.
 *
 * This is the half the live bridge does not have at all. You press its button
 * and the screen tells you nothing further — but a bridge is three distinct
 * waits, the middle one is the long one, and the minutes you spend in it are
 * exactly when people re-send or open support.
 *
 * Each transfer shows which stage it is in, how far through, and how long is
 * left. It reuses the app's own money-flow stage grammar
 * (`ws-stage-rail-active`, `ws-stage-halo`) so a bridge in progress looks like
 * every other staged transfer in the product.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, LinkSquare02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import {
  HISTORY,
  IN_FLIGHT,
  STAGES,
  ago,
  chainById,
  formatAmount,
  formatDuration,
  routeById,
  type BridgeRecord,
  type Transfer,
} from "@/components/bridge-unauth/bridge-data"

/* ── One moving transfer ──────────────────────────────────────────────────── */

function InFlightRow({ t }: { t: Transfer }) {
  const route = routeById(t.routeId)
  const from = chainById(route.from)
  const to = chainById(route.to)
  const activeIndex = STAGES.findIndex((s) => s.key === t.stage)

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex shrink-0 items-center -space-x-2">
          <CoinAvatar symbol={from.symbol} size="md" />
          <CoinAvatar symbol={to.symbol} size="md" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            {formatAmount(t.amount, 2)} {route.asset}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="ws-icon-mono h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            {formatAmount(t.receive, 2)} {route.receiveAsset}
          </span>
          <span className="truncate text-[11.5px] text-muted-foreground">
            {from.name} → {to.name} · {route.relay}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-chip px-2 py-1 text-[11.5px] font-semibold text-warning">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
            </span>
            {formatDuration(t.etaSeconds)} left
          </span>
          <button
            type="button"
            title={`View ${t.txid} on the explorer`}
            className="ws-icon-mono hidden shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {t.txid.slice(0, 8)}…
            <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
          </button>
        </span>
      </div>

      {/* The three waits, with the current one alive. */}
      <ol className="grid grid-cols-3 gap-2">
        {STAGES.map((s, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "waiting"
          return (
            <li key={s.key} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  {state === "active" && (
                    <span className="ws-stage-halo absolute h-2 w-2 rounded-full bg-primary" />
                  )}
                  <span
                    className={cn(
                      "relative flex h-4 w-4 items-center justify-center rounded-full",
                      state === "done" && "bg-credit-chip text-credit",
                      state === "active" && "bg-primary text-primary-foreground",
                      state === "waiting" && "bg-foreground/[0.08] text-muted-foreground/50",
                    )}
                  >
                    {state === "done" ? (
                      <HugeiconsIcon icon={Tick02Icon} className="ws-icon-mono h-2.5 w-2.5" />
                    ) : (
                      <span className="text-[9px] font-bold tabular-nums">{i + 1}</span>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "truncate text-[11.5px] font-medium",
                    state === "waiting" && "text-muted-foreground/50",
                  )}
                >
                  {s.label}
                </span>
              </span>
              <span
                className={cn(
                  "block h-1 w-full overflow-hidden rounded-full",
                  state === "active" ? "ws-stage-rail-active" : "bg-foreground/[0.08]",
                )}
              >
                {state === "done" && <span className="block h-full w-full rounded-full bg-credit/60" />}
                {state === "active" && (
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${t.stagePct}%` }}
                  />
                )}
              </span>
              <span className="truncate text-[10.5px] leading-tight text-muted-foreground">
                {s.detail(route)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function InFlight() {
  if (IN_FLIGHT.length === 0) return null
  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="In flight"
        subtitle={`${IN_FLIGHT.length} transfer${IN_FLIGHT.length > 1 ? "s" : ""} moving now`}
        badge={
          <span className="inline-flex items-center rounded-full bg-warning-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
            Live
          </span>
        }
      />
      <div className="flex flex-col divide-y divide-border/25 border-t border-border/40">
        {IN_FLIGHT.map((t) => (
          <InFlightRow key={t.id} t={t} />
        ))}
      </div>
    </CardShell>
  )
}

/* ── History ──────────────────────────────────────────────────────────────── */

function HistoryRow({ b }: { b: BridgeRecord }) {
  const route = routeById(b.routeId)
  const from = chainById(route.from)
  const to = chainById(route.to)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/40">
      <span className="flex shrink-0 items-center -space-x-2">
        <CoinAvatar symbol={from.symbol} size="md" />
        <CoinAvatar symbol={to.symbol} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
          {from.name}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="ws-icon-mono h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
          {to.name}
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">
          {route.relay} · took {formatDuration(b.tookSeconds)} · {ago(b.minutesAgo)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end leading-tight">
        <span className="whitespace-nowrap text-[13.5px] font-semibold tabular-nums">
          <span className="text-debit">−{formatAmount(b.amount, 4)}</span>
          <span className="text-muted-foreground"> → </span>
          <span className={cn(b.receive > 0 ? "text-credit" : "text-muted-foreground")}>
            +{formatAmount(b.receive, 4)}
          </span>
        </span>
        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
          {route.asset} → {route.receiveAsset}
        </span>
      </span>
      <span className="shrink-0">
        {b.status === "completed" ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-foreground/[0.07] px-2 py-1 text-[11.5px] font-medium text-muted-foreground">
            Completed
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-[11.5px] font-semibold capitalize",
              b.status === "refunded" ? "bg-warning-chip text-warning" : "bg-debit-chip text-debit",
            )}
          >
            {b.status}
          </span>
        )}
      </span>
    </div>
  )
}

export function BridgeHistory() {
  const [tab, setTab] = React.useState<"all" | "completed" | "refunded">("all")
  const rows = tab === "all" ? HISTORY : HISTORY.filter((b) => b.status === tab)
  const refunded = HISTORY.filter((b) => b.status === "refunded").length

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader title="Past transfers" subtitle={`${HISTORY.length} bridges settled`} />
      <div className="scrollbar-none overflow-x-auto border-t border-border/40 px-4 py-2.5">
        <Segmented
          size="sm"
          options={[
            { key: "all", label: "All" },
            { key: "completed", label: "Completed" },
            { key: "refunded", label: `Refunded (${refunded})` },
          ]}
          value={tab}
          onChange={(k) => setTab(k as typeof tab)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="Bridges appear here once they settle." />
      ) : (
        <div className="flex flex-col divide-y divide-border/25 border-t border-border/40">
          {rows.map((b) => (
            <HistoryRow key={b.id} b={b} />
          ))}
        </div>
      )}
    </CardShell>
  )
}
