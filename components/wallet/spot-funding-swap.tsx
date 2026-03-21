"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Alert02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { useSpotV2Deposit } from "@/hooks/useSpotV2Deposit"
import { useWallet } from "@/components/wallet-provider"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { getSpotV2Balance } from "@/lib/spotv2/ledger-actions"
import { useAuth } from "@/components/auth-provider"

// ── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; spinning: boolean; color: string }> = {
  initiating:  { label: "Initializing...",                   spinning: true,  color: "text-muted-foreground" },
  sending:     { label: "Sending to treasury...",            spinning: true,  color: "text-amber-500" },
  polling:     { label: "Waiting for confirmation...",       spinning: true,  color: "text-amber-500" },
  pending:     { label: "Deposit pending...",                spinning: true,  color: "text-amber-500" },
  detected:    { label: "Deposit detected!",                 spinning: false, color: "text-emerald-500" },
  matched:     { label: "Deposit matched!",                  spinning: false, color: "text-emerald-500" },
  verified:    { label: "Verifying deposit...",              spinning: true,  color: "text-amber-500" },
  processing:  { label: "Processing...",                     spinning: true,  color: "text-amber-500" },
  completed:   { label: "Funds ready to trade!",             spinning: false, color: "text-emerald-500" },
  disbursed:   { label: "Funds ready to trade!",             spinning: false, color: "text-emerald-500" },
  failed:      { label: "Transfer failed",                   spinning: false, color: "text-red-500" },
  expired:     { label: "Transfer expired",                  spinning: false, color: "text-red-500" },
  rejected:    { label: "Transfer rejected",                 spinning: false, color: "text-red-500" },
}

const STAGES = [
  "sending", "pending", "detected", "verified", "completed",
]

function getStageIndex(status: string): number {
  if (status === "disbursed") return STAGES.length - 1
  const idx = STAGES.indexOf(status)
  return idx === -1 ? 0 : idx
}

// ── Chain images ─────────────────────────────────────────────────────────

const CHAIN_IMG: Record<string, string> = {
  ethereum: "https://tse3.mm.bing.net/th/id/OIP.Rbhwx2hMogpqEO08SXJShwHaLo?rs=1&pid=ImgDetMain&o=7&rm=3",
  solana:   "https://th.bing.com/th/id/OIP.hnScG3zE2G41YaH7Iir9zAHaHa?w=153&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3",
  tron:     "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",
}

// ── Component ────────────────────────────────────────────────────────────

export function SpotFundingSwap({ onTransferComplete }: { onTransferComplete?: () => void }) {
  const { deposit, phase, loading, error, initiate, reset } = useSpotV2Deposit()
  const { addresses, isLoading: walletsLoading } = useWallet()
  const { balances: onChainBalances, isLoading: balancesLoading } = useWalletBalances()
  const { isSignedIn } = useAuth()

  const [chain, setChain] = React.useState<"ethereum" | "solana" | "tron">("tron")
  const [amount, setAmount] = React.useState("")
  const [spotBalance, setSpotBalance] = React.useState<number>(0)
  const [spotBalanceLoading, setSpotBalanceLoading] = React.useState(false)

  // Derive wallet address from the revamp's wallet provider
  const fromAddress = React.useMemo(() => {
    if (!addresses) return ""
    if (chain === "ethereum") return addresses.ethereum
    if (chain === "solana") return addresses.solana
    return addresses.tron
  }, [chain, addresses])

  // USDT balance from on-chain balances hook
  const usdtBalance = React.useMemo(() => {
    const chainKey = chain === "tron" ? "tron" : chain === "ethereum" ? "ethereum" : "solana"
    const match = onChainBalances.find(
      (b) => b.symbol === "USDT" && b.chain === chainKey,
    )
    return match?.balance ?? 0
  }, [onChainBalances, chain])

  // Fetch SpotV2 ledger USDC balance
  const fetchSpotBalance = React.useCallback(async () => {
    if (!isSignedIn) return
    try {
      setSpotBalanceLoading(true)
      const balances = await getSpotV2Balance()
      const usdc = balances.find((b) => b.token === "USDC")
      setSpotBalance(usdc?.available ?? 0)
    } catch {
      /* silently fail */
    } finally {
      setSpotBalanceLoading(false)
    }
  }, [isSignedIn])

  React.useEffect(() => { fetchSpotBalance() }, [fetchSpotBalance])

  // On completion → refresh balance + notify parent
  const depositStatus = deposit?.status
  React.useEffect(() => {
    if (depositStatus === "completed" || depositStatus === "disbursed") {
      fetchSpotBalance()
      onTransferComplete?.()
    }
  }, [depositStatus, fetchSpotBalance, onTransferComplete])

  const handleInitiate = async () => {
    if (!amount || parseFloat(amount) < 5 || !fromAddress) return
    await initiate({
      depositChain: chain,
      depositAmount: parseFloat(amount),
      depositFromAddress: fromAddress,
      depositToken: "USDT",
    })
  }

  const handleNewTransfer = () => {
    reset()
    setAmount("")
    fetchSpotBalance()
  }

  const handleMax = () => {
    if (usdtBalance > 0) setAmount(String(usdtBalance))
  }

  const terminalStatuses = ["completed", "disbursed", "failed", "expired", "rejected"]
  const isActive = deposit && phase !== "idle" && !terminalStatuses.includes(deposit.status)
  const isTerminal = deposit && terminalStatuses.includes(deposit.status)
  const showForm = !deposit || isTerminal
  const statusCfg = deposit
    ? STATUS_CONFIG[phase !== "idle" ? phase : deposit.status] || STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending
    : null

  return (
    <div className="rounded-2xl bg-card border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Transfer</h3>
        </div>
        {isActive && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] text-amber-500">Processing</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* ═══ FORM VIEW ═══ */}
        {showForm && (
          <>
            {/* Terminal status (if coming from completed/failed) */}
            {isTerminal && statusCfg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                deposit?.status === "completed" ? "bg-emerald-500/10" : "bg-red-500/10"
              }`}>
                <HugeiconsIcon
                  icon={deposit?.status === "completed" ? CheckmarkCircle02Icon : Cancel01Icon}
                  className={`h-4 w-4 ${statusCfg.color}`}
                />
                <span className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</span>
              </div>
            )}

            {/* ── FROM section ── */}
            <div className="rounded-xl bg-accent/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">From</span>
                <span className="text-[10px] text-muted-foreground">
                  Balance:{" "}
                  {balancesLoading ? (
                    <HugeiconsIcon icon={Loading03Icon} className="h-2.5 w-2.5 animate-spin inline" />
                  ) : (
                    <span className="text-foreground font-medium">
                      {usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                    </span>
                  )}
                </span>
              </div>

              {/* Chain toggle */}
              <div className="flex gap-2">
                {(["tron", "ethereum", "solana"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChain(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      chain === c
                        ? "bg-primary/10 border border-primary/40 text-primary"
                        : "bg-accent/50 border border-border/30 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <img src={CHAIN_IMG[c]} alt={c} className="h-3.5 w-3.5 rounded-full" />
                    {c === "ethereum" ? "Ethereum" : c === "solana" ? "Solana" : "Tron"}
                  </button>
                ))}
              </div>

              {/* Amount input */}
              <div className="flex items-center gap-2 rounded-lg bg-card border border-border/60 px-3 py-2.5 focus-within:border-primary transition-colors">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min={5}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleMax}
                    disabled={usdtBalance <= 0}
                    className="text-[10px] font-medium text-primary hover:text-primary/80 disabled:text-muted-foreground/40 px-1.5 py-0.5 rounded bg-primary/10 disabled:bg-transparent"
                  >
                    MAX
                  </button>
                  <span className="text-xs font-medium">USDT</span>
                </div>
              </div>

              {amount && parseFloat(amount) < 5 && (
                <p className="text-[10px] text-red-500">Minimum transfer is 5 USDT</p>
              )}
            </div>

            {/* ── Swap arrow ── */}
            <div className="flex justify-center -my-1">
              <div className="w-8 h-8 rounded-full bg-accent border-4 border-card flex items-center justify-center">
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>

            {/* ── TO section ── */}
            <div className="rounded-xl bg-accent/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">To</span>
                <span className="text-[10px] text-muted-foreground">
                  Spot Balance:{" "}
                  {spotBalanceLoading ? (
                    <HugeiconsIcon icon={Loading03Icon} className="h-2.5 w-2.5 animate-spin inline" />
                  ) : (
                    <span className="text-foreground font-medium">
                      {spotBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-card border border-border/60 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {amount && parseFloat(amount) >= 5
                    ? `≈ ${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "0.00"}
                </span>
                <span className="text-xs font-medium shrink-0">USDC</span>
              </div>

              <p className="text-[10px] text-muted-foreground">Spot Wallet (USDC)</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-[10px] text-red-500">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={isTerminal ? handleNewTransfer : handleInitiate}
              disabled={loading || (!isTerminal && (!amount || parseFloat(amount) < 5 || !fromAddress))}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground text-primary-foreground font-semibold text-sm rounded-xl transition-colors"
            >
              {loading ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin mx-auto" />
              ) : isTerminal ? (
                "New Transfer"
              ) : (
                "Transfer to Spot"
              )}
            </button>
          </>
        )}

        {/* ═══ ACTIVE TRANSFER: Progress Tracker ═══ */}
        {isActive && deposit && statusCfg && (
          <>
            {/* Transfer summary */}
            <div className="rounded-xl bg-accent/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Sending</span>
                <span className="text-xs font-medium">
                  {deposit.depositAmount} {deposit.depositToken || "USDT"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Network</span>
                <span className="text-xs text-primary font-medium capitalize">{deposit.depositChain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Destination</span>
                <span className="text-xs font-medium">Spot Wallet (USDC)</span>
              </div>
            </div>

            {/* Status label */}
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={statusCfg.spinning ? Loading03Icon : CheckmarkCircle02Icon}
                className={`h-4 w-4 ${statusCfg.color} ${statusCfg.spinning ? "animate-spin" : ""}`}
              />
              <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
            </div>

            {/* Progress bar */}
            <div className="flex gap-0.5">
              {STAGES.map((stage, i) => {
                const currentIdx = getStageIndex(deposit.status)
                return (
                  <div
                    key={stage}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= currentIdx ? "bg-emerald-500" : "bg-accent"
                    }`}
                  />
                )
              })}
            </div>

            {/* Step labels */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
              <div>Send USDT</div>
              <div>Confirm</div>
              <div>Ready to Trade</div>
            </div>

            {/* TX hash */}
            {deposit.depositTxHash && (
              <div className="text-[10px] text-muted-foreground/50">
                <p>TX: <span className="font-mono text-muted-foreground">{deposit.depositTxHash.slice(0, 12)}...</span></p>
              </div>
            )}

            {/* Cancel for stuck early-stage deposits */}
            {phase === "initiating" && (
              <button
                onClick={handleNewTransfer}
                className="w-full py-2 bg-accent hover:bg-accent/80 text-red-500 text-xs font-medium rounded-lg transition-colors border border-border/30"
              >
                Cancel Transfer
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
