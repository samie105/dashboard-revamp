"use client"

/**
 * Worldstreet trading workspace. Modern-wallet futures orders use the
 * crypto backend's Hyperliquid intent flow; spot discovery comes from the
 * broader Worldstreet market feed and is never sourced from Hyperliquid.
 * Trading is modern-wallet only. Legacy Privy wallet support may remain on
 * other dashboard surfaces, but it is not a trading source.
 *
 * URL contract: /trade?market=spot|futures&symbol=BTC — nav and the trade
 * selector deep-link into it.
 *
 * LAYOUT: a full-height exchange workspace (the route renders full-bleed, no
 * sidebar): a top bar of app chrome, then the market header, the chart and the
 * orders pane in the middle column, with the markets rail and the order ticket
 * as fixed side rails. Panes are CARDS separated by fill and the workspace gap
 * — one padding scale (10px on a phone, 16px from lg) across every band —
 * rather than by hairlines drawn between identical grounds. Below lg the rails
 * fold: the rail goes entirely, and the ticket becomes a modal the buy/sell
 * action bar opens, so the chart keeps the screen. That modal is the house
 * centred card (`components/ui/modal-surface.ts`) — it was a bottom sheet
 * until 2026-09-03; see the note where it is mounted.
 *
 * SIMPLE vs PRO (`lib/trade-view.ts`, and the long note where it is read):
 * Simple is the complete buy/sell story and nothing else — the pair, the price
 * and its 24h move, the chart, a market ticket sized in dollars, the wallet,
 * and the orders you have placed. Pro adds the markets rail, the chart's
 * workbench, the reference figures, the unit switch and the order buckets. It
 * is not a stripped Simple and a decorated Pro; they are two complete screens
 * for two readers, and the switch has to MOVE things or it teaches people the
 * control is broken.
 */

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import {
  CryptoApiError,
  type HlMarkets,
  type HlAccount,
  type HlOrderOutcome,
  marketRowKey,
  type HlSpotMarket,
  type HlFuturesMarket,
} from "@/lib/crypto-api"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
  LIQUIDATION_WARNING,
  readFuturesOrderFigures,
  reduceOnlyProblem,
  type HyperliquidIntent,
} from "@/lib/crypto-backend"
import {
  buildSpotOrderPlan,
  buildSpotOrderPlanFromTokenAmount,
  sizesLikeUsd,
  spentTokenSymbol,
  baseTokenOf,
  spotOrderTokens,
  normalizeSlippage,
  SLIPPAGE_PERCENTAGE,
} from "@/lib/crypto-backend/spot-order"
import {
  explorerAddressUrl,
  explorerName,
} from "@/lib/crypto-backend/network-meta"
import {
  signHyperliquidIntent,
  signEvmIntent,
  signSolanaIntent,
} from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import {
  OrderPlacedModal,
  orderCopy,
} from "@/components/trade/order-placed-modal"
import { useAuth } from "@/components/auth-provider"
import { useUiMode } from "@/components/ui-mode-provider"
import { tradeView } from "@/lib/trade-view"
import { ModeSwitch } from "@/components/ui/mode-switch"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import {
  useCryptoBalances,
  formatCryptoAmount,
} from "@/hooks/crypto/useCryptoBalances"
import {
  fetchHlOrderBook,
  fetchHl24hStats,
  type HlOrderBook,
  type Hl24hStats,
} from "@/lib/hl-public"
import {
  CandleChart,
  type ChartOrigin,
  type ChartSource,
  type ChartStats,
} from "@/components/trade/candle-chart"
import { OrderBook } from "@/components/trade/order-book"
import { PriceSources } from "@/components/trade/price-sources"
import { PositionsPanel } from "@/components/trade/positions-panel"
import { OrdersPanel } from "@/components/trade/orders-panel"
import { MarketsRail } from "@/components/trade/markets-rail"
import { MarketPicker } from "@/components/trade/market-picker"
import { MarketHeader, fmtPx } from "@/components/trade/market-header"
import {
  WalletStrip,
  type WalletStripRow,
} from "@/components/trade/wallet-strip"
import { SlippageControl } from "@/components/trade/slippage-control"
import { TokenIdentity } from "@/components/trade/token-identity"
import { noteRecentMarket } from "@/hooks/useMarketPrefs"
import { loadSpotMarkets } from "@/lib/spot-markets"
import { nativeTokenFor } from "@/lib/native-token"
import { chainLabel } from "@/lib/spot-market-search"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { MODAL_BACKDROP, MODAL_SURFACE } from "@/components/ui/modal-surface"
import { EmptyState, Skel } from "@/components/ui/system"
import {
  BackAction,
  Segmented,
  type SegmentedOption,
} from "@/components/ui/system"
import {
  AnnouncementBanner,
  DetailPanel,
  InlineNotice,
} from "@/components/ui/flow"
import { Toast } from "@/components/ui/toast"
import { FUTURES_SOON_SHORT, FUTURES_SOON_TITLE } from "@/components/ui/coming-soon"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  Clock01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { registerVividContext } from "@/lib/vivid-page-context"

type Market = "spot" | "futures"
type Side = "buy" | "sell"
type OrderType = "market" | "limit"

/**
 * FUTURES GATE — perpetual futures are not open on the platform yet.
 *
 * Everything futures below is left standing and compiling; it is switched off
 * at four points, each marked `FUTURES GATE`, so bringing the venue back is a
 * matter of flipping this flag and deleting those blocks:
 *   1. `setMarketTab()` — a press on the Futures tab raises the notice instead
 *      of navigating, so the answer is the same on a phone as under a mouse.
 *      Currently unreachable, because the market toggle it belongs to is
 *      itself withdrawn from the top bar (see `MARKET_TABS` below). It stays
 *      because the toggle comes back before the venue does, and it must not
 *      come back ungated.
 *   2. `gatedMarket()` — `?market=futures` deep links resolve to spot, so no
 *      futures branch (chart source, book, ticket, positions) can ever run.
 *      With the tab gone this is the ONLY live gate: a stale link is the only
 *      way left to ask for futures.
 *   3. The top-bar balance readout — the Futures figure is withheld here.
 *   4. The notice itself — a toast over the workspace, at the foot of the
 *      render.
 * Typed `boolean` rather than left as the `false` literal so the guards below
 * read as switches, not as dead code a linter should strip.
 */
const FUTURES_LIVE: boolean = false

/* Retained while the market toggle is withdrawn — this and `setMarketTab`
   below are the restoration point for futures, and rewriting them later is
   strictly worse than leaving them here. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MARKET_TABS: readonly SegmentedOption<Market>[] = [
  { key: "spot", label: "Spot" },
  // When this toggle is restored the Futures tab comes back visible AND
  // selectable, not `disabled`. A disabled tab answers only a hovering mouse —
  // its `title` never fires on a touchscreen, which is most of this audience —
  // so the press is let through and `setMarketTab` answers it with the notice
  // instead of a dead control.
  { key: "futures", label: "Futures" },
]
const ORDER_TYPES: readonly SegmentedOption<OrderType>[] = [
  { key: "market", label: "Market" },
  { key: "limit", label: "Limit" },
]

/**
 * The quote asset a market is actually priced in — the registry names it per
 * row (spec §8). Legacy Hyperliquid rows carry no quote field and are USDC.
 */
function quoteOf(m: HlSpotMarket | HlFuturesMarket | undefined) {
  return m && "quote" in m && m.quote ? String(m.quote).toUpperCase() : "USDC"
}

/**
 * A modern futures order that has been built by the backend and is waiting on
 * the user's explicit approval (spec §9). The ticket fields are frozen here so
 * the review screen — and the outcome it produces — describe the order the
 * backend priced, never a form the user nudged afterwards.
 */
type FuturesReview = {
  intent: HyperliquidIntent
  symbol: string
  side: Side
  orderType: OrderType
  amountUsd: number
  /** The price sent with a limit order. Snapshotted because the order book
   *  rail stays live behind the review and can still rewrite the form's. */
  limitPrice: number | null
  leverage: number
  reduceOnly: boolean
  takeProfit: number | null
  stopLoss: number | null
}

/**
 * Where the workspace opens when the URL doesn't say.
 *
 * `list[0]` is whatever the registry sorted first — on 9,000+ spot rows that
 * is an arbitrary long-tail token, and landing there makes the whole screen
 * look broken: a chart nobody indexes, a price nobody recognises. Spot opens
 * on SOL/USDC on Solana, the deepest market we route; futures on BTC, its own
 * venue's benchmark. The preference is by symbol AND chain, because the same
 * ticker exists many times over.
 */
function defaultMarketOf(
  list: readonly (HlSpotMarket | HlFuturesMarket)[],
  market: Market
): HlSpotMarket | HlFuturesMarket | undefined {
  if (market === "futures")
    return list.find((m) => m.symbol.toUpperCase() === "BTC")
  const preferred: readonly [string, string | null][] = [
    ["SOL", "solana-mainnet-beta"],
    ["SOLANA", "solana-mainnet-beta"],
    ["BTC", null],
    ["ETH", null],
  ]
  for (const [symbol, networkId] of preferred) {
    const hit = list.find(
      (m) =>
        m.symbol.toUpperCase() === symbol &&
        (!networkId || ("networkId" in m && m.networkId === networkId))
    )
    if (hit) return hit
  }
  return undefined
}

/**
 * FUTURES GATE (2/4): which venue the URL is allowed to open.
 *
 * `?market=futures` links exist all over the app (nav, the markets rail, the
 * trade selector, shared links), and a disabled tab does nothing about a deep
 * link. While futures is closed this collapses every such arrival onto spot,
 * which is what makes the gate safe rather than cosmetic: `market` is the one
 * value the chart source, order book, ticket, positions drawer and mobile
 * action bar all branch on, so none of them can reach a futures path.
 *
 * The declared return type is deliberately `Market`, not the `"spot"` literal
 * it currently produces — otherwise TypeScript narrows every `market ===
 * "futures"` comparison in this file into a "no overlap" error and the futures
 * code we are preserving stops compiling.
 */
function gatedMarket(requested: string | null): Market {
  return FUTURES_LIVE && requested === "futures" ? "futures" : "spot"
}

/** The order's dollar floor, as a person would write it. */
function fmtMin(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TradeClient() {
  const params = useSearchParams()
  const router = useRouter()
  const { openFlow } = useMoneyFlow()
  /**
   * How much of this screen is on (`lib/trade-view.ts`).
   *
   * The descriptor used to ride on the mode provider, which every screen in
   * the app depends on; it lives in its own module now so trade's flags can
   * move without touching it. `pro` is read alongside it for the handful of
   * STRUCTURAL differences the flag set does not name — the markets rail and
   * the token identity panel — each marked at its use site.
   *
   * WHICH FLAGS THIS SCREEN CAN ACTUALLY HONOUR
   *
   * Five of the ten move something you can see:
   *   marketStats   → the 1h/7d/volume/day-range row in `MarketHeader`
   *   unitSwitch    → the USD ↔ token toggle inside the amount field
   *   chartToolbar  → intervals, the O/H/L/C readout and the MA overlay
   *   orderTabs     → the status buckets and the wider columns in `OrdersPanel`
   *   priceSources  → the live-vs-market-list panel in the ticket
   *
   * The other five are DARK, and deliberately so. This venue is an AMM: a spot
   * order here is a swap against a liquidity pool, routed through 0x or LI.FI
   * out of the user's own wallet. The perpetuals venue that could answer them
   * is gated shut (see FUTURES GATE), and even open it would be answering for
   * a different market than the one on screen.
   *
   *   orderBook          — there are no resting bids and asks. A pool has a
   *                        curve, not a ladder. `fetchHlOrderBook` is another
   *                        venue's book for a similarly-named contract, and
   *                        showing it here would be a lie with a spread on it.
   *   timeAndSales       — no trade feed exists for these pools. The chart API
   *                        serves OHLCV and nothing else.
   *   advancedOrderTypes — nothing can rest, so nothing can be a limit or a
   *                        stop. The Limit tab was removed from spot for
   *                        exactly this: `buildSpotOrderPlan` never read a
   *                        limit price, so the ticket demanded one and then
   *                        placed a market swap anyway.
   *   orderModifiers     — time in force and post-only are modifiers ON a
   *                        resting order. With no resting order they modify
   *                        nothing.
   *   feeBreakdown       — there is no quote-before-intent call. The backend
   *                        prices the swap when it BUILDS it, at submit; until
   *                        a quote route exists there is no fee and no gas
   *                        figure to break down, and the pool's last price is
   *                        the only estimate available. What the ticket can
   *                        honestly promise — the floor the price protection
   *                        guarantees — is already on the receipt as "At
   *                        least", in both modes.
   *
   * The rule these five follow is the one the rest of this file follows: a
   * figure we cannot source is left off, never filled in. An invented number
   * on a trading screen is worse than an absent one, because the absent one
   * cannot be traded on.
   */
  const { mode } = useUiMode()
  const view = tradeView(mode)
  const pro = mode === "pro"
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const modernWallet = useCryptoWalletState()
  const modernPackage = useQuery({
    queryKey: ["crypto", "wallet-package", user?.userId ?? "anonymous"],
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && !!modernWallet.data,
    staleTime: 3 * 60_000,
  })

  /**
   * Whether there is a wallet to trade out of — and, when there isn't, whether
   * we are still finding out.
   *
   * A user with no wallet used to meet this screen as a set of blanks: the top
   * bar's money doors rendered `null`, the balance strip reported a confident
   * "0" of each token, and the buy button accepted the press and answered with
   * an error. Three different ways of not saying the one thing that was true —
   * you don't have a wallet yet, and here is where you make one. Each of those
   * three places now reads this.
   *
   * A disabled react-query is not "loading" (it never fetches), so the package
   * query only counts toward the wait once a wallet exists to fetch one for.
   */
  const walletReady = Boolean(
    user?.userId && modernWallet.data && modernPackage.data
  )
  const walletLoading =
    modernWallet.isLoading ||
    (Boolean(modernWallet.data) && modernPackage.isLoading)
  /** Settled, and there is nothing to trade with. */
  const needsWallet = isCryptoBackendEnabled && !walletReady && !walletLoading

  const market: Market = gatedMarket(params.get("market"))
  /* FUTURES GATE: whether the futures notice is up. Two things raise it — a
     press on the Futures tab (the path nearly everyone takes) and an arrival
     on a stale `?market=futures` link (the safety net) — and the dismiss
     button lowers it. The link case is read ONCE, in an initialiser, never
     from the live params: the URL-sync effect below rewrites the address bar
     to the market actually on screen (spot), so re-reading the param a tick
     later would say "no" and the explanation would flash and vanish. */
  /* Bumped on every press of the gated Futures tab, so the toast remounts
     and its dismiss timer restarts rather than the press doing nothing. */
  const [futuresNoticeSeq, setFuturesNoticeSeq] = React.useState(0)
  const [futuresNotice, setFuturesNotice] = React.useState(
    () => !FUTURES_LIVE && params.get("market") === "futures"
  )
  const urlSymbol = params.get("symbol") ?? params.get("pair") ?? ""
  // The registry id rides in the URL beside the symbol: a symbol alone can name
  // two different rows (WETH on arbitrum-one and on ethereum-mainnet), and a
  // shared link must reopen the pair the sender was actually looking at.
  const urlRowId = params.get("id") ?? ""

  const [markets, setMarkets] = React.useState<HlMarkets | null>(null)
  /** The selected row's identity — `marketRowKey`, not a bare symbol (spec §8). */
  const [selection, setSelection] = React.useState<string>("")
  const [account, setAccount] = React.useState<HlAccount | null>(null)
  const [book, setBook] = React.useState<HlOrderBook | null>(null)
  const [stats, setStats] = React.useState<Hl24hStats | null>(null)
  const [lastTick, setLastTick] = React.useState<"up" | "down" | null>(null)
  const prevMidRef = React.useRef(0)
  const [side, setSide] = React.useState<Side>("buy")
  const [orderType, setOrderType] = React.useState<OrderType>("market")
  const [amountUsd, setAmountUsd] = React.useState("")
  const [limitPrice, setLimitPrice] = React.useState("")
  /* What the Amount field is denominated in. "Sell 0.5 SOL" and "sell $50 of
     SOL" are different orders, and only the first is expressible without a
     live price — which is exactly why the token unit used to live in its own
     second form bolted under the workspace. It belongs here, on the one
     ticket, as a unit switch. */
  const [amountUnit, setAmountUnit] = React.useState<"usd" | "token">("usd")
  /* How far from the quoted price this order may fill. It was a fixed constant
     the user never saw; it is a setting now, and the plan builder clamps
     whatever arrives here into its own band before anything is sent. */
  const [slippage, setSlippage] = React.useState(SLIPPAGE_PERCENTAGE)
  /* The unlock DEK lives in memory only, so every page load starts locked.
     The swap screen answers that by unlocking and carrying on; the trade
     ticket used to throw instead, which read as "Order failed. Try again."
     for the single most routine state this screen can be in. */
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)
  /* The order AS PLACED. Snapshotted because the ticket stays live behind the
     confirmation — the fields can be edited for the next order while this one
     is still filling, and the receipt must describe the order that was sent. */
  const [placedOrder, setPlacedOrder] = React.useState<{
    side: Side
    symbol: string
    amount: string
    quantity: string | null
  } | null>(null)
  const [orderModalOpen, setOrderModalOpen] = React.useState(false)
  const [leverage, setLeverage] = React.useState(1)
  // Modern futures only (spec §9): an order that may only shrink exposure.
  const [reduceOnly, setReduceOnly] = React.useState(false)
  const [tpPrice, setTpPrice] = React.useState("")
  const [slPrice, setSlPrice] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [outcome, setOutcome] = React.useState<HlOrderOutcome | null>(null)
  // Modern spot never claims a fill at submit time (spec §8: "a quote is not a
  // fill"). The submitted intent is polled until the backend says confirmed.
  const [spotIntentId, setSpotIntentId] = React.useState<string | null>(null)
  // Modern futures review step (spec §9). The intent is CREATED but unsigned
  // while this is set: nothing has reached the venue until the user confirms.
  // The ticket state is snapshotted alongside it so the review screen states
  // the order that was actually built, not whatever the form says later.
  const [futuresReview, setFuturesReview] =
    React.useState<FuturesReview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  // Mobile-only view state: which pane sits under the chart, and whether the
  // order ticket modal is up.
  const [mobilePane, setMobilePane] = React.useState<
    "book" | "positions" | "orders"
  >("book")
  const [ticketOpen, setTicketOpen] = React.useState(false)
  // Load failures are tracked apart from order errors: an unreachable account
  // must never be mistaken for an account that exists but isn't set up.
  const [marketsError, setMarketsError] = React.useState(false)
  const [accountError, setAccountError] = React.useState(false)
  const usingModern = isCryptoBackendEnabled

  // Spot intent status — the same poll `useTransactionIntent` runs for
  // transfers, on the same cache key, so a spot order's terminal state comes
  // from the backend rather than from the fact that we managed to submit it.
  // It stops only on a terminal status; anything else is still in flight.
  const spotIntentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(
      user?.userId ?? "anonymous",
      spotIntentId ?? "none"
    ),
    queryFn: ({ signal }) =>
      cryptoBackendClient.getIntent(spotIntentId as string, signal),
    enabled: isCryptoBackendEnabled && Boolean(spotIntentId),
    refetchInterval: (query) => {
      // The backend's terminal statuses (see `sendStageIndex` for the full
      // vocabulary); everything else — created/signed/submitted/pending/
      // unknown, or a status this client hasn't been taught — is still moving.
      const status = query.state.data?.status
      return status === "confirmed" ||
        status === "failed" ||
        status === "expired"
        ? false
        : 5_000
    },
  })
  const spotIntentStatus = spotIntentId
    ? spotIntentQuery.data?.status
    : undefined

  // The balance snapshot has `staleTime: Infinity` (spec §5's explicit-
  // invalidation list) — a confirmed spot trade has to say so itself or the
  // wallet page shows pre-trade balances forever. Guarded on the created→
  // confirmed TRANSITION (a ref, not the poll tick) so this can only fire
  // once per intent.
  const spotBalancesInvalidatedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (
      spotIntentStatus !== "confirmed" ||
      !spotIntentId ||
      spotBalancesInvalidatedFor.current === spotIntentId
    )
      return
    spotBalancesInvalidatedFor.current = spotIntentId
    const uid = user?.userId ?? "anonymous"
    void queryClient.invalidateQueries({
      queryKey: cryptoQueryKeys.balanceSnapshot(uid),
    })
    void queryClient.invalidateQueries({
      queryKey: cryptoQueryKeys.balances(uid),
    })
  }, [spotIntentStatus, spotIntentId, queryClient, user?.userId])

  // Markets + account
  const refreshAccount = React.useCallback(() => {
    if (market === "spot") {
      setAccount(null)
      setAccountError(false)
      return
    }
    if (!isCryptoBackendEnabled) {
      setAccountError(true)
      return
    }
    cryptoBackendClient
      .getHyperliquidAccount()
      .then((a) => {
        setAccount(a as HlAccount)
        setAccountError(false)
      })
      .catch(() => setAccountError(true))
  }, [market])

  const loadMarkets = React.useCallback(() => {
    setMarketsError(false)
    if (!isCryptoBackendEnabled) {
      setMarketsError(true)
      return
    }
    if (market === "spot") {
      // Spec §8: the registry IS the catalogue. Every field the order builder
      // needs — quote asset, token addresses, mints — is carried through
      // verbatim; nothing downstream may re-derive them from the symbol.
      loadSpotMarkets()
        .then((result) =>
          setMarkets({
            // Spot settles as an on-chain swap, so the only real floor is what
            // the route can carry without the amount vanishing into fees. A
            // whole dollar was a house rule with nothing behind it.
            minOrderUsd: 0.5,
            futures: [],
            spot: result.markets
              .filter((coin) => coin.chartSupported)
              .map((coin) => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                coinName: `${coin.symbol.toUpperCase()} · ${coin.networkId}`,
                price: coin.price ?? 0,
                icon: coin.icon,
                networkId: coin.networkId,
                venue: coin.venue,
                quote: coin.quote,
                chartSymbol: coin.chartSymbol,
                sellToken: coin.sellToken,
                buyToken: coin.buyToken,
                inputMint: coin.inputMint,
                outputMint: coin.outputMint,
                baseDecimals: coin.baseDecimals,
                quoteDecimals: coin.quoteDecimals,
              })),
          })
        )
        .catch(() => setMarketsError(true))
      return
    }
    cryptoBackendClient
      .getHyperliquidMarkets()
      .then((modern) => {
        // Hyperliquid's spot catalogue is intentionally not used. The broad
        // Worldstreet market feed supplies spot discovery; Hyperliquid is
        // reserved for its deep perpetual futures venue.
        setMarkets({
          minOrderUsd: modern.minOrderUsd,
          // Spec §9: the venue's constraints ride along with the row —
          // `szDecimals` sizes the quantity readout, `onlyIsolated` names the
          // margin mode. Both are omitted when the backend didn't state them,
          // so an absent constraint never hardens into a client-side default.
          futures: modern.futures.map((item) => ({
            symbol: item.symbol,
            price: item.price,
            maxLeverage: item.maxLeverage ?? 1,
            ...(typeof item.szDecimals === "number"
              ? { szDecimals: item.szDecimals }
              : {}),
            ...(item.onlyIsolated ? { onlyIsolated: true } : {}),
          })),
          spot: [],
        })
      })
      .catch(() => setMarketsError(true))
  }, [market])

  React.useEffect(() => {
    loadMarkets()
    refreshAccount()
    const id = setInterval(refreshAccount, 30_000)
    return () => clearInterval(id)
  }, [loadMarkets, refreshAccount])

  // Pick the default/URL row once markets load. The id wins over the symbol:
  // it is the only field that separates two same-symbol rows on different
  // networks (spec §8). The symbol remains the fallback for shared links and
  // for the legacy/futures rows that carry no id.
  const list = React.useMemo(
    () =>
      market === "spot" ? (markets?.spot ?? []) : (markets?.futures ?? []),
    [markets, market]
  )
  React.useEffect(() => {
    if (!list.length) return
    const wanted = urlSymbol.toUpperCase()
    const chosen =
      (urlRowId ? list.find((m) => marketRowKey(m) === urlRowId) : undefined) ??
      (wanted
        ? list.find((m) => m.symbol.toUpperCase() === wanted)
        : undefined) ??
      defaultMarketOf(list, market) ??
      list[0]
    setSelection(marketRowKey(chosen))
  }, [list, urlSymbol, urlRowId, market])

  const current = React.useMemo(
    () => list.find((m) => marketRowKey(m) === selection),
    [list, selection]
  )
  const symbol = current?.symbol ?? ""
  const maxLev = current && "maxLeverage" in current ? current.maxLeverage : 1
  /**
   * The venue's own size precision (spec §9). Clamped to what `toFixed` can
   * take so a malformed value degrades to a rounder number rather than
   * throwing mid-render; `null` means the backend never said, and the readout
   * falls back to the six places it has always used.
   */
  const szDecimals =
    current && "szDecimals" in current && typeof current.szDecimals === "number"
      ? Math.min(Math.max(Math.trunc(current.szDecimals), 0), 8)
      : null
  const onlyIsolated = Boolean(
    current && "onlyIsolated" in current && current.onlyIsolated
  )

  // Clamp leverage when switching to a contract with a lower max — otherwise
  // the stale higher value is displayed and sent. Futures only: on the Spot
  // tab maxLev is 1 and must not wipe the user's futures setting.
  React.useEffect(() => {
    if (market !== "futures" || !current) return
    setLeverage((l) => Math.min(l, maxLev))
  }, [market, current, maxLev])

  /* Spot has no order type to choose, so it must not be left holding one:
     an orderType of "limit" carried over from the futures tab would still
     demand a limit price before the button enabled. */
  React.useEffect(() => {
    if (market === "spot" && orderType !== "market") {
      setOrderType("market")
      setLimitPrice("")
    }
  }, [market, orderType])

  /* Buy and sell spend different tokens, so a token-denominated figure does
     not survive the flip — 0.5 TRUMP is not 0.5 USDC. */
  const prevSide = React.useRef(side)
  React.useEffect(() => {
    if (prevSide.current === side) return
    prevSide.current = side
    if (amountUnit === "token") {
      setAmountUnit("usd")
      setAmountUsd("")
    }
  }, [side, amountUnit])

  // A new row or market invalidates everything priced in the old one.
  React.useEffect(() => {
    setLimitPrice("")
    setTpPrice("")
    setSlPrice("")
    setOutcome(null)
    setSpotIntentId(null)
    // A review holds an intent priced for one contract. It is discarded rather
    // than carried: an unsigned intent expires on its own, and confirming a
    // stale one would trade the pair the user just left.
    setFuturesReview(null)
    setReduceOnly(false)
    setError(null)
    // The unit names a token that belongs to the row being left.
    setAmountUnit("usd")
  }, [selection, market])

  /**
   * Where this market's candles come from. Perps stay on Hyperliquid, which
   * is authoritative for its own venue; spot charts the base token by contract
   * on the row's chain, which is the only key that identifies it.
   */
  const chartSource = React.useMemo<ChartSource | null>(() => {
    if (!current) return null
    if (market === "futures")
      return { kind: "hyperliquid", coin: current.symbol }
    if (!usingModern)
      return {
        kind: "hyperliquid",
        coin: (current as { coinName: string }).coinName,
      }
    const networkId = "networkId" in current ? current.networkId : undefined
    const base = baseTokenOf(current as never)
    /* A native coin has no contract, so the registry may carry a router's
       sentinel for it. Pools are held in the WRAPPED token, so chart that —
       wSOL and SOL are the same price, and without the translation the
       deepest pool on Solana looks like a token nobody indexes. */
    const native = networkId && base ? nativeTokenFor(networkId, base) : null
    const token = native?.wrapped ?? base
    /* `chartSymbol` is the registry's CoinGecko id. It is what admitted the
       token to the catalogue in the first place, and for the many tokens with
       no pool on their own chain it is the only thing that can draw one. */
    const coingeckoId =
      "chartSymbol" in current && current.chartSymbol
        ? String(current.chartSymbol)
        : null
    return networkId && (token || coingeckoId)
      ? { kind: "dex", networkId, token: token ?? "", coingeckoId }
      : null
  }, [current, market, usingModern])

  /* The market strip's 24h figures. Hyperliquid rows fill these from its own
     stats endpoint; spot rows had nothing behind them and read "—" forever,
     so they now take the pool's own 24h numbers, reported by the same request
     that draws the chart. */
  /**
   * Figures are held per market and only ever REPLACED by a real value.
   *
   * The 1h/7d changes and the day's range are derived from whichever candle
   * series is loaded, and a series has to span a window to answer for it — a
   * 1m chart holds about sixteen hours, so switching to it makes 24h and 7d
   * unanswerable. Dropping them from the header on an interval press would
   * make figures blink in and out of a toolbar that never moved, so a window
   * that goes quiet keeps its last real answer. The facts don't depend on the
   * interval; only our ability to compute them does. Reset on market change,
   * where the figures genuinely stop applying.
   */
  const [dexStats, setDexStats] = React.useState<ChartStats | null>(null)
  /* Which indexer the chart actually reached. Lifted out of the chart because
     it is a fact about the PRICE, not about the picture — Pro's price-sources
     panel names it beside the figure it produced. */
  const [chartOrigin, setChartOrigin] = React.useState<ChartOrigin>(null)
  /* The last pool price seen, for the spot tick direction. Futures reads its
     direction off the book poll; spot has no book, so the chart poll is the
     only feed that can say whether the price moved, and which way. */
  const prevSpotPrice = React.useRef(0)
  React.useEffect(() => {
    setDexStats(null)
    setChartOrigin(null)
    prevSpotPrice.current = 0
    setLastTick(null)
  }, [selection])
  /* Liveness. Bumped once per price poll that LANDS — the chart's own poll on
     spot, the book poll on futures — and nothing else, so the header's
     heartbeat can only beat when data actually arrived. */
  const [beat, setBeat] = React.useState(0)
  const handleChartStats = React.useCallback((s: ChartStats | null) => {
    setDexStats((prev) => {
      if (!s) return prev
      if (!prev) return s
      const keep = <K extends keyof ChartStats>(key: K) =>
        (s[key] ?? prev[key] ?? null) as ChartStats[K]
      return {
        // The live figures always take the newest answer, null included: a
        // price we can no longer read must not be shown as a price.
        price: s.price,
        volume24h: s.volume24h,
        // The windowed ones hold their last real value.
        changePct24h: keep("changePct24h"),
        changePct1h: keep("changePct1h"),
        changePct7d: keep("changePct7d"),
        high24h: keep("high24h"),
        low24h: keep("low24h"),
      }
    })
    setBeat((b) => b + 1)
    const next = s?.price ?? 0
    if (
      prevSpotPrice.current > 0 &&
      next > 0 &&
      next !== prevSpotPrice.current
    ) {
      setLastTick(next > prevSpotPrice.current ? "up" : "down")
    }
    if (next > 0) prevSpotPrice.current = next
  }, [])

  /**
   * The coin whose order book and 24h stats to poll — futures only.
   *
   * Spot has no book to show. A spot order is a swap against a liquidity pool:
   * there are no resting bids and asks to display, no price level to click
   * into a limit order, and nothing a depth ladder would be describing. The
   * pane it occupied is the chart's now.
   */
  const bookCoin = React.useMemo(
    () => (current && market === "futures" ? current.symbol : null),
    [current, market]
  )

  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setBook(null) // don't show the previous coin's book/price while loading
    prevMidRef.current = 0
    setLastTick(null)
    const load = () =>
      fetchHlOrderBook(bookCoin, 22)
        .then((b) => {
          if (cancelled) return
          if (prevMidRef.current > 0 && b.midPrice !== prevMidRef.current) {
            setLastTick(b.midPrice > prevMidRef.current ? "up" : "down")
          }
          prevMidRef.current = b.midPrice
          setBook(b)
          setBeat((n) => n + 1)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [bookCoin])

  // 24h stats for the header — derived from public candles, refreshed slowly.
  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setStats(null)
    const load = () =>
      fetchHl24hStats(bookCoin)
        .then((s) => {
          if (!cancelled) setStats(s)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [bookCoin])

  /* Spot has no order book, so the pool's own last price — refreshed with the
     chart — is the freshest figure available; the registry's `price` is a
     periodic snapshot and lags it. */
  const price = book?.midPrice ?? dexStats?.price ?? current?.price ?? 0
  const amt = parseFloat(amountUsd) || 0

  // TP/SL sanity — triggers are validated against the expected entry price
  // (limit price for limit orders, mid price for market orders).
  const entryRef = orderType === "limit" ? parseFloat(limitPrice) || 0 : price
  const tp = parseFloat(tpPrice) || 0
  const sl = parseFloat(slPrice) || 0
  const tpslError = React.useMemo(() => {
    if (market !== "futures" || entryRef <= 0) return null
    if (tp > 0 && (side === "buy" ? tp <= entryRef : tp >= entryRef))
      return `Take profit must be ${side === "buy" ? "above" : "below"} the entry price`
    if (sl > 0 && (side === "buy" ? sl >= entryRef : sl <= entryRef))
      return `Stop loss must be ${side === "buy" ? "below" : "above"} the entry price`
    return null
  }, [market, entryRef, tp, sl, side])

  const minOrder = markets?.minOrderUsd ?? 10

  // Pre-submit gating (spec §8). The plan is built from the registry row the
  // user is looking at, at the size they could place at minimum, so an
  // unroutable pair says so in the ticket instead of throwing after the press.
  // Legacy rows carry none of this metadata, so the legacy ticket never asks.
  /** The token the Amount field spends when the unit switch is off USD. */
  const spentSymbol = React.useMemo(
    () =>
      usingModern && market === "spot" && current
        ? spentTokenSymbol(current, side)
        : null,
    [usingModern, market, current, side]
  )
  /* What the wallet actually holds of the token this order spends — USDC on a
     buy, the base token on a sell. The ticket used to quote the Hyperliquid
     account's USDC here, which on a modern spot row is always null: the money
     is in the self-custody wallet, on the row's own chain. So the one figure
     that answers "how much can I sell?" was never on screen. */
  const { balances: modernBalances, isLoading: balancesLoading } =
    useCryptoBalances()
  const spendable = React.useMemo(() => {
    if (!(usingModern && market === "spot") || !current || !spentSymbol)
      return null
    const networkId = "networkId" in current ? current.networkId : undefined
    if (!networkId) return null
    const rows = modernBalances.filter(
      (b) =>
        b.symbol.toUpperCase() === spentSymbol.toUpperCase() &&
        b.networkId === networkId
    )
    // A snapshot that hasn't arrived is not a zero balance. Say nothing until
    // it has: "avail 0.00" against a funded wallet is worse than no figure.
    if (rows.length === 0 && balancesLoading) return null
    return rows.reduce(
      (sum, b) =>
        sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)),
      0
    )
  }, [
    modernBalances,
    balancesLoading,
    usingModern,
    market,
    current,
    spentSymbol,
  ])

  /* A buy spends the quote, and every quote we size against is a dollar
     stablecoin — so "USD | USDC" offered two names for one unit. The switch
     belongs on the side where the units genuinely differ: a sell, which spends
     the base token. */
  /* Simple mode sizes every order in dollars. "Do you want to sell 0.031 ETH
     or $95 of ETH" is a question about units, not about the trade, and the
     percentage buttons underneath already answer it a better way. Pro keeps
     the switch. Note this also forces `inTokenUnit` false, so the whole
     token-sizing branch — placeholder, estimate line, max rounding — follows
     without needing its own guard. */
  const unitSwitchable =
    Boolean(spentSymbol && !sizesLikeUsd(spentSymbol)) && view.unitSwitch
  const inTokenUnit = amountUnit === "token" && unitSwitchable

  /**
   * The order as currently typed. One builder call for both the pre-submit
   * gate and the submit itself, so what the ticket refuses and what the button
   * sends can never be two different orders.
   */
  const planFor = React.useCallback(
    (amountText: string, usdAmount: number) => {
      if (!(usingModern && market === "spot" && current)) return null
      return inTokenUnit
        ? buildSpotOrderPlanFromTokenAmount(current, side, amountText, slippage)
        : buildSpotOrderPlan(current, side, usdAmount, price, slippage)
    },
    [usingModern, market, current, side, price, inTokenUnit, slippage]
  )

  const spotPlan = React.useMemo(
    // Gate at the minimum the user could place, so an unroutable pair says so
    // before anything is typed. In token units there is no such floor — the
    // builder's own dust check is the only honest one.
    // Probe with "1" when the field is empty: this gate is asking whether the
    // PAIR can be traded, and "enter an amount" is not a fact about the pair.
    () => planFor(amountUsd.trim() || "1", Math.max(amt, minOrder)),
    [planFor, amountUsd, amt, minOrder]
  )
  const pairUnavailable = spotPlan?.kind === "unavailable"

  // No row to trade: the registry failed, came back empty, or the selected
  // market vanished from a refresh. `markets === null` is still loading, and
  // must not be reported as unavailable.
  const spotMarketsUnavailable =
    usingModern &&
    market === "spot" &&
    !current &&
    (marketsError || markets !== null)

  /** The modern-mode perpetuals ticket — the only path spec §9 governs. */
  const modernFutures = usingModern && market === "futures"
  const openPosition = account?.positions.find((p) => p.symbol === symbol)
  // Reduce-only is answerable from the account already on screen, so the
  // ticket refuses an order the venue would reject rather than discovering it
  // after a signature (spec §9).
  const reduceOnlyError =
    modernFutures && reduceOnly
      ? reduceOnlyProblem(openPosition, symbol || "this market", side)
      : null
  // The house minimum is denominated in USD, so it is only a bound on a USD
  // amount. In token units the builder's own dust check is the real floor.
  const amountSufficient = inTokenUnit ? amt > 0 : amt >= minOrder
  const canSubmit =
    !submitting &&
    !!current &&
    amountSufficient &&
    (orderType === "market" || parseFloat(limitPrice) > 0) &&
    !tpslError &&
    !pairUnavailable &&
    !reduceOnlyError

  /* The CTA ARMS — one ring pulse — at the moment the ticket goes from
     incomplete to sendable. A counter, so the pulse replays on every such
     transition and never on a render that merely kept the button valid. */
  const [armGen, setArmGen] = React.useState(0)
  const wasSubmittable = React.useRef(false)
  React.useEffect(() => {
    if (canSubmit && !wasSubmittable.current) setArmGen((g) => g + 1)
    wasSubmittable.current = canSubmit
  }, [canSubmit])

  /** The chain this row trades on, in words. */
  const networkLabel =
    current && "networkId" in current && current.networkId
      ? chainLabel(current.networkId)
      : null

  /* What the wallet holds of BOTH sides of the pair on this chain. `null`
     while the snapshot is loading — a skeleton, never a zero. Modern spot
     only: the perps account keeps its own figures in the top bar. */
  const walletRows = React.useMemo<WalletStripRow[]>(() => {
    if (!(usingModern && market === "spot") || !current) return []
    const networkId = "networkId" in current ? current.networkId : undefined
    if (!networkId) return []
    const quote = quoteOf(current)
    const holding = (sym: string): number | null => {
      const rows = modernBalances.filter(
        (b) =>
          b.symbol.toUpperCase() === sym.toUpperCase() &&
          b.networkId === networkId
      )
      if (rows.length === 0 && balancesLoading) return null
      return rows.reduce(
        (sum, b) =>
          sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)),
        0
      )
    }
    const base = holding(current.symbol)
    const quoteHeld = holding(quote)
    return [
      {
        symbol: current.symbol,
        icon: "icon" in current ? current.icon : null,
        amount: base,
        valueUsd: base !== null && price > 0 ? base * price : null,
      },
      {
        symbol: quote,
        icon: null,
        amount: quoteHeld,
        valueUsd: quoteHeld !== null && sizesLikeUsd(quote) ? quoteHeld : null,
      },
    ]
  }, [usingModern, market, current, modernBalances, balancesLoading, price])

  // Switching market carries no symbol: a spot pair name is meaningless on the
  // perps list (and vice versa), so the selection effect picks that market's
  // default and the sync effect below writes it back to the URL.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function setMarketTab(m: Market) {
    // FUTURES GATE (1/4): futures is not open, so the press is ANSWERED rather
    // than followed. Nothing navigates: the URL never gains `market=futures`,
    // `gatedMarket` never sees it, and the spot workspace under the notice
    // keeps its pair, chart and half-filled ticket exactly as they were. The
    // Segmented's `value` stays `market` — always "spot" while gated — so the
    // thumb never comes to rest on a tab whose content isn't on screen.
    if (!FUTURES_LIVE && m === "futures") {
      setFuturesNotice(true)
      setFuturesNoticeSeq((n) => n + 1)
      return
    }
    // Pressing Spot is the plain way back out of the notice.
    setFuturesNotice(false)
    router.replace(`/trade?market=${m}`)
  }

  // A pair you have actually opened is the strongest signal about what you
  // trade, and it costs nothing to record — the picker surfaces it as
  // "Recent" so the common case stops being a scroll through the registry.
  React.useEffect(() => {
    if (current) noteRecentMarket(marketRowKey(current))
  }, [current])

  // Keep the address bar honest — it's what gets refreshed, shared and
  // bookmarked, so it must name the row actually on screen, id included.
  React.useEffect(() => {
    if (!current) return
    const rowId = "id" in current && current.id ? current.id : ""
    if (
      urlSymbol.toUpperCase() === current.symbol.toUpperCase() &&
      urlRowId === rowId
    )
      return
    router.replace(
      `/trade?market=${market}&symbol=${encodeURIComponent(current.symbol)}${rowId ? `&id=${encodeURIComponent(rowId)}` : ""}`
    )
  }, [current, market, urlSymbol, urlRowId, router])

  async function submit() {
    if (!current) return
    setSubmitting(true)
    setError(null)
    setOutcome(null)
    setSpotIntentId(null)
    try {
      const accountFor = (family: string) =>
        modernWallet.data?.accounts.find(
          (item) => item.chainFamily === family && item.state === "active"
        )
      const packageValue = modernPackage.data
      if (!user?.userId || !modernWallet.data?.id || !packageValue)
        throw new Error("Set up and unlock the modern wallet before trading")
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) {
        // Not an error — an unmet precondition with a remedy. Ask for it, then
        // place the order the user already pressed.
        resumeAfterUnlock.current = () => void submit()
        setUnlockOpen(true)
        return
      }
      if (market === "spot") {
        // The registry row is the whole order: venue, network, token
        // identifiers and precision all come from it (spec §8).
        const plan = planFor(amountUsd, amt)
        if (!plan) return
        if (plan.kind === "unavailable") {
          setError(plan.reason)
          return
        }
        const walletId = modernWallet.data.id
        const signingAccount = accountFor(
          plan.kind === "evm" ? "evm" : "solana"
        )
        if (!signingAccount) {
          throw new Error(
            plan.kind === "evm"
              ? "Your Worldstreet wallet doesn't have an Ethereum account yet."
              : "Your Worldstreet wallet doesn't have a Solana account yet."
          )
        }
        // Solana spot goes through the same LI.FI intent route the swap
        // screen uses, not Jupiter directly (see `solanaPlan`).
        const intent =
          plan.kind === "evm"
            ? await cryptoBackendClient.createModernSpotIntent(plan.input)
            : await cryptoBackendClient.createModernLifiSwapIntent(plan.input)
        const signed =
          plan.kind === "evm"
            ? await signEvmIntent(
                user.userId,
                walletId,
                packageValue,
                intent,
                signingAccount.id
              )
            : await signSolanaIntent(
                user.userId,
                walletId,
                packageValue,
                intent,
                signingAccount.id
              )
        await cryptoBackendClient.submitIntent(intent.id, signed)
        // Submitted is not filled: the confirmation follows the intent poll
        // and only reads as complete once the backend says `confirmed`.
        setSpotIntentId(intent.id)
        setPlacedOrder({
          side,
          symbol,
          amount: inTokenUnit ? `${amt} ${spentSymbol}` : `$${amt}`,
          // Only where a live price makes it a real estimate — a size we
          // cannot compute is left off the receipt rather than shown as zero.
          quantity:
            !inTokenUnit && price > 0
              ? `≈ ${(amt / price).toFixed(szDecimals ?? 6)} ${symbol}`
              : null,
        })
        setOrderModalOpen(true)
        return
      }
      const evmAccount = accountFor("evm")
      if (!evmAccount)
        throw new Error("Set up and unlock the modern wallet before trading")
      // Spec §9: review and explicit approval come BEFORE the signature. The
      // intent the backend builds here is unsigned — no leverage change, no
      // order, nothing has reached the venue — so the review screen can state
      // the backend's own size, price, fee and liquidation figures and let
      // the user walk away from them. `confirmFuturesOrder` does the signing.
      const intent = await cryptoBackendClient.createHyperliquidIntent({
        type: "order",
        market: "futures",
        symbol: current.symbol,
        side,
        orderType,
        amountUsd: amt,
        ...(orderType === "limit"
          ? { limitPrice: parseFloat(limitPrice) }
          : {}),
        // A reduce-only order opens no new exposure, so it carries neither a
        // leverage setting nor protective triggers — the same shape the
        // position-close path already sends.
        ...(reduceOnly ? { reduceOnly: true } : { leverage }),
        ...(!reduceOnly && tp > 0 ? { takeProfitPrice: tp } : {}),
        ...(!reduceOnly && sl > 0 ? { stopLossPrice: sl } : {}),
        idempotencyKey: crypto.randomUUID(),
      })
      setFuturesReview({
        intent,
        symbol: current.symbol,
        side,
        orderType,
        amountUsd: amt,
        limitPrice: orderType === "limit" ? parseFloat(limitPrice) : null,
        leverage,
        reduceOnly,
        takeProfit: !reduceOnly && tp > 0 ? tp : null,
        stopLoss: !reduceOnly && sl > 0 ? sl : null,
      })
      return
    } catch (e) {
      /* Every throw above this line carries a sentence written to be read —
         "Unlock the modern wallet locally before trading", "…doesn't have a
         Solana account yet". Collapsing all of them into "Order failed. Try
         again." threw away the only part that told the user what to do, and
         did it precisely in the cases that never reach the network, where
         there is no request to inspect either. Same shape as the futures
         confirm handler below, which always did this correctly. */
      setError(e instanceof Error ? e.message : "Order failed. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * The second half of the modern futures flow (spec §9): sign the reviewed
   * intent on this device and submit it. The SAME intent is re-used on every
   * retry — re-creating it would mint a second idempotency key and could leave
   * two orders behind — so a failure here is recoverable by pressing again.
   */
  async function confirmFuturesOrder() {
    const review = futuresReview
    if (!review || submitting) return
    setSubmitting(true)
    setError(null)
    setOutcome(null)
    try {
      const evmAccount = modernWallet.data?.accounts.find(
        (item) => item.chainFamily === "evm" && item.state === "active"
      )
      const packageValue = modernPackage.data
      if (
        !user?.userId ||
        !modernWallet.data?.id ||
        !packageValue ||
        !evmAccount
      ) {
        throw new Error("Set up and unlock the modern wallet before trading")
      }
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) {
        throw new Error("Unlock the modern wallet locally before trading")
      }
      const signatures = await signHyperliquidIntent(
        user.userId,
        modernWallet.data.id,
        packageValue,
        evmAccount.id,
        review.intent.steps
      )
      const submitted = await cryptoBackendClient.submitHyperliquidIntent(
        review.intent.id,
        signatures
      )
      const result = submitted.results[submitted.results.length - 1] as {
        response?: { data?: { statuses?: unknown[] } }
      }
      const status = result?.response?.data?.statuses?.[0] as
        | Record<string, unknown>
        | undefined
      const filled =
        status && "filled" in status
          ? (status.filled as Record<string, unknown>)
          : undefined
      const resting = status && "resting" in status
      const figures = readFuturesOrderFigures(review.intent.summary)
      setOutcome({
        success: true,
        symbol: review.symbol,
        side: review.side,
        size: figures.size ?? 0,
        executionPrice: figures.price ?? price,
        filledSize: filled ? parseFloat(String(filled.totalSz ?? 0)) : 0,
        avgFillPrice: filled ? parseFloat(String(filled.avgPx ?? 0)) : 0,
        resting: Boolean(resting),
      })
      // Only now is the order gone: dropping the review earlier would strand a
      // signed intent with no way back to it.
      setFuturesReview(null)
      refreshAccount()
    } catch (e) {
      setError(
        e instanceof CryptoApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Order failed. Try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose(sym: string) {
    setBusyKey(`close:${sym}`)
    try {
      const position = account?.positions.find((item) => item.symbol === sym)
      const evmAccount = modernWallet.data?.accounts.find(
        (item) => item.chainFamily === "evm" && item.state === "active"
      )
      if (
        !user?.userId ||
        !modernWallet.data?.id ||
        !modernPackage.data ||
        !evmAccount ||
        !position
      )
        throw new Error("Unlock the modern wallet before closing a position")
      const intent = await cryptoBackendClient.createHyperliquidIntent({
        type: "order",
        market: "futures",
        symbol: sym,
        side: position.side === "long" ? "sell" : "buy",
        orderType: "market",
        size: Math.abs(Number(position.size)),
        reduceOnly: true,
        idempotencyKey: crypto.randomUUID(),
      })
      const signatures = await signHyperliquidIntent(
        user.userId,
        modernWallet.data.id,
        modernPackage.data,
        evmAccount.id,
        intent.steps
      )
      await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      refreshAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed")
    } finally {
      setBusyKey(null)
    }
  }

  async function handleCancel(oid: number, sym: string, mkt: Market) {
    setBusyKey(`cancel:${oid}`)
    try {
      // Worldstreet-wallet spot is an on-chain swap, not a resting order on
      // the perpetuals venue — there is nothing here to cancel.
      if (mkt === "spot")
        throw new Error(
          "Worldstreet wallet spot orders are on-chain swaps — there's no resting order to cancel."
        )
      const evmAccount = modernWallet.data?.accounts.find(
        (item) => item.chainFamily === "evm" && item.state === "active"
      )
      if (
        !user?.userId ||
        !modernWallet.data?.id ||
        !modernPackage.data ||
        !evmAccount
      )
        throw new Error("Unlock the modern wallet before cancelling an order")
      const intent = await cryptoBackendClient.createHyperliquidIntent({
        type: "cancel",
        market: "futures",
        symbol: sym,
        oid,
        idempotencyKey: crypto.randomUUID(),
      })
      const signatures = await signHyperliquidIntent(
        user.userId,
        modernWallet.data.id,
        modernPackage.data,
        evmAccount.id,
        intent.steps
      )
      await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      refreshAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed")
    } finally {
      setBusyKey(null)
    }
  }

  // Publish the live workspace state for Vivid's getCurrentPageContext.
  const vividSnap = React.useRef<Record<string, unknown>>({})
  vividSnap.current = {
    market,
    pair: symbol,
    livePrice: price,
    ticket: {
      side: market === "futures" ? (side === "buy" ? "long" : "short") : side,
      orderType,
      amountUsd: amountUsd || "(empty)",
      ...(orderType === "limit" ? { limitPrice: limitPrice || "(empty)" } : {}),
      ...(market === "futures"
        ? { leverage, takeProfit: tpPrice || null, stopLoss: slPrice || null }
        : {}),
      ...(modernFutures ? { reduceOnly } : {}),
      readyToSubmit: canSubmit,
      ...(canSubmit
        ? {}
        : {
            blockedBecause: !current
              ? "markets not loaded"
              : spotPlan?.kind === "unavailable"
                ? spotPlan.reason
                : !amountSufficient
                  ? `amount below the ${minOrder} minimum`
                  : (reduceOnlyError ?? tpslError ?? "limit price missing"),
          }),
    },
    // Spec §9: a reviewed-but-unsigned order is a distinct state — nothing has
    // been sent, and the next press is the one that spends money.
    awaitingOrderApproval: Boolean(futuresReview),
    openPositions: account?.positions.length ?? 0,
    openOrders: account?.openOrders.length ?? 0,
    tradingAccountReady: account?.ready ?? false,
  }
  React.useEffect(
    () => registerVividContext("tradeWorkspace", () => vividSnap.current),
    []
  )

  // Book click → hand the price to the ticket as a limit order.
  const pickPrice = React.useCallback((p: number) => {
    setOrderType("limit")
    setLimitPrice(String(p))
  }, [])

  const ready = account?.ready ?? false
  const balances = account?.balances
  const positionCount = account?.positions.length ?? 0
  const orderCount = account?.openOrders.length ?? 0

  // Percent chips: the notional the balance can actually carry. Spot sells
  // spend the token, not USDC, so no honest max exists there. A reduce-only
  // order is capped by the POSITION, not the balance — it opens nothing, so
  // "Max" there means the whole position and leverage does not enter (spec §9).
  const maxNotional =
    // Modern spot spends the self-custody wallet, so the ceiling is what it
    // holds of the token being spent — including on a SELL, which used to be
    // 0 here and so offered no percent chips at all.
    usingModern && market === "spot"
      ? inTokenUnit
        ? (spendable ?? 0)
        : (spendable ?? 0) *
          (spentSymbol && sizesLikeUsd(spentSymbol) ? 1 : price)
      : market === "spot"
        ? side === "buy"
          ? (balances?.spotUsdc ?? 0)
          : 0
        : modernFutures && reduceOnly
          ? (openPosition?.notionalUsd ?? 0)
          : (balances?.perpsWithdrawableUsdc ?? 0) * leverage

  /* One set of figures from whichever source knows this market.
     The day's high and low used to be null on every DEX row: the pool reports
     change and volume but no range, and reading one off "whatever the chart
     happens to show" would have labelled an arbitrary window "24h". The chart
     derives them properly now — from the bars whose timestamps actually fall
     inside the window, and null when the loaded series doesn't reach back that
     far — so the range is real on both venues. */
  const changePct24h = stats?.changePct ?? dexStats?.changePct24h ?? null
  const volume24h = stats?.quoteVolume ?? dexStats?.volume24h ?? null
  const high24h = stats?.high ?? dexStats?.high24h ?? null
  const low24h = stats?.low ?? dexStats?.low24h ?? null
  const changePct1h = dexStats?.changePct1h ?? null
  const changePct7d = dexStats?.changePct7d ?? null

  /* What the base token IS, on this chain: the contract the ticket names and
     links to. Read through the order builder so the address shown is the one
     an order would actually receive, never a field a component picked. */
  const tokenIdentity = React.useMemo(() => {
    if (!(usingModern && market === "spot") || !current) return null
    const legs = spotOrderTokens(current, "buy")
    if (!legs) return null
    return {
      address: legs.receive,
      url: explorerAddressUrl(legs.networkId, legs.receive),
      explorer: explorerName(legs.networkId),
    }
  }, [usingModern, market, current])

  /* ── Pair picker dropdown ─────────────────────────────────────────────── */
  // Same MarketPicker as the rail, in its compact shape: on the narrow
  // viewports where the rail is hidden, the dropdown is the ONLY way to change
  // pairs, and it used to be the weaker of the two — no chain filter, no
  // pinning, its own copy of the substring filter.
  const picker = pickerOpen && (
    <>
      <button
        aria-label="Close market picker"
        className="fixed inset-0 z-40 cursor-default"
        onClick={() => setPickerOpen(false)}
      />
      {/* Anchored under the pair trigger in the market header on wide
          screens; below sm it spans the viewport instead, since the header
          sits under the top bar and a 360px panel would clip. */}
      <div className="fixed inset-x-3 top-16 z-50 rounded-2xl bg-card pb-1 shadow-2xl ring-1 ring-border/40 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-[360px]">
        <MarketPicker
          list={list}
          selected={selection}
          variant="popover"
          autoFocus
          onSelect={(rowKey) => {
            setSelection(rowKey)
            setPickerOpen(false)
          }}
        />
      </div>
    </>
  )

  /* ── Modern futures review (spec §9) ──────────────────────────────────── */
  // Everything on this screen is the BACKEND'S figure or the user's own input.
  // Nothing is derived: a fee or liquidation price we were not given is absent
  // from the receipt entirely, and the warning stands in its place. Computing
  // a liquidation price here would print a confident number that is wrong
  // precisely when the position is close to being liquidated.
  const reviewFigures = readFuturesOrderFigures(futuresReview?.intent.summary)
  const reviewScreen = futuresReview && (
    <div className="flex flex-col gap-4 p-4 lg:p-5">
      <div className="flex flex-col gap-1">
        <p className="font-display text-[17px] font-semibold tracking-[-0.01em]">
          Review your order
        </p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Nothing has been sent yet. Confirming signs this order on this device
          and submits it.
        </p>
      </div>

      <DetailPanel
        rows={[
          { label: "Contract", value: `${futuresReview.symbol} PERP` },
          {
            label: "Direction",
            value: futuresReview.side === "buy" ? "Long" : "Short",
          },
          {
            label: "Order type",
            value:
              futuresReview.orderType === "limit" &&
              futuresReview.limitPrice !== null
                ? `Limit @ $${fmtPx(futuresReview.limitPrice)}`
                : futuresReview.orderType === "limit"
                  ? "Limit"
                  : "Market",
          },
          { label: "Amount", value: `$${futuresReview.amountUsd.toFixed(2)}` },
          ...(reviewFigures.size !== null
            ? [
                {
                  label: "Size",
                  value: `${reviewFigures.size} ${futuresReview.symbol}`,
                },
              ]
            : []),
          ...(reviewFigures.price !== null
            ? [{ label: "Price", value: `$${fmtPx(reviewFigures.price)}` }]
            : []),
          ...(futuresReview.reduceOnly
            ? [{ label: "Reduce only", value: "Yes" }]
            : [{ label: "Leverage", value: `${futuresReview.leverage}×` }]),
          ...(futuresReview.takeProfit !== null
            ? [
                {
                  label: "Take profit",
                  value: `$${fmtPx(futuresReview.takeProfit)}`,
                },
              ]
            : []),
          ...(futuresReview.stopLoss !== null
            ? [
                {
                  label: "Stop loss",
                  value: `$${fmtPx(futuresReview.stopLoss)}`,
                },
              ]
            : []),
          ...(reviewFigures.liquidationPrice !== null
            ? [
                {
                  label: "Liquidation price",
                  value: `$${fmtPx(reviewFigures.liquidationPrice)}`,
                },
              ]
            : []),
          ...(reviewFigures.feeUsd !== null
            ? [
                {
                  label: "Estimated fee",
                  value: `$${reviewFigures.feeUsd.toFixed(2)}`,
                  strong: true,
                },
              ]
            : []),
        ]}
      />

      {reviewFigures.needsLiquidationWarning && (
        <InlineNotice tone="warning">{LIQUIDATION_WARNING}</InlineNotice>
      )}

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <button
        onClick={confirmFuturesOrder}
        disabled={submitting}
        data-vivid-target="trade-confirm-order"
        data-vivid-guard=""
        aria-label={`Confirm and sign — ${futuresReview.side === "buy" ? "long" : "short"} ${futuresReview.symbol} for $${futuresReview.amountUsd}`}
        data-vivid-label={`Sign and submit the reviewed ${futuresReview.symbol} order. Moves real money.`}
        className={cn(
          "relative flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-white transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100",
          submitting && "ws-inflight",
          futuresReview.side === "buy"
            ? "bg-credit hover:bg-credit/90"
            : "bg-debit hover:bg-debit/90"
        )}
      >
        {submitting ? "Signing…" : "Confirm & sign"}
      </button>
      <button
        onClick={() => {
          setFuturesReview(null)
          setError(null)
        }}
        disabled={submitting}
        data-vivid-target="trade-cancel-review"
        data-vivid-label="Go back to the ticket without placing this order"
        className="flex h-11 w-full items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        Back to the ticket
      </button>
    </div>
  )

  /* ── Order ticket ─────────────────────────────────────────────────────── */
  // A modern spot order is a swap out of the self-custody wallet through
  // 0x/Jupiter — it never touches the perpetuals trading account (which
  // `refreshAccount` deliberately nulls on the spot tab). Gating the ticket on
  // that account would leave modern spot as a permanent loading skeleton.
  const needsTradingAccount = !(usingModern && market === "spot")
  const sideLabel =
    market === "futures"
      ? side === "buy"
        ? "Long"
        : "Short"
      : side === "buy"
        ? "Buy"
        : "Sell"
  const qtyPlaces = szDecimals ?? 6
  /* The CTA states its blocker, the way every money CTA in the app does
     (`FlowCta`): a disabled button that only says "Buy SOL" leaves the user
     guessing what it wants from them. Order of the ladder matters — the pair
     being untradeable outranks anything typed into it. */
  const ctaLabel = submitting
    ? modernFutures
      ? "Pricing…"
      : "Placing…"
    : pairUnavailable
      ? "Pair unavailable"
      : reduceOnlyError
        ? "Nothing to reduce"
        : !current
          ? "Loading markets…"
          : amt <= 0
            ? "Enter an amount"
            : !amountSufficient
              ? `Minimum is ${fmtMin(minOrder)}`
              : orderType === "limit" && !(parseFloat(limitPrice) > 0)
                ? "Enter a limit price"
                : tpslError
                  ? "Check take profit and stop loss"
                  : modernFutures
                    ? "Review order"
                    : `${sideLabel} ${symbol}`
  /* The receipt: what this order turns into, in the user's terms. "Qty" is a
     venue's word; "You'll get" is the question being asked.
     A spot estimate is priced off the pool a moment ago and fills a moment
     later, so the estimate alone is half the story — the floor under it is the
     number the tolerance actually guarantees, and it is the one the user is
     agreeing to. `strong` puts it below the hairline, as the total. */
  const spotFloor = (estimate: number) =>
    estimate * (1 - normalizeSlippage(slippage))
  /** The guaranteed floor under the estimate, in the unit the user receives. */
  const minimumReceived =
    market === "spot" && amt > 0 && price > 0
      ? inTokenUnit
        ? `$${spotFloor(amt * price).toFixed(2)}`
        : side === "buy"
          ? `${spotFloor(amt / price).toFixed(qtyPlaces)} ${symbol}`
          : `$${spotFloor(amt).toFixed(2)}`
      : null
  const receiptRows: { label: string; value: string; strong?: boolean }[] =
    amt > 0 && price > 0 && current
      ? [
          { label: "Price", value: `$${fmtPx(price)}` },
          ...(market === "futures"
            ? [
                {
                  label: "Size",
                  value: `≈ ${(amt / price).toFixed(qtyPlaces)} ${symbol}`,
                },
                ...(!(modernFutures && reduceOnly) && leverage > 1
                  ? [
                      {
                        label: `Margin at ${leverage}×`,
                        value: `≈ $${(amt / leverage).toFixed(2)}`,
                      },
                    ]
                  : []),
              ]
            : inTokenUnit
              ? [
                  {
                    label: "You'll get",
                    value: `≈ $${(amt * price).toFixed(2)}`,
                  },
                ]
              : side === "buy"
                ? [
                    {
                      label: "You'll get",
                      value: `≈ ${(amt / price).toFixed(qtyPlaces)} ${symbol}`,
                    },
                  ]
                : [
                    {
                      label: "You'll sell",
                      value: `≈ ${(amt / price).toFixed(qtyPlaces)} ${symbol}`,
                    },
                    { label: "You'll get", value: `≈ $${amt.toFixed(2)}` },
                  ]),
          ...(networkLabel && market === "spot"
            ? [{ label: "Network", value: networkLabel }]
            : []),
          // Last, under the hairline: the figure the tolerance guarantees, and
          // the one the press is actually agreeing to.
          ...(minimumReceived
            ? [{ label: "At least", value: minimumReceived, strong: true }]
            : []),
        ]
      : []

  const fieldClass =
    "w-full rounded-xl bg-surface-sunken px-3.5 py-2.5 text-[14px] tabular-nums outline-none ring-1 ring-transparent transition-shadow placeholder:text-subtle focus:ring-foreground/[0.14]"

  const ticket =
    /* No wallet, no ticket. The form used to render in full here and take the
       press, then answer "Set up and unlock the modern wallet before trading"
       as an error — the screen asking for an order it already knew it could
       not place. It says so up front now, and hands over the way to fix it.
       Placed first: for modern spot every branch below assumes a wallet. */
    usingModern && needsWallet ? (
      <EmptyState
        illustration="noCrypto"
        title="You'll need a wallet first"
        description="Your Worldstreet wallet holds what you trade with. Only you can open it."
        ctas={[{ label: "Set up your wallet", href: "/wallet/modern" }]}
        className="py-12"
      />
    ) : needsTradingAccount && accountError ? (
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
          <HugeiconsIcon icon={Alert02Icon} className="h-5 w-5 text-warning" />
        </span>
        <div>
          <p className="text-sm font-semibold">
            Can&apos;t reach your trading account
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your balances and positions couldn&apos;t be loaded, so orders are
            on hold. Nothing has been placed or cancelled.
          </p>
        </div>
        <button
          onClick={refreshAccount}
          className="mt-1 flex h-10 w-full items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold transition-colors hover:bg-accent"
        >
          Try again
        </button>
      </div>
    ) : needsTradingAccount && !account ? (
      <div className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunken p-1">
          <Skel className="h-10 rounded-xl" />
          <Skel className="h-10 rounded-xl" />
        </div>
        <Skel className="h-3.5 w-24" />
        <Skel className="h-16 rounded-2xl" />
        <Skel className="h-12 rounded-full" />
      </div>
    ) : needsTradingAccount && !ready ? (
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12]">
          <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-primary" />
        </span>
        <div>
          <p className="text-sm font-semibold">Trading account not set up</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            One-time setup, then fund it with USDC to start trading.
          </p>
        </div>
        <button
          onClick={() => openFlow("fund")}
          className="mt-1 flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Set up &amp; fund
        </button>
      </div>
    ) : reviewScreen ? (
      reviewScreen
    ) : (
      <div className="flex flex-col gap-4 p-4 lg:p-5">
        {spotMarketsUnavailable && (
          <AnnouncementBanner
            tone="warning"
            title="Markets are unavailable right now"
            detail={
              marketsError
                ? "The market registry didn't load. Your wallet and balances are unaffected."
                : "The market registry came back empty, so there's nothing to trade here yet."
            }
            action={{ label: "Try again", onClick: loadMarkets }}
          />
        )}

        {/* Spec §8: an unroutable pair says so before the press. */}
        {spotPlan?.kind === "unavailable" && (
          <AnnouncementBanner
            tone="warning"
            title="This pair isn't available on the new wallet yet"
            detail={spotPlan.reason}
          />
        )}

        {/* Side — a direction choice, so it wears the money colours. On a
            sunken track like the Segmented, but this is the one control in
            the app whose active fill is NOT neutral: the colour is the
            meaning. */}
        <div
          role="group"
          aria-label="Side"
          className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunken p-1"
        >
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              aria-label={
                market === "futures"
                  ? s === "buy"
                    ? "Long side"
                    : "Short side"
                  : s === "buy"
                    ? "Buy side"
                    : "Sell side"
              }
              data-vivid-target={
                s === "buy" ? "trade-side-buy" : "trade-side-sell"
              }
              data-vivid-label={
                market === "futures"
                  ? s === "buy"
                    ? "Long side"
                    : "Short side"
                  : s === "buy"
                    ? "Buy side"
                    : "Sell side"
              }
              className={cn(
                "rounded-xl py-2.5 text-[13.5px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100",
                side === s
                  ? s === "buy"
                    ? "bg-credit text-white shadow-sm"
                    : "bg-debit text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {market === "futures"
                ? s === "buy"
                  ? "Long"
                  : "Short"
                : s === "buy"
                  ? "Buy"
                  : "Sell"}
            </button>
          ))}
        </div>

        {/* Type — futures only.
            A spot order is a swap against a liquidity pool: it executes at the
            pool's price the moment it lands, and there is nowhere for an order
            to rest. The Limit tab here promised one anyway — `buildSpotOrderPlan`
            never read `limitPrice`, so it placed a market swap while the ticket
            demanded a price before it would submit. A control that changes
            nothing except what it asks of you is worse than no control. */}
        {market === "futures" && (
          <Segmented
            size="sm"
            value={orderType}
            onChange={setOrderType}
            options={ORDER_TYPES}
            className="self-start"
            vividPrefix="order-type"
          />
        )}

        {orderType === "limit" && (
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-[12px] font-semibold text-muted-foreground">
              Limit price
            </span>
            <div className="flex items-center rounded-xl bg-surface-sunken ring-1 ring-transparent transition-shadow focus-within:ring-foreground/[0.14]">
              <input
                value={limitPrice}
                onChange={(e) =>
                  setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                data-vivid-target="trade-limit-price"
                data-vivid-label="Limit price in USD"
                aria-label="Limit price in USD"
                placeholder={price ? fmtPx(price) : "…"}
                className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[14px] tabular-nums outline-none placeholder:text-subtle"
              />
              <span className="pr-3.5 text-[11px] font-semibold text-subtle">
                USD
              </span>
            </div>
          </label>
        )}

        {/* Amount — the hero figure of the ticket, in the AmountField
            register: large, light, tabular, with the unit beside it. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 px-1 text-[12px]">
            <span className="font-semibold text-muted-foreground">Amount</span>
            {/* The wallet's real holding of the token this side spends, on
                this row's chain. Tapping it means "all of it", in whichever
                unit the field is currently in. */}
            {usingModern && market === "spot" ? (
              spendable !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    if (spendable <= 0) return
                    setAmountUsd(
                      String(
                        inTokenUnit
                          ? spendable
                          : Number(
                              (
                                spendable *
                                (spentSymbol && sizesLikeUsd(spentSymbol)
                                  ? 1
                                  : price)
                              ).toFixed(2)
                            )
                      )
                    )
                  }}
                  data-vivid-target="trade-amount-balance"
                  data-vivid-label="Use the whole available balance"
                  className="min-w-0 truncate text-muted-foreground tabular-nums transition-colors hover:text-foreground"
                >
                  Available{" "}
                  <span className="font-semibold text-foreground">
                    {spendable.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {spentSymbol}
                  </span>
                </button>
              ) : balancesLoading ? (
                <Skel className="h-3 w-24" />
              ) : null
            ) : market === "spot" && side === "buy" && balances ? (
              <span className="text-muted-foreground tabular-nums">
                Available{" "}
                <span className="font-semibold text-foreground">
                  ${balances.spotUsdc.toFixed(2)}
                </span>
              </span>
            ) : null}
            {/* Reduce-only spends nothing, so the free balance is the wrong
                ceiling to quote — the open position is. */}
            {modernFutures && reduceOnly ? (
              openPosition && (
                <span className="text-muted-foreground tabular-nums">
                  Position{" "}
                  <span className="font-semibold text-foreground">
                    ${openPosition.notionalUsd.toFixed(2)}
                  </span>
                </span>
              )
            ) : market === "futures" && balances ? (
              <span className="text-muted-foreground tabular-nums">
                Available{" "}
                <span className="font-semibold text-foreground">
                  ${balances.perpsWithdrawableUsdc.toFixed(2)}
                </span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-surface-sunken px-4 py-3 ring-1 ring-transparent transition-shadow focus-within:ring-foreground/[0.14]">
            {/* The ticket's own hero figure follows the price above it to
               Medium 500. Leaving the amount at Light 300 beside a Medium
               price would put two different weights on the same register on
               one screen, which reads as a mistake rather than as a
               hierarchy. */}
            {!inTokenUnit && (
              <span
                aria-hidden
                className="font-display text-[22px] leading-none font-medium text-muted-foreground/70"
              >
                $
              </span>
            )}
            <input
              value={amountUsd}
              onChange={(e) =>
                setAmountUsd(e.target.value.replace(/[^0-9.]/g, ""))
              }
              inputMode="decimal"
              data-vivid-target="trade-amount"
              data-vivid-label={
                inTokenUnit
                  ? `Order amount in ${spentSymbol}`
                  : "Order amount in USD (the notional)"
              }
              aria-label={
                inTokenUnit
                  ? `Order amount in ${spentSymbol}`
                  : "Order amount in USD"
              }
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent font-display text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums outline-none placeholder:font-light placeholder:text-muted-foreground/30"
            />
            {/* The unit switch. Where a spot row names the token being spent,
                the ticket can size the order in it — which is what the second
                "swap" form under the workspace used to exist for. Switching
                clears the field: the same digits mean a different order. */}
            {unitSwitchable ? (
              <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-background/60 p-0.5">
                {(
                  [
                    ["usd", "USD"],
                    ["token", spentSymbol],
                  ] as const
                ).map(([unit, unitLabel]) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => {
                      if (amountUnit === unit) return
                      setAmountUnit(unit)
                      setAmountUsd("")
                    }}
                    aria-pressed={amountUnit === unit}
                    data-vivid-target={`trade-amount-unit-${unit}`}
                    data-vivid-label={`Size this order in ${unitLabel}`}
                    className={cn(
                      /* min-h-11 below lg: this was a 22px target sitting
                         inside the one control on the screen that changes what
                         a typed number MEANS. It fits: the amount row is ~52px
                         tall around a 28px figure, so a 44px chip inside a
                         2px track clears it without moving anything. */
                      "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-[10.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none lg:min-h-0 lg:px-2 lg:py-1",
                      amountUnit === unit
                        ? "bg-accent text-foreground shadow-sm"
                        : "text-subtle hover:text-foreground"
                    )}
                  >
                    {unitLabel}
                  </button>
                ))}
              </div>
            ) : (
              // One unit, so name it rather than offering a choice between
              // two spellings of it.
              <span className="shrink-0 rounded-full bg-background/60 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.04em] text-muted-foreground">
                {spentSymbol ?? "USD"}
              </span>
            )}
          </div>

          {maxNotional > 0 ? (
            <div className="grid grid-cols-4 gap-1.5">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  data-vivid-target={
                    pct === 1
                      ? "trade-amount-max"
                      : `trade-amount-${pct * 100}pct`
                  }
                  data-vivid-label={
                    pct === 1
                      ? "Use the full available balance"
                      : `Use ${pct * 100}% of the available balance`
                  }
                  aria-label={
                    pct === 1
                      ? "Use the full available balance as the amount"
                      : `Use ${pct * 100} percent of the available balance as the amount`
                  }
                  onClick={() => {
                    // Two decimals is a dollar's precision. A token amount
                    // rounded to cents is a different order — and for anything
                    // priced under a cent, rounds to nothing at all.
                    const places = inTokenUnit ? 6 : 2
                    const scale = 10 ** places
                    setAmountUsd(
                      pct === 1
                        ? String(Math.floor(maxNotional * scale) / scale)
                        : String(Math.floor(maxNotional * pct * scale) / scale)
                    )
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface-sunken text-[12px] font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-90 motion-reduce:active:scale-100 lg:min-h-0 lg:py-1.5"
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          ) : (
            !inTokenUnit &&
            amt < minOrder && (
              <p className="px-1 text-[11.5px] text-subtle">
                Minimum order {fmtMin(minOrder)}
              </p>
            )
          )}
        </div>

        {/* Reduce-only (spec §9) — modern perps only. It changes what the rest
          of the ticket even means, so it sits above the controls it removes. */}
        {modernFutures && (
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12.5px] font-semibold">Reduce only</span>
              <span className="text-[11px] leading-snug text-subtle">
                Shrinks an open position — never opens a new one.
              </span>
            </span>
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={(e) => setReduceOnly(e.target.checked)}
              data-vivid-target="trade-reduce-only"
              data-vivid-label="Reduce-only toggle — the order can only close existing exposure"
              aria-label="Reduce only — the order can only close existing exposure"
              className="h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
          </label>
        )}

        {market === "futures" && !(modernFutures && reduceOnly) && (
          <div>
            <div className="flex justify-between px-1 text-[12px]">
              <span className="font-semibold text-muted-foreground">
                Leverage
              </span>
              <span className="font-bold text-foreground tabular-nums">
                {leverage}×
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={maxLev}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              data-vivid-target="trade-leverage"
              data-vivid-label={`Leverage slider, 1 to ${maxLev}. Fill with a whole number.`}
              aria-label={`Leverage multiplier, 1 to ${maxLev}`}
              className="mt-1 h-11 w-full cursor-pointer accent-[var(--primary)] [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6"
            />
            <div className="flex justify-between px-1 text-[10px] text-subtle">
              <span>1×</span>
              <span>{maxLev}×</span>
            </div>
            {/* The venue's own constraint, stated rather than assumed (spec §9).
              There is no cross-margin control to hide — this contract simply
              has one margin mode, and the ticket says which. */}
            {onlyIsolated && (
              <p className="mt-1.5 px-1 text-[11px] leading-snug text-subtle">
                Isolated margin only — the margin you commit here backs this
                position alone.
              </p>
            )}
          </div>
        )}

        {market === "futures" && !(modernFutures && reduceOnly) && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-[12px] font-semibold text-muted-foreground">
                Take profit
              </span>
              <input
                value={tpPrice}
                onChange={(e) =>
                  setTpPrice(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                data-vivid-target="trade-take-profit"
                data-vivid-label="Take profit trigger price (optional)"
                aria-label="Take profit trigger price"
                placeholder="Optional"
                className={cn(fieldClass, "focus:ring-credit/40")}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-[12px] font-semibold text-muted-foreground">
                Stop loss
              </span>
              <input
                value={slPrice}
                onChange={(e) =>
                  setSlPrice(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                data-vivid-target="trade-stop-loss"
                data-vivid-label="Stop loss trigger price (optional)"
                aria-label="Stop loss trigger price"
                placeholder="Optional"
                className={cn(fieldClass, "focus:ring-debit/40")}
              />
            </label>
          </div>
        )}

        {tpslError && (
          <p
            role="alert"
            className="rounded-xl bg-warning-chip px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning"
          >
            {tpslError}
          </p>
        )}

        {reduceOnlyError && (
          <p
            role="alert"
            className="rounded-xl bg-warning-chip px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning"
          >
            {reduceOnlyError}
          </p>
        )}

        {/* How far the fill may drift from the price above. A spot swap is
            quoted from a pool now and settles seconds later, so this is the
            distance between the two — the ticket states it, and answers it. */}
        {usingModern && market === "spot" && (
          <SlippageControl value={slippage} onChange={setSlippage} />
        )}

        {/* The receipt — what this amount turns into. Mounted once when an
            amount first exists, so it rises in rather than flickering per
            keystroke. */}
        {receiptRows.length > 0 && (
          <div className="ws-microswap">
            <DetailPanel rows={receiptRows} />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-debit-chip px-3.5 py-2.5 text-[12.5px] leading-relaxed text-debit"
          >
            {error}
          </p>
        )}
        {outcome?.success && (
          <p
            role="status"
            className="rounded-xl bg-credit-chip px-3.5 py-2.5 text-[12.5px] leading-relaxed text-credit"
          >
            {outcome.resting
              ? "Limit order resting on the book."
              : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
          </p>
        )}
        {outcome?.success && outcome.tpslWarning && (
          <p
            role="alert"
            className="rounded-xl bg-warning-chip px-3.5 py-2.5 text-[12.5px] leading-relaxed font-semibold text-warning"
          >
            ⚠ {outcome.tpslWarning} — your position is open without that
            protection.
          </p>
        )}
        {/* Spec §8: a submitted order is not a fill. This line follows the same
          intent poll as the confirmation modal and says the same thing in the
          same words (`orderCopy`) — it is what remains once the modal is
          dismissed, so the two are never on screen together. Modern spot only:
          the legacy ticket must never show a Worldstreet-wallet order's
          status. */}
        {usingModern &&
          market === "spot" &&
          spotIntentId &&
          !orderModalOpen && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                spotIntentStatus === "confirmed"
                  ? "bg-credit-chip text-credit"
                  : spotIntentStatus === "failed" ||
                      spotIntentStatus === "expired"
                    ? "bg-debit-chip text-debit"
                    : "bg-surface-sunken text-muted-foreground"
              )}
            >
              {orderCopy(spotIntentStatus, symbol).body}
            </p>
          )}

        {/* Modern perps: this press only BUILDS the order — the review screen's
          confirm is the one that spends, and it is the one carrying the guard.
          Three motions, each caused by an event: the ring pulse when the
          ticket first becomes sendable, the travelling band while the order
          is in flight, the shadow that appears only while it is armed. */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          data-vivid-target="trade-submit"
          data-vivid-guard={modernFutures ? undefined : ""}
          aria-label={
            modernFutures
              ? `Review order — ${side === "buy" ? "long" : "short"} ${symbol}${amt > 0 ? ` for ${inTokenUnit ? `${amt} ${spentSymbol}` : `$${amt}`}` : ""}${reduceOnly ? ", reduce only" : leverage > 1 ? ` at ${leverage}x` : ""}`
              : `Place order — ${market === "futures" ? (side === "buy" ? "long" : "short") : side} ${symbol}${amt > 0 ? ` for ${inTokenUnit ? `${amt} ${spentSymbol}` : `$${amt}`}` : ""}${market === "futures" && leverage > 1 ? ` at ${leverage}x` : ""}`
          }
          data-vivid-label={
            modernFutures
              ? `Build the order and open the review screen — ${side === "buy" ? "long" : "short"} ${symbol}. Nothing is sent until you confirm there.`
              : `Place the order — ${market === "futures" ? (side === "buy" ? "long" : "short") : side} ${symbol} for the amount shown. Moves real money.`
          }
          className={cn(
            "relative flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-white transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100 motion-reduce:active:scale-100",
            submitting && "ws-inflight",
            side === "buy"
              ? "bg-credit shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--credit)_60%,transparent)] hover:bg-credit/90 focus-visible:ring-credit/50"
              : "bg-debit shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--debit)_60%,transparent)] hover:bg-debit/90 focus-visible:ring-debit/50"
          )}
        >
          {canSubmit && armGen > 0 && (
            <span
              key={armGen}
              aria-hidden
              className={cn(
                "ws-arm pointer-events-none absolute inset-0 rounded-full",
                side === "buy" ? "text-credit" : "text-debit"
              )}
            />
          )}
          {submitting && (
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {ctaLabel}
        </button>

        {/* What the wallet holds of both sides of the pair — the answer to
            "how much can I buy" and "how much can I sell", where the button
            is. Both modes: this is the user's own money, which is the one
            thing Simple must never hide. */}
        {walletRows.length > 0 && (
          <WalletStrip
            network={networkLabel}
            rows={walletRows}
            className="mt-1"
          />
        )}

        {/* Where the price came from (`TradeView.priceSources`). Pro only, and
            in the ticket rather than under the header on purpose: it is a
            reference a trader checks against the order they are about to
            place, and putting it up top would push the chart down the screen
            on the phone where this workspace is mostly used. */}
        {view.priceSources && usingModern && market === "spot" && (
          <PriceSources
            livePrice={dexStats?.price ?? null}
            listPrice={current?.price ?? null}
            origin={chartOrigin}
          />
        )}

        {/* Which token this actually is. A ticker is not an identity on a
            9,000-row registry, so the contract and a link to it close the
            ticket.
            PRO ONLY, structural rather than flagged: a contract address is
            the single most jargon-shaped thing on this screen, and Simple's
            brief is the pair, the price, the ticket and the balance. Anyone
            who needs to verify which TRUMP they are buying is, by definition,
            the Pro reader. No `tokenIdentity` flag exists — see the report. */}
        {pro && tokenIdentity && (
          <TokenIdentity
            symbol={symbol}
            icon={current && "icon" in current ? current.icon : null}
            network={networkLabel}
            address={tokenIdentity.address}
            explorerUrl={tokenIdentity.url}
            explorerName={tokenIdentity.explorer}
          />
        )}
      </div>
    )

  /* ── Workspace ────────────────────────────────────────────────────────── */
  return (
    <div
      /* Clearance for the app's floating tab bar, which this route now carries
         on phones (it is full-bleed, so it has no sidebar and no navbar — the
         bar was the only navigation left and it was missing). The capsule is
         56px tall sitting 12px off the bottom, so 68px plus the device inset
         puts the buy/sell bar exactly on top of it: no overlap, nothing
         wasted. From `md` up the capsule is hidden and the padding goes. */
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0"
      /* The house atmosphere: one warm radial at the crown, the same ambient
         brand glow the shell's rail carries, at the same strength. It is the
         only large-area use of gold the system permits, it is decorative only,
         and it is why this screen reads as Worldstreet rather than as a
         generic dark exchange.
         It is painted as this element's own background-image rather than as a
         layer behind it. A `-z-10` child of a positioned parent that has no
         stacking context of its own paints behind that parent's BACKGROUND
         too, so an opaque `bg-background` swallows it completely — the glow
         was there and invisible. A background-image composites over the
         background-colour by definition, and in-flow content still paints
         above both, which is exactly the stack this wants. */
      style={{
        backgroundImage:
          "radial-gradient(120% 86% at 22% 0%, var(--sidebar-glow) 0%, transparent 64%)",
        backgroundSize: "100% 460px",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Top bar — the app's chrome only: a way out, the Simple/Pro switch,
          and the way back to the wallet. The market itself lives in the header
          over the chart, where the price sits beside the thing it describes.
          The venue switch and the funding doors that used to sit here are
          both gone — see the two notes below, at the points they occupied. */}
      {/* It WRAPS below lg. This started as a fix for a measured overflow:
          four control groups — back, venue, Simple/Pro and the money doors —
          measured 485px at a 360px phone, so the last one was pushed off the
          right edge and clipped, and on a wallet-less account that clipped
          control was the primary action on the screen. Three of those groups
          are now two, so the row fits on the narrowest phone we support and
          the wrap is insurance rather than a fix. It is kept because the
          venue switch is coming back (futures) and a clipped top bar is a
          silent failure, where a wrapped one is merely a second row. The
          right-hand cluster keeps `ml-auto`, so if it ever does drop it lands
          right-aligned rather than adrift. Single row from lg up. */}
      {/* Rhythm note: this bar, the workspace body below it and every pane
          inside share ONE padding scale — 10px on a phone, 16px from lg. The
          screen used to run px-3/px-2/px-4 across three adjacent bands, which
          is the kind of near-miss the eye reads as sloppiness without being
          able to name. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2.5 sm:gap-x-4 lg:flex-nowrap lg:px-4 lg:py-3">
        {/* This route has no sidebar or navbar, so it carries its own way
            out — a back control, not just a clickable logo. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <BackAction to="/" className="mt-0" />
          <Link
            href="/"
            className="hidden items-center sm:flex"
            title="Dashboard"
          >
            <Image
              src="/worldstreet-logo/WorldStreet1x.png"
              alt="Worldstreet"
              width={72}
              height={18}
              className="h-[18px] w-auto object-contain"
            />
          </Link>
        </div>
        <span className="hidden h-6 w-px bg-border/40 sm:block" />

        {/* Market toggle — WITHDRAWN while futures is closed.
            A tab whose only outcome is a "not open yet" notice is a control
            that exists to disappoint. Everything behind it is intact — the
            `market` state, the futures ticket, the positions drawer, the
            gate below — so restoring this element is the whole change when
            the venue opens.
            When it comes back it comes back as the house `Segmented`, with
            `options={MARKET_TABS}`, `onChange={setMarketTab}` and the phone
            padding trim `[&_button]:px-2.5 sm:[&_button]:px-3.5` — that trim
            bought ~25px, which was the difference between this row wrapping
            and not on the commonest widths. */}

        {/* Simple / Pro. Same control and same place in the reading order as
           on the wallet: beside the screen's own identity, not buried in a
           settings menu.
           The rest of what this branch put here — the pair picker, the price
           and the 24h cluster — is gone from the top bar rather than dropped:
           it moved into MarketHeader, over the chart, where the price sits
           beside the thing it describes. The mode switch is the only part of
           that block that is chrome. */}
        <ModeSwitch className="shrink-0" />
        {/* Balances + the way back to the wallet */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {balances && (
            <span className="hidden text-xs text-muted-foreground tabular-nums 2xl:block">
              Spot{" "}
              <span className="font-semibold text-foreground">
                ${balances.spotUsdc.toFixed(2)}
              </span>
              {/* FUTURES GATE (3/4): this readout is venue-scoped — it names
                  the margin sitting on the perps venue, on a screen that no
                  longer offers any way to reach that venue. Printing it would
                  advertise a place to put money with no door in or out of it
                  from here. The money itself is not hidden: the fund screen
                  and the wallet both still show the figure, and both can
                  still move it. */}
              {FUTURES_LIVE && (
                <>
                  <span className="mx-1 text-subtle">·</span>
                  Futures{" "}
                  <span className="font-semibold text-foreground">
                    ${balances.perpsWithdrawableUsdc.toFixed(2)}
                  </span>
                </>
              )}
            </span>
          )}
          {/* One way back, not three money doors.
              Deposit / Transfer / Withdraw each opened a flow for the TRADING
              account — a different pot from the wallet the rest of the app
              now funds — three primary-weight buttons in the corner of a
              screen whose job is trading. The wallet owns those actions and
              says so on its own page; this is the door to it.
              The wallet-less case this corner used to answer is not lost with
              them: it is answered where it is actually in the way — the
              ticket's own "Set up your wallet" state, and the mobile action
              bar at the foot of this file, both of which read `needsWallet`.
              This control is neutral on purpose: it is a way out, not the
              primary action, so it takes the sunken fill rather than gold. */}
          <Link
            href="/wallet/modern"
            data-vivid-target="trade-back-to-wallet"
            data-vivid-label="Go back to the wallet"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:px-4 sm:py-2 sm:text-sm"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
            Back to wallet
          </Link>
        </div>
      </div>

      {/* Workspace body. The panes assemble in reading order — rail, chart,
          orders, ticket — on the `ws-pane` entrance; the header above the
          chart does not, so its picker's fixed layout on phones has no
          transformed ancestor to trip over. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-2.5 pb-2.5 lg:flex-row lg:gap-3 lg:px-4 lg:pb-4">
        {/* Markets rail — the full list lives on the left so switching pairs
            is one click, not a menu dive.
            PRO ONLY, and structural rather than flagged: `TradeView` names
            features inside the screen, and this is a whole pane of the
            workspace. A wall of 9,000 tickers is the definition of what Simple
            is for keeping off the screen; the pair picker in the header is
            still one press away for anyone who wants to change market. There
            is no `marketsRail` flag to read — see the report. */}
        {pro && (
          <MarketsRail
            list={list}
            selected={selection}
            onSelect={setSelection}
            className="ws-pane hidden w-[280px] shrink-0 overflow-hidden rounded-2xl bg-card xl:flex"
            style={
              {
                "--ws-pane-x": "-10px",
                "--ws-pane-delay": "40ms",
              } as React.CSSProperties
            }
          />
        )}

        {/* Market header + chart + bottom panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 lg:gap-3">
          <MarketHeader
            className="shrink-0 px-1.5 pt-1 lg:px-2 lg:pt-1.5"
            symbol={symbol}
            quote={market === "futures" ? "USDC" : quoteOf(current)}
            icon={current && "icon" in current ? current.icon : null}
            network={market === "futures" ? null : networkLabel}
            venueLabel={market === "futures" ? "Perpetual" : "Spot"}
            price={price}
            lastTick={lastTick}
            changePct={changePct24h}
            changePct1h={changePct1h}
            changePct7d={changePct7d}
            volume24h={volume24h}
            high24h={high24h}
            low24h={low24h}
            beat={beat}
            showMarketStats={view.marketStats}
            pickerOpen={pickerOpen}
            onTogglePicker={() => setPickerOpen((v) => !v)}
            picker={picker}
          />

          <div
            /* Taller on phones: the chart is the reason this screen exists, and
               260px of it under a market strip read as a strip of noise. Sized
               against the viewport so it scales with the device instead of
               being tuned to one handset, and capped so the panes below it
               stay reachable without a scroll. */
            className="ws-pane h-[min(44dvh,420px)] shrink-0 overflow-hidden rounded-2xl bg-card sm:h-[min(50dvh,460px)] lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            style={{ "--ws-pane-delay": "0ms" } as React.CSSProperties}
            data-vivid-target="price-chart"
            data-vivid-label="The candlestick price chart"
          >
            {marketsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    className="h-5 w-5 text-warning"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Markets couldn&apos;t be loaded
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Prices and the order book are unavailable right now. Your
                    balances and open positions are unaffected.
                  </p>
                </div>
                <button
                  onClick={loadMarkets}
                  className="rounded-full bg-surface-sunken px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  Try again
                </button>
              </div>
            ) : !chartSource ? (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-sm px-6 text-center text-xs leading-relaxed text-muted-foreground">
                  Select a market to load its chart.
                </p>
              </div>
            ) : (
              <CandleChart
                source={chartSource}
                onStats={handleChartStats}
                onSource={setChartOrigin}
                /* Simple keeps the chart and drops the workbench above it. */
                toolbar={view.chartToolbar}
              />
            )}
          </div>
          {/* Spot has neither positions nor resting orders — a swap settles or
              it doesn't — so the two perps tabs could only ever read "none"
              there. One Orders table takes their place; futures keeps the
              drawer, where both concepts are real. */}
          {market === "spot" ? (
            <OrdersPanel
              showTabs={view.orderTabs}
              className="ws-pane hidden h-[224px] shrink-0 overflow-hidden rounded-2xl bg-card lg:flex"
              style={{ "--ws-pane-delay": "90ms" } as React.CSSProperties}
            />
          ) : (
            <PositionsPanel
              account={account}
              busyKey={busyKey}
              onClosePosition={handleClose}
              onCancelOrder={handleCancel}
              className="ws-pane hidden h-[224px] shrink-0 overflow-hidden rounded-2xl bg-card lg:flex"
              style={{ "--ws-pane-delay": "90ms" } as React.CSSProperties}
            />
          )}

          {/* Below lg the panes share one strip instead of stacking into an
              endless scroll — the chart above never leaves the screen.
              On spot there is only one pane, so there is no tab bar: a
              Segmented offering a single choice is a control that does
              nothing. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card lg:hidden">
            {market === "spot" ? (
              <OrdersPanel showTabs={view.orderTabs} className="min-h-0 flex-1" />
            ) : (
              <>
                {/* Separated by FILL, not a hairline: the strip sits on the
                    card's own ground and the pane below it is what moves.
                    (Light mode brings the hairline back through the token
                    layer, which is where that rule lives.) */}
                <div className="scrollbar-none flex shrink-0 items-center overflow-x-auto px-3 pt-3 pb-2">
                  <Segmented
                    size="sm"
                    value={mobilePane}
                    onChange={setMobilePane}
                    options={[
                      { key: "book" as const, label: "Book" },
                      {
                        key: "positions" as const,
                        label: positionCount
                          ? `Positions · ${positionCount}`
                          : "Positions",
                      },
                      {
                        key: "orders" as const,
                        label: orderCount ? `Orders · ${orderCount}` : "Orders",
                      },
                    ]}
                  />
                </div>
                {mobilePane === "book" ? (
                  <OrderBook
                    book={book}
                    lastTick={lastTick}
                    onPickPrice={(p) => {
                      pickPrice(p)
                      setTicketOpen(true)
                    }}
                    className="min-h-0 flex-1"
                  />
                ) : (
                  <PositionsPanel
                    account={account}
                    busyKey={busyKey}
                    onClosePosition={handleClose}
                    onCancelOrder={handleCancel}
                    className="min-h-0 flex-1"
                    hideTabs
                    tab={mobilePane === "orders" ? "orders" : "positions"}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Order book rail */}
        {market === "futures" && (
          <OrderBook
            book={book}
            lastTick={lastTick}
            onPickPrice={pickPrice}
            /* Its own card, separated by the workspace gap rather than by a
               hairline drawn down its edge — the same treatment the chart,
               the orders pane and the ticket already get. */
            className="hidden w-[248px] shrink-0 overflow-hidden rounded-2xl bg-card lg:flex xl:w-[276px]"
          />
        )}

        {/* Ticket rail — desktop keeps it always-on; below lg it becomes the
            modal the action bar opens, so the chart owns the screen. */}
        <aside
          aria-label="Order ticket"
          className="slim-scroll ws-pane hidden shrink-0 overflow-hidden rounded-2xl bg-card lg:block lg:w-[320px] lg:overflow-y-auto xl:w-[344px]"
          style={
            {
              "--ws-pane-x": "10px",
              "--ws-pane-delay": "140ms",
            } as React.CSSProperties
          }
        >
          {ticket}
        </aside>
      </div>

      {/* Mobile action bar — the ticket is one tap away at all times, and the
          tap already says which side you meant. */}
      {/* No `safe-area-bottom` here any more: the workspace's own bottom
          padding already clears the device inset AND the tab bar, so a second
          inset inside this bar would only make it taller on a notched phone,
          on the screen with the least room to give. */}
      {/* No hairline over it: the workspace body above is `flex-1` and this bar
          is `shrink-0`, so nothing ever scrolls underneath — the rule was
          drawing a line between two identical fills, which is decoration. The
          two coloured buttons are their own separation. */}
      <div className="flex shrink-0 items-center gap-2 bg-background px-2.5 pt-1 pb-2.5 lg:hidden">
        {usingModern && needsWallet ? (
          /* Two big money buttons over a wallet that doesn't exist are two
             ways to reach the same dead end. One button, and it goes where
             the user actually needs to be. */
          <Link
            href="/wallet/modern"
            data-vivid-target="trade-create-wallet-mobile"
            data-vivid-label="Go to the wallet page to set up a wallet"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-bold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.985] motion-reduce:active:scale-100"
          >
            <HugeiconsIcon icon={Wallet01Icon} className="h-[18px] w-[18px]" />
            Set up your wallet
          </Link>
        ) : (
          <>
            <button
              onClick={() => {
                setSide("buy")
                setTicketOpen(true)
              }}
              data-vivid-target="trade-open-ticket-long"
              data-vivid-label="Open the order ticket on the buy/long side"
              className="min-h-12 flex-1 rounded-full bg-credit text-[15px] font-bold text-white transition-all hover:bg-credit/90 focus-visible:ring-2 focus-visible:ring-credit/40 focus-visible:outline-none active:scale-[0.985] motion-reduce:active:scale-100"
            >
              {market === "futures" ? "Long" : `Buy ${symbol}`}
            </button>
            <button
              onClick={() => {
                setSide("sell")
                setTicketOpen(true)
              }}
              data-vivid-target="trade-open-ticket-short"
              data-vivid-label="Open the order ticket on the sell/short side"
              className="min-h-12 flex-1 rounded-full bg-debit text-[15px] font-bold text-white transition-all hover:bg-debit/90 focus-visible:ring-2 focus-visible:ring-debit/40 focus-visible:outline-none active:scale-[0.985] motion-reduce:active:scale-100"
            >
              {market === "futures" ? "Short" : `Sell ${symbol}`}
            </button>
          </>
        )}
      </div>

      {/* Ticket modal (mobile) — a CENTRED CARD, not a bottom sheet.
          Owner call, 2026-09-03: every modal in the app pops up the same way,
          and this one was the odd one out. It was glued to the floor with a
          grabber on its lid while the confirmation modal that follows it — and
          every other dialog on this screen — was a centred card with a gutter.
          Two presentations inside ONE flow read as two different apps.
          The SHAPE now comes from `MODAL_SURFACE`/`MODAL_BACKDROP` (see
          components/ui/modal-surface.ts) rather than from classes written here,
          so it cannot quietly drift again; what stays local is only the size
          and the inner layout, which are this modal's own business.
          Do NOT reintroduce `inset-x-0 bottom-0`, `rounded-t-3xl`,
          `safe-area-bottom`, the translate-Y slide or the drag grabber. A
          centred card has a gutter on all four sides, so it clears the device
          inset without asking for a second one, and a grabber on a card that
          does not swipe advertises a gesture that does nothing. */}
      <Dialog.Root open={ticketOpen} onOpenChange={setTicketOpen}>
        <Dialog.Portal>
          {/* `lg:hidden` on both halves: from lg up the ticket lives in its own
              always-on rail, so this surface must not exist there at all. */}
          <Dialog.Backdrop className={cn(MODAL_BACKDROP, "lg:hidden")} />
          <Dialog.Popup
            aria-label={`${market === "futures" ? (side === "buy" ? "Long" : "Short") : side === "buy" ? "Buy" : "Sell"} ${symbol}`}
            className={cn(
              MODAL_SURFACE,
              /* Size and inner layout — the only things this modal owns.
                 `sm:max-w-md`: the dialog is live all the way up to lg, and on
                 a tablet a ticket stretched to the full gutter width would put
                 the amount field and its Max buttons at opposite ends of the
                 screen. Below sm the `max-w-[calc(100%-2rem)]` inside
                 MODAL_SURFACE is what applies, which is where the phone gutter
                 comes from.
                 `max-h-[calc(100dvh-2rem)]` honours that same 1rem gutter at
                 the top and the bottom. The old `92dvh` was measured for a
                 sheet that only had a top edge to clear.
                 `overflow-hidden` keeps the scrolling body inside the 20px
                 corners. The body below is the scroll container, not this
                 element, so the pair header stays put while the ticket scrolls
                 and the submit button is always reachable. */
              "flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md lg:hidden"
            )}
          >
            {/* One padding scale with the ticket body's own `p-4`, so the pair
                and the first control below it share a left edge. */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-4">
              <span className="flex items-center gap-2.5">
                <CoinAvatar
                  symbol={bookCoin ?? symbol}
                  src={current && "icon" in current ? current.icon : undefined}
                  size="lg"
                />
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-[15px] font-semibold">
                    {symbol}
                    <span className="ml-1 text-[12px] font-semibold text-muted-foreground">
                      {market === "futures" ? "PERP" : `/${quoteOf(current)}`}
                    </span>
                  </span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {price > 0 ? `$${fmtPx(price)}` : "—"}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setTicketOpen(false)}
                aria-label="Close"
                /* 44px on the phone this surface exists for, the house modal's
                   own close-button size (`size-11 sm:size-9`). It was 36px,
                   which is under the target minimum on the one control that
                   dismisses an order ticket. */
                className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {ticket}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* The order's own acknowledgement. Driven by the same intent poll as
          the ticket's inline line, so it can never claim a fill the poll
          hasn't reported. */}
      {placedOrder && (
        <OrderPlacedModal
          open={orderModalOpen}
          onOpenChange={setOrderModalOpen}
          status={spotIntentStatus}
          side={placedOrder.side}
          symbol={placedOrder.symbol}
          amount={placedOrder.amount}
          quantity={placedOrder.quantity}
        />
      )}

      {/* FUTURES GATE (4/4): the answer to "I pressed Futures — what
          happened". It was a full-width panel wedged between the top bar and
          the workspace, which pushed the chart, the ticket and the whole
          screen down to say one sentence — a banner where an acknowledgement
          was wanted. A toast says the same thing over the workspace and then
          gets out of the way. Keyed on the press count so pressing the tab
          again restarts the timer instead of doing nothing visible.
          Delete this block when futures opens. */}
      <Toast
        key={futuresNoticeSeq}
        open={futuresNotice}
        onClose={() => setFuturesNotice(false)}
        title={FUTURES_SOON_TITLE}
        description={FUTURES_SOON_SHORT}
        icon={Clock01Icon}
        /* Below lg the workspace's own buy/sell bar owns the bottom of the
           screen, and below md the app's tab bar sits under that. The toast
           clears both rather than covering the one control this screen is
           for. */
        className="max-md:bottom-[calc(140px+env(safe-area-inset-bottom))] max-lg:md:bottom-[5.5rem]"
      />

      {/* Unlock, then place the order the user already pressed — the same
          resume the swap screen does. */}
      <WalletUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
    </div>
  )
}
