"use client"

/**
 * The swap ticket's state and behaviour: everything SwapClient did before it
 * drew anything. The coin list, the per-chain token sets, the balance read,
 * the routing quote (debounced, re-fetched on the 30s clock), the button's
 * blocker ladder, and the swap itself (unsigned intent, approval if the route
 * needs one, local signing, submit, balance refresh).
 *
 * Moved here VERBATIM from components/swap/swap-client.tsx so the redesigned
 * page (components/swap/redesign) and the old ticket share one copy of the
 * code that moves money. Nothing in it changed in the move; only the mode now
 * comes in as an argument instead of being read beside it.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { COIN_IMAGES } from "@/lib/coin-images"
import { swapView } from "@/lib/swap-view"
import type { UiMode } from "@/lib/ui-mode"
import type { CoinData } from "@/lib/actions"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { signEvmIntent, signSolanaIntent, signSuiIntent, signTronIntent } from "@/lib/crypto-wallet"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"

import {
  BALANCE_NETWORK_ID,
  CHAINS,
  HOUSE_SLIPPAGE,
  QUOTE_TTL_SECONDS,
  SUPPORTED_SWAP_TOKENS,
  chainMeta,
  familyFor,
  networkIdFor,
  routerForPair,
  swapAssetForToken,
  SWAP_ASSETS,
  unavailablePairMessage,
  tokensForChain,
  type SwapChainId,
  type QuoteData,
} from "./swap-model"

/** Convert a calculated token quantity back to the precision the chain can represent. */
/**
 * A displayable message from an error of unknown shape.
 *
 * API routes here return `error` as a string most of the time and as an object
 * on some failures. Anything that reaches React as a child has to be a string,
 * so this is the narrowing point: known message-bearing shapes are unwrapped,
 * and anything else falls back to a sentence a reader can act on rather than
 * to `[object Object]`.
 */
function errorText(value: unknown, fallback = "Failed to get quote"): string {
  if (typeof value === "string" && value.trim()) return value
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["message", "error", "detail", "reason"]) {
      const inner = record[key]
      if (typeof inner === "string" && inner.trim()) return inner
    }
  }
  return fallback
}

function canonicalTokenAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0"
  const fixed = amount.toFixed(decimals)
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

async function waitForSwapApproval(intentId: string): Promise<void> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const intent = await cryptoBackendClient.getIntent(intentId)
    if (intent.status === "confirmed") return
    if (["failed", "expired", "cancelled"].includes(intent.status)) {
      throw new Error("The token approval did not complete. Refresh and try again.")
    }
    await new Promise((resolve) => window.setTimeout(resolve, 3_000))
  }
  throw new Error("The token approval is still confirming. Wait a moment, then try the swap again.")
}

export function tokenIdentifier(chain: string, coin: CoinData): string {
  const assetAddress = swapAssetForToken(chain, coin.symbol)?.address
  return coin.contractAddress ?? (assetAddress && assetAddress !== "native" ? assetAddress : coin.symbol)
}

export function looksLikeTokenIdentifier(chain: string, value: string): boolean {
  if (chain === "ethereum" || chain === "arbitrum") return /^0x[0-9a-fA-F]{40}$/.test(value)
  if (chain === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  if (chain === "sui") return /^0x[0-9a-fA-F]{64}$/.test(value)
  if (chain === "tron") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)
  return false
}


export function useSwapTicket({ coins, prices, mode }: { coins: CoinData[]; prices: Record<string, number>; mode: UiMode }) {
  const isSimple = mode === "simple"
  const view = React.useMemo(() => swapView(mode), [mode])
  const available = React.useMemo(() => {
    const result = coins.filter((coin) => coin.price > 0)
    const symbols = new Set(result.map((coin) => coin.symbol.toUpperCase()))
    for (const asset of SWAP_ASSETS) {
      if (symbols.has(asset.symbol.toUpperCase())) continue
      symbols.add(asset.symbol.toUpperCase())
      result.push({
        id: asset.assetId,
        symbol: asset.symbol,
        name: asset.symbol,
        price: prices[asset.symbol] ?? 0,
        change24h: 0,
        marketCap: 0,
        volume24h: 0,
        image: COIN_IMAGES[asset.symbol] ?? "",
        ...(asset.kind === "token" ? { contractAddress: asset.address } : {}),
      })
    }
    return result
  }, [coins, prices])

  const { user } = useAuth()
  const { balances: modernBalances, refresh: refreshBalances } = useCryptoBalances()
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
  const fromCoins = React.useMemo(() => [...tokensForChain(fromChain, available), ...(fromCoin?.contractAddress ? [fromCoin] : [])], [fromChain, available, fromCoin])
  const toCoins = React.useMemo(() => [...tokensForChain(toChain, available), ...(toCoin?.contractAddress ? [toCoin] : [])], [toChain, available, toCoin])

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
    const asset = swapAssetForToken(fromChain, fromCoin.symbol)
    return modernBalances
      .filter((b) => b.networkId === networkId && (asset?.address && asset.address !== "native"
        ? b.asset.identifier.toLowerCase() === asset.address.toLowerCase()
        : b.symbol.toUpperCase() === fromCoin.symbol.toUpperCase()))
      .reduce((sum, b) => sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)), 0)
  }, [modernBalances, fromCoin, fromChain])

  // Can this pair be quoted and executed at all?
  const fromSupported = (SUPPORTED_SWAP_TOKENS[fromChain]?.includes(fromCoin?.symbol ?? "") ?? false) || Boolean(fromCoin?.contractAddress)
  const toSupported = (SUPPORTED_SWAP_TOKENS[toChain]?.includes(toCoin?.symbol ?? "") ?? false) || Boolean(toCoin?.contractAddress)
  const selectedRouter = routerForPair(fromChain, toChain)
  const canQuote = fromSupported && toSupported && !!selectedRouter && isCryptoBackendEnabled

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
        const sourceAsset = swapAssetForToken(fromChain, fromCoin.symbol)
        const quotedAmount = sourceAsset ? canonicalTokenAmount(numericFrom, sourceAsset.decimals) : numericFrom.toString()
        const qs = new URLSearchParams({
          fromChain,
          toChain,
          fromToken: tokenIdentifier(fromChain, fromCoin),
          toToken: tokenIdentifier(toChain, toCoin),
          amount: quotedAmount,
        slippage: (effectiveSlippage / 100).toString(),
      })
      const quotePath = selectedRouter === "lifi" ? "/api/crypto/trading/spot/lifi/quote" : "/api/crypto/trading/spot/provider/quote"
      fetch(`${quotePath}?${qs}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.quote) {
            setQuoteData(data.quote)
            setQuoteError(null)
            setQuotedAt(Date.now())
          } else {
            setQuoteData(null)
            // `data.error` is whatever the route put there, and on a 401 it is
            // an OBJECT. This state is typed `string | null`, but the response
            // is parsed JSON so TypeScript never sees the lie — the object went
            // straight into the state and then into JSX, where React refuses to
            // render it and takes the whole page down with
            // "Objects are not valid as a React child". Typing an amount into
            // the swap form was enough to trigger it. Coerced at the boundary,
            // which is the only place that knows the value is untrusted.
            setQuoteError(errorText(data.error))
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
  }, [fromAmount, fromCoin?.symbol, toCoin?.symbol, fromChain, toChain, effectiveSlippage, numericFrom, canQuote, refreshNonce, selectedRouter])

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
      if (!selectedRouter) throw new Error(unavailablePairMessage(fromChain, toChain))
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) {
        resumeAfterUnlock.current = () => void handleSwap()
        setUnlockOpen(true)
        return
      }
      const sourceFamily = familyFor(fromChain as SwapChainId)
      const account = modernWallet.data.accounts.find((item) => item.chainFamily === sourceFamily && item.state === "active")
      if (!account?.id) throw new Error(`Your wallet isn't ready for ${chainMeta(fromChain).label} yet`)
      const amountBaseUnits = toBaseUnits(canonicalTokenAmount(numericFrom, quoteData.fromToken.decimals), quoteData.fromToken.decimals)
      if (!amountBaseUnits || amountBaseUnits === "0") throw new Error("The amount is too small for this coin")
      const idempotencyKey = swapIdempotencyKey.current ?? (swapIdempotencyKey.current = crypto.randomUUID())
       let intentPlan = await cryptoBackendClient.createModernLifiSwapIntent({
         sourceNetworkId: networkIdFor(fromChain as SwapChainId),
         destinationNetworkId: networkIdFor(toChain as SwapChainId),
         sellToken: quoteData.fromToken.address,
        buyToken: quoteData.toToken.address,
        sellAmountBaseUnits: amountBaseUnits,
        slippagePercentage: effectiveSlippage / 100,
         idempotencyKey,
       })
       if (intentPlan.requiresApproval) {
         for (const approval of intentPlan.intents) {
           if (sourceFamily !== "evm") throw new Error("This route returned an invalid EVM approval step")
           const signedApproval = await signEvmIntent(user.userId, modernWallet.data.id, modernPackage.data, approval, account.id)
           await cryptoBackendClient.submitIntent(approval.id, signedApproval)
           await waitForSwapApproval(approval.id)
         }
         // Rebuild the quote and transaction after the approval is confirmed;
         // the original LI.FI calldata may have expired and its nonce is stale.
         intentPlan = await cryptoBackendClient.createModernLifiSwapIntent({
           sourceNetworkId: networkIdFor(fromChain as SwapChainId),
           destinationNetworkId: networkIdFor(toChain as SwapChainId),
           sellToken: quoteData.fromToken.address,
           buyToken: quoteData.toToken.address,
           sellAmountBaseUnits: amountBaseUnits,
           slippagePercentage: effectiveSlippage / 100,
           idempotencyKey,
         })
       }
       const intent = intentPlan.intents[0]
       if (!intent) throw new Error("The swap route returned no transaction intent")
       const signed = sourceFamily === "solana"
        ? await signSolanaIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
        : sourceFamily === "sui"
          ? await signSuiIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
          : sourceFamily === "tron"
              ? await signTronIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
              : await signEvmIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
      const submitted = await cryptoBackendClient.submitIntent(intent.id, signed)
      setSwapResult({ success: true, status: "PENDING", txHash: submitted.txHash })
      // Balance snapshots are intentionally cached between explicit refreshes.
      // Refresh immediately after broadcast, then retry while the chain/provider
      // catches up so a newly bought token appears without a page reload.
      void refreshBalances()
      for (const delay of [2_000, 5_000, 10_000]) {
        window.setTimeout(() => { void refreshBalances() }, delay)
      }
      swapIdempotencyKey.current = null
      setFromAmount(""); setQuoteData(null); setQuotedAt(null)
    } catch (error) {
      const message = formatWalletActionError(error, fromChain, fromCoin?.symbol)
      setSwapResult({ success: false, error: message })
    } finally {
      setSwapLoading(false)
    }
  }, [quoteData, swapLoading, numericFrom, effectiveSlippage, user, modernWallet.data, modernPackage.data, fromChain, toChain, fromCoin, selectedRouter, refreshBalances])

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

  const insufficientBalance = numericFrom > 0 && numericFrom > fromCoinBalance
  // Unsupported pairs have no execution path — the button must say so, not
  // sit enabled doing nothing on click.
  const canSwap = numericFrom > 0 && !!fromCoin && !!toCoin && !quoteLoading && !swapLoading && !insufficientBalance && canQuote && !!quoteData?.executionData

  /* One button, two vocabularies. Pro is told "no route found" because that is
     the real name for what happened and it tells a trader where to look next;
     Simple is told the price is not available, because "route" is a word about
     our plumbing and not about their money. */
  const buttonText = React.useMemo(() => {
    if (!fromCoin || !toCoin) return "Choose two coins"
    if (!canQuote) return unavailablePairMessage(fromChain, toChain)
    if (!fromAmount || numericFrom <= 0) return "Enter an amount"
    if (insufficientBalance) return isSimple ? `Not enough ${fromCoin.symbol}` : "Insufficient balance"
    if (swapLoading) return "Confirming…"
    if (loadingFirstQuote) return isSimple ? "Checking the price…" : "Fetching quote…"
    if (quoteError) return isSimple ? "Price unavailable right now" : "Quote unavailable"
    if (!quoteData?.executionData) return isSimple ? "No price available right now" : "No route found"
    return "Swap"
  }, [fromCoin, toCoin, fromAmount, numericFrom, loadingFirstQuote, swapLoading, insufficientBalance, quoteError, canQuote, quoteData, isSimple, fromChain, toChain])


  /** The unlock dialog's "done": run whatever the unlock interrupted. */
  const resumeUnlocked = React.useCallback(() => {
    const resume = resumeAfterUnlock.current
    resumeAfterUnlock.current = null
    resume?.()
  }, [])

  return {
    view,
    resumeUnlocked,
    isSimple,
    available,
    buttonText,
    canQuote,
    canSwap,
    cycleChain,
    effectiveSlippage,
    estimatedTo,
    estimatedToFallback,
    flipPair,
    fromAmount,
    fromChain,
    fromCoin,
    fromCoinBalance,
    fromCoins,
    fromPrice,
    fromSupported,
    handleSwap,
    initAmount,
    initFrom,
    initTo,
    insufficientBalance,
    isDollarMode,
    loadingFirstQuote,
    modernBalances,
    modernPackage,
    modernWallet,
    nowMs,
    numericFrom,
    quoteData,
    quoteDebounceMs,
    quoteError,
    quoteLoading,
    quotedAt,
    refreshBalances,
    refreshNonce,
    refreshingQuote,
    requestFreshQuote,
    resumeAfterUnlock,
    searchParams,
    secondsLeft,
    selectedRouter,
    setFromAmount,
    setFromChain,
    setFromCoin,
    setIsDollarMode,
    setNowMs,
    setPercentage,
    setQuoteData,
    setQuoteError,
    setQuoteLoading,
    setQuotedAt,
    setRefreshNonce,
    setSearchParams,
    setShowFromModal,
    setShowToModal,
    setSlippage,
    setSwapLoading,
    setSwapResult,
    setToChain,
    setToCoin,
    setUnlockOpen,
    showFromModal,
    showToModal,
    slippage,
    swapIdempotencyKey,
    swapLoading,
    swapResult,
    toChain,
    toCoin,
    toCoins,
    toPrice,
    toSupported,
    tokenAmount,
    unlockOpen,
    usdValue,
    user,
  }
}

export type SwapTicketState = ReturnType<typeof useSwapTicket>
