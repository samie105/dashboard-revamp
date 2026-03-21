"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading03Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useSpotV2Withdraw } from "@/hooks/useSpotV2Withdraw"

interface SpotV2WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  usdcBalance: number
  onWithdrawComplete?: () => void
}

const CHAINS = [
  { id: "ethereum" as const, label: "Ethereum", tag: "ERC-20", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "solana" as const, label: "Solana", tag: "SPL", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "tron" as const, label: "Tron", tag: "TRC-20", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

const TOKENS = [
  { id: "USDC" as const, label: "USDC", icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" },
  { id: "USDT" as const, label: "USDT", icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png" },
]

export function SpotV2WithdrawModal({
  isOpen,
  onClose,
  usdcBalance,
  onWithdrawComplete,
}: SpotV2WithdrawModalProps) {
  const { withdraw, loading, error, result, reset } = useSpotV2Withdraw()

  const [chain, setChain] = React.useState<"ethereum" | "solana" | "tron">("ethereum")
  const [token, setToken] = React.useState<"USDC" | "USDT">("USDC")
  const [amount, setAmount] = React.useState("")

  if (!isOpen) return null

  const parsedAmount = parseFloat(amount) || 0
  const canSubmit = parsedAmount >= 5 && parsedAmount <= usdcBalance && !loading

  const handleWithdraw = async () => {
    if (!canSubmit) return
    const outcome = await withdraw(parsedAmount, chain, token)
    if (outcome.success) {
      onWithdrawComplete?.()
    }
  }

  const handleNewWithdraw = () => {
    reset()
    setAmount("")
  }

  const handleMax = () => {
    if (usdcBalance > 0) setAmount(usdcBalance.toFixed(2))
  }

  const isTerminal = result !== null
  const showForm = !loading || isTerminal

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
              <h2 className="text-sm font-semibold text-foreground">Withdraw from SpotV2</h2>
              <p className="text-[10px] text-muted-foreground">Send funds to your wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
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
                {result?.success ? (
                  <>
                    <p className="text-xs font-medium text-emerald-500">Withdrawal submitted!</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {result.amount} {result.token} will be sent to your {result.chain} wallet.
                    </p>
                    {result.destination && (
                      <p className="text-[10px] text-muted-foreground/80 font-mono mt-1 truncate">
                        {result.destination}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-red-500">Withdrawal failed</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{result?.error}</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Network selector */}
            <div>
              <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
                Receive on
              </span>
              <div className="flex gap-2">
                {CHAINS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChain(c.id)}
                    disabled={isTerminal && result?.success}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                      chain === c.id
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border/30 hover:border-border"
                    } disabled:opacity-50`}
                  >
                    <img src={c.icon} alt={c.label} className="h-5 w-5 rounded-full" />
                    <div className="text-left">
                      <p className={`text-xs font-semibold ${chain === c.id ? "text-primary" : "text-foreground"}`}>{c.label}</p>
                      <p className="text-[10px] text-muted-foreground">{c.tag}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Token selector */}
            <div>
              <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
                Token
              </span>
              <div className="flex gap-2">
                {TOKENS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setToken(t.id)}
                    disabled={isTerminal && result?.success}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                      token === t.id
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border/30 hover:border-border"
                    } disabled:opacity-50`}
                  >
                    <img src={t.icon} alt={t.label} className="h-5 w-5 rounded-full" />
                    <span className={`text-xs font-semibold ${token === t.id ? "text-primary" : "text-foreground"}`}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Amount</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Available: {usdcBalance.toFixed(2)} USDC
                  </span>
                  {usdcBalance > 0 && (!isTerminal || !result?.success) && (
                    <button
                      onClick={handleMax}
                      className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value)
                  }}
                  disabled={isTerminal && result?.success}
                  placeholder="0.00"
                  className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40 disabled:opacity-50"
                />
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                  <img
                    src={TOKENS.find((t) => t.id === token)?.icon}
                    alt={token}
                    className="h-5 w-5 rounded-full"
                  />
                  <span className="text-xs font-semibold">{token}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/20">
                {[10, 50, 100, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(Math.min(v, usdcBalance).toString())}
                    disabled={isTerminal && result?.success}
                    className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {v}
                  </button>
                ))}
              </div>
              {parsedAmount > 0 && parsedAmount < 5 && (
                <p className="text-[10px] text-red-500 mt-2">Minimum withdrawal is 5 {token}</p>
              )}
              {parsedAmount > usdcBalance && (
                <p className="text-[10px] text-red-500 mt-2">Exceeds available balance</p>
              )}
            </div>

            {error && !isTerminal && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
                <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <p className="text-[11px] text-red-500">{error}</p>
              </div>
            )}

            {/* Action button */}
            {isTerminal ? (
              <button
                onClick={handleNewWithdraw}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md"
              >
                {result?.success ? "New Withdrawal" : "Try Again"}
              </button>
            ) : (
              <button
                onClick={handleWithdraw}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                {loading ? "Processing…" : `Withdraw ${token}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
