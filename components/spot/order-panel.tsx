"use client"

import * as React from "react"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { executeTrade } from "@/lib/actions"
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
  const [amount, setAmount] = React.useState("")
  const [pct, setPct] = React.useState(0)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const isBuy = side === "buy"
  const effectivePrice =
    orderType === "market" ? price : parseFloat(limitPrice) || price
  const numericAmount = parseFloat(amount) || 0
  const total = numericAmount * effectivePrice
  const canTrade = isSignedIn && walletsGenerated && numericAmount > 0 && !isExecuting

  // Clear feedback after 4s
  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4_000)
    return () => clearTimeout(t)
  }, [feedback])

  function handlePct(p: number) {
    setPct(p)
    // Without on-chain balance data, percentage buttons set fractional amounts
    // based on 1 unit of the base asset for sells, $1000 notional for buys
    const notional = 1000
    if (isBuy) setAmount(((notional * p) / 100 / effectivePrice).toFixed(6))
    else setAmount(((1 * p) / 100).toFixed(6))
  }

  async function handleExecute() {
    if (!canTrade || !user?.userId) return

    setIsExecuting(true)
    setFeedback(null)

    try {
      // For spot: buy = USDT→TOKEN, sell = TOKEN→USDT
      const tokenIn = isBuy ? "USDT" : symbol
      const tokenOut = isBuy ? symbol : "USDT"
      const amountStr = isBuy
        ? total.toFixed(6) // USDT amount
        : numericAmount.toFixed(6) // token amount

      const result = await executeTrade({
        userId: user.userId,
        fromChain: 1, // Default to Ethereum mainnet
        tokenIn,
        tokenOut,
        amountIn: amountStr,
        slippage: 0.005,
      })

      if (result.success) {
        setFeedback({
          type: "success",
          message: result.txHash
            ? `Order placed • ${result.txHash.slice(0, 10)}…`
            : "Order placed successfully",
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
    <div className="flex flex-col rounded-xl bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
        <span
          className={`text-xs font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}
        >
          {isBuy ? "Buy" : "Sell"} {symbol}
        </span>
        <div className="flex rounded-md bg-accent/30 p-0.5">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
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

      <div className="flex flex-col gap-2 p-3">
        {orderType === "limit" ? (
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground">
              Price
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => {
                  if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                    setLimitPrice(e.target.value)
                }}
                placeholder={price.toFixed(2)}
                className="w-full rounded-lg bg-accent/40 py-1.5 pl-3 pr-10 text-sm tabular-nums outline-none focus:bg-accent"
              />
              <span className="absolute right-2.5 top-1.5 text-[10px] text-muted-foreground">
                USD
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              Market Price
            </span>
            <span className="text-xs font-medium tabular-nums">
              $
              {price.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <div>
          <label className="mb-0.5 block text-[10px] text-muted-foreground">
            Amount
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                  setAmount(e.target.value)
              }}
              placeholder="0.00"
              className="w-full rounded-lg bg-accent/40 py-1.5 pl-3 pr-10 text-sm tabular-nums outline-none focus:bg-accent"
            />
            <span className="absolute right-2.5 top-1.5 text-[10px] text-muted-foreground">
              {symbol}
            </span>
          </div>
        </div>

        {/* Percentage slider with marks */}
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => handlePct(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer accent-current"
            style={{
              background: `linear-gradient(to right, ${isBuy ? "#10b981" : "#ef4444"} ${pct}%, var(--color-accent) ${pct}%)`,
              accentColor: isBuy ? "#10b981" : "#ef4444",
            }}
          />
          <div className="flex justify-between">
            {[0, 25, 50, 75, 100].map((mark) => (
              <button
                key={mark}
                onClick={() => handlePct(mark)}
                className={`text-[9px] font-medium transition-colors ${
                  pct === mark
                    ? isBuy
                      ? "text-emerald-500"
                      : "text-red-500"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                {mark}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">Total</span>
          <span className="text-xs font-medium tabular-nums">
            $
            {total > 0
              ? total.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : "0.00"}
          </span>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <button
          disabled={!canTrade}
          onClick={handleExecute}
          className={`w-full rounded-lg py-2 text-xs font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isBuy
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {isExecuting
            ? "Executing…"
            : !isSignedIn
              ? "Sign in to trade"
              : !walletsGenerated
                ? "Setting up wallet…"
                : `${isBuy ? "Buy" : "Sell"} ${symbol}`}
        </button>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Wallet</span>
          <span className="tabular-nums">
            {!isSignedIn
              ? "Not connected"
              : !walletsGenerated
                ? "Loading…"
                : `${addresses?.ethereum?.slice(0, 6)}…${addresses?.ethereum?.slice(-4)}`}
          </span>
        </div>
      </div>
    </div>
  )
}
