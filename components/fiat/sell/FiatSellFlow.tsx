"use client"

import * as React from "react"
import { FiatAction as FlowCta } from "@/components/fiat/shared/FiatAction"
import { FiatStatus as StatusScreen } from "@/components/fiat/shared/FiatStatus"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { SectionMessage } from "@/components/crypto/primitives"
import { readTxHash } from "@/components/crypto/send/send-helpers"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect } from "@/components/fiat/shared/FiatSelect"
import { formatCountdown } from "@/components/fiat/shared/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AnnouncementBanner,
  DetailPanel,
  FlowHeader,
  FlowShell,
  FlowSkeleton,
  InlineNotice,
  RouteStrip,
  UnavailablePanel,
  useStageProgress,
} from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"
import { useCreateOnswitchBeneficiary, useFiatBeneficiaries } from "@/hooks/crypto/useFiatBeneficiaries"
import { useFiatBeneficiaryRequirements } from "@/hooks/crypto/useFiatBeneficiaryRequirements"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useFiatOrderPoll } from "@/hooks/crypto/useFiatOrderPoll"
import { useTransactionIntent } from "@/hooks/crypto/useTransactionIntent"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { describeFiatError, shouldRefetchCapabilities } from "@/lib/crypto-backend/fiat-errors"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"
import {
  beneficiaryRequirementLabel,
  automaticBeneficiaryField,
  beneficiaryFormValues,
  beneficiaryRequirementMatches,
  buildOfframpQuoteRequest,
  confirmOnswitchOrder,
  createOfframpOrder,
  discardOfframpOrder,
  isOfframpQuoteUsable,
  isValidAmount,
  needsOfframpRequote,
  offrampAvailability,
  offrampOptions,
  offrampOrderView,
  offrampStageIndex,
  quoteSecondsLeft,
  requestOfframpQuote,
  verifiedOnswitchBeneficiaries,
  type OfframpOption,
  type OfframpQuoteRequest,
} from "@/lib/crypto-backend/fiat-offramp"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import type { FiatBeneficiaryRequirement, FiatOrder, FiatQuote } from "@/lib/crypto-backend/types"
import { clearPendingFlow, readPendingFlow, savePendingFlow } from "@/lib/pending-flow"
import { TradeCta, TradeFrame, TradeNotice, TradeSkeleton, TradeUnavailable } from "@/components/buy-sell/redesign/kit"
import { BeneficiaryFormView, OfframpTicket, type BeneficiaryField } from "@/components/buy-sell/redesign/offramp-ticket"
import { QuoteHead } from "@/components/buy-sell/redesign/onramp-ticket"
import { RedesignOfframpOrder } from "@/components/buy-sell/redesign/sell-order"

const WALLET_SETUP_HREF = "/wallet/modern"
const TITLE = "Sell crypto"
const SUBTITLE = "Send crypto from your Worldstreet wallet, receive local fiat"

type Props = {
  /** "redesign" = the /sell page in the preview's look (components/buy-sell/redesign). Same logic; only what's rendered differs. */
  variant?: "page" | "modal" | "redesign"
  onInFlightChange?: (inFlight: boolean) => void
  onCompactChange?: (compact: boolean) => void
  railSwitcher?: React.ReactNode
}

const sameRequest = (a: OfframpQuoteRequest | null, b: OfframpQuoteRequest | null) =>
  Boolean(a && b) && JSON.stringify(a) === JSON.stringify(b)

function requirementIsInstitutionField(requirement: FiatBeneficiaryRequirement): boolean {
  return /(?:bank|institution|branch).*?(?:code|id)|bank_code|nuban_code/i.test(requirement.path)
}

function requirementIsAccountField(requirement: FiatBeneficiaryRequirement): boolean {
  return /account|phone|mobile|iban/i.test(requirement.path)
}

function OfframpOrderStatus({
  order,
  view,
  stageIndex,
  stageProgress,
  canSign,
  signing,
  signError,
  onSign,
  onRefresh,
  onStartOver,
  onDiscard,
  discarding,
  discardError,
  variant = "classic",
}: {
  variant?: "classic" | "redesign"
  order: FiatOrder
  view: ReturnType<typeof offrampOrderView>
  stageIndex: number | null
  stageProgress: { index: number; since: number }
  canSign: boolean
  signing: boolean
  signError: unknown
  onSign: () => void
  onRefresh: () => void
  onStartOver: () => void
  onDiscard: () => void
  discarding: boolean
  discardError?: unknown
}) {
  const supportLine = `Order reference ${order.publicReference} if you contact support.`
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">{supportLine}</span>
    </>
  )
  const figure = order.cryptoIntent?.normalizedSummary?.amount
    ? `${order.cryptoIntent.normalizedSummary.amount} ${order.asset.split(":").at(-1)?.toUpperCase() ?? order.asset}`
    : order.expectedDepositAmount
      ? `${order.expectedDepositAmount} ${order.asset.split(":").at(-1)?.toUpperCase() ?? order.asset}`
      : undefined
  const canDiscard = ["failed", "reversed", "refunded", "expired"].includes(order.state)
    || (order.state === "awaiting_crypto_deposit" && !order.cryptoIntent?.id && !order.observedDepositTxHash)
  const stuckBeforeSigning = order.state === "awaiting_crypto_deposit" && !order.cryptoIntent?.id && !order.observedDepositTxHash
  const problemCaption = discardError ? <><FiatErrorDetail error={describeFiatError(discardError)} />{reasonCaption}</> : reasonCaption

  if (variant === "redesign") {
    return (
      <RedesignOfframpOrder
        order={order}
        view={view}
        figure={figure}
        canDiscard={canDiscard}
        stuckBeforeSigning={stuckBeforeSigning}
        stageIndex={stageIndex}
        stageProgress={stageProgress}
        canSign={canSign}
        signing={signing}
        signError={signError}
        onSign={onSign}
        onRefresh={onRefresh}
        onStartOver={onStartOver}
        onDiscard={onDiscard}
        discarding={discarding}
        discardError={discardError}
      />
    )
  }

  if (view.screen === "sign") {
    return (
      <div className="flex flex-col gap-4">
        <FlowHeader
          direction="out"
          title="Review and sign"
          subtitle="Review your payout, then approve the crypto transfer."
        />
        <RouteStrip
          direction="out"
          from={{ label: "Worldstreet wallet", sub: figure ?? order.asset }}
          to={{ label: order.currency, sub: "Payout account" }}
        />
        <DetailPanel
          rows={[
            { label: "You send", value: figure ?? "Crypto amount prepared by the backend" },
            { label: "Receive", value: `${order.currency} payout after provider processing` },
            { label: "Network", value: order.network },
            { label: "Destination", value: "OnSwitch payout deposit address" },
          ]}
        />
        <InlineNotice>
          Check the amount and network before you sign. Signing submits your crypto transfer for this payout.
        </InlineNotice>
        {Boolean(signError) && <FiatErrorDetail error={describeFiatError(signError)} />}
        {!order.cryptoIntent?.id ? (
          <InlineNotice tone="warning">
            {order.cryptoIntentPreparation?.state === "blocked"
              ? order.cryptoIntentPreparation.message ?? "The wallet transaction could not be prepared yet. Add the required funds and network gas, then refresh this order."
              : "Your payout request is created. We&apos;re preparing the wallet transaction now; signing will unlock automatically when it&apos;s ready. You can refresh this order."}
          </InlineNotice>
        ) : !canSign ? (
          <InlineNotice>
            Signing details are still loading. Keep this order open and try again in a moment.
          </InlineNotice>
        ) : null}
        <FlowCta
          label={signing ? "Signing and submitting…" : "Unlock and sign"}
          onClick={onSign}
          disabled={!canSign || signing}
          busy={signing}
        />
        <Button variant="outline" onClick={onRefresh} disabled={signing}>Refresh order</Button>
        {stuckBeforeSigning && <Button variant="outline" onClick={onDiscard} disabled={signing || discarding}>{discarding ? "Discarding…" : "Discard order & start over"}</Button>}
      </div>
    )
  }

  if (view.screen === "review") {
    return (
      <StatusScreen
        state="processing"
        direction="out"
        figure={figure}
        headline="Your payout is being reviewed"
        caption={reasonCaption}
        reference={order.publicReference}
        autoUpdating={false}
        secondary={{ label: "Check again", onClick: onRefresh }}
      />
    )
  }

  if (view.screen === "problem") {
    return (
      <StatusScreen
        state="failure"
        direction="out"
        figure={figure}
        headline={order.state === "reversed" ? "This payout was reversed" : "This payout did not complete"}
        caption={problemCaption}
        reference={order.publicReference}
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new sell", onClick: onStartOver }}
        secondary={canDiscard ? {
          label: discarding ? "Discarding…" : order.state === "expired" ? "Discard expired order" : "Discard failed payout",
          onClick: discarding ? () => undefined : onDiscard,
        } : undefined}
      />
    )
  }

  if (view.screen === "completed") {
    return (
      <StatusScreen
        state="success"
        direction="out"
        figure={figure}
        headline="Done — your payout is complete"
        stages={[
          { key: "created", label: "Order created" },
          { key: "crypto_submitted", label: "Crypto transfer submitted" },
          { key: "provider_processing", label: "Local payout processed" },
          { key: "completed", label: "Payout completed" },
        ]}
        activeIndex={4}
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new sell", onClick: onStartOver }}
      />
    )
  }

  return (
    <StatusScreen
      state="processing"
      direction="out"
      figure={figure}
      headline={view.screen === "continue" ? "Setting up your payout" : "Your payout is being processed"}
      caption="Your payout is in progress. You can return to check it using this order reference."
      stages={stageIndex !== null ? [
        { key: "created", label: "Order created" },
        { key: "crypto_submitted", label: "Crypto transfer submitted" },
        { key: "provider_processing", label: "Local payout being processed" },
        { key: "completed", label: "Payout completed" },
      ] : undefined}
      activeIndex={stageProgress.index}
      stageStartedAt={stageProgress.since}
      reference={order.publicReference}
      autoUpdating={!view.terminal}
    />
  )
}

export function FiatSellFlow({ variant = "page", onInFlightChange, onCompactChange, railSwitcher }: Props) {
  const isModal = variant === "modal"
  const isRedesign = variant === "redesign"
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()
  const beneficiaries = useFiatBeneficiaries()
  const createBeneficiary = useCreateOnswitchBeneficiary()

  const [orderId, setOrderId] = React.useState<string | null>(
    () => (typeof window === "undefined" ? null : readPendingFlow("fiat-sell")?.reference ?? null),
  )
  const [optionKey, setOptionKey] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [quote, setQuote] = React.useState<FiatQuote | null>(null)
  const [quotedRequest, setQuotedRequest] = React.useState<OfframpQuoteRequest | null>(null)
  const [beneficiaryId, setBeneficiaryId] = React.useState("")
  const [showBeneficiaryForm, setShowBeneficiaryForm] = React.useState(false)
  const [holderName, setHolderName] = React.useState("")
  const holderType = "individual"
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({})
  const [formAttempted, setFormAttempted] = React.useState(false)
  const [signError, setSignError] = React.useState<unknown>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)
  const adoptedIntentId = React.useRef<string | null>(null)

  const order = useFiatOrderPoll(orderId ?? undefined)
  const orderMissing = order.error instanceof CryptoBackendError && order.error.status === 404
  const showingOrder = Boolean(orderId) && !orderMissing
  const view = order.data ? offrampOrderView(order.data) : null
  // Keep this hook unconditional; the order branch below may appear after a
  // refresh without the form branch ever rendering in the same mount.
  const stageIndex = offrampStageIndex(order.data?.state ?? "created")
  const stageProgress = useStageProgress(stageIndex ?? 0, order.data?.id ?? orderId ?? "none")

  const options = offrampOptions(config.data)
  const selected: OfframpOption | undefined = options.find((option) => option.key === optionKey) ?? options[0]
  const currentRequest = selected && isValidAmount(amount) ? buildOfframpQuoteRequest(selected, amount) : null
  const currentQuote = quote && sameRequest(quotedRequest, currentRequest) ? quote : null
  const quoteUsable = currentQuote ? isOfframpQuoteUsable(currentQuote) : false

  const requirements = useFiatBeneficiaryRequirements({
    country: selected?.countryCode,
    currency: selected?.currencyCode,
    channel: selected?.channel,
    holderType,
    enabled: Boolean(selected),
  })

  const institutionQuery = {
    country: selected?.countryCode ?? "",
    currency: selected?.currencyCode ?? "",
    channel: selected?.channel ?? "",
  }
  const institutions = useQuery({
    queryKey: cryptoQueryKeys.fiatInstitutions(userId, institutionQuery),
    queryFn: ({ signal }) => cryptoBackendClient.listFiatInstitutions(institutionQuery, signal),
    enabled: Boolean(isCryptoBackendEnabled && isLoaded && isSignedIn && selected),
    retry: fiatReadRetry,
    staleTime: 5 * 60_000,
  })

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const transfer = useTransactionIntent(wallet.data?.id, packageQuery.data)
  const adoptIntent = transfer.adoptIntent

  const quoteMutation = useMutation({
    mutationFn: (request: OfframpQuoteRequest) => requestOfframpQuote(cryptoBackendClient, request),
    retry: false,
    onSuccess: (next, request) => {
      setQuote(next)
      setQuotedRequest(request)
    },
    onError: (error) => {
      if (shouldRefetchCapabilities(error)) void config.refetchOnProviderError()
    },
  })

  const orderMutation = useMutation({
    mutationFn: (input: { walletId: string; quoteId: string; beneficiaryId: string }) => createOfframpOrder(cryptoBackendClient, input),
    retry: false,
    onSuccess: (created) => {
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, created.id), created)
      savePendingFlow("fiat-sell", created.id)
      setOrderId(created.id)
    },
    onError: (error) => {
      if (needsOfframpRequote(error)) {
        setQuote(null)
        setQuotedRequest(null)
      }
      if (shouldRefetchCapabilities(error)) void config.refetchOnProviderError()
    },
  })

  const discardMutation = useMutation({
    mutationFn: (currentOrderId: string) => discardOfframpOrder(cryptoBackendClient, currentOrderId),
    retry: false,
    onSuccess: (discarded) => {
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, discarded.id), discarded)
      startOver()
    },
  })

  const requiredRequirements = requirements.data ?? []
  const resolvedValues = beneficiaryFormValues(requiredRequirements, fieldValues, {
    holderName, channel: selected?.channel ?? "", country: selected?.countryCode ?? "", currency: selected?.currencyCode ?? "",
  })
  const visibleRequirements = requiredRequirements.filter((field) => !automaticBeneficiaryField(field.path))
  const formReady = Boolean(
    requirements.isSuccess &&
      holderName.trim().length >= 3 &&
      requiredRequirements.every((requirement) => beneficiaryRequirementMatches(requirement, resolvedValues[requirement.path] ?? "")),
  )
  const eligibleBeneficiaries = verifiedOnswitchBeneficiaries(beneficiaries.data, selected ?? {
    countryCode: "",
    currencyCode: "",
    channel: "",
  })
  const selectedBeneficiary = eligibleBeneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId)

  React.useEffect(() => {
    setFieldValues({})
    setBeneficiaryId("")
    setFormAttempted(false)
    createBeneficiary.reset()
  // Reset account fields when the payout destination changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.countryCode, selected?.currencyCode, selected?.channel])

  React.useEffect(() => {
    if (selectedBeneficiary) return
    setBeneficiaryId(eligibleBeneficiaries[0]?.id ?? "")
  }, [eligibleBeneficiaries, selectedBeneficiary])

  React.useEffect(() => {
    const intentId = order.data?.cryptoIntent?.id
    if (!intentId || adoptedIntentId.current === intentId) return
    adoptedIntentId.current = intentId
    adoptIntent(intentId)
  }, [adoptIntent, order.data?.cryptoIntent?.id])

  React.useEffect(() => {
    if (!order.data || !view?.terminal) return
    clearPendingFlow("fiat-sell")
    if (view.screen === "completed") {
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatOrders(userId, 50) })
    }
  }, [order.data, queryClient, userId, view])

  React.useEffect(() => {
    if (orderMissing) clearPendingFlow("fiat-sell")
  }, [orderMissing])

  const canSign = Boolean(
    wallet.data?.id &&
      packageQuery.data &&
      transfer.intent?.id &&
      transfer.intent.unsignedTransaction &&
      transfer.intent.accountId &&
      transfer.intent.chainFamily,
  )

  async function runSubmit() {
    setSignError(null)
    if (!orderId || !canSign) {
      setSignError(new Error("The wallet signing intent is not ready yet."))
      return
    }
    try {
      const submitted = await transfer.submitIntent({ useSponsorship: false })
      const txHash = readTxHash(submitted, transfer.intent)
      if (!txHash) throw new Error("The wallet did not return a transaction hash.")
      const confirmed = await confirmOnswitchOrder(cryptoBackendClient, { orderId, transactionHash: txHash })
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, orderId), confirmed)
      order.refresh()
    } catch (error) {
      setSignError(error)
    }
  }

  function pressSign() {
    const walletId = wallet.data?.id
    if (!walletId) return
    if (!getUnlockedWalletState(userId, walletId)) {
      resumeAfterUnlock.current = () => void runSubmit()
      setUnlockOpen(true)
      return
    }
    void runSubmit()
  }

  function startOver() {
    clearPendingFlow("fiat-sell")
    setOrderId(null)
    setQuote(null)
    setQuotedRequest(null)
    setSignError(null)
    quoteMutation.reset()
    orderMutation.reset()
    discardMutation.reset()
    transfer.reset()
    adoptedIntentId.current = null
  }

  const inFlight = quoteMutation.isPending || orderMutation.isPending || discardMutation.isPending || (showingOrder && !view?.terminal) || transfer.isSubmitting
  React.useEffect(() => onInFlightChange?.(inFlight), [inFlight, onInFlightChange])
  React.useEffect(() => onCompactChange?.(!showingOrder), [showingOrder, onCompactChange])

  // The redesign's stand-ins take the same props as the classic pieces.
  const Banner = isRedesign ? TradeNotice : AnnouncementBanner
  const Unavailable = isRedesign ? TradeUnavailable : UnavailablePanel
  const Skeleton = isRedesign ? TradeSkeleton : FlowSkeleton
  const Cta = isRedesign ? TradeCta : FlowCta

  const shell = (content: React.ReactNode, head?: React.ReactNode) => (
    <>
      {isModal ? (
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{railSwitcher}{content}</div>
      ) : isRedesign ? (
        <TradeFrame mode="sell" tabs={!showingOrder} head={head}>{railSwitcher}{content}</TradeFrame>
      ) : (
        <FlowShell className="max-w-5xl px-3 py-5 sm:px-5 sm:py-8">
          <PageHeader title={TITLE} subtitle={SUBTITLE} back="/" className="mb-4" />
          {railSwitcher}
          <div className="flex flex-1 flex-col gap-5">{content}</div>
        </FlowShell>
      )}
      <WalletUnlockDialog
        action="send"
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
    </>
  )

  if (showingOrder) {
    if (!order.data) {
      return shell(order.error ? <><FiatErrorDetail error={describeFiatError(order.error)} /><Cta label="Try again" onClick={order.refresh} /></> : <Skeleton />)
    }
    return shell(
      <>
        {config.data?.environment === "sandbox" && <Banner title="Sandbox" detail="This payout is using the provider test environment." />}
        <OfframpOrderStatus
          variant={isRedesign ? "redesign" : "classic"}
          order={order.data}
          view={view!}
          stageIndex={stageIndex}
          stageProgress={stageProgress}
          canSign={canSign}
          signing={transfer.isSubmitting}
          signError={signError ?? transfer.error}
          onSign={pressSign}
           onRefresh={order.refresh}
           onStartOver={startOver}
           onDiscard={() => {
             if (orderId) discardMutation.mutate(orderId)
           }}
           discarding={discardMutation.isPending}
           discardError={discardMutation.error}
         />
      </>,
    )
  }

  if (!isCryptoBackendEnabled) return shell(<Unavailable title="The Worldstreet wallet isn't enabled" tone="muted" reason="The new wallet is still rolling out for your account." />)
  if (wallet.needsSetup) return shell(<Unavailable title="You don't have a Worldstreet wallet yet" tone="muted" reason="Create your Worldstreet wallet first." action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_SETUP_HREF) }} />)
  if (wallet.error) return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  if (config.error && !config.data) return shell(<><FiatErrorDetail error={describeFiatError(config.error)} /><Cta label="Try again" onClick={() => void config.refetch()} /></>)
  if (wallet.isLoading || !config.data) return shell(<Skeleton />)

  const availability = offrampAvailability(config.data)
  if (availability === "disabled") return shell(<Unavailable title="Selling isn't available" tone="muted" reason="This option is switched off right now." />)
  if (availability === "blocked") return shell(<Unavailable title="Selling is temporarily unavailable" reason="The backend has paused fiat movement. Try again later." />)
  if (availability === "discovery_only") return shell(<Unavailable title="Selling isn't open yet" tone="muted" reason="The supported corridors are visible to operations, but money movement is not enabled." />)
  if (availability === "unavailable" || !selected) return shell(<Unavailable title="No local payout corridor is available" tone="muted" reason={isRedesign ? "No local-currency payout route is available for this wallet yet." : "OnSwitch has not returned an available African offramp for this wallet and deployment."} />)

  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter an amount greater than zero." : null
  const secondsLeft = currentQuote ? quoteSecondsLeft(currentQuote) : 0
  const error = quoteMutation.error && !needsOfframpRequote(quoteMutation.error)
    ? describeFiatError(quoteMutation.error)
    : orderMutation.error && !needsOfframpRequote(orderMutation.error)
      ? describeFiatError(orderMutation.error)
      : createBeneficiary.error
        ? describeFiatError(createBeneficiary.error)
        : null
  const quoteReceipt = currentQuote
    ? [
        { label: "You send", value: `${currentQuote.sourceAmount} ${currentQuote.sourceCurrency}` },
        ...(currentQuote.providerRate ? [{ label: "Rate", value: currentQuote.providerRate }] : []),
        ...(currentQuote.providerFee ? [{ label: "Provider fee", value: currentQuote.providerFee }] : []),
        ...(currentQuote.worldstreetFee ? [{ label: "Worldstreet fee", value: currentQuote.worldstreetFee }] : []),
        { label: "Network", value: currentQuote.network },
        { label: "Quote valid for", value: quoteUsable ? formatCountdown(secondsLeft) : "Expired" },
        { label: "You receive", value: `${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}`, strong: true },
      ]
    : null

  const countryGroups = Array.from(
    new Map(
      options.map((option) => [
        `${option.countryCode}|${option.currencyCode}`,
        option,
      ]),
    ).values(),
  )
  const selectedCountryKey = selected ? `${selected.countryCode}|${selected.currencyCode}` : ""
  const routesForCountry = selected
    ? options.filter((option) => `${option.countryCode}|${option.currencyCode}` === selectedCountryKey)
    : []
  const countryOptions = countryGroups.map((option) => ({
    value: `${option.countryCode}|${option.currencyCode}`,
    label: countryNameForCode(option.countryCode, option.countryName),
    meta: option.currencyCode,
    flag: countryFlagForCode(option.countryCode),
  }))
  const routeOptions = routesForCountry.map((option) => ({
    value: option.key,
    label: `${humanizeValue(option.channel)} · ${option.symbol}`,
    meta: `${option.symbol} on ${option.network}`,
  }))
  const beneficiaryOptions = eligibleBeneficiaries.map((beneficiary) => ({
    value: beneficiary.id,
    label: beneficiary.holderName,
    meta: `${beneficiary.maskedAccount} · ${beneficiary.currency}`,
  }))

  const onAmountInput = (value: string) => {
    if (!/^[0-9]*\.?[0-9]*$/.test(value)) return
    const [whole = "", fraction] = value.split(".")
    if (fraction !== undefined && fraction.length > 8) return
    const normalizedWhole = whole.replace(/^0+(?=\d)/, "")
    setAmount(fraction !== undefined ? `${normalizedWhole}.${fraction}` : normalizedWhole)
  }

  const onCountryChange = (value: string) => {
    const next = options.find((option) => `${option.countryCode}|${option.currencyCode}` === value)
    if (next) setOptionKey(next.key)
  }

  function onQuoteOrOrder() {
    if (!selected || !currentRequest || !wallet.data?.id) return
    if (!beneficiaryId) {
      setShowBeneficiaryForm(true)
      return
    }
    if (!currentQuote || !quoteUsable) {
      setQuote(null)
      setQuotedRequest(null)
      quoteMutation.mutate(currentRequest)
      return
    }
    orderMutation.mutate({ walletId: wallet.data.id, quoteId: currentQuote.id, beneficiaryId })
  }

  function submitBeneficiary() {
    setFormAttempted(true)
    if (!selected || !formReady) return
    createBeneficiary.mutate({
      country: selected.countryCode,
      currency: selected.currencyCode,
      channel: selected.channel,
      holderName,
      holderType,
      requirements: requiredRequirements,
      values: resolvedValues,
    }, {
      onSuccess: (created) => {
        if (["ready", "verified"].includes(created.status.toLowerCase())) {
          setBeneficiaryId(created.id)
          setShowBeneficiaryForm(false)
          setFormAttempted(false)
        }
      },
    })
  }

  const ctaLabel = quoteMutation.isPending
    ? "Getting a quote…"
    : orderMutation.isPending
      ? "Creating your payout…"
      : !amount.trim()
        ? "Enter an amount"
        : amountProblem
          ? "Enter a valid amount"
          : !beneficiaryId
            ? "Add a payout account"
            : !currentQuote
              ? "Get a quote"
              : !quoteUsable
                ? "Get a new quote"
                : `Sell for ${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}`
  const submitting = quoteMutation.isPending || orderMutation.isPending

  if (isRedesign) {
    // Same fields, rules and handlers as the classic form below.
    const formFields: BeneficiaryField[] = [
      { kind: "text", key: "holderName", label: "Account holder name", value: holderName, onChange: setHolderName, autoComplete: "name", invalid: formAttempted && holderName.trim().length < 3, invalidText: "", disabled: createBeneficiary.isPending },
      ...visibleRequirements.map((requirement): BeneficiaryField => {
        const value = fieldValues[requirement.path] ?? ""
        const invalid = formAttempted && !beneficiaryRequirementMatches(requirement, value)
        const setValue = (next: string) => setFieldValues((current) => ({ ...current, [requirement.path]: next }))
        if (requirementIsInstitutionField(requirement)) {
          const institutionOptions = institutions.data ?? []
          return {
            kind: "bank",
            key: requirement.path,
            value,
            options: [
              { value: "", label: institutions.isLoading ? "Loading banks…" : "Choose a bank" },
              ...institutionOptions.map((bank) => ({ value: bank.code ?? bank.id, label: bank.name ?? "Bank" })),
            ],
            onChange: setValue,
            disabled: createBeneficiary.isPending || institutions.isLoading || institutionOptions.length === 0,
            listFailed: !institutions.isLoading && institutionOptions.length === 0,
            onRetry: () => void institutions.refetch(),
            invalid,
          }
        }
        return {
          kind: "text",
          key: requirement.path,
          label: `${beneficiaryRequirementLabel(requirement.path)}${requirement.required ? " *" : ""}`,
          value,
          onChange: setValue,
          placeholder: requirement.example ?? undefined,
          inputMode: requirementIsAccountField(requirement) ? "tel" : undefined,
          invalid,
          invalidText: "Enter a valid value for this field.",
          disabled: createBeneficiary.isPending,
        }
      }),
    ]
    return shell(
      <OfframpTicket
        railSwitch={null}
        banners={config.data.environment === "sandbox" ? <Banner title="Sandbox" detail="This payout is using the provider test environment. No production fiat is moved." /> : null}
        countries={countryGroups}
        routes={routesForCountry}
        selected={selected}
        onCountry={onCountryChange}
        onRoute={setOptionKey}
        amount={amount}
        onAmountInput={onAmountInput}
        submitting={submitting}
        amountProblem={amountProblem}
        quote={currentQuote}
        quoteUsable={quoteUsable}
        secondsLeft={secondsLeft}
        payout={{
          loading: beneficiaries.isLoading,
          error: Boolean(beneficiaries.error) && !beneficiaries.data ? describeFiatError(beneficiaries.error) : null,
          accounts: eligibleBeneficiaries,
          value: beneficiaryId,
          onChange: setBeneficiaryId,
          formOpen: showBeneficiaryForm,
          onToggleForm: () => setShowBeneficiaryForm((value) => !value),
          form: showBeneficiaryForm || eligibleBeneficiaries.length === 0 ? (
            <BeneficiaryFormView
              fields={formFields}
              notices={
                <>
                  {requirements.isLoading && <TradeNotice tone="info" title="Loading the fields required for this payout corridor…" />}
                  {Boolean(requirements.error) && <FiatErrorDetail error={describeFiatError(requirements.error)} />}
                  {requirements.isSuccess && requiredRequirements.length === 0 && <TradeNotice tone="info" title="No additional fields were returned. The payout provider will perform the final validation." />}
                </>
              }
              error={createBeneficiary.error ? describeFiatError(createBeneficiary.error) : null}
              save={{
                label: createBeneficiary.isPending ? "Adding account…" : "Save payout account",
                onClick: submitBeneficiary,
                disabled: createBeneficiary.isPending || !requirements.isSuccess || (formAttempted && !formReady),
                busy: createBeneficiary.isPending,
              }}
            />
          ) : null,
        }}
        requoteNotice={needsOfframpRequote(orderMutation.error)}
        error={error}
        ctaLabel={ctaLabel}
        onCta={onQuoteOrOrder}
        ctaDisabled={!currentRequest || submitting || !wallet.data?.id}
      />,
      <QuoteHead quote={currentQuote} usable={quoteUsable} secondsLeft={secondsLeft} showRate={false} />,
    )
  }

  return shell(
    <>
      {config.data.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This payout is using the provider test environment. No production fiat is moved." />}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">1 · Payout route</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">Where should we send your money?</h3>
              </div>
              <span className="rounded-full bg-debit-chip px-3 py-1.5 text-[11px] font-bold text-debit">OnSwitch</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <FiatSelect label="Payout country" value={selectedCountryKey} options={countryOptions} onChange={onCountryChange} disabled={submitting || countryOptions.length <= 1} />
              <FiatSelect label="Send route" value={selected.key} options={routeOptions} onChange={setOptionKey} disabled={submitting || routeOptions.length <= 1} />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">Choose the country where the recipient’s account is held.</p>
          </section>

          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">2 · Amount</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">How much crypto do you want to sell?</h3>
              </div>
              <span className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground ring-1 ring-border/25">{selected.symbol}</span>
            </div>
            <div className="mt-6 flex items-end gap-3 rounded-2xl border border-border/35 bg-background/30 px-4 py-4 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
              <input value={amount} onChange={(event) => onAmountInput(event.target.value)} inputMode="decimal" placeholder="0" aria-label={`Amount in ${selected.symbol}`} disabled={submitting} className="min-w-0 flex-1 bg-transparent font-display text-[clamp(2.25rem,7vw,3.5rem)] font-light leading-none tracking-[-0.05em] tabular-nums outline-none placeholder:text-muted-foreground/25 disabled:opacity-50" />
              <span className="pb-1 text-sm font-bold text-muted-foreground">{selected.symbol}</span>
            </div>
            {amountProblem ? <p className="mt-2 text-[13px] font-medium text-warning">{amountProblem}</p> : currentQuote ? <p className="mt-2 text-[13px] tabular-nums text-muted-foreground">≈ {currentQuote.destinationAmount} {currentQuote.destinationCurrency} at the current provider rate</p> : <p className="mt-2 text-[13px] text-muted-foreground">Your live payout quote appears here before an order is created.</p>}
          </section>
          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">3 · Destination</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">Where should your payout arrive?</h3>
              </div>
              <Button variant="ghost" size="xs" onClick={() => setShowBeneficiaryForm((value) => !value)}>
                {showBeneficiaryForm ? "Hide form" : "Add account"}
              </Button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Individual accounts only. Choose a supported bank and enter the recipient’s details.</p>
            <div className="mt-5">
              {Boolean(beneficiaries.error) && !beneficiaries.data && <FiatErrorDetail error={describeFiatError(beneficiaries.error)} />}
              {beneficiaries.isLoading ? <FlowSkeleton /> : beneficiaryOptions.length > 0 ? (
                <FiatSelect label="Payout account" value={beneficiaryId} options={beneficiaryOptions} onChange={setBeneficiaryId} disabled={submitting} />
              ) : (
                <p className="text-sm text-muted-foreground">Add the account where you want to receive your money.</p>
              )}
            </div>

      {(showBeneficiaryForm || eligibleBeneficiaries.length === 0) && (
        <div className="mt-5 flex min-w-0 flex-col gap-4 border-t border-border/35 pt-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">Recipient details</p><p className="mt-1 text-sm text-muted-foreground">Check these details carefully before continuing.</p></div>
          <label className="flex flex-col gap-1 text-[13px]"><span>Account holder name</span><Input value={holderName} onChange={(event) => setHolderName(event.target.value)} autoComplete="name" disabled={createBeneficiary.isPending} aria-invalid={formAttempted && holderName.trim().length < 3 || undefined} /></label>
          {requirements.isLoading && <InlineNotice>Loading the fields required for this payout corridor…</InlineNotice>}
          {Boolean(requirements.error) && <FiatErrorDetail error={describeFiatError(requirements.error)} />}
          {requirements.isSuccess && requiredRequirements.length === 0 && <InlineNotice>No additional provider fields were returned. OnSwitch will perform the final validation.</InlineNotice>}
          {visibleRequirements.map((requirement) => {
            const value = fieldValues[requirement.path] ?? ""
            const invalid = formAttempted && !beneficiaryRequirementMatches(requirement, value)
            const institutionField = requirementIsInstitutionField(requirement)
            const institutionOptions = institutions.data ?? []
            if (institutionField) return (
              <div key={requirement.path} className="space-y-2">
                <FiatSelect label="Bank" value={value} options={[
                  { value: "", label: institutions.isLoading ? "Loading banks…" : "Choose a bank" },
                  ...institutionOptions.map((bank) => ({ value: bank.code ?? bank.id, label: bank.name ?? "Bank" })),
                ]} onChange={(code) => setFieldValues((current) => ({ ...current, [requirement.path]: code }))} disabled={createBeneficiary.isPending || institutions.isLoading || institutionOptions.length === 0} />
                {!institutions.isLoading && institutionOptions.length === 0 && <div className="text-sm text-muted-foreground">We couldn’t load the bank list. <button type="button" className="font-semibold text-primary underline" onClick={() => void institutions.refetch()}>Try again</button></div>}
                {invalid && <p className="text-sm text-destructive">Choose a bank to continue.</p>}
              </div>
            )
            return <label key={requirement.path} className="flex flex-col gap-2 text-sm"><span>{beneficiaryRequirementLabel(requirement.path)}{requirement.required ? " *" : ""}</span><Input className="h-12 rounded-xl" value={value} type="text" inputMode={requirementIsAccountField(requirement) ? "tel" : undefined} placeholder={requirement.example ?? undefined} onChange={(event) => setFieldValues((current) => ({ ...current, [requirement.path]: event.target.value }))} disabled={createBeneficiary.isPending} aria-invalid={invalid || undefined} />{invalid && <span className="text-destructive">Enter a valid value for this field.</span>}</label>
          })}
          {createBeneficiary.error && <FiatErrorDetail error={describeFiatError(createBeneficiary.error)} />}
          <FlowCta label={createBeneficiary.isPending ? "Adding account…" : "Save payout account"} onClick={submitBeneficiary} disabled={createBeneficiary.isPending || !requirements.isSuccess || (formAttempted && !formReady)} busy={createBeneficiary.isPending} />
        </div>
      )}

          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-debit/10 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-subtle">Your payout</span>
                <span className="rounded-full bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/25">{currentQuote ? (quoteUsable ? "Live" : "Expired") : "Preview"}</span>
              </div>
              {currentQuote ? (
                <>
                  <div className="mt-6">
                    <p className="text-xs font-medium text-muted-foreground">You receive</p>
                    <p className="mt-1 break-words font-display text-[clamp(2.1rem,5vw,3.2rem)] font-semibold leading-none tracking-[-0.05em] text-foreground">{currentQuote.destinationAmount} <span className="text-xl text-muted-foreground">{currentQuote.destinationCurrency}</span></p>
                  </div>
                  <div className="mt-7"><DetailPanel rows={quoteReceipt ?? []} /></div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl bg-background/25 px-4 py-5 ring-1 ring-border/20">
                  <p className="font-display text-xl font-semibold tracking-[-0.02em]">Your payout, at a glance</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Enter an amount to see the live rate, fees, expiry, and exactly how much local currency will arrive.</p>
                </div>
              )}
              {quoteReceipt && <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">A quote shows the price; it does not reserve funds. If it expires, request a new one.</p>}
              {needsOfframpRequote(orderMutation.error) && <div className="mt-4 rounded-xl border border-warning/20 bg-warning/10 px-3.5 py-3 text-[13px] leading-relaxed text-warning">That quote is no longer available. Get a fresh quote to continue.</div>}
              {error && <div className="mt-4"><FiatErrorDetail error={error} /></div>}
              <div className="mt-5"><FlowCta label={ctaLabel} onClick={onQuoteOrOrder} disabled={!currentRequest || submitting || !wallet.data?.id} busy={submitting} /></div>
              <p className="mt-3 text-center text-xs leading-relaxed text-subtle">Review the final amount before signing your crypto transfer.</p>
            </div>
          </section>
        </aside>
      </div>
    </>,
  )
}
