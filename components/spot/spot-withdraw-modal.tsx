"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading03Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Upload04Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { useSpotWithdraw } from "@/hooks/useSpotWithdraw"
import { useSpotBalances } from "@/hooks/useSpotBalances"

interface SpotWithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  onWithdrawComplete?: () => void
}

export function SpotWithdrawModal({ isOpen, onClose, onWithdrawComplete }: SpotWithdrawModalProps) {
  const { withdraw, loading, error, result, reset } = useSpotWithdraw()
  const { quoteBalance, loading: balanceLoading, refetch } = useSpotBalances("BTC", "USDC")

  const [amount, setAmount] = React.useState("")

  if (!isOpen) return null

  const parsedAmount = parseFloat(amount) || 0
  const canSubmit = parsedAmount >= 1 && parsedAmount <= quoteBalance && !loading

  const handleWithdraw = async () => {
    if (!canSubmit) return
    const outcome = await withdraw(parsedAmount)
    if (outcome.success) {
      refetch()
      onWithdrawComplete?.()
    }
  }

  const handleNewWithdraw = () => {
    reset()
    setAmount("")
  }

  const handleMax = () => {
    if (quoteBalance > 0) setAmount(String(quoteBalance))
  }

  const isTerminal = result !== null
  const showForm = !loading && !isTerminal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[440px] mx-4 rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
              <HugeiconsIcon icon={Upload04Icon} className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Withdraw from Spot</h2>
              <p className="text-[10px] text-muted-foreground">Move USDC to your Arbitrum wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          {/* Result banner */}
          {isTerminal && (
            <div className={`mb-4 flex items-start gap-2.5 rounded-xl p-3.5 ${
              result?.success
                ? "border border-emerald-500/20 bg-emerald-500/5"
                : "border border-red-500/20 bg-red-500/5"
            }`}>
              <HugeiconsIcon
                icon={result?.success ? CheckmarkCircle02Icon : Alert02Icon}
                className={`h-4 w-4 shrink-0 mt-0.5 ${result?.success ? "text-emerald-500" : "text-red-500"}`}
              />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${result?.success ? "text-emerald-500" : "text-red-500"}`}>
                  {result?.success ? "Withdrawal successful" : "Withdrawal failed"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {result?.success
                    ? `${result.amount} USDC withdrawn to your Arbitrum wallet`
                    : result?.error || "Something went wrong"}
                </p>
              </div>
            </div>
          )}

          {/* Processing state */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                <HugeiconsIcon icon={Upload04Icon} className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Processing withdrawal…</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
                  Moving USDC from Spot → Perps, then withdrawing to Arbitrum. This may take a moment.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="space-y-4">
              {/* Available balance card */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Available Spot Balance</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {balanceLoading ? (
                      <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin inline text-muted-foreground" />
                    ) : (
                      <>
                        {quoteBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs text-muted-foreground ml-1">USDC</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Withdrawal amount</span>
                  <button
                    type="button"
                    onClick={handleMax}
                    disabled={quoteBalance <= 0}
                    className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-accent transition-colors disabled:text-muted-foreground/40 disabled:cursor-not-allowed"
                  >
                    Max
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value)
                    }}
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
                  />
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">$</div>
                    <span className="text-xs font-semibold">USDC</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/20">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (quoteBalance > 0) setAmount(((quoteBalance * pct) / 100).toFixed(2))
                      }}
                      disabled={quoteBalance <= 0}
                      className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                {parsedAmount > 0 && parsedAmount < 1 && (
                  <p className="text-[10px] text-red-500 mt-2">Minimum withdrawal is 1 USDC</p>
                )}
                {parsedAmount > quoteBalance && quoteBalance > 0 && (
                  <p className="text-[10px] text-red-500 mt-2">Exceeds available balance</p>
                )}
              </div>

              {/* Destination info */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Destination</span>
                  <div className="flex items-center gap-1.5">
                    <img src="https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" alt="ARB" className="h-3.5 w-3.5 rounded-full" />
                    <span className="text-xs font-medium">Arbitrum</span>
                  </div>
                </div>
                <div className="h-px bg-border/20" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Route</span>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Spot</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-2.5 w-2.5" />
                    <span className="font-medium text-foreground">Perps</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-2.5 w-2.5" />
                    <span className="font-medium text-foreground">Arbitrum</span>
                  </div>
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border/30 bg-accent/20 px-3.5 py-2.5">
                <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-px" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  USDC will be transferred from your Spot wallet to Perps, then withdrawn to your Arbitrum trading wallet.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
                  <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-[11px] text-red-500">{error}</p>
                </div>
              )}

              <button
                onClick={isTerminal ? handleNewWithdraw : handleWithdraw}
                disabled={!isTerminal && !canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTerminal ? "New Withdrawal" : `Withdraw${parsedAmount > 0 ? ` ${parsedAmount} USDC` : ""}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
