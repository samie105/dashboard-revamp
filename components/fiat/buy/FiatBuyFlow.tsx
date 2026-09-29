"use client"

/**
 * Buy, following the fiat integration guide. Rendered by BuySellClient when
 * NEXT_PUBLIC_FIAT_BUY_FLOW is "onswitch".
 *
 * Two rails, offered from /fiat/config (team decision, guide §5):
 *  · Local currency → OnSwitch onramp, guide §13 lines 1145-1156:
 *    corridor + wallet-ready asset → quote (amounts, fees, rate, expiry) →
 *    order → payment instructions → poll to a final state.
 *  · USD → Bridge virtual account, guide §13 lines 1168-1178 (BridgeUsdBuy).
 *
 * Layout follows the legacy Buy (house pattern): page = FlowShell +
 * PageHeader, route strip, unboxed amount, eyebrow pickers, receipt,
 * ErrorDetail, CTA; modal = FlowTerminal for the amount form; status =
 * StatusScreen with stages. Logic lives in lib/crypto-backend/fiat-onramp.ts
 * and fiat-bridge-onramp.ts. Payment instructions stay in memory, plain
 * text, never logged (guide §15); only the order id is persisted so a
 * refresh resumes the same order (guide lines 974-975).
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { SectionMessage } from "@/components/crypto/primitives"
import { BridgeUsdBuy } from "@/components/fiat/bridge/BridgeUsdBuy"
import { OnrampOrderScreen } from "@/components/fiat/buy/OnrampOrderScreen"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { refreshWalletBalances } from "@/components/fiat/shared/refreshWalletBalances"
import { FlowTerminal } from "@/components/flows/flow-terminal"
import {
  AnnouncementBanner,
  FlowCta,
  FlowHeader,
  FlowShell,
  FlowSkeleton,
  UnavailablePanel,
  useStageProgress,
} from "@/components/ui/flow"
import { Eyebrow, PageHeader, Segmented } from "@/components/ui/system"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { useFiatOrderPoll } from "@/hooks/crypto/useFiatOrderPoll"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { buyRails, type BuyRail } from "@/lib/crypto-backend/fiat-bridge-onramp"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { describeFiatError, shouldRefetchCapabilities } from "@/lib/crypto-backend/fiat-errors"
import {
  buildOnrampQuoteRequest,
  createOnrampOrder,
  isQuoteUsable,
  isValidAmount,
  normalizeOnswitchHolderName,
  needsRequote,
  onrampOptions,
  onrampOrderView,
  onrampStageIndex,
  paymentInstructionsFrom,
  quoteSecondsLeft,
  requestOnrampQuote,
  type OnrampOption,
  type OnrampQuoteRequest,
} from "@/lib/crypto-backend/fiat-onramp"
import type { FiatOrder, FiatQuote } from "@/lib/crypto-backend/types"
import { clearPendingFlow, readPendingFlow, savePendingFlow } from "@/lib/pending-flow"

const WALLET_SETUP_HREF = "/wallet/modern"
const TITLE = "Buy crypto"
const SUBTITLE = "Pay locally and receive crypto directly in your Worldstreet wallet"

type Props = {
  variant?: "page" | "modal"
  onInFlightChange?: (inFlight: boolean) => void
  onCompactChange?: (compact: boolean) => void
}

/** Re-renders every second while `active`, for expiry countdowns. */
function useNow(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

const sameRequest = (a: OnrampQuoteRequest | null, b: OnrampQuoteRequest | null) =>
  Boolean(a && b) && JSON.stringify(a) === JSON.stringify(b)

type BuySelectOption = {
  value: string
  label: string
  meta?: string
  flag?: string
}

function BuySelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  options: BuySelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selected = options.find((option) => option.value === value)
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">{label}</span>
      <span className="relative block">
        {selected?.flag && (
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[22px] leading-none">
            {selected.flag}
          </span>
        )}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label={label}
          className={`h-14 w-full appearance-none rounded-2xl border border-border/45 bg-background/35 px-4 pr-11 text-sm font-semibold text-foreground outline-none transition focus:border-primary/70 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 ${selected?.flag ? "pl-14" : ""}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.flag ? `${option.flag} ` : ""}{option.label}{option.meta ? ` · ${option.meta}` : ""}
            </option>
          ))}
        </select>
        <svg aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {selected?.meta && <span className="mt-1.5 block text-[12px] text-muted-foreground">{selected.meta}</span>}
    </label>
  )
}

export function FiatBuyFlow({ variant = "page", onInFlightChange, onCompactChange }: Props) {
  const isModal = variant === "modal"
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()

  const [orderId, setOrderId] = React.useState<string | null>(
    () => (typeof window === "undefined" ? null : readPendingFlow("fiat-buy")?.reference ?? null),
  )
  const [railChoice, setRailChoice] = React.useState<BuyRail | null>(null)
  const [corridorKey, setCorridorKey] = React.useState("")
  const [channel, setChannel] = React.useState("")
  const [routeKey, setRouteKey] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [quote, setQuote] = React.useState<FiatQuote | null>(null)
  const [quotedRequest, setQuotedRequest] = React.useState<OnrampQuoteRequest | null>(null)
  const [requoted, setRequoted] = React.useState(false)
  const [checkingPayment, setCheckingPayment] = React.useState(false)

  /* ── Order (existing or just created) ─────────────────────────────── */

  const order = useFiatOrderPoll(orderId ?? undefined)
  const orderMissing = order.error instanceof CryptoBackendError && order.error.status === 404
  const view = order.data ? onrampOrderView(order.data) : null
  const showingOrder = Boolean(orderId) && !orderMissing

  /* ── Selection, all from /fiat/config ─────────────────────────────── */

  const rails = buyRails(config.data)
  const rail: BuyRail | undefined = railChoice && rails.includes(railChoice) ? railChoice : rails[0]
  const options = onrampOptions(config.data)
  const corridors = Array.from(new Map(options.map((o) => [`${o.countryCode}|${o.currencyCode}`, o])).values())
  const activeCorridor = corridors.find((o) => `${o.countryCode}|${o.currencyCode}` === corridorKey) ?? corridors[0]
  const inCorridor = activeCorridor
    ? options.filter((o) => o.countryCode === activeCorridor.countryCode && o.currencyCode === activeCorridor.currencyCode)
    : []
  const channels = Array.from(new Set(inCorridor.map((o) => o.channel)))
  const activeChannel = channels.includes(channel) ? channel : channels[0]
  const routes = inCorridor.filter((o) => o.channel === activeChannel)
  const selected: OnrampOption | undefined = routes.find((o) => o.key === routeKey) ?? routes[0]
  const currentRequest = selected && isValidAmount(amount) ? buildOnrampQuoteRequest(selected, amount) : null
  // A quote only counts for the exact request it was made for; changing the
  // amount or a picker drops it and the CTA goes back to "Get a quote".
  const currentQuote = quote && sameRequest(quotedRequest, currentRequest) ? quote : null

  /* ── Mutations ────────────────────────────────────────────────────── */

  const quoteMutation = useMutation({
    mutationFn: (request: OnrampQuoteRequest) => requestOnrampQuote(cryptoBackendClient, request),
    retry: false,
    onSuccess: (next, request) => {
      setQuote(next)
      setQuotedRequest(request)
    },
    onError: (error) => {
      if (shouldRefetchCapabilities(error)) config.refetchOnProviderError()
    },
  })

  const orderMutation = useMutation({
    mutationFn: (input: { walletId: string; quoteId: string; holderName?: string }) => createOnrampOrder(cryptoBackendClient, input),
    retry: false,
    onSuccess: (created: FiatOrder) => {
      // 201 and a 200 replay both return the order; neither means paid
      // (guide lines 966-969). The screen follows `state` from here on.
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, created.id), created)
      savePendingFlow("fiat-buy", created.id)
      setCheckingPayment(false)
      setOrderId(created.id)
    },
    onError: (error) => {
      if (needsRequote(error) && quotedRequest) {
        // Guide lines 970-971: re-quote. The quote key was released after the
        // last success, so this is a new logical action with a new key.
        setQuote(null)
        setRequoted(true)
        quoteMutation.mutate(quotedRequest)
      } else if (shouldRefetchCapabilities(error)) {
        config.refetchOnProviderError()
      }
    },
  })

  /* ── Effects ──────────────────────────────────────────────────────── */

  // Finished orders stop being "in flight": clear the stored id, and on
  // completion refresh the wallet balance and order history (guide line 961).
  const settledOrder = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!order.data || !view?.terminal || settledOrder.current === order.data.id) return
    settledOrder.current = order.data.id
    clearPendingFlow("fiat-buy")
    if (view.screen === "completed") {
      refreshWalletBalances(queryClient, userId)
      void queryClient.invalidateQueries({ queryKey: ["crypto", "fiat-orders", userId] })
    }
  }, [order.data, view, queryClient, userId])

  React.useEffect(() => {
    if (orderMissing) clearPendingFlow("fiat-buy")
  }, [orderMissing])

  const submitting = quoteMutation.isPending || orderMutation.isPending
  const inFlight = submitting || (showingOrder && !view?.terminal)
  const formReady =
    !showingOrder &&
    isCryptoBackendEnabled &&
    !wallet.needsSetup &&
    !wallet.error &&
    Boolean(config.data) &&
    rails.length > 0
  const usingTerminal = isModal && formReady && rail === "local"
  React.useEffect(() => onInFlightChange?.(inFlight), [inFlight, onInFlightChange])
  React.useEffect(() => onCompactChange?.(!usingTerminal), [usingTerminal, onCompactChange])

  const instructions = order.data ? paymentInstructionsFrom(order.data.providerDisplay) : { rows: [] }
  const now = useNow(Boolean(currentQuote) || Boolean(instructions.expiresAt))
  const stageIndex = order.data ? onrampStageIndex(order.data.state) : null
  const stageProgress = useStageProgress(stageIndex ?? 0, orderId)

  const checkPayment = React.useCallback(() => {
    setCheckingPayment(true)
    order.refresh()
  }, [order.refresh])

  function startOver() {
    clearPendingFlow("fiat-buy")
    setOrderId(null)
    setQuote(null)
    setQuotedRequest(null)
    setRequoted(false)
    setCheckingPayment(false)
    quoteMutation.reset()
    orderMutation.reset()
  }

  /* ── Layout ───────────────────────────────────────────────────────── */

  const shell = (content: React.ReactNode) =>
    isModal ? (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{content}</div>
    ) : (
      <FlowShell className="max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title={TITLE} subtitle={SUBTITLE} back="/" className="mb-4" />
        <div className="flex flex-1 flex-col gap-5">{content}</div>
      </FlowShell>
    )

  const sandbox =
    config.data?.environment === "sandbox" ? (
      <AnnouncementBanner
        title="Sandbox"
        detail="This is the payment provider's test environment. Payments here are for testing."
      />
    ) : null

  /* ── An existing order always wins: the user must see its status ──── */

  if (showingOrder) {
    if (!order.data) {
      if (order.error) {
        return shell(
          <>
            <FiatErrorDetail error={describeFiatError(order.error)} />
            <FlowCta label="Try again" onClick={order.refresh} />
          </>,
        )
      }
      return shell(<FlowSkeleton />)
    }
    return shell(
      <>
        {sandbox}
        <OnrampOrderScreen
          order={order.data}
          view={view!}
          instructions={instructions}
          now={now}
          figure={quote ? `${quote.destinationAmount} ${quote.destinationCurrency}` : undefined}
          stageIndex={stageIndex}
          stageProgress={stageProgress}
          checkingPayment={checkingPayment}
          onRefresh={checkPayment}
          onViewPaymentDetails={() => setCheckingPayment(false)}
          onStartOver={startOver}
        />
      </>,
    )
  }

  /* ── Gates: wallet, then capability (guide §5 lines 368-377) ──────── */

  if (!isCryptoBackendEnabled) {
    return shell(
      <UnavailablePanel
        title="The Worldstreet wallet isn't enabled"
        tone="muted"
        reason="The new wallet is still rolling out and isn't switched on for your account yet."
      />,
    )
  }
  // Same state and copy as SendFlow (components/crypto/send/SendFlow.tsx:660):
  // a confirmed 404 from GET /wallets/me. Both rails deliver into the user's
  // existing WorldStreet wallet (guide lines 16-21, 812-814).
  if (wallet.needsSetup) {
    return shell(
      <UnavailablePanel
        title="You don't have a Worldstreet wallet yet"
        tone="muted"
        reason="Create your Worldstreet wallet first — it only takes a minute."
        action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_SETUP_HREF) }}
      />,
    )
  }
  if (wallet.error) return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  if (config.error && !config.data) {
    return shell(
      <>
        <FiatErrorDetail error={describeFiatError(config.error)} />
        <FlowCta label="Try again" onClick={() => void config.refetch()} />
      </>,
    )
  }
  if (wallet.isLoading || !config.data) return shell(<FlowSkeleton />)
  if (!config.data.enabled || config.data.availability === "disabled") {
    return shell(<UnavailablePanel title="Buying isn't available" tone="muted" reason="This option is switched off right now." />)
  }
  if (config.data.availability === "blocked") {
    return shell(<UnavailablePanel title="Buying is temporarily unavailable" reason="Please try again a little later." />)
  }
  if (config.data.availability === "discovery_only") {
    return shell(<UnavailablePanel title="Buying isn't open yet" tone="muted" reason="You'll be able to buy here soon." />)
  }
  if (rails.length === 0 || !rail) {
    return shell(
      <UnavailablePanel
        title="Nothing is available to buy with right now"
        tone="muted"
        reason="None of the supported currencies can take a payment at the moment."
      />,
    )
  }

  const railTabs =
    rails.length > 1 ? (
      <Segmented
        options={rails.map((r) => ({ key: r, label: r === "local" ? "Local currency" : "USD" }))}
        value={rail}
        onChange={setRailChoice}
        grow
      />
    ) : null

  /* ── USD rail (Bridge) ────────────────────────────────────────────── */

  if (rail === "usd") {
    const walletNetworkIds = wallet.data?.accounts
      ?.flatMap((account) => account.addresses?.map((address) => address.networkId) ?? [])
    const usableWalletNetworkIds = walletNetworkIds && walletNetworkIds.length > 0 ? walletNetworkIds : undefined
    const walletNetworkAddresses = Object.fromEntries(
      (wallet.data?.accounts ?? []).flatMap((account) =>
        (account.addresses ?? []).map((address) => [address.networkId, address.address] as const),
      ),
    )
    const content = (
      <>
        {railTabs}
        {sandbox}
        <div className="rounded-2xl bg-surface-sunken/55 px-4 py-3 ring-1 ring-border/25">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Eyebrow>USD via Bridge</Eyebrow>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Bridge identity verification applies to USD bank details only. It is not an OnSwitch requirement.
              </p>
            </div>
            {rails.length === 1 && (
              <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Only live route
              </span>
            )}
          </div>
          {rails.length === 1 && (
            <p className="mt-2 text-[12px] leading-relaxed text-subtle">
              African local-currency buying will appear here when the backend returns a wallet-ready OnSwitch corridor for this account.
            </p>
          )}
        </div>
        <BridgeUsdBuy
          config={config.data}
          walletId={wallet.data?.id}
          walletNetworkIds={usableWalletNetworkIds}
          walletNetworkAddresses={walletNetworkAddresses}
        />
      </>
    )
    return isModal
      ? shell(
          <>
            <FlowHeader direction="in" title="Buy with USD" subtitle="Bank transfer to your Worldstreet wallet" />
            {content}
          </>,
        )
      : shell(content)
  }

  /* ── Local currency rail (OnSwitch) ───────────────────────────────── */

  if (!activeCorridor || !selected) return shell(<FlowSkeleton />)

  const secondsLeft = currentQuote ? quoteSecondsLeft(currentQuote, now) : 0
  const quoteUsable = currentQuote ? isQuoteUsable(currentQuote, now) : false
  const walletId = wallet.data?.id
  const holderName = normalizeOnswitchHolderName([user?.firstName, user?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" "))
  const holderNameReady = holderName.length >= 3
  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter an amount greater than zero." : null
  const error =
    orderMutation.error && !needsRequote(orderMutation.error)
      ? describeFiatError(orderMutation.error)
      : quoteMutation.error
        ? describeFiatError(quoteMutation.error)
        : null

  const receipt = currentQuote
    ? [
        { label: "You pay", value: `${currentQuote.sourceAmount} ${currentQuote.sourceCurrency}` },
        ...(currentQuote.providerRate ? [{ label: "Rate", value: currentQuote.providerRate }] : []),
        ...(currentQuote.providerFee ? [{ label: "Provider fee", value: currentQuote.providerFee }] : []),
        ...(currentQuote.worldstreetFee ? [{ label: "Worldstreet fee", value: currentQuote.worldstreetFee }] : []),
        { label: "Network", value: currentQuote.network },
        ...(currentQuote.expectedSettlementSeconds
          ? [{ label: "Usually arrives in", value: `about ${Math.max(1, Math.round(currentQuote.expectedSettlementSeconds / 60))} min` }]
          : []),
        { label: "Quote valid for", value: quoteUsable ? formatCountdown(secondsLeft) : "Expired" },
        { label: "You receive", value: `${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}`, strong: true },
      ]
    : null

  const corridorValue = `${activeCorridor.countryCode}|${activeCorridor.currencyCode}`
  const selectedChannel = activeChannel ?? selected.channel
  const selectedCountryName = countryNameForCode(activeCorridor.countryCode, activeCorridor.countryName)
  const selectedCountryFlag = countryFlagForCode(activeCorridor.countryCode)
  const countryOptions: BuySelectOption[] = corridors.map((option) => ({
    value: `${option.countryCode}|${option.currencyCode}`,
    label: countryNameForCode(option.countryCode, option.countryName),
    meta: option.currencyCode,
    flag: countryFlagForCode(option.countryCode),
  }))
  const channelOptions: BuySelectOption[] = channels.map((option) => ({
    value: option,
    label: humanizeValue(option),
    meta: `${activeCorridor.currencyCode} rail`,
  }))
  const receiveOptions: BuySelectOption[] = routes.map((option) => ({
    value: option.key,
    label: option.symbol,
    meta: option.network,
  }))

  const onAmountInput = (value: string) => {
    if (!/^[0-9]*\.?[0-9]*$/.test(value)) return
    const [whole = "", fraction] = value.split(".")
    const normalizedWhole = whole.replace(/^0+(?=\d)/, "")
    if (fraction !== undefined && fraction.length > 2) return
    setAmount(fraction !== undefined ? `${normalizedWhole}.${fraction}` : normalizedWhole)
  }

  const ctaLabel = orderMutation.isPending
    ? "Creating your order…"
    : quoteMutation.isPending
      ? "Getting a quote…"
      : !amount.trim()
        ? "Enter an amount"
        : amountProblem
          ? "Enter a valid amount"
          : !currentQuote
            ? "Get a quote"
            : !quoteUsable
              ? "Get a new quote"
              : !holderNameReady
                ? "Add your name to continue"
                : `Buy ${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}`

  const onCta = () => {
    if (!currentRequest) return
    if (!currentQuote || !quoteUsable) {
      setRequoted(false)
      setQuote(null)
      quoteMutation.mutate(currentRequest)
      return
    }
    if (walletId && holderNameReady) orderMutation.mutate({ walletId, quoteId: currentQuote.id, holderName })
  }
  const ctaDisabled =
    !currentRequest ||
    submitting ||
    (Boolean(currentQuote) && quoteUsable && (!walletId || !holderNameReady))

  const route = {
    from: { label: `${selectedCountryFlag} ${selectedCountryName}`, sub: `${activeCorridor.currencyCode} · ${humanizeValue(selectedChannel)}` },
    to: { label: "Worldstreet wallet", sub: `${selected.symbol} on ${selected.network}` },
  }
  const approx = currentQuote ? `≈ ${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}` : null
  const hint = `Pay in ${activeCorridor.currencyCode} · live quote before you order`

  const banners = (
    <>
      {sandbox}
      {requoted && currentQuote && (
        <AnnouncementBanner title="New quote" detail="The earlier quote expired. Check the new figures before you buy." />
      )}
    </>
  )

  const selectors = (
    <div className="flex flex-col gap-4">
      <BuySelect
        label="Pay from"
        value={corridorValue}
        options={countryOptions}
        onChange={setCorridorKey}
        disabled={submitting || countryOptions.length <= 1}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <BuySelect
          label="Payment method"
          value={selectedChannel}
          options={channelOptions}
          onChange={setChannel}
          disabled={submitting || channelOptions.length <= 1}
        />
        <BuySelect
          label="Receive asset"
          value={selected.key}
          options={receiveOptions}
          onChange={setRouteKey}
          disabled={submitting || receiveOptions.length <= 1}
        />
      </div>
    </div>
  )

  if (isModal) {
    return (
      <FlowTerminal
        direction="in"
        title={TITLE}
        amount={amount}
        onAmountChange={setAmount}
        unit={activeCorridor.currencyCode}
        approx={approx}
        problem={amountProblem}
        hint={hint}
        route={route}
        topSlot={railTabs}
        banners={banners}
        picker={selectors}
        receipt={receipt}
        errorSlot={error ? <FiatErrorDetail error={error} /> : undefined}
        cta={<FlowCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />}
        disabled={submitting}
      />
    )
  }

  return shell(
    <>
      {railTabs}
      {banners}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-credit">Local currency rail</span>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">Buy with your African bank</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Choose your country, enter an amount, and receive {selected.symbol} directly in your Worldstreet wallet.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <section className="rounded-[28px] border border-border/45 bg-card/65 p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">1 · Payment route</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">Where are you paying from?</h3>
              </div>
              <span className="rounded-full bg-credit-chip px-3 py-1.5 text-[11px] font-bold text-credit">OnSwitch</span>
            </div>
            {selectors}
          </section>

          <section className="rounded-[28px] border border-border/45 bg-card/65 p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">2 · Amount</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">How much do you want to buy?</h3>
              </div>
              <span className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground ring-1 ring-border/25">
                {activeCorridor.currencyCode}
              </span>
            </div>
            <div className="mt-6 flex items-end gap-3 rounded-2xl border border-border/35 bg-background/30 px-4 py-4 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
              <input
                value={amount}
                onChange={(event) => onAmountInput(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Amount in ${activeCorridor.currencyCode}`}
                disabled={submitting}
                className="min-w-0 flex-1 bg-transparent font-display text-[clamp(2.75rem,8vw,4.5rem)] font-light leading-none tracking-[-0.05em] tabular-nums outline-none placeholder:text-muted-foreground/25 disabled:opacity-50"
              />
              <span className="pb-1 text-sm font-bold text-muted-foreground">{activeCorridor.currencyCode}</span>
            </div>
            {amountProblem ? (
              <p className="mt-2 text-[13px] font-medium text-warning">{amountProblem}</p>
            ) : currentQuote ? (
              <p className="mt-2 text-[13px] tabular-nums text-muted-foreground">{approx} at the current provider rate</p>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">Your live quote appears here before any order is created.</p>
            )}
            {currentQuote && quoteUsable && !holderNameReady && (
              <p className="mt-4 rounded-2xl bg-surface-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground ring-1 ring-border/25">
                Add your name to your Worldstreet account before starting an African local-currency buy.
              </p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <section className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(255,196,0,0.17),transparent_48%),linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-5 shadow-[0_24px_90px_-44px_rgba(255,196,0,0.35)] sm:p-6">
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-subtle">Your quote</span>
                <span className="rounded-full bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/25">
                  {currentQuote ? (quoteUsable ? "Live" : "Expired") : "Preview"}
                </span>
              </div>

              {currentQuote ? (
                <>
                  <div className="mt-6">
                    <p className="text-xs font-medium text-muted-foreground">You receive</p>
                    <p className="mt-1 break-words font-display text-[clamp(2.1rem,5vw,3.2rem)] font-semibold leading-none tracking-[-0.05em] text-foreground">
                      {currentQuote.destinationAmount} <span className="text-xl text-muted-foreground">{currentQuote.destinationCurrency}</span>
                    </p>
                  </div>
                  <div className="mt-7 divide-y divide-border/25 rounded-2xl bg-background/25 px-4 ring-1 ring-border/20">
                    <div className="flex items-center justify-between gap-4 py-3 text-[13px]">
                      <span className="text-muted-foreground">You pay</span>
                      <span className="font-semibold tabular-nums">{currentQuote.sourceAmount} {currentQuote.sourceCurrency}</span>
                    </div>
                    {currentQuote.providerRate && (
                      <div className="flex items-center justify-between gap-4 py-3 text-[13px]">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="font-semibold tabular-nums">1 {currentQuote.destinationCurrency} = {currentQuote.providerRate} {currentQuote.sourceCurrency}</span>
                      </div>
                    )}
                    {(currentQuote.providerFee || currentQuote.worldstreetFee) && (
                      <div className="flex items-center justify-between gap-4 py-3 text-[13px]">
                        <span className="text-muted-foreground">Fees</span>
                        <span className="font-semibold tabular-nums">{currentQuote.providerFee ?? "0"} + {currentQuote.worldstreetFee ?? "0"} {currentQuote.sourceCurrency}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 py-3 text-[13px]">
                      <span className="text-muted-foreground">Quote expires</span>
                      <span className="font-semibold tabular-nums">{quoteUsable ? formatCountdown(secondsLeft) : "Expired"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl bg-background/25 px-4 py-5 ring-1 ring-border/20">
                  <p className="font-display text-xl font-semibold tracking-[-0.02em]">Ready when you are</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    Enter an amount to see the current rate, fees, and exactly how much crypto will arrive.
                  </p>
                </div>
              )}

              {error && <div className="mt-4"><FiatErrorDetail error={error} /></div>}
              <div className="mt-5">
                <FlowCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />
              </div>
              <p className="mt-3 text-center text-[11.5px] leading-relaxed text-subtle">
                Funds are sent to the bank details returned after your order is created. Never reuse expired details.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>,
  )
}
