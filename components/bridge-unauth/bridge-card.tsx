"use client"

/**
 * The bridge card — landscape, route on the left, quote on the right.
 *
 * The live bridge has no route CHOICE at all: "Arbitrum USDC → Intertrain
 * WSK" is written into the component. So the first thing this needs is a
 * picker, and the second is the figures the live panel replaces with prose —
 * it prints "Settlement: After source finality" where an ETA belongs, and
 * shows no fee and no limits anywhere.
 *
 * Same shape as the swap card on purpose. Bridging and swapping are the same
 * gesture with a different middle, and two screens that do the same thing
 * should not be two different screens.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowDataTransferHorizontalIcon,
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { HERO_HUE, PANEL } from "@/components/preview/surface"
import {
  ROUTES,
  chainById,
  formatAmount,
  formatDuration,
  formatUSD,
  quoteRoute,
  routeById,
  type Route,
} from "@/components/bridge-unauth/bridge-data"

function Line({
  label,
  value,
  tone,
  hint,
  strong,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "muted" | "credit"
  hint?: string
  strong?: boolean
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="ws-icon-mono h-3 w-3 text-muted-foreground/60"
          />
        )}
      </span>
      <span
        title={hint}
        className={cn(
          "tabular-nums",
          strong ? "text-[13.5px] font-semibold" : "font-medium",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
          tone === "credit" && "text-credit",
        )}
      >
        {value}
      </span>
    </span>
  )
}

/** One selectable lane. */
function RouteOption({
  route,
  active,
  onSelect,
}: {
  route: Route
  active: boolean
  onSelect: () => void
}) {
  const from = chainById(route.from)
  const to = chainById(route.to)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
        active ? "bg-primary/[0.12] ring-1 ring-primary/40" : cn(PANEL, "hover:bg-accent/60"),
      )}
    >
      <span className="flex shrink-0 items-center -space-x-2">
        <CoinAvatar symbol={from.symbol} size="md" />
        <CoinAvatar symbol={to.symbol} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
          {from.name}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="ws-icon-mono h-3 w-3 shrink-0 text-muted-foreground"
          />
          {to.name}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {route.asset}
          {route.receiveAsset !== route.asset ? ` → ${route.receiveAsset}` : ""} · {route.relay}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end leading-tight">
        <span className="text-[11.5px] font-semibold tabular-nums">
          {route.feePct === 0 ? "No fee" : `${(route.feePct * 100).toFixed(2)}%`}
        </span>
        <span className="text-[10.5px] tabular-nums text-muted-foreground">
          {formatAmount(route.balance, 2)} {route.asset}
        </span>
      </span>
      {active && (
        <HugeiconsIcon icon={Tick02Icon} className="ws-icon-mono h-3.5 w-3.5 shrink-0 text-primary" />
      )}
    </button>
  )
}

export function BridgeCard({
  routeId,
  onRoute,
}: {
  routeId: string
  onRoute: (id: string) => void
}) {
  const [amount, setAmount] = React.useState("")
  const route = routeById(routeId)
  const from = chainById(route.from)
  const to = chainById(route.to)
  const value = Number(amount) || 0
  const q = quoteRoute(route, value)

  const ready = value > 0 && !q.problem
  // The live CTA is a chain of ternaries that puts strings like "Modern
  // wallet backend is not enabled" on the button face. A button says what
  // pressing it does; the reason it cannot be pressed belongs beside the
  // field that caused it.
  const cta = value > 0 ? `Bridge ${formatAmount(value, 2)} ${route.asset}` : "Enter an amount"

  return (
    <CardShell className={HERO_HUE}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ── Left: route + amount ────────────────────────────────────── */}
        <div className="flex flex-col gap-4 p-5 lg:p-6">
          <span className="flex flex-col">
            <span className="font-display text-[17px] font-semibold leading-tight">Bridge</span>
            <span className="text-[12px] text-muted-foreground">
              Move assets between chains
            </span>
          </span>

          <div className="flex flex-col gap-2">
            <Eyebrow className="text-[11px]">Route</Eyebrow>
            <div className="slim-scroll flex max-h-[15rem] flex-col gap-1.5 overflow-y-auto">
              {ROUTES.map((r) => (
                <RouteOption key={r.id} route={r} active={r.id === routeId} onSelect={() => onRoute(r.id)} />
              ))}
            </div>
          </div>

          <div className={cn("flex flex-col gap-2 rounded-2xl p-4", PANEL)}>
            <span className="flex items-baseline justify-between gap-2">
              <Eyebrow className="text-[11px]">You send</Eyebrow>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Balance {formatAmount(route.balance, 2)} {route.asset} on {from.name}
              </span>
            </span>
            <div className="flex items-center gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Amount to bridge"
                className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-light tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
              <span className="flex shrink-0 items-center gap-2 rounded-full bg-card/70 py-1.5 pl-1.5 pr-3 ring-1 ring-border/60">
                <CoinAvatar symbol={route.asset} size="md" />
                <span className="text-[13.5px] font-semibold">{route.asset}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {/* Limits, stated. The live panel has none. */}
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Min {formatAmount(route.minAmount, 2)} · Max{" "}
                {route.maxAmount.toLocaleString("en-US")} {route.asset}
              </span>
              <div className="flex gap-1">
                {[25, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount((route.balance * (p / 100)).toFixed(2))}
                    className="h-6 rounded-full bg-card/60 px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
            {q.problem && (
              <span className="text-[11.5px] font-medium text-debit">{q.problem}</span>
            )}
          </div>
        </div>

        {/* ── Right: the quote ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 border-t border-border/40 p-5 lg:border-l lg:border-t-0 lg:p-6">
          {/* The lane, drawn. */}
          <div className={cn("flex items-center gap-3 rounded-xl p-3.5", PANEL)}>
            <span className="flex flex-1 flex-col items-center gap-1">
              <CoinAvatar symbol={from.symbol} size="lg" />
              <span className="text-[11.5px] font-semibold">{from.name}</span>
              <span className="text-[10.5px] text-muted-foreground">{route.asset}</span>
            </span>
            <span className="flex flex-col items-center gap-0.5 text-muted-foreground">
              <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} className="ws-icon-mono h-4 w-4" />
              <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.06em]">
                {formatDuration(q.etaSeconds)}
              </span>
            </span>
            <span className="flex flex-1 flex-col items-center gap-1">
              <CoinAvatar symbol={to.symbol} size="lg" />
              <span className="text-[11.5px] font-semibold">{to.name}</span>
              <span className="text-[10.5px] text-muted-foreground">{route.receiveAsset}</span>
            </span>
          </div>

          <div className={cn("flex flex-col gap-2 rounded-xl p-3.5", PANEL)}>
            <Eyebrow className="text-[11px]">Quote</Eyebrow>
            <Line
              label="You receive"
              value={value > 0 ? `${formatAmount(q.receive, 4)} ${route.receiveAsset}` : "—"}
              strong
            />
            <Line
              label="Rate"
              value={`1 ${route.asset} = ${route.rate} ${route.receiveAsset}`}
              tone="muted"
            />
            <Line
              label="Bridge fee"
              value={
                route.feePct === 0
                  ? "None"
                  : value > 0
                    ? `${formatAmount(q.bridgeFee, 4)} ${route.asset}`
                    : `${(route.feePct * 100).toFixed(2)}%`
              }
              tone={route.feePct === 0 ? "credit" : "muted"}
            />
            <Line
              label="Destination gas"
              value={route.destinationGasUsd === 0 ? "Covered" : formatUSD(route.destinationGasUsd)}
              tone={route.destinationGasUsd === 0 ? "credit" : "muted"}
            />
            {/* An ETA, not "after source finality". */}
            <Line label="Arrives in" value={`~${formatDuration(q.etaSeconds)}`} hint="Source finality plus relay time" />
            <Line
              label="Route liquidity"
              value={`${formatAmount(route.liquidity, 0)} ${route.receiveAsset}`}
              tone="muted"
            />
          </div>

          <div className={cn("flex flex-col gap-2 rounded-xl p-3.5", PANEL)}>
            <Eyebrow className="text-[11px]">What happens</Eyebrow>
            <ol className="flex flex-col gap-2">
              {[
                { n: 1, label: "Confirm on source", detail: `${from.confirmations} confirmations on ${from.name}` },
                { n: 2, label: "Relay", detail: `${route.relay} attests the transfer` },
                { n: 3, label: "Mint on destination", detail: `${route.receiveAsset} issued on ${to.name}` },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/[0.15] text-[9.5px] font-bold text-primary">
                    {s.n}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[12.5px] font-medium">{s.label}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            disabled={!ready}
            className={cn(
              "mt-auto h-12 shrink-0 rounded-xl text-[14.5px] font-semibold transition-colors",
              ready
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : cn(PANEL, "cursor-not-allowed text-muted-foreground"),
            )}
          >
            {cta}
          </button>
        </div>
      </div>
    </CardShell>
  )
}
