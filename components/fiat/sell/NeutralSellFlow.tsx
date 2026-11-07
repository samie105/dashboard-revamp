"use client"

/**
 * Sell crypto for local currency by choosing between payout options.
 *
 * The options come from the backend already ranked and never name the company
 * behind them: the user decides on what they receive, what leaves their wallet
 * and how fast. Once an order exists this hands over to FiatSellFlow, which
 * already tracks the order and signs the wallet transaction (including any
 * fee the backend bundled into it).
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect } from "@/components/fiat/shared/FiatSelect"
import { formatCountdown } from "@/components/fiat/shared/format"
import { TradeCta, TradeFrame, TradeGhost, TradeNotice, TradeSkeleton } from "@/components/buy-sell/redesign/kit"
import { Input } from "@/components/ui/input"
import { FlowShell } from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { describeFiatError, fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"
import {
  formatFiat,
  hasExtraFee,
  isOptionUsable,
  isValidAccountNumber,
  listPayoutBanks,
  optionSecondsLeft,
  payoutAccountReady,
  placePayoutOrder,
  requestPayoutOptions,
  settlementLabel,
  tagLabel,
} from "@/lib/crypto-backend/fiat-compare"
import { isValidAmount, offrampOptions, type OfframpOption } from "@/lib/crypto-backend/fiat-offramp"
import type { PayoutOption } from "@/lib/crypto-backend/types"
import { savePendingFlow } from "@/lib/pending-flow"

type Stage = "amount" | "options" | "payout"

type Props = {
  variant?: "page" | "modal" | "redesign"
  railSwitcher?: React.ReactNode
  /** An order now exists; the caller should show the order view. */
  onOrderPlaced: () => void
  /** The user needs a currency this flow does not cover. */
  onUseOtherCurrency: () => void
}

function OptionCard({ option, symbol, selected, onSelect }: { option: PayoutOption; symbol: string; selected: boolean; onSelect: () => void }) {
  const speed = settlementLabel(option.estimatedSeconds)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-border"}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold">{option.label}</span>
        <span className="flex gap-1.5">
          {option.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{tagLabel(tag)}</span>
          ))}
        </span>
      </span>
      <span className="mt-3 block text-xs text-muted-foreground">You receive</span>
      <span className="block text-2xl font-semibold tabular-nums">{formatFiat(option.receiveAmount, option.receiveCurrency)}</span>
      <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
        <span className="tabular-nums"><span className="text-muted-foreground">You send </span><span className="font-medium">{option.totalDebit} {symbol}</span></span>
        {speed && <span className="text-muted-foreground">{speed}</span>}
      </span>
      {hasExtraFee(option) && (
        <span className="mt-1 block text-xs text-muted-foreground">Includes a {option.feeAmount} {symbol} service fee</span>
      )}
      {!option.rateGuaranteed && (
        <span className="mt-1 block text-xs text-muted-foreground">This rate can change slightly before your deposit settles.</span>
      )}
    </button>
  )
}

export function NeutralSellFlow({ variant = "page", railSwitcher, onOrderPlaced, onUseOtherCurrency }: Props) {
  const queryClient = useQueryClient()
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const config = useFiatConfig()

  const routes = React.useMemo(() => offrampOptions(config.data).filter((route) => route.currencyCode === "NGN" && route.channel.toUpperCase() === "BANK"), [config.data])

  const [stage, setStage] = React.useState<Stage>("amount")
  const [routeKey, setRouteKey] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [options, setOptions] = React.useState<PayoutOption[]>([])
  const [optionId, setOptionId] = React.useState("")
  const [bankId, setBankId] = React.useState("")
  const [accountNumber, setAccountNumber] = React.useState("")
  const [holderName, setHolderName] = React.useState("")
  const [now, setNow] = React.useState(() => Date.now())
  // Counts edits to the payout account; see placePayoutOrder.
  const revision = React.useRef(0)

  const route: OfframpOption | undefined = routes.find((item) => item.key === routeKey) ?? routes[0]
  const selected = options.find((option) => option.optionId === optionId)

  React.useEffect(() => {
    if (stage === "amount") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stage])

  const compare = useMutation({
    mutationFn: (input: { route: OfframpOption; amount: string }) => requestPayoutOptions(cryptoBackendClient, {
      amount: input.amount.trim(), asset: input.route.asset, network: input.route.network, country: input.route.countryCode, currency: input.route.currencyCode,
    }),
    retry: false,
    onSuccess: (next) => {
      setOptions(next)
      setOptionId(next[0]?.optionId ?? "")
      setNow(Date.now())
      setStage("options")
    },
  })

  const banks = useQuery({
    queryKey: ["fiat-payout-banks", userId, optionId],
    queryFn: ({ signal }) => listPayoutBanks(cryptoBackendClient, optionId, signal),
    enabled: Boolean(isCryptoBackendEnabled && isLoaded && isSignedIn && stage === "payout" && optionId),
    retry: fiatReadRetry,
    staleTime: 5 * 60_000,
  })

  const placeOrder = useMutation({
    mutationFn: () => placePayoutOrder(cryptoBackendClient, {
      walletId: wallet.data!.id,
      quoteId: optionId,
      revision: revision.current,
      payout: { bankId, accountNumber: accountNumber.trim(), holderName: holderName.trim() },
    }),
    retry: false,
    onSuccess: (created) => {
      queryClient.setQueryData(cryptoQueryKeys.fiatOrder(userId, created.id), created)
      // FiatSellFlow resumes from this marker and shows the order and signing step.
      savePendingFlow("fiat-sell", created.id)
      onOrderPlaced()
    },
  })

  const expired = Boolean(selected) && !isOptionUsable(selected!, now)
  const secondsLeft = selected ? optionSecondsLeft(selected, now) : 0
  const amountOk = isValidAmount(amount)

  const bankOptions = (banks.data ?? []).map((bank) => ({ value: bank.id, label: bank.name }))
  const accountReady = payoutAccountReady({ bankId, accountNumber, holderName })
  const symbol = route?.symbol ?? ""

  function backToAmount() {
    compare.reset()
    placeOrder.reset()
    setStage("amount")
  }

  function editPayout(setter: (value: string) => void) {
    return (value: string) => {
      revision.current += 1
      placeOrder.reset()
      setter(value)
    }
  }

  const shell = (content: React.ReactNode) => (
    variant === "modal" ? (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{railSwitcher}{content}</div>
    ) : variant === "redesign" ? (
      <TradeFrame mode="sell">{railSwitcher}<div className="flex flex-col gap-4">{content}</div></TradeFrame>
    ) : (
      <FlowShell className="max-w-xl px-3 py-5 sm:px-5 sm:py-8">
        <PageHeader title="Sell crypto" subtitle="Choose how you want to be paid" back="/" className="mb-4" />
        {railSwitcher}
        <div className="flex flex-1 flex-col gap-4">{content}</div>
      </FlowShell>
    )
  )

  if (config.isLoading || wallet.isLoading) return shell(<TradeSkeleton />)

  if (routes.length === 0) {
    return shell(
      <>
        <TradeNotice tone="info" title="Naira payouts are not available right now" detail="You can still sell for another currency." />
        <TradeCta label="Use another currency" onClick={onUseOtherCurrency} />
      </>,
    )
  }

  if (stage === "amount") {
    return shell(
      <>
        <FiatSelect
          label="Asset"
          value={route?.key ?? ""}
          onChange={setRouteKey}
          options={routes.map((item) => ({ value: item.key, label: item.symbol, meta: humanizeValue(item.network) }))}
        />
        <div className="space-y-2">
          <label htmlFor="sell-amount" className="block text-xs font-semibold text-muted-foreground">Amount to sell{symbol ? ` (${symbol})` : ""}</label>
          <Input id="sell-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        {compare.error ? <FiatErrorDetail error={describeFiatError(compare.error)} /> : null}
        <TradeCta
          label="See payout options"
          busy={compare.isPending}
          disabled={!route || !amountOk || compare.isPending || !wallet.data?.id}
          onClick={() => route && compare.mutate({ route, amount })}
        />
        <TradeGhost label="Sell for another currency" onClick={onUseOtherCurrency} />
      </>,
    )
  }

  if (stage === "options") {
    return shell(
      <>
        <p className="text-sm text-muted-foreground">Selling {amount} {symbol}. Pick the option that suits you.</p>
        <div className="flex flex-col gap-3" role="group" aria-label="Payout options">
          {options.map((option) => (
            <OptionCard key={option.optionId} option={option} symbol={symbol} selected={option.optionId === optionId} onSelect={() => setOptionId(option.optionId)} />
          ))}
        </div>
        {selected && !expired && <p className="text-xs tabular-nums text-muted-foreground">These prices hold for {formatCountdown(secondsLeft)}.</p>}
        {expired && <TradeNotice tone="warning" title="These prices have expired" detail="Go back and refresh the options." />}
        <TradeCta label="Continue" disabled={!selected || expired} onClick={() => setStage("payout")} />
        <TradeGhost label="Change amount" onClick={backToAmount} />
      </>,
    )
  }

  return shell(
    <>
      {selected && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <span className="block text-xs text-muted-foreground">You receive</span>
          <span className="block text-xl font-semibold tabular-nums">{formatFiat(selected.receiveAmount, selected.receiveCurrency)}</span>
          <span className="mt-1 block tabular-nums text-muted-foreground">You send {selected.totalDebit} {symbol}{hasExtraFee(selected) ? ` (includes a ${selected.feeAmount} ${symbol} service fee)` : ""}</span>
        </div>
      )}
      {banks.isLoading && <TradeSkeleton />}
      {banks.error ? <FiatErrorDetail error={describeFiatError(banks.error)} /> : null}
      {!banks.isLoading && !banks.error && (
        <>
          <FiatSelect label="Bank" value={bankId} onChange={editPayout(setBankId)} options={bankOptions} />
          <div className="space-y-2">
            <label htmlFor="payout-account" className="block text-xs font-semibold text-muted-foreground">Account number</label>
            <Input id="payout-account" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="10 digits" value={accountNumber} onChange={(event) => editPayout(setAccountNumber)(event.target.value.replace(/\D/g, ""))} aria-invalid={accountNumber.length > 0 && !isValidAccountNumber(accountNumber)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="payout-name" className="block text-xs font-semibold text-muted-foreground">Account name</label>
            <Input id="payout-name" autoComplete="off" placeholder="Name on the account" value={holderName} onChange={(event) => editPayout(setHolderName)(event.target.value)} />
            <p className="text-xs text-muted-foreground">It must match the name on your verified account.</p>
          </div>
        </>
      )}
      {expired && <TradeNotice tone="warning" title="These prices have expired" detail="Go back and refresh the options." />}
      {placeOrder.error ? <FiatErrorDetail error={describeFiatError(placeOrder.error)} /> : null}
      <TradeCta
        label="Review and sell"
        busy={placeOrder.isPending}
        disabled={!accountReady || expired || placeOrder.isPending || !wallet.data?.id}
        onClick={() => placeOrder.mutate()}
      />
      <TradeGhost label="Back to options" onClick={() => { placeOrder.reset(); setStage("options") }} />
    </>,
  )
}
