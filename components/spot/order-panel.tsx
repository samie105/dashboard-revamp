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

const MIN_ORDER_VALUE = 10

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
  const [totalInput, setTotalInput] = React.useState("")
  const [editingField, setEditingField] = React.useState<"amount" | "total">("amount")
  const [pct, setPct] = React.useState(0)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const { baseBalance, quoteBalance, refetch: refetchBalances } = useSpotBalances(symbol, "USDC")

  const isBuy = side === "buy"
  const effectivePrice =
    orderType === "market" ? price : parseFloat(limitPrice) || price
  const numericAmount = parseFloat(amount) || 0
  const total = numericAmount * effectivePrice

  // Sync total display when amount changes (unless user is typing in total)
  React.useEffect(() => {
    if (editingField === "amount" && numericAmount > 0 && effectivePrice > 0) {
      setTotalInput((numericAmount * effectivePrice).toFixed(2))
    } else if (editingField === "amount" && !amount) {
      setTotalInput("")
    }
  }, [amount, effectivePrice, editingField, numericAmount])

  // Validation helpers
  const balanceError = React.useMemo(() => {
    if (!isSignedIn || !walletsGenerated || numericAmount <= 0) return null
    if (isBuy) {
      if (total > (quoteBalance ?? 0)) {
        return `Insufficient USDC (need ~$${total.toFixed(2)})`
      }
    } else {
      if (numericAmount > (baseBalance ?? 0)) {
        return `Insufficient ${symbol} balance`
      }
    }
    return null
  }, [isBuy, numericAmount, total, quoteBalance, baseBalance, symbol, isSignedIn, walletsGenerated])

  const minOrderError = React.useMemo(() => {
    if (numericAmount <= 0 || effectivePrice <= 0) return null
    if (total < MIN_ORDER_VALUE) {
      return `Min order $${MIN_ORDER_VALUE}. Yours: $${total.toFixed(2)}`
    }
    return null
  }, [numericAmount, effectivePrice, total])

  const canTrade =
    isSignedIn &&
    walletsGenerated &&
    numericAmount > 0 &&
    !isExecuting &&
    !balanceError &&
    !minOrderError

  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 6_000)
    return () => clearTimeout(t)
  }, [feedback])

  function handleAmountChange(value: string) {
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setEditingField("amount")
      setAmount(value)
      setPct(0)
    }
  }

  function handleTotalChange(value: string) {
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setEditingField("total")
      setTotalInput(value)
      const numTotal = parseFloat(value) || 0
      if (numTotal > 0 && effectivePrice > 0) {
        setAmount((numTotal / effectivePrice).toFixed(6))
      } else {
        setAmount("")
      }
      setPct(0)
    }
  }

  function handlePct(p: number) {
    setPct(p)
    setEditingField("amount")
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
        // Parse HL response for fill details
        const statuses = result.data?.response?.data?.statuses
        const firstStatus = statuses?.[0]
        let msg = `${isBuy ? "Buy" : "Sell"} order placed`

        if (firstStatus?.filled) {
          const f = firstStatus.filled
          const avgPx = parseFloat(f.avgPx).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
          msg = `Filled ${f.totalSz} ${symbol} @ $${avgPx}`
        } else if (firstStatus?.resting) {
          msg = `Limit order resting (ID: ${firstStatus.resting.oid})`
        }

        setFeedback({ type: "success", message: msg })
        setAmount("")
        setTotalInput("")
        setPct(0)

        // Immediately refetch balances so UI updates
        refetchBalances()
      } else {
        setFeedback({ type: "error", message: result.error || "Trade failed" })
      }
    } catch {
      setFeedback({ type: "error", message: "Network error — try again" })
    } finally {
      setIsExecuting(false)
    }
  }

  // Percentage for the slider track fill
  const sliderPct = pct || 0

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
            onChange={(e) => handleAmountChange(e.target.value)}
            onFocus={() => setEditingField("amount")}
            placeholder="0.00"
            className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Percentage quick-select buttons + slider */}
        <div className="flex flex-col gap-1">
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
          <div className="relative px-0.5">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderPct}
              onChange={(e) => handlePct(Number(e.target.value))}
              className="w-full appearance-none h-1 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground/80 [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-sm"
              style={{
                background: `linear-gradient(to right, ${isBuy ? "rgb(16 185 129)" : "rgb(239 68 68)"} ${sliderPct}%, hsl(var(--accent) / 0.3) ${sliderPct}%)`,
              }}
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-muted-foreground/50">0%</span>
              <span className="text-[9px] text-muted-foreground/50">100%</span>
            </div>
          </div>
        </div>

        {/* Total — bidirectional input */}
        <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            <span className="text-[10px] text-muted-foreground">USDC</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-semibold text-muted-foreground/60 mr-0.5">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={totalInput}
              onChange={(e) => handleTotalChange(e.target.value)}
              onFocus={() => setEditingField("total")}
              placeholder="0.00"
              className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Validation warnings */}
        {minOrderError && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium border border-amber-500/20 bg-amber-500/5 text-amber-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 shrink-0" />
            {minOrderError}
          </div>
        )}
        {balanceError && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium border border-red-500/20 bg-red-500/5 text-red-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 shrink-0" />
            {balanceError}
          </div>
        )}

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
