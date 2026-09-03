"use client"

/**
 * Pro's half of the swap ticket: the quote's working, shown rather than
 * summarised.
 *
 * The rule this file is built on — every figure here is a field on the quote
 * or arithmetic over two of them. Nothing is estimated, filled in, or rounded
 * up from a guess. The version of this pane that shipped before invented a
 * price impact from the trade size whenever the real quote was missing, which
 * is the kind of number that looks fine right up until someone trusts it. A
 * row we cannot source is a row that is not drawn.
 *
 * Simple renders none of this. That is the whole point of the two modes: not
 * the same pane in a smaller font, but a different answer to a different
 * question.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, RefreshIcon, Route01Icon } from "@hugeicons/core-free-icons"

import { Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { cn } from "@/lib/utils"
import { num, pct, qty, usd } from "@/lib/num"
import type { SwapView } from "@/lib/swap-view"
import { chainMeta, fromBaseUnits, type QuoteData } from "./swap-model"

/* ── Slippage — a control, not a setting buried behind a gear ───────────── */

/** The three tolerances that cover almost every real trade, plus your own. */
const PRESETS = [0.1, 0.5, 1] as const
type PresetKey = "0.1" | "0.5" | "1" | "custom"

/**
 * Slippage tolerance.
 *
 * It used to live in a gear popover with a gold-filled active preset — two
 * house rules broken at once (gold is brand and primary action, never a
 * selected state; and the one tab system is `Segmented`). More importantly it
 * was hidden, and a control someone has to find is a control they will not set.
 * In Pro it sits in the ticket at full size, on the sunken step, with the
 * current value stated in words beside it.
 */
export function SlippageField({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  const matched = PRESETS.find((preset) => preset === value)
  const [custom, setCustom] = React.useState(matched === undefined)
  const [draft, setDraft] = React.useState(String(value))

  // A preset pressed elsewhere (or a fresh mount at a custom value) has to be
  // reflected here, or the segment and the number disagree.
  React.useEffect(() => {
    if (matched !== undefined) setCustom(false)
    setDraft(String(value))
  }, [matched, value])

  const selected: PresetKey = custom || matched === undefined ? "custom" : (String(matched) as PresetKey)

  return (
    <div className={cn("rounded-2xl bg-surface-sunken/70 p-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold">Max slippage</span>
          <span className="text-[12px] leading-snug text-muted-foreground">
            How far the price may move before the swap is cancelled
          </span>
        </div>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{value}%</span>
      </div>

      <Segmented<PresetKey>
        className="mt-3"
        grow
        value={selected}
        onChange={(key) => {
          if (key === "custom") {
            setCustom(true)
            return
          }
          setCustom(false)
          onChange(Number(key))
        }}
        options={[
          { key: "0.1", label: "0.1%" },
          { key: "0.5", label: "0.5%" },
          { key: "1", label: "1%" },
          { key: "custom", label: "Custom" },
        ]}
      />

      {selected === "custom" && (
        <div className="relative mt-2.5">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Custom slippage tolerance, in percent"
            value={draft}
            onChange={(event) => {
              const next = event.target.value
              if (!/^[0-9]*\.?[0-9]*$/.test(next)) return
              setDraft(next)
              const parsed = parseFloat(next)
              // 50% is the ceiling the old popover enforced and it is the
              // right one: past that the "tolerance" is no longer a guard.
              if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 50) onChange(parsed)
            }}
            className="h-11 w-full rounded-xl bg-background/60 px-3 pr-8 text-[14px] font-medium tabular-nums outline-none transition-colors focus:bg-accent/60"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
            %
          </span>
        </div>
      )}

      {value > 5 && (
        <p className="mt-2.5 text-[12px] leading-snug text-warning">
          Above 5% you can be filled a long way from the price shown.
        </p>
      )}
      {value > 0 && value < 0.1 && (
        <p className="mt-2.5 text-[12px] leading-snug text-warning">
          Below 0.1% most swaps are cancelled before they fill.
        </p>
      )}
    </div>
  )
}

/* ── The detail pane ───────────────────────────────────────────────────── */

/** One label/value line. Values are tabular so a refresh doesn't jitter them. */
function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-[12.5px] font-medium tabular-nums", tone ?? "text-foreground")}>
        {value}
      </dd>
    </div>
  )
}

/**
 * How hard a price impact should land.
 *
 * Emerald and red are reserved for money direction, so a healthy impact stays
 * neutral rather than being congratulated in green. Amber is the warning
 * meaning; red is kept for the case where the trade is genuinely eating its
 * own value.
 */
function impactTone(impact: number) {
  if (impact >= 3) return "text-debit"
  if (impact >= 1) return "text-warning"
  return "text-foreground"
}

/** One end of the route: the coin, and where it sits. */
function RouteEnd({ symbol, chain }: { symbol: string; chain: string }) {
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center gap-1">
      <CoinAvatar symbol={symbol} size="md" />
      <span className="max-w-[72px] truncate text-[11px] font-semibold">{symbol}</span>
      <span className="max-w-[72px] truncate text-[10.5px] text-muted-foreground">{chainMeta(chain).label}</span>
    </div>
  )
}

/**
 * The venue chip.
 *
 * The quote names ONE tool, and that is all we can honestly draw: there are no
 * split percentages or intermediate hops in the response, so none are shown.
 * A route diagram with invented proportions would be a lie told in a diagram,
 * which is harder to argue with than a lie told in a sentence.
 */
function VenueChip({ tool, logo }: { tool: string; logo?: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-[45%] shrink items-center gap-1.5 rounded-full bg-card px-2.5 py-1.5 ring-1 ring-border/40">
      {logo ? (
        <img src={logo} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full" />
      ) : (
        <HugeiconsIcon icon={Route01Icon} className="h-3.5 w-3.5 shrink-0 text-primary" />
      )}
      <span className="truncate text-[11.5px] font-semibold">{tool}</span>
    </span>
  )
}

export function QuoteDetail({
  view,
  quote,
  fromSymbol,
  toSymbol,
  fromChain,
  toChain,
  fromAmount,
  toAmount,
  secondsLeft,
  refreshing,
  onRefresh,
  dense,
  className,
}: {
  view: SwapView
  quote: QuoteData | null
  fromSymbol: string
  toSymbol: string
  fromChain: string
  toChain: string
  /** Token quantity being sold. */
  fromAmount: number
  /** Token quantity the quote expects to deliver. */
  toAmount: number
  /** Seconds until the quote is fetched again, or null when none is live. */
  secondsLeft: number | null
  refreshing: boolean
  onRefresh: () => void
  /** The dashboard panel: route on one line, no inverse rate, no fee row. */
  dense?: boolean
  className?: string
}) {
  const rate = fromAmount > 0 && toAmount > 0 ? toAmount / fromAmount : null
  const minReceived = quote ? fromBaseUnits(quote.toAmountMin, quote.toToken.decimals) : null
  const impact = quote && Number.isFinite(quote.priceImpact) ? Math.abs(quote.priceImpact) : null
  const fee = quote ? num(quote.gasCostUSD) : null

  const showRefresh = view.quoteRefresh
  const showRoute = view.routeDetail && quote !== null
  /* The rate is quoted, not derived. `toAmount` falls back to a list-price
     estimate before a quote lands, and a rate row sitting under a heading
     about the quote had better be the quote's rate — so it waits for one. */
  const showRate = view.rateDetail && rate !== null && quote !== null
  const showBreakdown = view.quoteBreakdown && quote !== null && (impact !== null || minReceived !== null || fee !== null)

  if (!showRefresh && !showRoute && !showRate && !showBreakdown) return null

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface-sunken/70", className)}>
      {showRefresh && (
        <div className="flex items-center justify-between gap-2 pl-3.5 pr-1.5 pt-1.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate tabular-nums">
              {refreshing
                ? "Getting a new price…"
                : secondsLeft === null
                  ? "No live price yet"
                  : `New price in ${Math.max(0, secondsLeft)}s`}
            </span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Get a new price now"
            title="Get a new price now"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-9 sm:w-9"
          >
            <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      )}

      {showRoute && quote && (
        dense ? (
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <span className="text-[12.5px] text-muted-foreground">Fills on</span>
            <VenueChip tool={quote.tool} logo={quote.toolLogoURI} />
          </div>
        ) : (
          <div className="px-3.5 py-3">
            <div className="flex items-center gap-2">
              <RouteEnd symbol={fromSymbol} chain={fromChain} />
              <span aria-hidden className="h-px min-w-2 flex-1 bg-border/50" />
              <VenueChip tool={quote.tool} logo={quote.toolLogoURI} />
              <span aria-hidden className="h-px min-w-2 flex-1 bg-border/50" />
              <RouteEnd symbol={toSymbol} chain={toChain} />
            </div>
          </div>
        )
      )}

      {(showRate || showBreakdown) && (
        <dl
          className={cn(
            "flex flex-col gap-2 px-3.5 pb-3.5 pt-3",
            (showRefresh || showRoute) && "border-t border-border/20",
          )}
        >
          {showRate && rate !== null && (
            <>
              <Row label="Rate" value={`1 ${fromSymbol} = ${qty(rate)} ${toSymbol}`} />
              {!dense && <Row label="Inverse" value={`1 ${toSymbol} = ${qty(1 / rate)} ${fromSymbol}`} />}
            </>
          )}
          {showBreakdown && impact !== null && (
            <Row label="Price impact" value={pct(impact)} tone={impactTone(impact)} />
          )}
          {showBreakdown && minReceived !== null && (
            <Row label="Minimum received" value={qty(minReceived, toSymbol)} />
          )}
          {showBreakdown && !dense && fee !== null && <Row label="Estimated fee" value={usd(fee)} />}
        </dl>
      )}
    </div>
  )
}
