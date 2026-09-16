"use client"

/**
 * The order ticket.
 *
 * Two things change from the live screen.
 *
 * ONE — Pro mode gains capability, not just information. The live ticket is
 * identical in both modes: an amount box and a market buy. Here Simple is
 * market-only (that is what Simple means) and Pro adds Limit and Stop, with
 * the trigger price wired to the order book, so clicking a level fills it in.
 *
 * TWO — the rail's dead space becomes the ORDER SUMMARY. On the live screen
 * roughly 40% of this column is empty below the wallet balances, while the
 * questions a person actually has at the moment of buying — what will this
 * cost me, what will I receive, what is the fee, where does it route, how far
 * will the price move — are answered nowhere.
 *
 * Colour: Buy is green and Sell is red because direction is semantic in
 * trading. Everything else — the active tab, the percentage chips, the
 * focused input ring — is gold, so the panel stops reading as "a green app".
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  FEE_RATE,
  SLIPPAGE_OPTIONS,
  balanceOf,
  bookFor,
  formatPrice,
  quoteFor,
  venueOf,
  type Market,
  type OrderType,
} from "@/components/trade-unauth/trade-data"

type Side = "buy" | "sell"

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Line({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "muted"
  hint?: string
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
        className={cn(
          "font-medium tabular-nums",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
        )}
        title={hint}
      >
        {value}
      </span>
    </span>
  )
}

export function Ticket({
  market,
  pro,
  limitPrice,
  onLimitPrice,
}: {
  market: Market
  pro: boolean
  limitPrice: number | null
  onLimitPrice: (p: number | null) => void
}) {
  const [side, setSide] = React.useState<Side>("buy")
  const [type, setType] = React.useState<OrderType>("market")
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState(1)

  const book = React.useMemo(() => bookFor(market), [market])

  // Simple mode has no order types, so leaving a limit selected behind the
  // toggle would arm an order the UI no longer shows a price for.
  React.useEffect(() => {
    if (!pro) setType("market")
  }, [pro])

  const quoteBal = balanceOf(market.quote)
  const baseBal = balanceOf(market.base)
  const spendable = side === "buy" ? quoteBal : baseBal * market.price

  const value = Number(amount) || 0
  const quote = quoteFor({
    market,
    book,
    side,
    quoteAmount: value,
    limitPrice: type === "market" ? undefined : (limitPrice ?? undefined),
    slippagePct: slippage,
  })

  const tooBig = value > spendable
  const ready = value > 0 && !tooBig && (type === "market" || (limitPrice ?? 0) > 0)

  const cta = !value
    ? "Enter an amount"
    : tooBig
      ? `Not enough ${side === "buy" ? market.quote : market.base}`
      : type === "market"
        ? `${side === "buy" ? "Buy" : "Sell"} ${market.base}`
        : `Place ${type} ${side === "buy" ? "buy" : "sell"}`

  return (
    <div className="flex h-full flex-col gap-3.5 p-4">
      {/* Side. The ONLY green/red in the panel. */}
      <div className="grid grid-cols-2 gap-1.5 rounded-full bg-foreground/[0.05] p-1">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "h-9 rounded-full text-[13.5px] font-semibold capitalize transition-colors",
              side === s
                ? s === "buy"
                  ? "bg-credit text-white"
                  : "bg-debit text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Order type — Pro only. This is the capability Simple does not have. */}
      {pro && (
        <Segmented
          grow
          size="sm"
          options={[
            { key: "market", label: "Market" },
            { key: "limit", label: "Limit" },
            { key: "stop", label: "Stop" },
          ]}
          value={type}
          onChange={(k) => setType(k as OrderType)}
        />
      )}

      {type !== "market" && (
        <div className="flex flex-col gap-1.5">
          <Eyebrow className="text-[11px]">{type === "limit" ? "Limit price" : "Stop price"}</Eyebrow>
          <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.05] px-3 ring-1 ring-border/50 focus-within:ring-primary/50">
            <input
              value={limitPrice ?? ""}
              onChange={(e) => onLimitPrice(e.target.value === "" ? null : Number(e.target.value.replace(/[^0-9.]/g, "")))}
              inputMode="decimal"
              placeholder={formatPrice(market.price)}
              aria-label={`${type} price`}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-muted-foreground"
            />
            <span className="shrink-0 text-[12.5px] text-muted-foreground">{market.quote}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Tap a level in the order book to use its price.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <Eyebrow className="text-[11px]">Amount</Eyebrow>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            Available {side === "buy" ? `${quoteBal.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${market.quote}` : `${baseBal.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${market.base}`}
          </span>
        </span>
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl bg-foreground/[0.05] px-3 ring-1 transition-colors",
            tooBig ? "ring-debit/60" : "ring-border/50 focus-within:ring-primary/50",
          )}
        >
          <span className="text-[15px] text-muted-foreground">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount to trade"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] tabular-nums outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-[12.5px] font-medium text-muted-foreground">{market.quote}</span>
        </div>

        {/* Gold, not green — these are controls, not direction. */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount((spendable * (p / 100)).toFixed(2))}
              className="h-8 rounded-full bg-foreground/[0.05] text-[12px] font-semibold text-muted-foreground ring-1 ring-transparent transition-colors hover:text-foreground hover:ring-primary/35"
            >
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Slippage. "Price protection" on the live screen is jargon for this. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
          Max slippage
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="ws-icon-mono h-3 w-3 text-muted-foreground/60"
          />
        </span>
        <div className="flex gap-1">
          {SLIPPAGE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlippage(s)}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors",
                slippage === s
                  ? "bg-primary/[0.16] text-primary ring-1 ring-primary/45"
                  : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground",
              )}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!ready}
        className={cn(
          "h-12 shrink-0 rounded-xl text-[14.5px] font-semibold transition-colors",
          !ready
            ? "cursor-not-allowed bg-foreground/[0.05] text-muted-foreground"
            : side === "buy"
              ? "bg-credit text-white hover:bg-credit/90"
              : "bg-debit text-white hover:bg-debit/90",
        )}
      >
        {cta}
      </button>

      {/* ── The summary. This is what fills the rail the live screen leaves
             empty, and it is the part a person actually reads before they
             press the button. ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.05] p-3.5">
        <Eyebrow className="text-[11px]">Order summary</Eyebrow>
        <Line
          label={side === "buy" ? "You pay" : "You sell"}
          value={side === "buy" ? fmtUsd(quote.net) : `${quote.baseAmount.toFixed(4)} ${market.base}`}
        />
        <Line
          label={side === "buy" ? "You receive" : "You receive"}
          value={
            side === "buy"
              ? `≈ ${quote.baseAmount.toFixed(4)} ${market.base}`
              : `≈ ${fmtUsd(quote.net)}`
          }
        />
        <Line
          label={`Fee (${(FEE_RATE * 100).toFixed(2)}%)`}
          value={fmtUsd(quote.fee)}
          tone="muted"
        />
        <Line
          label="Price impact"
          value={`${quote.impactPct.toFixed(2)}%`}
          tone={quote.impactPct > 1 ? "warning" : "muted"}
          hint="How far this order walks the book"
        />
        <Line
          label={side === "buy" ? "Worst price" : "Worst price"}
          value={formatPrice(quote.worstPrice)}
          tone="muted"
          hint={`At ${slippage}% max slippage`}
        />
        <span className="my-0.5 h-px bg-border/50" />
        <Line label="Route" value={venueOf(market)} tone="muted" />
        <Line label="Settles on" value={market.chains.join(" · ")} tone="muted" />
      </div>

      {/* Balances, kept — but now below the thing you came to read. */}
      <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.05] p-3.5">
        <Eyebrow className="text-[11px]">Your wallet on {venueOf(market)}</Eyebrow>
        {[market.base, market.quote].map((sym) => (
          <span key={sym} className="flex items-center gap-2.5">
            <CoinAvatar symbol={sym} size="md" />
            <span className="flex-1 text-[13px] font-medium">{sym}</span>
            <span className="text-[13px] tabular-nums">
              {balanceOf(sym).toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
