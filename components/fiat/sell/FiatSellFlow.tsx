"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { SectionMessage } from "@/components/crypto/primitives"
import { readTxHash } from "@/components/crypto/send/send-helpers"
import { ComplianceStatusList } from "@/components/fiat/compliance/ComplianceStatusList"
import { OnswitchProfileForm } from "@/components/fiat/compliance/OnswitchProfileForm"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AnnouncementBanner,
  ChoiceRow,
  DetailPanel,
  FlowCta,
  FlowHeader,
  FlowShell,
  FlowSkeleton,
  InlineNotice,
  RouteStrip,
  StatusScreen,
  UnavailablePanel,
  useStageProgress,
} from "@/components/ui/flow"
import { Eyebrow, PageHeader } from "@/components/ui/system"
import { useCreateOnswitchBeneficiary, useFiatBeneficiaries } from "@/hooks/crypto/useFiatBeneficiaries"
import { useFiatBeneficiaryRequirements } from "@/hooks/crypto/useFiatBeneficiaryRequirements"
import { useFiatCompliance } from "@/hooks/crypto/useFiatCompliance"
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
import { complianceRecordFor, isProviderCustomerApproved } from "@/lib/crypto-backend/fiat-compliance"
import { describeFiatError, shouldRefetchCapabilities } from "@/lib/crypto-backend/fiat-errors"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"
import {
  beneficiaryRequirementLabel,
  beneficiaryRequirementMatches,
  buildOfframpQuoteRequest,
  confirmOnswitchOrder,
  createOfframpOrder,
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

const WALLET_SETUP_HREF = "/wallet/modern"
const TITLE = "Sell"
const SUBTITLE = "Send crypto from your Worldstreet wallet, receive local fiat"

type Props = {
  variant?: "page" | "modal"
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
}: {
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

  if (view.screen === "sign") {
    return (
      <div className="flex flex-col gap-4">
        <FlowHeader
          direction="out"
          title="Review and sign"
          subtitle="The backend prepared the exact wallet transaction for this order."
        />
        <RouteStrip
          direction="out"
          from={{ label: "Worldstreet wallet", sub: figure ?? order.asset }}
          to={{ label: order.currency, sub: "Verified payout account" }}
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
          Review the figures above. The destination, asset, amount and network come from the backend intent and cannot be edited in this screen.
        </InlineNotice>
        {Boolean(signError) && <FiatErrorDetail error={describeFiatError(signError)} />}
        {!order.cryptoIntent?.id ? (
          <InlineNotice tone="error">The signing intent is not available yet. We&apos;ll keep checking this order.</InlineNotice>
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
        caption={reasonCaption}
        reference={order.publicReference}
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new sell", onClick: onStartOver }}
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
      caption="The order continues on the backend. You can leave this page and return using the order reference."
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
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()
  const compliance = useFiatCompliance()
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
  const [holderType, setHolderType] = React.useState("individual")
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
  const onswitchCustomer = complianceRecordFor(compliance.data, "onswitch")
  const profileApproved = isProviderCustomerApproved(onswitchCustomer)
  const profileChecking = compliance.data === undefined && !compliance.error
  const profileReadError = Boolean(compliance.error && !compliance.data)

  const requirements = useFiatBeneficiaryRequirements({
    country: selected?.countryCode,
    currency: selected?.currencyCode,
    channel: selected?.channel,
    holderType,
    enabled: Boolean(selected && profileApproved),
  })

  const institutionQuery = {
    country: selected?.countryCode ?? "",
    currency: selected?.currencyCode ?? "",
    channel: selected?.channel ?? "",
  }
  const institutions = useQuery({
    queryKey: cryptoQueryKeys.fiatInstitutions(userId, institutionQuery),
    queryFn: ({ signal }) => cryptoBackendClient.listFiatInstitutions(institutionQuery, signal),
    enabled: Boolean(isCryptoBackendEnabled && isLoaded && isSignedIn && selected && profileApproved),
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
      if (error instanceof CryptoBackendError && (error.status === 403 || error.status === 404)) void compliance.refetch()
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

  const requiredRequirements = requirements.data ?? []
  const formReady = Boolean(
    requirements.isSuccess &&
      holderName.trim().length >= 3 &&
      requiredRequirements.every((requirement) => beneficiaryRequirementMatches(requirement, fieldValues[requirement.path] ?? "")),
  )
  const eligibleBeneficiaries = verifiedOnswitchBeneficiaries(beneficiaries.data, selected ?? {
    countryCode: "",
    currencyCode: "",
    channel: "",
  })
  const selectedBeneficiary = eligibleBeneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId)
  const localProfileReady = profileApproved

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
    transfer.reset()
    adoptedIntentId.current = null
  }

  const inFlight = quoteMutation.isPending || orderMutation.isPending || (showingOrder && !view?.terminal) || transfer.isSubmitting
  React.useEffect(() => onInFlightChange?.(inFlight), [inFlight, onInFlightChange])
  React.useEffect(() => onCompactChange?.(!showingOrder), [showingOrder, onCompactChange])

  const shell = (content: React.ReactNode) => (
    <>
      {isModal ? (
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{railSwitcher}{content}</div>
      ) : (
        <FlowShell>
          <PageHeader title={TITLE} subtitle={SUBTITLE} back="/" className="mb-5" />
          {railSwitcher}
          <div className="flex flex-1 flex-col gap-4">{content}</div>
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
      return shell(order.error ? <><FiatErrorDetail error={describeFiatError(order.error)} /><FlowCta label="Try again" onClick={order.refresh} /></> : <FlowSkeleton />)
    }
    return shell(
      <>
        {config.data?.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This payout is using the provider test environment." />}
        <OfframpOrderStatus
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
        />
      </>,
    )
  }

  if (!isCryptoBackendEnabled) return shell(<UnavailablePanel title="The Worldstreet wallet isn't enabled" tone="muted" reason="The new wallet is still rolling out for your account." />)
  if (wallet.needsSetup) return shell(<UnavailablePanel title="You don't have a Worldstreet wallet yet" tone="muted" reason="Create your Worldstreet wallet first." action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_SETUP_HREF) }} />)
  if (wallet.error) return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  if (config.error && !config.data) return shell(<><FiatErrorDetail error={describeFiatError(config.error)} /><FlowCta label="Try again" onClick={() => void config.refetch()} /></>)
  if (wallet.isLoading || !config.data) return shell(<FlowSkeleton />)

  const availability = offrampAvailability(config.data)
  if (availability === "disabled") return shell(<UnavailablePanel title="Selling isn't available" tone="muted" reason="This option is switched off right now." />)
  if (availability === "blocked") return shell(<UnavailablePanel title="Selling is temporarily unavailable" reason="The backend has paused fiat movement. Try again later." />)
  if (availability === "discovery_only") return shell(<UnavailablePanel title="Selling isn't open yet" tone="muted" reason="The supported corridors are visible to operations, but money movement is not enabled." />)
  if (availability === "unavailable" || !selected) return shell(<UnavailablePanel title="No local payout corridor is available" tone="muted" reason="OnSwitch has not returned an available African offramp for this wallet and deployment." />)

  if (!localProfileReady) {
    return shell(
      <>
        <FlowHeader direction="out" title="Complete your OnSwitch profile" subtitle="An approved provider profile is required before a local payout can be created." />
        {profileChecking && <InlineNotice>Checking your OnSwitch approval status…</InlineNotice>}
        {profileReadError && <><FiatErrorDetail error={describeFiatError(compliance.error)} /><FlowCta label="Retry profile check" onClick={() => void compliance.refetch()} /></>}
        {compliance.data && <ComplianceStatusList records={[...(onswitchCustomer ? [onswitchCustomer] : [])]} />}
        <OnswitchProfileForm required />
      </>,
    )
  }

  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter an amount greater than zero." : null
  const secondsLeft = currentQuote ? quoteSecondsLeft(currentQuote) : 0
  const error = quoteMutation.error && !needsOfframpRequote(quoteMutation.error)
    ? describeFiatError(quoteMutation.error)
    : orderMutation.error
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

  const optionsForPicker = options.map((option) => ({
    key: option.key,
    label: `${option.countryName ?? option.countryCode} · ${option.currencyCode}`,
    sub: `${option.symbol} · ${option.channel}`,
  }))
  const beneficiaryOptions = eligibleBeneficiaries.map((beneficiary) => ({
    key: beneficiary.id,
    label: beneficiary.holderName,
    sub: `${beneficiary.maskedAccount} · ${beneficiary.currency}`,
  }))

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
      values: fieldValues,
    }, {
      onSuccess: (created) => {
        if (created.status.toLowerCase() === "verified" && created.ownershipStatus.toLowerCase() === "verified") {
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
            ? "Select a verified payout account"
            : !currentQuote
              ? "Get a quote"
              : !quoteUsable
                ? "Get a new quote"
                : `Sell for ${currentQuote.destinationAmount} ${currentQuote.destinationCurrency}`
  const submitting = quoteMutation.isPending || orderMutation.isPending

  return shell(
    <>
      {config.data.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This payout is using the provider test environment. No production fiat is moved." />}
      <FlowHeader direction="out" title="Sell crypto" subtitle="Your payout is sent only to a verified account you own." />
      <RouteStrip
        direction="out"
        from={{ label: "Worldstreet wallet", sub: `${selected.symbol} · ${selected.network}` }}
        to={{ label: selected.countryName ?? selected.countryCode, sub: `${selected.currencyCode} · ${selected.channel}` }}
      />
      <div className="py-1">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-muted-foreground">Crypto amount</span>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" disabled={submitting} aria-invalid={Boolean(amountProblem) || undefined} />
        </label>
        {amountProblem && <p className="mt-1 text-[12px] text-destructive">{amountProblem}</p>}
      </div>
      {options.length > 1 && <div className="flex flex-col gap-2"><Eyebrow>Sell to</Eyebrow><ChoiceRow options={optionsForPicker} value={selected.key} onChange={setOptionKey} disabled={submitting} columns={2} /></div>}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3"><Eyebrow>Verified payout account</Eyebrow><Button variant="ghost" size="xs" onClick={() => setShowBeneficiaryForm((value) => !value)}>{showBeneficiaryForm ? "Hide form" : "Add account"}</Button></div>
        {Boolean(beneficiaries.error) && !beneficiaries.data && <FiatErrorDetail error={describeFiatError(beneficiaries.error)} />}
        {beneficiaries.isLoading ? <FlowSkeleton /> : beneficiaryOptions.length > 0 ? <ChoiceRow options={beneficiaryOptions} value={beneficiaryId} onChange={setBeneficiaryId} disabled={submitting} /> : <InlineNotice tone="warning">No verified payout account is available for this corridor. Add one below; only a provider-verified account owned by you can be selected.</InlineNotice>}
      </div>

      {showBeneficiaryForm && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
          <div><Eyebrow>Add payout account</Eyebrow><p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">Details stay in this form until the secure create request. We do not persist raw account values in the browser.</p></div>
          <label className="flex flex-col gap-1 text-[13px]"><span>Account holder name</span><Input value={holderName} onChange={(event) => setHolderName(event.target.value)} autoComplete="name" disabled={createBeneficiary.isPending} aria-invalid={formAttempted && holderName.trim().length < 3 || undefined} /></label>
          <label className="flex flex-col gap-1 text-[13px]"><span>Account type</span><select className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={holderType} onChange={(event) => setHolderType(event.target.value)} disabled={createBeneficiary.isPending}><option value="individual">Individual</option><option value="business">Business</option></select></label>
          {requirements.isLoading && <InlineNotice>Loading the fields required for this payout corridor…</InlineNotice>}
          {Boolean(requirements.error) && <FiatErrorDetail error={describeFiatError(requirements.error)} />}
          {requirements.isSuccess && requiredRequirements.length === 0 && <InlineNotice>No additional provider fields were returned. OnSwitch will perform the final validation.</InlineNotice>}
          {requiredRequirements.map((requirement) => {
            const value = fieldValues[requirement.path] ?? ""
            const invalid = formAttempted && !beneficiaryRequirementMatches(requirement, value)
            const institutionField = requirementIsInstitutionField(requirement)
            const institutionOptions = institutions.data ?? []
            return <label key={requirement.path} className="flex flex-col gap-1 text-[13px]"><span>{beneficiaryRequirementLabel(requirement.path)}{requirement.required ? " *" : ""}</span>{institutionField && institutionOptions.length > 0 ? <select className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={value} onChange={(event) => setFieldValues((current) => ({ ...current, [requirement.path]: event.target.value }))} disabled={createBeneficiary.isPending}><option value="">Select an institution</option>{institutionOptions.map((institution) => <option key={institution.id} value={institution.code ?? institution.id}>{institution.name ?? institution.code ?? institution.id}</option>)}</select> : <Input value={value} type={requirementIsAccountField(requirement) ? "tel" : "text"} inputMode={requirementIsAccountField(requirement) ? "numeric" : undefined} placeholder={requirement.example ?? undefined} onChange={(event) => setFieldValues((current) => ({ ...current, [requirement.path]: event.target.value }))} disabled={createBeneficiary.isPending} aria-invalid={invalid || undefined} />}{invalid && <span className="text-destructive">Enter a valid value for this field.</span>}</label>
          })}
          {createBeneficiary.data && createBeneficiary.data.status.toLowerCase() !== "verified" && <InlineNotice tone="warning">The provider received the account, but it is not verified yet. It cannot be used for a payout until ownership verification completes.</InlineNotice>}
          <FlowCta label={createBeneficiary.isPending ? "Verifying account…" : "Verify and add account"} onClick={submitBeneficiary} disabled={createBeneficiary.isPending || !requirements.isSuccess || (formAttempted && !formReady)} busy={createBeneficiary.isPending} />
        </div>
      )}

      {quoteReceipt && <DetailPanel rows={quoteReceipt} />}
      {quoteReceipt && <p className="text-[13px] text-muted-foreground">A quote shows the price; it does not reserve funds. If it expires, request a new one.</p>}
      {error && <FiatErrorDetail error={error} />}
      <FlowCta label={ctaLabel} onClick={onQuoteOrOrder} disabled={!currentRequest || submitting || !wallet.data?.id || !localProfileReady} busy={submitting} />
    </>,
  )
}
