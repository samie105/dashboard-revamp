"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  RefreshIcon,
  Copy01Icon,
  CheckmarkSquare01Icon,
  Add01Icon,
  Search01Icon,
  Cancel01Icon,
  ArrowDown01Icon as ChevronDownIcon,
  Exchange01Icon,
  ArrowUpRight01Icon,
  Chart01Icon,
  ChartLineData01Icon,
  Coins01Icon,
} from "@hugeicons/core-free-icons"
import { getPrices } from "@/lib/actions"
import { useWallet, type WalletAddresses } from "@/components/wallet-provider"
import { WalletSetupLoader } from "@/components/wallet-setup-loader"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { useTradeSelector } from "@/components/trade-selector"
import { useWalletBalances, type TokenBalance } from "@/hooks/useWalletBalances"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { useAuth } from "@/components/auth-provider"

// ── Onboarding steps ─────────────────────────────────────────────────────

const ASSETS_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="portfolio-header"]',
    title: "Your Portfolio",
    description:
      "This card shows your total balance across all chains. Hit Refresh to sync the latest data.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="chain-selector"]',
    title: "Switch chains",
    description:
      "Select a chain to view its wallet address. You can copy the address to receive tokens.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="assets-table"]',
    title: "Your assets",
    description:
      "Browse all tokens across your wallets. Filter by chain or search by name to find specific assets.",
    placement: "top",
  },
  {
    target: '[data-onboarding="add-token-btn"]',
    title: "Add custom tokens",
    description:
      "Don\u2019t see a token? Use Add Token to import any ERC-20, SPL, or TRC-20 token by contract address.",
    placement: "bottom",
  },
]

// ── Chain config ─────────────────────────────────────────────────────────

interface ChainInfo {
  key: keyof WalletAddresses
  name: string
  symbol: string
  icon: string
}

const CHAINS: ChainInfo[] = [
  { key: "solana",   name: "Solana",   symbol: "SOL",  icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { key: "ethereum", name: "Ethereum", symbol: "ETH",  icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { key: "arbitrum", name: "Arbitrum", symbol: "ETH",  icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { key: "sui",      name: "Sui",      symbol: "SUI",  icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { key: "ton",      name: "TON",      symbol: "TON",  icon: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png" },
  { key: "tron",     name: "Tron",     symbol: "TRX",  icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

// Token list across all chains
interface TokenInfo {
  symbol: string
  name: string
  icon: string
  chain: string
  isNative: boolean
  contractAddress?: string
}

const ALL_TOKENS: TokenInfo[] = [
  { symbol: "SOL",  name: "Solana",    icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",    chain: "solana",   isNative: true },
  { symbol: "USDT", name: "Tether",    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",     chain: "solana",   isNative: false, contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "USDC", name: "USD Coin",  icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",      chain: "solana",   isNative: false, contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "ETH",  name: "Ethereum",  icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",   chain: "ethereum", isNative: true },
  { symbol: "USDT", name: "Tether",    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",     chain: "ethereum", isNative: false, contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  { symbol: "USDC", name: "USD Coin",  icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",      chain: "ethereum", isNative: false, contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { symbol: "LINK", name: "Chainlink", icon: "https://coin-images.coingecko.com/coins/images/877/small/chainlink-new-logo.png", chain: "ethereum", isNative: false, contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  { symbol: "ETH",  name: "Ethereum",  icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",   chain: "arbitrum", isNative: true },
  { symbol: "USDT", name: "Tether",    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",     chain: "arbitrum", isNative: false, contractAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
  { symbol: "USDC", name: "USD Coin",  icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",      chain: "arbitrum", isNative: false, contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  { symbol: "SUI",  name: "Sui",       icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png", chain: "sui", isNative: true },
  { symbol: "TON",  name: "TON",       icon: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png", chain: "ton", isNative: true },
  { symbol: "TRX",  name: "Tron",      icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",  chain: "tron", isNative: true },
  { symbol: "USDT", name: "Tether",    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",      chain: "tron", isNative: false, contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
]

const CHAIN_TABS = ["All", "Solana", "Ethereum", "Arbitrum", "Sui", "TON", "Tron"] as const
type ChainTab = (typeof CHAIN_TABS)[number]
const CHAIN_TAB_MAP: Record<ChainTab, string | null> = { All: null, Solana: "solana", Ethereum: "ethereum", Arbitrum: "arbitrum", Sui: "sui", TON: "ton", Tron: "tron" }

// ── Wallet view tabs ─────────────────────────────────────────────────────

const WALLET_VIEWS = [
  { key: "total",   label: "Total",   icon: Coins01Icon,         sub: "All accounts" },
  { key: "main",    label: "Main",    icon: Wallet01Icon,        sub: "On-chain balance" },
  { key: "spot",    label: "Spot",    icon: Chart01Icon,         sub: "Spot trading" },
  { key: "futures", label: "Futures", icon: ChartLineData01Icon, sub: "Futures wallet" },
] as const

type WalletView = (typeof WALLET_VIEWS)[number]["key"]

// ── Helpers ──────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/* ========== Asset Trade Button ========== */

function AssetTradeButton({ symbol }: { symbol: string }) {
  const { openTradeSelector } = useTradeSelector()
  return (
    <button
      onClick={() => openTradeSelector(symbol)}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      Trade
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
    </button>
  )
}

/* ========== Add Token Modal ========== */

function AddTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = React.useState<"network" | "address" | "preview">("network")
  const [network, setNetwork] = React.useState("")
  const [contractAddress, setContractAddress] = React.useState("")
  const [isLooking, setIsLooking] = React.useState(false)
  const [tokenPreview, setTokenPreview] = React.useState<{ symbol: string; name: string; icon: string; decimals: number } | null>(null)
  const [lookupError, setLookupError] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) { setStep("network"); setNetwork(""); setContractAddress(""); setTokenPreview(null); setLookupError("") }
  }, [open])

  React.useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  if (!open) return null

  const nets = [
    { key: "ethereum", name: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
    { key: "solana",   name: "Solana",   icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
    { key: "tron",     name: "Tron",     icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
  ]

  async function handleLookup() {
    if (!contractAddress.trim()) return
    setIsLooking(true); setLookupError(""); setTokenPreview(null)
    try {
      const res = await fetch(`/api/tokens/metadata?address=${encodeURIComponent(contractAddress.trim())}&chain=${network}`)
      if (!res.ok) throw new Error("Token not found")
      const d = await res.json()
      setTokenPreview({ symbol: d.symbol, name: d.name, icon: d.image || d.logo || "", decimals: d.decimals ?? 18 })
      setStep("preview")
    } catch { setLookupError("Could not find token. Check the address and network.") }
    finally { setIsLooking(false) }
  }

  async function handleAdd() {
    if (!tokenPreview) return
    try {
      await fetch("/api/tokens/custom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chain: network, contractAddress: contractAddress.trim(), ...tokenPreview }) })
      onClose()
    } catch { setLookupError("Failed to add token.") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-popover shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <h3 className="text-sm font-semibold">Add Custom Token</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {step === "network" && (
            <>
              <p className="text-xs text-muted-foreground">Select the network for your token.</p>
              <div className="grid grid-cols-3 gap-2">
                {nets.map((n) => (
                  <button key={n.key} onClick={() => { setNetwork(n.key); setStep("address") }}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/30 p-3.5 transition-colors hover:bg-accent hover:border-primary/30">
                    <img src={n.icon} alt={n.name} className="size-8 rounded-full" />
                    <span className="text-xs font-medium">{n.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "address" && (
            <>
              <div className="flex items-center gap-2">
                <img src={nets.find((n) => n.key === network)?.icon} alt="" className="size-4 rounded-full" />
                <span className="text-xs font-medium capitalize">{network}</span>
              </div>
              <input
                value={contractAddress} onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Paste contract address"
                className="w-full rounded-lg bg-accent/50 px-3 py-2 text-xs font-mono outline-none focus:bg-accent placeholder:text-muted-foreground/50"
              />
              {lookupError && <p className="text-xs text-red-500">{lookupError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep("network")} className="flex-1 rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">Back</button>
                <button onClick={handleLookup} disabled={!contractAddress.trim() || isLooking}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
                  {isLooking ? "Looking up…" : "Find Token"}
                </button>
              </div>
            </>
          )}
          {step === "preview" && tokenPreview && (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-accent/30 p-3">
                {tokenPreview.icon && <img src={tokenPreview.icon} alt="" className="size-10 rounded-full" />}
                <div>
                  <p className="text-sm font-semibold">{tokenPreview.name}</p>
                  <p className="text-xs text-muted-foreground">{tokenPreview.symbol} · {tokenPreview.decimals} decimals</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep("address"); setTokenPreview(null) }} className="flex-1 rounded-lg border border-border/30 px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">Back</button>
                <button onClick={handleAdd} className="flex-1 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Add Token</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ========== Main Component ========== */

export default function AssetsClient() {
  const { addresses, walletsGenerated, isLoading, error, refreshWallets, setupStatus } = useWallet()
  const { profile } = useProfile()
  const { user } = useAuth()
  const { balances: onChainBalances, isLoading: balancesLoading, refetch: refetchBalances } = useWalletBalances()
  const { balances: hlBalances, accountValue: hlAccountValue, loading: hlLoading } = useHyperliquidBalance(user?.userId, !!user)
  const [prices, setPrices] = React.useState<Record<string, number>>({})
  const [activeView, setActiveView] = React.useState<WalletView>("total")
  const [selectedChain, setSelectedChain] = React.useState<string>(CHAINS[0].key)
  const [chainDropdownOpen, setChainDropdownOpen] = React.useState(false)
  const chainDropdownRef = React.useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [showAddToken, setShowAddToken] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [chainTab, setChainTab] = React.useState<ChainTab>("All")
  const [search, setSearch] = React.useState("")

  // Fetch prices for crypto→USD conversion
  React.useEffect(() => {
    let cancelled = false
    getPrices().then((data) => {
      if (!cancelled && data.prices) setPrices(data.prices)
    })
    const interval = setInterval(() => {
      getPrices().then((data) => {
        if (!cancelled && data.prices) setPrices(data.prices)
      })
    }, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  function getPrice(symbol: string): number {
    return prices[symbol] ?? 0
  }

  // Build a lookup map: "chain:symbol:contractAddress" → balance
  const balanceMap = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const b of onChainBalances) {
      const key = `${b.chain}:${b.symbol}:${b.contractAddress ?? "native"}`
      map.set(key, (map.get(key) ?? 0) + b.balance)
    }
    return map
  }, [onChainBalances])

  function getTokenBalance(token: TokenInfo): number {
    const key = `${token.chain}:${token.symbol}:${token.contractAddress ?? "native"}`
    return balanceMap.get(key) ?? 0
  }

  // On-chain total: all tokens valued in USD
  const onChainTotal = React.useMemo(() => {
    let total = 0
    for (const token of ALL_TOKENS) {
      const bal = getTokenBalance(token)
      if (bal <= 0) continue
      if (["USDT", "USDC"].includes(token.symbol)) {
        total += bal
      } else {
        const p = getPrice(token.symbol)
        total += bal * (p > 0 ? p : 0)
      }
    }
    return total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceMap, prices])

  // Spot balance = sum of all Hyperliquid spot holdings at current prices
  const spotBalance = React.useMemo(
    () => hlBalances.reduce((sum, b) => sum + (b.currentValue || 0), 0),
    [hlBalances],
  )

  // Futures balance = Hyperliquid perps account value
  const futuresBalance = hlAccountValue

  // Per-view displayed balance
  const displayedBalance = React.useMemo(() => {
    switch (activeView) {
      case "main":    return onChainTotal
      case "spot":    return spotBalance
      case "futures": return futuresBalance
      case "total":
      default:        return onChainTotal + spotBalance + futuresBalance
    }
  }, [activeView, onChainTotal, spotBalance, futuresBalance])

  const copy = React.useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const refresh = React.useCallback(async () => {
    setIsRefreshing(true)
    try { await Promise.all([refreshWallets(), refetchBalances()]) } finally { setIsRefreshing(false) }
  }, [refreshWallets, refetchBalances])

  // Filtered tokens
  const filteredTokens = React.useMemo(() => {
    let list = [...ALL_TOKENS]
    const chainKey = CHAIN_TAB_MAP[chainTab]
    if (chainKey) list = list.filter((t) => t.chain === chainKey)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
    }
    return list
  }, [chainTab, search])

  const [errorDismissed, setErrorDismissed] = React.useState(false)

  // Reset dismissed state when error changes
  React.useEffect(() => { if (error) setErrorDismissed(false) }, [error])

  // Close chain dropdown on outside click
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(e.target as Node)) setChainDropdownOpen(false)
    }
    if (chainDropdownOpen) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [chainDropdownOpen])

  const activeChain = CHAINS.find((c) => c.key === selectedChain) || CHAINS[0]
  const addrKey = activeChain.key === "arbitrum" ? "ethereum" : activeChain.key
  const displayedAddress = addresses?.[addrKey as keyof WalletAddresses] || ""

  // ── States ────────────────────────────────────────────────────────────
  if (isLoading && !walletsGenerated) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="rounded-2xl bg-card">
          <WalletSetupLoader status={setupStatus} />
        </div>
      </div>
    )
  }

  if (!walletsGenerated && !addresses && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={Wallet01Icon} size={24} className="text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold mb-1">No Wallet Setup</h2>
          <p className="text-xs text-muted-foreground">Sign in to generate your multi-chain wallets.</p>
        </div>
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">

      <OnboardingFlow
        steps={ASSETS_ONBOARDING_STEPS}
        storageKey="assets-onboarding-complete"
        completed={profile?.onboardingCompleted?.includes("assets")}
        onComplete={() => markOnboardingComplete("assets")}
      />

      {/* ═══ Inline error banner (non-blocking) ═══ */}
      {error && !errorDismissed && (
        <div className="flex items-center gap-3 rounded-2xl bg-destructive/5 border border-destructive/10 px-4 py-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Connection issue</span>{" — "}
            {error}
          </p>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            Retry
          </button>
          <button
            onClick={() => setErrorDismissed(true)}
            className="rounded-lg p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ═══ Portfolio Header Card ═══ */}
      <div data-onboarding="portfolio-header" className="rounded-2xl bg-card p-5">
        {/* Wallet view tabs */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-0.5">
            {WALLET_VIEWS.map((view) => (
              <button
                key={view.key}
                onClick={() => setActiveView(view.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeView === view.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <HugeiconsIcon icon={view.icon} className="h-3 w-3" />
                {view.label}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
            <HugeiconsIcon icon={RefreshIcon} className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Syncing…" : "Refresh"}
          </button>
        </div>

        {/* Balance display */}
        <div>
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            {balancesLoading && onChainBalances.length === 0 ? "Loading…" : `$${displayedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1">
            {WALLET_VIEWS.find((v) => v.key === activeView)?.sub}
          </p>
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-border/30" />

        {/* Chain select dropdown + displayed address */}
        <div data-onboarding="chain-selector" className="flex items-center gap-3">
          {/* Chain selector */}
          <div ref={chainDropdownRef} className="relative">
            <button
              onClick={() => setChainDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
            >
              <img src={activeChain.icon} alt={activeChain.name} className="h-4 w-4 rounded-full" />
              <span>{activeChain.name}</span>
              <HugeiconsIcon icon={ChevronDownIcon} className={`h-3 w-3 text-muted-foreground transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {chainDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl bg-popover shadow-xl border border-border/30 py-1">
                {CHAINS.map((chain) => (
                  <button
                    key={chain.key}
                    onClick={() => { setSelectedChain(chain.key); setChainDropdownOpen(false) }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-accent ${
                      selectedChain === chain.key ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <img src={chain.icon} alt={chain.name} className="h-4 w-4 rounded-full" />
                    <span>{chain.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">{chain.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address display + copy */}
          {displayedAddress && (
            <button
              onClick={() => copy(displayedAddress, activeChain.key)}
              className={`inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs font-mono transition-colors hover:bg-accent ${
                copied === activeChain.key ? "border-emerald-500/40 bg-emerald-500/5" : ""
              }`}
            >
              <span className="text-muted-foreground">{truncAddr(displayedAddress)}</span>
              <HugeiconsIcon
                icon={copied === activeChain.key ? CheckmarkSquare01Icon : Copy01Icon}
                className={`h-3 w-3 ${copied === activeChain.key ? "text-emerald-500" : "text-muted-foreground/60"}`}
              />
              {copied === activeChain.key && <span className="text-[10px] text-emerald-500">Copied!</span>}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Assets Table (mirrors MarketsTable) ═══ */}
      <div data-onboarding="assets-table" className="flex h-full flex-col rounded-2xl bg-card">
        {/* Header */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Assets</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-36 rounded-lg bg-accent/50 pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-accent"
                />
              </div>
              <button
                data-onboarding="add-token-btn"
                onClick={() => setShowAddToken(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
                Add Token
              </button>
            </div>
          </div>

          {/* Chain filter tabs (same style as MarketsTable tabs) */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {CHAIN_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setChainTab(tab)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  chainTab === tab
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filteredTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <HugeiconsIcon icon={Search01Icon} className="mb-2 h-5 w-5 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">No tokens found</p>
            <p className="text-[10px] text-muted-foreground/70">Try a different filter or search</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Asset</th>
                  <th className="px-4 py-2 text-left font-medium">Network</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                  <th className="px-4 py-2 text-right font-medium">Value</th>
                  <th className="px-4 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredTokens.map((token) => {
                  const chainInfo = CHAINS.find((c) => c.key === token.chain)
                  return (
                    <tr key={`${token.chain}-${token.symbol}-${token.contractAddress ?? "native"}`} className="transition-colors hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            <img src={token.icon} alt={token.symbol} className="h-7 w-7 rounded-full" />
                            {!token.isNative && chainInfo && (
                              <img src={chainInfo.icon} alt="" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{token.symbol}</span>
                            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{token.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {chainInfo && (
                          <div className="flex items-center gap-1.5">
                            <img src={chainInfo.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                            <span className="text-xs text-muted-foreground">{chainInfo.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {(() => {
                          const bal = getTokenBalance(token)
                          return bal > 0 ? bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                        {(() => {
                          const bal = getTokenBalance(token)
                          if (bal <= 0) return "$0.00"
                          if (["USDT", "USDC"].includes(token.symbol)) {
                            return `$${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                          const p = getPrice(token.symbol)
                          const usdVal = bal * p
                          return p > 0
                            ? `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${token.symbol}`
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <AssetTradeButton symbol={token.symbol} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddTokenModal open={showAddToken} onClose={() => setShowAddToken(false)} />
    </div>
  )
}
