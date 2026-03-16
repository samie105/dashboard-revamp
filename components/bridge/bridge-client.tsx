"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Link01Icon,
  ArrowDown01Icon,
  Exchange01Icon,
  Cancel01Icon,
  Loading03Icon,
  Search01Icon,
  InformationCircleIcon,
  Clock01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"
import { useWallet } from "@/components/wallet-provider"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import {
  fetchBridgeQuote,
  executeBridgeTransaction,
  type BridgeQuote,
} from "@/lib/bridge-actions"
import { BRIDGE_CHAINS, BRIDGE_TOKENS } from "@/lib/bridge-config"
import { formatUnits } from "@/lib/utils"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"

// ── Onboarding steps ────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="page-header"]',
    title: "Welcome to the Bridge",
    description:
      "Transfer tokens between blockchains in just a few clicks. This page lets you bridge assets across supported chains.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="from-section"]',
    title: "Choose what to send",
    description:
      "Pick the source chain, enter the amount you want to bridge, and select the token.",
    placement: "right",
  },
  {
    target: '[data-onboarding="flip-button"]',
    title: "Swap direction",
    description:
      "Quickly flip the source and destination chains with one click.",
    placement: "right",
  },
  {
    target: '[data-onboarding="to-section"]',
    title: "Choose what to receive",
    description:
      "Select the destination chain and token. The estimated output updates automatically.",
    placement: "right",
  },
  {
    target: '[data-onboarding="bridge-button"]',
    title: "Execute the bridge",
    description:
      "Once you're happy with the quote, tap this button to start the cross-chain transfer.",
    placement: "top",
  },
  {
    target: '[data-onboarding="info-panels"]',
    title: "Helpful info",
    description:
      "View supported chains, learn how bridging works, and track your recent bridge transactions here.",
    placement: "left",
  },
]

// ── Types ───────────────────────────────────────────────────────────────

type Chain = (typeof BRIDGE_CHAINS)[number]
type Token = (typeof BRIDGE_TOKENS)[number]
type Status = "idle" | "quoting" | "approving" | "executing" | "success" | "failed"

// ── Chain Select Dropdown ───────────────────────────────────────────────

function ChainSelect({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string
  value: Chain
  onChange: (c: Chain) => void
  exclude?: number
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={ref} className="relative flex-1">
      <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-accent/20 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
      >
        <img src={value.icon} alt={value.name} className="h-5 w-5 rounded-full" />
        <span className="flex-1 text-left">{value.name}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[180px] rounded-xl border border-border/30 bg-popover py-1 shadow-xl">
          {BRIDGE_CHAINS.filter((c) => c.id !== exclude).map((chain) => (
            <button
              key={chain.id}
              onClick={() => { onChange(chain); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-accent ${
                value.id === chain.id ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              <img src={chain.icon} alt={chain.name} className="h-4 w-4 rounded-full" />
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Token Select Dropdown ───────────────────────────────────────────────

function TokenSelect({
  value,
  onChange,
}: {
  value: Token
  onChange: (t: Token) => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-card px-2.5 py-1.5 transition-colors hover:bg-accent"
      >
        <img src={value.icon} alt={value.symbol} className="h-5 w-5 rounded-full" />
        <span className="text-xs font-semibold">{value.symbol}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-border/30 bg-popover py-1 shadow-xl">
          {BRIDGE_TOKENS.map((token) => (
            <button
              key={token.symbol}
              onClick={() => { onChange(token); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-accent ${
                value.symbol === token.symbol ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              <img src={token.icon} alt={token.symbol} className="h-4 w-4 rounded-full" />
              <span>{token.symbol}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">{token.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quote Details Card ──────────────────────────────────────────────────

function QuoteDetails({ quote, toDecimals, toSymbol }: { quote: BridgeQuote; toDecimals: number; toSymbol: string }) {
  const toAmount = parseFloat(formatUnits(quote.estimate.toAmount, toDecimals))
  const toAmountMin = parseFloat(formatUnits(quote.estimate.toAmountMin, toDecimals))
  const fees = quote.estimate.feeCosts?.reduce((sum, f) => sum + parseFloat(f.amountUSD || "0"), 0) ?? 0
  const gas = quote.estimate.gasCosts?.reduce((sum, g) => sum + parseFloat(g.amountUSD || "0"), 0) ?? 0
  const estMinutes = Math.ceil(quote.estimate.executionDuration / 60)

  return (
    <div className="rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Route</span>
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary capitalize">
          via {quote.tool}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Expected Output</span>
        <div className="text-right">
          <span className="font-medium tabular-nums">{toAmount.toFixed(6)} {toSymbol}</span>
          {quote.estimate.toAmountUSD && (
            <p className="text-[10px] text-muted-foreground/60">~${parseFloat(quote.estimate.toAmountUSD).toFixed(2)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Min. Received</span>
        <div className="text-right">
          <span className="font-medium tabular-nums">{toAmountMin.toFixed(6)} {toSymbol}</span>
          <p className="text-[10px] text-muted-foreground/60">Slippage: {(quote.action.slippage * 100).toFixed(2)}%</p>
        </div>
      </div>
      <div className="h-px bg-border/20" />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Protocol Fees</span>
        <span className="font-medium tabular-nums">${fees.toFixed(4)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Gas Cost (Est.)</span>
        <span className="font-medium tabular-nums">${gas.toFixed(4)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Est. Time</span>
        <span className="font-medium">{estMinutes} min{estMinutes !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

// ── How It Works ────────────────────────────────────────────────────────

const STEPS = [
  { title: "Select chains & tokens", desc: "Choose source and destination" },
  { title: "Review quote", desc: "Check fees, route & estimated output" },
  { title: "Bridge assets", desc: "Sign the transaction via Privy" },
  { title: "Track completion", desc: "Cross-chain transfer finalizes" },
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
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/50" />
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

// ── Recent Bridges (empty state) ────────────────────────────────────────

function RecentBridges() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold">Recent Bridges</h3>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Link01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No bridge history yet</p>
        <p className="text-[10px] text-muted-foreground/60">Cross-chain transfers will appear here</p>
      </div>
    </div>
  )
}

// ── Supported Chains ────────────────────────────────────────────────────

function SupportedChains() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={Link01Icon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">Supported Chains</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        {BRIDGE_CHAINS.map((chain) => (
          <div
            key={chain.id}
            className="flex items-center gap-2 rounded-lg border border-border/30 px-2.5 py-2"
          >
            <img src={chain.icon} alt={chain.name} className="h-4 w-4 rounded-full" />
            <span className="text-xs font-medium text-muted-foreground">{chain.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Main BridgeClient
   ═══════════════════════════════════════════════════════════════════════ */

export function BridgeClient() {
  const { addresses } = useWallet()
  const { profile } = useProfile()
  const { balances } = useWalletBalances()

  // State
  const [fromChain, setFromChain] = React.useState<Chain>(BRIDGE_CHAINS[0])
  const [toChain, setToChain] = React.useState<Chain>(BRIDGE_CHAINS[1])
  const [fromToken, setFromToken] = React.useState<Token>(BRIDGE_TOKENS[0])
  const [toToken, setToToken] = React.useState<Token>(BRIDGE_TOKENS[0])

  // Look up on-chain balance for the selected "from" token on Ethereum
  const fromTokenBalance = React.useMemo(() => {
    const match = balances.find(
      (b) => b.symbol.toUpperCase() === fromToken.symbol.toUpperCase() && b.chain.toLowerCase() === "ethereum"
    )
    return match?.balance ?? 0
  }, [balances, fromToken.symbol])
  const [amount, setAmount] = React.useState("")
  const [quote, setQuote] = React.useState<BridgeQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<Status>("idle")
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [txHash, setTxHash] = React.useState<string | null>(null)

  // Chain change handlers — swap if selecting the same
  const handleFromChain = React.useCallback((c: Chain) => {
    if (c.id === toChain.id) setToChain(fromChain)
    setFromChain(c)
  }, [toChain, fromChain])

  const handleToChain = React.useCallback((c: Chain) => {
    if (c.id === fromChain.id) setFromChain(toChain)
    setToChain(c)
  }, [fromChain, toChain])

  // Swap chains
  const flipChains = React.useCallback(() => {
    setFromChain((prev) => {
      setToChain(fromChain)
      return toChain
    })
  }, [fromChain, toChain])

  // ── Quote fetching (debounced) ──

  const fetchQuoteAction = React.useCallback(async () => {
    const num = parseFloat(amount)
    if (!amount || num <= 0 || !addresses?.ethereum) {
      setQuote(null)
      return
    }

    setIsLoadingQuote(true)
    setError(null)

    const result = await fetchBridgeQuote({
      fromChainId: fromChain.id,
      toChainId: toChain.id,
      fromTokenSymbol: fromToken.symbol,
      toTokenSymbol: toToken.symbol,
      amount,
      fromTokenDecimals: fromToken.decimals,
    })

    if (result.success && result.quote) {
      setQuote(result.quote)
    } else {
      setError(result.error || "Failed to get quote")
      setQuote(null)
    }
    setIsLoadingQuote(false)
  }, [amount, fromChain.id, toChain.id, fromToken, toToken, addresses?.ethereum])

  // Debounce
  React.useEffect(() => {
    const t = setTimeout(fetchQuoteAction, 1000)
    return () => clearTimeout(t)
  }, [fetchQuoteAction])

  // Auto-refresh every 30s
  React.useEffect(() => {
    const num = parseFloat(amount)
    if (!amount || num <= 0) return
    const interval = setInterval(fetchQuoteAction, 30000)
    return () => clearInterval(interval)
  }, [fetchQuoteAction, amount])

  // ── Execute bridge ──

  const handleBridge = React.useCallback(async () => {
    if (!quote) return

    setIsExecuting(true)
    setStatus("executing")
    setError(null)

    const tx = quote.transactionRequest

    // Execute the bridge tx through the server action
    const result = await executeBridgeTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      chainId: tx.chainId,
      gasLimit: tx.gasLimit,
    })

    if (result.success && result.transactionHash) {
      setTxHash(result.transactionHash)
      setStatus("success")
    } else {
      setError(result.error || "Bridge execution failed")
      setStatus("failed")
    }

    setIsExecuting(false)
  }, [quote])

  // Estimated output display
  const estimatedOutput = quote
    ? parseFloat(formatUnits(quote.estimate.toAmount, toToken.decimals)).toFixed(6)
    : "0.00"

  // Button state
  const buttonText = React.useMemo(() => {
    if (!addresses?.ethereum) return "Connect wallet"
    if (!amount || parseFloat(amount) <= 0) return "Enter amount"
    if (isLoadingQuote) return "Fetching quote…"
    if (status === "approving") return "Approving…"
    if (isExecuting) return "Bridging…"
    if (status === "success") return "Bridge Successful"
    return "Bridge"
  }, [addresses?.ethereum, amount, isLoadingQuote, isExecuting, status])

  const canBridge = Boolean(quote && !isLoadingQuote && !isExecuting && status !== "success" && parseFloat(amount) > 0)

  // Explorer link helper
  const explorerUrl = React.useMemo(() => {
    if (!txHash) return null
    const explorers: Record<number, string> = {
      1: "https://etherscan.io",
      42161: "https://arbiscan.io",
      137: "https://polygonscan.com",
      10: "https://optimistic.etherscan.io",
      56: "https://bscscan.com",
      8453: "https://basescan.org",
    }
    return `${explorers[fromChain.id] || "https://etherscan.io"}/tx/${txHash}`
  }, [txHash, fromChain.id])

  return (
    <>
      <OnboardingFlow
        steps={ONBOARDING_STEPS}
        storageKey="bridge-onboarding-complete"
        completed={profile?.onboardingCompleted?.includes("bridge")}
        onComplete={() => markOnboardingComplete("bridge")}
      />

      {/* Page header */}
      <div data-onboarding="page-header" className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Bridge</h1>
          <p className="text-xs text-muted-foreground">
            Transfer assets across chains via LI.FI
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {BRIDGE_CHAINS.slice(0, 4).map((chain) => (
            <div key={chain.id} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-accent/30 px-2.5 py-1">
              <img src={chain.icon} alt={chain.name} className="h-3.5 w-3.5 rounded-full" />
              <span className="text-[10px] font-medium">{chain.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* LEFT — Bridge card */}
        <div>
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Link01Icon} className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Cross-Chain Bridge</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">Powered by LI.FI</span>
            </div>

            <div className="p-4 space-y-1">
              {/* ── FROM section ── */}
              <div data-onboarding="from-section" className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">You send</span>
                  <span className="text-[11px] text-muted-foreground">Balance: {fromTokenBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                </div>

                {/* Chain + Token row */}
                <div className="flex items-end gap-3 mb-3">
                  <ChainSelect label="From Chain" value={fromChain} onChange={handleFromChain} exclude={toChain.id} />
                </div>

                {/* Amount input */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v)
                    }}
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
                  />
                  <TokenSelect value={fromToken} onChange={setFromToken} />
                </div>
              </div>

              {/* ── Flip button ── */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  data-onboarding="flip-button"
                  onClick={flipChains}
                  className="rounded-full border-4 border-card bg-accent p-1.5 text-muted-foreground shadow-sm transition-all hover:bg-primary hover:text-white hover:scale-110"
                >
                  <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── TO section ── */}
              <div data-onboarding="to-section" className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">You receive</span>
                </div>

                {/* Chain + Token row */}
                <div className="flex items-end gap-3 mb-3">
                  <ChainSelect label="To Chain" value={toChain} onChange={handleToChain} exclude={fromChain.id} />
                </div>

                {/* Output display */}
                <div className="flex items-center gap-3">
                  <span className={`flex-1 text-xl font-semibold tabular-nums ${isLoadingQuote ? "animate-pulse text-muted-foreground" : ""}`}>
                    {estimatedOutput}
                  </span>
                  <TokenSelect value={toToken} onChange={setToToken} />
                </div>
              </div>

              {/* ── Quote details ── */}
              {quote && (
                <div className="pt-2">
                  <QuoteDetails quote={quote} toDecimals={toToken.decimals} toSymbol={toToken.symbol} />
                </div>
              )}

              {/* ── Error alert ── */}
              {error && (
                <div className="flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/10 px-3 py-2.5">
                  <HugeiconsIcon icon={Alert01Icon} className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p className="text-xs text-muted-foreground">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto rounded-lg p-0.5 text-muted-foreground/50 hover:text-foreground">
                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* ── Success alert ── */}
              {status === "success" && txHash && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2.5">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="flex-1 text-xs text-muted-foreground">
                    Bridge transaction initiated!
                  </p>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:underline"
                    >
                      View
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {/* ── Bridge button ── */}
              <div data-onboarding="bridge-button" className="pt-2">
                <button
                  onClick={handleBridge}
                  disabled={!canBridge}
                  className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                    status === "success"
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {(isLoadingQuote || isExecuting) && (
                    <HugeiconsIcon icon={Loading03Icon} className="mr-2 inline-block h-4 w-4 animate-spin" />
                  )}
                  {buttonText}
                </button>
              </div>

              <p className="text-center text-[10px] text-muted-foreground/50 pt-1">
                Secured by Privy Custody & Li.Fi Engine
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — Info panels */}
        <div data-onboarding="info-panels" className="flex flex-col gap-4">
          <SupportedChains />
          <HowItWorks />
          <RecentBridges />
        </div>
      </div>
    </>
  )
}
