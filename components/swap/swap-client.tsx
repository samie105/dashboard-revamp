"use client"

/**
 * The swap ticket — one component, two genuinely different screens.
 *
 * From the 2026-09-03 product review: "the Pro should actually look like
 * something that a pro will use... but the simple should be accustomed to
 * someone that is new to crypto so they can be able to swap easily without any
 * problems." And the warning that cuts the other way: "if you make it overly
 * simple, then people that actually trade will not find it usable."
 *
 * So Simple is not Pro with rows hidden. Simple answers exactly one question —
 * what do I get — in dollars, in one figure, with one button. Pro shows the
 * quote's working: the venue it fills on, the price impact, the minimum it
 * guarantees, the rate both ways, a countdown to the next price, a slippage
 * tolerance the trader sets, and the pair's recent rate above the ticket.
 *
 * What Simple hides it still APPLIES. Slippage protection is on at the house
 * default and the quote still refreshes on the same clock; the only thing
 * Simple removes is the dial, not the guard.
 *
 * This same component is the dashboard's swap panel (`compact`). The panel
 * honours the mode too — Simple is identical, Pro carries the controls that
 * fit a small card plus a way through to the full page. Both surfaces read
 * `swapView`, so they cannot drift apart in what a mode MEANS. Where they do
 * differ is which mode each one starts in, and why: see `compactMode` below.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Exchange01Icon,
  Loading03Icon,
  Search01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"

import { CardShell, CardHeader, EmptyState, SkeletonRows, PageHeader, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ModeSwitch } from "@/components/ui/mode-switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/error-state"
import { useUiMode } from "@/components/ui-mode-provider"
import { swapView } from "@/lib/swap-view"
import type { UiMode } from "@/lib/ui-mode"
import { cn } from "@/lib/utils"
import { num, qty, usd } from "@/lib/num"
import type { CoinData } from "@/lib/actions"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled, CryptoBackendError } from "@/lib/crypto-backend"
import { signEvmIntent, signSolanaIntent, signSuiIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"

import { QuoteDetail, SlippageField } from "./quote-detail"
import { SwapRateChart } from "./rate-chart"
import {
  BALANCE_NETWORK_ID,
  CHAINS,
  HOUSE_SLIPPAGE,
  QUOTE_TTL_SECONDS,
  SUPPORTED_SWAP_TOKENS,
  chainMeta,
  familyFor,
  isRoutable,
  networkIdFor,
  tokensForChain,
  type QuoteData,
} from "./swap-model"

/* ── Token Select Modal ── */
function TokenSelectModal({
  open,
  onClose,
  coins,
  onSelect,
  exclude,
}: {
  open: boolean
  onClose: () => void
  coins: CoinData[]
  onSelect: (coin: CoinData) => void
  exclude?: string
}) {
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  if (!open) return null

  const filtered = coins.filter((c) => {
    if (c.symbol === exclude) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  const popular = ["BTC", "ETH", "SOL", "USDT", "USDC", "XRP"]

  return (
    <div className="ws-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md">
      <div ref={ref} className="ws-modal-in ws-glass ws-glass-edge relative w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b border-border/30 p-4">
          <h3 className="text-sm font-semibold">Choose a coin</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol..."
              className="h-11 w-full rounded-xl bg-accent/50 pl-9 pr-3 text-sm outline-none focus:bg-accent"
            />
          </div>

          {/* Popular tokens */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {popular.map((sym) => {
              const coin = coins.find((c) => c.symbol === sym)
              if (!coin || coin.symbol === exclude) return null
              return (
                <button
                  key={sym}
                  onClick={() => { onSelect(coin); onClose() }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <CoinAvatar symbol={sym} size="sm" />
                  {sym}
                </button>
              )
            })}
          </div>

          {/* Token list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No coins match that</p>
            ) : (
              filtered.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => { onSelect(coin); onClose() }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <CoinAvatar symbol={coin.symbol} size="lg" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{coin.name}</span>
                    <span className="text-xs text-muted-foreground">{coin.symbol}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    ${coin.price.toLocaleString(undefined, { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Swap History ── */
interface SwapTx {
  id: string
  /** Always present on a unified row — the asset the movement is denominated
   *  in. The from/to pair below is swap-specific and often missing. */
  token?: string
  fromToken?: string
  toToken?: string
  amount: number
  toAmount?: string
  fromChain?: string
  toChain?: string
  status: string
  txHash?: string
  createdAt: string
}

function SwapHistory() {
  const [swaps, setSwaps] = React.useState<SwapTx[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/transactions/unified?type=swap&limit=10")
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        if (!cancelled) setSwaps(data.transactions ?? [])
      } catch {
        // silent — show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /* Status washes match the transactions page: one vocabulary for state across
     the product, rather than a per-screen palette. */
  const statusChip = (st: string) => {
    switch (st) {
      case "completed": return "bg-credit-chip text-credit"
      case "failed": return "bg-debit-chip text-debit"
      case "cancelled":
      case "expired": return "bg-foreground/[0.06] text-muted-foreground"
      default: return "bg-warning-chip text-warning"
    }
  }

  const statusLabel = (st: string) => {
    switch (st) {
      case "completed": return "Completed"
      case "failed": return "Failed"
      case "pending": return "Pending"
      case "cancelled": return "Cancelled"
      default: return "Processing"
    }
  }

  /* The unified transaction row always carries `token`; `fromToken`/`toToken`
     are swap-specific and frequently absent. Reading only the optional pair
     rendered every row as a literal "? → ?" — a question mark is not a token,
     and printing one tells the reader their swap history is broken when it
     isn't. Fall back to what the row does carry, and say nothing about the
     half we genuinely don't know. */
  const pairOf = (tx: SwapTx) => {
    const from = tx.fromToken ?? tx.token
    const to = tx.toToken
    if (from && to) return `${from} → ${to}`
    if (from) return `${from} swap`
    return "Swap"
  }

  return (
    <CardShell>
      <CardHeader title="Recent swaps" subtitle="Your last ten conversions" />

      {loading ? (
        <SkeletonRows rows={3} label="Loading swap history" />
      ) : swaps.length === 0 ? (
        <EmptyState
          icon={({ className }) => <HugeiconsIcon icon={Exchange01Icon} className={className} />}
          title="No swaps yet"
          description="Conversions you make here will be listed with their status."
        />
      ) : (
        <div className="flex flex-col divide-y divide-border/10">
          {swaps.map((tx) => {
            const from = tx.fromToken ?? tx.token
            const received = tx.toAmount != null ? num(tx.toAmount) : null
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                {from ? (
                  <CoinAvatar symbol={from} size="lg" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
                    <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{pairOf(tx)}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    {[
                      tx.fromChain && tx.toChain ? `${tx.fromChain} → ${tx.toChain}` : tx.fromChain,
                      new Date(tx.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[13px] font-semibold tabular-nums">
                    {qty(tx.amount)}
                    {received !== null ? ` → ${qty(received)}` : ""}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${statusChip(tx.status)}`}
                  >
                    {statusLabel(tx.status)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

/* ── Ticket controls ─────────────────────────────────────────────────────
   Both shapes of the ticket use the same coin and chain pickers, so they are
   defined once rather than written twice with a chance to drift. ────────── */

function CoinButton({
  coin,
  onClick,
  side,
}: {
  coin: CoinData | null
  onClick: () => void
  side: "pay" | "receive"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={coin ? `${coin.symbol} — choose a different coin to ${side}` : `Choose a coin to ${side}`}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent pl-2 pr-2.5 transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {coin ? (
        <>
          <CoinAvatar symbol={coin.symbol} size="md" />
          <span className="text-[13px] font-semibold">{coin.symbol}</span>
        </>
      ) : (
        <span className="pl-1 text-[13px] text-muted-foreground">Choose</span>
      )}
      <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  )
}

function ChainButton({ chain, onCycle }: { chain: string; onCycle: () => void }) {
  const meta = chainMeta(chain)
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Currently ${meta.label}. Choose another.`}
      title={`Currently ${meta.label} — tap to change`}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground sm:h-8"
    >
      {meta.icon && <img src={meta.icon} alt="" className="h-3.5 w-3.5 rounded-full" />}
      {meta.label}
      <HugeiconsIcon icon={ArrowDown01Icon} className="h-2.5 w-2.5" />
    </button>
  )
}

/* ── The dashboard card's own Simple/Pro switch ──
   Same control as `ModeSwitch` — `Segmented`, `sm`, never gold, one tab
   system — but CONTROLLED by the caller instead of reading the shared
   preference, because the card owns its mode for the visit rather than
   speaking for every screen. Its Vivid prefix differs from `ui-mode` for the
   same reason: pressing this does not change the preference, and the
   assistant should not believe it does. */
const CARD_MODE_OPTIONS = [
  { key: "simple" as const, label: "Simple" },
  { key: "pro" as const, label: "Pro" },
]

function CardModeSwitch({
  value,
  onChange,
  className,
}: {
  value: UiMode
  onChange: (mode: UiMode) => void
  className?: string
}) {
  return (
    <div className={className}>
      <span className="sr-only">How much detail this card shows</span>
      <Segmented<UiMode>
        size="sm"
        value={value}
        onChange={onChange}
        options={CARD_MODE_OPTIONS}
        vividPrefix="swap-card-mode"
      />
    </div>
  )
}

/* ── Main SwapClient ── */
interface SwapClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
  compact?: boolean
}

function shortTransactionHash(hash?: string) {
  return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "pending confirmation"
}

export function SwapClient({ coins, prices, error, compact }: SwapClientProps) {
  const available = React.useMemo(() => coins.filter((c) => c.price > 0), [coins])
  const sharedUiMode = useUiMode()

  /**
   * Which mode this ticket is in — and the one place the two surfaces differ.
   *
   * The full /swap page reads and writes the SHARED Simple/Pro preference,
   * which is right for it: someone who picks Pro on the trade workspace
   * should find /swap in Pro too, and should still find it there tomorrow.
   *
   * The dashboard panel does not. It starts in Simple on every mount, and its
   * switch writes to this local state only — never to the shared preference.
   * From the owner call of 2026-09-03: "the swap card that is on the
   * dashboard should by default be on the simple setting, not on the pro."
   * The dashboard is a glance surface, not a workspace, and under the shared
   * preference the moment anyone tried Pro anywhere the home screen turned
   * into a trading terminal and stayed that way.
   *
   * Nothing is taken away: the switch is still on the card, so Pro is one
   * press from the dashboard for anyone who wants the detail. That choice
   * simply belongs to this card for this visit.
   *
   * The trade-off is real, and stating it here is the point — otherwise the
   * next reader will "fix" it. The SAME control now behaves differently in
   * two places: the card forgets on every load, the page remembers. That is
   * deliberate. They are different kinds of surface, the owner asked for this
   * behaviour on this card, and the alternative — a glance-surface toggle
   * silently reconfiguring the trade workspace — is a worse surprise than the
   * inconsistency it would remove.
   *
   * Both branches derive the view through `swapView(mode)`, so the two
   * surfaces still cannot disagree about what Simple or Pro MEANS. They
   * disagree only about which one they open in.
   */
  const [compactMode, setCompactMode] = React.useState<UiMode>("simple")
  const mode = compact ? compactMode : sharedUiMode.mode
  const isSimple = mode === "simple"
  const view = React.useMemo(() => swapView(mode), [mode])

  const { user } = useAuth()
  const { balances: modernBalances } = useCryptoBalances()
  const modernWallet = useCryptoWalletState()
  const modernPackage = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(modernWallet.data),
    staleTime: 3 * 60_000,
  })

  // URL params
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(null)
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search))
  }, [])

  const initFrom = searchParams?.get("from") || "USDT"
  const initTo = searchParams?.get("to") || "ETH"
  const initAmount = searchParams?.get("amount") || ""

  // State
  const [fromCoin, setFromCoin] = React.useState<CoinData | null>(null)
  const [toCoin, setToCoin] = React.useState<CoinData | null>(null)
  const [fromAmount, setFromAmount] = React.useState(initAmount)
  const [slippage, setSlippage] = React.useState(HOUSE_SLIPPAGE)
  const [showFromModal, setShowFromModal] = React.useState(false)
  const [showToModal, setShowToModal] = React.useState(false)
  const [fromChain, setFromChain] = React.useState("ethereum")
  const [toChain, setToChain] = React.useState("ethereum")
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const [isDollarMode, setIsDollarMode] = React.useState(false)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)
  const swapIdempotencyKey = React.useRef<string | null>(null)

  // Initialize from URL / defaults
  React.useEffect(() => {
    if (available.length > 0) {
      if (!fromCoin) {
        const fc = available.find((c) => c.symbol === initFrom) || available[0]
        setFromCoin(fc)
      }
      if (!toCoin) {
        const tc = available.find((c) => c.symbol === initTo) || available[1]
        setToCoin(tc)
      }
    }
  }, [available, initFrom, initTo, fromCoin, toCoin])

  // Real quote from the routing service
  const [quoteData, setQuoteData] = React.useState<QuoteData | null>(null)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [swapLoading, setSwapLoading] = React.useState(false)
  const [swapResult, setSwapResult] = React.useState<{ success: boolean; txHash?: string; error?: string; status?: string } | null>(null)

  // A token belongs to the chain selected beside it. Keep this derived rather
  // than passing the global market list to both dialogs; otherwise BTC/ETH/etc.
  // can appear under a chain where the asset cannot be signed or routed.
  const fromCoins = React.useMemo(() => tokensForChain(fromChain, available), [fromChain, available])
  const toCoins = React.useMemo(() => tokensForChain(toChain, available), [toChain, available])

  React.useEffect(() => {
    if (fromCoin && !fromCoins.some((coin) => coin.symbol.toUpperCase() === fromCoin.symbol.toUpperCase())) {
      setFromCoin(fromCoins[0] ?? null)
      setFromAmount("")
    }
  }, [fromCoin, fromCoins])

  React.useEffect(() => {
    if (toCoin && !toCoins.some((coin) => coin.symbol.toUpperCase() === toCoin.symbol.toUpperCase())) {
      setToCoin(toCoins.find((coin) => coin.symbol !== fromCoin?.symbol) ?? null)
    }
  }, [toCoin, toCoins, fromCoin?.symbol])

  /* The price clock. `quotedAt` is when the live quote landed; bumping
     `refreshNonce` is how anything — the countdown running out, or the trader
     pressing refresh — asks for a new one. */
  const [refreshNonce, setRefreshNonce] = React.useState(0)
  const [quotedAt, setQuotedAt] = React.useState<number | null>(null)
  const [nowMs, setNowMs] = React.useState<number | null>(null)
  const quoteDebounceMs = React.useRef(600)

  const fromPrice = fromCoin ? (prices[fromCoin.symbol] ?? fromCoin.price) : 0
  const toPrice = toCoin ? (prices[toCoin.symbol] ?? toCoin.price) : 0

  /* Simple denominates the amount in DOLLARS, full stop — it is the unit
     someone new to this thinks in, and a field that silently means "tokens"
     is the easiest way to type a number two orders of magnitude off. Coming
     from Pro with a token amount typed, convert it so the digits keep meaning
     the same money instead of quietly changing what they are worth. */
  React.useEffect(() => {
    if (view.unitSwitch || isDollarMode) return
    const raw = parseFloat(fromAmount) || 0
    // Wait for a price before flipping the unit. Flipping first and converting
    // when the feed arrives is how "0.5 ETH" quietly becomes "$0.50".
    if (raw > 0 && fromPrice <= 0) return
    setIsDollarMode(true)
    if (raw > 0) setFromAmount((raw * fromPrice).toFixed(2))
  }, [view.unitSwitch, isDollarMode, fromAmount, fromPrice])

  // In dollar mode, fromAmount is USD; convert to token quantity for calculations
  const tokenAmount = isDollarMode && fromPrice > 0
    ? (parseFloat(fromAmount) || 0) / fromPrice
    : parseFloat(fromAmount) || 0
  const numericFrom = tokenAmount
  /* Before a real quote lands there is still a number worth showing, derived
     from the two live prices. It is indicative only, and nothing can be
     submitted on it — the button gates on `executionData` from the quote, not
     on this. Once the quote arrives it replaces this outright. */
  const estimatedToFallback = toPrice > 0 ? (numericFrom * fromPrice) / toPrice : 0
  const estimatedTo = quoteData?.toAmount
    ? parseFloat(quoteData.toAmount) / Math.pow(10, quoteData.toToken.decimals)
    : estimatedToFallback
  const usdValue = numericFrom * fromPrice

  // Look up the wallet balance for the "from" coin on the selected chain.
  const fromCoinBalance = React.useMemo(() => {
    if (!fromCoin) return 0
    const networkId = BALANCE_NETWORK_ID[fromChain]
    if (!networkId) return 0
    return modernBalances
      .filter((b) => b.symbol.toUpperCase() === fromCoin.symbol.toUpperCase() && b.networkId === networkId)
      .reduce((sum, b) => sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)), 0)
  }, [modernBalances, fromCoin, fromChain])

  // Can this pair be quoted and executed at all?
  const fromSupported = SUPPORTED_SWAP_TOKENS[fromChain]?.includes(fromCoin?.symbol ?? "") ?? false
  const toSupported = SUPPORTED_SWAP_TOKENS[toChain]?.includes(toCoin?.symbol ?? "") ?? false
  const routable = isRoutable(fromChain) && isRoutable(toChain)
  const canQuote = fromSupported && toSupported && routable && isCryptoBackendEnabled

  /* Simple has no slippage dial. It is not therefore unprotected: the house
     default rides on every quote and every intent it sends. */
  const effectiveSlippage = view.slippageControl ? slippage : HOUSE_SLIPPAGE

  // Fetch the quote on amount/token/chain/slippage change, and on refresh.
  React.useEffect(() => {
    const delay = quoteDebounceMs.current
    quoteDebounceMs.current = 600

    if (numericFrom <= 0 || !fromCoin || !toCoin || !canQuote) {
      swapIdempotencyKey.current = null
      setQuoteData(null)
      setQuoteError(null)
      setQuoteLoading(false)
      setQuotedAt(null)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      const qs = new URLSearchParams({
        fromChain,
        toChain,
        fromToken: fromCoin.symbol,
        toToken: toCoin.symbol,
        amount: numericFrom.toString(),
        slippage: (effectiveSlippage / 100).toString(),
      })
      fetch(`/api/crypto/trading/spot/lifi/quote?${qs}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.quote) {
            setQuoteData(data.quote)
            setQuoteError(null)
            setQuotedAt(Date.now())
          } else {
            setQuoteData(null)
            setQuoteError(data.error || "Failed to get quote")
            setQuotedAt(null)
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setQuoteError("Quote request failed")
            setQuotedAt(null)
          }
        })
        .finally(() => setQuoteLoading(false))
    }, delay)
    return () => { clearTimeout(timeout); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, fromCoin?.symbol, toCoin?.symbol, fromChain, toChain, effectiveSlippage, numericFrom, canQuote, refreshNonce])

  // For non-supported pairs, fall back to client-side estimate
  React.useEffect(() => {
    if (!canQuote && numericFrom > 0 && fromCoin && toCoin) {
      setQuoteLoading(true)
      const t = setTimeout(() => setQuoteLoading(false), 300)
      return () => clearTimeout(t)
    }
  }, [canQuote, numericFrom, fromCoin, toCoin, fromAmount])

  /* A quote goes stale whether or not anyone is watching a countdown, so the
     re-fetch runs in BOTH modes. Only Pro is shown the clock. It pauses while
     a swap is being confirmed — moving the price out from under a submission
     in flight would be the opposite of helpful. */
  React.useEffect(() => {
    if (quotedAt === null || swapLoading) return
    const remaining = QUOTE_TTL_SECONDS * 1000 - (Date.now() - quotedAt)
    const id = setTimeout(() => setRefreshNonce((n) => n + 1), Math.max(0, remaining))
    return () => clearTimeout(id)
  }, [quotedAt, swapLoading])

  // The per-second tick exists only to draw the countdown, so it only runs
  // when the countdown is on screen.
  React.useEffect(() => {
    if (!view.quoteRefresh || quotedAt === null) {
      setNowMs(null)
      return
    }
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [view.quoteRefresh, quotedAt])

  const secondsLeft =
    quotedAt !== null && nowMs !== null
      ? Math.max(0, QUOTE_TTL_SECONDS - Math.floor((nowMs - quotedAt) / 1000))
      : null

  const requestFreshQuote = React.useCallback(() => {
    quoteDebounceMs.current = 0
    setRefreshNonce((n) => n + 1)
  }, [])

  /* A first quote has nothing to show yet, so it gets a skeleton. A REFRESH
     has last quote still on screen — blanking it every thirty seconds would
     make the ticket flicker for no gain, so it dims instead. */
  const loadingFirstQuote = quoteLoading && quoteData === null
  const refreshingQuote = quoteLoading && quoteData !== null

  // Execute the swap through an unsigned intent. The quote is only routing
  // data; it never authorizes a server-side approval.
  const handleSwap = React.useCallback(async () => {
    if (!quoteData?.executionData || swapLoading) return
    setSwapLoading(true)
    setSwapResult(null)
    try {
      if (!user?.userId || !modernWallet.data?.id || !modernPackage.data) throw new Error("Set up your new wallet before swapping")
      if (!isRoutable(fromChain) || !isRoutable(toChain)) throw new Error("This pair isn't available yet")
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) {
        resumeAfterUnlock.current = () => void handleSwap()
        setUnlockOpen(true)
        return
      }
      const sourceFamily = familyFor(fromChain)
      const account = modernWallet.data.accounts.find((item) => item.chainFamily === sourceFamily && item.state === "active")
      if (!account?.id) throw new Error(`Your wallet isn't ready for ${chainMeta(fromChain).label} yet`)
      const amountBaseUnits = toBaseUnits(String(numericFrom), quoteData.fromToken.decimals)
      if (!amountBaseUnits || amountBaseUnits === "0") throw new Error("The amount is too small for this coin")
      const idempotencyKey = swapIdempotencyKey.current ?? (swapIdempotencyKey.current = crypto.randomUUID())
      const intent = await cryptoBackendClient.createModernLifiSwapIntent({
        sourceNetworkId: networkIdFor(fromChain),
        destinationNetworkId: networkIdFor(toChain),
        sellToken: quoteData.fromToken.address,
        buyToken: quoteData.toToken.address,
        sellAmountBaseUnits: amountBaseUnits,
        slippagePercentage: effectiveSlippage / 100,
        idempotencyKey,
      })
      const signed = sourceFamily === "solana"
        ? await signSolanaIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
        : sourceFamily === "sui"
          ? await signSuiIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
          : await signEvmIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
      const submitted = await cryptoBackendClient.submitIntent(intent.id, signed)
      setSwapResult({ success: true, status: "PENDING", txHash: submitted.txHash })
      swapIdempotencyKey.current = null
      setFromAmount(""); setQuoteData(null); setQuotedAt(null)
    } catch (error) {
      const message = error instanceof CryptoBackendError && error.code === "INSUFFICIENT_FUNDS"
        ? "Not enough SOL to cover this swap and its fee. Top up SOL, then get a fresh price."
        : error instanceof Error ? error.message : "Swap failed"
      setSwapResult({ success: false, error: message })
    } finally {
      setSwapLoading(false)
    }
  }, [quoteData, swapLoading, numericFrom, effectiveSlippage, user, modernWallet.data, modernPackage.data, fromChain, toChain])

  function flipPair() {
    const tmpCoin = fromCoin
    const tmpChain = fromChain
    setFromCoin(toCoin)
    setToCoin(tmpCoin)
    setFromChain(toChain)
    setToChain(tmpChain)
    setFromAmount("")
    // Simple is always denominated in dollars; Pro starts a fresh pair in the
    // coin's own units, which is what a trader sizing a position wants.
    setIsDollarMode(!view.unitSwitch)
  }

  function cycleChain(current: string, set: (next: string) => void) {
    const index = CHAINS.findIndex((c) => c.id === current)
    set(CHAINS[(index + 1) % CHAINS.length].id)
  }

  function setPercentage(pct: number) {
    if (fromCoinBalance <= 0) return
    const tokenAmt = fromCoinBalance * pct
    if (isDollarMode && fromPrice > 0) {
      setFromAmount((tokenAmt * fromPrice).toFixed(2))
    } else {
      setFromAmount(tokenAmt.toPrecision(6).replace(/\.?0+$/, ""))
    }
  }

  const insufficientBalance = numericFrom > 0 && fromCoinBalance > 0 && numericFrom > fromCoinBalance
  // Unsupported pairs have no execution path — the button must say so, not
  // sit enabled doing nothing on click.
  const canSwap = numericFrom > 0 && !!fromCoin && !!toCoin && !quoteLoading && !swapLoading && !insufficientBalance && canQuote && !!quoteData?.executionData

  /* One button, two vocabularies. Pro is told "no route found" because that is
     the real name for what happened and it tells a trader where to look next;
     Simple is told the price is not available, because "route" is a word about
     our plumbing and not about their money. */
  const buttonText = React.useMemo(() => {
    if (!fromCoin || !toCoin) return "Choose two coins"
    if (!canQuote) return "This pair isn't available yet"
    if (!fromAmount || numericFrom <= 0) return "Enter an amount"
    if (insufficientBalance) return isSimple ? `Not enough ${fromCoin.symbol}` : "Insufficient balance"
    if (swapLoading) return "Confirming…"
    if (loadingFirstQuote) return isSimple ? "Checking the price…" : "Fetching quote…"
    if (quoteError) return isSimple ? "Price unavailable right now" : "Quote unavailable"
    if (!quoteData?.executionData) return isSimple ? "No price available right now" : "No route found"
    return "Swap"
  }, [fromCoin, toCoin, fromAmount, numericFrom, loadingFirstQuote, swapLoading, insufficientBalance, quoteError, canQuote, quoteData, isSimple])

  /* ── The pay block ─────────────────────────────────────────────────── */

  const payBlock = isSimple ? (
    <div className="rounded-2xl bg-surface-sunken/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">You pay</span>
        {fromCoinBalance > 0 && fromPrice > 0 ? (
          <button
            type="button"
            onClick={() => setPercentage(1)}
            className="-mr-1 rounded-full px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {usd(fromCoinBalance * fromPrice)} available · Use all
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span aria-hidden className="font-display text-[26px] font-light leading-none text-muted-foreground/45">$</span>
        <input
          type="text"
          inputMode="decimal"
          data-vivid-target="swap-amount"
          data-vivid-label="The amount to swap from"
          aria-label="Amount to swap, in dollars"
          value={fromAmount}
          onChange={(e) => {
            const v = e.target.value
            if (/^[0-9]*\.?[0-9]*$/.test(v)) setFromAmount(v)
          }}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent font-display text-[30px] font-light leading-none tabular-nums outline-none placeholder:text-muted-foreground/25"
        />
        <CoinButton coin={fromCoin} side="pay" onClick={() => setShowFromModal(true)} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/20 pt-2.5">
        <span className="min-w-0 truncate text-[11.5px] tabular-nums text-muted-foreground">
          {numericFrom > 0 && fromCoin ? `≈ ${qty(numericFrom, fromCoin.symbol)}` : " "}
        </span>
        <ChainButton chain={fromChain} onCycle={() => cycleChain(fromChain, setFromChain)} />
      </div>
    </div>
  ) : (
    <div className="rounded-2xl bg-surface-sunken/70 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">You pay</span>
        <span className="truncate text-[11px] tabular-nums text-muted-foreground">
          Balance: {qty(fromCoinBalance)}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        {view.unitSwitch && (
          <button
            type="button"
            onClick={() => {
              setIsDollarMode(!isDollarMode)
              const raw = parseFloat(fromAmount) || 0
              if (raw > 0 && fromPrice > 0) {
                // Converting rather than reinterpreting: the digits on screen
                // must keep meaning the same money across the toggle.
                setFromAmount(
                  !isDollarMode
                    ? (raw * fromPrice).toFixed(2)
                    : (raw / fromPrice).toPrecision(6).replace(/\.?0+$/, ""),
                )
              }
            }}
            aria-pressed={isDollarMode}
            aria-label={isDollarMode ? "Enter the amount in coins instead" : "Enter the amount in dollars instead"}
            title={isDollarMode ? "Switch to coin amount" : "Switch to dollar amount"}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold transition-colors sm:h-9 sm:w-9",
              // The active state is the RAISED step, never gold — gold is
              // brand and primary action, and the Swap button is already
              // spending it a few rows down.
              isDollarMode
                ? "bg-accent text-foreground ring-1 ring-foreground/[0.08]"
                : "bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            $
          </button>
        )}
        <input
          type="text"
          inputMode="decimal"
          data-vivid-target="swap-amount"
          data-vivid-label="The amount to swap from"
          aria-label={isDollarMode ? "Amount to swap, in dollars" : "Amount to swap, in coins"}
          value={fromAmount}
          onChange={(e) => {
            const v = e.target.value
            if (/^[0-9]*\.?[0-9]*$/.test(v)) setFromAmount(v)
          }}
          placeholder={isDollarMode ? "$0.00" : "0.00"}
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
        />
        <CoinButton coin={fromCoin} side="pay" onClick={() => setShowFromModal(true)} />
      </div>
      {/* Size the position off the balance — the row a trader reaches for
          before they reach for the keyboard. */}
      <div className="mt-2.5 flex items-center gap-1.5">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => setPercentage(pct)}
            className="h-8 flex-1 rounded-full bg-background/60 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {pct === 1 ? "MAX" : `${pct * 100}%`}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/20 pt-2.5">
        <span className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">
          {isDollarMode
            ? numericFrom > 0 && fromCoin
              ? `≈ ${qty(numericFrom, fromCoin.symbol)}`
              : " "
            : usdValue > 0
              ? `≈ ${usd(usdValue)}`
              : " "}
        </span>
        <ChainButton chain={fromChain} onCycle={() => cycleChain(fromChain, setFromChain)} />
      </div>
    </div>
  )

  /* ── The receive block ─────────────────────────────────────────────── */

  const receiveBlock = (
    <div className={cn("rounded-2xl bg-surface-sunken/70", isSimple ? "p-4" : "p-3.5")}>
      <div className={cn("flex items-center justify-between", isSimple ? "mb-2" : "mb-2.5")}>
        <span className={cn("font-medium text-muted-foreground", isSimple ? "text-[12px]" : "text-[11px]")}>
          You get
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          {loadingFirstQuote ? (
            <Skeleton className={isSimple ? "h-8 w-32" : "h-7 w-28"} />
          ) : (
            <span
              className={cn(
                "block truncate tabular-nums transition-opacity",
                isSimple
                  ? "font-display text-[30px] font-light leading-none"
                  : "text-xl font-semibold",
                estimatedTo > 0 ? "" : "text-muted-foreground/30",
                refreshingQuote && "opacity-55",
              )}
            >
              {estimatedTo > 0 ? qty(estimatedTo) : "0.00"}
            </span>
          )}
        </div>
        <CoinButton coin={toCoin} side="receive" onClick={() => setShowToModal(true)} />
      </div>
      <div className={cn("flex items-center justify-between gap-2 border-t border-border/20", isSimple ? "mt-3 pt-2.5" : "mt-2.5 pt-2.5")}>
        <span className="min-w-0 truncate text-[11.5px] tabular-nums text-muted-foreground">
          {estimatedTo > 0 && toPrice > 0 && !loadingFirstQuote ? `≈ ${usd(estimatedTo * toPrice)}` : " "}
        </span>
        <ChainButton chain={toChain} onCycle={() => cycleChain(toChain, setToChain)} />
      </div>
    </div>
  )

  /* ── The ticket ────────────────────────────────────────────────────── */

  const ticket = (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card/80">
      {/* Neutral corner-light ring — same shell grammar as the other
          dashboard cards (CardShell in ui/system). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl p-px"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent), color-mix(in oklab, var(--foreground) 4%, transparent) 40%, transparent 65%)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
        }}
      />

      {/* The switch belongs to the TICKET, not the page: it changes what this
          card asks of you, so it sits where that change happens. */}
      <div className="flex items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[15px] font-semibold leading-tight">Swap</h2>
          <span className="truncate text-[13px] text-muted-foreground">
            {isSimple ? "Turn one coin into another" : "Live routing, on your terms"}
          </span>
        </div>
        {/* Two switches, one control: the page's writes the shared
            preference, the dashboard card's writes only its own state. See
            `compactMode` for why they are not the same component. */}
        {compact ? (
          <CardModeSwitch className="shrink-0" value={compactMode} onChange={setCompactMode} />
        ) : (
          <ModeSwitch className="shrink-0" />
        )}
      </div>

      <div className="p-4">
        {error && available.length === 0 ? (
          <ErrorState message={error} />
        ) : (
          <>
            {payBlock}

            {/* ── Flip ──
                It used to fill gold on hover. Gold is brand, primary action
                and active state — a secondary icon button lighting up in it is
                decoration, and the Swap button below is where this card spends
                its gold. It lifts on the raised step instead. */}
            <div className="relative z-10 -my-2.5 flex justify-center">
              <button
                type="button"
                onClick={flipPair}
                aria-label="Swap the two coins around"
                title="Swap the two coins around"
                className="rounded-full border-4 border-card bg-accent p-3 text-muted-foreground shadow-sm transition-all hover:scale-110 hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:hover:scale-100 sm:p-2"
              >
                <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5" />
              </button>
            </div>

            {receiveBlock}

            {isSimple ? (
              /* The one thing Simple says about protection. It is not a
                 disclaimer — it describes a guard that is switched on, in the
                 words someone who has never swapped would use. */
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-surface-sunken/40 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                <HugeiconsIcon icon={Shield01Icon} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Prices move while a swap goes through. If this one moves more than {HOUSE_SLIPPAGE}% before yours
                  finishes, we cancel it instead of handing you less.
                </span>
              </p>
            ) : (
              <>
                {view.slippageControl && (
                  <SlippageField className="mt-3" value={slippage} onChange={setSlippage} />
                )}
                {/* Nothing to price until there is an amount, and a lone
                    "no live price yet" row above an empty ticket is furniture
                    rather than information. */}
                {fromCoin && toCoin && numericFrom > 0 && (
                  <QuoteDetail
                    className="mt-3"
                    view={view}
                    quote={quoteData}
                    fromSymbol={fromCoin.symbol}
                    toSymbol={toCoin.symbol}
                    fromChain={fromChain}
                    toChain={toChain}
                    fromAmount={numericFrom}
                    toAmount={estimatedTo}
                    secondsLeft={secondsLeft}
                    refreshing={refreshingQuote}
                    onRefresh={requestFreshQuote}
                    dense={compact}
                  />
                )}
              </>
            )}

            {/* Swap result banner */}
            {swapResult && (
              <div className={`mt-3 rounded-xl p-3 text-xs font-medium ${
                swapResult.success && swapResult.status === "DONE"
                  ? "bg-credit-chip text-credit"
                  : swapResult.success && swapResult.status === "PENDING"
                  ? "bg-warning-chip text-warning"
                  : "bg-debit-chip text-debit"
              }`}>
                {swapResult.success && swapResult.status === "DONE"
                  ? "Swap done. Your new balance will show in a moment."
                  : swapResult.success && swapResult.status === "PENDING"
                  ? `Swap sent — it usually lands within a minute. Safe to leave this page.${
                      isSimple ? "" : ` Reference ${shortTransactionHash(swapResult.txHash)}.`
                    }`
                  : swapResult.error}
              </div>
            )}

            {/* Quote error */}
            {quoteError && !quoteLoading && numericFrom > 0 && (
              <p className="mt-2 text-xs text-warning">
                {isSimple ? "We couldn't price that just now. Try again in a moment." : quoteError}
              </p>
            )}

            {/* ── Swap button ── */}
            <button
              type="button"
              disabled={!canSwap}
              onClick={handleSwap}
              data-vivid-target="swap-submit"
              data-vivid-guard=""
              aria-label="Execute swap"
              data-vivid-label="Execute the swap. Moves real money."
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {(loadingFirstQuote || swapLoading) && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
              {buttonText}
            </button>

            {/* The dashboard panel is too small for the chart and the full
                breakdown, so Pro there ends with the way to the rest of it
                rather than pretending the rest does not exist. */}
            {compact && !isSimple && (
              <div className="mt-3 flex justify-center">
                <a
                  href="/swap"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Rate history and full breakdown
                  <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  const overlays = (
    <>
      <WalletUnlockDialog
        action="swap"
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
      <TokenSelectModal
        open={showFromModal}
        onClose={() => setShowFromModal(false)}
        coins={fromCoins}
        onSelect={setFromCoin}
        exclude={toCoin?.symbol}
      />
      <TokenSelectModal
        open={showToModal}
        onClose={() => setShowToModal(false)}
        coins={toCoins}
        onSelect={setToCoin}
        exclude={fromCoin?.symbol}
      />
    </>
  )

  if (compact) {
    return (
      <>
        {ticket}
        {overlays}
      </>
    )
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <PageHeader
          title="Swap"
          subtitle={isSimple ? "Turn one coin into another" : "Cross-chain routing, with the quote's working shown"}
          back="/"
        />
        {/* The chain rail is Pro furniture: it tells a trader what the router
            covers. Simple never asks that question, so it never sees the row.
            Six pills don't fit beside the title until well past `sm`, so it
            scrolls rather than widening the page. */}
        {!isSimple && (
          <div className="hidden min-w-0 shrink items-center gap-2 overflow-x-auto sm:flex scrollbar-none">
            {CHAINS.map((chain) => (
              <div key={chain.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/30 px-2.5 py-1">
                <img src={chain.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                <span className="text-[10px] font-medium">{chain.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSimple ? (
        /* One column, centred, nothing beside it. The calm version of this
           screen is as much about what is NOT in the periphery as about what
           the ticket drops. */
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
          {ticket}
          <SwapHistory />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            {view.rateChart && <SwapRateChart fromCoin={fromCoin} toCoin={toCoin} />}
            {ticket}
          </div>
          <div className="flex flex-col gap-4">
            <SwapHistory />
          </div>
        </div>
      )}

      {overlays}
    </>
  )
}
