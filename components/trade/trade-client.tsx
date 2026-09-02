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
 * sidebar): top bar with pair + 24h stats, chart with the positions/orders
 * panel under it, order book and ticket as fixed right rails — panes separated
 * by hairlines, Binance-fashion, not floating cards. Below lg it becomes a
 * normal scrolling column: chart → ticket → book → positions.
 */

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
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
} from "@/lib/crypto-backend/spot-order"
import {
  signHyperliquidIntent,
  signEvmIntent,
  signSolanaIntent,
} from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { OrderPlacedModal, orderCopy } from "@/components/trade/order-placed-modal"
import { useAuth } from "@/components/auth-provider"
import { useUiMode } from "@/components/ui-mode-provider"
import { ModeSwitch } from "@/components/ui/mode-switch"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import {
  fetchHlOrderBook,
  fetchHl24hStats,
  type HlOrderBook,
  type Hl24hStats,
} from "@/lib/hl-public"
import { CandleChart, type ChartSource, type ChartStats } from "@/components/trade/candle-chart"
import { OrderBook } from "@/components/trade/order-book"
import { PositionsPanel } from "@/components/trade/positions-panel"
import { OrdersPanel } from "@/components/trade/orders-panel"
import { MarketsRail } from "@/components/trade/markets-rail"
import { MarketPicker } from "@/components/trade/market-picker"
import { noteRecentMarket } from "@/hooks/useMarketPrefs"
import { loadSpotMarkets } from "@/lib/spot-markets"
import { nativeTokenFor } from "@/lib/native-token"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  BackAction,
  Eyebrow,
  Segmented,
  type SegmentedOption,
} from "@/components/ui/system"
import {
  AnnouncementBanner,
  DetailPanel,
  InlineNotice,
} from "@/components/ui/flow"
import { ComingSoon } from "@/components/ui/coming-soon"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { registerVividContext } from "@/lib/vivid-page-context"
import { ModernFundingPanel } from "./modern-funding-panel"

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
 *   2. `gatedMarket()` — `?market=futures` deep links resolve to spot, so no
 *      futures branch (chart source, book, ticket, positions) can ever run.
 *   3. The top-bar balance readout — the Futures figure is withheld here.
 *   4. The notice strip itself, under the top bar.
 * Typed `boolean` rather than left as the `false` literal so the guards below
 * read as switches, not as dead code a linter should strip.
 */
const FUTURES_LIVE: boolean = false

const MARKET_TABS: readonly SegmentedOption<Market>[] = [
  { key: "spot", label: "Spot" },
  // The Futures tab stays visible AND selectable on purpose. A `disabled` tab
  // answers only a hovering mouse — its `title` never fires on a touchscreen,
  // which is most of this audience — so the press is let through and
  // `setMarketTab` answers it with the notice instead of a dead control.
  { key: "futures", label: "Futures" },
]
const ORDER_TYPES: readonly SegmentedOption<OrderType>[] = [
  { key: "market", label: "Market" },
  { key: "limit", label: "Limit" },
]

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

/** A labelled figure in the market strip — Eyebrow over a tabular value. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden shrink-0 flex-col gap-0.5 md:flex">
      <Eyebrow className="text-[10px] tracking-[0.1em]">{label}</Eyebrow>
      <span className="text-[13px] font-medium tabular-nums">{value}</span>
    </span>
  )
}

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
  market: Market,
): HlSpotMarket | HlFuturesMarket | undefined {
  if (market === "futures") return list.find((m) => m.symbol.toUpperCase() === "BTC")
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
        (!networkId || ("networkId" in m && m.networkId === networkId)),
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

function fmtCompact(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export function TradeClient() {
  const params = useSearchParams()
  const router = useRouter()
  const { openFlow } = useMoneyFlow()
  const { trade: tradeView } = useUiMode()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const modernWallet = useCryptoWalletState()
  const modernPackage = useQuery({
    queryKey: ["crypto", "wallet-package", user?.userId ?? "anonymous"],
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && !!modernWallet.data,
    staleTime: 3 * 60_000,
  })

  const market: Market = gatedMarket(params.get("market"))
  /* FUTURES GATE: whether the futures notice is up. Two things raise it — a
     press on the Futures tab (the path nearly everyone takes) and an arrival
     on a stale `?market=futures` link (the safety net) — and the dismiss
     button lowers it. The link case is read ONCE, in an initialiser, never
     from the live params: the URL-sync effect below rewrites the address bar
     to the market actually on screen (spot), so re-reading the param a tick
     later would say "no" and the explanation would flash and vanish. */
  const [futuresNotice, setFuturesNotice] = React.useState(
    () => !FUTURES_LIVE && params.get("market") === "futures",
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
  // order ticket sheet is up.
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
    if (market === "futures") return { kind: "hyperliquid", coin: current.symbol }
    if (!usingModern) return { kind: "hyperliquid", coin: (current as { coinName: string }).coinName }
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
      "chartSymbol" in current && current.chartSymbol ? String(current.chartSymbol) : null
    return networkId && (token || coingeckoId)
      ? { kind: "dex", networkId, token: token ?? "", coingeckoId }
      : null
  }, [current, market, usingModern])

  /* The market strip's 24h figures. Hyperliquid rows fill these from its own
     stats endpoint; spot rows had nothing behind them and read "—" forever,
     so they now take the pool's own 24h numbers, reported by the same request
     that draws the chart. */
  const [dexStats, setDexStats] = React.useState<ChartStats | null>(null)
  React.useEffect(() => {
    setDexStats(null)
  }, [selection])

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
    [current, market],
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
  const { balances: modernBalances, isLoading: balancesLoading } = useCryptoBalances()
  const spendable = React.useMemo(() => {
    if (!(usingModern && market === "spot") || !current || !spentSymbol) return null
    const networkId = "networkId" in current ? current.networkId : undefined
    if (!networkId) return null
    const rows = modernBalances.filter(
      (b) =>
        b.symbol.toUpperCase() === spentSymbol.toUpperCase() &&
        b.networkId === networkId,
    )
    // A snapshot that hasn't arrived is not a zero balance. Say nothing until
    // it has: "avail 0.00" against a funded wallet is worse than no figure.
    if (rows.length === 0 && balancesLoading) return null
    return rows.reduce(
      (sum, b) => sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)),
      0,
    )
  }, [modernBalances, balancesLoading, usingModern, market, current, spentSymbol])

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
  const unitSwitchable = Boolean(spentSymbol && !sizesLikeUsd(spentSymbol)) && tradeView.unitSwitch
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
        ? buildSpotOrderPlanFromTokenAmount(current, side, amountText)
        : buildSpotOrderPlan(current, side, usdAmount, price)
    },
    [usingModern, market, current, side, price, inTokenUnit]
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

  // Switching market carries no symbol: a spot pair name is meaningless on the
  // perps list (and vice versa), so the selection effect picks that market's
  // default and the sync effect below writes it back to the URL.
  function setMarketTab(m: Market) {
    // FUTURES GATE (1/4): futures is not open, so the press is ANSWERED rather
    // than followed. Nothing navigates: the URL never gains `market=futures`,
    // `gatedMarket` never sees it, and the spot workspace under the notice
    // keeps its pair, chart and half-filled ticket exactly as they were. The
    // Segmented's `value` stays `market` — always "spot" while gated — so the
    // thumb never comes to rest on a tab whose content isn't on screen.
    if (!FUTURES_LIVE && m === "futures") {
      setFuturesNotice(true)
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
      setError(
        e instanceof Error ? e.message : "Order failed. Try again."
      )
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

  /* One set of 24h figures from whichever source knows this market. High and
     low stay null on a DEX row — the pool reports change and volume but not a
     range, and inventing one from the visible window would label whatever the
     chart happens to show "24h". */
  const changePct24h = stats?.changePct ?? dexStats?.changePct24h ?? null
  const volume24h = stats?.quoteVolume ?? dexStats?.volume24h ?? null
  const high24h = stats?.high ?? null
  const low24h = stats?.low ?? null
  const changeUp = (changePct24h ?? 0) >= 0

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
      {/* The trigger sits ~56px in (back button + gap), so a fixed 340px
          panel anchored at left-0 ends at 396px and is CLIPPED by the root's
          overflow-hidden — on the only pair-switcher phones get, since the
          rail is xl-only. Below sm it spans the viewport instead. */}
      <div className="fixed inset-x-3 top-14 z-50 rounded-2xl bg-card pb-1 shadow-2xl ring-1 ring-border/40 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-[340px]">
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
    <div className="flex flex-col gap-3 p-3.5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Review your order</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
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
        className={`w-full rounded-full py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          futuresReview.side === "buy"
            ? "bg-credit hover:bg-credit/90"
            : "bg-debit hover:bg-debit/90"
        }`}
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
        className="w-full rounded-full bg-surface-sunken py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
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
  const ticket =
    needsTradingAccount && accountError ? (
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-warning"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
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
      <div className="flex flex-col gap-3 p-3.5">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-10 animate-pulse rounded-xl bg-surface-sunken" />
          <div className="h-10 animate-pulse rounded-xl bg-surface-sunken" />
        </div>
        <div className="h-7 w-32 animate-pulse rounded-full bg-surface-sunken" />
        <div className="h-[52px] animate-pulse rounded-xl bg-surface-sunken" />
        <div className="h-11 animate-pulse rounded-full bg-surface-sunken" />
      </div>
    ) : needsTradingAccount && !ready ? (
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
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
      <div className="flex flex-col gap-3.5 p-4">
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

        {/* Side */}
        <div className="grid grid-cols-2 gap-1.5">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
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
              className={`rounded-xl py-3 text-sm font-bold transition-colors ${
                side === s
                  ? s === "buy"
                    ? "bg-credit text-white"
                    : "bg-debit text-white"
                  : "bg-surface-sunken text-muted-foreground hover:bg-accent"
              }`}
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-subtle">Limit price</span>
            <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
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
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
              />
              <span className="pr-3 text-xs text-subtle">USD</span>
            </div>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-subtle">
            <span>Amount</span>
            {/* The wallet's real holding of the token this side spends, on
              this row's chain. Legacy spot keeps quoting the trading account's
              USDC; modern spot has no such account and never did. */}
            {usingModern && market === "spot" ? (
              spendable !== null && (
                <button
                  type="button"
                  onClick={() => {
                    if (spendable <= 0) return
                    // Tapping the balance means "all of it", in whichever unit
                    // the field is currently in.
                    setAmountUsd(
                      String(
                        inTokenUnit
                          ? spendable
                          : Number((spendable * (spentSymbol && sizesLikeUsd(spentSymbol) ? 1 : price)).toFixed(2)),
                      ),
                    )
                  }}
                  data-vivid-target="trade-amount-balance"
                  data-vivid-label="Use the whole available balance"
                  className="tabular-nums transition-colors hover:text-foreground"
                >
                  avail {spendable.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                  {spentSymbol}
                </button>
              )
            ) : market === "spot" && side === "buy" && balances ? (
              <span className="tabular-nums">
                avail ${balances.spotUsdc.toFixed(2)}
              </span>
            ) : null}
            {/* Reduce-only spends nothing, so the free balance is the wrong
              ceiling to quote — the open position is. */}
            {modernFutures && reduceOnly ? (
              openPosition && (
                <span className="tabular-nums">
                  position ${openPosition.notionalUsd.toFixed(2)}
                </span>
              )
            ) : market === "futures" && balances ? (
              <span className="tabular-nums">
                avail ${balances.perpsWithdrawableUsdc.toFixed(2)}
              </span>
            ) : null}
          </span>
          <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
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
              placeholder={inTokenUnit ? `0.00 ${spentSymbol}` : `Min ${minOrder}`}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
            />
            {/* The unit switch. Where a spot row names the token being spent,
                the ticket can size the order in it — which is what the second
                "swap" form under the workspace used to exist for. Switching
                clears the field: the same digits mean a different order. */}
            {unitSwitchable ? (
              <div className="mr-1.5 flex shrink-0 items-center gap-0.5 rounded-lg bg-background/60 p-0.5">
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
                    className={`rounded-md px-1.5 py-1 text-[10px] font-bold transition-colors ${
                      amountUnit === unit
                        ? "bg-surface-sunken text-foreground"
                        : "text-subtle hover:text-foreground"
                    }`}
                  >
                    {unitLabel}
                  </button>
                ))}
              </div>
            ) : (
              // One unit, so name it rather than offering a choice between
              // two spellings of it.
              <span className="pr-3 text-[11px] text-subtle">
                {spentSymbol ?? "USD"}
              </span>
            )}
          </div>
        </label>

        {maxNotional > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
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
                      : String(
                          Math.floor(maxNotional * pct * scale) / scale,
                        ),
                  )
                }}
                className="flex min-h-11 items-center justify-center rounded-lg bg-surface-sunken py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none lg:min-h-0 lg:py-1.5 lg:text-[11px]"
              >
                {pct === 1 ? "Max" : `${pct * 100}%`}
              </button>
            ))}
          </div>
        )}

        {/* Reduce-only (spec §9) — modern perps only. It changes what the rest
          of the ticket even means, so it sits above the controls it removes. */}
        {modernFutures && (
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3 py-2">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold">Reduce only</span>
              <span className="text-[10px] leading-snug text-subtle">
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
            <div className="flex justify-between text-xs text-subtle">
              <span>Leverage</span>
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
              className="mt-1 h-11 w-full cursor-pointer accent-[var(--primary)] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6"
            />
            <div className="flex justify-between text-[9px] text-subtle">
              <span>1×</span>
              <span>{maxLev}×</span>
            </div>
            {/* The venue's own constraint, stated rather than assumed (spec §9).
              There is no cross-margin control to hide — this contract simply
              has one margin mode, and the ticket says which. */}
            {onlyIsolated && (
              <p className="mt-1.5 text-[10px] leading-snug text-subtle">
                Isolated margin only — the margin you commit here backs this
                position alone.
              </p>
            )}
          </div>
        )}

        {market === "futures" && !(modernFutures && reduceOnly) && (
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-subtle">Take profit</span>
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
                className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-credit/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-subtle">Stop loss</span>
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
                className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-debit/40"
              />
            </label>
          </div>
        )}

        {tpslError && (
          <p
            role="alert"
            className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed text-warning"
          >
            {tpslError}
          </p>
        )}

        {reduceOnlyError && (
          <p
            role="alert"
            className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed text-warning"
          >
            {reduceOnlyError}
          </p>
        )}

        {!inTokenUnit && amt > 0 && price > 0 && (
          <div className="divide-y divide-border/15 rounded-xl bg-surface-sunken/70 px-3 text-xs tabular-nums">
            <div className="flex justify-between py-1.5">
              <span className="text-subtle">Qty</span>
              {/* Amount IS the notional; leverage only sets the margin used. The
                places shown are the contract's own `szDecimals` where the
                backend stated it (spec §9) — the estimate should not promise
                precision the venue will round away. */}
              <span>
                ≈ {(amt / price).toFixed(szDecimals ?? 6)} {symbol}
              </span>
            </div>
            {market === "futures" &&
              !(modernFutures && reduceOnly) &&
              leverage > 1 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-subtle">Margin at {leverage}×</span>
                  <span>≈ ${(amt / leverage).toFixed(2)}</span>
                </div>
              )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-debit-chip px-2.5 py-1.5 text-xs leading-relaxed text-debit"
          >
            {error}
          </p>
        )}
        {outcome?.success && (
          <p
            role="status"
            className="rounded-lg bg-credit-chip px-2.5 py-1.5 text-xs leading-relaxed text-credit"
          >
            {outcome.resting
              ? "Limit order resting on the book."
              : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
          </p>
        )}
        {outcome?.success && outcome.tpslWarning && (
          <p
            role="alert"
            className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed font-semibold text-warning"
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
        {usingModern && market === "spot" && spotIntentId && !orderModalOpen && (
          <p
            role="status"
            aria-live="polite"
            className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
              spotIntentStatus === "confirmed"
                ? "bg-credit-chip text-credit"
                : spotIntentStatus === "failed" ||
                    spotIntentStatus === "expired"
                  ? "bg-debit-chip text-debit"
                  : "bg-surface-sunken text-muted-foreground"
            }`}
          >
            {orderCopy(spotIntentStatus, symbol).body}
          </p>
        )}

        {/* Modern perps: this press only BUILDS the order — the review screen's
          confirm is the one that spends, and it is the one carrying the guard. */}
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
          className={`min-h-12 w-full rounded-2xl text-[15px] font-bold text-white shadow-[0_10px_28px_-12px_rgb(0_0_0/0.6)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            side === "buy"
              ? "bg-credit hover:bg-credit/90"
              : "bg-debit hover:bg-debit/90"
          }`}
        >
          {submitting
            ? modernFutures
              ? "Pricing…"
              : "Placing…"
            : pairUnavailable
              ? "Pair unavailable"
              : reduceOnlyError
                ? "Nothing to reduce"
                : modernFutures
                  ? "Review order"
                  : `${market === "futures" ? (side === "buy" ? "Long" : "Short") : side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </button>
      </div>
    )

  /* ── Workspace ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:gap-x-5 lg:px-4 lg:py-2.5 xl:flex-nowrap">
        {/* This route has no sidebar or navbar, so it carries its own way
            out — a back control, not just a clickable logo. */}
        <div className="order-1 flex shrink-0 items-center gap-1.5 lg:order-none">
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

        {/* Market toggle */}
        <Segmented
          value={market}
          onChange={setMarketTab}
          options={MARKET_TABS}
          className="order-4 shrink-0 lg:order-none"
          vividPrefix="market-tab"
        />

        <span className="order-4 hidden shrink-0 rounded-full border border-border/50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase lg:order-none lg:inline-flex">
          Modern wallet
        </span>

        {/* Same control, same place in the reading order as on the wallet:
            beside the screen's own identity, not buried in a settings menu. */}
        <ModeSwitch className="order-4 shrink-0 lg:order-none" />

        {/* Pair — the rail owns switching on wide screens; this dropdown
            covers every width below xl and still works above it. */}
        <div className="relative order-2 shrink-0 lg:order-none">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            data-vivid-target="trade-pair-picker"
            data-vivid-label="Open the pair picker dropdown"
            className="flex items-center gap-1.5 rounded-xl bg-surface-sunken px-2.5 py-2 text-[15px] font-bold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:px-3.5"
          >
            <CoinAvatar symbol={bookCoin ?? symbol} size="md" />
            {symbol || "—"}
            <span className="hidden text-[11px] font-semibold text-subtle sm:inline">
              {market === "futures" ? "PERP" : `/${quoteOf(current)}`}
            </span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-subtle"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {picker}
        </div>

        {/* Price + 24h stats */}
        <div className="scrollbar-none order-3 ml-auto flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-5 lg:order-none lg:ml-0">
          <span
            aria-live="polite"
            className={`shrink-0 font-display text-[22px] font-semibold tracking-[-0.01em] tabular-nums sm:text-2xl ${
              lastTick === "up"
                ? "text-credit"
                : lastTick === "down"
                  ? "text-debit"
                  : ""
            }`}
          >
            ${fmtPx(price)}
          </span>
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${changeUp ? "text-credit" : "text-debit"}`}
          >
            {changePct24h !== null
              ? `${changeUp ? "+" : ""}${changePct24h.toFixed(2)}%`
              : "—"}
          </span>
          {/* A figure we don't have is left out, not printed as an em-dash in
              a column that never fills. */}
          {/* The 24h cluster is reference data for someone reading a market.
              The price and its move answer "is it up or down"; High/Low/
              Volume answer questions a first-time buyer has not asked yet,
              and on a phone they push the price itself off the row. Pro
              keeps all three. */}
          {tradeView.marketStats && high24h !== null && <Stat label="24h High" value={`$${fmtPx(high24h)}`} />}
          {tradeView.marketStats && low24h !== null && <Stat label="24h Low" value={`$${fmtPx(low24h)}`} />}
          {tradeView.marketStats && volume24h !== null && (
            <Stat label="24h Volume" value={fmtCompact(volume24h)} />
          )}
        </div>

        {/* Balances + money doors */}
        <div className="order-5 ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:order-none">
          {balances && (
            <span className="hidden text-xs text-muted-foreground tabular-nums 2xl:block">
              Spot{" "}
              <span className="font-semibold text-foreground">
                ${balances.spotUsdc.toFixed(2)}
              </span>
              {/* FUTURES GATE (3/4): this readout is venue-scoped — it names
                  the margin sitting on the perps venue, an inch from a Futures
                  tab that can't be clicked. Printing it would advertise a
                  place to put money that has no way in or out from this
                  screen. The money itself is not hidden: the same figure is
                  still shown by the funding panel beside this, by the fund
                  screen and by the wallet, all of which can still move it. */}
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
          {/* Funding is a detour from trading, not a destination — it opens
              over the workspace so the chart and the ticket keep their state.
              Spec §10 keeps the three money doors apart: the modern wallet
              renders its own Deposit / Transfer / Withdraw triggers, each
              opening a flow of its own, rather than one blended form. */}
          {usingModern ? (
            user?.userId && modernWallet.data && modernPackage.data ? (
              <ModernFundingPanel
                userId={user.userId}
                wallet={modernWallet.data}
                packageValue={modernPackage.data}
              />
            ) : null
          ) : (
            <>
              <button
                onClick={() => openFlow("fund")}
                data-vivid-target="trade-fund-button"
                data-vivid-label="Open the fund-trading-account modal"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:px-4 sm:py-2 sm:text-sm"
              >
                Fund
              </button>
              <button
                onClick={() => openFlow("trading-withdraw")}
                data-vivid-target="trade-withdraw-button"
                data-vivid-label="Open the withdraw-trading-balance modal"
                className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:px-4 sm:py-2 sm:text-sm"
              >
                Withdraw
              </button>
            </>
          )}
        </div>
      </div>

      {/* FUTURES GATE (4/4): the answer to "I pressed Futures — what happened".
          It stands in for the futures workspace — same place, full width, at
          every breakpoint — and says the venue isn't open yet. The spot
          workspace underneath stays fully live, which is why `ComingSoon` is
          used bare here instead of wrapped around anything: blurring and
          inert-ing the content below would take spot down with it. A live
          region, so pressing the tab is announced and not merely drawn.
          Delete this block when futures opens. */}
      {futuresNotice && (
        <div
          role="status"
          aria-live="polite"
          className="relative shrink-0 border-b border-border/30 bg-surface-sunken/60"
        >
          <ComingSoon compact />
          <button
            type="button"
            onClick={() => setFuturesNotice(false)}
            aria-label="Dismiss"
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Workspace body */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 lg:flex-row lg:gap-2.5 lg:px-3 lg:pb-3">
        {/* Markets rail — the full list lives on the left so switching pairs
            is one click, not a menu dive. */}
        <MarketsRail
          list={list}
          selected={selection}
          onSelect={setSelection}
          className="hidden w-[272px] shrink-0 overflow-hidden rounded-2xl bg-card xl:flex"
        />

        {/* Chart + bottom panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:gap-2.5">
          <div
            /* Taller on phones: the chart is the reason this screen exists, and
               260px of it under a market strip read as a strip of noise. Sized
               against the viewport so it scales with the device instead of
               being tuned to one handset, and capped so the panes below it
               stay reachable without a scroll. */
            className="h-[min(46dvh,420px)] shrink-0 overflow-hidden rounded-2xl bg-card sm:h-[min(50dvh,460px)] lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            data-vivid-target="price-chart"
            data-vivid-label="The candlestick price chart"
          >
            {marketsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-warning"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v5" />
                    <path d="M12 16h.01" />
                  </svg>
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
              <CandleChart source={chartSource} onStats={setDexStats} />
            )}
          </div>
          {/* Spot has neither positions nor resting orders — a swap settles or
              it doesn't — so the two perps tabs could only ever read "none"
              there. One Orders table takes their place; futures keeps the
              drawer, where both concepts are real. */}
          {market === "spot" ? (
            <OrdersPanel className="hidden h-[228px] shrink-0 overflow-hidden rounded-2xl bg-card lg:flex" />
          ) : (
            <PositionsPanel
              account={account}
              busyKey={busyKey}
              onClosePosition={handleClose}
              onCancelOrder={handleCancel}
              className="hidden h-[228px] shrink-0 overflow-hidden rounded-2xl bg-card lg:flex"
            />
          )}

          {/* Below lg the panes share one strip instead of stacking into an
              endless scroll — the chart above never leaves the screen.
              On spot there is only one pane, so there is no tab bar: a
              Segmented offering a single choice is a control that does
              nothing. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card lg:hidden">
            {market === "spot" ? (
              <OrdersPanel className="min-h-0 flex-1" />
            ) : (
              <>
                <div className="scrollbar-none flex shrink-0 items-center overflow-x-auto border-b border-border/30 px-2 py-1.5">
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
            className="hidden w-[248px] shrink-0 border-l border-border/30 lg:flex xl:w-[276px]"
          />
        )}

        {/* Ticket rail — desktop keeps it always-on; below lg it becomes the
            bottom sheet the action bar opens, so the chart owns the screen. */}
        <aside className="hidden shrink-0 overflow-hidden rounded-2xl bg-card lg:block lg:w-[300px] lg:overflow-y-auto xl:w-[328px]">
          {ticket}
        </aside>
      </div>

      {/* Mobile action bar — the ticket is one tap away at all times, and the
          tap already says which side you meant. */}
      <div className="safe-area-bottom flex shrink-0 items-center gap-2 border-t border-border/20 bg-background px-3 py-2.5 lg:hidden">
        <button
          onClick={() => {
            setSide("buy")
            setTicketOpen(true)
          }}
          data-vivid-target="trade-open-ticket-long"
          data-vivid-label="Open the order ticket on the buy/long side"
          className="min-h-12 flex-1 rounded-2xl bg-credit text-[15px] font-bold text-white transition-colors hover:bg-credit/90 focus-visible:ring-2 focus-visible:ring-credit/40 focus-visible:outline-none"
        >
          {market === "futures" ? "Long" : "Buy"}
        </button>
        <button
          onClick={() => {
            setSide("sell")
            setTicketOpen(true)
          }}
          data-vivid-target="trade-open-ticket-short"
          data-vivid-label="Open the order ticket on the sell/short side"
          className="min-h-12 flex-1 rounded-2xl bg-debit text-[15px] font-bold text-white transition-colors hover:bg-debit/90 focus-visible:ring-2 focus-visible:ring-debit/40 focus-visible:outline-none"
        >
          {market === "futures" ? "Short" : "Sell"}
        </button>
      </div>

      {/* Ticket sheet (mobile) */}
      <Dialog.Root open={ticketOpen} onOpenChange={setTicketOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-md lg:hidden" />
          <Dialog.Popup
            aria-label={`${market === "futures" ? (side === "buy" ? "Long" : "Short") : side === "buy" ? "Buy" : "Sell"} ${symbol}`}
            className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] translate-y-0 flex-col rounded-t-3xl bg-card shadow-2xl transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full lg:hidden"
          >
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/[0.16]"
            />
            <div className="flex shrink-0 items-center justify-between px-4 pt-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <CoinAvatar symbol={bookCoin ?? symbol} size="sm" />
                {symbol}
                <span className="text-[11px] font-semibold text-subtle">
                  {market === "futures" ? "PERP" : `/${quoteOf(current)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setTicketOpen(false)}
                aria-label="Close"
                className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
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
