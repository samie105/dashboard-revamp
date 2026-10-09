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
import { CARD_HUE } from "@/components/ui/surface"
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
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"

import { QuoteDetail, SlippageField } from "./quote-detail"
import { SwapRateChart } from "./rate-chart"
import { CHAINS, HOUSE_SLIPPAGE, chainMeta } from "./swap-model"
import { looksLikeTokenIdentifier, tokenIdentifier, useSwapTicket } from "./use-swap-ticket"
import { swapRowsFrom, type SwapTx } from "./swap-history-rows"

/* ── Token Select Modal ── */
function TokenSelectModal({
  open,
  onClose,
  coins,
  onSelect,
  exclude,
  chain,
}: {
  open: boolean
  onClose: () => void
  coins: CoinData[]
  onSelect: (coin: CoinData) => void
  exclude?: string
  chain: string
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
  const customAddress = search.trim()
  const canUseCustomAddress = looksLikeTokenIdentifier(chain, customAddress)

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
            {canUseCustomAddress && !coins.some((coin) => tokenIdentifier(chain, coin).toLowerCase() === customAddress.toLowerCase()) && (
              <button
                onClick={() => { onSelect({ id: customAddress, symbol: `${customAddress.slice(0, 6)}…${customAddress.slice(-4)}`, name: "Custom token", price: 0, change24h: 0, marketCap: 0, volume24h: 0, image: "", contractAddress: customAddress }); onClose() }}
                className="mb-2 w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-left text-sm"
              >
                Use token address<br /><span className="text-xs text-muted-foreground">{customAddress}</span>
              </button>
            )}
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
const HISTORY_ROWS = 10

function SwapHistory() {
  const { records, loading } = useLedgerRecords(50)
  const registry = useSpotRegistry()
  const swaps = React.useMemo<SwapTx[]>(() => swapRowsFrom(records, registry), [records, registry])

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

  /* The header said "your last ten conversions" over a list that rendered
     every swap the ledger returned — up to fifty. A caption that contradicts
     the rows beneath it is the cheapest possible way to make a page look
     untrustworthy, so the ten is now real and the subtitle states what is
     actually on screen. */
  const shown = swaps.slice(0, HISTORY_ROWS)

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Recent swaps"
        subtitle={
          swaps.length > HISTORY_ROWS
            ? `Latest ${HISTORY_ROWS} of ${swaps.length}`
            : swaps.length === 0
              ? undefined
              : `${swaps.length} conversion${swaps.length === 1 ? "" : "s"}`
        }
        link={{ label: "View all", href: "/transactions" }}
      />

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
          {shown.map((tx) => {
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
                    {tx.amountText ?? (Number.isFinite(tx.amount) && tx.amount > 0 ? qty(tx.amount) : "Amount unavailable")}
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

  // State and behaviour live in useSwapTicket (moved verbatim) so the
  // redesigned page shares the one copy of the code that moves money.
  const {
    available,
    buttonText,
    canSwap,
    cycleChain,
    estimatedTo,
    flipPair,
    fromAmount,
    fromChain,
    fromCoin,
    fromCoinBalance,
    fromCoins,
    fromPrice,
    handleSwap,
    isDollarMode,
    loadingFirstQuote,
    numericFrom,
    quoteData,
    quoteError,
    quoteLoading,
    refreshingQuote,
    requestFreshQuote,
    resumeUnlocked,
    secondsLeft,
    setFromAmount,
    setFromChain,
    setFromCoin,
    setIsDollarMode,
    setPercentage,
    setShowFromModal,
    setShowToModal,
    setSlippage,
    setToChain,
    setToCoin,
    setUnlockOpen,
    showFromModal,
    showToModal,
    slippage,
    swapLoading,
    swapResult,
    toChain,
    toCoin,
    toCoins,
    toPrice,
    unlockOpen,
    usdValue,
  } = useSwapTicket({ coins, prices, mode })
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
          /* LANDSCAPE in Pro: what you are swapping on the left, what it
             will cost and how long that price is good for on the right,
             directly above the button that commits to it. Stacked, the
             countdown sat several rows above a CTA that could scroll out of
             view, so the number you were racing and the button you were
             racing it to were never on screen together.

             Simple stays ONE centred column on purpose — its whole point is
             that nothing sits in the periphery (see the layout note below),
             and it has no quote panel to put there anyway. */
          <div
            className={
              isSimple
                ? "flex flex-col gap-3"
                : "flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-5"
            }
          >
            <div className="flex min-w-0 flex-col">
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
              view.slippageControl && (
                <SlippageField className="mt-3" value={slippage} onChange={setSlippage} />
              )
            )}
            </div>

            {/* The commitment pane. */}
            <div className="flex min-w-0 flex-col gap-3">
              {!isSimple && (
                <>
                {/* Nothing to price until there is an amount, and a lone
                    "no live price yet" row above an empty ticket is furniture
                    rather than information. */}
                {fromCoin && toCoin && numericFrom > 0 && (
                  <QuoteDetail
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
              <div className={`rounded-xl p-3 text-xs font-medium ${
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
              <p className="text-xs text-warning">
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
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
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
            </div>
          </div>
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
        onUnlocked={resumeUnlocked}
      />
      <TokenSelectModal
        open={showFromModal}
        onClose={() => setShowFromModal(false)}
        coins={fromCoins}
        onSelect={setFromCoin}
        exclude={fromChain === toChain ? toCoin?.symbol : undefined}
        chain={fromChain}
      />
      <TokenSelectModal
        open={showToModal}
        onClose={() => setShowToModal(false)}
        coins={toCoins}
        onSelect={setToCoin}
        exclude={fromChain === toChain ? fromCoin?.symbol : undefined}
        chain={toChain}
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
        /* The ticket is landscape now, so it takes the full width and the
           history sits under it. Squeezed into a `1fr` column beside a 380px
           sidebar, the ticket's own two panes had nowhere to go and the quote
           pane collapsed to a sliver — a sidebar is not worth more than the
           thing the page exists for. */
        <div className="flex flex-col gap-4">
          {view.rateChart && <SwapRateChart fromCoin={fromCoin} toCoin={toCoin} />}
          {ticket}
          <SwapHistory />
        </div>
      )}

      {overlays}
    </>
  )
}
