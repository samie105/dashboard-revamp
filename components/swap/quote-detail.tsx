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
import { RefreshIcon, Route01Icon } from "@hugeicons/core-free-icons"

import { Segmented } from "@/components/ui/system"
import { cn } from "@/lib/utils"
import { QuoteClock } from "@/components/ui/quote-clock"
import { num, pct, qty, usd } from "@/lib/num"
import type { SwapView } from "@/lib/swap-view"
import { fromBaseUnits, QUOTE_TTL_SECONDS, type QuoteData } from "./swap-model"

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
    <span className="inline-flex w-fit min-w-0 max-w-full items-center gap-1.5 rounded-full bg-card px-2.5 py-1.5 ring-1 ring-border/40">
      {logo ? (
        <img src={logo} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full" />
      ) : (
        <HugeiconsIcon icon={Route01Icon} className="h-3.5 w-3.5 shrink-0 text-primary" />
      )}
      <span className="truncate text-[11.5px] font-semibold">{tool}</span>
    </span>
  )
}


/** A small caps heading over a group of rows. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </span>
  )
}

/** Seconds as something a person reads. */
function duration(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`
  const minutes = Math.round(seconds / 60)
  return `~${minutes} min`
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
  const networkFee = quote ? num(quote.gasCostUSD) : null

  /* Protocol fees, separate from gas, and only the ones actually CHARGED on
     top — LI.FI marks a fee `included` when it is already inside the quoted
     output, and adding those to a total would bill the reader twice. */
  const protocolFee = React.useMemo(() => {
    const costs = quote?.feeCosts?.filter((f) => !f.included) ?? []
    if (costs.length === 0) return null
    const total = costs.reduce((sum, f) => sum + (num(f.amountUSD) ?? 0), 0)
    return total > 0 ? total : null
  }, [quote])

  const arrives = quote?.executionDuration && quote.executionDuration > 0 ? quote.executionDuration : null

  /* The legs. LI.FI returns one entry for a direct swap and several when it
     has to hop, so the heading counts what is there rather than claiming a
     shape. Falls back to the single `tool` when the backend predates the
     field, which is what makes this pane render identically before deploy. */
  const steps = React.useMemo(() => {
    if (quote?.steps?.length) return quote.steps
    if (!quote) return []
    return [{ tool: quote.tool, logoURI: quote.toolLogoURI, type: "swap", fromSymbol, toSymbol }]
  }, [quote, fromSymbol, toSymbol])

  const showRefresh = view.quoteRefresh
  const showRoute = view.routeDetail && quote !== null && steps.length > 0
  /* The rate is quoted, not derived. `toAmount` falls back to a list-price
     estimate before a quote lands, and a rate row sitting under a heading
     about the quote had better be the quote's rate — so it waits for one. */
  const showRate = view.rateDetail && rate !== null && quote !== null
  const showBreakdown =
    view.quoteBreakdown
    && quote !== null
    && (impact !== null || minReceived !== null || networkFee !== null || protocolFee !== null || arrives !== null)

  if (!showRefresh && !showRoute && !showRate && !showBreakdown) return null

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ── The clock ──────────────────────────────────────────────────── */}
      {showRefresh && (
        <div className="flex items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3.5">
          <QuoteClock seconds={secondsLeft} total={QUOTE_TTL_SECONDS} refreshing={refreshing} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[13px] font-semibold">
              {refreshing ? "Getting a new price…" : secondsLeft === null ? "Indicative rate" : "Live quote"}
            </span>
            <span className="truncate text-[11.5px] text-muted-foreground">
              {/* NOT "enter an amount": this pane only mounts once one has
                  been entered, so that copy — which the preview used, because
                  its card was always on screen — could never be true here.
                  No countdown means no quote has landed yet. */}
              {secondsLeft === null
                ? "Waiting for a price"
                : "Refreshes on its own before it expires"}
            </span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Get a new price now"
            title="Get a new price now"
            className="ws-icon-mono inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <HugeiconsIcon icon={RefreshIcon} className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      )}

      {/* ── The quote ──────────────────────────────────────────────────── */}
      {(showRate || showBreakdown) && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-foreground/[0.05] p-4">
          <GroupLabel>Quote</GroupLabel>
          <dl className="flex flex-col gap-2">
            {showRate && rate !== null && (
              <>
                <Row label="Rate" value={`1 ${fromSymbol} = ${qty(rate)} ${toSymbol}`} />
                {!dense && <Row label="Inverse" value={`1 ${toSymbol} = ${qty(1 / rate)} ${fromSymbol}`} />}
              </>
            )}
            {showBreakdown && minReceived !== null && (
              <Row label="Minimum received" value={qty(minReceived, toSymbol)} />
            )}
            {showBreakdown && impact !== null && (
              <Row label="Price impact" value={pct(impact)} tone={impactTone(impact)} />
            )}
            {showBreakdown && !dense && networkFee !== null && (
              <Row label="Network fee" value={usd(networkFee)} />
            )}
            {showBreakdown && !dense && protocolFee !== null && (
              <Row label="Protocol fee" value={usd(protocolFee)} />
            )}
            {showBreakdown && arrives !== null && <Row label="Arrives in" value={duration(arrives)} />}
          </dl>
        </div>
      )}

      {/* ── The route ──────────────────────────────────────────────────── */}
      {showRoute && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-foreground/[0.05] p-4">
          <GroupLabel>
            Route · {steps.length} step{steps.length === 1 ? "" : "s"}
          </GroupLabel>
          {dense ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted-foreground">Fills on</span>
              <VenueChip tool={steps[0].tool} logo={steps[0].logoURI} />
            </div>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {steps.map((step, index) => (
                <li key={`${step.tool}-${index}`} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/[0.09] text-[10px] font-bold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <VenueChip tool={step.tool} logo={step.logoURI} />
                    {step.fromSymbol && step.toSymbol && (
                      <span className="mt-1 truncate text-[11.5px] text-muted-foreground">
                        {step.fromSymbol} → {step.toSymbol}
                        {index === 0 && fromChain !== toChain ? ` · ${fromChain} → ${toChain}` : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
