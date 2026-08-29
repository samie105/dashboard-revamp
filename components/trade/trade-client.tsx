"use client"

/**
 * Worldstreet trading workspace. Modern-wallet futures orders use the
 * crypto backend's Hyperliquid intent flow; spot discovery comes from the
 * broader Worldstreet market feed and is never sourced from Hyperliquid.
 * Legacy Privy trading remains available through the existing routes.
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
  fetchHlMarkets,
  fetchHlAccount,
  placeSpotOrder,
  placeFuturesOrder,
  closePosition,
  cancelOrder,
  CryptoApiError,
  type HlMarkets,
  type HlAccount,
  type HlOrderOutcome,
  marketRowKey,
  type HlSpotMarket,
  type HlFuturesMarket,
} from "@/lib/crypto-api"
import { networkMetaFor } from "@/lib/crypto-backend/network-meta"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
  LIQUIDATION_WARNING,
  readFuturesOrderFigures,
  reduceOnlyProblem,
  type HyperliquidIntent,
} from "@/lib/crypto-backend"
import { buildSpotOrderPlan } from "@/lib/crypto-backend/spot-order"
import { signHyperliquidIntent, signEvmIntent, signSolanaIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { useAuth } from "@/components/auth-provider"
import { useWalletMode } from "@/components/wallet-mode-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import {
  fetchHlOrderBook,
  fetchHl24hStats,
  type HlOrderBook,
  type Hl24hStats,
} from "@/lib/hl-public"
import { CandleChart } from "@/components/trade/candle-chart"
import { OrderBook } from "@/components/trade/order-book"
import { PositionsPanel } from "@/components/trade/positions-panel"
import { MarketsRail } from "@/components/trade/markets-rail"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { BackAction, Eyebrow, Segmented, type SegmentedOption } from "@/components/ui/system"
import { AnnouncementBanner, DetailPanel, InlineNotice } from "@/components/ui/flow"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { registerVividContext } from "@/lib/vivid-page-context"
import { ModernFundingPanel } from "./modern-funding-panel"
import { ModernJupiterPanel } from "./modern-jupiter-panel"

type Market = "spot" | "futures"
type Side = "buy" | "sell"
type OrderType = "market" | "limit"

const MARKET_TABS: readonly SegmentedOption<Market>[] = [
  { key: "spot", label: "Spot" },
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
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const modernWallet = useCryptoWalletState()
  const modernPackage = useQuery({
    queryKey: ["crypto", "wallet-package", user?.userId ?? "anonymous"],
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && !!modernWallet.data,
    staleTime: 3 * 60_000,
  })

  const market: Market = params.get("market") === "futures" ? "futures" : "spot"
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
  const [leverage, setLeverage] = React.useState(1)
  // Modern futures only (spec §9): an order that may only shrink exposure.
  const [reduceOnly, setReduceOnly] = React.useState(false)
  const [tpPrice, setTpPrice] = React.useState("")
  const [slPrice, setSlPrice] = React.useState("")
  const [search, setSearch] = React.useState("")
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
  const [futuresReview, setFuturesReview] = React.useState<FuturesReview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  // Mobile-only view state: which pane sits under the chart, and whether the
  // order ticket sheet is up.
  const [mobilePane, setMobilePane] = React.useState<"book" | "positions" | "orders">("book")
  const [ticketOpen, setTicketOpen] = React.useState(false)
  // Load failures are tracked apart from order errors: an unreachable account
  // must never be mistaken for an account that exists but isn't set up.
  const [marketsError, setMarketsError] = React.useState(false)
  const [accountError, setAccountError] = React.useState(false)
  const { mode: walletSource, setMode: setWalletSource, canChoose: canChooseWallet } = useWalletMode()

  const usingModern = walletSource === "modern" && isCryptoBackendEnabled

  // Spot intent status — the same poll `useTransactionIntent` runs for
  // transfers, on the same cache key, so a spot order's terminal state comes
  // from the backend rather than from the fact that we managed to submit it.
  // It stops only on a terminal status; anything else is still in flight.
  const spotIntentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(user?.userId ?? "anonymous", spotIntentId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getIntent(spotIntentId as string, signal),
    enabled: isCryptoBackendEnabled && Boolean(spotIntentId),
    refetchInterval: (query) => {
      // The backend's terminal statuses (see `sendStageIndex` for the full
      // vocabulary); everything else — created/signed/submitted/pending/
      // unknown, or a status this client hasn't been taught — is still moving.
      const status = query.state.data?.status
      return status === "confirmed" || status === "failed" || status === "expired" ? false : 5_000
    },
  })
  const spotIntentStatus = spotIntentId ? spotIntentQuery.data?.status : undefined

  // The balance snapshot has `staleTime: Infinity` (spec §5's explicit-
  // invalidation list) — a confirmed spot trade has to say so itself or the
  // wallet page shows pre-trade balances forever. Guarded on the created→
  // confirmed TRANSITION (a ref, not the poll tick) so this can only fire
  // once per intent.
  const spotBalancesInvalidatedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (spotIntentStatus !== "confirmed" || !spotIntentId || spotBalancesInvalidatedFor.current === spotIntentId) return
    spotBalancesInvalidatedFor.current = spotIntentId
    const uid = user?.userId ?? "anonymous"
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(uid) })
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(uid) })
  }, [spotIntentStatus, spotIntentId, queryClient, user?.userId])

  // Markets + account
  const refreshAccount = React.useCallback(() => {
    if (market === "spot") { setAccount(null); setAccountError(false); return }
    const request = usingModern ? cryptoBackendClient.getHyperliquidAccount() : fetchHlAccount()
    request
      .then((a) => { setAccount(a as HlAccount); setAccountError(false) })
      .catch(() => setAccountError(true))
  }, [usingModern, market])

  const loadMarkets = React.useCallback(() => {
    setMarketsError(false)
    if (!usingModern) {
      fetchHlMarkets().then(setMarkets).catch(() => setMarketsError(true))
      return
    }
    if (market === "spot") {
      // Spec §8: the registry IS the catalogue. Every field the order builder
      // needs — quote asset, token addresses, mints — is carried through
      // verbatim; nothing downstream may re-derive them from the symbol.
      cryptoBackendClient.getModernSpotMarkets()
        .then((result) => setMarkets({
          minOrderUsd: 1,
          futures: [],
          spot: result.markets.filter((coin) => coin.chartSupported).map((coin) => ({
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
          })),
        }))
        .catch(() => setMarketsError(true))
      return
    }
    cryptoBackendClient.getHyperliquidMarkets()
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
            ...(typeof item.szDecimals === "number" ? { szDecimals: item.szDecimals } : {}),
            ...(item.onlyIsolated ? { onlyIsolated: true } : {}),
          })),
          spot: [],
        })
      })
      .catch(() => setMarketsError(true))
  }, [usingModern, market])

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
    () => (market === "spot" ? (markets?.spot ?? []) : (markets?.futures ?? [])),
    [markets, market],
  )
  React.useEffect(() => {
    if (!list.length) return
    const wanted = urlSymbol.toUpperCase()
    const chosen =
      (urlRowId ? list.find((m) => marketRowKey(m) === urlRowId) : undefined) ??
      (wanted ? list.find((m) => m.symbol.toUpperCase() === wanted) : undefined) ??
      list.find((m) => m.symbol === "BTC") ??
      list[0]
    setSelection(marketRowKey(chosen))
  }, [list, urlSymbol, urlRowId])

  const current = React.useMemo(() => list.find((m) => marketRowKey(m) === selection), [list, selection])
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
  const onlyIsolated = Boolean(current && "onlyIsolated" in current && current.onlyIsolated)

  // Clamp leverage when switching to a contract with a lower max — otherwise
  // the stale higher value is displayed and sent. Futures only: on the Spot
  // tab maxLev is 1 and must not wipe the user's futures setting.
  React.useEffect(() => {
    if (market !== "futures" || !current) return
    setLeverage((l) => Math.min(l, maxLev))
  }, [market, current, maxLev])

  // A new row, market or wallet mode invalidates everything priced in the old
  // one — including the modern swap being polled, which belongs to neither the
  // next pair nor the legacy ticket.
  React.useEffect(() => {
    setLimitPrice("")
    setTpPrice("")
    setSlPrice("")
    setOutcome(null)
    setSpotIntentId(null)
    // A review holds an intent priced for one contract in one wallet mode. It
    // is discarded rather than carried: an unsigned intent expires on its own,
    // and confirming a stale one would trade the pair the user just left.
    setFuturesReview(null)
    setReduceOnly(false)
    setError(null)
  }, [selection, market, walletSource])

  // Order book — futures use the bare symbol; spot uses the coinName.
  const bookCoin = React.useMemo(() => {
    if (!current || (usingModern && market === "spot")) return null
    return market === "spot" ? (current as { coinName: string }).coinName : current.symbol
  }, [current, market, usingModern])

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
    return () => { cancelled = true; clearInterval(id) }
  }, [bookCoin])

  // 24h stats for the header — derived from public candles, refreshed slowly.
  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setStats(null)
    const load = () =>
      fetchHl24hStats(bookCoin).then((s) => { if (!cancelled) setStats(s) }).catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [bookCoin])

  const price = book?.midPrice ?? current?.price ?? 0
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
  const spotPlan = React.useMemo(
    () => (usingModern && market === "spot" && current ? buildSpotOrderPlan(current, side, Math.max(amt, minOrder), price) : null),
    [usingModern, market, current, side, amt, minOrder, price],
  )
  const pairUnavailable = spotPlan?.kind === "unavailable"

  // No row to trade: the registry failed, came back empty, or the selected
  // market vanished from a refresh. `markets === null` is still loading, and
  // must not be reported as unavailable.
  const spotMarketsUnavailable = usingModern && market === "spot" && !current && (marketsError || markets !== null)

  // The Jupiter panel is the selected Solana row's own, or nothing at all. The
  // registry row goes in whole — the panel derives nothing itself.
  const jupiterMarket = React.useMemo(
    () => (current && "venue" in current && current.venue === "jupiter" ? current : null),
    [current],
  )
  /** The modern-mode perpetuals ticket — the only path spec §9 governs. */
  const modernFutures = usingModern && market === "futures"
  const openPosition = account?.positions.find((p) => p.symbol === symbol)
  // Reduce-only is answerable from the account already on screen, so the
  // ticket refuses an order the venue would reject rather than discovering it
  // after a signature (spec §9).
  const reduceOnlyError =
    modernFutures && reduceOnly ? reduceOnlyProblem(openPosition, symbol || "this market", side) : null
  const canSubmit =
    !submitting && !!current && amt >= minOrder &&
    (orderType === "market" || parseFloat(limitPrice) > 0) && !tpslError && !pairUnavailable &&
    !reduceOnlyError

  // Switching market carries no symbol: a spot pair name is meaningless on the
  // perps list (and vice versa), so the selection effect picks that market's
  // default and the sync effect below writes it back to the URL.
  function setMarketTab(m: Market) {
    router.replace(`/trade?market=${m}`)
  }

  // Keep the address bar honest — it's what gets refreshed, shared and
  // bookmarked, so it must name the row actually on screen, id included.
  React.useEffect(() => {
    if (!current) return
    const rowId = "id" in current && current.id ? current.id : ""
    if (urlSymbol.toUpperCase() === current.symbol.toUpperCase() && urlRowId === rowId) return
    router.replace(
      `/trade?market=${market}&symbol=${encodeURIComponent(current.symbol)}${rowId ? `&id=${encodeURIComponent(rowId)}` : ""}`,
    )
  }, [current, market, urlSymbol, urlRowId, router])

  async function submit() {
    if (!current) return
    setSubmitting(true)
    setError(null)
    setOutcome(null)
    setSpotIntentId(null)
    try {
      const base = {
        symbol: current.symbol,
        side,
        orderType,
        amountUsd: amt,
        ...(orderType === "limit" ? { limitPrice: parseFloat(limitPrice) } : {}),
      }
      if (usingModern) {
        const accountFor = (family: string) =>
          modernWallet.data?.accounts.find((item) => item.chainFamily === family && item.state === "active")
        const packageValue = modernPackage.data
        if (!user?.userId || !modernWallet.data?.id || !packageValue) throw new Error("Set up and unlock the modern wallet before trading")
        if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) throw new Error("Unlock the modern wallet locally before trading")
        if (market === "spot") {
          // The registry row is the whole order: venue, network, token
          // identifiers and precision all come from it (spec §8).
          const plan = buildSpotOrderPlan(current, side, amt, price)
          if (plan.kind === "unavailable") { setError(plan.reason); return }
          const walletId = modernWallet.data.id
          const signingAccount = accountFor(plan.kind === "evm" ? "evm" : "solana")
          if (!signingAccount) {
            throw new Error(plan.kind === "evm"
              ? "Your Worldstreet wallet doesn't have an Ethereum account yet."
              : "Your Worldstreet wallet doesn't have a Solana account yet.")
          }
          const intent = plan.kind === "evm"
            ? await cryptoBackendClient.createModernSpotIntent(plan.input)
            : await cryptoBackendClient.createModernSolanaSpotIntent(plan.input)
          const signed = plan.kind === "evm"
            ? await signEvmIntent(user.userId, walletId, packageValue, intent, signingAccount.id)
            : await signSolanaIntent(user.userId, walletId, packageValue, intent, signingAccount.id)
          await cryptoBackendClient.submitIntent(intent.id, signed)
          // Submitted is not filled: the status line below follows the intent
          // poll and only reads as complete once the backend says `confirmed`.
          setSpotIntentId(intent.id)
          return
        }
        const evmAccount = accountFor("evm")
        if (!evmAccount) throw new Error("Set up and unlock the modern wallet before trading")
        // Spec §9: review and explicit approval come BEFORE the signature. The
        // intent the backend builds here is unsigned — no leverage change, no
        // order, nothing has reached the venue — so the review screen can state
        // the backend's own size, price, fee and liquidation figures and let
        // the user walk away from them. `confirmFuturesOrder` does the signing.
        const intent = await cryptoBackendClient.createHyperliquidIntent({
          type: "order", market: "futures", symbol: current.symbol, side, orderType, amountUsd: amt,
          ...(orderType === "limit" ? { limitPrice: parseFloat(limitPrice) } : {}),
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
      } else {
        const res = market === "spot"
          ? await placeSpotOrder(base)
          : await placeFuturesOrder({ ...base, leverage, ...(tp > 0 ? { takeProfitPrice: tp } : {}), ...(sl > 0 ? { stopLossPrice: sl } : {}) })
        setOutcome(res)
        if (!res.success && res.error) setError(res.error)
      }
      refreshAccount()
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Order failed. Try again.")
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
        (item) => item.chainFamily === "evm" && item.state === "active",
      )
      const packageValue = modernPackage.data
      if (!user?.userId || !modernWallet.data?.id || !packageValue || !evmAccount) {
        throw new Error("Set up and unlock the modern wallet before trading")
      }
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) {
        throw new Error("Unlock the modern wallet locally before trading")
      }
      const signatures = await signHyperliquidIntent(
        user.userId, modernWallet.data.id, packageValue, evmAccount.id, review.intent.steps,
      )
      const submitted = await cryptoBackendClient.submitHyperliquidIntent(review.intent.id, signatures)
      const result = submitted.results[submitted.results.length - 1] as { response?: { data?: { statuses?: unknown[] } } }
      const status = result?.response?.data?.statuses?.[0] as Record<string, unknown> | undefined
      const filled = status && "filled" in status ? status.filled as Record<string, unknown> : undefined
      const resting = status && "resting" in status
      const figures = readFuturesOrderFigures(review.intent.summary)
      setOutcome({
        success: true, symbol: review.symbol, side: review.side,
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
      setError(e instanceof CryptoApiError ? e.message : e instanceof Error ? e.message : "Order failed. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose(sym: string) {
    setBusyKey(`close:${sym}`)
    try {
      const position = account?.positions.find((item) => item.symbol === sym)
      if (usingModern) {
        const evmAccount = modernWallet.data?.accounts.find((item) => item.chainFamily === "evm" && item.state === "active")
        if (!user?.userId || !modernWallet.data?.id || !modernPackage.data || !evmAccount || !position) throw new Error("Unlock the modern wallet before closing a position")
        const intent = await cryptoBackendClient.createHyperliquidIntent({ type: "order", market: "futures", symbol: sym, side: position.side === "long" ? "sell" : "buy", orderType: "market", size: Math.abs(Number(position.size)), reduceOnly: true, idempotencyKey: crypto.randomUUID() })
        const signatures = await signHyperliquidIntent(user.userId, modernWallet.data.id, modernPackage.data, evmAccount.id, intent.steps)
        await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      } else await closePosition({ symbol: sym })
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
      if (usingModern) {
        // Worldstreet-wallet spot is an on-chain swap, not a resting order on
        // the perpetuals venue — there is nothing here to cancel.
        if (mkt === "spot") throw new Error("Worldstreet wallet spot orders are on-chain swaps — there's no resting order to cancel.")
        const evmAccount = modernWallet.data?.accounts.find((item) => item.chainFamily === "evm" && item.state === "active")
        if (!user?.userId || !modernWallet.data?.id || !modernPackage.data || !evmAccount) throw new Error("Unlock the modern wallet before cancelling an order")
        const intent = await cryptoBackendClient.createHyperliquidIntent({ type: "cancel", market: "futures", symbol: sym, oid, idempotencyKey: crypto.randomUUID() })
        const signatures = await signHyperliquidIntent(user.userId, modernWallet.data.id, modernPackage.data, evmAccount.id, intent.steps)
        await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      } else await cancelOrder({ oid, symbol: sym, market: mkt })
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
      ...(market === "futures" ? { leverage, takeProfit: tpPrice || null, stopLoss: slPrice || null } : {}),
      ...(modernFutures ? { reduceOnly } : {}),
      readyToSubmit: canSubmit,
      ...(canSubmit ? {} : { blockedBecause: !current ? "markets not loaded" : spotPlan?.kind === "unavailable" ? spotPlan.reason : amt < minOrder ? `amount below the ${minOrder} minimum` : reduceOnlyError ?? tpslError ?? "limit price missing" }),
    },
    // Spec §9: a reviewed-but-unsigned order is a distinct state — nothing has
    // been sent, and the next press is the one that spends money.
    awaitingOrderApproval: Boolean(futuresReview),
    openPositions: account?.positions.length ?? 0,
    openOrders: account?.openOrders.length ?? 0,
    tradingAccountReady: account?.ready ?? false,
  }
  React.useEffect(() => registerVividContext("tradeWorkspace", () => vividSnap.current), [])

  const filtered = React.useMemo(() => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((m) => m.symbol.toLowerCase().includes(q))
  }, [list, search])

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
    market === "spot"
      ? side === "buy"
        ? balances?.spotUsdc ?? 0
        : 0
      : modernFutures && reduceOnly
        ? openPosition?.notionalUsd ?? 0
        : (balances?.perpsWithdrawableUsdc ?? 0) * leverage

  const changeUp = (stats?.changePct ?? 0) >= 0

  /* ── Pair picker dropdown ─────────────────────────────────────────────── */
  const picker = pickerOpen && (
    <>
      <button
        aria-label="Close market picker"
        className="fixed inset-0 z-40 cursor-default"
        onClick={() => { setPickerOpen(false); setSearch("") }}
      />
      <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-border/40">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search markets…"
          autoFocus
          data-vivid-target="trade-pair-search"
          data-vivid-label="Search the pair list"
          className="w-full rounded-xl bg-surface-sunken px-3 py-2 text-sm outline-none placeholder:text-subtle"
        />
        <div className="mt-1.5 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No markets match.</p>
          ) : (
            filtered.map((m) => (
              <button
                key={marketRowKey(m)}
                onClick={() => { setSelection(marketRowKey(m)); setPickerOpen(false); setSearch("") }}
                data-vivid-target={`pick-pair-${marketRowKey(m)}`}
                data-vivid-label={`Switch to the ${m.symbol} market${"networkId" in m && m.networkId ? ` on ${m.networkId}` : ""}`}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent ${marketRowKey(m) === selection ? "bg-accent" : ""}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CoinAvatar symbol={"coinName" in m ? m.coinName : m.symbol} src={"icon" in m ? m.icon : undefined} size="md" />
                  {m.symbol}
                  <span className="ml-1 text-[10px] font-medium text-subtle">
                    {market === "futures" ? "PERP" : quoteOf(m)}
                  </span>
                  {"networkId" in m && m.networkId && (
                    <span className="ml-1 rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-medium text-subtle">
                      {networkMetaFor(m.networkId)?.label ?? m.networkId}
                    </span>
                  )}
                  {"maxLeverage" in m && (
                    <span className="ml-1.5 rounded bg-primary/[0.12] px-1 py-0.5 text-[9px] font-bold text-primary">
                      {m.maxLeverage}×
                    </span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">${fmtPx(m.price)}</span>
              </button>
            ))
          )}
        </div>
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
          Nothing has been sent yet. Confirming signs this order on this device and submits it.
        </p>
      </div>

      <DetailPanel
        rows={[
          { label: "Contract", value: `${futuresReview.symbol} PERP` },
          { label: "Direction", value: futuresReview.side === "buy" ? "Long" : "Short" },
          {
            label: "Order type",
            value: futuresReview.orderType === "limit" && futuresReview.limitPrice !== null
              ? `Limit @ $${fmtPx(futuresReview.limitPrice)}`
              : futuresReview.orderType === "limit"
              ? "Limit"
              : "Market",
          },
          { label: "Amount", value: `$${futuresReview.amountUsd.toFixed(2)}` },
          ...(reviewFigures.size !== null
            ? [{ label: "Size", value: `${reviewFigures.size} ${futuresReview.symbol}` }]
            : []),
          ...(reviewFigures.price !== null
            ? [{ label: "Price", value: `$${fmtPx(reviewFigures.price)}` }]
            : []),
          ...(futuresReview.reduceOnly
            ? [{ label: "Reduce only", value: "Yes" }]
            : [{ label: "Leverage", value: `${futuresReview.leverage}×` }]),
          ...(futuresReview.takeProfit !== null
            ? [{ label: "Take profit", value: `$${fmtPx(futuresReview.takeProfit)}` }]
            : []),
          ...(futuresReview.stopLoss !== null
            ? [{ label: "Stop loss", value: `$${fmtPx(futuresReview.stopLoss)}` }]
            : []),
          ...(reviewFigures.liquidationPrice !== null
            ? [{ label: "Liquidation price", value: `$${fmtPx(reviewFigures.liquidationPrice)}` }]
            : []),
          ...(reviewFigures.feeUsd !== null
            ? [{ label: "Estimated fee", value: `$${reviewFigures.feeUsd.toFixed(2)}`, strong: true }]
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
          futuresReview.side === "buy" ? "bg-credit hover:bg-credit/90" : "bg-debit hover:bg-debit/90"
        }`}
      >
        {submitting ? "Signing…" : "Confirm & sign"}
      </button>
      <button
        onClick={() => { setFuturesReview(null); setError(null) }}
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
  const ticket = needsTradingAccount && accountError ? (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
      </span>
      <div>
        <p className="text-sm font-semibold">Can&apos;t reach your trading account</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Your balances and positions couldn&apos;t be loaded, so orders are on hold. Nothing has
          been placed or cancelled.
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
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
    <div className="flex flex-col gap-3 p-3.5">
      {spotMarketsUnavailable && (
        <AnnouncementBanner
          tone="warning"
          title="Markets are unavailable right now"
          detail={marketsError
            ? "The market registry didn't load. Your wallet and balances are unaffected."
            : "The market registry came back empty, so there's nothing to trade here yet."}
          action={{ label: "Try again", onClick: loadMarkets }}
        />
      )}

      {/* Spec §8: an unroutable pair says so before the press, in the pair's
          own words, with the legacy router offered when it's available. */}
      {spotPlan?.kind === "unavailable" && (
        <AnnouncementBanner
          tone="warning"
          title="This pair isn't available on the new wallet yet"
          detail={spotPlan.reason}
          action={canChooseWallet ? { label: "Use old wallet", onClick: () => setWalletSource("legacy") } : undefined}
        />
      )}

      {/* Side */}
      <div className="grid grid-cols-2 gap-1.5">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            aria-label={market === "futures" ? (s === "buy" ? "Long side" : "Short side") : (s === "buy" ? "Buy side" : "Sell side")}
            data-vivid-target={s === "buy" ? "trade-side-buy" : "trade-side-sell"}
            data-vivid-label={market === "futures" ? (s === "buy" ? "Long side" : "Short side") : (s === "buy" ? "Buy side" : "Sell side")}
            className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
              side === s
                ? s === "buy" ? "bg-credit text-white" : "bg-debit text-white"
                : "bg-surface-sunken text-muted-foreground hover:bg-accent"
            }`}
          >
            {market === "futures" ? (s === "buy" ? "Long" : "Short") : (s === "buy" ? "Buy" : "Sell")}
          </button>
        ))}
      </div>

      {/* Type — the house Segmented, same control as everywhere else */}
      <Segmented
        size="sm"
        value={orderType}
        onChange={setOrderType}
        options={ORDER_TYPES}
        className="self-start"
        vividPrefix="order-type"
      />

      {orderType === "limit" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-subtle">Limit price</span>
          <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
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
          {market === "spot" && side === "buy" && balances && (
            <span className="tabular-nums">avail ${balances.spotUsdc.toFixed(2)}</span>
          )}
          {/* Reduce-only spends nothing, so the free balance is the wrong
              ceiling to quote — the open position is. */}
          {modernFutures && reduceOnly ? (
            openPosition && (
              <span className="tabular-nums">position ${openPosition.notionalUsd.toFixed(2)}</span>
            )
          ) : market === "futures" && balances ? (
            <span className="tabular-nums">avail ${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
          ) : null}
        </span>
        <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
          <input
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            data-vivid-target="trade-amount"
            data-vivid-label="Order amount in USD (the notional)"
            aria-label="Order amount in USD"
            placeholder={`Min ${minOrder}`}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
          />
          <span className="pr-3 text-[11px] text-subtle">USD</span>
        </div>
      </label>

      {maxNotional > 0 && (
        <div className="grid grid-cols-4 gap-1">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              data-vivid-target={pct === 1 ? "trade-amount-max" : `trade-amount-${pct * 100}pct`}
              data-vivid-label={pct === 1 ? "Use the full available balance" : `Use ${pct * 100}% of the available balance`}
              aria-label={pct === 1 ? "Use the full available balance as the amount" : `Use ${pct * 100} percent of the available balance as the amount`}
              onClick={() =>
                setAmountUsd(
                  pct === 1
                    ? String(Math.floor(maxNotional * 100) / 100)
                    : (maxNotional * pct).toFixed(2),
                )
              }
              className="rounded-lg bg-surface-sunken py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
            <span className="font-bold tabular-nums text-foreground">{leverage}×</span>
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
            className="mt-1 w-full accent-[var(--primary)]"
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
              Isolated margin only — the margin you commit here backs this position alone.
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
              onChange={(e) => setTpPrice(e.target.value.replace(/[^0-9.]/g, ""))}
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
              onChange={(e) => setSlPrice(e.target.value.replace(/[^0-9.]/g, ""))}
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
        <p role="alert" className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed text-warning">{tpslError}</p>
      )}

      {reduceOnlyError && (
        <p role="alert" className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed text-warning">{reduceOnlyError}</p>
      )}

      {amt > 0 && price > 0 && (
        <div className="divide-y divide-border/15 rounded-xl bg-surface-sunken/70 px-3 text-xs tabular-nums">
          <div className="flex justify-between py-1.5">
            <span className="text-subtle">Qty</span>
            {/* Amount IS the notional; leverage only sets the margin used. The
                places shown are the contract's own `szDecimals` where the
                backend stated it (spec §9) — the estimate should not promise
                precision the venue will round away. */}
            <span>≈ {(amt / price).toFixed(szDecimals ?? 6)} {symbol}</span>
          </div>
          {market === "futures" && !(modernFutures && reduceOnly) && leverage > 1 && (
            <div className="flex justify-between py-1.5">
              <span className="text-subtle">Margin at {leverage}×</span>
              <span>≈ ${(amt / leverage).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-debit-chip px-2.5 py-1.5 text-xs leading-relaxed text-debit">{error}</p>
      )}
      {outcome?.success && (
        <p role="status" className="rounded-lg bg-credit-chip px-2.5 py-1.5 text-xs leading-relaxed text-credit">
          {outcome.resting
            ? "Limit order resting on the book."
            : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
        </p>
      )}
      {outcome?.success && outcome.tpslWarning && (
        <p role="alert" className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs font-semibold leading-relaxed text-warning">
          ⚠ {outcome.tpslWarning} — your position is open without that protection.
        </p>
      )}
      {/* Spec §8: a submitted swap is not a fill. This line follows the intent
          poll and only reads as done on `confirmed`. Modern spot only — the
          legacy ticket must never show a Worldstreet-wallet swap's status. */}
      {usingModern && market === "spot" && spotIntentId && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
            spotIntentStatus === "confirmed"
              ? "bg-credit-chip text-credit"
              : spotIntentStatus === "failed" || spotIntentStatus === "expired"
              ? "bg-debit-chip text-debit"
              : "bg-surface-sunken text-muted-foreground"
          }`}
        >
          {spotIntentStatus === "confirmed"
            ? `Swap confirmed on-chain. Your ${symbol} balance updates shortly.`
            : spotIntentStatus === "failed"
            ? "The swap didn't go through — nothing left your wallet beyond network fees."
            : spotIntentStatus === "expired"
            ? "The swap expired before it confirmed. Nothing was swapped."
            : "Swap submitted. Waiting for on-chain confirmation — this isn't a fill yet."}
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
            ? `Review order — ${side === "buy" ? "long" : "short"} ${symbol}${amt > 0 ? ` for $${amt}` : ""}${reduceOnly ? ", reduce only" : leverage > 1 ? ` at ${leverage}x` : ""}`
            : `Place order — ${market === "futures" ? (side === "buy" ? "long" : "short") : side} ${symbol}${amt > 0 ? ` for $${amt}` : ""}${market === "futures" && leverage > 1 ? ` at ${leverage}x` : ""}`
        }
        data-vivid-label={
          modernFutures
            ? `Build the order and open the review screen — ${side === "buy" ? "long" : "short"} ${symbol}. Nothing is sent until you confirm there.`
            : `Place the order — ${market === "futures" ? (side === "buy" ? "long" : "short") : side} ${symbol} for the amount shown. Moves real money.`
        }
        className={`w-full rounded-full py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "buy" ? "bg-credit hover:bg-credit/90" : "bg-debit hover:bg-debit/90"
        }`}
      >
        {submitting
          ? modernFutures ? "Pricing…" : "Placing…"
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/30 px-3 py-2.5 sm:gap-x-5 lg:flex-nowrap">
        {/* This route has no sidebar or navbar, so it carries its own way
            out — a back control, not just a clickable logo. */}
        <div className="order-1 flex shrink-0 items-center gap-1.5 lg:order-none">
          <BackAction to="/" className="mt-0" />
          <Link href="/" className="hidden items-center sm:flex" title="Dashboard">
            <Image src="/worldstreet-logo/WorldStreet1x.png" alt="Worldstreet" width={72} height={18} className="h-[18px] w-auto object-contain" />
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

        {canChooseWallet ? (
          <Segmented
            value={walletSource}
            onChange={(value) => {
              setWalletSource(value)
              // No `id` here: the row id belongs to one catalogue, and this
              // switch swaps the catalogue. The symbol is the honest carry-over.
              router.replace(`/trade?market=${market}${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ""}&wallet=${value}`)
            }}
            options={[{ key: "modern", label: "New wallet" }, { key: "legacy", label: "Old wallet" }]}
            vividPrefix="wallet-tab"
            className="order-4 shrink-0 lg:order-none"
          />
        ) : null}

        {/* Pair — the rail owns switching on wide screens; this dropdown
            covers every width below xl and still works above it. */}
        <div className="relative order-2 shrink-0 lg:order-none">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            data-vivid-target="trade-pair-picker"
            data-vivid-label="Open the pair picker dropdown"
            className="flex items-center gap-1.5 rounded-xl bg-surface-sunken px-2.5 py-2 text-[15px] font-bold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-3.5"
          >
            <CoinAvatar symbol={bookCoin ?? symbol} size="md" />
            {symbol || "—"}
            <span className="hidden text-[11px] font-semibold text-subtle sm:inline">{market === "futures" ? "PERP" : `/${quoteOf(current)}`}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-subtle"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {picker}
        </div>

        {/* Price + 24h stats */}
        <div className="order-3 ml-auto flex min-w-0 items-center gap-3 overflow-x-auto scrollbar-none sm:gap-5 lg:order-none lg:ml-0">
          <span
            aria-live="polite"
            className={`shrink-0 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${
              lastTick === "up" ? "text-credit" : lastTick === "down" ? "text-debit" : ""
            }`}
          >
            ${fmtPx(price)}
          </span>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${changeUp ? "text-credit" : "text-debit"}`}>
            {stats ? `${changeUp ? "+" : ""}${stats.changePct.toFixed(2)}%` : "—"}
          </span>
          <Stat label="24h High" value={stats ? `$${fmtPx(stats.high)}` : "—"} />
          <Stat label="24h Low" value={stats ? `$${fmtPx(stats.low)}` : "—"} />
          <Stat label="24h Volume" value={stats ? fmtCompact(stats.quoteVolume) : "—"} />
        </div>

        {/* Balances + money doors */}
        <div className="order-5 ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:order-none">
          {balances && (
            <span className="hidden text-xs tabular-nums text-muted-foreground 2xl:block">
              Spot <span className="font-semibold text-foreground">${balances.spotUsdc.toFixed(2)}</span>
              <span className="mx-1 text-subtle">·</span>
              Futures <span className="font-semibold text-foreground">${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
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
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:py-2 sm:text-sm"
              >
                Fund
              </button>
              <button
                onClick={() => openFlow("trading-withdraw")}
                data-vivid-target="trade-withdraw-button"
                data-vivid-label="Open the withdraw-trading-balance modal"
                className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:py-2 sm:text-sm"
              >
                Withdraw
              </button>
            </>
          )}
        </div>
      </div>

      {/* Workspace body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Markets rail — the full list lives on the left so switching pairs
            is one click, not a menu dive. */}
        <MarketsRail
          list={list}
          market={market}
          selected={selection}
          onSelect={setSelection}
          className="hidden w-[236px] shrink-0 border-r border-border/30 xl:flex"
        />

        {/* Chart + bottom panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="h-[260px] shrink-0 sm:h-[320px] lg:h-auto lg:min-h-0 lg:flex-1"
            data-vivid-target="price-chart"
            data-vivid-label="The candlestick price chart"
          >
            {marketsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
                </span>
                <div>
                  <p className="text-sm font-semibold">Markets couldn&apos;t be loaded</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Prices and the order book are unavailable right now. Your balances and open
                    positions are unaffected.
                  </p>
                </div>
                <button
                  onClick={loadMarkets}
                  className="rounded-full bg-surface-sunken px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  Try again
                </button>
              </div>
            ) : !bookCoin ? (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-sm px-6 text-center text-xs leading-relaxed text-muted-foreground">
                  {usingModern && market === "spot"
                    ? "Spot discovery uses Worldstreet’s broader spot market feed. The trading account here handles perpetual futures only."
                    : "Select a market to load its chart."}
                </p>
              </div>
            ) : (
              <CandleChart coin={bookCoin} />
            )}
          </div>
          <PositionsPanel
            account={account}
            busyKey={busyKey}
            onClosePosition={handleClose}
            onCancelOrder={handleCancel}
            className="hidden h-[228px] shrink-0 border-t border-border/30 lg:flex"
          />

          {/* Below lg the book and positions share one pane instead of
              stacking into an endless scroll — one tap to compare, and the
              chart above never leaves the screen. */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-border/30 lg:hidden">
            <div className="flex shrink-0 items-center border-b border-border/30 px-2 py-1.5">
              <Segmented
                size="sm"
                value={mobilePane}
                onChange={setMobilePane}
                options={[
                  { key: "book", label: "Book" },
                  { key: "positions", label: positionCount ? `Positions · ${positionCount}` : "Positions" },
                  { key: "orders", label: orderCount ? `Orders · ${orderCount}` : "Orders" },
                ]}
              />
            </div>
            {mobilePane === "book" ? (
              <OrderBook
                book={book}
                lastTick={lastTick}
                onPickPrice={(p) => { pickPrice(p); setTicketOpen(true) }}
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
          </div>
        </div>

        {/* Order book rail */}
        <OrderBook
          book={book}
          lastTick={lastTick}
          onPickPrice={pickPrice}
          className="hidden w-[248px] shrink-0 border-l border-border/30 lg:flex xl:w-[276px]"
        />

        {/* Ticket rail — desktop keeps it always-on; below lg it becomes the
            bottom sheet the action bar opens, so the chart owns the screen. */}
        <aside className="hidden shrink-0 lg:block lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-border/30 xl:w-[320px]">
          {ticket}
        </aside>
      </div>

      {/* Jupiter's token-denominated panel belongs to the selected Solana pair
          only — it takes that row's mints, never a fixed SOL/USDC pair. The
          key remounts it per row: its typed amount, message and polled intent
          all belong to the pair they were entered against, not the next one. */}
      {usingModern && market === "spot" && jupiterMarket && user?.userId && modernWallet.data && modernPackage.data ? (
        <div className="border-t border-border/30 px-3 py-3 lg:block">
          <ModernJupiterPanel
            key={marketRowKey(jupiterMarket)}
            userId={user.userId}
            wallet={modernWallet.data}
            packageValue={modernPackage.data}
            market={jupiterMarket}
          />
        </div>
      ) : null}

      {/* Mobile action bar — the ticket is one tap away at all times, and the
          tap already says which side you meant. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border/30 bg-background px-3 py-2.5 safe-area-bottom lg:hidden">
        <button
          onClick={() => { setSide("buy"); setTicketOpen(true) }}
          data-vivid-target="trade-open-ticket-long"
          data-vivid-label="Open the order ticket on the buy/long side"
          className="flex-1 rounded-full bg-credit py-3 text-sm font-bold text-white transition-colors hover:bg-credit/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-credit/40"
        >
          {market === "futures" ? "Long" : "Buy"}
        </button>
        <button
          onClick={() => { setSide("sell"); setTicketOpen(true) }}
          data-vivid-target="trade-open-ticket-short"
          data-vivid-label="Open the order ticket on the sell/short side"
          className="flex-1 rounded-full bg-debit py-3 text-sm font-bold text-white transition-colors hover:bg-debit/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-debit/40"
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
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] translate-y-0 flex-col rounded-t-3xl bg-card shadow-2xl outline-none transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full safe-area-bottom lg:hidden"
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/[0.16]" />
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{ticket}</div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
