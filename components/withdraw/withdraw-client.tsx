"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Loading03Icon,
  Wallet01Icon,
  Exchange01Icon,
  Clock01Icon,
  Copy01Icon,
  BankIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { useWallet } from "@/components/wallet-provider"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"

// ── Types ────────────────────────────────────────────────────────────────

interface Rate {
  marketRate: number
  buyRate: number
  sellRate: number
  symbol: string
}

interface BankDetail {
  bankName: string
  accountNumber: string
  accountName: string
  isDefault?: boolean
}

interface WithdrawalRecord {
  _id: string
  usdtAmount: number
  fiatAmount: number
  fiatCurrency: string
  exchangeRate: number
  chain: "solana" | "ethereum"
  userWalletAddress: string
  treasuryWalletAddress: string
  txHash?: string
  txVerified: boolean
  bankDetails: BankDetail
  status: string
  payoutReference?: string
  createdAt: string
  completedAt?: string
}

const CURRENCY_SYM: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£" }

// ── Onboarding ───────────────────────────────────────────────────────────

const WITHDRAW_ONBOARDING: OnboardingStep[] = [
  {
    target: '[data-onboarding="withdraw-network"]',
    title: "Choose your network",
    description: "Select the blockchain you'll be sending USDT from. Make sure it matches your wallet.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="withdraw-amount"]',
    title: "Enter withdrawal amount",
    description: "Type how much USDT you want to sell. You'll receive the NGN equivalent in your bank.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="withdraw-bank"]',
    title: "Bank account",
    description: "Choose a saved bank account or add a new one. This is where your NGN payout will be sent.",
    placement: "top",
  },
  {
    target: '[data-onboarding="withdraw-cta"]',
    title: "Start withdrawal",
    description: "Click to get a treasury address. Send USDT to it, paste the tx hash, and NGN arrives in your bank!",
    placement: "top",
  },
]

// ── Status label ─────────────────────────────────────────────────────────

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: "text-amber-500", label: "Awaiting USDT" },
    usdt_sent: { color: "text-blue-500", label: "USDT Sent" },
    tx_verified: { color: "text-emerald-500", label: "TX Verified" },
    processing: { color: "text-orange-500", label: "Processing" },
    ngn_sent: { color: "text-emerald-500", label: "NGN Sent" },
    completed: { color: "text-emerald-500", label: "Completed" },
    failed: { color: "text-red-500", label: "Failed" },
    cancelled: { color: "text-muted-foreground", label: "Cancelled" },
  }
  const c = map[status] || map.pending
  return <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
}

// ── Side panels ──────────────────────────────────────────────────────────

const STEPS = [
  { title: "Enter details", desc: "Amount, chain & bank" },
  { title: "Send USDT", desc: "To the treasury address" },
  { title: "Paste tx hash", desc: "Confirm the transaction" },
  { title: "Receive NGN", desc: "Payout to your bank" },
]

function HowItWorks() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">How it works</h3>
      </div>
      <div className="px-4 py-4">
        <div className="relative pl-5">
          <div className="absolute left-1.75 top-1 bottom-1 w-px bg-border/50" />
          <div className="space-y-4">
            {STEPS.map((item, i) => (
              <div key={i} className="relative flex items-start gap-3">
                <div className="absolute -left-5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentWithdrawals() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">Recent Withdrawals</h3>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Exchange01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No withdrawal history yet</p>
        <p className="text-[10px] text-muted-foreground/60">Completed withdrawals will appear here</p>
      </div>
    </div>
  )
}

// ── Chains ───────────────────────────────────────────────────────────────

const CHAINS = [
  { id: "solana" as const, label: "Solana", tag: "SPL", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "ethereum" as const, label: "Ethereum", tag: "ERC-20", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
]

// ── Main Component ───────────────────────────────────────────────────────

export function WithdrawClient() {
  const { walletsGenerated } = useWallet()
  const { profile } = useProfile()

  // Form state
  const [chain, setChain] = React.useState<"solana" | "ethereum">("solana")
  const [usdtAmount, setUsdtAmount] = React.useState("")
  const [rates, setRates] = React.useState<Record<string, Rate>>({})
  const [ratesLoading, setRatesLoading] = React.useState(true)

  // Bank state
  const [selectedBank, setSelectedBank] = React.useState<BankDetail | null>(null)
  const [showAddBank, setShowAddBank] = React.useState(false)
  const [newBank, setNewBank] = React.useState<BankDetail>({ bankName: "", accountNumber: "", accountName: "" })

  // Withdrawal state
  const [activeWithdrawal, setActiveWithdrawal] = React.useState<WithdrawalRecord | null>(null)
  const [txHash, setTxHash] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const savedBanks: BankDetail[] = profile?.savedBankDetails || []

  // Auto-select default bank
  React.useEffect(() => {
    if (savedBanks.length > 0 && !selectedBank) {
      setSelectedBank(savedBanks.find((b) => b.isDefault) || savedBanks[0])
    }
  }, [savedBanks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rates ────────────────────────────────────────────────────────────

  const fetchRates = React.useCallback(async () => {
    try {
      const r = await fetch("/api/p2p/rates")
      const d = await r.json()
      if (d.rates) setRates(d.rates)
    } catch { /* ignore */ } finally { setRatesLoading(false) }
  }, [])

  React.useEffect(() => {
    fetchRates()
    const id = setInterval(fetchRates, 120_000)
    return () => clearInterval(id)
  }, [fetchRates])

  // ── Polling ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (activeWithdrawal && ["usdt_sent", "tx_verified", "processing", "ngn_sent"].includes(activeWithdrawal.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/withdraw/status/${activeWithdrawal._id}`)
          const d = await r.json()
          if (d.success && d.withdrawal) {
            setActiveWithdrawal(d.withdrawal)
            if (["completed", "failed", "cancelled"].includes(d.withdrawal.status)) {
              if (pollRef.current) clearInterval(pollRef.current)
            }
          }
        } catch { /* continue */ }
      }, 5000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [activeWithdrawal?.status, activeWithdrawal?._id])

  // ── Derived ──────────────────────────────────────────────────────────

  const ngnRate = rates["NGN"]
  const sellRate = ngnRate?.sellRate
  const amount = parseFloat(usdtAmount) || 0
  const fiat = amount * (sellRate || 0)
  const isValid = amount >= 1 && amount <= 5000
  const hasBankSelected = !!selectedBank?.bankName && !!selectedBank?.accountNumber && !!selectedBank?.accountName

  // ── Actions ──────────────────────────────────────────────────────────

  async function initiate() {
    if (!isValid || !sellRate || !hasBankSelected) return
    setError(""); setLoading(true)
    try {
      const r = await fetch("/api/withdraw/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdtAmount: amount, chain, bankDetails: selectedBank }),
      })
      const d = await r.json()
      if (!d.success) { setError(d.error || d.message || "Failed to create withdrawal."); return }

      // Fetch full record via status endpoint
      const sr = await fetch(`/api/withdraw/status/${d.withdrawal.id}`)
      const sd = await sr.json()
      if (sd.success && sd.withdrawal) {
        setActiveWithdrawal(sd.withdrawal)
      } else {
        // Fallback: construct from initiate response
        setActiveWithdrawal({
          _id: d.withdrawal.id,
          usdtAmount: d.withdrawal.usdtAmount,
          fiatAmount: d.withdrawal.fiatAmount,
          fiatCurrency: "NGN",
          exchangeRate: d.withdrawal.exchangeRate,
          chain: d.withdrawal.chain,
          userWalletAddress: "",
          treasuryWalletAddress: d.withdrawal.treasuryWalletAddress,
          txVerified: false,
          bankDetails: selectedBank!,
          status: d.withdrawal.status,
          createdAt: new Date().toISOString(),
        })
      }
    } catch { setError("Something went wrong.") }
    finally { setLoading(false) }
  }

  async function confirmTx() {
    if (!activeWithdrawal || !txHash.trim()) return
    setError(""); setLoading(true)
    try {
      const r = await fetch("/api/withdraw/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: activeWithdrawal._id, txHash: txHash.trim() }),
      })
      const d = await r.json()
      if (!d.success) { setError(d.error || "Failed to confirm."); return }
      setActiveWithdrawal((prev) => prev ? { ...prev, status: "usdt_sent", txHash: txHash.trim() } : null)
      setTxHash("")
    } catch { setError("Failed to confirm.") }
    finally { setLoading(false) }
  }

  async function cancelWithdrawal() {
    if (!activeWithdrawal) return
    setLoading(true)
    try {
      const r = await fetch(`/api/withdraw/status/${activeWithdrawal._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })
      const d = await r.json()
      if (d.success) reset()
    } catch { setError("Failed to cancel.") }
    finally { setLoading(false) }
  }

  async function copyAddress(addr: string) {
    await navigator.clipboard.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddBank() {
    if (!newBank.bankName || !newBank.accountNumber || !newBank.accountName) return
    setSelectedBank({ ...newBank })
    setShowAddBank(false)
    setNewBank({ bankName: "", accountNumber: "", accountName: "" })
  }

  function reset() { setActiveWithdrawal(null); setError(""); setTxHash("") }

  // ── Wallet guard ─────────────────────────────────────────────────────

  if (!walletsGenerated) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium">Wallet setup required</p>
        <p className="text-xs text-muted-foreground">Set up your wallets to start withdrawing.</p>
        <a href="/assets" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          Go to Assets <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
        </a>
      </div>
    )
  }

  // ── Processing status progress ───────────────────────────────────────

  const PROGRESS_STEPS = [
    { key: "usdt_sent", label: "USDT Received" },
    { key: "tx_verified", label: "TX Verified" },
    { key: "processing", label: "Processing" },
    { key: "ngn_sent", label: "NGN Sent" },
  ]

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <OnboardingFlow
        steps={WITHDRAW_ONBOARDING}
        storageKey="onboarding-withdraw"
        completed={profile?.onboardingCompleted?.includes("onboarding-withdraw")}
        onComplete={() => markOnboardingComplete("onboarding-withdraw")}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Withdraw</h1>
          <p className="text-xs text-muted-foreground">Sell USDT and receive NGN in your bank</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {CHAINS.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-accent/30 px-2.5 py-1">
              <img src={c.icon} alt={c.label} className="h-3.5 w-3.5 rounded-full" />
              <span className="text-[10px] font-medium">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* LEFT — Main card */}
        <div>
          {/* ═══ Input form ═══ */}
          {!activeWithdrawal && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Sell USDT</h2>
                </div>
                {ngnRate && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    1 USDT = {ngnRate.symbol}{ngnRate.sellRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="p-4">
                {ratesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Network */}
                    <div data-onboarding="withdraw-network" className="mb-4">
                      <span className="mb-2 block text-[11px] font-medium text-muted-foreground">Send from</span>
                      <div className="flex gap-2">
                        {CHAINS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setChain(c.id)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-colors ${
                              chain === c.id ? "border-primary/50 bg-primary/5" : "border-border/30 hover:border-border"
                            }`}
                          >
                            <img src={c.icon} alt={c.label} className="h-5 w-5 rounded-full" />
                            <div className="text-left">
                              <p className={`text-xs font-semibold ${chain === c.id ? "text-primary" : ""}`}>{c.label}</p>
                              <p className="text-[10px] text-muted-foreground">{c.tag} USDT</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* You sell */}
                    <div data-onboarding="withdraw-amount" className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-medium text-muted-foreground">You sell</span>
                        <span className="text-[11px] text-muted-foreground">Min 1 · Max 5,000</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={usdtAmount}
                          onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setUsdtAmount(e.target.value) }}
                          placeholder="0.00"
                          className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
                        />
                        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                          <img src="https://coin-images.coingecko.com/coins/images/325/small/Tether.png" alt="USDT" className="h-5 w-5 rounded-full" />
                          <span className="text-xs font-semibold">USDT</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
                        <div className="flex gap-1.5">
                          {[10, 50, 100, 500].map((v) => (
                            <button key={v} onClick={() => setUsdtAmount(v.toString())} className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              {v}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setChain(chain === "solana" ? "ethereum" : "solana")}
                          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <img src={CHAINS.find((c) => c.id === chain)!.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                          {CHAINS.find((c) => c.id === chain)!.label}
                        </button>
                      </div>
                    </div>

                    {/* You receive */}
                    <div className="mt-3 rounded-xl border border-border/30 bg-accent/20 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-medium text-muted-foreground">You receive</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 text-xl font-semibold tabular-nums">
                          {amount > 0 && sellRate
                            ? `₦${fiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : <span className="text-muted-foreground/40">₦0.00</span>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                          <span className="text-sm font-bold text-emerald-600">₦</span>
                          <span className="text-xs font-semibold">NGN</span>
                        </div>
                      </div>
                    </div>

                    {/* Bank selector */}
                    <div data-onboarding="withdraw-bank" className="mt-4">
                      <span className="mb-2 block text-[11px] font-medium text-muted-foreground">Payout bank</span>

                      {/* Saved banks */}
                      {savedBanks.length > 0 && !showAddBank && (
                        <div className="space-y-2">
                          {savedBanks.map((bank, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedBank(bank)}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                selectedBank?.accountNumber === bank.accountNumber
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border/30 hover:border-border"
                              }`}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/50">
                                <HugeiconsIcon icon={BankIcon} className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{bank.accountName}</p>
                                <p className="text-[10px] text-muted-foreground">{bank.bankName} · {bank.accountNumber}</p>
                              </div>
                              {selectedBank?.accountNumber === bank.accountNumber && (
                                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => setShowAddBank(true)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/40 py-2.5 text-[11px] font-medium text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                          >
                            <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
                            Add New Account
                          </button>
                        </div>
                      )}

                      {/* Add bank form */}
                      {(showAddBank || savedBanks.length === 0) && (
                        <div className="space-y-2 rounded-xl border border-border/30 bg-accent/10 p-3">
                          <input
                            type="text"
                            value={newBank.bankName}
                            onChange={(e) => setNewBank((b) => ({ ...b, bankName: e.target.value }))}
                            placeholder="Bank Name"
                            className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                          />
                          <input
                            type="text"
                            value={newBank.accountNumber}
                            onChange={(e) => setNewBank((b) => ({ ...b, accountNumber: e.target.value }))}
                            placeholder="Account Number"
                            maxLength={10}
                            className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                          />
                          <input
                            type="text"
                            value={newBank.accountName}
                            onChange={(e) => setNewBank((b) => ({ ...b, accountName: e.target.value }))}
                            placeholder="Account Name"
                            className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                          />
                          <div className="flex gap-2 pt-1">
                            {savedBanks.length > 0 && (
                              <button onClick={() => setShowAddBank(false)} className="flex-1 rounded-lg border border-border/30 py-2 text-[11px] font-medium hover:bg-accent transition-colors">
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={handleAddBank}
                              disabled={!newBank.bankName || !newBank.accountNumber || !newBank.accountName}
                              className="flex-1 rounded-lg bg-primary py-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              Use This Account
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quote details */}
                    {amount > 0 && sellRate && (
                      <div className="mt-3 rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sell Rate</span>
                          <span className="font-medium tabular-nums">1 USDT = ₦{sellRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Market Rate</span>
                          <span className="font-medium tabular-nums text-muted-foreground">₦{ngnRate?.marketRate.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Platform Fee</span>
                          <span className="font-medium">5%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Network</span>
                          <span className="font-medium">{chain === "solana" ? "Solana (SPL)" : "Ethereum (ERC-20)"}</span>
                        </div>
                      </div>
                    )}

                    {/* Inline rate */}
                    {ngnRate && amount > 0 && (
                      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                        <HugeiconsIcon icon={Exchange01Icon} className="h-3 w-3" />
                        <span className="tabular-nums">{amount} USDT = ₦{fiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

                    <button
                      data-onboarding="withdraw-cta"
                      onClick={initiate}
                      disabled={!isValid || !sellRate || !hasBankSelected || loading}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                      {loading ? "Processing…" : "Withdraw USDT"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══ Send USDT step ═══ */}
          {activeWithdrawal && activeWithdrawal.status === "pending" && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Send USDT</h2>
                </div>
                <StatusLabel status={activeWithdrawal.status} />
              </div>
              <div className="p-4 space-y-3">
                {/* Summary */}
                <div className="rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sell Amount</span>
                    <span className="font-medium tabular-nums">{activeWithdrawal.usdtAmount} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">You Receive</span>
                    <span className="font-semibold tabular-nums">{CURRENCY_SYM[activeWithdrawal.fiatCurrency]}{activeWithdrawal.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium tabular-nums">1 USDT = {CURRENCY_SYM[activeWithdrawal.fiatCurrency]}{activeWithdrawal.exchangeRate.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="text-right font-medium">
                      {activeWithdrawal.bankDetails?.accountName}
                      <span className="ml-1 text-muted-foreground">· {activeWithdrawal.bankDetails?.bankName}</span>
                    </span>
                  </div>
                </div>

                {/* Treasury address */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-xs font-medium">
                    Send exactly <strong>{activeWithdrawal.usdtAmount} USDT</strong> ({activeWithdrawal.chain === "ethereum" ? "ERC-20" : "SPL"}) to:
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-card border border-border/30 p-2.5">
                    <code className="flex-1 break-all text-[11px] font-mono text-muted-foreground">
                      {activeWithdrawal.treasuryWalletAddress}
                    </code>
                    <button
                      onClick={() => copyAddress(activeWithdrawal.treasuryWalletAddress)}
                      className="shrink-0 rounded-md p-1.5 hover:bg-accent transition-colors"
                    >
                      <HugeiconsIcon icon={copied ? CheckmarkCircle01Icon : Copy01Icon} className={`h-3.5 w-3.5 ${copied ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60">
                    Only send USDT on {activeWithdrawal.chain === "ethereum" ? "Ethereum" : "Solana"}. Wrong tokens may be lost.
                  </p>
                </div>

                {/* Tx hash input */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-medium text-muted-foreground">After sending, paste your tx hash:</span>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x… or transaction signature"
                    className="w-full rounded-xl border border-border/30 bg-accent/20 px-3.5 py-3 text-xs font-mono outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={cancelWithdrawal} disabled={loading} className="flex-1 rounded-xl border border-border/30 py-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmTx} disabled={!txHash.trim() || loading} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {loading && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    {loading ? "Submitting…" : "I've Sent the USDT"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Processing ═══ */}
          {activeWithdrawal && ["usdt_sent", "tx_verified", "processing", "ngn_sent"].includes(activeWithdrawal.status) && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-primary" />
                  <h2 className="text-sm font-semibold">
                    {activeWithdrawal.status === "usdt_sent" ? "Verifying Transaction" :
                     activeWithdrawal.status === "tx_verified" ? "Transaction Verified" :
                     activeWithdrawal.status === "processing" ? "Processing Payout" : "NGN Sent"}
                  </h2>
                </div>
                <StatusLabel status={activeWithdrawal.status} />
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
                  <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium">
                  {activeWithdrawal.status === "usdt_sent" ? "Checking the blockchain…" :
                   activeWithdrawal.status === "tx_verified" ? "USDT arrived. Preparing NGN payout…" :
                   `Sending ${CURRENCY_SYM[activeWithdrawal.fiatCurrency]}${activeWithdrawal.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to ${activeWithdrawal.bankDetails?.bankName}`}
                </p>

                {/* Progress pills */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {PROGRESS_STEPS.map((s) => {
                    const order = ["usdt_sent", "tx_verified", "processing", "ngn_sent"]
                    const isDone = order.indexOf(s.key) <= order.indexOf(activeWithdrawal.status)
                    return (
                      <span key={s.key} className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${isDone ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {isDone && "✓ "}{s.label}
                      </span>
                    )
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">Status updates automatically</p>
              </div>
            </div>
          )}

          {/* ═══ Completed ═══ */}
          {activeWithdrawal?.status === "completed" && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">Withdrawal Complete</h2>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium">
                  <span className="font-bold">{CURRENCY_SYM[activeWithdrawal.fiatCurrency]}{activeWithdrawal.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> sent to {activeWithdrawal.bankDetails?.bankName}
                </p>
                {activeWithdrawal.txHash && (
                  <a href={activeWithdrawal.chain === "ethereum" ? `https://etherscan.io/tx/${activeWithdrawal.txHash}` : `https://solscan.io/tx/${activeWithdrawal.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    View USDT TX <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                  </a>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Withdraw Again</button>
                  <a href="/assets" className="rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">View Assets</a>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Failed ═══ */}
          {activeWithdrawal?.status === "failed" && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold">Withdrawal Failed</h2>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-medium">Something went wrong</p>
                <p className="max-w-sm text-center text-[10px] text-muted-foreground">
                  Our team has been notified and will resolve this shortly.
                </p>
                <button onClick={reset} className="mt-2 rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">Back to Withdraw</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Side panels */}
        <div className="flex flex-col gap-4">
          <RecentWithdrawals />
          <HowItWorks />
        </div>
      </div>
    </>
  )
}
