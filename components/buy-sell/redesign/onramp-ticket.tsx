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
import { BankIcon, CreditCardIcon, SmartPhone01Icon, UserSwitchIcon, Wallet02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QuoteClock } from "@/components/ui/quote-clock"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { Segments, TradeCta, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { AmountBox, Breakdown, FlagArt, Joint, MethodGrid, Picker, amountInput, type BreakdownRow, type MethodCard, type PickerItem } from "@/components/buy-sell/redesign/ticket-parts"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import { MINIMUM_BUY_USD, type OnrampOption } from "@/lib/crypto-backend/fiat-onramp"
import type { BuyRail } from "@/lib/crypto-backend/fiat-bridge-onramp"
import type { FiatQuote } from "@/lib/crypto-backend/types"

/** The preview's other ways to pay. Not offered by the backend: shown, not selectable. */
const SOON_METHODS: MethodCard[] = [
  { key: "soon:dollar", label: "Dollar Account", detail: "Pay from your Dollar Account", icon: Wallet02Icon, soon: true },
  { key: "soon:card", label: "Debit / credit card", detail: "Visa or Mastercard", icon: CreditCardIcon, soon: true },
  { key: "soon:p2p", label: "P2P", detail: "Buy directly from people", icon: UserSwitchIcon, soon: true },
]

const channelIcon = (channel: string) => (channel.toUpperCase().includes("MOBILE") ? SmartPhone01Icon : BankIcon)

export const corridorKeyOf = (o: Pick<OnrampOption, "countryCode" | "currencyCode">) => `${o.countryCode}|${o.currencyCode}`

/** The rail switch, shown when /fiat/config offers both rails. Labels as before. */
export function BuyRailSwitch({ rails, rail, onRail }: { rails: BuyRail[]; rail: BuyRail; onRail: (rail: BuyRail) => void }) {
  if (rails.length < 2) return null
  return <Segments id="buy-rail" label="Pay in" options={rails.map((r) => ({ key: r, label: r === "local" ? "Local currency" : "USD" }))} value={rail} onChange={onRail} />
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
  hint,
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
  hint: string
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

  // The route list, as a coin chip plus (when a coin rides more than one
  // network) the "Deliver on" choice. Both just pick a route key.
  const symbols = Array.from(new Set(routes.map((r) => r.symbol)))
  const assetItems: PickerItem[] = symbols.map((symbol) => ({
    key: symbol,
    label: symbol,
    sub: routes.filter((r) => r.symbol === symbol).map((r) => r.network).join(", "),
    art: <CoinAvatar symbol={symbol} size="lg" className="size-8 ring-1 ring-foreground/10" />,
  }))
  const networks = routes.filter((r) => r.symbol === selected.symbol)

  const methods: MethodCard[] = [
    ...channels.map((c) => ({ key: c, label: humanizeValue(c), detail: `Pay in ${corridor.currencyCode}`, icon: channelIcon(c) })),
    ...SOON_METHODS,
  ]

  const rows: BreakdownRow[] = quote
    ? [
        { label: "You pay", value: `${quote.sourceAmount} ${quote.sourceCurrency}` },
        ...(quote.providerRate ? [{ label: "Rate", value: `1 ${quote.destinationCurrency} = ${quote.providerRate} ${quote.sourceCurrency}` }] : []),
        ...(quote.providerFee ? [{ label: "Provider fee", value: `${quote.providerFee} ${quote.sourceCurrency}` }] : []),
        ...(quote.worldstreetFee ? [{ label: "Worldstreet fee", value: `${quote.worldstreetFee} ${quote.sourceCurrency}` }] : []),
        { label: "Minimum buy", value: `$${MINIMUM_BUY_USD} USD equivalent` },
        { label: "Network", value: quote.network },
        ...(quote.expectedSettlementSeconds
          ? [{ label: "Usually arrives in", value: `about ${Math.max(1, Math.round(quote.expectedSettlementSeconds / 60))} min` }]
          : []),
        { label: "Quote valid for", value: quoteUsable ? formatCountdown(secondsLeft) : "Expired" },
        { label: "You receive", value: `${quote.destinationAmount} ${quote.destinationCurrency}`, strong: true },
      ]
    : [
        { label: "Rate", value: "—" },
        { label: "Fees", value: "—" },
        { label: "Minimum buy", value: `$${MINIMUM_BUY_USD} USD equivalent` },
        { label: "Network", value: selected.network },
        { label: "You receive", value: "—", strong: true },
      ]

  return (
    <div className="flex flex-col gap-5">
      {railSwitch}
      {banners}

      <div className="relative flex flex-col gap-2">
        <AmountBox
          label="You pay"
          tone={amountProblem ? "error" : "default"}
          footer={
            <span className={cn("text-[12px]", amountProblem ? "font-semibold text-debit" : "text-muted-foreground")}>{amountProblem ?? hint}</span>
          }
        >
          <input
            inputMode="decimal"
            aria-label={`Amount in ${corridor.currencyCode}`}
            value={amount}
            onChange={(e) => onAmountInput(e.target.value)}
            placeholder="0"
            disabled={submitting}
            className={amountInput}
          />
          <Picker label="Currency" items={currencyItems} value={corridorKeyOf(corridor)} onChange={onCorridor} disabled={submitting} />
        </AmountBox>

        <Joint />

        <AmountBox label="You receive" tone="muted" aside={quote ? (quoteUsable ? "From your quote" : "Quote expired") : "Shown with your quote"}>
          <span className={cn(amountInput, "truncate", !quote && "text-muted-foreground/30")}>{quote ? quote.destinationAmount : "0"}</span>
          <Picker
            label="Coin"
            items={assetItems}
            value={selected.symbol}
            onChange={(symbol) => {
              const first = routes.find((r) => r.symbol === symbol)
              if (first) onRoute(first.key)
            }}
            disabled={submitting}
          />
        </AmountBox>
      </div>

      {networks.length > 1 && (
        <Segments id="buy-network" label="Deliver on" options={networks.map((r) => ({ key: r.key, label: r.network }))} value={selected.key} onChange={(k) => !submitting && onRoute(k)} />
      )}

      <MethodGrid id="buy-method" label="Pay with" methods={methods} value={channel} onChange={onChannel} disabled={submitting} />

      <Breakdown rows={rows} />

      {showHolderNotice && (
        <TradeNotice title="Add your name" detail="Add your name to your Worldstreet account before starting an African local-currency buy." />
      )}
      {error && <FiatErrorDetail error={error} />}

      <TradeCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />
      <p className="-mt-2 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {quote ? "Funds are sent to the bank details returned after your order is created. Never reuse expired details." : "Your live quote appears here before any order is created."}
      </p>
    </div>
  )
}
