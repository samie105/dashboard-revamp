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
  ArrowDownLeft01Icon,
  Chart01Icon,
  ChartLineData01Icon,
  Coins01Icon,
} from "@hugeicons/core-free-icons"
import {
  ActionPill,
  Balance,
  CardHeader,
  CardShell,
  Eyebrow,
  IconAction,
  PageHeader,
  Segmented,
  Skel,
  SkeletonRows,
  SkeletonTable,
  WeightBar,
  allocationColor,
} from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { num, numOr, pctSigned, share, usd, usdCompact, UNKNOWN } from "@/lib/num"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { getPrices, getFuturesMarkets, type CoinData, type FuturesMarket } from "@/lib/actions"
import { fetchTokenMetadata, addCustomToken, type CustomTokenChain } from "@/lib/crypto-api"
import { useWallet, type WalletAddresses } from "@/components/wallet-provider"
import { WalletSetupLoader } from "@/components/wallet-setup-loader"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { useWalletBalances, type TokenBalance } from "@/hooks/useWalletBalances"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useAuth } from "@/components/auth-provider"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"
import { fetchPrices, type Coin } from "@/lib/crypto-api"
import { SendModal, type SendableAsset } from "@/components/assets/send-modal"
import { ReceiveModal, type ReceivableAsset } from "@/components/assets/receive-modal"
/* Futures is not live yet - the shared "not open" treatment. */
import { ComingSoon, FUTURES_SOON_TITLE, SoonBadge } from "@/components/ui/coming-soon"

// Market rows for the Spot tab — the service's price feed plus the display
// fields the old spotv2 pair registry carried.
type SpotV2Pair = Coin & { displaySymbol: string; chain: string; contractAddress: string | null }

const coinToPair = (c: Coin): SpotV2Pair => ({
  ...c,
  displaySymbol: c.symbol.toUpperCase(),
  chain: "",
  contractAddress: null,
})
import { useRouter } from "next/navigation"
import { getCoinImage, coinFallback } from "@/lib/coin-images"

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
  key: keyof WalletAddresses | "arbitrum"
  name: string
  symbol: string
  icon: string
}

const CHAINS: ChainInfo[] = [
  { key: "tron",     name: "Tron",     symbol: "TRX",  icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
  { key: "solana",   name: "Solana",   symbol: "SOL",  icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { key: "ethereum", name: "Ethereum", symbol: "ETH",  icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { key: "arbitrum", name: "Arbitrum", symbol: "ETH",  icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { key: "sui",      name: "Sui",      symbol: "SUI",  icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { key: "ton",      name: "TON",      symbol: "TON",  icon: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png" },
]

// Token list across all chains
interface TokenInfo {
  symbol: string
  name: string
  icon: string
  chain: string
  isNative: boolean
  contractAddress?: string
  decimals?: number
}

const ALL_TOKENS: TokenInfo[] = [
  { symbol: "TRX",  name: "Tron",      icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",  chain: "tron", isNative: true },
  { symbol: "USDT", name: "Tether",    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",      chain: "tron", isNative: false, contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
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
]

const CHAIN_TABS = ["All", "Tron", "Solana", "Ethereum", "Arbitrum", "Sui", "TON"] as const
type ChainTab = (typeof CHAIN_TABS)[number]
const CHAIN_TAB_MAP: Record<ChainTab, string | null> = { All: null, Tron: "tron", Solana: "solana", Ethereum: "ethereum", Arbitrum: "arbitrum", Sui: "sui", TON: "ton" }

function displayChainKey(value: string) {
  const chain = value.toLowerCase()
  if (chain.includes("arbitrum")) return "arbitrum"
  if (chain.includes("ethereum")) return "ethereum"
  if (chain.includes("solana")) return "solana"
  if (chain.includes("sui")) return "sui"
  if (chain.includes("ton")) return "ton"
  if (chain.includes("tron")) return "tron"
  return value
}

function assetIdentity(symbol: string, contractAddress?: string) {
  return contractAddress ? contractAddress.toLowerCase() : `native:${symbol.toUpperCase()}`
}

// ── Wallet view tabs ─────────────────────────────────────────────────────

const WALLET_VIEWS = [
  { key: "main",    label: "Main",    icon: Wallet01Icon,        sub: "On-chain wallet" },
  { key: "spot",    label: "Spot",    icon: Chart01Icon,         sub: "Spot balance" },
  { key: "futures", label: "Futures", icon: ChartLineData01Icon, sub: "Perpetual positions" },
] as const

type WalletView = (typeof WALLET_VIEWS)[number]["key"]

/* ── Futures gate ────────────────────────────────────────────────────────
   Perpetual futures are not live yet. The tab stays visible AND pressable: a
   disabled tab has no way to explain itself on a touchscreen, where `title`
   never fires, so pressing it is how the reader finds out. What it opens is
   the one "not open yet" panel instead of the futures body.

   The futures sections below — Open Positions and Futures Contracts — are
   left exactly as they were and are simply not reached. Typed `boolean` on
   purpose so TypeScript keeps type-checking both arms.

   TO RE-OPEN: set this to false, then delete it and the `futuresClosed` /
   `FUTURES_CLOSED` blocks that reference it. */
const FUTURES_CLOSED: boolean = true

// ── Helpers ──────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/* ========== Allocation — what the page is actually for ==========
   A list of balances answers "how much of each?" but never "what am I holding?"
   One stacked bar answers it before a single row is read.

   The segments are NEUTRAL by rule: gold means brand, primary CTA and active
   state — never a data colour — and emerald/red mean money direction. So weight
   is carried by lightness alone, and the colour comes from the token icons in
   the legend, where it's real rather than assigned. */

type Slice = { key: string; symbol: string; name: string; icon: string; usd: number; pct: number }

/** How many decimals a share needs before it stops being a lie. */
const pctLabel = (p: number) => {
  const v = num(p)
  if (v === null) return UNKNOWN
  return v >= 1 ? `${v.toFixed(1)}%` : v > 0 ? "<1%" : "0%"
}

/* -- Donut ----------------------------------------------------------------
   One <circle> per slice, each carrying the whole circumference in its dash
   pattern and offset to its own start angle. The arcs grow from zero on mount
   by transitioning stroke-dasharray, so the ring assembles itself rather than
   snapping into place - the reveal is the loading animation's last beat, not a
   decoration bolted on after it. */
function AllocationDonut({
  slices,
  active,
  onActive,
  size = 148,
}: {
  slices: Slice[]
  active: string | null
  onActive: (key: string | null) => void
  size?: number
}) {
  const [drawn, setDrawn] = React.useState(false)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const stroke = 15
  const r = (size - stroke) / 2 - 1
  const C = 2 * Math.PI * r
  // A hairline of ground behind each join keeps neighbouring browns apart.
  const GAP = slices.length > 1 ? 1.6 : 0

  /* Each arc's start angle is the sum of everything before it. Computed up
     front rather than accumulated inside the map — mutating a local during
     render is the kind of thing that works until a re-render order changes. */
  const arcs = slices.reduce<{ slice: Slice; len: number; offset: number }[]>((acc, s) => {
    const start = acc.reduce((sum, a) => sum + (a.slice.pct / 100) * C, 0)
    acc.push({ slice: s, len: Math.max(0, (s.pct / 100) * C - GAP), offset: -start })
    return acc
  }, [])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={`Allocation: ${slices.map((s) => `${s.symbol} ${pctLabel(s.pct)}`).join(", ")}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-foreground/[0.05]"
      />
      {arcs.map(({ slice: s, len, offset }, i) => {
        const dimmed = active !== null && active !== s.key
        return (
          <circle
            key={s.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={allocationColor(i)}
            strokeWidth={active === s.key ? stroke + 4 : stroke}
            strokeDasharray={`${drawn ? len : 0} ${C}`}
            strokeDashoffset={offset}
            onMouseEnter={() => onActive(s.key)}
            onMouseLeave={() => onActive(null)}
            className="cursor-default transition-[stroke-dasharray,stroke-width,opacity] duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ opacity: dimmed ? 0.32 : 1 }}
          />
        )
      })}
    </svg>
  )
}

/* -- Composition ----------------------------------------------------------
   "What am I actually holding?" is the first question this page is asked, and
   a stacked 10px bar answered it in a whisper. The ring carries the split, the
   ranked list carries the money, and both are keyed to the same warm ladder -
   gold for the largest position, walking down through amber and bronze - so a
   colour means a RANK rather than a coin. Hovering either side lights the
   other, which is how you find one holding's arc among six.

   The ladder is a deliberate, narrow exception to "gold is never a data
   colour": nothing here claims SOL is gold, only that SOL is first. */
function CompositionPanel({
  slices,
  total,
  chains,
  loading,
}: {
  slices: Slice[]
  total: number
  chains: number
  loading: boolean
}) {
  const [active, setActive] = React.useState<string | null>(null)

  if (loading) return <CompositionSkeleton />
  if (slices.length === 0) return null

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-surface-sunken/60 p-5 sm:flex-row sm:items-center sm:gap-7">
      {/* Ring - left, as asked, and the anchor the percentages belong to */}
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <AllocationDonut slices={slices} active={active} onActive={setActive} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[20px] font-light leading-none tabular-nums">
            {usdCompact(total)}
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">
            {slices.length} {slices.length === 1 ? "holding" : "holdings"}
            {chains > 0 ? ` · ${chains} chains` : ""}
          </span>
        </div>
      </div>

      {/* Ranked holdings - the ring's key, and the money it stands for */}
      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {slices.map((s, i) => (
          <li
            key={s.key}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-3 transition-opacity duration-200"
            style={{ opacity: active && active !== s.key ? 0.4 : 1 }}
          >
            {s.key === "__other" ? (
              // The remainder isn't a coin, so it wears its slice's colour
              // rather than a monogram for a symbol that doesn't exist.
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 rounded-full"
                style={{ background: allocationColor(i) }}
              />
            ) : (
              <CoinAvatar src={s.icon} symbol={s.symbol} size="sm" className="h-5 w-5" />
            )}
            <span className="w-11 shrink-0 text-[13px] font-semibold">{s.symbol}</span>
            {/* The name takes the row's slack. Letting the BAR take it instead
                stretched every track to ~320px, where a 24% fill and a 13%
                fill are both just "a short bar" — the comparison the chart
                exists to make. A fixed track is a fixed ruler. */}
            <span className="hidden min-w-0 flex-1 truncate text-[13px] text-muted-foreground md:block">
              {s.name}
            </span>
            <WeightBar pct={s.pct} rank={i} className="w-full min-w-0 flex-1 md:w-40 md:flex-none" />
            <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
              {pctLabel(s.pct)}
            </span>
            <span className="hidden w-24 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground sm:block">
              {usd(s.usd)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* The skeleton is the panel with its content withheld - same ring, same row
   count, same rhythm - so when the figures arrive nothing moves. The old
   behaviour was to render nothing at all until balances resolved, then push
   the rest of the page down by 90px the moment they did. */
function CompositionSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading allocation"
      className="flex flex-col gap-5 rounded-2xl bg-surface-sunken/60 p-5 sm:flex-row sm:items-center sm:gap-7"
    >
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <span
          aria-hidden
          className="skel block rounded-full"
          style={{
            width: 148,
            height: 148,
            // A ring, not a disc - the hole is where the total will sit.
            WebkitMask: "radial-gradient(circle, transparent 0 44px, #fff 44px)",
            mask: "radial-gradient(circle, transparent 0 44px, #fff 44px)",
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.13 }}>
            <Skel className="h-5 w-5 shrink-0 rounded-full" />
            <Skel className="h-3 w-11 shrink-0" />
            <Skel className="hidden h-3 min-w-0 flex-1 md:block" />
            <Skel className="h-1.5 w-full min-w-0 flex-1 rounded-full md:w-40 md:flex-none" />
            <Skel className="h-3 w-12 shrink-0" />
            <Skel className="hidden h-3 w-24 shrink-0 sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ========== Action rail ==========
   Replaces the two prose cards that sat in a mostly-empty right column
   ("Fund trading account", "Withdraw trading balance"). Those were paragraphs
   pretending to be buttons, and they navigated away to a full page; these open
   the same money flows in place. */

function AssetsActions() {
  const { openFlow } = useMoneyFlow()
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />} label="Deposit" onClick={() => openFlow("buy")} />
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />} label="Withdraw" onClick={() => openFlow("sell")} />
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={Exchange01Icon} className={className} />} label="Fund trading" onClick={() => openFlow("fund")} />
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={Coins01Icon} className={className} />} label="Withdraw trading" onClick={() => openFlow("trading-withdraw")} />
    </div>
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

  React.useEffect(() => {
    if (open) { setStep("network"); setNetwork(""); setContractAddress(""); setTokenPreview(null); setLookupError("") }
  }, [open])

  const nets = [
    { key: "ethereum", name: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
    { key: "solana",   name: "Solana",   icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
    { key: "tron",     name: "Tron",     icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
  ]

  async function handleLookup() {
    if (!contractAddress.trim()) return
    setIsLooking(true); setLookupError(""); setTokenPreview(null)
    try {
      const token = await fetchTokenMetadata({
        address: contractAddress.trim(),
        chain: network as CustomTokenChain,
      })
      setTokenPreview({ symbol: token.symbol, name: token.name, icon: token.image, decimals: token.decimals })
      setStep("preview")
    } catch { setLookupError("Could not find token. Check the address and network.") }
    finally { setIsLooking(false) }
  }

  async function handleAdd() {
    if (!tokenPreview) return
    try {
      // Only chain + address are sent — the service re-reads symbol/name/
      // decimals on chain and ignores the rest of the body.
      await addCustomToken({ chain: network as CustomTokenChain, contractAddress: contractAddress.trim() })
      onClose()
    } catch { setLookupError("Failed to add token.") }
  }

  /* This was the last hand-rolled overlay on the page: its own backdrop, its
     own mousedown listener, no Escape key, and a fixed centred panel that
     stayed centred on a phone instead of becoming a sheet like every other
     modal in the product. */
  return (
    <ResponsiveModal open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-[15px]">Add custom token</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-[13px]">
            Import any ERC-20, SPL or TRC-20 token by contract address
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="max-h-[70dvh] space-y-4 overflow-y-auto">
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
              {lookupError && <p className="text-xs text-debit">{lookupError}</p>}
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
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/* ========== Main Component ========== */

export default function AssetsClient() {
  const { addresses, walletsGenerated, isLoading, error, refreshWallets, setupStatus } = useWallet()
  const { profile } = useProfile()
  const { user } = useAuth()
  const { balances: onChainBalances, isLoading: balancesLoading, refetch: refetchBalances } = useWalletBalances()
  const { positions: hlPositions, futuresUsd, loading: hlPositionsLoading } = useHyperliquidPositions()

  // SpotV2 data
  const [spotLedger, setSpotLedger] = React.useState<LedgerBalance[]>([])
  const [spotV2Positions, setSpotV2Positions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])
  const [spotV2Loading, setSpotV2Loading] = React.useState(true)

  React.useEffect(() => {
    if (!user) { setSpotV2Loading(false); return }
    let cancelled = false
    Promise.all([getSpotBalances(), getSpotPositions()])
      .then(async ([balances, positions]) => {
        if (cancelled) return
        setSpotLedger(balances)
        const tokens = positions.map((p) => p.token)
        const pm = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        if (!cancelled) setSpotV2Positions(positions.map((p) => ({ ...p, currentPrice: pm.get(p.token) ?? 0 })))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSpotV2Loading(false) })
    return () => { cancelled = true }
  }, [user])
  const [prices, setPrices] = React.useState<Record<string, number>>({})
  /* Balances and prices arrive on separate clocks, and a holding is worth
     nothing until both have landed. With only balances in, every non-stable
     token priced at $0 — so the hero read $4,303.50 and the ring showed two
     slices, then both jumped to the real figures a second later. Waiting on
     the prices too costs a moment of skeleton and buys a number that's never
     wrong. */
  const [pricesLoaded, setPricesLoaded] = React.useState(false)
  const [activeView, setActiveView] = React.useState<WalletView>("main")
  const [selectedChain, setSelectedChain] = React.useState<string>(CHAINS[0].key)
  const [chainDropdownOpen, setChainDropdownOpen] = React.useState(false)
  const chainDropdownRef = React.useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [showAddToken, setShowAddToken] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [chainTab, setChainTab] = React.useState<ChainTab>("All")
  const [search, setSearch] = React.useState("")
  const [sendModal, setSendModal] = React.useState<{ open: boolean; asset?: SendableAsset }>({ open: false })
  // No asset → the header's "Receive" button, which offers every network.
  const [receiveModal, setReceiveModal] = React.useState<{ open: boolean; asset?: ReceivableAsset }>({ open: false })
  const [spotMarkets, setSpotMarkets] = React.useState<SpotV2Pair[]>([])
  const [spotMarketsLoading, setSpotMarketsLoading] = React.useState(false)
  const [spotMarketsLoaded, setSpotMarketsLoaded] = React.useState(false)
  const [spotSearch, setSpotSearch] = React.useState("")
  const [futuresMarkets, setFuturesMarkets] = React.useState<FuturesMarket[]>([])
  const [futuresMarketsLoading, setFuturesMarketsLoading] = React.useState(false)
  const [futuresMarketsLoaded, setFuturesMarketsLoaded] = React.useState(false)
  const [futuresSearch, setFuturesSearch] = React.useState("")
  const router = useRouter()

  // Fetch prices for crypto→USD conversion
  React.useEffect(() => {
    let cancelled = false
    getPrices()
      .then((data) => {
        if (!cancelled && data.prices) setPrices(data.prices)
      })
      // Resolved either way: a feed that's down shouldn't leave the page
      // shimmering forever. The figures will just be conservative.
      .finally(() => {
        if (!cancelled) setPricesLoaded(true)
      })
    const interval = setInterval(() => {
      getPrices().then((data) => {
        if (!cancelled && data.prices) setPrices(data.prices)
      })
    }, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Load spot markets when Spot tab is active
  React.useEffect(() => {
    if (activeView !== "spot" || spotMarketsLoaded) return
    let cancelled = false
    setSpotMarketsLoading(true)
    fetchPrices().then((res) => {
      if (!cancelled) { setSpotMarkets(res.coins.map(coinToPair)); setSpotMarketsLoading(false); setSpotMarketsLoaded(true) }
    }).catch(() => { if (!cancelled) setSpotMarketsLoading(false) })
    return () => { cancelled = true }
  }, [activeView, spotMarketsLoaded])

  // Load futures markets when Futures tab is active
  React.useEffect(() => {
    // GATE - no request for a venue that isn't open. Drop `FUTURES_CLOSED ||`.
    if (FUTURES_CLOSED || activeView !== "futures" || futuresMarketsLoaded) return
    let cancelled = false
    setFuturesMarketsLoading(true)
    getFuturesMarkets().then((data) => {
      if (!cancelled) { setFuturesMarkets(data.markets); setFuturesMarketsLoading(false); setFuturesMarketsLoaded(true) }
    }).catch(() => { if (!cancelled) setFuturesMarketsLoading(false) })
    return () => { cancelled = true }
  }, [activeView, futuresMarketsLoaded])

  const filteredSpotMarkets = React.useMemo(() => {
    if (!spotSearch) return spotMarkets
    const q = spotSearch.toLowerCase()
    return spotMarkets.filter((m) => m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  }, [spotMarkets, spotSearch])

  const filteredFuturesMarkets = React.useMemo(() => {
    if (!futuresSearch) return futuresMarkets
    const q = futuresSearch.toLowerCase()
    return futuresMarkets.filter((m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q))
  }, [futuresMarkets, futuresSearch])

  function getPrice(symbol: string): number {
    return prices[symbol] ?? 0
  }

  // Build a lookup map: "chain:symbol:contractAddress" → balance
  const balanceMap = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const b of onChainBalances) {
      const key = `${displayChainKey(b.chain)}:${assetIdentity(b.symbol, b.contractAddress)}`
      map.set(key, (map.get(key) ?? 0) + b.balance)
    }
    return map
  }, [onChainBalances])

  // Keep the known-token catalogue for receive/send affordances, but merge in
  // what the backend actually discovered. This prevents the page from hiding
  // a token simply because it was not hard-coded in the frontend.
  const assetCatalog = React.useMemo<TokenInfo[]>(() => {
    const map = new Map<string, TokenInfo>()
    for (const token of ALL_TOKENS) {
      const normalized = { ...token, chain: displayChainKey(token.chain), symbol: token.symbol.toUpperCase() }
      map.set(`${normalized.chain}:${assetIdentity(normalized.symbol, normalized.contractAddress)}`, normalized)
    }
    for (const balance of onChainBalances) {
      const chain = displayChainKey(balance.chain)
      const symbol = balance.symbol.toUpperCase()
      const contractAddress = balance.contractAddress
      const key = `${chain}:${assetIdentity(symbol, contractAddress)}`
      const previous = map.get(key) ?? [...map.values()].find((token) => token.chain === chain && contractAddress && token.contractAddress?.toLowerCase() === contractAddress.toLowerCase())
      if (previous && previous.contractAddress && previous.contractAddress.toLowerCase() !== (contractAddress ?? "").toLowerCase()) {
        map.delete(`${chain}:${assetIdentity(previous.symbol, previous.contractAddress)}`)
      }
      map.set(key, {
        symbol: previous?.symbol || symbol,
        name: balance.name || previous?.name || symbol,
        icon: balance.logo || previous?.icon || getCoinImage(symbol) || coinFallback(symbol),
        chain,
        isNative: balance.isNative,
        contractAddress,
        decimals: balance.decimals,
      })
    }
    return [...map.values()]
  }, [onChainBalances])

  function getTokenBalance(token: TokenInfo): number {
    const key = `${displayChainKey(token.chain)}:${assetIdentity(token.symbol, token.contractAddress)}`
    return balanceMap.get(key) ?? 0
  }

  /** One token row's USD value. Stables are worth their face value — quoting
   *  them off a price feed makes $2,500 of USDT read as $0 when the feed is
   *  cold. */
  const tokenUsd = React.useCallback(
    (token: TokenInfo, bal: number) => {
      if (bal <= 0) return 0
      if (["USDT", "USDC"].includes(token.symbol)) return bal
      const p = getPrice(token.symbol)
      return p > 0 ? bal * p : 0
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prices],
  )

  // On-chain total: all tokens valued in USD
  const onChainTotal = React.useMemo(() => {
    let total = 0
    for (const token of assetCatalog) total += tokenUsd(token, getTokenBalance(token))
    return total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetCatalog, balanceMap, tokenUsd])

  /* Allocation by SYMBOL, not by row: USDT on three chains is one holding to a
     human, even though it's three lines in the table. Top six, rest folded into
     "Other" so the bar never shatters into slivers. */
  const allocation = React.useMemo<Slice[]>(() => {
    if (onChainTotal <= 0) return []
    const bySymbol = new Map<string, { usd: number; icon: string; name: string }>()
    for (const token of assetCatalog) {
      const usd = tokenUsd(token, getTokenBalance(token))
      if (usd <= 0) continue
      const prev = bySymbol.get(token.symbol)
      bySymbol.set(token.symbol, {
        usd: (prev?.usd ?? 0) + usd,
        icon: prev?.icon ?? token.icon,
        name: prev?.name ?? token.name,
      })
    }
    const sorted = [...bySymbol.entries()].sort((a, b) => b[1].usd - a[1].usd)
    const head = sorted.slice(0, 6)
    const tailUsd = sorted.slice(6).reduce((sum, [, v]) => sum + v.usd, 0)
    const slices: Slice[] = head.map(([symbol, v]) => ({
      key: symbol,
      symbol,
      name: v.name,
      icon: v.icon,
      usd: v.usd,
      pct: (v.usd / onChainTotal) * 100,
    }))
    if (tailUsd > 0) {
      slices.push({
        key: "__other",
        symbol: "Other",
        name: `${sorted.length - head.length} smaller holdings`,
        icon: "",
        usd: tailUsd,
        pct: (tailUsd / onChainTotal) * 100,
      })
    }
    return slices
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetCatalog, balanceMap, tokenUsd, onChainTotal])

  // Spot balance = sum of SpotV2 USDC (available + locked) + positions value
  const spotBalance = React.useMemo(() => {
    const usdcTotal = spotLedger.reduce((sum, b) => sum + b.available + b.locked, 0)
    const posTotal = spotV2Positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0)
    return usdcTotal + posTotal
  }, [spotLedger, spotV2Positions])

  // Futures balance = perps account value (margin + unrealized PnL), not just
  // open-position notional — a funded account with no positions is not $0.
  const futuresBalance = futuresUsd

  // Per-view displayed balance
  const displayedBalance = React.useMemo(() => {
    switch (activeView) {
      case "main":    return onChainTotal
      case "futures": return futuresBalance
      case "spot":
      default:        return spotBalance
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

  /* Chain + search filtered, biggest holding first. Sorting by value is the
     whole point of an assets list: what you own most of should not be found by
     scanning a hard-coded token order. */
  const filteredTokens = React.useMemo(() => {
    let list = [...assetCatalog]
    const chainKey = CHAIN_TAB_MAP[chainTab]
    if (chainKey) list = list.filter((t) => t.chain === chainKey)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
    }
    return list.sort((a, b) => tokenUsd(b, getTokenBalance(b)) - tokenUsd(a, getTokenBalance(a)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetCatalog, chainTab, search, balanceMap, tokenUsd])

  /* Most of the token list is chains you haven't touched yet — eight of the
     fourteen rows read $0.00 on a fresh wallet, burying the six that hold real
     money. Empty rows are still reachable, just not the default view. */
  const [showEmpty, setShowEmpty] = React.useState(false)
  const fundedTokens = React.useMemo(
    () => filteredTokens.filter((t) => getTokenBalance(t) > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTokens, balanceMap],
  )
  const emptyCount = filteredTokens.length - fundedTokens.length
  const visibleTokens = showEmpty ? filteredTokens : fundedTokens

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
  /* One flag for "this view has no figures yet", shared by the hero, the
     sub-line and the composition panel so the three never disagree about
     whether the page is still loading. */
  const heroLoading =
    activeView === "spot"
      ? spotV2Loading
      : activeView === "futures"
        ? hlPositionsLoading
        : (balancesLoading && onChainBalances.length === 0) || !pricesLoaded

  /* GATE - futures is selectable but closed: the wallet card shows the "not
     open" panel instead of positions and contracts, and the hero stops
     quoting a perps figure. The tab bar stays live so the reader can leave. */
  const futuresClosed = activeView === "futures" && FUTURES_CLOSED

  const fundedChains = React.useMemo(
    () => new Set(fundedTokens.map((t) => t.chain)).size,
    [fundedTokens],
  )

  /* Where a symbol sits in the donut. The table's Share bars borrow it so a
     row's colour is the colour of its arc — otherwise the page shows the same
     split twice in two unrelated palettes and the reader has to re-learn it. */
  const allocationRank = React.useMemo(
    () => new Map(allocation.map((slice, i) => [slice.symbol, i])),
    [allocation],
  )

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

      {/* ═══ Assets header — page title, hero figure, one tab system ═══ */}
      <div data-onboarding="portfolio-header" className="flex flex-col gap-4">
        <PageHeader
          title="Assets"
          subtitle="Your crypto across chains"
          actions={
            <IconAction
              icon={({ className }: { className?: string }) => (
                <HugeiconsIcon icon={RefreshIcon} className={`${className} ${isRefreshing ? "animate-spin" : ""}`} />
              )}
              label={isRefreshing ? "Syncing…" : "Refresh"}
              onClick={refresh}
            />
          }
        />

        <div className="-mx-1 max-w-full overflow-x-auto px-1 scrollbar-none">
          <Segmented
            /* Every view is selectable, futures included - see FUTURES_CLOSED.
               A greyed-out tab is a dead end on touch; a live one that answers
               the question is not. */
            options={WALLET_VIEWS.map((v) => ({ key: v.key, label: v.label }))}
            value={activeView}
            onChange={setActiveView}
          />
        </div>

        {/* Balance hero */}
        <div className="flex w-fit flex-col gap-1">
          <Eyebrow>Est. Total Value</Eyebrow>
          {futuresClosed ? (
            /* GATE - a real perps balance here would say the venue works, and
               a skeleton would say it is about to. The house "unknown" dash
               says neither. `displayedBalance`'s `case "futures"` is untouched.
               TO RE-OPEN: delete this first arm. */
            <Balance value={UNKNOWN} className="text-[clamp(2rem,4vw,3rem)]" />
          ) : heroLoading ? (
            /* The word "Loading…" set in the balance's 3rem display face was
               louder than most of the figures it stood in for, and it changed
               width the instant the real number landed. A block the size of
               the number says the same thing without shouting it. */
            <Skel className="my-1.5 h-[clamp(2rem,4vw,3rem)] w-[clamp(11rem,22vw,17rem)] rounded-lg" />
          ) : (
            <Balance
              value={`$${displayedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              className="text-[clamp(2rem,4vw,3rem)]"
            />
          )}
          {/* The old line read "On-chain wallet · On-chain $13,266.76" — the
              same word twice and a figure identical to the one above it. */}
          <span className="text-[13px] text-muted-foreground">
            {/* GATE - the stored sub is "Perpetual positions", which implies
                positions exist. TO RE-OPEN: delete this first arm. */}
            {futuresClosed
              ? "Perpetual futures · not open yet"
              : WALLET_VIEWS.find((v) => v.key === activeView)?.sub}
            {activeView === "main" && !heroLoading && fundedTokens.length > 0 && (
              <>{` · ${fundedTokens.length} ${fundedTokens.length === 1 ? "asset" : "assets"} across ${fundedChains} chains`}</>
            )}
          </span>
        </div>

        {/* Composition — the page's headline answer, not a legend for a table.
            It renders its own skeleton rather than being gated behind the
            loading flag, so the panel holds its space from first paint and the
            figures fade in where the placeholders were. */}
        {activeView === "main" && (heroLoading || allocation.length > 0) && (
          <div className="max-w-3xl pt-1">
            <CompositionPanel
              slices={allocation}
              total={onChainTotal}
              chains={fundedChains}
              loading={heroLoading}
            />
          </div>
        )}

        {/* The verbs. These were two prose cards stranded in a sidebar; they
            open the real money-flow modal instead of walking to a full page. */}
        <AssetsActions />

        {/* Divider + Chain selector — shown when Main tab is active */}
        {activeView === "main" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div ref={chainDropdownRef} className="relative">
              <button
                onClick={() => setChainDropdownOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-sunken px-3.5 text-[13px] font-semibold transition-colors hover:bg-accent"
              >
                <img src={activeChain.icon} alt={activeChain.name} className="h-4 w-4 rounded-full" />
                <span>{activeChain.name}</span>
                <HugeiconsIcon icon={ChevronDownIcon} className={`h-3 w-3 text-muted-foreground transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {chainDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-2xl bg-popover py-1 shadow-2xl ring-1 ring-foreground/10">
                  {CHAINS.map((chain) => (
                    <button
                      key={chain.key}
                      onClick={() => { setSelectedChain(chain.key); setChainDropdownOpen(false) }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-accent ${
                        selectedChain === chain.key ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      <img src={chain.icon} alt={chain.name} className="h-4 w-4 rounded-full" />
                      <span>{chain.name}</span>
                      <span className="ml-auto text-[12px] text-muted-foreground/60">{chain.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {displayedAddress && (
              <button
                onClick={() => copy(displayedAddress, activeChain.key)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 font-mono text-[13px] transition-colors ${
                  copied === activeChain.key ? "bg-credit-chip text-credit" : "bg-surface-sunken hover:bg-accent"
                }`}
              >
                <span className={copied === activeChain.key ? "" : "text-muted-foreground"}>{truncAddr(displayedAddress)}</span>
                <HugeiconsIcon
                  icon={copied === activeChain.key ? CheckmarkSquare01Icon : Copy01Icon}
                  className={`h-3.5 w-3.5 ${copied === activeChain.key ? "text-credit" : "text-muted-foreground/60"}`}
                />
                {copied === activeChain.key && <span className="font-sans text-[12px] font-semibold">Copied</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ Assets Table + Funding Sidebar ═══ */}
      <div>
      <CardShell data-onboarding="assets-table">

        {/* ═══ MAIN TAB: On-chain wallet balances ═══ */}
        {activeView === "main" && (
          <>
            {/* CardHeader names the card — no decorative leading icon, per the
                system. Search and Add Token ride on the right. */}
            <CardHeader
              className="flex-wrap"
              title="My Assets"
              subtitle="Every token you hold, on every chain"
              right={
                /* Drops to its own row on narrow screens — sharing one line
                   squeezed the title into a four-word-tall column. */
                <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
                  <div className="relative min-w-0 flex-1 sm:flex-none">
                    <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                    <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tokens…" className="h-8 w-full rounded-full bg-surface-sunken pl-8 pr-3 text-[13px] sm:w-36 outline-none transition-colors placeholder:text-muted-foreground/50 focus:bg-accent" />
                  </div>
                  <button data-onboarding="add-token-btn" onClick={() => setShowAddToken(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" /> Add Token
                  </button>
                </div>
              }
            />
            {/* One pill tab system, and it is never gold — gold is brand,
                primary CTA and active state, not a filter chip. */}
            <div className="scrollbar-none max-w-full overflow-x-auto px-4 pb-3">
              <Segmented
                size="sm"
                options={CHAIN_TABS.map((tab) => ({ key: tab, label: tab }))}
                value={chainTab}
                onChange={setChainTab}
              />
            </div>
            {balancesLoading && onChainBalances.length === 0 ? (
              <SkeletonRows rows={5} label="Loading your assets" />
            ) : fundedTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <HugeiconsIcon icon={Search01Icon} className="mb-2 h-5 w-5 text-muted-foreground/50" />
                <p className="text-xs font-medium text-muted-foreground">No tokens held yet</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">Deposit an asset or refresh after receiving one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2 text-left font-semibold">Asset</th>
                      <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Balance</th>
                      <th className="px-4 py-2 text-right font-semibold">Value</th>
                      <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Share</th>
                      {/* The actions column had no header cell, so every row
                          carried one td more than the thead declared. */}
                      <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/15">
                    {visibleTokens.map((token) => {
                      const chainInfo = CHAINS.find((c) => c.key === token.chain)
                      const bal = getTokenBalance(token)
                      const usdVal = tokenUsd(token, bal)
                      const share = onChainTotal > 0 ? (usdVal / onChainTotal) * 100 : 0
                      const empty = bal <= 0
                      return (
                        <tr key={`${token.chain}-${token.symbol}-${token.contractAddress ?? "native"}`}
                          className="group transition-colors hover:bg-accent/30">
                          {/* Network column dropped: the chain badge already
                              rides on the icon and names itself right here, so
                              a whole column was repeating the sub-label. */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`relative shrink-0 ${empty ? "opacity-50" : ""}`}>
                                <img src={token.icon || getCoinImage(token.symbol) || coinFallback(token.symbol)} alt={token.symbol} className="h-8 w-8 rounded-full"
                                  onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(token.symbol) }} />
                                {chainInfo && (
                                  <img src={chainInfo.icon} alt="" className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                                )}
                              </div>
                              <div className="flex min-w-0 flex-col leading-tight">
                                <span className="font-semibold">{token.symbol}</span>
                                <span className="truncate text-[12px] text-muted-foreground">
                                  {token.name}
                                  {chainInfo && chainInfo.name !== token.name && (
                                    <span className="text-muted-foreground/60"> · {chainInfo.name}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className={`hidden px-4 py-3 text-right font-medium tabular-nums sm:table-cell ${empty ? "text-muted-foreground/50" : ""}`}>
                            {bal > 0 ? bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums ${empty ? "text-muted-foreground/50" : ""}`}>
                            <span className="font-semibold">
                              ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="block text-[12px] text-muted-foreground sm:hidden">
                              {bal > 0 ? bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"}
                            </span>
                          </td>
                          {/* Share ties each row back to the bar up top. */}
                          <td className="hidden px-4 py-3 sm:table-cell">
                            {share > 0 ? (
                              <div className="flex items-center justify-end gap-2">
                                <WeightBar
                                  pct={share}
                                  rank={allocationRank.get(token.symbol) ?? 99}
                                  className="w-20"
                                />
                                <span className="w-11 text-right text-[12px] tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                              </div>
                            ) : (
                              <span className="block text-right text-[12px] text-muted-foreground/40">—</span>
                            )}
                          </td>
                          {/* Actions are quiet until wanted. Twenty-eight
                              always-on text buttons shouted over the numbers;
                              on touch there's no hover, so they stay visible. */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                              <button onClick={() => setReceiveModal({ open: true, asset: {
                                symbol: token.symbol, chain: token.chain, icon: token.icon } })}
                                aria-label={`Receive ${token.symbol}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-credit-chip hover:text-credit">
                                <HugeiconsIcon icon={ArrowDownLeft01Icon} className="h-4 w-4" />
                              </button>
                              {/* Send is only meaningful with something to send. */}
                              {!empty && (
                                <button onClick={() => setSendModal({ open: true, asset: { symbol: token.symbol, name: token.name, balance: bal,
                                  chain: token.chain as SendableAsset["chain"], icon: token.icon, contractAddress: token.contractAddress,
                                  decimals: token.isNative ? undefined : token.decimals } })}
                                  aria-label={`Send ${token.symbol}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-debit-chip hover:text-debit">
                                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* The empty rows are still one tap away. */}
                {emptyCount > 0 && (
                  <button
                    onClick={() => setShowEmpty((v) => !v)}
                    className="w-full border-t border-border/20 px-4 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  >
                    {showEmpty ? "Hide empty balances" : `Show ${emptyCount} empty ${emptyCount === 1 ? "balance" : "balances"}`}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ SPOT TAB: Spot Holdings ═══ */}
        {activeView === "spot" && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold leading-tight">Spot Holdings</h3>
                {(spotLedger.length + spotV2Positions.length) > 0 && (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {spotLedger.filter((b) => b.available + b.locked > 0).length + spotV2Positions.length}
                  </span>
                )}
              </div>
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
                <input type="search" value={spotSearch} onChange={(e) => setSpotSearch(e.target.value)}
                  placeholder="Search assets..." className="w-36 rounded-lg bg-accent/50 pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-accent" />
              </div>
            </div>

            {spotV2Loading ? (
              <SkeletonRows rows={4} label="Loading spot holdings" />
            ) : spotLedger.length === 0 && spotV2Positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <HugeiconsIcon icon={Wallet01Icon} className="mb-2 h-5 w-5 text-muted-foreground/50" />
                <p className="text-xs font-medium text-muted-foreground">No spot holdings</p>
                <p className="text-[10px] text-muted-foreground/70">Deposit or trade to see your holdings here</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border/20 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2 text-left font-medium">Asset</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 text-right font-medium">Available</th>
                      <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Entry Price</th>
                      <th className="px-4 py-2 text-right font-medium">Value</th>
                      <th className="px-4 py-2 text-right font-medium">PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {/* USDC balance rows */}
                    {spotLedger.filter((b) => (b.available + b.locked > 0) && (!spotSearch || b.token.toLowerCase().includes(spotSearch.toLowerCase()))).map((b) => (
                      <tr key={b.token} className="transition-colors hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <img src="https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" alt="USDC" className="h-7 w-7 shrink-0 rounded-full object-contain" />
                            <div>
                              <span className="font-medium">{b.token}</span>
                              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Spot Balance</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {(b.available + b.locked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {b.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">$1.00</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          ${(b.available + b.locked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs text-muted-foreground">—</span>
                        </td>
                      </tr>
                    ))}
                    {/* Token position rows */}
                    {spotV2Positions.filter((p) => !spotSearch || p.token.toLowerCase().includes(spotSearch.toLowerCase())).map((p) => {
                      const currentValue = p.quantity * p.currentPrice
                      const costBasis = p.quantity * p.avgEntryPrice
                      const pnl = currentValue - costBasis
                      const pnlPercent = share(pnl, costBasis)
                      const isProfit = pnl >= 0
                      return (
                        <tr key={p.token} className="transition-colors hover:bg-accent/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {getCoinImage(p.token) ? (
                                <img
                                  src={getCoinImage(p.token)}
                                  alt={p.token}
                                  className="h-7 w-7 shrink-0 rounded-full object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(p.token) }}
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                  {p.token.slice(0, 3)}
                                </div>
                              )}
                              <div>
                                <span className="font-medium">{p.token}</span>
                                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Spot</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {p.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                            {p.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                            ${p.avgEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: p.avgEntryPrice < 1 ? 6 : 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-xs font-medium tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                                {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-[10px] tabular-nums ${isProfit ? "text-credit/70" : "text-debit/70"}`}>
                                {isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ Spot Markets (below holdings, Spot tab only) ═══ */}
        {activeView === "spot" && (
          <>
            <div className="mx-4 h-px bg-border/30" />
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold leading-tight">Spot Markets</h3>
                {spotMarkets.length > 0 && (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{spotMarkets.length}</span>
                )}
              </div>
            </div>
            {spotMarketsLoading ? (
              <SkeletonTable rows={5} cols={4} label="Loading markets" />
            ) : filteredSpotMarkets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <p className="text-xs text-muted-foreground">{spotSearch ? "No markets found" : "No spot markets available"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border/20 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2 text-left font-medium">Pair</th>
                      <th className="px-4 py-2 text-right font-medium">Price</th>
                      <th className="px-4 py-2 text-right font-medium">24h</th>
                      <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Volume</th>
                      <th className="px-4 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredSpotMarkets.map((m) => {
                      const pos = m.change24h >= 0
                      const img = m.image || getCoinImage(m.symbol)
                      return (
                        <tr key={m.id} className="transition-colors hover:bg-accent/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {img ? (
                                <img src={img} alt={m.symbol} className="h-7 w-7 rounded-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(m.symbol) }} />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/50 text-[10px] font-bold">{m.symbol.slice(0, 2)}</div>
                              )}
                              <div>
                                <span className="font-medium">{m.displaySymbol || `${m.symbol}/USDC`}</span>
                                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{m.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            ${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: m.price < 1 ? 6 : 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-medium tabular-nums ${pos ? "text-credit" : "text-debit"}`}>
                              {pctSigned(m.change24h)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                            {numOr(m.volume24h) > 0 ? usdCompact(m.volume24h) : UNKNOWN}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => router.push(`/trade?symbol=${m.symbol}`)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary">
                              Trade <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ FUTURES TAB: the venue is not open yet ═══ */}
        {/* GATE - this single panel replaces BOTH futures sections below
            (Open Positions and Futures Contracts). One message rather than
            two stacked ones, and no blurred live money behind it: there is
            nothing here to preview yet, only something to announce.
            TO RE-OPEN: delete this block. */}
        {futuresClosed && <ComingSoon compact />}

        {/* ═══ FUTURES TAB: Open Positions ═══ */}
        {/* GATE - futures is not open yet, so the panel above stands in for
            this section. `&& !FUTURES_CLOSED` is the ONLY change here;
            everything inside is verbatim and still type-checked.
            TO RE-OPEN: delete `&& !FUTURES_CLOSED`. */}
        {activeView === "futures" && !FUTURES_CLOSED && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={ChartLineData01Icon} className="h-4 w-4 text-amber-500" />
                <h3 className="text-[15px] font-semibold leading-tight">Open Positions</h3>
                {hlPositions.length > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    {hlPositions.length}
                  </span>
                )}
              </div>
              {/* GATE - futures is not open yet, so this must not route into a
                  closed venue. It also loses its gold: primary is an
                  invitation, and this is the opposite of one. TO RE-OPEN:
                  restore the <a href="/trade?market=futures"> with
                  "text-primary hover:underline" and the ArrowUpRight01Icon. */}
              <span
                title={FUTURES_SOON_TITLE}
                className="inline-flex cursor-not-allowed items-center gap-1.5 text-xs font-medium text-muted-foreground/45"
              >
                Trade Futures
                <SoonBadge />
              </span>
            </div>

            {hlPositionsLoading ? (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <p className="mt-2 text-xs text-muted-foreground">Loading positions...</p>
              </div>
            ) : hlPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <HugeiconsIcon icon={ChartLineData01Icon} className="mb-2 h-5 w-5 text-muted-foreground/50" />
                <p className="text-xs font-medium text-muted-foreground">No open positions</p>
                <p className="text-[10px] text-muted-foreground/70">Open a futures trade to see your positions here</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border/20 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2 text-left font-medium">Contract</th>
                      <th className="px-4 py-2 text-right font-medium">Size</th>
                      <th className="px-4 py-2 text-right font-medium">Entry</th>
                      <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Liq. Price</th>
                      <th className="px-4 py-2 text-right font-medium">Value</th>
                      <th className="px-4 py-2 text-right font-medium">PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {hlPositions.map((pos) => {
                      const size = parseFloat(pos.szi)
                      const isLong = size > 0
                      /* These arrive as strings and are routinely absent on a
                         freshly-opened position. parseFloat(undefined) is NaN,
                         and "NaN%" set in credit green beside real money is the
                         fastest way to make every other figure look unreliable. */
                      const pnl = numOr(pos.unrealizedPnl, 0)
                      const roe = numOr(pos.returnOnEquity, 0) * 100
                      const isProfit = pnl >= 0
                      const lev = pos.leverage ? `${pos.leverage.value}×` : "—"
                      return (
                        <tr key={pos.coin} className="transition-colors hover:bg-accent/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded text-[9px] font-bold ${isLong ? "bg-credit-chip text-credit ring-1 ring-emerald-500/20" : "bg-debit-chip text-debit ring-1 ring-red-500/20"}`}>
                                {isLong ? "L" : "S"}
                              </span>
                              {getCoinImage(pos.coin) ? (
                                <img
                                  src={getCoinImage(pos.coin)}
                                  alt={pos.coin}
                                  className="h-6 w-6 shrink-0 rounded-full object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(pos.coin) }}
                                />
                              ) : null}
                              <div>
                                <span className="font-medium">{pos.coin}-PERP</span>
                                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{lev} Leverage</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {Math.abs(size).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                            ${parseFloat(pos.entryPx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: parseFloat(pos.entryPx) < 1 ? 6 : 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                            {pos.liquidationPx ? `$${parseFloat(pos.liquidationPx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            ${parseFloat(pos.positionValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-xs font-medium tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                                {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-[10px] tabular-nums ${isProfit ? "text-credit/70" : "text-debit/70"}`}>
                                {isProfit ? "+" : ""}{roe.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ Futures Markets (below positions, Futures tab only) ═══ */}
        {/* GATE - futures is not open yet, so the panel above stands in for
            this section. `&& !FUTURES_CLOSED` is the ONLY change here;
            everything inside is verbatim and still type-checked.
            TO RE-OPEN: delete `&& !FUTURES_CLOSED`. */}
        {activeView === "futures" && !FUTURES_CLOSED && (
          <>
            <div className="mx-4 h-px bg-border/30" />
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={ChartLineData01Icon} className="h-4 w-4 text-amber-500" />
                <h3 className="text-[15px] font-semibold leading-tight">Futures Contracts</h3>
                {futuresMarkets.length > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">{futuresMarkets.length}</span>
                )}
              </div>
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
                <input type="search" value={futuresSearch} onChange={(e) => setFuturesSearch(e.target.value)}
                  placeholder="Search contracts..." className="w-36 rounded-lg bg-accent/50 pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-accent" />
              </div>
            </div>
            {futuresMarketsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : filteredFuturesMarkets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <p className="text-xs text-muted-foreground">{futuresSearch ? "No contracts found" : "No futures markets available"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border/20 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2 text-left font-medium">Contract</th>
                      <th className="px-4 py-2 text-right font-medium">Mark Price</th>
                      <th className="px-4 py-2 text-right font-medium">24h</th>
                      <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Volume</th>
                      <th className="px-4 py-2 text-right font-medium hidden md:table-cell">Funding</th>
                      <th className="px-4 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredFuturesMarkets.map((m) => {
                      const pos = m.change24h >= 0
                      const img = m.image || getCoinImage(m.baseAsset)
                      return (
                        <tr key={m.symbol} className="transition-colors hover:bg-accent/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {img ? (
                                <img src={img} alt={m.baseAsset} className="h-7 w-7 rounded-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(m.baseAsset) }} />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-600">{m.baseAsset.slice(0, 2)}</div>
                              )}
                              <div>
                                <span className="font-medium">{m.symbol}</span>
                                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Perpetual · {m.maxLeverage}× max</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            ${m.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: m.markPrice < 1 ? 6 : 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-medium tabular-nums ${pos ? "text-credit" : "text-debit"}`}>
                              {pctSigned(m.change24h)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                            {numOr(m.volume24h) > 0 ? usdCompact(m.volume24h) : UNKNOWN}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden md:table-cell">
                            <span className={m.fundingRate >= 0 ? "text-credit" : "text-debit"}>
                              {pctSigned(numOr(m.fundingRate) * 100, 4)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {/* GATE - futures is not open yet: no route into a
                                closed venue. TO RE-OPEN: restore
                                onClick={() => router.push(`/trade?market=futures&symbol=${m.baseAsset}`)},
                                the hover classes and the ArrowUpRight01Icon. */}
                            <button type="button" disabled title={FUTURES_SOON_TITLE}
                              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-muted-foreground/45 ring-1 ring-border/50">
                              Trade <SoonBadge />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardShell>
      </div>

      {/* Add Token lost its mount in the layout rewrite: the button still set
          the state, nothing read it, and the control did nothing at all. */}
      <AddTokenModal open={showAddToken} onClose={() => setShowAddToken(false)} />
      {/* Keep the asset on close: clearing it in the same tick unmounts the
          modal's content before the exit animation can play it out. */}
      <SendModal open={sendModal.open} onClose={() => setSendModal((m) => ({ ...m, open: false }))} asset={sendModal.asset} />
      <ReceiveModal open={receiveModal.open} onClose={() => setReceiveModal((m) => ({ ...m, open: false }))} asset={receiveModal.asset} />
    </div>
  )
}
