"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  ArrowUpRight01Icon,
  ArrowLeft02Icon,
} from "@hugeicons/core-free-icons"

// ── Types ────────────────────────────────────────────────────────────────

export interface SendableAsset {
  symbol: string
  name: string
  balance: number
  chain: "solana" | "ethereum" | "arbitrum" | "sui" | "ton" | "tron"
  icon: string
  contractAddress?: string
  decimals?: number
}

interface SendModalProps {
  open: boolean
  onClose: () => void
  asset?: SendableAsset
}

type Step = "details" | "confirm" | "sending" | "success" | "error"

// ── Chain explorer URLs ──────────────────────────────────────────────────

const EXPLORER: Record<string, (hash: string) => string> = {
  solana: (h) => `https://solscan.io/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  arbitrum: (h) => `https://arbiscan.io/tx/${h}`,
  sui: (h) => `https://suiscan.xyz/mainnet/tx/${h}`,
  ton: (h) => `https://tonscan.org/tx/${h}`,
  tron: (h) => `https://tronscan.org/#/transaction/${h}`,
}

const CHAIN_LABELS: Record<string, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

// ── Gas buffers for native tokens ────────────────────────────────────────

const GAS_BUFFER: Record<string, number> = {
  ethereum: 0.001,
  arbitrum: 0.0002,
  solana: 0.01,
  sui: 0.02,
  tron: 1,
  ton: 0.05,
}

// ── Error sanitizer ──────────────────────────────────────────────────────

function sanitizeError(msg: string): string {
  if (msg.includes("Balance of gas object") || msg.includes("insufficient funds") || msg.includes("Insufficient balance"))
    return "Insufficient balance to complete this transaction."
  if (msg.includes("Network request failed") || msg.includes("fetch"))
    return "Network error. Please check your connection and try again."
  if (msg.includes("invalid address") || msg.includes("Invalid address"))
    return "Invalid recipient address. Please verify and try again."
  if (msg.includes("gas") && (msg.includes("too low") || msg.includes("insufficient")))
    return "Insufficient funds for transaction fees."
  if (msg.includes("timeout") || msg.includes("timed out"))
    return "Transaction timed out. Please try again."
  if (msg.includes("rejected") || msg.includes("denied"))
    return "Transaction was rejected."
  if (msg.includes("Error checking transaction input objects"))
    return "Transaction validation failed. Check your balance."
  return msg.replace(/^Error:\s*/, "").trim()
}

// ── Component ────────────────────────────────────────────────────────────

export function SendModal({ open, onClose, asset }: SendModalProps) {
  const [step, setStep] = React.useState<Step>("details")
  const [recipient, setRecipient] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [error, setError] = React.useState("")
  const [txHash, setTxHash] = React.useState("")
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep("details")
      setRecipient("")
      setAmount("")
      setError("")
      setTxHash("")
    }
  }, [open])

  // Close on outside click
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  if (!open || !asset) return null

  const amountNum = parseFloat(amount) || 0
  const isValidAmount = amountNum > 0 && amountNum <= asset.balance
  const isValidRecipient = recipient.trim().length > 10

  function handleMax() {
    if (!asset) return
    if (!asset.contractAddress) {
      const buffer = GAS_BUFFER[asset.chain] ?? 0.01
      setAmount(Math.max(0, asset.balance - buffer).toString())
    } else {
      setAmount(asset.balance.toString())
    }
  }

  function handleContinue() {
    setError("")
    if (!asset) return
    if (!isValidRecipient) { setError("Enter a valid recipient address"); return }
    if (!isValidAmount) { setError("Enter a valid amount within your balance"); return }
    // Pre-flight gas check for native token sends
    if (!asset.contractAddress) {
      const buffer = GAS_BUFFER[asset.chain] ?? 0.01
      if (amountNum + buffer > asset.balance) {
        setError(`Insufficient balance for gas fees. Leave at least ${buffer} ${asset.symbol} for transaction fees.`)
        return
      }
    }
    setStep("confirm")
  }

  async function handleSend() {
    if (!asset) return
    setStep("sending")
    setError("")

    try {
      let hash = ""

      // Determine which endpoint to call
      if (asset.contractAddress && asset.chain === "solana") {
        // SPL token via solana send-token route
        const res = await fetch("/api/privy/wallet/solana/send-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: recipient.trim(),
            amount: amountNum,
            mint: asset.contractAddress,
            decimals: asset.decimals ?? 9,
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || "SPL transfer failed")
        hash = data.signature || data.transactionHash || data.hash || ""
      } else {
        // Native send or ERC-20 via per-chain route
        const chainRoute = asset.chain === "arbitrum" ? "ethereum" : asset.chain
        const res = await fetch(`/api/privy/wallet/${chainRoute}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: recipient.trim(),
            amount: amountNum.toString(),
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || "Transaction failed")
        hash = data.transactionHash || data.signature || data.hash || ""
      }

      setTxHash(hash)
      setStep("success")

      // Record transfer (fire-and-forget)
      fetch("/api/wallet-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "send",
          direction: "outgoing",
          chain: asset.chain,
          token: asset.symbol,
          amount: amountNum,
          toAddress: recipient.trim(),
          txHash: hash,
          status: "confirmed",
        }),
      }).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setError(sanitizeError(msg))
      setStep("error")
    }
  }

  const explorerUrl = txHash && asset ? EXPLORER[asset.chain]?.(txHash) ?? "" : ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={panelRef} className="w-full max-w-md rounded-2xl bg-popover shadow-2xl mx-4 overflow-hidden">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <div className="flex items-center gap-3">
            {step === "confirm" && (
              <button onClick={() => setStep("details")} className="rounded-lg p-1 text-muted-foreground hover:bg-accent transition-colors">
                <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
              </button>
            )}
            <img src={asset.icon} alt={asset.symbol} className="size-7 rounded-full" />
            <div>
              <h3 className="text-sm font-semibold">
                Send {asset.symbol}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {step === "details" && "Enter recipient and amount"}
                {step === "confirm" && "Review your transaction"}
                {step === "sending" && "Processing…"}
                {step === "success" && "Sent successfully"}
                {step === "error" && "Transaction failed"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className="p-5">

          {/* STEP: Details */}
          {step === "details" && (
            <div className="space-y-4">
              {/* Balance */}
              <div className="flex items-center justify-between rounded-xl bg-accent/30 px-3.5 py-2.5">
                <span className="text-[11px] text-muted-foreground">Available</span>
                <span className="text-xs font-semibold tabular-nums">
                  {asset.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {asset.symbol}
                </span>
              </div>

              {/* Recipient */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Recipient Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={`Enter ${CHAIN_LABELS[asset.chain] ?? asset.chain} address`}
                  className="w-full rounded-xl bg-accent/40 px-3.5 py-2.5 text-xs font-mono outline-none placeholder:text-muted-foreground/40 focus:bg-accent transition-colors"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Amount</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value)
                    }}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-accent/40 px-3.5 py-2.5 pr-16 text-xs font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40 focus:bg-accent transition-colors"
                  />
                  <button
                    onClick={handleMax}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                {/* Percentage shortcuts */}
                <div className="mt-2 flex gap-2">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (!asset) return
                        const base = !asset.contractAddress ? Math.max(0, asset.balance - (GAS_BUFFER[asset.chain] ?? 0.01)) : asset.balance
                        setAmount(String(+(base * pct / 100).toFixed(6)))
                      }}
                      className="flex-1 rounded-lg bg-accent/50 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={handleMax}
                    className="flex-1 rounded-lg bg-accent/50 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/10 px-3 py-2.5">
                  <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <p className="text-[11px] text-destructive">{error}</p>
                </div>
              )}

              {/* Continue */}
              <button
                onClick={handleContinue}
                disabled={!isValidRecipient || !isValidAmount}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-accent/30 divide-y divide-border/20">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[11px] text-muted-foreground">Sending</span>
                  <span className="text-xs font-semibold tabular-nums">
                    {amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {asset.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[11px] text-muted-foreground">Network</span>
                  <div className="flex items-center gap-1.5">
                    <img src={asset.icon} alt="" className="size-3.5 rounded-full" />
                    <span className="text-xs font-medium">{CHAIN_LABELS[asset.chain] ?? asset.chain}</span>
                  </div>
                </div>
                <div className="flex items-start justify-between px-3.5 py-2.5">
                  <span className="text-[11px] text-muted-foreground">To</span>
                  <span className="text-[11px] font-mono text-right max-w-[220px] break-all">{recipient}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("details")}
                  className="flex-1 rounded-xl border border-border/40 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Send Now
                </button>
              </div>
            </div>
          )}

          {/* STEP: Sending */}
          {step === "sending" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                <HugeiconsIcon icon={Loading03Icon} className="h-6 w-6 text-primary animate-spin" />
              </div>
              <h4 className="text-sm font-semibold mb-1">Processing Transaction</h4>
              <p className="text-[11px] text-muted-foreground">Please wait while your transaction is sent…</p>
            </div>
          )}

          {/* STEP: Success */}
          {step === "success" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-6 w-6 text-emerald-500" />
              </div>
              <h4 className="text-sm font-semibold mb-1">Transaction Sent!</h4>
              <p className="text-[11px] text-muted-foreground mb-4">
                {amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.symbol} sent successfully.
              </p>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  View on Explorer
                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                </a>
              )}
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          )}

          {/* STEP: Error */}
          {step === "error" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
                <HugeiconsIcon icon={Alert02Icon} className="h-6 w-6 text-destructive" />
              </div>
              <h4 className="text-sm font-semibold mb-1">Transaction Failed</h4>
              <p className="text-[11px] text-destructive mb-4">{error || "Something went wrong"}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("details")}
                  className="flex-1 rounded-xl border border-border/40 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
