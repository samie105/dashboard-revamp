"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading03Icon,
  Copy01Icon,
  Tick02Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
} from "@hugeicons/core-free-icons"
import { useSpotV2Deposit, type SpotV2DepositInfo, type DepositPhase } from "@/hooks/useSpotV2Deposit"
import { useWallet } from "@/components/wallet-provider"
import { useWalletBalances } from "@/hooks/useWalletBalances"

interface SpotV2DepositModalProps {
  isOpen: boolean
  onClose: () => void
  onDepositComplete?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; spinning?: boolean }> = {
  pending: { label: "Sending from your wallet…", color: "text-blue-500", spinning: true },
  detected: { label: "Payment detected on-chain!", color: "text-emerald-500", spinning: true },
  matched: { label: "Payment confirmed!", color: "text-emerald-500", spinning: true },
  verified: { label: "Processing your deposit…", color: "text-orange-500", spinning: true },
  processing: { label: "Processing…", color: "text-orange-500", spinning: true },
  completed: { label: "Deposit complete — balance credited!", color: "text-emerald-500" },
  disbursed: { label: "Deposit complete — balance credited!", color: "text-emerald-500" },
  failed: { label: "Deposit failed", color: "text-red-500" },
  expired: { label: "Deposit expired", color: "text-red-500" },
  rejected: { label: "Deposit rejected", color: "text-red-500" },
}

const CHAINS = [
  { id: "ethereum" as const, label: "Ethereum", tag: "ERC-20", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "solana" as const, label: "Solana", tag: "SPL", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "tron" as const, label: "Tron", tag: "TRC-20", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

const TOKENS = [
  { id: "USDT" as const, label: "USDT", icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png" },
  { id: "USDC" as const, label: "USDC", icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" },
]

export function SpotV2DepositModal({ isOpen, onClose, onDepositComplete }: SpotV2DepositModalProps) {
  const { deposit, phase, loading, error, initiate, reset } = useSpotV2Deposit()
  const { addresses, isLoading: walletsLoading } = useWallet()
  const { balances: onChainBalances, isLoading: balancesLoading } = useWalletBalances()

  const [chain, setChain] = React.useState<"ethereum" | "solana" | "tron">("ethereum")
  const [token, setToken] = React.useState<"USDT" | "USDC">("USDT")
  const [amount, setAmount] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const fromAddress = React.useMemo(() => {
    if (!addresses) return ""
    if (chain === "solana") return addresses.solana
    if (chain === "tron") return addresses.tron
    return addresses.ethereum
  }, [chain, addresses])

  // On-chain balance for the selected chain/token
  const onChainBalance = React.useMemo(() => {
    const match = onChainBalances.find(
      (b) => b.chain === chain && b.symbol === token,
    )
    return match?.balance ?? 0
  }, [onChainBalances, chain, token])

  React.useEffect(() => {
    if (deposit?.status === "completed" || deposit?.status === "disbursed") {
      onDepositComplete?.()
    }
  }, [deposit?.status, onDepositComplete])

  if (!isOpen) return null

  const parsedAmount = parseFloat(amount) || 0

  const insufficientBalance = !balancesLoading && parsedAmount > 0 && parsedAmount > onChainBalance

  const handleInitiate = async () => {
    if (parsedAmount < 2) return
    if (!fromAddress) return
    if (insufficientBalance) return
    await initiate({
      depositChain: chain,
      depositAmount: parsedAmount,
      depositFromAddress: fromAddress,
      depositToken: token,
    })
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNewDeposit = () => {
    reset()
    setAmount("")
  }

  const isActive = deposit && !["completed", "disbursed", "failed", "expired", "rejected"].includes(deposit.status)
  const isTerminal = deposit && ["completed", "disbursed", "failed", "expired", "rejected"].includes(deposit.status)
  const isSuccess = deposit && ["completed", "disbursed"].includes(deposit.status)
  const showForm = !deposit || isTerminal
  const statusCfg = deposit ? STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[440px] mx-4 rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <HugeiconsIcon icon={Download04Icon} className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Deposit to spot wallet</h2>
              <p className="text-[10px] text-muted-foreground">Fund your trading balance</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {/* ═══ FORM ═══ */}
          {showForm && (
            <div className="space-y-4">
              {/* Terminal status banner */}
              {isTerminal && (
                <div className={`flex items-center gap-2.5 rounded-xl p-3 ${
                  isSuccess
                    ? "border border-emerald-500/20 bg-emerald-500/5"
                    : "border border-red-500/20 bg-red-500/5"
                }`}>
                  <HugeiconsIcon
                    icon={isSuccess ? CheckmarkCircle02Icon : Alert02Icon}
                    className={`h-4 w-4 shrink-0 ${statusCfg?.color}`}
                  />
                  <p className={`text-xs font-medium ${statusCfg?.color}`}>{statusCfg?.label}</p>
                </div>
              )}

              {/* Network selector */}
              <div>
                <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
                  Send from
                </span>
                <div className="flex gap-2">
                  {CHAINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChain(c.id)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                        chain === c.id
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/30 hover:border-border"
                      }`}
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
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                        token === t.id
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/30 hover:border-border"
                      }`}
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
                    <span className="text-[11px] text-muted-foreground">Min 2 {token}</span>
                    {onChainBalance > 0 && (
                      <button
                        onClick={() => setAmount(onChainBalance.toFixed(2))}
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
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
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
                  {[10, 50, 100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v.toString())}
                      className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {parsedAmount > 0 && parsedAmount < 2 && (
                  <p className="text-[10px] text-red-500 mt-2">Minimum deposit is 2 {token}</p>
                )}
                {insufficientBalance && (
                  <p className="text-[10px] text-red-500 mt-2">
                    Insufficient {token} balance (have {onChainBalance.toFixed(2)}, need {parsedAmount.toFixed(2)})
                  </p>
                )}
              </div>

              {/* Wallet info */}
              <div>
                <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
                  Your {chain === "ethereum" ? "Ethereum" : chain === "solana" ? "Solana" : "Tron"} wallet
                </span>
                {walletsLoading ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-accent/20 px-3.5 py-3">
                    <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Loading wallet…</span>
                  </div>
                ) : fromAddress ? (
                  <div className="flex items-center justify-between rounded-xl border border-border/30 bg-accent/20 px-3.5 py-3">
                    <code className="text-[11px] text-foreground/80 font-mono truncate mr-3">{fromAddress}</code>
                    <button
                      onClick={() => handleCopy(fromAddress)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-card transition-colors"
                    >
                      <HugeiconsIcon
                        icon={copied ? Tick02Icon : Copy01Icon}
                        className={`h-3 w-3 ${copied ? "text-emerald-500" : "text-muted-foreground"}`}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
                    <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-[11px] text-red-500">No wallet found</span>
                  </div>
                )}
                {!balancesLoading && onChainBalance > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
                    Balance: {onChainBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {token}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
                  <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-[11px] text-red-500">{error}</p>
                </div>
              )}

              <button
                onClick={isTerminal ? handleNewDeposit : handleInitiate}
                disabled={loading || (!isTerminal && (parsedAmount < 2 || !fromAddress || insufficientBalance))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                {loading ? "Processing…" : isTerminal ? (isSuccess ? "New Deposit" : "Try Again") : `Deposit ${token}`}
              </button>
            </div>
          )}

          {/* ═══ ACTIVE DEPOSIT — Auto-send + polling ═══ */}
          {isActive && deposit && (
            <ActiveDepositView
              deposit={deposit}
              phase={phase}
              statusCfg={statusCfg}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Active deposit progress view ─────────────────────────────────────────

function ActiveDepositView({
  deposit,
  phase,
  statusCfg,
}: {
  deposit: SpotV2DepositInfo
  phase: DepositPhase
  statusCfg: { label: string; color: string; spinning?: boolean } | null
}) {
  const PHASE_STEPS = [
    { key: "initiating", label: "Creating deposit" },
    { key: "sending", label: "Sending from wallet" },
    { key: "polling", label: "Confirming on-chain" },
  ]

  const activeIdx = PHASE_STEPS.findIndex((s) => s.key === phase)

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-accent/20 p-3.5">
        {statusCfg?.spinning || phase === "sending" ? (
          <HugeiconsIcon icon={Loading03Icon} className={`h-4 w-4 animate-spin ${statusCfg?.color || "text-blue-500"}`} />
        ) : (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className={`h-4 w-4 ${statusCfg?.color}`} />
        )}
        <p className={`text-xs font-medium ${statusCfg?.color || "text-blue-500"}`}>
          {phase === "sending" ? "Sending from your wallet…" : statusCfg?.label}
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1">
        {PHASE_STEPS.map((step, i) => {
          const isDone = i < activeIdx || (phase === "polling" && deposit.depositTxHash)
          const isActive = i === activeIdx
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1 w-full rounded-full transition-colors ${
                  isDone
                    ? "bg-emerald-500"
                    : isActive
                    ? "bg-primary animate-pulse"
                    : "bg-border/30"
                }`}
              />
              <span className={`text-[10px] ${
                isDone ? "text-emerald-500" : isActive ? "text-primary" : "text-muted-foreground/50"
              }`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Deposit info */}
      <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Amount</span>
          <span className="text-sm font-semibold tabular-nums">
            {deposit.depositAmount} <span className="text-xs text-muted-foreground">{deposit.depositToken}</span>
          </span>
        </div>
        <div className="h-px bg-border/20" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Network</span>
          <div className="flex items-center gap-1.5">
            <img
              src={CHAINS.find((c) => c.id === deposit.depositChain)?.icon}
              alt=""
              className="h-3.5 w-3.5 rounded-full"
            />
            <span className="text-xs font-medium capitalize">{deposit.depositChain}</span>
          </div>
        </div>
      </div>

      {/* TX hash once sent */}
      {deposit.depositTxHash && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5">
          <span className="text-[11px] text-muted-foreground">TX Hash</span>
          <span className="text-[11px] text-emerald-600 font-mono">
            {deposit.depositTxHash.slice(0, 12)}…{deposit.depositTxHash.slice(-4)}
          </span>
        </div>
      )}

      {/* Waiting indicator */}
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/20 bg-accent/10 py-3">
        <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          {phase === "sending"
            ? "Signing and broadcasting transaction…"
            : "Waiting for on-chain confirmation…"}
        </span>
      </div>
    </div>
  )
}
