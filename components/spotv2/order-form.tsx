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
import { useWalletBalances } from "@/hooks/useWalletBalances"
import type { SpotV2Pair } from "./spotv2-types"
import {
  getSpotV2Quote,
  executeSpotV2Trade,
  type SpotV2QuoteResult,
} from "@/lib/spotv2/trade-actions"

const MIN_ORDER_VALUE = 10
const QUOTE_DEBOUNCE_MS = 800

// ── Helpers ──────────────────────────────────────────────────────────────

function formatOutputAmount(rawAmount: string, decimals: number): string {
  if (!rawAmount) return "0"
  const str = rawAmount.padStart(decimals + 1, "0")
  const intPart = str.slice(0, str.length - decimals) || "0"
  const fracPart = str.slice(str.length - decimals)
  return `${intPart}.${fracPart.slice(0, 6)}`
}

// ── Component ────────────────────────────────────────────────────────────

export function SpotV2OrderForm({ pair }: { pair: SpotV2Pair | undefined }) {
  const { user, isSignedIn } = useAuth()
  const { walletsGenerated } = useWallet()
  const { balances, refetch: refetchBalances } = useWalletBalances()

  // Side toggle
  const [side, setSide] = React.useState<"BUY" | "SELL">("BUY")
  const isBuy = side === "BUY"

  // Inputs
  const [amount, setAmount] = React.useState("")
  const [totalInput, setTotalInput] = React.useState("")
  const [editingField, setEditingField] = React.useState<"amount" | "total">("amount")
  const [pct, setPct] = React.useState(0)

  // Quote
  const [quote, setQuote] = React.useState<SpotV2QuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const quoteTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Execution
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const numericAmount = parseFloat(amount) || 0
  const price = pair?.price ?? 0

  // ── Reset on pair change ───────────────────────────────────────────────

  React.useEffect(() => {
    setAmount("")
    setTotalInput("")
    setPct(0)
    setQuote(null)
    setFeedback(null)
  }, [pair?.symbol])

  // ── Balance lookup ─────────────────────────────────────────────────────

  const baseBalance = React.useMemo(() => {
    if (!pair) return 0
    const match = balances.find(
      (b) =>
        b.symbol.toUpperCase() === pair.symbol.toUpperCase() &&
        b.chain.toLowerCase() === (pair.chain || "ethereum").toLowerCase(),
    )
    return match?.balance ?? 0
  }, [balances, pair])

  const quoteBalance = React.useMemo(() => {
    if (!pair) return 0
    const chain = (pair.chain || "ethereum").toLowerCase()
    const match = balances.find(
      (b) =>
        b.symbol.toUpperCase() === "USDC" &&
        b.chain.toLowerCase() === chain,
    )
    return match?.balance ?? 0
  }, [balances, pair])

  // ── Total sync ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (editingField === "amount" && numericAmount > 0 && price > 0) {
      setTotalInput((numericAmount * price).toFixed(2))
    } else if (editingField === "amount" && !amount) {
      setTotalInput("")
    }
  }, [amount, price, editingField, numericAmount])

  // ── Debounced quote fetching ───────────────────────────────────────────

  React.useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    setQuote(null)

    if (!pair || numericAmount <= 0) {
      setQuoteLoading(false)
      return
    }

    // Skip quote for very small amounts
    const notional = isBuy ? numericAmount : numericAmount * price
    if (notional < 1) return

    setQuoteLoading(true)
    quoteTimerRef.current = setTimeout(async () => {
      try {
        // BUY: user enters USD amount → amount is in USDC
        // SELL: user enters token amount → amount is in token
        const quoteAmount = isBuy
          ? (numericAmount * price).toFixed(2)
          : numericAmount.toString()

        const result = await getSpotV2Quote({
          chain: pair.chain || "ethereum",
          contractAddress: pair.contractAddress,
          symbol: pair.symbol,
          side,
          amount: quoteAmount,
          decimals: isBuy ? 6 : 18,
        })
        setQuote(result)
      } catch {
        setQuote({ success: false, error: "Failed to fetch quote" })
      } finally {
        setQuoteLoading(false)
      }
    }, QUOTE_DEBOUNCE_MS)

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericAmount, side, pair?.symbol, pair?.chain])

  // ── Validation ─────────────────────────────────────────────────────────

  const balanceError = React.useMemo(() => {
    if (!isSignedIn || !walletsGenerated || numericAmount <= 0) return null
    if (isBuy) {
      const totalNeeded = numericAmount * price
      if (totalNeeded > quoteBalance) {
        return `Insufficient USDC (need ~$${totalNeeded.toFixed(2)})`
      }
    } else {
      if (numericAmount > baseBalance) {
        return `Insufficient ${pair?.symbol || "token"} balance`
      }
    }
    return null
  }, [isBuy, numericAmount, price, quoteBalance, baseBalance, pair?.symbol, isSignedIn, walletsGenerated])

  const minOrderError = React.useMemo(() => {
    if (numericAmount <= 0 || price <= 0) return null
    const notional = isBuy ? numericAmount * price : numericAmount * price
    if (notional < MIN_ORDER_VALUE - 0.005) {
      return `Min order $${MIN_ORDER_VALUE}. Yours: $${notional.toFixed(2)}`
    }
    return null
  }, [numericAmount, price, isBuy])

  const canTrade =
    isSignedIn &&
    walletsGenerated &&
    numericAmount > 0 &&
    !isExecuting &&
    !balanceError &&
    !minOrderError &&
    quote?.success &&
    quote.executionData

  // ── Feedback timeout ───────────────────────────────────────────────────

  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 6_000)
    return () => clearTimeout(t)
  }, [feedback])

  // ── Input handlers ─────────────────────────────────────────────────────

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
      if (numTotal > 0 && price > 0) {
        setAmount((numTotal / price).toFixed(6))
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
      const maxSpend = quoteBalance
      if (maxSpend > 0 && price > 0) {
        const rawAmount = (maxSpend * p) / 100 / price
        setAmount(rawAmount.toFixed(6))
        setTotalInput(((maxSpend * p) / 100).toFixed(2))
      }
    } else {
      const maxSell = baseBalance
      if (maxSell > 0) {
        const rawAmount = (maxSell * p) / 100
        setAmount(rawAmount.toFixed(6))
        setTotalInput((rawAmount * price).toFixed(2))
      }
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────

  async function handleExecute() {
    if (!canTrade || !pair || !quote?.executionData) return

    setIsExecuting(true)
    setFeedback(null)

    try {
      const USDC_CHAINS: Record<string, string> = {
        ethereum: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        polygon: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      }

      const chain = (pair.chain || "ethereum").toLowerCase()
      const usdcAddr = USDC_CHAINS[chain] || USDC_CHAINS.ethereum
      const tokenAddr = pair.contractAddress || "0x0000000000000000000000000000000000000000"

      const result = await executeSpotV2Trade({
        chain,
        pair: `${pair.symbol}/USDC`,
        side,
        fromTokenAddress: isBuy ? usdcAddr : tokenAddr,
        fromTokenSymbol: isBuy ? "USDC" : pair.symbol,
        fromAmount: isBuy ? (numericAmount * price).toFixed(2) : numericAmount.toString(),
        toTokenAddress: isBuy ? tokenAddr : usdcAddr,
        toTokenSymbol: isBuy ? pair.symbol : "USDC",
        expectedToAmount: quote.expectedOutput || "0",
        executionPrice: price.toString(),
        slippage: 0.5,
        executionData: quote.executionData,
      })

      if (result.success) {
        setFeedback({
          type: "success",
          message: `${isBuy ? "Bought" : "Sold"} ${numericAmount.toFixed(4)} ${pair.symbol}`,
        })
        setAmount("")
        setTotalInput("")
        setPct(0)
        setQuote(null)
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
        {/* Market price */}
        <div className="rounded-lg border border-border/30 bg-accent/20 px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Market Price</span>
            <span className="text-[10px] text-muted-foreground">{pair.chain || "ethereum"}</span>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            ${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })}
          </span>
        </div>

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

        {/* Quote info */}
        {quoteLoading && numericAmount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
            <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
            Fetching route…
          </div>
        )}
        {quote?.success && quote.expectedOutput && (
          <div className="rounded-lg border border-border/20 bg-accent/10 px-2.5 py-1 space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Expected</span>
              <span className="tabular-nums font-medium">
                {isBuy
                  ? `~${formatOutputAmount(quote.expectedOutput, 18)} ${pair.symbol}`
                  : `~$${formatOutputAmount(quote.expectedOutput, 6)}`}
              </span>
            </div>
            {quote.gasEstimate && quote.gasEstimate !== "0" && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Gas Fee</span>
                <span className="tabular-nums">~${parseFloat(quote.gasEstimate).toFixed(2)}</span>
              </div>
            )}
            {quote.priceImpact !== undefined && quote.priceImpact > 0.5 && (
              <div className="flex items-center justify-between text-[10px] text-amber-500">
                <span>Price Impact</span>
                <span className="tabular-nums font-medium">{quote.priceImpact.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}
        {quote && !quote.success && quote.error && (
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] border border-amber-500/20 bg-amber-500/5 text-amber-500">
            <HugeiconsIcon icon={Alert02Icon} className="h-3 w-3 shrink-0" />
            {quote.error}
          </div>
        )}

        {/* Validation warnings */}
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
              Executing…
            </>
          ) : !isSignedIn ? (
            "Sign in to trade"
          ) : !walletsGenerated ? (
            "Setting up wallet…"
          ) : numericAmount > 0 ? (
            `${isBuy ? "Buy" : "Sell"} ${numericAmount.toFixed(4)} ${pair.symbol}`
          ) : (
            `${isBuy ? "Buy" : "Sell"} ${pair.symbol}`
          )}
        </button>

        {/* Balance info */}
        <div className="flex flex-col gap-0.5 rounded-lg bg-accent/10 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{pair.symbol} Balance</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn
                ? "—"
                : !walletsGenerated
                  ? "Loading…"
                  : `${baseBalance.toFixed(6)} ${pair.symbol}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>USDC Balance</span>
            <span className="tabular-nums font-medium">
              {!isSignedIn
                ? "—"
                : !walletsGenerated
                  ? "Loading…"
                  : `${quoteBalance.toFixed(2)} USDC`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
