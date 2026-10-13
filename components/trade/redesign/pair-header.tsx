"use client"

/**
 * The preview's pair header (components/trade-unauth/pair-header.tsx) on the
 * real market: the pair button that opens the picker, the price and its 24h
 * move, the day's figures, and the Spot / Futures switch.
 *
 * Swapped for real data: every figure is the one the previous header showed
 * (the chart feed's and the book's own numbers). The picker's list is the
 * real one (the full registry, with its search, chain filter and favourites),
 * opened under the pair button. Left out because no feed carries them: market
 * cap; and on futures the mark / index split, funding and its countdown, and
 * open interest. Simple mode hides the figures row, as before.
 */

import * as React from "react"
import { motion } from "motion/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Icon, Panel, SLIDE } from "@/components/dashboard/redesign/ui"
import { formatPrice } from "@/components/trade/redesign/candle-chart"

export type Venue = "spot" | "futures"

function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—"
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n)}`
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-foreground">{children}</span>
    </div>
  )
}

function VenueSwitch({ venue, onVenue, id, className }: { venue: Venue; onVenue: (v: Venue) => void; id: string; className?: string }) {
  return (
    <div role="tablist" className={cn("grid-cols-2 gap-1 rounded-xl border border-foreground/[0.06] bg-foreground/[0.025] p-1", className)}>
      {(["spot", "futures"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          type="button"
          aria-selected={venue === v}
          onClick={() => onVenue(v)}
          className={cn("relative h-9 rounded-lg px-4 text-[13px] font-semibold capitalize transition-colors", venue === v ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {venue === v && <motion.span layoutId={id} transition={SLIDE} className="ds-gold absolute inset-0 rounded-lg" />}
          <span className="relative">{v}</span>
        </button>
      ))}
    </div>
  )
}

export function PairHeader({
  venue,
  onVenue,
  symbol,
  quote,
  icon,
  subtitle,
  price,
  changePct,
  high24h,
  low24h,
  volume24h,
  network,
  maxLeverage,
  showStats,
  pickerOpen,
  onTogglePicker,
  picker,
}: {
  venue: Venue
  onVenue: (v: Venue) => void
  symbol: string
  quote: string
  icon?: string | null
  /** Second line under the pair: the chain on spot, "Perpetual · N×" on futures. */
  subtitle: string
  price: number
  changePct: number | null
  high24h: number | null
  low24h: number | null
  volume24h: number | null
  network: string | null
  maxLeverage?: number | null
  showStats: boolean
  pickerOpen: boolean
  onTogglePicker: () => void
  /** The real picker, opened under the pair button. */
  picker: React.ReactNode
}) {
  const up = (changePct ?? 0) >= 0
  const pairButton = (compact: boolean) => (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={pickerOpen}
      onClick={onTogglePicker}
      className={cn("flex min-w-0 items-center rounded-2xl transition-colors", compact ? "gap-2 px-1 py-1" : "gap-3 px-2 py-1.5", pickerOpen ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.04]")}
    >
      <CoinAvatar symbol={symbol} src={icon ?? undefined} size="lg" className={cn("ring-1 ring-foreground/10", compact ? "size-8" : "size-10")} />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className={cn("flex items-center gap-1.5 font-display font-semibold tracking-[-0.02em]", compact ? "text-[16px]" : "text-[18px]")}>
          {symbol || "—"}
          <span className="text-muted-foreground">/{quote}</span>
          {venue === "futures" && !compact && <span className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-primary">Perp</span>}
        </span>
        <span className={cn("truncate text-[12px]", compact && venue === "futures" ? "font-semibold text-primary" : "text-muted-foreground")}>{subtitle}</span>
      </span>
      <Icon icon={ArrowDown01Icon} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", pickerOpen && "rotate-180")} strokeWidth={2} />
    </button>
  )
  return (
    <Panel className="relative overflow-visible">
      {/* The picker, once: fixed across the screen on a phone, under the pair
          button from sm up. */}
      {picker}

      {/* ── Phone: the preview's compact header (components/trade-unauth/mobile.tsx) ── */}
      <div className="flex flex-col gap-3 p-3 lg:hidden">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">{pairButton(true)}</div>
          <div role="tablist" className="grid shrink-0 grid-cols-2 gap-0.5 rounded-xl border border-foreground/[0.07] bg-foreground/[0.03] p-0.5">
            {(["spot", "futures"] as const).map((v) => (
              <button key={v} role="tab" type="button" aria-selected={venue === v} onClick={() => onVenue(v)} className={cn("relative h-8 rounded-lg px-2.5 text-[12px] font-semibold capitalize", venue === v ? "text-primary-foreground" : "text-muted-foreground")}>
                {venue === v && <motion.span layoutId="venue-mobile" transition={SLIDE} className="ds-gold absolute inset-0 rounded-lg" />}
                <span className="relative">{v === "futures" ? "Perps" : "Spot"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-baseline gap-2.5 px-1">
          <motion.span
            key={symbol}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums", changePct == null ? "text-foreground" : up ? "text-credit" : "text-debit")}
          >
            {price > 0 ? formatPrice(price) : "—"}
          </motion.span>
          {changePct != null && (
            <span className={cn("text-[13px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
              {up ? "+" : "−"}
              {Math.abs(changePct).toFixed(2)}% <span className="font-medium text-muted-foreground">24h</span>
            </span>
          )}
        </div>
        {showStats && (
          <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-foreground/[0.06] bg-foreground/[0.06] text-[11px]">
            {(
              [
                ["High", high24h ? formatPrice(high24h) : "—"],
                ["Low", low24h ? formatPrice(low24h) : "—"],
                ["Vol", compact(volume24h)],
                venue === "futures" ? ["Max lev.", maxLeverage ? `${maxLeverage}×` : "—"] : ["Network", network ?? "—"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 bg-card px-2.5 py-2 dark:bg-[color-mix(in_oklab,var(--card)_40%,var(--background))]">
                <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
                <dd className="truncate text-[12px] font-semibold tabular-nums text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* ── lg and up: the preview's header row ── */}
      <div className="hidden p-3 lg:flex lg:flex-row lg:items-center lg:gap-6 lg:pr-4">
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={onTogglePicker}
            className={cn("flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors", pickerOpen ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.04]")}
          >
            <CoinAvatar symbol={symbol} src={icon ?? undefined} size="lg" className="size-10 ring-1 ring-foreground/10" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="flex items-center gap-1.5 font-display text-[18px] font-semibold tracking-[-0.02em]">
                {symbol || "—"}
                <span className="text-muted-foreground">/{quote}</span>
                {venue === "futures" && <span className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-primary">Perp</span>}
              </span>
              <span className="truncate text-[12px] text-muted-foreground">{subtitle}</span>
            </span>
            <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", pickerOpen && "rotate-180")} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-baseline gap-2.5 px-2 lg:flex-col lg:items-start lg:gap-0.5 lg:px-0">
          <motion.span
            key={symbol}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums", changePct == null ? "text-foreground" : up ? "text-credit" : "text-debit")}
          >
            {price > 0 ? formatPrice(price) : "—"}
          </motion.span>
          {changePct != null && (
            <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
              {up ? "+" : "−"}
              {Math.abs(changePct).toFixed(2)}%
            </span>
          )}
        </div>

        {/* The day's figures scroll sideways on narrow screens. */}
        {showStats ? (
          <div className="scrollbar-none -mx-1 flex items-center gap-6 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-1 lg:px-0 lg:pb-0">
            <Stat label="24h high">{high24h ? formatPrice(high24h) : "—"}</Stat>
            <Stat label="24h low">{low24h ? formatPrice(low24h) : "—"}</Stat>
            <Stat label="24h volume">{compact(volume24h)}</Stat>
            {venue === "futures" ? <Stat label="Max leverage">{maxLeverage ? `${maxLeverage}×` : "—"}</Stat> : <Stat label="Network">{network ?? "—"}</Stat>}
          </div>
        ) : (
          <div className="hidden lg:block lg:flex-1" />
        )}

        <VenueSwitch venue={venue} onVenue={onVenue} id="venue-d" className="hidden lg:grid" />
      </div>
    </Panel>
  )
}
