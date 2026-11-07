"use client"

/**
 * The local-currency Buy form in the preview ticket's look. Presentational:
 * every value, handler, label and guard comes from FiatBuyFlow, which still
 * owns the selection, quote and order logic. Selectors are derived from
 * /fiat/config there (guide §5 lines 390-392); this only lays them out:
 *  · "You pay" currency chip  → the corridor picker
 *  · "Pay with" cards          → the corridor's channels (plus the preview's
 *                                other methods, disabled and tagged Soon)
 *  · "You receive" coin chip   → the route's asset; "Deliver on" → its network
 * The figures are the quote's, shown with its expiry (guide §9.1 line 769:
 * "A quote is not a payment and does not reserve funds").
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QuoteClock } from "@/components/ui/quote-clock"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { TradeCta, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { Choice, AmountHero, QuietChoice, QuoteSummary, type SummaryRow } from "@/components/buy-sell/redesign/trade-ui"
import { FlagArt, Picker, type PickerItem } from "@/components/buy-sell/redesign/ticket-parts"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import { readableAmount } from "@/lib/crypto-backend/amount-format"
import { addDecimalStrings } from "@/lib/crypto-backend/fiat-fee"
import { MINIMUM_BUY_USD, type OnrampOption } from "@/lib/crypto-backend/fiat-onramp"
import { networkLabel, preferredRoute } from "@/lib/crypto-backend/network-label"
import type { BuyRail } from "@/lib/crypto-backend/fiat-bridge-onramp"
import type { FiatQuote } from "@/lib/crypto-backend/types"

const CHANNEL_NAMES: Record<string, string> = { BANK: "Bank transfer", MOBILEMONEY: "Mobile money", CARD: "Card" }
const channelName = (channel: string) => CHANNEL_NAMES[channel.toUpperCase()] ?? channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase()

export const corridorKeyOf = (o: Pick<OnrampOption, "countryCode" | "currencyCode">) => `${o.countryCode}|${o.currencyCode}`

/** The rail switch, shown only when /fiat/config offers both rails. */
export function BuyRailSwitch({ rails, rail, onRail }: { rails: BuyRail[]; rail: BuyRail; onRail: (rail: BuyRail) => void }) {
  if (rails.length < 2) return null
  return <Choice label="Pay in" options={rails.map((r) => ({ key: r, label: r === "local" ? "Local currency" : "US dollars" }))} value={rail} onChange={onRail} />
}

/**
 * The quote's rate and countdown, to the right of Buy | Sell. Nothing until
 * there's a quote. `showRate` false (Sell): the guide only shows an onramp
 * rate, so the offramp rate isn't restated as "1 X = Y".
 */
export function QuoteHead({ quote, usable, secondsLeft, showRate = true }: { quote: FiatQuote | null; usable: boolean; secondsLeft: number; showRate?: boolean }) {
  if (!quote) return null
  const total = Math.max(1, Math.round((Date.parse(quote.expiresAt) - Date.parse(quote.createdAt)) / 1000)) || 1
  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden text-right leading-tight min-[420px]:block">
        {showRate && quote.providerRate && (
          <span className="block text-[12.5px] font-semibold tabular-nums text-foreground">
            1 {quote.destinationCurrency} = {quote.providerRate} {quote.sourceCurrency}
          </span>
        )}
        <span className={cn("block text-[11.5px]", usable ? "text-muted-foreground" : "font-semibold text-debit")}>
          {usable ? `Quote expires in ${formatCountdown(secondsLeft)}` : "Quote expired"}
        </span>
      </span>
      <QuoteClock seconds={usable ? secondsLeft : 0} total={total} />
    </div>
  )
}

export function OnrampTicket({
  railSwitch,
  banners,
  corridors,
  corridor,
  onCorridor,
  channels,
  channel,
  onChannel,
  routes,
  selected,
  onRoute,
  amount,
  onAmountInput,
  submitting,
  amountProblem,
  quote,
  quoteUsable,
  secondsLeft,
  showHolderNotice,
  error,
  ctaLabel,
  onCta,
  ctaDisabled,
}: {
  railSwitch: React.ReactNode
  banners: React.ReactNode
  corridors: OnrampOption[]
  corridor: OnrampOption
  onCorridor: (key: string) => void
  channels: string[]
  channel: string
  onChannel: (channel: string) => void
  routes: OnrampOption[]
  selected: OnrampOption
  onRoute: (key: string) => void
  amount: string
  onAmountInput: (value: string) => void
  submitting: boolean
  amountProblem: string | null
  /** Kept for callers; the helper line under the amount is fixed copy now. */
  hint?: string
  quote: FiatQuote | null
  quoteUsable: boolean
  secondsLeft: number
  showHolderNotice: boolean
  error: FiatErrorDescription | null
  ctaLabel: string
  onCta: () => void
  ctaDisabled: boolean
}) {
  const currencyItems: PickerItem[] = corridors.map((o) => ({
    key: corridorKeyOf(o),
    label: o.currencyCode,
    sub: countryNameForCode(o.countryCode, o.countryName),
    art: <FlagArt flag={countryFlagForCode(o.countryCode)} />,
  }))

  // Coins are a choice. Networks are not: the cheapest one is picked for the
  // user, and the few who care can change it from one quiet line.
  const symbols = Array.from(new Set(routes.map((r) => r.symbol)))
  const networks = routes.filter((r) => r.symbol === selected.symbol)

  const fees = quote ? [quote.providerFee, quote.worldstreetFee].filter((fee): fee is string => Number(fee) > 0).reduce((sum, fee) => addDecimalStrings(sum, fee), "0") : "0"
  const rows: SummaryRow[] = quote
    ? [
        ...(quote.providerRate ? [{ label: "Rate", value: `1 ${quote.destinationCurrency} = ${readableAmount(quote.providerRate, 2)} ${quote.sourceCurrency}` }] : []),
        ...(Number(fees) > 0 ? [{ label: "Fees", value: `${readableAmount(fees, 2)} ${quote.sourceCurrency}` }] : []),
        ...(quote.expectedSettlementSeconds ? [{ label: "Arrives in", value: `about ${Math.max(1, Math.round(quote.expectedSettlementSeconds / 60))} min` }] : []),
      ]
    : []
  const quoteTotal = quote ? Math.max(1, Math.round((Date.parse(quote.expiresAt) - Date.parse(quote.createdAt)) / 1000)) || 1 : 1

  return (
    <div className="flex flex-col gap-8">
      {railSwitch}
      {banners}

      <AmountHero
        label="You pay"
        ariaLabel={`Amount in ${corridor.currencyCode}`}
        value={amount}
        onChange={onAmountInput}
        disabled={submitting}
        problem={amountProblem}
        helper={`Minimum $${MINIMUM_BUY_USD} equivalent`}
        chip={<Picker label="Currency" items={currencyItems} value={corridorKeyOf(corridor)} onChange={onCorridor} disabled={submitting} />}
      />

      <Choice
        label="You'll receive"
        options={symbols.map((symbol) => ({ key: symbol, label: symbol, art: <CoinAvatar symbol={symbol} size="lg" className="size-8 ring-1 ring-foreground/10" /> }))}
        value={selected.symbol}
        onChange={(symbol) => {
          const next = preferredRoute(routes.filter((r) => r.symbol === symbol))
          if (next) onRoute(next.key)
        }}
        disabled={submitting}
      />

      <QuietChoice
        prefix="Goes straight to your Worldstreet wallet on"
        current={networkLabel(selected.network)}
        label="Network"
        options={networks.map((r) => ({ key: r.key, label: networkLabel(r.network) }))}
        value={selected.key}
        onChange={onRoute}
        disabled={submitting}
      />

      {channels.length > 1 && (
        <Choice label="Pay with" options={channels.map((c) => ({ key: c, label: channelName(c) }))} value={channel} onChange={onChannel} disabled={submitting} />
      )}

      {quote && (
        <QuoteSummary
          caption="You'll receive"
          headline={`${readableAmount(quote.destinationAmount)} ${quote.destinationCurrency}`}
          sub={`for ${readableAmount(quote.sourceAmount)} ${quote.sourceCurrency}`}
          rows={rows}
          seconds={secondsLeft}
          total={quoteTotal}
          usable={quoteUsable}
        />
      )}

      {showHolderNotice && (
        <TradeNotice title="Add your name" detail="Add your name to your Worldstreet account before starting an African local-currency buy." />
      )}
      {error && <FiatErrorDetail error={error} />}

      <div className="flex flex-col gap-4">
        <TradeCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />
        <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
          {quote ? "You'll get payment details after you confirm. A quote doesn't hold your funds." : "You'll see the exact price before you pay."}
        </p>
      </div>
    </div>
  )
}
