"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Loading03Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { useSpotBalances } from "@/hooks/useSpotBalances"
import type { OrderType } from "./spot-types"

export function OrderPanel({
  side,
  symbol,
  price,
}: {
  side: "buy" | "sell"
  symbol: string
  price: number
}) {
  const { user, isSignedIn } = useAuth()
  const { addresses, walletsGenerated } = useWallet()

  const [orderType, setOrderType] = React.useState<OrderType>("market")
  const [limitPrice, setLimitPrice] = React.useState("")
  const [stopPrice, setStopPrice] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [pct, setPct] = React.useState(0)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const { baseBalance, quoteBalance } = useSpotBalances(symbol, "USDC")

  const isBuy = side === "buy"
  const effectivePrice =
    orderType === "market" ? price : parseFloat(limitPrice) || price
  const numericAmount = parseFloat(amount) || 0
  const total = numericAmount * effectivePrice
  const canTrade = isSignedIn && walletsGenerated && numericAmount > 0 && !isExecuting

  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4_000)
    return () => clearTimeout(t)
  }, [feedback])

  function handlePct(p: number) {
    setPct(p)
    if (isBuy) {
      const maxSpend = quoteBalance ?? 0
      if (maxSpend > 0 && effectivePrice > 0) {
        setAmount(((maxSpend * p) / 100 / effectivePrice).toFixed(6))
      } else {
        const notional = 1000
        setAmount(((notional * p) / 100 / effectivePrice).toFixed(6))
      }
    } else {
      const maxSell = baseBalance ?? 0
      if (maxSell > 0) {
        setAmount(((maxSell * p) / 100).toFixed(6))
      } else {
        setAmount(((1 * p) / 100).toFixed(6))
      }
    }
  }

  async function handleExecute() {
    if (!canTrade || !user?.userId) return

    setIsExecuting(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/hyperliquid/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: symbol,
          side,
          amount: numericAmount,
          price: orderType === "market" ? undefined : parseFloat(limitPrice),
          orderType,
          stopPrice: orderType === "stop-limit" ? parseFloat(stopPrice) : undefined,
          isSpot: true,
        }),
      })

      const result = await res.json()

      if (result.success) {
        setFeedback({
          type: "success",
          message: "Order placed successfully",
        })
        setAmount("")
        setPct(0)
      } else {
        setFeedback({ type: "error", message: result.error || "Trade failed" })
      }
    } catch {
      setFeedback({ type: "error", message: "Network error — try again" })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="flex flex-col bg-card">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-card px-3 py-2">
        <span
          className={`text-xs font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}
        >
          {isBuy ? "Buy" : "Sell"} {symbol}
        </span>
        <div className="flex rounded-lg border border-border/30 bg-accent/20 p-0.5">
          {(["market", "limit", "stop-limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium capitalize transition-all ${
                orderType === t
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-2">
        {/* Price inputs */}
        {orderType === "limit" || orderType === "stop-limit" ? (
          <>
            <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">Price</span>
                <span className="text-[10px] text-muted-foreground">USD</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => {
                  if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                    setLimitPrice(e.target.value)
                }}
                placeholder={price.toFixed(2)}
                className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            {orderType === "stop-limit" && (
              <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">Stop Price</span>
                  <span className="text-[10px] text-muted-foreground">USD</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stopPrice}
                  onChange={(e) => {
                    if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                      setStopPrice(e.target.value)
                  }}
                  placeholder={price.toFixed(2)}
                  className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Market Price</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              $
              {price.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {/* Amount input */}
        <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Amount</span>
            <span className="text-[10px] text-muted-foreground">{symbol}</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                setAmount(e.target.value)
            }}
            placeholder="0.00"
            className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Percentage quick-select */}
        <div className="flex gap-1">
          {[25, 50, 75, 100].map((mark) => (
            <button
              key={mark}
              onClick={() => handlePct(mark)}
              className={`flex-1 rounded-md py-1 text-[10px] font-medium transition-colors ${
                pct === mark
                  ? isBuy
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-red-500/15 text-red-500"
                  : "bg-accent/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {mark}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-accent/20 px-2.5 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">Total</span>
          <span className="text-xs font-semibold tabular-nums">
            $
            {total > 0
              ? total.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : "0.00"}
          </span>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium ${
              feedback.type === "success"
                ? "border border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                : "border border-red-500/20 bg-red-500/5 text-red-500"
            }`}
          >
            <HugeiconsIcon
              icon={feedback.type === "success" ? CheckmarkCircle02Icon : Alert02Icon}
              className="h-3.5 w-3.5 shrink-0"
            />
            {feedback.message}
          </div>
        )}

        {/* Execute button */}
        <button
          disabled={!canTrade}
          onClick={handleExecute}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isBuy
              ? "bg-emerald-500 hover:bg-emerald-600 hover:shadow-md"
              : "bg-red-500 hover:bg-red-600 hover:shadow-md"
          }`}
        >
          {isExecuting ? (
            <>
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
              Executing…
            </>
          ) : !isSignedIn ? (
            "Sign in to trade"
          ) : !walletsGenerated ? (
            "Setting up wallet…"
          ) : (
            `${isBuy ? "Buy" : "Sell"} ${symbol}`
          )}
        </button>

        {/* Balance info */}
        <div className="flex flex-col gap-0.5 rounded-lg bg-accent/10 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{symbol} Balance</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn ? "—" : !walletsGenerated ? "Loading…" : `${(baseBalance ?? 0).toFixed(6)} ${symbol}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>USDC Balance</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn ? "—" : !walletsGenerated ? "Loading…" : `${(quoteBalance ?? 0).toFixed(2)} USDC`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
