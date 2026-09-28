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
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { SectionMessage } from "@/components/crypto/primitives"
import { readTxHash } from "@/components/crypto/send/send-helpers"
import { BridgeKycPanel } from "@/components/fiat/compliance/BridgeKycPanel"
import { ComplianceStatusList } from "@/components/fiat/compliance/ComplianceStatusList"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
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

const WALLET_SETUP_HREF = "/wallet/modern"

type Props = {
  variant?: "page" | "modal"
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
}: {
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

  const shell = (content: React.ReactNode) => (
    <>
      {isModal ? (
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{railSwitcher}{content}</div>
      ) : (
        <FlowShell>
          <PageHeader title="Sell" subtitle="Send USDC from your Worldstreet wallet, receive USD" back="/" className="mb-5" />
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
      return shell(order.error
        ? <><FiatErrorDetail error={describeFiatError(order.error)} /><FlowCta label="Try again" onClick={order.refresh} /></>
        : <FlowSkeleton />)
    }
    return shell(
      <>
        {config.data?.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This withdrawal uses the provider test environment. No production fiat is moved." />}
        <BridgeWithdrawalOrderStatus
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

  if (!isCryptoBackendEnabled) return shell(<UnavailablePanel title="The Worldstreet wallet isn't enabled" tone="muted" reason="The new wallet is still rolling out for your account." />)
  if (wallet.needsSetup) return shell(<UnavailablePanel title="You don't have a Worldstreet wallet yet" tone="muted" reason="Create your Worldstreet wallet first." action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_SETUP_HREF) }} />)
  if (wallet.error) return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  if (config.error && !config.data) return shell(<><FiatErrorDetail error={describeFiatError(config.error)} /><FlowCta label="Try again" onClick={() => void config.refetch()} /></>)
  if (wallet.isLoading || !config.data) return shell(<FlowSkeleton />)

  if (!isBridgeWithdrawalAvailableForUi(config.data)) {
    return shell(<UnavailablePanel title="USD withdrawals aren't available" tone="muted" reason="Bridge has not enabled a verified USD payout route for this deployment." />)
  }
  if (networks.length === 0) {
    return shell(<UnavailablePanel title="Your wallet has no supported USDC network" tone="muted" reason="Bridge can only withdraw from a network that this Worldstreet wallet owns and the backend has approved." />)
  }
  if (!selectedNetwork) {
    return shell(<UnavailablePanel title="A supported USDC network is not selected" tone="muted" reason="Refresh the wallet and capability data before creating a withdrawal." />)
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
    key: beneficiary.id,
    label: beneficiary.holderName,
    sub: `${beneficiary.maskedAccount} · ${beneficiary.channel.toUpperCase()}`,
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

  return shell(
    <>
      {config.data.environment === "sandbox" && <AnnouncementBanner title="Sandbox" detail="This withdrawal uses the provider test environment. No production fiat is moved." />}
      <FlowHeader direction="out" title="Sell USDC for USD" subtitle="Send crypto from your Worldstreet wallet to your verified USD account." />
      <RouteStrip
        direction="out"
        from={{ label: "Worldstreet wallet", sub: `${selectedNetwork.networkName} · USDC` }}
        to={{ label: "Your USD account", sub: selectedChannelLabel }}
      />
      <div className="py-1">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-muted-foreground">USDC amount</span>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" disabled={orderMutation.isPending} aria-invalid={Boolean(amountProblem) || undefined} />
        </label>
        {amountProblem && <p className="mt-1 text-[12px] text-destructive">{amountProblem}</p>}
      </div>
      {networks.length > 1 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Send from</Eyebrow>
          <ChoiceRow
            options={networks.map((network) => ({ key: network.networkId, label: network.networkName, sub: `${network.asset} · ${network.paymentRail}` }))}
            value={selectedNetwork.networkId}
            onChange={setNetworkId}
            disabled={orderMutation.isPending}
            columns={2}
          />
        </div>
      )}
      {channels.length > 1 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>USD payout rail</Eyebrow>
          <ChoiceRow
            options={channels.map((item) => ({ key: item.channel, label: bridgeWithdrawalChannelLabel(item.channel), sub: "Verified external account" }))}
            value={activeChannel ?? ""}
            onChange={(value) => setChannel(value as BridgeWithdrawalChannel)}
            disabled={orderMutation.isPending}
            columns={2}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Eyebrow>Verified USD account</Eyebrow>
        {beneficiaries.isLoading ? <FlowSkeleton /> : beneficiaryOptions.length > 0 ? (
          <ChoiceRow options={beneficiaryOptions} value={beneficiaryId} onChange={setBeneficiaryId} disabled={orderMutation.isPending} />
        ) : (
          <InlineNotice tone="warning">No verified Bridge USD account is available for this payout rail. Add and verify your own external account through the approved Bridge onboarding process before withdrawing.</InlineNotice>
        )}
      </div>
      <DetailPanel
        rows={[
          { label: "You send", value: `${amount.trim() || "—"} USDC` },
          { label: "Network", value: selectedNetwork.networkName },
          { label: "Payout rail", value: selectedChannelLabel },
          { label: "Receive", value: "USD after Bridge processing", strong: true },
        ]}
      />
      <InlineNotice>
        Bridge currently has no quote endpoint in this integration. Review the source amount, network, payout rail, and verified account before creating the withdrawal. The backend remains authoritative for limits and eligibility.
      </InlineNotice>
      {error && <FiatErrorDetail error={error} />}
      <FlowCta
        label={orderMutation.isPending ? "Creating withdrawal…" : !amount.trim() ? "Enter a USDC amount" : amountProblem ? "Enter a valid amount" : !selectedBeneficiary ? "Select a verified USD account" : "Create USD withdrawal"}
        onClick={createOrder}
        disabled={!canCreateOrder}
        busy={orderMutation.isPending}
      />
    </>
  )
}

function bridgeOrderTerminal(state: string | undefined): boolean {
  return state === "completed" || state === "failed" || state === "reversed" || state === "refunded" || state === "refund_failed"
}

function isBridgeWithdrawalAvailableForUi(config: Parameters<typeof isBridgeWithdrawalAvailable>[0]): boolean {
  return isBridgeWithdrawalAvailable(config) && bridgeWithdrawalChannelOptions(config).length > 0
}
