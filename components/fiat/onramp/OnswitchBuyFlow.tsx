"use client"

/**
 * Buy → OnSwitch onramp. Guide §13 "OnSwitch local-fiat onramp" (lines
 * 1145-1156): config → corridor + wallet-ready asset → quote (amounts, fees,
 * rate, expiry) → order → payment instructions → poll to a terminal state.
 *
 * Rendered by BuySellClient when NEXT_PUBLIC_FIAT_BUY_FLOW is "onswitch".
 * The logic lives in lib/crypto-backend/fiat-onramp.ts; this file only wires
 * it to the screen. Payment instructions stay in memory, rendered as plain
 * text, never logged (guide §15). Only the order id is persisted, so a
 * refresh resumes the same order instead of creating another (guide lines
 * 974-975).
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { SectionMessage } from "@/components/crypto/primitives"
import { OnswitchProfileForm } from "@/components/fiat/compliance/OnswitchProfileForm"
import { Button } from "@/components/ui/button"
import {
  AmountField,
  AnnouncementBanner,
  ChoiceRow,
  DetailPanel,
  FlowCta,
  FlowShell,
  FlowSkeleton,
  InlineNotice,
  StatusScreen,
  UnavailablePanel,
} from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { useFiatOrderPoll } from "@/hooks/crypto/useFiatOrderPoll"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { describeFiatError, shouldRefetchCapabilities } from "@/lib/crypto-backend/fiat-errors"
import {
  buildOnrampQuoteRequest,
  createOnrampOrder,
  isQuoteUsable,
  isValidAmount,
  maskValue,
  needsRequote,
  onrampAvailability,
  onrampOptions,
  onrampOrderView,
  paymentInstructionsFrom,
  quoteSecondsLeft,
  requestOnrampQuote,
  type OnrampOption,
  type OnrampQuoteRequest,
} from "@/lib/crypto-backend/fiat-onramp"
import type { FiatOrder, FiatQuote } from "@/lib/crypto-backend/types"
import { clearPendingFlow, readPendingFlow, savePendingFlow } from "@/lib/pending-flow"

const WALLET_SETUP_HREF = "/wallet/modern"

type Props = {
  variant?: "page" | "modal"
  onInFlightChange?: (inFlight: boolean) => void
  onCompactChange?: (compact: boolean) => void
}

/* ── Small helpers ────────────────────────────────────────────────────── */

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

function InstructionValue({ value, sensitive }: { value: string; sensitive: boolean }) {
  const [revealed, setRevealed] = React.useState(!sensitive)
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono">{revealed ? value : maskValue(value)}</span>
      {sensitive && (
        <Button variant="ghost" size="xs" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Show"}
        </Button>
      )}
      <CopyButton value={value} />
    </span>
  )
}

/* ── The flow ─────────────────────────────────────────────────────────── */

export function OnswitchBuyFlow({ variant = "page", onInFlightChange, onCompactChange }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()

  const [orderId, setOrderId] = React.useState<string | null>(
    () => (typeof window === "undefined" ? null : readPendingFlow("fiat-buy")?.reference ?? null),
  )
  const [quote, setQuote] = React.useState<FiatQuote | null>(null)
  const [quoteRequest, setQuoteRequest] = React.useState<OnrampQuoteRequest | null>(null)
  const [requoted, setRequoted] = React.useState(false)
  const [corridorKey, setCorridorKey] = React.useState<string>("")
  const [channel, setChannel] = React.useState<string>("")
  const [routeKey, setRouteKey] = React.useState<string>("")
  const [amount, setAmount] = React.useState("")
  const [showProfile, setShowProfile] = React.useState(false)

  const order = useFiatOrderPoll(orderId ?? undefined)
  const orderMissing = order.error instanceof CryptoBackendError && order.error.status === 404
  const view = order.data ? onrampOrderView(order.data) : null

  const quoteMutation = useMutation({
    mutationFn: (request: OnrampQuoteRequest) => requestOnrampQuote(cryptoBackendClient, request),
    retry: false,
    onSuccess: (next) => setQuote(next),
    onError: (error) => {
      if (shouldRefetchCapabilities(error)) config.refetchOnProviderError()
    },
  })

  const orderMutation = useMutation({
    mutationFn: (input: { walletId: string; quoteId: string }) => createOnrampOrder(cryptoBackendClient, input),
    retry: false,
    onSuccess: (created: FiatOrder) => {
      // A 201 and a 200 replay both return the order; neither means paid
      // (guide lines 966-969). The screen follows `state` from here on.
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, created.id), created)
      savePendingFlow("fiat-buy", created.id)
      setOrderId(created.id)
    },
    onError: (error) => {
      if (needsRequote(error) && quoteRequest) {
        // Guide line 970-971: re-quote. The quote key was released after the
        // last success, so this is a new logical action with a new key.
        setQuote(null)
        setRequoted(true)
        quoteMutation.mutate(quoteRequest)
      } else if (shouldRefetchCapabilities(error)) {
        config.refetchOnProviderError()
      }
    },
  })

  // Finished orders stop being "in flight": clear the stored id, and on
  // completion refresh the wallet balance and order history (guide line 961).
  const settledOrder = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!order.data || !view?.terminal || settledOrder.current === order.data.id) return
    settledOrder.current = order.data.id
    clearPendingFlow("fiat-buy")
    if (view.screen === "completed") {
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      void queryClient.invalidateQueries({ queryKey: ["crypto", "balance", userId] })
      void queryClient.invalidateQueries({ queryKey: ["crypto", "fiat-orders", userId] })
    }
  }, [order.data, view, queryClient, userId])

  React.useEffect(() => {
    if (orderMissing) clearPendingFlow("fiat-buy")
  }, [orderMissing])

  const showingOrder = Boolean(orderId) && !orderMissing
  const submitting = quoteMutation.isPending || orderMutation.isPending
  const inFlight = submitting || (showingOrder && !view?.terminal)
  React.useEffect(() => onInFlightChange?.(inFlight), [inFlight, onInFlightChange])
  React.useEffect(() => onCompactChange?.(showingOrder), [showingOrder, onCompactChange])

  const instructions = order.data ? paymentInstructionsFrom(order.data.providerDisplay) : { rows: [] }
  const now = useNow(Boolean(quote) || Boolean(instructions.expiresAt))

  function startOver() {
    clearPendingFlow("fiat-buy")
    setOrderId(null)
    setQuote(null)
    setQuoteRequest(null)
    setRequoted(false)
    quoteMutation.reset()
    orderMutation.reset()
  }

  const shell = (content: React.ReactNode) =>
    variant === "modal" ? (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{content}</div>
    ) : (
      <FlowShell>
        <PageHeader
          title="Buy"
          subtitle="Pay in your local currency, receive crypto in your Worldstreet wallet"
          back="/"
          className="mb-5"
        />
        <div className="flex flex-col gap-4">{content}</div>
      </FlowShell>
    )

  const sandbox =
    config.data?.environment === "sandbox" ? (
      <AnnouncementBanner
        title="OnSwitch sandbox"
        detail="This is the provider's test environment. Payments here are for testing."
      />
    ) : null

  /* ── An existing order always wins: the user must see its status ──── */

  if (showingOrder) {
    if (!order.data) {
      if (order.error) {
        const described = describeFiatError(order.error)
        return shell(
          <>
            <InlineNotice tone="error">
              {described.message}
              {described.requestId ? ` Reference: ${described.requestId}` : ""}
            </InlineNotice>
            <FlowCta label="Try again" onClick={order.refresh} />
          </>,
        )
      }
      return shell(<FlowSkeleton />)
    }
    return shell(
      <>
        {sandbox}
        <OrderScreen
          order={order.data}
          view={view!}
          instructions={instructions}
          now={now}
          destination={quote ? `${quote.destinationAmount} ${quote.destinationCurrency}` : null}
          onRefresh={order.refresh}
          onStartOver={startOver}
        />
      </>,
    )
  }

  /* ── Gates: wallet, then capability ───────────────────────────────── */

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
  // a confirmed 404 from GET /wallets/me. OnSwitch delivers into the user's
  // existing WorldStreet wallet (guide lines 16-19), so no order without one.
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
  if (wallet.error) {
    return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  }
  if (config.error && !config.data) {
    const described = describeFiatError(config.error)
    return shell(
      <>
        <InlineNotice tone="error">
          {described.message}
          {described.requestId ? ` Reference: ${described.requestId}` : ""}
        </InlineNotice>
        <FlowCta label="Try again" onClick={() => void config.refetch()} />
      </>,
    )
  }

  const availability = onrampAvailability(config.data)
  if (wallet.isLoading || availability === "loading") return shell(<FlowSkeleton />)
  if (availability === "disabled") {
    return shell(
      <UnavailablePanel
        title="Buying with local currency isn't available"
        tone="muted"
        reason="This option is switched off right now."
      />,
    )
  }
  if (availability === "blocked") {
    return shell(
      <UnavailablePanel title="Buying is temporarily unavailable" reason="Please try again a little later." />,
    )
  }
  if (availability === "discovery_only") {
    return shell(
      <UnavailablePanel
        title="Buying isn't open yet"
        tone="muted"
        reason="You'll be able to buy with local currency here soon."
      />,
    )
  }
  if (availability === "unavailable") {
    return shell(
      <UnavailablePanel
        title="No local currency is available to buy with right now"
        tone="muted"
        reason="None of the supported countries can take a payment at the moment."
      />,
    )
  }

  /* ── Selection (all from /fiat/config) ────────────────────────────── */

  const options = onrampOptions(config.data)
  const corridors = Array.from(
    new Map(options.map((o) => [`${o.countryCode}|${o.currencyCode}`, o])).values(),
  )
  const activeCorridor = corridors.find((o) => `${o.countryCode}|${o.currencyCode}` === corridorKey) ?? corridors[0]
  const inCorridor = options.filter(
    (o) => o.countryCode === activeCorridor.countryCode && o.currencyCode === activeCorridor.currencyCode,
  )
  const channels = Array.from(new Set(inCorridor.map((o) => o.channel)))
  const activeChannel = channels.includes(channel) ? channel : channels[0]
  const routes = inCorridor.filter((o) => o.channel === activeChannel)
  const selected: OnrampOption = routes.find((o) => o.key === routeKey) ?? routes[0]

  /* ── Quote review ─────────────────────────────────────────────────── */

  if (quote) {
    const secondsLeft = quoteSecondsLeft(quote, now)
    const usable = isQuoteUsable(quote, now)
    const orderError = orderMutation.error && !needsRequote(orderMutation.error) ? describeFiatError(orderMutation.error) : null
    const walletId = wallet.data?.id
    return shell(
      <>
        {sandbox}
        {requoted && <InlineNotice tone="warning">The earlier quote expired. Here is a new one.</InlineNotice>}
        <DetailPanel
          rows={[
            { label: "You pay", value: `${quote.sourceAmount} ${quote.sourceCurrency}`, strong: true },
            { label: "You receive", value: `${quote.destinationAmount} ${quote.destinationCurrency}`, strong: true },
            ...(quote.providerRate ? [{ label: "Rate", value: quote.providerRate }] : []),
            ...(quote.providerFee ? [{ label: "Provider fee", value: quote.providerFee }] : []),
            ...(quote.worldstreetFee ? [{ label: "Worldstreet fee", value: quote.worldstreetFee }] : []),
            { label: "Network", value: quote.network },
            ...(quote.expectedSettlementSeconds
              ? [{ label: "Usually arrives in", value: `about ${Math.max(1, Math.round(quote.expectedSettlementSeconds / 60))} min` }]
              : []),
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          {usable ? `This quote expires in ${formatCountdown(secondsLeft)}.` : "This quote has expired."} A quote
          doesn&apos;t reserve funds.
        </p>
        {orderError && (
          <InlineNotice tone="error">
            {orderError.message}
            {orderError.requestId ? ` Reference: ${orderError.requestId}` : ""}
          </InlineNotice>
        )}
        <FlowCta
          label={
            orderMutation.isPending
              ? "Creating your order…"
              : quoteMutation.isPending
                ? "Getting a new quote…"
                : usable
                  ? "Continue"
                  : "Get a new quote"
          }
          disabled={submitting || !walletId}
          busy={submitting}
          onClick={() => {
            if (!usable) {
              setQuote(null)
              if (quoteRequest) quoteMutation.mutate(quoteRequest)
              return
            }
            if (walletId) orderMutation.mutate({ walletId, quoteId: quote.id })
          }}
        />
        <Button variant="ghost" disabled={submitting} onClick={() => setQuote(null)}>
          Change amount
        </Button>
      </>,
    )
  }

  /* ── Form ─────────────────────────────────────────────────────────── */

  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter an amount greater than zero." : null
  const quoteError = quoteMutation.error ? describeFiatError(quoteMutation.error) : null

  return shell(
    <>
      {sandbox}
      {corridors.length > 1 && (
        <ChoiceRow
          options={corridors.map((o) => ({
            key: `${o.countryCode}|${o.currencyCode}`,
            label: o.countryName ?? o.countryCode,
            sub: o.currencyCode,
          }))}
          value={`${activeCorridor.countryCode}|${activeCorridor.currencyCode}`}
          onChange={setCorridorKey}
          disabled={submitting}
        />
      )}
      {channels.length > 1 && (
        <ChoiceRow
          options={channels.map((c) => ({ key: c, label: humanize(c) }))}
          value={activeChannel}
          onChange={setChannel}
          columns={2}
          disabled={submitting}
        />
      )}
      {routes.length > 1 && (
        <ChoiceRow
          options={routes.map((o) => ({ key: o.key, label: o.symbol, sub: o.network }))}
          value={selected.key}
          onChange={setRouteKey}
          columns={2}
          disabled={submitting}
        />
      )}
      <AmountField
        value={amount}
        onChange={setAmount}
        unit={selected.currencyCode}
        problem={amountProblem}
        hint={`${activeCorridor.countryName ?? activeCorridor.countryCode} · ${humanize(activeChannel)} · receive ${selected.symbol} on ${selected.network}`}
        autoFocus={variant === "page"}
        disabled={submitting}
      />
      {quoteError && (
        <InlineNotice tone="error">
          {quoteError.message}
          {quoteError.requestId ? ` Reference: ${quoteError.requestId}` : ""}
        </InlineNotice>
      )}
      <FlowCta
        label={quoteMutation.isPending ? "Getting a quote…" : !amount.trim() ? "Enter an amount" : "Get a quote"}
        disabled={!isValidAmount(amount) || submitting}
        busy={quoteMutation.isPending}
        onClick={() => {
          const request = buildOnrampQuoteRequest(selected, amount)
          setQuoteRequest(request)
          setRequoted(false)
          quoteMutation.mutate(request)
        }}
      />
      <div className="border-t border-border/60 pt-3">
        <Button variant="ghost" size="sm" onClick={() => setShowProfile((v) => !v)}>
          {showProfile ? "Hide OnSwitch profile" : "Add your OnSwitch profile (optional)"}
        </Button>
        {showProfile && (
          <div className="mt-3">
            <OnswitchProfileForm />
          </div>
        )}
      </div>
    </>,
  )
}

/* ── Order screens (guide §11 lines 952-963) ──────────────────────────── */

const PROBLEM_HEADLINE: Record<string, string> = {
  failed: "This order failed",
  reversed: "This order was reversed",
  refund_in_flight: "A refund is in progress",
  refunded: "This order was refunded",
  refund_failed: "The refund didn't go through",
}

function OrderScreen({
  order,
  view,
  instructions,
  now,
  destination,
  onRefresh,
  onStartOver,
}: {
  order: FiatOrder
  view: ReturnType<typeof onrampOrderView>
  instructions: ReturnType<typeof paymentInstructionsFrom>
  now: number
  destination: string | null
  onRefresh: () => void
  onStartOver: () => void
}) {
  const supportLine = `Quote reference ${order.publicReference} if you contact support.`

  if (view.screen === "pay") {
    const secondsLeft = instructions.expiresAt ? quoteSecondsLeft({ expiresAt: instructions.expiresAt }, now) : null
    const expired = secondsLeft === 0
    return (
      <>
        <div className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Send this payment from your bank. {destination ? `${destination} arrives` : "Your crypto arrives"} in your
          Worldstreet wallet once the payment is confirmed.
        </div>
        {instructions.rows.length > 0 ? (
          <DetailPanel
            rows={instructions.rows.map((row) => ({
              label: row.label,
              value: <InstructionValue value={row.value} sensitive={row.sensitive} />,
            }))}
          />
        ) : (
          <InlineNotice tone="warning">Payment details aren&apos;t available yet. We&apos;ll keep checking.</InlineNotice>
        )}
        {expired ? (
          <InlineNotice tone="error">
            These payment details have expired. Don&apos;t send money to them. {supportLine}
          </InlineNotice>
        ) : secondsLeft !== null ? (
          <p className="text-[13px] text-muted-foreground">These details expire in {formatCountdown(secondsLeft)}.</p>
        ) : null}
        <p className="text-[13px] text-muted-foreground">Order reference {order.publicReference}</p>
        {expired ? (
          <FlowCta label="Start a new buy" onClick={onStartOver} />
        ) : (
          <FlowCta label="I've made the transfer" onClick={onRefresh} />
        )}
      </>
    )
  }

  if (view.screen === "completed") {
    return (
      <StatusScreen
        state="success"
        direction="in"
        headline="Done — your crypto is in your Worldstreet wallet"
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new buy", onClick: onStartOver }}
      />
    )
  }

  if (view.screen === "review") {
    return (
      <StatusScreen
        state="processing"
        direction="in"
        headline="Your order is being reviewed"
        caption={
          <>
            {view.reason ? <span className="block">{view.reason}</span> : null}
            <span className="block">{supportLine}</span>
          </>
        }
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
        direction="in"
        headline={PROBLEM_HEADLINE[order.state] ?? "This order didn't complete"}
        caption={
          <>
            {view.reason ? <span className="block">{view.reason}</span> : null}
            <span className="block">{supportLine}</span>
          </>
        }
        reference={order.publicReference}
        // refund_in_flight isn't terminal and is still being polled.
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new buy", onClick: onStartOver }}
      />
    )
  }

  // continue / processing / unknown: the backend is still working.
  return (
    <StatusScreen
      state="processing"
      direction="in"
      headline={
        view.screen === "continue"
          ? "Setting up your order"
          : view.screen === "unknown"
            ? "We're checking on your order"
            : "Your order is being processed"
      }
      caption="You can close this; the order carries on and you can come back to it."
      reference={order.publicReference}
    />
  )
}
