"use client"

/**
 * Sell → USD through Bridge.
 *
 * Bridge withdrawals deliberately have no frontend quote step in the current
 * backend contract. The user selects a backend-supported channel and wallet
 * network, chooses a verified Bridge beneficiary already owned by them, and
 * reviews the exact USDC source amount before the backend creates the order.
 * The returned crypto intent is then signed with the existing wallet flow.
 */

import * as React from "react"
import { FiatAction as FlowCta } from "@/components/fiat/shared/FiatAction"
import { FiatStatus as StatusScreen } from "@/components/fiat/shared/FiatStatus"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { SectionMessage } from "@/components/crypto/primitives"
import { readTxHash } from "@/components/crypto/send/send-helpers"
import { BridgeKycPanel } from "@/components/fiat/compliance/BridgeKycPanel"
import { ComplianceStatusList } from "@/components/fiat/compliance/ComplianceStatusList"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect } from "@/components/fiat/shared/FiatSelect"
import { Button } from "@/components/ui/button"
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
import { useFiatBeneficiaries } from "@/hooks/crypto/useFiatBeneficiaries"
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
import {
  bridgeWithdrawalChannelLabel,
  bridgeWithdrawalChannelOptions,
  bridgeWithdrawalNetworkOptions,
  bridgeWithdrawalOrderView,
  createBridgeWithdrawalOrder,
  isValidAmount,
  selectBridgeWithdrawalNetwork,
  verifiedBridgeBeneficiaries,
  type BridgeWithdrawalRequest,
} from "@/lib/crypto-backend/fiat-bridge-withdrawal"
import {
  complianceRecordFor,
  isBridgeKycRequired,
  isProviderCustomerApproved,
} from "@/lib/crypto-backend/fiat-compliance"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import { isBridgeWithdrawalAvailable } from "@/lib/crypto-backend/fiat-capabilities"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import type { BridgeWithdrawalChannel, FiatOrder } from "@/lib/crypto-backend/types"
import { clearPendingFlow, readPendingFlow, savePendingFlow } from "@/lib/pending-flow"
import { TradeCta, TradeFrame, TradeNotice, TradeSkeleton, TradeUnavailable } from "@/components/buy-sell/redesign/kit"
import { RedesignUsdWithdrawalOrder } from "@/components/buy-sell/redesign/sell-order"
import { UsdSellTicket, UsdSellVerify } from "@/components/buy-sell/redesign/usd-sell"

const WALLET_SETUP_HREF = "/wallet/modern"

type Props = {
  /** "redesign" = the /sell page in the preview's look (components/buy-sell/redesign). Same logic; only what's rendered differs. */
  variant?: "page" | "modal" | "redesign"
  onInFlightChange?: (inFlight: boolean) => void
  onCompactChange?: (compact: boolean) => void
  railSwitcher?: React.ReactNode
}

function BridgeWithdrawalOrderStatus({
  order,
  onSign,
  onRefresh,
  onStartOver,
  canSign,
  signing,
  signError,
  variant = "classic",
}: {
  variant?: "classic" | "redesign"
  order: FiatOrder
  onSign: () => void
  onRefresh: () => void
  onStartOver: () => void
  canSign: boolean
  signing: boolean
  signError: unknown
}) {
  const view = bridgeWithdrawalOrderView(order)
  const stageIndex = selectStageIndex(order.state)
  const stageProgress = useStageProgress(stageIndex ?? 0, order.id)
  const figure = order.cryptoIntent?.normalizedSummary?.amount
    ? `${order.cryptoIntent.normalizedSummary.amount} USDC`
    : order.expectedDepositAmount
      ? `${order.expectedDepositAmount} USDC`
      : undefined
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">Order reference {order.publicReference} if you contact support.</span>
    </>
  )

  if (variant === "redesign") {
    return (
      <RedesignUsdWithdrawalOrder
        order={order}
        view={view}
        figure={figure}
        stages={BRIDGE_WITHDRAWAL_STAGES.map((stage) => stage.label)}
        stageIndex={stageIndex}
        stageProgress={stageProgress}
        railLabel={bridgeWithdrawalChannelLabel(normalizeChannel(order.channel))}
        canSign={canSign}
        signing={signing}
        signError={signError}
        onSign={onSign}
        onRefresh={onRefresh}
        onStartOver={onStartOver}
      />
    )
  }

  if (view.screen === "sign") {
    return (
      <div className="flex flex-col gap-4">
        <FlowHeader
          direction="out"
          title="Review and sign USD withdrawal"
          subtitle="Bridge has prepared the exact USDC transfer for this payout."
        />
        <RouteStrip
          direction="out"
          from={{ label: "Worldstreet wallet", sub: figure ?? "USDC source amount" }}
          to={{ label: "USD bank account", sub: `${order.channel} payout rail` }}
        />
        <DetailPanel
          rows={[
            { label: "You send", value: figure ?? "USDC amount prepared by the backend" },
            { label: "Receive", value: "USD after Bridge processing" },
            { label: "Network", value: order.network },
            { label: "Payment rail", value: bridgeWithdrawalChannelLabel(normalizeChannel(order.channel)) },
          ]}
        />
        <InlineNotice>
          This is not a quote screen. Bridge accepts the source USDC amount shown above; the provider controls final USD settlement timing and any applicable payout terms.
        </InlineNotice>
        {Boolean(signError) && <FiatErrorDetail error={describeFiatError(signError)} />}
        {!order.cryptoIntent?.id ? (
          <InlineNotice tone="error">The signing intent is not available yet. Refresh this order to continue.</InlineNotice>
        ) : !canSign ? (
          <InlineNotice>Signing details are still loading. Keep this order open and try again in a moment.</InlineNotice>
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
        headline="Your USD payout is being reviewed"
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
        headline={order.state === "reversed" ? "This USD payout was reversed" : "This USD payout did not complete"}
        caption={reasonCaption}
        reference={order.publicReference}
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new USD withdrawal", onClick: onStartOver }}
      />
    )
  }

  if (view.screen === "completed") {
    return (
      <StatusScreen
        state="success"
        direction="out"
        figure={figure}
        headline="Done — your USD payout is complete"
        stages={BRIDGE_WITHDRAWAL_STAGES}
        activeIndex={BRIDGE_WITHDRAWAL_STAGES.length}
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new USD withdrawal", onClick: onStartOver }}
      />
    )
  }

  return (
    <StatusScreen
      state="processing"
      direction="out"
      figure={figure}
      headline={view.screen === "continue" ? "Setting up your USD payout" : "Your USD payout is being processed"}
      caption="The order continues on the backend. You can leave this page and return from fiat order history."
      stages={stageIndex !== null ? BRIDGE_WITHDRAWAL_STAGES : undefined}
      activeIndex={stageProgress.index}
      stageStartedAt={stageProgress.since}
      reference={order.publicReference}
      autoUpdating={!view.terminal}
    />
  )
}

const BRIDGE_WITHDRAWAL_STAGES = [
  { key: "created", label: "Order created" },
  { key: "crypto_submitted", label: "USDC transfer submitted" },
  { key: "provider_processing", label: "USD payout processed" },
  { key: "completed", label: "Payout completed" },
]

function selectStageIndex(state: string): number | null {
  switch (state) {
    case "created":
      return 0
    case "awaiting_crypto_deposit":
    case "crypto_intent_ready":
      return 1
    case "crypto_submitted":
    case "provider_processing":
    case "scheduled":
      return 2
    case "completed":
      return BRIDGE_WITHDRAWAL_STAGES.length
    default:
      return null
  }
}

function normalizeChannel(value: string): BridgeWithdrawalChannel {
  const channel = value.trim().toLowerCase()
  if (channel === "ach_same_day" || channel === "wire" || channel === "fednow") return channel
  return "ach"
}

export function BridgeUsdSell({
  variant = "page",
  onInFlightChange,
  onCompactChange,
  railSwitcher,
}: Props) {
  const isModal = variant === "modal"
  const isRedesign = variant === "redesign"
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()
  const compliance = useFiatCompliance()
  const beneficiaries = useFiatBeneficiaries()

  const [orderId, setOrderId] = React.useState<string | null>(
    () => (typeof window === "undefined" ? null : readPendingFlow("fiat-bridge-sell")?.reference ?? null),
  )
  const [networkId, setNetworkId] = React.useState("")
  const [channel, setChannel] = React.useState<BridgeWithdrawalChannel | "">("")
  const [amount, setAmount] = React.useState("")
  const [beneficiaryId, setBeneficiaryId] = React.useState("")
  const [signError, setSignError] = React.useState<unknown>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)
  const adoptedIntentId = React.useRef<string | null>(null)

  const order = useFiatOrderPoll(orderId ?? undefined)
  const orderMissing = order.error instanceof CryptoBackendError && order.error.status === 404
  const showingOrder = Boolean(orderId) && !orderMissing

  const walletNetworkIds = (wallet.data?.accounts ?? []).flatMap((account) =>
    (account.addresses ?? []).map((address) => address.networkId),
  )
  const networks = bridgeWithdrawalNetworkOptions(config.data, walletNetworkIds)
  const selectedNetwork = networks.find((network) => network.networkId === networkId)
    ?? selectBridgeWithdrawalNetwork(config.data, walletNetworkIds)
  const channels = bridgeWithdrawalChannelOptions(config.data)
  const selectedChannel = channels.find((item) => item.channel === channel) ?? channels[0]
  const activeChannel = selectedChannel?.channel
  const eligibleBeneficiaries = verifiedBridgeBeneficiaries(beneficiaries.data, activeChannel)
  const selectedBeneficiary = eligibleBeneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId)

  const bridgeCustomer = complianceRecordFor(compliance.data, "bridge")
  const bridgeApproved = isProviderCustomerApproved(bridgeCustomer)
  const kycRequired = isBridgeKycRequired(config.data, "withdrawal")

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const transfer = useTransactionIntent(wallet.data?.id, packageQuery.data)
  const { adoptIntent } = transfer

  const orderMutation = useMutation({
    mutationFn: (input: Omit<BridgeWithdrawalRequest, "provider" | "asset">) =>
      createBridgeWithdrawalOrder(cryptoBackendClient, input),
    retry: false,
    onSuccess: (created) => {
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, created.id), created)
      savePendingFlow("fiat-bridge-sell", created.id)
      setOrderId(created.id)
    },
    onError: () => {
      void config.refetchOnProviderError()
    },
  })

  React.useEffect(() => {
    if (selectedNetwork && networkId !== selectedNetwork.networkId) setNetworkId(selectedNetwork.networkId)
  }, [networkId, selectedNetwork])

  React.useEffect(() => {
    if (selectedChannel && channel !== selectedChannel.channel) setChannel(selectedChannel.channel)
  }, [channel, selectedChannel])

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
    if (!order.data || !bridgeOrderTerminal(order.data.state)) return
    clearPendingFlow("fiat-bridge-sell")
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatOrders(userId, 50) })
    if (order.data.state === "completed") {
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
    }
  }, [order.data, queryClient, userId])

  React.useEffect(() => {
    if (orderMissing) clearPendingFlow("fiat-bridge-sell")
  }, [orderMissing])

  const canSign = Boolean(
    wallet.data?.id &&
      packageQuery.data &&
      transfer.intent?.id &&
      transfer.intent.unsignedTransaction &&
      transfer.intent.accountId &&
      transfer.intent.chainFamily,
  )

  async function submitSignedWithdrawal() {
    setSignError(null)
    if (!orderId || !canSign) {
      setSignError(new Error("The wallet signing intent is not ready yet."))
      return
    }
    try {
      const submitted = await transfer.submitIntent({ useSponsorship: false })
      const txHash = readTxHash(submitted, transfer.intent)
      if (!txHash) throw new Error("The wallet did not return a transaction hash.")
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatOrder(userId, orderId) })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatOrders(userId, 50) })
      order.refresh()
    } catch (error) {
      setSignError(error)
    }
  }

  function pressSign() {
    const walletId = wallet.data?.id
    if (!walletId) return
    if (!getUnlockedWalletState(userId, walletId)) {
      resumeAfterUnlock.current = () => void submitSignedWithdrawal()
      setUnlockOpen(true)
      return
    }
    void submitSignedWithdrawal()
  }

  function startOver() {
    clearPendingFlow("fiat-bridge-sell")
    setOrderId(null)
    setSignError(null)
    orderMutation.reset()
    transfer.reset()
    adoptedIntentId.current = null
  }

  const inFlight = orderMutation.isPending || (showingOrder && !bridgeOrderTerminal(order.data?.state)) || transfer.isSubmitting
  React.useEffect(() => onInFlightChange?.(inFlight), [inFlight, onInFlightChange])
  React.useEffect(() => onCompactChange?.(!showingOrder), [showingOrder, onCompactChange])

  // The redesign's stand-ins take the same props as the classic pieces.
  const Banner = isRedesign ? TradeNotice : AnnouncementBanner
  const Unavailable = isRedesign ? TradeUnavailable : UnavailablePanel
  const Skeleton = isRedesign ? TradeSkeleton : FlowSkeleton
  const Cta = isRedesign ? TradeCta : FlowCta

  const shell = (content: React.ReactNode) => (
    <>
      {isModal ? (
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{railSwitcher}{content}</div>
      ) : isRedesign ? (
        <TradeFrame mode="sell" tabs={!showingOrder}>{railSwitcher}{content}</TradeFrame>
      ) : (
        <FlowShell className="max-w-5xl px-3 py-5 sm:px-5 sm:py-8">
          <PageHeader title="Sell" subtitle="Send USDC from your Worldstreet wallet, receive USD" back="/" className="mb-4" />
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
      return shell(order.error
        ? <><FiatErrorDetail error={describeFiatError(order.error)} /><Cta label="Try again" onClick={order.refresh} /></>
        : <Skeleton />)
    }
    return shell(
      <>
        {config.data?.environment === "sandbox" && <Banner title="Sandbox" detail="This withdrawal uses the provider test environment. No production fiat is moved." />}
        <BridgeWithdrawalOrderStatus
          variant={isRedesign ? "redesign" : "classic"}
          order={order.data}
          onSign={pressSign}
          onRefresh={order.refresh}
          onStartOver={startOver}
          canSign={canSign}
          signing={transfer.isSubmitting}
          signError={signError ?? transfer.error}
        />
      </>,
    )
  }

  if (!isCryptoBackendEnabled) return shell(<Unavailable title="The Worldstreet wallet isn't enabled" tone="muted" reason="The new wallet is still rolling out for your account." />)
  if (wallet.needsSetup) return shell(<Unavailable title="You don't have a Worldstreet wallet yet" tone="muted" reason="Create your Worldstreet wallet first." action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_SETUP_HREF) }} />)
  if (wallet.error) return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  if (config.error && !config.data) return shell(<><FiatErrorDetail error={describeFiatError(config.error)} /><Cta label="Try again" onClick={() => void config.refetch()} /></>)
  if (wallet.isLoading || !config.data) return shell(<Skeleton />)

  if (!isBridgeWithdrawalAvailableForUi(config.data)) {
    return shell(<Unavailable title="USD withdrawals aren't available" tone="muted" reason={isRedesign ? "A verified USD payout route isn't enabled yet." : "Bridge has not enabled a verified USD payout route for this deployment."} />)
  }
  if (networks.length === 0) {
    return shell(<Unavailable title="Your wallet has no supported USDC network" tone="muted" reason={isRedesign ? "USD withdrawals can only be sent from a network your Worldstreet wallet owns and that's been approved." : "Bridge can only withdraw from a network that this Worldstreet wallet owns and the backend has approved."} />)
  }
  if (!selectedNetwork) {
    return shell(<Unavailable title="A supported USDC network is not selected" tone="muted" reason="Refresh the wallet and capability data before creating a withdrawal." />)
  }
  if (!bridgeApproved && isRedesign) {
    return shell(
      <UsdSellVerify
        railSwitch={null}
        complianceError={compliance.error && !compliance.data ? describeFiatError(compliance.error) : null}
        record={bridgeCustomer}
        showRecord={Boolean(compliance.data)}
        kyc={kycRequired ? <BridgeKycPanel kycRequired variant="redesign" /> : null}
        onRefresh={() => void compliance.refetch()}
      />,
    )
  }
  if (!bridgeApproved) {
    return shell(
      <>
        <FlowHeader direction="out" title="Complete Bridge verification" subtitle="Bridge approval is required before a USD withdrawal can be created." />
        {compliance.error && !compliance.data && <FiatErrorDetail error={describeFiatError(compliance.error)} />}
        {compliance.data && <ComplianceStatusList records={[...(bridgeCustomer ? [bridgeCustomer] : [])]} />}
        {kycRequired ? <BridgeKycPanel kycRequired /> : <InlineNotice>Bridge has not marked your USD payout profile approved yet. Refresh after onboarding is complete.</InlineNotice>}
        <Button variant="outline" onClick={() => void compliance.refetch()}>Refresh Bridge status</Button>
      </>,
    )
  }

  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter a USDC amount greater than zero." : null
  const beneficiaryOptions = eligibleBeneficiaries.map((beneficiary) => ({
    value: beneficiary.id,
    label: beneficiary.holderName,
    meta: `${beneficiary.maskedAccount} · ${beneficiary.channel.toUpperCase()}`,
  }))
  const networkOptions = networks.map((network) => ({
    value: network.networkId,
    label: network.networkName,
    meta: `${network.asset} · ${network.paymentRail}`,
  }))
  const channelOptions = channels.map((item) => ({
    value: item.channel,
    label: bridgeWithdrawalChannelLabel(item.channel),
    meta: "Verified external account",
  }))
  const selectedChannelLabel = activeChannel ? bridgeWithdrawalChannelLabel(activeChannel) : "Payout rail"
  const canCreateOrder = Boolean(
    wallet.data?.id &&
      selectedNetwork &&
      activeChannel &&
      selectedBeneficiary &&
      isValidAmount(amount) &&
      !orderMutation.isPending,
  )
  const error = orderMutation.error || beneficiaries.error ? describeFiatError(orderMutation.error ?? beneficiaries.error) : null

  function createOrder() {
    if (!wallet.data?.id || !selectedNetwork || !activeChannel || !selectedBeneficiary || !isValidAmount(amount)) return
    orderMutation.mutate({
      walletId: wallet.data.id,
      networkId: selectedNetwork.networkId,
      amount,
      beneficiaryId: selectedBeneficiary.id,
      channel: activeChannel,
    })
  }

  const onAmountInput = (value: string) => {
    if (!/^[0-9]*\.?[0-9]*$/.test(value)) return
    const [whole = "", fraction] = value.split(".")
    if (fraction !== undefined && fraction.length > 6) return
    const normalizedWhole = whole.replace(/^0+(?=\d)/, "")
    setAmount(fraction !== undefined ? `${normalizedWhole}.${fraction}` : normalizedWhole)
  }

  if (isRedesign) {
    return shell(
      <UsdSellTicket
        railSwitch={null}
        banners={config.data.environment === "sandbox" ? <Banner title="Sandbox" detail="This withdrawal uses the provider test environment. No production fiat is moved." /> : null}
        amount={amount}
        onAmountInput={onAmountInput}
        pending={orderMutation.isPending}
        amountProblem={amountProblem}
        networks={networks}
        networkId={selectedNetwork.networkId}
        networkName={selectedNetwork.networkName}
        onNetwork={setNetworkId}
        channels={channels.map((item) => ({ key: item.channel, label: bridgeWithdrawalChannelLabel(item.channel) }))}
        channel={activeChannel ?? ""}
        channelLabel={selectedChannelLabel}
        onChannel={(value) => setChannel(value as BridgeWithdrawalChannel)}
        accounts={eligibleBeneficiaries}
        accountsLoading={beneficiaries.isLoading}
        beneficiaryId={beneficiaryId}
        onBeneficiary={setBeneficiaryId}
        error={error}
        ctaLabel={orderMutation.isPending ? "Creating withdrawal…" : !amount.trim() ? "Enter a USDC amount" : amountProblem ? "Enter a valid amount" : !selectedBeneficiary ? "Select a verified USD account" : "Create USD withdrawal"}
        onCta={createOrder}
        ctaDisabled={!canCreateOrder}
      />,
    )
  }

  return shell(
    <>
      {config.data.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This withdrawal uses the provider test environment. No production fiat is moved." />}
      <FlowHeader direction="out" title="Sell USDC for USD" subtitle="Send crypto from your Worldstreet wallet to your verified USD account." />
      <RouteStrip
        direction="out"
        from={{ label: "Worldstreet wallet", sub: `${selectedNetwork.networkName} · USDC` }}
        to={{ label: "Your USD account", sub: selectedChannelLabel }}
      />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">1 · Transfer route</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">Choose your USDC source and payout rail</h3>
              </div>
              <span className="rounded-full bg-credit-chip px-3 py-1.5 text-[11px] font-bold text-credit">Bridge</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <FiatSelect label="Send from" value={selectedNetwork.networkId} options={networkOptions} onChange={setNetworkId} disabled={orderMutation.isPending || networkOptions.length <= 1} />
              <FiatSelect label="USD payout rail" value={activeChannel ?? ""} options={channelOptions} onChange={(value) => setChannel(value as BridgeWithdrawalChannel)} disabled={orderMutation.isPending || channelOptions.length <= 1} />
            </div>
          </section>

          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">2 · Amount</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">How much USDC do you want to sell?</h3>
              </div>
              <span className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground ring-1 ring-border/25">USDC</span>
            </div>
            <div className="mt-6 flex items-end gap-3 rounded-2xl border border-border/35 bg-background/30 px-4 py-4 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
              <input value={amount} onChange={(event) => onAmountInput(event.target.value)} inputMode="decimal" placeholder="0" aria-label="Amount in USDC" disabled={orderMutation.isPending} className="min-w-0 flex-1 bg-transparent font-display text-[clamp(2.25rem,7vw,3.5rem)] font-light leading-none tracking-[-0.05em] tabular-nums outline-none placeholder:text-muted-foreground/25 disabled:opacity-50" />
              <span className="pb-1 text-sm font-bold text-muted-foreground">USDC</span>
            </div>
            {amountProblem ? <p className="mt-2 text-[13px] font-medium text-warning">{amountProblem}</p> : <p className="mt-2 text-[13px] text-muted-foreground">Bridge uses the exact source amount you approve; the final USD settlement is handled by the payout rail.</p>}
          </section>

          <section className="rounded-2xl border border-border/45 bg-card/60 p-4 sm:p-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">3 · Destination</span>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em]">Choose your verified USD account</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Only your own verified external account can receive this payout.</p>
            <div className="mt-5">
              {beneficiaries.isLoading ? <FlowSkeleton /> : beneficiaryOptions.length > 0 ? (
                <FiatSelect label="Verified USD account" value={beneficiaryId} options={beneficiaryOptions} onChange={setBeneficiaryId} disabled={orderMutation.isPending} />
              ) : (
                <InlineNotice tone="warning">No verified Bridge USD account is available for this payout rail. Add and verify your own external account through the approved Bridge onboarding process before withdrawing.</InlineNotice>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-subtle">Review withdrawal</span>
                <span className="rounded-full bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/25">Bridge · USD</span>
              </div>
              <div className="mt-6">
                <p className="text-xs font-medium text-muted-foreground">You send</p>
                <p className="mt-1 break-words font-display text-[clamp(2.1rem,5vw,3.2rem)] font-semibold leading-none tracking-[-0.05em] text-foreground">{amount.trim() || "0"} <span className="text-xl text-muted-foreground">USDC</span></p>
              </div>
              <div className="mt-7"><DetailPanel rows={[{ label: "Network", value: selectedNetwork.networkName }, { label: "Payout rail", value: selectedChannelLabel }, { label: "Receive", value: "USD after Bridge processing", strong: true }]} /></div>
              <div className="mt-4"><InlineNotice>Bridge currently has no quote endpoint in this integration. Review the source amount, network, payout rail, and verified account before creating the withdrawal.</InlineNotice></div>
              {error && <div className="mt-4"><FiatErrorDetail error={error} /></div>}
              <div className="mt-5">
                <FlowCta label={orderMutation.isPending ? "Creating withdrawal…" : !amount.trim() ? "Enter a USDC amount" : amountProblem ? "Enter a valid amount" : !selectedBeneficiary ? "Select a verified USD account" : "Create USD withdrawal"} onClick={createOrder} disabled={!canCreateOrder} busy={orderMutation.isPending} />
              </div>
              <p className="mt-3 text-center text-[11.5px] leading-relaxed text-subtle">You’ll review and sign the crypto transfer before the payout begins.</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

function bridgeOrderTerminal(state: string | undefined): boolean {
  return state === "completed" || state === "failed" || state === "reversed" || state === "refunded" || state === "refund_failed"
}

function isBridgeWithdrawalAvailableForUi(config: Parameters<typeof isBridgeWithdrawalAvailable>[0]): boolean {
  return isBridgeWithdrawalAvailable(config) && bridgeWithdrawalChannelOptions(config).length > 0
}
