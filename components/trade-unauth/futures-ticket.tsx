"use client"

/**
 * The perpetuals ticket.
 *
 * The live one has a leverage slider running 1×–40×, a Reduce-only checkbox
 * and empty Take profit / Stop loss boxes — and not one figure attached to
 * any of them. At 40× a 2.5% move against you closes the position, and a
 * slider that does not say so is a slider that hides the only thing it
 * controls.
 *
 * So the summary here leads with LIQUIDATION PRICE and a bar showing how far
 * the mark has to travel to reach it, then margin, fee and funding. Take
 * profit and stop loss show the PnL they would realise as you type them.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow, Segmented } from "@/components/ui/system"
import {
  FUTURES_EQUITY,
  MAINTENANCE_MARGIN_RATE,
  TAKER_FEE,
  formatPrice,
  quotePosition,
  type MarginMode,
  type Perp,
} from "@/components/trade-unauth/futures-data"

type Side = "long" | "short"
type OrderType = "market" | "limit"

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Line({
  label,
  value,
  tone,
  hint,
  strong,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "muted" | "debit" | "credit"
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
          tone === "debit" && "text-debit",
          tone === "credit" && "text-credit",
        )}
      >
        {value}
      </span>
    </span>
  )
}

export function FuturesTicket({
  perp,
  limitPrice,
  onLimitPrice,
}: {
  perp: Perp
  limitPrice: number | null
  onLimitPrice: (p: number | null) => void
}) {
  const [side, setSide] = React.useState<Side>("long")
  const [type, setType] = React.useState<OrderType>("market")
  const [mode, setMode] = React.useState<MarginMode>("cross")
  const [leverage, setLeverage] = React.useState(5)
  const [margin, setMargin] = React.useState("")
  const [reduceOnly, setReduceOnly] = React.useState(false)
  const [tp, setTp] = React.useState("")
  const [sl, setSl] = React.useState("")

  // Switching contract can leave leverage above the new one's ceiling.
  React.useEffect(() => {
    setLeverage((l) => Math.min(l, perp.maxLeverage))
  }, [perp.maxLeverage])

  const entry = type === "limit" && limitPrice ? limitPrice : perp.markPrice
  const marginValue = Number(margin) || 0
  const q = quotePosition({ perp, side, margin: marginValue, leverage, entryPrice: entry })

  const tooBig = marginValue > FUTURES_EQUITY.available
  const ready = marginValue > 0 && !tooBig && (type === "market" || (limitPrice ?? 0) > 0)

  // How far the mark must move before liquidation — the number the slider is
  // actually setting, expressed the way a trader feels it.
  const distancePct = leverage > 0 ? (1 / leverage - MAINTENANCE_MARGIN_RATE) * 100 : 0

  const tpPnl = Number(tp) > 0 ? (Number(tp) - entry) * q.size * (side === "long" ? 1 : -1) : null
  const slPnl = Number(sl) > 0 ? (Number(sl) - entry) * q.size * (side === "long" ? 1 : -1) : null

  const cta = !marginValue
    ? "Enter an amount"
    : tooBig
      ? "Not enough margin"
      : `${side === "long" ? "Long" : "Short"} ${perp.base}`

  return (
    <div className="flex h-full flex-col gap-3.5 p-4">
      {/* Direction — the only green/red in the panel. */}
      <div className="grid grid-cols-2 gap-1.5 rounded-full bg-foreground/[0.05] p-1">
        {(["long", "short"] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "h-9 rounded-full text-[13.5px] font-semibold capitalize transition-colors",
              side === s
                ? s === "long"
                  ? "bg-credit text-white"
                  : "bg-debit text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          size="sm"
          options={[
            { key: "market", label: "Market" },
            { key: "limit", label: "Limit" },
          ]}
          value={type}
          onChange={(k) => setType(k as OrderType)}
        />
        {/* Cross vs isolated decides WHAT gets liquidated, and the live ticket
            does not offer the choice at all. */}
        <Segmented
          size="sm"
          className="ml-auto"
          options={[
            { key: "cross", label: "Cross" },
            { key: "isolated", label: "Isolated" },
          ]}
          value={mode}
          onChange={(k) => setMode(k as MarginMode)}
        />
      </div>

      {type === "limit" && (
        <div className="flex flex-col gap-1.5">
          <Eyebrow className="text-[11px]">Limit price</Eyebrow>
          <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.05] px-3 ring-1 ring-border/50 focus-within:ring-primary/50">
            <input
              value={limitPrice ?? ""}
              onChange={(e) =>
                onLimitPrice(e.target.value === "" ? null : Number(e.target.value.replace(/[^0-9.]/g, "")))
              }
              inputMode="decimal"
              placeholder={formatPrice(perp.markPrice)}
              aria-label="Limit price"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-muted-foreground"
            />
            <span className="shrink-0 text-[12.5px] text-muted-foreground">USD</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <Eyebrow className="text-[11px]">Margin</Eyebrow>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            Available {usd(FUTURES_EQUITY.available)}
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
            value={margin}
            onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Margin to commit"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] tabular-nums outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-[12.5px] font-medium text-muted-foreground">USD</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMargin(((FUTURES_EQUITY.available * p) / 100).toFixed(2))}
              className="h-8 rounded-full bg-foreground/[0.05] text-[12px] font-semibold text-muted-foreground ring-1 ring-transparent transition-colors hover:text-foreground hover:ring-primary/35"
            >
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Leverage — and, immediately under it, what it costs you. */}
      <div className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between gap-2">
          <Eyebrow className="text-[11px]">Leverage</Eyebrow>
          <span className="font-display text-[15px] font-semibold tabular-nums text-primary">
            {leverage}×
          </span>
        </span>
        <input
          type="range"
          min={1}
          max={perp.maxLeverage}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          aria-label="Leverage"
          className="w-full accent-[var(--primary)]"
        />
        <span className="flex justify-between text-[10.5px] tabular-nums text-muted-foreground">
          <span>1×</span>
          <span
            className={cn(
              "font-medium",
              distancePct < 5 ? "text-debit" : distancePct < 12 ? "text-warning" : "text-muted-foreground",
            )}
          >
            Liquidates on a {distancePct.toFixed(1)}% move against you
          </span>
          <span>{perp.maxLeverage}×</span>
        </span>
      </div>

      <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-xl bg-foreground/[0.05] p-3">
        <input
          type="checkbox"
          checked={reduceOnly}
          onChange={(e) => setReduceOnly(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[12.5px] font-medium">Reduce only</span>
          <span className="text-[11.5px] leading-relaxed text-muted-foreground">
            Shrinks an open position — never opens a new one.
          </span>
        </span>
      </label>

      {/* TP/SL with the PnL they would actually realise. */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Take profit", value: tp, set: setTp, pnl: tpPnl },
          { label: "Stop loss", value: sl, set: setSl, pnl: slPnl },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <Eyebrow className="text-[10.5px]">{f.label}</Eyebrow>
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="—"
              aria-label={f.label}
              className="h-9 w-full min-w-0 rounded-lg bg-foreground/[0.05] px-2.5 text-[13px] tabular-nums outline-none ring-1 ring-border/50 placeholder:text-muted-foreground focus-visible:ring-primary/50"
            />
            <span
              className={cn(
                "text-[10.5px] tabular-nums",
                f.pnl == null
                  ? "text-muted-foreground/60"
                  : f.pnl >= 0
                    ? "text-credit"
                    : "text-debit",
              )}
            >
              {f.pnl == null ? "No trigger set" : `${f.pnl >= 0 ? "+" : "−"}${usd(Math.abs(f.pnl))}`}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!ready}
        className={cn(
          "h-12 shrink-0 rounded-xl text-[14.5px] font-semibold transition-colors",
          !ready
            ? "cursor-not-allowed bg-foreground/[0.05] text-muted-foreground"
            : side === "long"
              ? "bg-credit text-white hover:bg-credit/90"
              : "bg-debit text-white hover:bg-debit/90",
        )}
      >
        {cta}
      </button>

      {/* The summary. Liquidation first — it is the number that ends you. */}
      <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.05] p-3.5">
        <Eyebrow className="text-[11px]">Position summary</Eyebrow>
        <Line
          label="Liquidation price"
          value={marginValue > 0 ? formatPrice(q.liquidationPrice) : "—"}
          tone={distancePct < 5 ? "debit" : "warning"}
          strong
          hint="Where the position closes out"
        />
        {marginValue > 0 && (
          <span aria-hidden className="flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
            <span
              className={cn(
                "block h-full rounded-full",
                distancePct < 5 ? "bg-debit" : distancePct < 12 ? "bg-warning" : "bg-credit",
              )}
              style={{ width: `${Math.min(100, distancePct * 4)}%` }}
            />
          </span>
        )}
        <Line label="Position size" value={marginValue > 0 ? `${q.size.toFixed(4)} ${perp.base}` : "—"} />
        <Line label="Notional" value={marginValue > 0 ? usd(q.notional) : "—"} />
        <Line label="Margin used" value={marginValue > 0 ? usd(q.margin) : "—"} tone="muted" />
        <Line label={`Fee (${(TAKER_FEE * 100).toFixed(2)}%)`} value={marginValue > 0 ? usd(q.fee) : "—"} tone="muted" />
        <span className="my-0.5 h-px bg-border/50" />
        <Line
          label="Funding / 8h"
          value={
            marginValue > 0
              ? `${q.fundingPer8h >= 0 ? "+" : "−"}${usd(Math.abs(q.fundingPer8h))}`
              : `${perp.fundingPct.toFixed(4)}%`
          }
          tone={q.fundingPer8h >= 0 ? "credit" : "debit"}
          hint={perp.fundingPct >= 0 ? "Longs pay shorts" : "Shorts pay longs"}
        />
        <Line label="Margin mode" value={mode === "cross" ? "Cross" : "Isolated"} tone="muted" />
      </div>
    </div>
  )
}
