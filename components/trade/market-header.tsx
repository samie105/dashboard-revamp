"use client"

/**
 * MarketHeader — the workspace's hero.
 *
 * Facts in the order a trader reads them: WHICH pair (avatar, symbol, quote,
 * chain), what it costs RIGHT NOW (the large light figure, in the house
 * Balance register), how the DAY has gone (change chip, then the day's traded
 * range as a bar rather than two loose numbers), and how it sits over other
 * windows. Nothing here is decorative: the tick flash fires only when the
 * price actually moved, and the heartbeat pulses only when a poll landed — a
 * dead feed goes visibly still.
 *
 * Pure display. The pair picker is handed in as a node so the header can own
 * the trigger's anchor without owning the picker's state.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { DeltaChip, Eyebrow } from "@/components/ui/system"

/**
 * A price, with its decimal places PINNED.
 *
 * `maximumFractionDigits` alone drops trailing zeros, so a live figure walked
 * between "$99.3" and "$99.46" and back — the width changing under a reader's
 * eye on the one number this screen exists to show. Tabular numerals only hold
 * a column still if the number of digits is stable, so the minimum is set too.
 * Sub-dollar tokens still get up to six places; they need them.
 */
export function fmtPx(p: number) {
  return p < 1
    ? p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtCompact(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

/** A labelled figure — Eyebrow over a tabular value. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 flex-col gap-1">
      <Eyebrow className="text-[10px] tracking-[0.1em]">{label}</Eyebrow>
      <span className="text-[13px] leading-none font-medium tabular-nums">
        {value}
      </span>
    </span>
  )
}

/** A signed percentage over a named window, in the money colours. */
function WindowChange({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex shrink-0 flex-col gap-1">
      <Eyebrow className="text-[10px] tracking-[0.1em]">{label}</Eyebrow>
      <span
        className={cn(
          "text-[13px] leading-none font-medium tabular-nums",
          value >= 0 ? "text-credit" : "text-debit"
        )}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}%
      </span>
    </span>
  )
}

/**
 * The day's traded range, with a marker where the current price sits inside it.
 *
 * Two numbers in two columns ("24h high $99.46 · 24h low $95.54") make the
 * reader do the arithmetic that matters — is this near the top of the day or
 * the bottom? The bar answers it without being read.
 */
function DayRange({
  low,
  high,
  price,
}: {
  low: number
  high: number
  price: number
}) {
  const span = high - low
  const pct = span > 0 ? ((price - low) / span) * 100 : 50
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <span
      className="flex w-[132px] shrink-0 flex-col gap-1"
      title={`24h range $${fmtPx(low)} – $${fmtPx(high)}`}
    >
      <Eyebrow className="text-[10px] tracking-[0.1em]">24h range</Eyebrow>
      <span className="flex flex-col gap-1">
        <span
          role="img"
          aria-label={`Currently ${clamped.toFixed(0)}% of the way up the day's range, from ${fmtPx(low)} to ${fmtPx(high)}`}
          className="relative block h-1 w-full rounded-full bg-gradient-to-r from-debit/45 via-foreground/15 to-credit/45"
        >
          <span
            aria-hidden
            className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--background)]"
            style={{ left: `${clamped}%` }}
          />
        </span>
        <span className="flex justify-between text-[10px] leading-none text-subtle tabular-nums">
          <span>{fmtPx(low)}</span>
          <span>{fmtPx(high)}</span>
        </span>
      </span>
    </span>
  )
}

export function MarketHeader({
  symbol,
  quote,
  icon,
  network,
  venueLabel,
  price,
  lastTick,
  changePct,
  changePct1h,
  changePct7d,
  volume24h,
  high24h,
  low24h,
  /** Bumped every time a price poll lands — the heartbeat's only trigger. */
  beat,
  pickerOpen,
  onTogglePicker,
  picker,
  className,
}: {
  symbol: string
  quote: string
  icon?: string | null
  network: string | null
  /** "Spot" or "Perpetual" — what kind of market this is, in plain words. */
  venueLabel: string
  price: number
  lastTick: "up" | "down" | null
  changePct: number | null
  changePct1h?: number | null
  changePct7d?: number | null
  volume24h: number | null
  high24h: number | null
  low24h: number | null
  beat: number
  pickerOpen: boolean
  onTogglePicker: () => void
  picker: React.ReactNode
  className?: string
}) {
  /* The flash must replay on every move, and same-name CSS animations don't
     restart on their own — so the figure is remounted (keyed) when the price
     changes with a known direction. Keyed on a counter, not on the price:
     the first paint of a pair must not flash. */
  const [flashGen, setFlashGen] = React.useState(0)
  const prevPrice = React.useRef(price)
  React.useEffect(() => {
    if (price === prevPrice.current) return
    prevPrice.current = price
    if (lastTick) setFlashGen((g) => g + 1)
  }, [price, lastTick])

  const flash = flashGen > 0 ? lastTick : null
  const hasRange =
    high24h !== null && low24h !== null && high24h > low24h && price > 0
  const stats =
    volume24h !== null ||
    hasRange ||
    typeof changePct1h === "number" ||
    typeof changePct7d === "number"

  return (
    <header
      data-vivid-target="market-header"
      data-vivid-label="The selected market — pair, live price and 24h figures"
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
        className
      )}
    >
      {/* Identity + trigger. The wrapper anchors the picker popover. */}
      <div className="relative z-30 flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onTogglePicker}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          data-vivid-target="trade-pair-picker"
          data-vivid-label="Open the pair picker dropdown"
          className="group flex items-center gap-3 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <CoinAvatar
            symbol={symbol}
            src={icon}
            size="lg"
            className="h-10 w-10 text-[12px]"
          />
          <span className="flex flex-col items-start leading-none">
            <span className="flex items-baseline gap-1 font-display text-[19px] font-semibold tracking-[-0.01em] whitespace-nowrap">
              {symbol || "—"}
              <span className="text-[13px] font-semibold text-muted-foreground">
                /{quote}
              </span>
            </span>
            <span className="mt-1 text-[11.5px] whitespace-nowrap text-muted-foreground">
              {venueLabel}
              {network && <> on {network}</>}
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "ml-0.5 h-4 w-4 text-subtle transition-transform group-hover:text-foreground",
              pickerOpen && "rotate-180"
            )}
          />
        </button>
        {picker}
      </div>

      {/* Price + day, in two deliberate rows.
          They were one scrolling line with `justify-end`, which is the flexbox
          trap: when the content outgrows the box, end-alignment pushes the
          overflow off the START edge, and the first item — the price, the one
          figure this screen exists for — was silently clipped out of view.
          Two rows, each free to scroll on its own, cannot do that. */}
      <div className="flex min-w-0 flex-col gap-2 lg:items-end">
        <div className="scrollbar-none flex min-w-0 items-center gap-x-4 overflow-x-auto">
          <span className="flex shrink-0 items-end gap-2">
            <span
              key={flashGen}
              aria-live="polite"
              className={cn(
                "-mx-1.5 rounded-lg px-1.5 font-display text-[clamp(30px,3.4vw,40px)] leading-none font-light tracking-[-0.02em] tabular-nums",
                flash === "up" && "ws-tick-up text-credit",
                flash === "down" && "ws-tick-down text-debit"
              )}
            >
              {price > 0 ? `$${fmtPx(price)}` : "—"}
            </span>
            {flash && (
              <span
                key={`arrow-${flashGen}`}
                aria-hidden
                style={
                  {
                    "--ws-arrow-from": flash === "up" ? "4px" : "-4px",
                  } as React.CSSProperties
                }
                className={cn(
                  "ws-tick-arrow mb-1 text-[13px] font-bold",
                  flash === "up" ? "text-credit" : "text-debit"
                )}
              >
                {flash === "up" ? "▲" : "▼"}
              </span>
            )}
          </span>

          {changePct !== null ? (
            <DeltaChip value={changePct} className="shrink-0" />
          ) : (
            <span className="shrink-0 text-[12px] text-subtle">
              24h change unavailable
            </span>
          )}

          {/* Liveness — one pulse per poll that lands, never a loop. */}
          <span
            className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
            title="Prices refresh automatically"
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute h-2 w-2 rounded-full bg-credit/90" />
              {beat > 0 && (
                <span
                  key={beat}
                  aria-hidden
                  className="ws-heartbeat absolute h-2 w-2 rounded-full bg-credit"
                />
              )}
            </span>
            Live
          </span>
        </div>

        {stats && (
          <div className="scrollbar-none flex min-w-0 items-end gap-5 overflow-x-auto pb-0.5">
            {typeof changePct1h === "number" && (
              <WindowChange label="1h" value={changePct1h} />
            )}
            {typeof changePct7d === "number" && (
              <WindowChange label="7d" value={changePct7d} />
            )}
            {volume24h !== null && (
              <Stat label="24h volume" value={fmtCompact(volume24h)} />
            )}
            {hasRange && <DayRange low={low24h} high={high24h} price={price} />}
          </div>
        )}
      </div>
    </header>
  )
}
