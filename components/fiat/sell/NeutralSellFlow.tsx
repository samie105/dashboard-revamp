"use client"

/**
 * Sell crypto for local currency.
 *
 * Three calm steps: how much, how you want to be paid (only when there is a
 * real choice), and where to send it. The options never name the company
 * behind them: a person decides on what they receive and how fast. Once an
 * order exists this hands over to FiatSellFlow, which already tracks the order
 * and signs the wallet transaction (including any fee the backend bundled in).
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect } from "@/components/fiat/shared/FiatSelect"
import { TradeCta, TradeFrame, TradeGhost, TradeNotice, TradeSkeleton } from "@/components/buy-sell/redesign/kit"
import { balanceLabel, SellChips, useSellBalance } from "@/components/buy-sell/redesign/offramp-ticket"
import { AmountHero, Choice, Chip, Field, QuietChoice, QuoteSummary, StepHeader, fieldInput, type SummaryRow } from "@/components/buy-sell/redesign/trade-ui"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { FlowShell } from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { cn } from "@/lib/utils"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { readableAmount } from "@/lib/crypto-backend/amount-format"
import { describeFiatError, fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"
import {
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
import { networkLabel, preferredRoute } from "@/lib/crypto-backend/network-label"
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

const QUOTE_WINDOW_SECONDS = 300

function money(amount: string, currency: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${readableAmount(amount, 2)} ${currency}`
  }
}

/** One payout option: what you get is the headline, everything else is quiet. */
function OptionCard({ option, symbol, selected, onSelect }: { option: PayoutOption; symbol: string; selected: boolean; onSelect: () => void }) {
  const speed = settlementLabel(option.estimatedSeconds)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-4 rounded-3xl border p-5 text-left transition-colors sm:p-6",
        selected ? "border-primary/60 bg-primary/[0.06]" : "border-foreground/[0.09] bg-foreground/[0.02] hover:border-foreground/[0.2]",
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className={cn("flex size-5 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-foreground/30")}>
            {selected && <span className="size-2.5 rounded-full bg-primary" />}
          </span>
          <span className="text-[15px] font-semibold text-foreground">{option.label}</span>
        </span>
        <span className="flex gap-1.5">
          {option.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-primary/[0.12] px-2.5 py-1 text-[11.5px] font-semibold text-primary">{tagLabel(tag)}</span>
          ))}
        </span>
      </span>
      <span>
        <span className="block text-[13px] text-muted-foreground">You receive</span>
        <span className="mt-1 block font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">{money(option.receiveAmount, option.receiveCurrency)}</span>
      </span>
      <span className="flex flex-col gap-1 text-[13.5px] text-muted-foreground">
        <span className="flex items-baseline justify-between gap-4">
          <span>You send</span>
          <span className="font-medium tabular-nums text-foreground">{readableAmount(option.totalDebit)} {symbol}</span>
        </span>
        {hasExtraFee(option) && <span className="text-right text-[12.5px]">includes a {readableAmount(option.feeAmount)} {symbol} fee</span>}
        {speed && (
          <span className="flex items-baseline justify-between gap-4">
            <span>Arrives</span>
            <span className="font-medium text-foreground">{speed.replace("About ", "in about ").replace("Under", "in under")}</span>
          </span>
        )}
      </span>
      {!option.rateGuaranteed && <span className="text-[12.5px] text-muted-foreground">This rate can move slightly before your deposit settles.</span>}
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
  // With a single option the choice step is skipped, so Back must skip it too.
  const skippedChoice = React.useRef(false)

  // Start on the cheapest network; nobody should have to pick one to sell a stablecoin.
  const route: OfframpOption | undefined = routes.find((item) => item.key === routeKey) ?? preferredRoute(routes)
  const selected = options.find((option) => option.optionId === optionId)
  const balance = useSellBalance(route?.network ?? "", route?.symbol ?? "")

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
      skippedChoice.current = next.length === 1
      setStage(next.length === 1 ? "payout" : "options")
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
  const symbol = route?.symbol ?? ""
  const bankOptions = (banks.data ?? []).map((bank) => ({ value: bank.id, label: bank.name }))
  const accountReady = payoutAccountReady({ bankId, accountNumber, holderName })
  const symbols = Array.from(new Set(routes.map((item) => item.symbol)))
  const networks = routes.filter((item) => item.symbol === route?.symbol)
  const amountProblem = amount.trim() && !isValidAmount(amount) ? "Enter a valid amount" : null

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

  // The rail switch only belongs on the first step; mid-flow it would be a trap.
  const rail = stage === "amount" ? railSwitcher : null
  const shell = (content: React.ReactNode, tabs = stage === "amount") =>
    variant === "modal" ? (
      <div className="flex flex-1 flex-col gap-8 p-5">{rail}{content}</div>
    ) : variant === "redesign" ? (
      <TradeFrame mode="sell" tabs={tabs}>{rail}{content}</TradeFrame>
    ) : (
      <FlowShell className="max-w-xl px-3 py-5 sm:px-5 sm:py-8">
        <PageHeader title="Sell crypto" subtitle="Choose how you want to be paid" back="/" className="mb-4" />
        {rail}
        <div className="flex flex-1 flex-col gap-8">{content}</div>
      </FlowShell>
    )

  if (config.isLoading || wallet.isLoading) return shell(<TradeSkeleton />)

  if (routes.length === 0) {
    return shell(
      <>
        <TradeNotice tone="info" title="Naira payouts are not available right now" detail="You can still sell for another currency." />
        <TradeCta label="Sell for another currency" onClick={onUseOtherCurrency} />
      </>,
    )
  }

  if (stage === "amount") {
    return shell(
      <div className="flex flex-col gap-8">
        <AmountHero
          label="You sell"
          ariaLabel={`Amount in ${symbol}`}
          value={amount}
          onChange={setAmount}
          problem={amountProblem}
          disabled={compare.isPending}
          helper={balanceLabel(balance, symbol) ?? "Choose how much to sell"}
          tools={<SellChips balance={balance} maxFractionDigits={8} amount={amount} onPick={setAmount} disabled={compare.isPending} />}
          chip={<Chip label={symbol} art={<CoinAvatar symbol={symbol} size="lg" className="size-8 ring-1 ring-foreground/10" />} />}
        />

        {symbols.length > 1 && (
          <Choice
            label="Sell"
            options={symbols.map((item) => ({ key: item, label: item, art: <CoinAvatar symbol={item} size="lg" className="size-8 ring-1 ring-foreground/10" /> }))}
            value={route?.symbol ?? ""}
            onChange={(item) => {
              const next = preferredRoute(routes.filter((candidate) => candidate.symbol === item))
              if (next) setRouteKey(next.key)
            }}
            disabled={compare.isPending}
          />
        )}

        <QuietChoice
          prefix="Sent from your Worldstreet wallet on"
          current={route ? networkLabel(route.network) : ""}
          label="Network"
          options={networks.map((item) => ({ key: item.key, label: networkLabel(item.network) }))}
          value={route?.key ?? ""}
          onChange={setRouteKey}
          disabled={compare.isPending}
        />

        {compare.error ? <FiatErrorDetail error={describeFiatError(compare.error)} /> : null}

        <div className="flex flex-col gap-4">
          <TradeCta
            label={!amount.trim() ? "Enter an amount" : "See what you'll get"}
            busy={compare.isPending}
            disabled={!route || !isValidAmount(amount) || compare.isPending || !wallet.data?.id}
            onClick={() => route && compare.mutate({ route, amount })}
          />
          <button type="button" onClick={onUseOtherCurrency} className="self-center text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Sell for a different currency
          </button>
        </div>
      </div>,
    )
  }

  if (stage === "options") {
    return shell(
      <div className="flex flex-col gap-8">
        <StepHeader title="Choose how to get paid" caption={`Selling ${readableAmount(amount)} ${symbol}`} onBack={backToAmount} />
        <div role="radiogroup" aria-label="Payout options" className="flex flex-col gap-4">
          {options.map((option) => (
            <OptionCard key={option.optionId} option={option} symbol={symbol} selected={option.optionId === optionId} onSelect={() => setOptionId(option.optionId)} />
          ))}
        </div>
        {expired && <TradeNotice tone="warning" title="These prices have expired" detail="Go back and refresh the options." />}
        <div className="flex flex-col gap-4">
          <TradeCta label="Continue" disabled={!selected || expired} onClick={() => setStage("payout")} />
          {selected && !expired && (
            <p className="text-center text-[12.5px] tabular-nums text-muted-foreground">
              Prices hold for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </p>
          )}
        </div>
      </div>,
      false,
    )
  }

  const summaryRows: SummaryRow[] = selected
    ? [
        { label: "You send", value: `${readableAmount(selected.totalDebit)} ${symbol}` },
        ...(hasExtraFee(selected) ? [{ label: "Includes a fee of", value: `${readableAmount(selected.feeAmount)} ${symbol}` }] : []),
        ...(settlementLabel(selected.estimatedSeconds) ? [{ label: "Arrives", value: settlementLabel(selected.estimatedSeconds)!.replace("About ", "in about ").replace("Under", "in under") }] : []),
      ]
    : []

  return shell(
    <div className="flex flex-col gap-8">
      <StepHeader title="Where should we send it?" onBack={skippedChoice.current ? backToAmount : () => { placeOrder.reset(); setStage("options") }} />

      {selected && (
        <QuoteSummary
          caption="You'll receive"
          headline={money(selected.receiveAmount, selected.receiveCurrency)}
          rows={summaryRows}
          seconds={secondsLeft}
          total={QUOTE_WINDOW_SECONDS}
          usable={!expired}
        />
      )}

      {banks.isLoading && <TradeSkeleton />}
      {banks.error ? <FiatErrorDetail error={describeFiatError(banks.error)} /> : null}

      {!banks.isLoading && !banks.error && (
        <div className="flex flex-col gap-6">
          <FiatSelect label="Bank" large value={bankId} onChange={editPayout(setBankId)} options={bankOptions} />
          <Field label="Account number">
            <input
              className={fieldInput}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="10 digits"
              value={accountNumber}
              onChange={(event) => editPayout(setAccountNumber)(event.target.value.replace(/\D/g, ""))}
              aria-invalid={accountNumber.length > 0 && !isValidAccountNumber(accountNumber)}
            />
          </Field>
          <Field label="Account name" hint="It must match the name on your verified account.">
            <input className={fieldInput} autoComplete="off" placeholder="Name on the account" value={holderName} onChange={(event) => editPayout(setHolderName)(event.target.value)} />
          </Field>
        </div>
      )}

      {expired && <TradeNotice tone="warning" title="These prices have expired" detail="Go back and refresh the options." />}
      {placeOrder.error ? <FiatErrorDetail error={describeFiatError(placeOrder.error)} /> : null}

      <div className="flex flex-col gap-3">
        <TradeCta
          label="Review and sell"
          busy={placeOrder.isPending}
          disabled={!accountReady || expired || placeOrder.isPending || !wallet.data?.id}
          onClick={() => placeOrder.mutate()}
        />
        <TradeGhost label="Start over" onClick={backToAmount} />
      </div>
    </div>,
    false,
  )
}
