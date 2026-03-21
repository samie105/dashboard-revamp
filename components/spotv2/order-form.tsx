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
import type { SpotV2Pair } from "./spotv2-types"
import {
  placeSpotV2Order,
  type LedgerBalance,
  type PositionInfo,
} from "@/lib/spotv2/ledger-actions"

const MIN_ORDER_VALUE = 10

type OrderType = "MARKET" | "LIMIT" | "STOP_LIMIT"

// ── Component ────────────────────────────────────────────────────────────

interface SpotV2OrderFormProps {
  pair: SpotV2Pair | undefined
  ledgerBalances: LedgerBalance[]
  positions: PositionInfo[]
  balanceLoading: boolean
  onBalanceRefresh: () => void
}

export function SpotV2OrderForm({ pair, ledgerBalances, positions, balanceLoading, onBalanceRefresh }: SpotV2OrderFormProps) {
  const { isSignedIn } = useAuth()
  const { walletsGenerated } = useWallet()

  // Side toggle
  const [side, setSide] = React.useState<"BUY" | "SELL">("BUY")
  const isBuy = side === "BUY"

  // Order type
  const [orderType, setOrderType] = React.useState<OrderType>("MARKET")

  // Inputs
  const [amount, setAmount] = React.useState("")
  const [totalInput, setTotalInput] = React.useState("")
  const [limitPriceInput, setLimitPriceInput] = React.useState("")
  const [stopPriceInput, setStopPriceInput] = React.useState("")
  const [editingField, setEditingField] = React.useState<"amount" | "total">("amount")
  const [pct, setPct] = React.useState(0)

  // Execution
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const numericAmount = parseFloat(amount) || 0
  const numericLimitPrice = parseFloat(limitPriceInput) || 0
  const numericStopPrice = parseFloat(stopPriceInput) || 0
  const price = pair?.price ?? 0

  // The effective price used for calculations
  const effectivePrice =
    orderType === "MARKET" ? price : numericLimitPrice > 0 ? numericLimitPrice : price

  // ── Reset on pair change ───────────────────────────────────────────────

  React.useEffect(() => {
    setAmount("")
    setTotalInput("")
    setLimitPriceInput("")
    setStopPriceInput("")
    setPct(0)
    setFeedback(null)
  }, [pair?.symbol])

  // ── Balance lookup from ledger ─────────────────────────────────────────

  const usdcBalance = React.useMemo(() => {
    const entry = ledgerBalances.find((b) => b.token === "USDC")
    return entry?.available ?? 0
  }, [ledgerBalances])

  const tokenBalance = React.useMemo(() => {
    if (!pair) return 0
    const pos = positions.find(
      (p) => p.token.toUpperCase() === pair.symbol.toUpperCase(),
    )
    return pos?.quantity ?? 0
  }, [positions, pair])

  const tokenAvgEntry = React.useMemo(() => {
    if (!pair) return 0
    const pos = positions.find(
      (p) => p.token.toUpperCase() === pair.symbol.toUpperCase(),
    )
    return pos?.avgEntryPrice ?? 0
  }, [positions, pair])

  // ── Total sync ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (editingField === "amount" && numericAmount > 0 && effectivePrice > 0) {
      setTotalInput((numericAmount * effectivePrice).toFixed(2))
    } else if (editingField === "amount" && !amount) {
      setTotalInput("")
    }
  }, [amount, effectivePrice, editingField, numericAmount])

  // ── Validation ─────────────────────────────────────────────────────────

  const balanceError = React.useMemo(() => {
    if (!isSignedIn || numericAmount <= 0) return null
    if (isBuy) {
      const totalNeeded = numericAmount * effectivePrice
      if (totalNeeded > usdcBalance) {
        return `Insufficient USDC (need ~$${totalNeeded.toFixed(2)}, have $${usdcBalance.toFixed(2)})`
      }
    } else {
      if (numericAmount > tokenBalance) {
        return `Insufficient ${pair?.symbol || "token"} (have ${tokenBalance.toFixed(6)})`
      }
    }
    return null
  }, [isBuy, numericAmount, effectivePrice, usdcBalance, tokenBalance, pair?.symbol, isSignedIn])

  const minOrderError = React.useMemo(() => {
    if (numericAmount <= 0 || effectivePrice <= 0) return null
    const notional = numericAmount * effectivePrice
    if (notional < MIN_ORDER_VALUE - 0.005) {
      return `Min order $${MIN_ORDER_VALUE}. Yours: $${notional.toFixed(2)}`
    }
    return null
  }, [numericAmount, effectivePrice])

  const limitPriceError = React.useMemo(() => {
    if (orderType === "MARKET") return null
    if (numericLimitPrice <= 0) return "Enter a limit price"
    return null
  }, [orderType, numericLimitPrice])

  const stopPriceError = React.useMemo(() => {
    if (orderType !== "STOP_LIMIT") return null
    if (numericStopPrice <= 0) return "Enter a stop price"
    return null
  }, [orderType, numericStopPrice])

  const canTrade =
    isSignedIn &&
    walletsGenerated &&
    numericAmount > 0 &&
    !isExecuting &&
    !balanceError &&
    !minOrderError &&
    !limitPriceError &&
    !stopPriceError

  // ── Feedback timeout ───────────────────────────────────────────────────

  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 6_000)
    return () => clearTimeout(t)
  }, [feedback])

  // ── Input handlers ─────────────────────────────────────────────────────

  function handleNumericInput(
    value: string,
    setter: (v: string) => void,
  ) {
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setter(value)
    }
  }

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
      const maxSpend = usdcBalance
      if (maxSpend > 0 && effectivePrice > 0) {
        const rawAmount = (maxSpend * p) / 100 / effectivePrice
        setAmount(rawAmount.toFixed(6))
        setTotalInput(((maxSpend * p) / 100).toFixed(2))
      }
    } else {
      const maxSell = tokenBalance
      if (maxSell > 0) {
        const rawAmount = (maxSell * p) / 100
        setAmount(rawAmount.toFixed(6))
        setTotalInput((rawAmount * effectivePrice).toFixed(2))
      }
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────

  async function handleExecute() {
    if (!canTrade || !pair) return

    setIsExecuting(true)
    setFeedback(null)

    try {
      const result = await placeSpotV2Order({
        token: pair.symbol,
        side,
        orderType,
        quantity: numericAmount,
        limitPrice: orderType !== "MARKET" ? numericLimitPrice : undefined,
        stopPrice: orderType === "STOP_LIMIT" ? numericStopPrice : undefined,
      })

      if (result.success) {
        const actionLabel =
          orderType === "MARKET"
            ? `${isBuy ? "Bought" : "Sold"} ${numericAmount.toFixed(4)} ${pair.symbol}` +
              (result.fillPrice ? ` @ $${result.fillPrice.toLocaleString()}` : "")
            : `${orderType.replace("_", "-")} order placed for ${numericAmount.toFixed(4)} ${pair.symbol}`

        setFeedback({ type: "success", message: actionLabel })
        setAmount("")
        setTotalInput("")
        setPct(0)
        onBalanceRefresh()
      } else {
        setFeedback({ type: "error", message: result.error || "Order failed" })
      }
    } catch {
      setFeedback({ type: "error", message: "Network error — try again" })
    } finally {
      setIsExecuting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (!pair) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/50">Select a pair</p>
      </div>
    )
  }

  const sliderPct = pct || 0

  return (
    <div className="flex h-full flex-col bg-card overflow-y-auto">
      {/* Buy / Sell tabs */}
      <div className="sticky top-0 z-10 flex border-b border-border/10 bg-card">
        <button
          onClick={() => setSide("BUY")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            isBuy
              ? "border-b-2 border-emerald-500 text-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            !isBuy
              ? "border-b-2 border-red-500 text-red-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {/* Order type selector */}
        <div className="flex rounded-lg border border-border/30 bg-accent/10 p-0.5">
          {(["MARKET", "LIMIT", "STOP_LIMIT"] as const).map((ot) => (
            <button
              key={ot}
              onClick={() => setOrderType(ot)}
              className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                orderType === ot
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ot === "STOP_LIMIT" ? "Stop" : ot.charAt(0) + ot.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Market price */}
        <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Market Price</span>
            <span className="text-[10px] text-muted-foreground">Binance</span>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            ${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })}
          </span>
        </div>

        {/* Stop price input (stop-limit only) */}
        {orderType === "STOP_LIMIT" && (
          <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Stop Price</span>
              <span className="text-[10px] text-muted-foreground">USDC</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-semibold text-muted-foreground/60 mr-0.5">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={stopPriceInput}
                onChange={(e) => handleNumericInput(e.target.value, setStopPriceInput)}
                placeholder="0.00"
                className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        )}

        {/* Limit price input (limit + stop-limit) */}
        {orderType !== "MARKET" && (
          <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Limit Price</span>
              <span className="text-[10px] text-muted-foreground">USDC</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-semibold text-muted-foreground/60 mr-0.5">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={limitPriceInput}
                onChange={(e) => handleNumericInput(e.target.value, setLimitPriceInput)}
                placeholder="0.00"
                className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        )}

        {/* Amount input */}
        <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Amount</span>
            <span className="text-[10px] text-muted-foreground">{pair.symbol}</span>
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

        {/* Percentage slider */}
        <div className="flex flex-col gap-1">
          <div className="relative px-0.5">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderPct}
              onChange={(e) => handlePct(Number(e.target.value))}
              className="w-full appearance-none h-1.5 rounded-full outline-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${isBuy ? "rgb(16 185 129)" : "rgb(239 68 68)"} ${sliderPct}%, var(--color-accent, hsl(var(--accent))) ${sliderPct}%)`,
              }}
            />
            {sliderPct > 0 && (
              <div className="text-center mt-0.5">
                <span className={`text-[10px] font-semibold tabular-nums ${isBuy ? "text-emerald-500" : "text-red-500"}`}>
                  {sliderPct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total — bidirectional */}
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

        {/* Order summary for limit/stop-limit */}
        {orderType !== "MARKET" && numericAmount > 0 && numericLimitPrice > 0 && (
          <div className="rounded-lg border border-border/20 bg-accent/10 px-2.5 py-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Order Type</span>
              <span className="font-medium">{orderType === "STOP_LIMIT" ? "Stop-Limit" : "Limit"} (GTC)</span>
            </div>
            {orderType === "STOP_LIMIT" && numericStopPrice > 0 && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Trigger at</span>
                <span className="tabular-nums font-medium">${numericStopPrice.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{isBuy ? "Buy" : "Sell"} at</span>
              <span className="tabular-nums font-medium">${numericLimitPrice.toLocaleString()}</span>
            </div>
            {isBuy && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Lock</span>
                <span className="tabular-nums font-medium">${(numericAmount * numericLimitPrice).toFixed(2)} USDC</span>
              </div>
            )}
          </div>
        )}

        {/* Validation warnings */}
        {limitPriceError && numericAmount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium border border-amber-500/20 bg-amber-500/5 text-amber-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3 w-3 shrink-0" />
            {limitPriceError}
          </div>
        )}
        {stopPriceError && numericAmount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium border border-amber-500/20 bg-amber-500/5 text-amber-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3 w-3 shrink-0" />
            {stopPriceError}
          </div>
        )}
        {minOrderError && (
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium border border-amber-500/20 bg-amber-500/5 text-amber-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3 w-3 shrink-0" />
            {minOrderError}
          </div>
        )}
        {balanceError && (
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium border border-red-500/20 bg-red-500/5 text-red-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3 w-3 shrink-0" />
            {balanceError}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${
              feedback.type === "success"
                ? "border border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                : "border border-red-500/20 bg-red-500/5 text-red-500"
            }`}
          >
            <HugeiconsIcon
              icon={feedback.type === "success" ? CheckmarkCircle02Icon : Alert02Icon}
              className="h-3 w-3 shrink-0"
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
              {orderType === "MARKET" ? "Executing…" : "Placing order…"}
            </>
          ) : !isSignedIn ? (
            "Sign in to trade"
          ) : !walletsGenerated ? (
            "Setting up wallet…"
          ) : numericAmount > 0 ? (
            orderType === "MARKET"
              ? `${isBuy ? "Buy" : "Sell"} ${numericAmount.toFixed(4)} ${pair.symbol}`
              : `Place ${orderType === "STOP_LIMIT" ? "Stop" : "Limit"} ${isBuy ? "Buy" : "Sell"}`
          ) : (
            `${isBuy ? "Buy" : "Sell"} ${pair.symbol}`
          )}
        </button>

        {/* Balance info */}
        <div className="flex flex-col gap-0.5 rounded-lg bg-accent/10 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{pair.symbol} Position</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn
                ? "—"
                : balanceLoading
                  ? "Loading…"
                  : tokenBalance > 0
                    ? `${tokenBalance.toFixed(6)} ${pair.symbol}`
                    : `0 ${pair.symbol}`}
            </span>
          </div>
          {tokenBalance > 0 && tokenAvgEntry > 0 && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Avg Entry</span>
              <span className="tabular-nums font-medium">
                ${tokenAvgEntry.toLocaleString(undefined, { maximumFractionDigits: tokenAvgEntry < 1 ? 6 : 2 })}
              </span>
            </div>
          )}
          {tokenBalance > 0 && tokenAvgEntry > 0 && price > 0 && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Unrealized PnL</span>
              <span
                className={`tabular-nums font-medium ${
                  (price - tokenAvgEntry) * tokenBalance >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                }`}
              >
                {((price - tokenAvgEntry) * tokenBalance) >= 0 ? "+" : ""}
                ${((price - tokenAvgEntry) * tokenBalance).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>USDC Available</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn
                ? "—"
                : balanceLoading
                  ? "Loading…"
                  : `$${usdcBalance.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
