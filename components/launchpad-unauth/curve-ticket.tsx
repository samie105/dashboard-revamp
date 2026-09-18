"use client"

/**
 * Stage 3 — buying and selling on the curve.
 *
 * A curve trade is a swap with one side fixed, so this follows the swap
 * ticket's grammar: the amount, the slippage, and a quote with its countdown
 * directly above the button that commits to it. `QuoteClock` is the same ring
 * the swap uses, from components/ui, so the two tickets cannot drift apart on
 * what "about to expire" looks like.
 *
 * ── Every number comes from the curve ─────────────────────────────────────
 * `quoteCurve` prices against the same `k` that draws the chart and fills the
 * progress rail. A buy and an immediate sell of the same tokens return the SOL
 * put in less the two fees, to the lamport — verified before this was built —
 * so the ticket cannot quote a round trip that creates or destroys value.
 *
 * In production the quote comes from the curve program's own math, never
 * from a local reimplementation: if ours and the program's disagreed, the user
 * would see one number and get another.
 *
 * ── On the countdown ──────────────────────────────────────────────────────
 * The clock re-reads the quote when it runs out, because in production the
 * reserves move whenever anyone else trades. Here the reserves are frozen, so
 * the re-read returns the same numbers. The clock is shown anyway: it is the
 * behaviour being reviewed.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell, Segmented } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { AmountField } from "@/components/ui/flow"
import { QuoteClock } from "@/components/ui/quote-clock"
import { Assumed } from "@/components/launchpad-unauth/parts"
import {
  CURVE_QUOTE_TTL,
  DEMO_SOL_BALANCE,
  SOL_USD,
  TRADE_FEE_BPS,
  demoTokenBalance,
  fmtPct,
  fmtSol,
  fmtTinyUsd,
  fmtTokens,
  fmtUsd,
  quoteCurve,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"

type Side = "buy" | "sell"

const SLIPPAGE = [
  { key: "50", label: "0.5%" },
  { key: "100", label: "1%" },
  { key: "200", label: "2%" },
  { key: "500", label: "5%" },
] as const
type SlippageKey = (typeof SLIPPAGE)[number]["key"]

/** Above this, the impact row turns to the warning tone. A curve is thin
 *  early on and a large buy moves it a lot — worth saying before, not after. */
const IMPACT_WARN_PCT = 5

export function CurveTicket({ launch }: { launch: LaunchView }) {
  const [side, setSide] = React.useState<Side>("buy")
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState<SlippageKey>("100")
  const [seconds, setSeconds] = React.useState<number | null>(null)
  const [signing, setSigning] = React.useState(false)

  const tokenBalance = React.useMemo(() => demoTokenBalance(launch), [launch])
  const balance = side === "buy" ? DEMO_SOL_BALANCE : tokenBalance
  const value = Number(amount)
  const quote = React.useMemo(
    () => quoteCurve(side, value, launch, Number(slippage)),
    [side, value, launch, slippage]
  )
  const over = Number.isFinite(value) && value > balance

  /* A new amount, side or tolerance is a new quote, so the clock restarts.
     Deriving the reset from the inputs (rather than an effect that calls
     setState) keeps it to one render. */
  const quoteKey = quote ? `${side}:${value}:${slippage}` : null
  const [clockKey, setClockKey] = React.useState<string | null>(null)
  if (quoteKey !== clockKey) {
    setClockKey(quoteKey)
    setSeconds(quoteKey ? CURVE_QUOTE_TTL : null)
    setSigning(false)
  }

  React.useEffect(() => {
    if (seconds === null) return
    const id = setTimeout(
      // At zero the quote is re-read. With frozen preview reserves the
      // numbers do not change; in production they would.
      () =>
        setSeconds((s) =>
          s === null ? null : s <= 1 ? CURVE_QUOTE_TTL : s - 1
        ),
      1000
    )
    return () => clearTimeout(id)
  }, [seconds])

  const switchSide = (next: Side) => {
    setSide(next)
    setAmount("")
  }

  const quick =
    side === "buy"
      ? [0.1, 0.5, 1, 5].map((n) => ({ label: `${n} SOL`, value: String(n) }))
      : [25, 50, 100].map((pct) => ({
          label: pct === 100 ? "All" : `${pct}%`,
          value: String(Math.floor((tokenBalance * pct) / 100)),
        }))

  const cta = !quote
    ? side === "buy"
      ? "Enter an amount"
      : tokenBalance === 0
        ? `You don't hold ${launch.symbol}`
        : "Enter an amount"
    : over
      ? `Not enough ${side === "buy" ? "SOL" : launch.symbol}`
      : side === "buy"
        ? // When the curve caps the buy, the input no longer says what will be
          // spent — so the button does. Otherwise the field reads 10 SOL and
          // the button says nothing to contradict it.
          quote.cappedAtSol !== undefined
          ? `Buy ${fmtTokens(quote.amountOut)} ${launch.symbol} for ${fmtSol(quote.amountIn, 3)}`
          : `Buy ${fmtTokens(quote.amountOut)} ${launch.symbol}`
        : `Sell for ${fmtSol(quote.amountOut, 4)}`

  return (
    <CardShell className={CARD_HUE}>
      <div className="flex flex-col gap-4 p-4">
        <Segmented
          grow
          options={[
            { key: "buy", label: "Buy" },
            { key: "sell", label: "Sell" },
          ]}
          value={side}
          onChange={switchSide}
        />

        <div className="flex flex-col gap-2">
          <AmountField
            value={amount}
            onChange={setAmount}
            unit={side === "buy" ? "SOL" : launch.symbol}
            autoFocus={false}
            maxDecimals={side === "buy" ? 4 : 0}
            maxSpend={balance}
            hint={
              side === "buy"
                ? `${fmtSol(DEMO_SOL_BALANCE, 2)} in your wallet`
                : `${fmtTokens(tokenBalance)} ${launch.symbol} in your wallet`
            }
            problem={
              over
                ? `You have ${side === "buy" ? fmtSol(balance, 2) : `${fmtTokens(balance)} ${launch.symbol}`}.`
                : null
            }
          />
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                disabled={side === "sell" && tokenBalance === 0}
                onClick={() => setAmount(q.value)}
                className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">
            Max slippage
          </span>
          <Segmented
            size="sm"
            options={SLIPPAGE}
            value={slippage}
            onChange={setSlippage}
          />
        </div>

        {quote && (
          <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.05] p-3.5">
            <div className="flex items-center gap-3">
              <QuoteClock seconds={seconds} total={CURVE_QUOTE_TTL} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[12.5px] font-semibold">Live quote</span>
                <span className="text-[11px] text-muted-foreground">
                  Re-read before it expires
                </span>
              </span>
            </div>
            <dl className="flex flex-col gap-1.5 text-[12.5px]">
              <Row
                label="You receive"
                value={
                  side === "buy"
                    ? `${fmtTokens(quote.amountOut)} ${launch.symbol}`
                    : fmtSol(quote.amountOut, 4)
                }
                strong
              />
              <Row
                label="Average price"
                value={fmtTinyUsd(
                  (side === "buy"
                    ? (quote.amountIn - quote.feeSol) / quote.amountOut
                    : (quote.amountOut + quote.feeSol) / quote.amountIn) *
                    SOL_USD
                )}
              />
              <Row
                label="Price impact"
                value={`${quote.priceImpactPct.toFixed(2)}%`}
                tone={
                  quote.priceImpactPct >= IMPACT_WARN_PCT
                    ? "warning"
                    : undefined
                }
              />
              <Row
                label={`Fee (${fmtPct(TRADE_FEE_BPS)})`}
                value={fmtSol(quote.feeSol, 4)}
                assumed="fee model undecided (open question #3)"
              />
              <Row
                label="Minimum received"
                value={
                  side === "buy"
                    ? `${fmtTokens(quote.minOut)} ${launch.symbol}`
                    : fmtSol(quote.minOut, 4)
                }
              />
            </dl>
            {quote.cappedAtSol !== undefined && (
              /* The buy is larger than what is left on the curve. Saying so
                 before signing matters more than anything else in this pane:
                 the alternative is a buyer who expected to spend 5 SOL and
                 finds 3 were never taken. */
              <p className="flex items-start gap-1 rounded-xl bg-warning-chip px-3 py-2 text-[11.5px] leading-relaxed text-warning">
                <span>
                  Only {fmtSol(launch.remainingSol, 2)} is left on this curve.
                  This buy fills it for {fmtSol(quote.cappedAtSol, 3)} and
                  graduates the token — the rest isn&apos;t taken.
                </span>
                <Assumed note="what happens past the threshold is the chosen program's behaviour" />
              </p>
            )}
          </div>
        )}

        {signing && quote ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3.5">
            <span className="text-[13px] font-semibold">Ready to sign</span>
            <span className="text-[12px] leading-relaxed text-muted-foreground">
              In the live product your wallet opens here. If the curve moves
              more than {fmtPct(Number(slippage))} before this lands, the trade
              is refused rather than filled worse. This is a preview, so nothing
              was sent.
            </span>
            <button
              type="button"
              onClick={() => setSigning(false)}
              className="w-fit text-[12.5px] font-semibold text-primary transition-opacity hover:opacity-80"
            >
              Back
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!quote || over}
            onClick={() => setSigning(true)}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
              quote && !over
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-foreground/[0.08] text-muted-foreground"
            )}
          >
            {cta}
          </button>
        )}

        {quote && (
          <span className="text-center text-[11px] text-muted-foreground">
            ≈{" "}
            {fmtUsd(
              (side === "buy" ? quote.amountIn : quote.amountOut) * SOL_USD
            )}
          </span>
        )}
      </div>
    </CardShell>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
  assumed,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: "warning"
  assumed?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="inline-flex items-center text-muted-foreground">
        {label}
        {assumed && <Assumed note={assumed} />}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-[13.5px] font-semibold" : "font-medium",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
