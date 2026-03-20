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
  InformationCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { useSpotDeposit, type DepositInfo } from "@/hooks/useSpotDeposit"
import { useWallet } from "@/components/wallet-provider"
import { useWalletBalances } from "@/hooks/useWalletBalances"

interface SpotDepositModalProps {
  isOpen: boolean
  onClose: () => void
  onDepositComplete?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; spinning?: boolean }> = {
  initiated: { label: "Starting deposit…", color: "text-muted-foreground", spinning: true },
  sending_usdt: { label: "Sending your USDT…", color: "text-amber-500", spinning: true },
  awaiting_deposit: { label: "Confirming your payment…", color: "text-blue-500", spinning: true },
  deposit_detected: { label: "Payment received!", color: "text-emerald-500" },
  disbursing: { label: "Processing your deposit…", color: "text-orange-500", spinning: true },
  disbursed: { label: "Processing your deposit…", color: "text-orange-500", spinning: true },
  bridging: { label: "Almost ready…", color: "text-blue-500", spinning: true },
  transferring: { label: "Finishing up…", color: "text-blue-500", spinning: true },
  completed: { label: "Deposit complete — ready to trade!", color: "text-emerald-500" },
  failed: { label: "Deposit failed", color: "text-red-500" },
  expired: { label: "Deposit expired", color: "text-red-500" },
}

const STAGES = [
  "sending_usdt",
  "awaiting_deposit",
  "deposit_detected",
  "disbursing",
  "disbursed",
  "bridging",
  "transferring",
  "completed",
]

function getStageIndex(status: string): number {
  const idx = STAGES.indexOf(status)
  return idx === -1 ? 0 : idx
}

const CHAINS = [
  { id: "ethereum" as const, label: "Ethereum", tag: "ERC-20", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "solana" as const, label: "Solana", tag: "SPL", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "tron" as const, label: "Tron", tag: "TRC-20", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

const STAGE_GROUPS = [
  { label: "Send USDT", stages: ["sending_usdt", "awaiting_deposit"] },
  { label: "Processing", stages: ["deposit_detected", "disbursing", "disbursed", "bridging"] },
  { label: "Ready", stages: ["transferring", "completed"] },
]

export function SpotDepositModal({ isOpen, onClose, onDepositComplete }: SpotDepositModalProps) {
  const { deposit, loading, error, initiate, resumePolling, reset, cancel } = useSpotDeposit()
  const { addresses, isLoading: walletsLoading } = useWallet()
  const { balances: onChainBalances, isLoading: balancesLoading } = useWalletBalances()

  const [chain, setChain] = React.useState<"ethereum" | "solana" | "tron">("ethereum")
  const [amount, setAmount] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const fromAddress = React.useMemo(() => {
    if (!addresses) return ""
    if (chain === "ethereum") return addresses.ethereum
    if (chain === "solana") return addresses.solana
    return addresses.tron
  }, [chain, addresses])

  // Compute USDT balances for all chains
  const ETH_USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  const solUsdtBalance = React.useMemo(() => {
    const t = onChainBalances.find(
      (b) => b.chain === "solana" && b.symbol === "USDT",
    )
    return t?.balance ?? 0
  }, [onChainBalances])
  const ethUsdtBalance = React.useMemo(() => {
    const t = onChainBalances.find(
      (b) =>
        b.chain === "ethereum" &&
        (b.contractAddress?.toLowerCase() === ETH_USDT.toLowerCase() ||
          b.symbol === "USDT"),
    )
    return t?.balance ?? 0
  }, [onChainBalances])
  const tronUsdtBalance = React.useMemo(() => {
    const t = onChainBalances.find(
      (b) => b.chain === "tron" && b.symbol === "USDT",
    )
    return t?.balance ?? 0
  }, [onChainBalances])

  // Active chain balance (used for max button & validation)
  const usdtBalance = chain === "solana" ? solUsdtBalance : chain === "tron" ? tronUsdtBalance : ethUsdtBalance

  React.useEffect(() => {
    if (isOpen) resumePolling()
  }, [isOpen, resumePolling])

  React.useEffect(() => {
    if (deposit?.status === "completed" && onDepositComplete) {
      onDepositComplete()
    }
  }, [deposit?.status, onDepositComplete])

  if (!isOpen) return null

  const parsedAmount = parseFloat(amount) || 0

  const handleInitiate = async () => {
    if (parsedAmount < 5) return
    if (!fromAddress) return
    await initiate({
      depositChain: chain,
      depositAmount: parsedAmount,
      depositFromAddress: fromAddress,
      depositToken: "USDT",
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

  const isActive = deposit && !["completed", "failed", "expired"].includes(deposit.status)
  const isTerminal = deposit && ["completed", "failed", "expired"].includes(deposit.status)
  const showForm = !deposit || isTerminal
  const statusCfg = deposit ? STATUS_CONFIG[deposit.status] || STATUS_CONFIG.initiated : null

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
              <h2 className="text-sm font-semibold text-foreground">Deposit to Spot</h2>
              <p className="text-[10px] text-muted-foreground">Fund your trading wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          {/* ═══ FORM ═══ */}
          {showForm && (
            <div className="space-y-4">
              {/* Terminal status banner */}
              {isTerminal && (
                <div className={`flex items-center gap-2.5 rounded-xl p-3 ${
                  deposit?.status === "completed"
                    ? "border border-emerald-500/20 bg-emerald-500/5"
                    : "border border-red-500/20 bg-red-500/5"
                }`}>
                  <HugeiconsIcon
                    icon={deposit?.status === "completed" ? CheckmarkCircle02Icon : Alert02Icon}
                    className={`h-4 w-4 shrink-0 ${statusCfg?.color}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${statusCfg?.color}`}>{statusCfg?.label}</p>
                    {deposit?.errorMessage && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{deposit.errorMessage}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Network selector */}
              <div>
                <span className="mb-2 block text-[11px] font-medium text-muted-foreground">Send USDT from</span>
                <div className="flex gap-2">
                  {CHAINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChain(c.id)}
                      className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                        chain === c.id
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/30 hover:border-border"
                      }`}
                    >
                      <img src={c.icon} alt={c.label} className="h-5 w-5 rounded-full" />
                      <div className="text-left">
                        <p className={`text-xs font-semibold ${chain === c.id ? "text-primary" : "text-foreground"}`}>{c.label}</p>
                        <p className="text-[10px] text-muted-foreground">{c.tag} USDT</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Amount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Min 5 USDT</span>
                    {usdtBalance > 0 && (
                      <button
                        onClick={() => setAmount(usdtBalance.toFixed(2))}
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
                    <img src="https://coin-images.coingecko.com/coins/images/325/small/Tether.png" alt="USDT" className="h-5 w-5 rounded-full" />
                    <span className="text-xs font-semibold">USDT</span>
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
                {parsedAmount > 0 && parsedAmount < 5 && (
                  <p className="text-[10px] text-red-500 mt-2">Minimum deposit is 5 USDT</p>
                )}
              </div>

              {/* Wallet address */}
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
                  <div className="rounded-xl border border-border/30 bg-accent/20 px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between">
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
                    {/* All chain balances */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/20">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <img src="https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="h-3 w-3 rounded-full" />
                        Ethereum USDT
                      </span>
                      <span className={`text-[11px] font-semibold tabular-nums ${chain === "ethereum" ? "text-foreground" : "text-muted-foreground"}`}>
                        {balancesLoading ? (
                          <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          `${ethUsdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <img src="https://coin-images.coingecko.com/coins/images/4128/small/solana.png" alt="SOL" className="h-3 w-3 rounded-full" />
                        Solana USDT
                      </span>
                      <span className={`text-[11px] font-semibold tabular-nums ${chain === "solana" ? "text-foreground" : "text-muted-foreground"}`}>
                        {balancesLoading ? (
                          <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          `${solUsdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <img src="https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" alt="TRX" className="h-3 w-3 rounded-full" />
                        Tron USDT
                      </span>
                      <span className={`text-[11px] font-semibold tabular-nums ${chain === "tron" ? "text-foreground" : "text-muted-foreground"}`}>
                        {balancesLoading ? (
                          <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          `${tronUsdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
                    <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-[11px] text-red-500">No {chain === "ethereum" ? "Ethereum" : chain === "solana" ? "Solana" : "Tron"} wallet found</span>
                  </div>
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
                disabled={loading || (!isTerminal && (parsedAmount < 5 || !fromAddress))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                {loading ? "Processing…" : isTerminal ? "New Deposit" : "Deposit USDT"}
              </button>
            </div>
          )}

          {/* ═══ ACTIVE DEPOSIT — Progress ═══ */}
          {isActive && deposit && (
            <div className="space-y-4">
              {/* Deposit info card */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Amount</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {deposit.depositAmount} <span className="text-xs text-muted-foreground">{deposit.depositToken || "USDT"}</span>
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
                {deposit.depositTxHash && (
                  <>
                    <div className="h-px bg-border/20" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">TX Hash</span>
                      <span className="text-[11px] text-muted-foreground/80 font-mono">{deposit.depositTxHash.slice(0, 12)}…{deposit.depositTxHash.slice(-4)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Status + progress */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center gap-2.5 mb-3.5">
                  {statusCfg?.spinning ? (
                    <HugeiconsIcon icon={Loading03Icon} className={`h-4 w-4 animate-spin ${statusCfg.color}`} />
                  ) : (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className={`h-4 w-4 ${statusCfg?.color}`} />
                  )}
                  <span className={`text-xs font-semibold ${statusCfg?.color}`}>{statusCfg?.label}</span>
                </div>

                {/* Segmented progress bar */}
                <div className="flex gap-1">
                  {STAGES.map((stage, i) => {
                    const currentIdx = getStageIndex(deposit.status)
                    const done = i <= currentIdx
                    const active = i === currentIdx
                    return (
                      <div
                        key={stage}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                          done ? "bg-emerald-500" : "bg-border/40"
                        } ${active ? "animate-pulse" : ""}`}
                      />
                    )
                  })}
                </div>

                {/* Stage labels */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {STAGE_GROUPS.map((g, gi) => {
                    const currentIdx = getStageIndex(deposit.status)
                    const groupFirstIdx = STAGES.indexOf(g.stages[0])
                    const groupLastIdx = STAGES.indexOf(g.stages[g.stages.length - 1])
                    const isGroupDone = currentIdx > groupLastIdx
                    const isGroupActive = currentIdx >= groupFirstIdx && currentIdx <= groupLastIdx
                    return (
                      <div key={gi} className="text-center">
                        <span className={`text-[10px] font-medium ${
                          isGroupDone ? "text-emerald-500" : isGroupActive ? "text-foreground" : "text-muted-foreground/50"
                        }`}>
                          {g.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* TX hashes */}
              {(deposit.disburseTxHash || deposit.bridgeTxHash) && (
                <div className="rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
                  {deposit.disburseTxHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Disburse TX</span>
                      <span className="text-[10px] text-muted-foreground/80 font-mono">{deposit.disburseTxHash.slice(0, 12)}…{deposit.disburseTxHash.slice(-4)}</span>
                    </div>
                  )}
                  {deposit.bridgeTxHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Bridge TX</span>
                      <span className="text-[10px] text-muted-foreground/80 font-mono">{deposit.bridgeTxHash.slice(0, 12)}…{deposit.bridgeTxHash.slice(-4)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border/30 bg-accent/20 px-3.5 py-2.5">
                <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-px" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Your deposit is being processed. This usually takes 1–3 minutes.
                </p>
              </div>

              {/* Cancel button for early stages */}
              {["initiated", "sending_usdt"].includes(deposit.status) && (
                <button
                  onClick={cancel}
                  className="flex w-full items-center justify-center rounded-xl border border-border/30 py-2.5 text-xs font-medium text-red-500 transition-colors hover:bg-accent/30"
                >
                  Cancel Deposit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
