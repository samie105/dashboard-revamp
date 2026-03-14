"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  ArrowRight01Icon,
  Loading03Icon,
  Wallet01Icon,
  Exchange01Icon,
  ArrowUpRight01Icon,
  Clock01Icon,
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

interface DepositRecord {
  _id: string
  usdtAmount: number
  fiatAmount: number
  fiatCurrency: string
  exchangeRate: number
  merchantTransactionReference: string
  status: string
  txHash?: string
  deliveryError?: string
  network?: "solana" | "ethereum"
  checkoutUrl?: string
  createdAt: string
  completedAt?: string
}

const CURRENCY_SYM: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£" }

// ── Onboarding steps ─────────────────────────────────────────────────────

const DEPOSIT_ONBOARDING: OnboardingStep[] = [
  {
    target: '[data-onboarding="deposit-network"]',
    title: "Choose your network",
    description: "Select which blockchain you want to receive USDT on — Solana (fast, low fees) or Ethereum.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="deposit-amount"]',
    title: "Enter the amount",
    description: "Type how much USDT you'd like to deposit. You'll pay the NGN equivalent via bank transfer.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="deposit-rate"]',
    title: "Live exchange rate",
    description: "This shows the current USDT → NGN rate including a small 5% platform fee.",
    placement: "top",
  },
  {
    target: '[data-onboarding="deposit-cta"]',
    title: "Start your deposit",
    description: "Click to be redirected to GlobalPay. USDT arrives in your wallet automatically!",
    placement: "top",
  },
]

// ── Status label ─────────────────────────────────────────────────────────

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: "text-amber-500", label: "Pending" },
    awaiting_verification: { color: "text-blue-500", label: "Awaiting Verification" },
    verifying: { color: "text-blue-500", label: "Verifying…" },
    payment_confirmed: { color: "text-emerald-500", label: "Payment Confirmed" },
    sending_usdt: { color: "text-orange-500", label: "Sending USDT…" },
    completed: { color: "text-emerald-500", label: "Completed" },
    payment_failed: { color: "text-red-500", label: "Payment Failed" },
    delivery_failed: { color: "text-red-500", label: "Delivery Failed" },
    cancelled: { color: "text-muted-foreground", label: "Cancelled" },
  }
  const c = map[status] || map.pending
  return <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
}

// ── Side panels ──────────────────────────────────────────────────────────

const STEPS = [
  { title: "Choose network", desc: "Solana or Ethereum" },
  { title: "Enter amount", desc: "Set the USDT you need" },
  { title: "Pay via bank", desc: "Redirected to GlobalPay" },
  { title: "Receive USDT", desc: "Tokens sent to your wallet" },
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

function RecentDeposits() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">Recent Deposits</h3>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Exchange01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No deposit history yet</p>
        <p className="text-[10px] text-muted-foreground/60">Completed deposits will appear here</p>
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

export function DepositClient() {
  const { walletsGenerated } = useWallet()
  const { profile } = useProfile()
  const searchParams = useSearchParams()

  const [network, setNetwork] = React.useState<"solana" | "ethereum">("solana")
  const [usdtAmount, setUsdtAmount] = React.useState(() => {
    const v = searchParams.get("amount")
    return v && !isNaN(parseFloat(v)) ? v : ""
  })
  const [rates, setRates] = React.useState<Record<string, Rate>>({})
  const [ratesLoading, setRatesLoading] = React.useState(true)

  const [activeDeposit, setActiveDeposit] = React.useState<DepositRecord | null>(null)
  const [paymentUrl, setPaymentUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [verifying, setVerifying] = React.useState(false)
  const [verifyMsg, setVerifyMsg] = React.useState("")
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

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

  // ── Auto-resume ──────────────────────────────────────────────────────

  const autoVerified = React.useRef(false)

  React.useEffect(() => {
    const did = searchParams.get("depositId")
    if (did) {
      ;(async () => {
        try {
          const r = await fetch(`/api/deposit/status/${encodeURIComponent(did)}`)
          const d = await r.json()
          if (d.success && d.deposit) { setActiveDeposit(d.deposit); setPaymentUrl(d.deposit.checkoutUrl || null) }
        } catch { /* ignore */ }
      })()
      return
    }

    if (activeDeposit) return
    ;(async () => {
      try {
        const r = await fetch("/api/deposit/pending")
        const d = await r.json()
        if (!d.success || !d.deposit) return
        setActiveDeposit(d.deposit)
        setPaymentUrl(d.deposit.checkoutUrl || null)

        if (!autoVerified.current && ["pending", "awaiting_verification"].includes(d.deposit.status)) {
          autoVerified.current = true
          setVerifying(true)
          try {
            const vr = await fetch("/api/deposit/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositId: d.deposit._id }) })
            const vd = await vr.json()
            if (vd.deposit) setActiveDeposit(vd.deposit)
            if (!vd.success) setVerifyMsg(vd.message || "Verifying payment…")
          } catch { setVerifyMsg("Auto-verification pending. Click 'I've Paid' to retry.") }
          finally { setVerifying(false) }
        }
      } catch { /* no pending */ }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (activeDeposit && ["verifying", "payment_confirmed", "sending_usdt"].includes(activeDeposit.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/deposit/status/${activeDeposit._id}`)
          const d = await r.json()
          if (d.success && d.deposit) {
            setActiveDeposit(d.deposit)
            if (["completed", "payment_failed", "delivery_failed", "cancelled"].includes(d.deposit.status)) {
              if (pollRef.current) clearInterval(pollRef.current)
            }
          }
        } catch { /* continue */ }
      }, 5000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [activeDeposit?.status, activeDeposit?._id])

  // ── Derived ──────────────────────────────────────────────────────────

  const ngnRate = rates["NGN"]
  const buyRate = ngnRate?.buyRate
  const amount = parseFloat(usdtAmount) || 0
  const fiat = amount * (buyRate || 0)
  const isValid = amount >= 1 && amount <= 5000

  // ── Actions ──────────────────────────────────────────────────────────

  async function initiate() {
    if (!isValid || !buyRate) return
    setError(""); setLoading(true)
    try {
      const r = await fetch("/api/deposit/initiate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usdtAmount: amount, fiatCurrency: "NGN", network }) })
      const d = await r.json()
      if (!d.success) { setError(d.message || "Failed to create deposit."); return }
      setActiveDeposit(d.deposit); setPaymentUrl(d.checkoutUrl || null); setUsdtAmount("")
    } catch { setError("Something went wrong.") }
    finally { setLoading(false) }
  }

  async function verify() {
    if (!activeDeposit) return
    setVerifying(true); setVerifyMsg(""); setError("")
    try {
      const r = await fetch("/api/deposit/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositId: activeDeposit._id }) })
      const d = await r.json()
      if (d.deposit) setActiveDeposit(d.deposit)
      if (!d.success) setVerifyMsg(d.message || "Verification failed")
    } catch { setError("Failed to verify payment.") }
    finally { setVerifying(false) }
  }

  async function cancel() {
    if (!activeDeposit) return
    setLoading(true)
    try {
      const r = await fetch(`/api/deposit/status/${activeDeposit._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })
      const d = await r.json()
      if (d.success) reset()
    } catch { setError("Failed to cancel.") }
    finally { setLoading(false) }
  }

  function openPay() {
    if (!paymentUrl) { setError("Payment link unavailable."); return }
    window.open(paymentUrl, "_blank", "noopener,noreferrer")
  }

  function reset() { setActiveDeposit(null); setPaymentUrl(null); setError(""); setVerifyMsg("") }

  // ── Wallet guard ─────────────────────────────────────────────────────

  if (!walletsGenerated) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium">Wallet setup required</p>
        <p className="text-xs text-muted-foreground">Set up your wallets to start depositing.</p>
        <a href="/assets" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          Go to Assets <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
        </a>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <OnboardingFlow
        steps={DEPOSIT_ONBOARDING}
        storageKey="onboarding-deposit"
        completed={profile?.onboardingCompleted?.includes("onboarding-deposit")}
        onComplete={() => markOnboardingComplete("onboarding-deposit")}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Deposit</h1>
          <p className="text-xs text-muted-foreground">Fund your wallet with USDT via bank transfer</p>
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
          {!activeDeposit && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Buy USDT</h2>
                </div>
                {ngnRate && (
                  <span data-onboarding="deposit-rate" className="text-[11px] tabular-nums text-muted-foreground">
                    1 USDT = {ngnRate.symbol}{ngnRate.buyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <div data-onboarding="deposit-network" className="mb-4">
                      <span className="mb-2 block text-[11px] font-medium text-muted-foreground">Receive on</span>
                      <div className="flex gap-2">
                        {CHAINS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setNetwork(c.id)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2.5 transition-colors ${
                              network === c.id ? "border-primary/50 bg-primary/5" : "border-border/30 hover:border-border"
                            }`}
                          >
                            <img src={c.icon} alt={c.label} className="h-5 w-5 rounded-full" />
                            <div className="text-left">
                              <p className={`text-xs font-semibold ${network === c.id ? "text-primary" : ""}`}>{c.label}</p>
                              <p className="text-[10px] text-muted-foreground">{c.tag} USDT</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* You deposit */}
                    <div data-onboarding="deposit-amount" className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-medium text-muted-foreground">You deposit</span>
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
                          onClick={() => setNetwork(network === "solana" ? "ethereum" : "solana")}
                          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <img src={CHAINS.find((c) => c.id === network)!.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                          {CHAINS.find((c) => c.id === network)!.label}
                        </button>
                      </div>
                    </div>

                    {/* You pay */}
                    <div className="mt-3 rounded-xl border border-border/30 bg-accent/20 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-medium text-muted-foreground">You pay</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 text-xl font-semibold tabular-nums">
                          {amount > 0 && buyRate
                            ? `₦${fiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : <span className="text-muted-foreground/40">₦0.00</span>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                          <span className="text-sm font-bold text-emerald-600">₦</span>
                          <span className="text-xs font-semibold">NGN</span>
                        </div>
                      </div>
                    </div>

                    {/* Quote details */}
                    {amount > 0 && buyRate && (
                      <div className="mt-3 rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Exchange Rate</span>
                          <span className="font-medium tabular-nums">1 USDT = ₦{buyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                          <span className="font-medium">{network === "solana" ? "Solana (SPL)" : "Ethereum (ERC-20)"}</span>
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
                      data-onboarding="deposit-cta"
                      onClick={initiate}
                      disabled={!isValid || !buyRate || loading}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                      {loading ? "Processing…" : "Deposit USDT"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══ Payment step ═══ */}
          {activeDeposit && ["pending", "awaiting_verification", "payment_failed"].includes(activeDeposit.status) && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Complete Payment</h2>
                </div>
                <StatusLabel status={activeDeposit.status} />
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Deposit Amount</span>
                    <span className="font-medium tabular-nums">{activeDeposit.usdtAmount} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total to Pay</span>
                    <span className="font-semibold tabular-nums">{CURRENCY_SYM[activeDeposit.fiatCurrency]}{activeDeposit.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium tabular-nums">1 USDT = {CURRENCY_SYM[activeDeposit.fiatCurrency]}{activeDeposit.exchangeRate.toLocaleString()}</span>
                  </div>
                </div>

                <button onClick={openPay} disabled={!paymentUrl} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 hover:shadow-md disabled:opacity-50">
                  Pay {CURRENCY_SYM[activeDeposit.fiatCurrency]}{activeDeposit.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[10px] text-muted-foreground">after paying</span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                {verifyMsg && <p className="text-xs text-amber-500">{verifyMsg} — wait 30s then retry.</p>}
                {activeDeposit.status === "payment_failed" && <p className="text-xs text-red-500">Previous verification failed. Pay again or retry.</p>}
                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={cancel} disabled={loading || verifying} className="flex-1 rounded-xl border border-border/30 py-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={verify} disabled={verifying} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {verifying && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    {verifying ? "Verifying…" : "I've Paid"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Processing ═══ */}
          {activeDeposit && ["verifying", "payment_confirmed", "sending_usdt"].includes(activeDeposit.status) && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-primary" />
                  <h2 className="text-sm font-semibold">
                    {activeDeposit.status === "verifying" ? "Verifying Payment" : activeDeposit.status === "payment_confirmed" ? "Payment Confirmed" : "Sending USDT"}
                  </h2>
                </div>
                <StatusLabel status={activeDeposit.status} />
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
                  <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium">
                  {activeDeposit.status === "verifying" ? "Checking with GlobalPay…" : `Sending ${activeDeposit.usdtAmount} USDT to your ${activeDeposit.network === "ethereum" ? "Ethereum" : "Solana"} wallet`}
                </p>
                <p className="text-[10px] text-muted-foreground">Status updates automatically</p>
              </div>
            </div>
          )}

          {/* ═══ Completed ═══ */}
          {activeDeposit?.status === "completed" && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">Deposit Successful</h2>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium"><span className="font-bold">{activeDeposit.usdtAmount} USDT</span> sent to your {activeDeposit.network === "ethereum" ? "Ethereum" : "Solana"} wallet</p>
                {activeDeposit.txHash && (
                  <a href={activeDeposit.network === "ethereum" ? `https://etherscan.io/tx/${activeDeposit.txHash}` : `https://solscan.io/tx/${activeDeposit.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    View on {activeDeposit.network === "ethereum" ? "Etherscan" : "Solscan"} <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                  </a>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Deposit Again</button>
                  <a href="/assets" className="rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">View Assets</a>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Delivery Failed ═══ */}
          {activeDeposit?.status === "delivery_failed" && (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold">Delivery Issue</h2>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-medium">Payment received — USDT delivery pending</p>
                <p className="max-w-sm text-center text-[10px] text-muted-foreground">
                  Your payment of {CURRENCY_SYM[activeDeposit.fiatCurrency]}{activeDeposit.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} was confirmed but USDT delivery hit an issue. Our team has been notified.
                </p>
                {activeDeposit.deliveryError && <p className="text-[10px] font-mono text-red-400">{activeDeposit.deliveryError}</p>}
                <button onClick={reset} className="mt-2 rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">Back to Deposit</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Side panels */}
        <div className="flex flex-col gap-4">
          <RecentDeposits />
          <HowItWorks />
        </div>
      </div>
    </>
  )
}
