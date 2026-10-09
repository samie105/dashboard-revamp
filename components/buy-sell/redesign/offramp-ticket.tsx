"use client"

/**
 * The local-currency Sell form in the preview ticket's look. Presentational:
 * FiatSellFlow owns the selection, beneficiary, quote and order logic and
 * passes every value and handler in. The layout maps the preview's pieces
 * onto the real ones:
 *  · "You sell" coin chip + "Send from" → the offramp route's asset/network
 *  · "You get" currency chip           → the payout country/currency
 *  · "Payout method"                   → the route's channel (when > 1)
 *  · "Get paid to" cards               → verified payout accounts only
 *    (guide §15: status and ownershipStatus both "verified"), plus the
 *    preview's other destinations, disabled and tagged Soon
 * Every pick still lands on one of /fiat/config's own route keys.
 */

import * as React from "react"
import { BankIcon, UserSwitchIcon, Wallet02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect, type FiatSelectOption } from "@/components/fiat/shared/FiatSelect"
import { formatCountdown } from "@/components/fiat/shared/format"
import { Segments, TradeCta, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { AmountBox, Breakdown, FlagArt, Joint, MethodGrid, Picker, amountInput, type BreakdownRow, type MethodCard, type PickerItem } from "@/components/buy-sell/redesign/ticket-parts"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import type { OfframpOption } from "@/lib/crypto-backend/fiat-offramp"
import type { FiatQuote } from "@/lib/crypto-backend/types"
import { percentOfBalance, sellableBalance, SELL_CHIPS } from "@/lib/sell-amount-chips"

/** The preview's other payout destinations. Not offered by the backend: shown, not selectable. */
const SOON_PAYOUTS: MethodCard[] = [
  { key: "soon:dollar", label: "Dollar Account", detail: "Credit your Dollar Account", icon: Wallet02Icon, soon: true },
  { key: "soon:p2p", label: "P2P", detail: "Sell directly to people", icon: UserSwitchIcon, soon: true },
]

export const countryKeyOf = (o: Pick<OfframpOption, "countryCode" | "currencyCode">) => `${o.countryCode}|${o.currencyCode}`

/* ── Balance line + % chips ───────────────────────────────────────────── */

/**
 * The preview's sell-side "Balance" line and 25/50/75/Max chips, from the
 * wallet balance snapshot. Nothing when the holding can't be pinned down
 * (see lib/sell-amount-chips.ts). A chip goes through `onPick`, i.e. the
 * flow's own amount input handler, so its validation still applies.
 */
export function useSellBalance(networkId: string, symbol: string) {
  const { balances } = useCryptoBalances()
  return sellableBalance(balances, networkId, symbol)
}

export function SellChips({
  balance,
  maxFractionDigits,
  amount,
  onPick,
  disabled,
}: {
  balance: { amountBaseUnits: string; decimals: number } | null
  maxFractionDigits: number
  amount: string
  onPick: (value: string) => void
  disabled: boolean
}) {
  if (!balance) return <span />
  const chips = SELL_CHIPS.map((pct) => ({ pct, value: percentOfBalance(balance.amountBaseUnits, balance.decimals, pct, maxFractionDigits) })).filter((c) => c.value)
  if (chips.length === 0) return <span />
  return (
    <div className="flex gap-1.5">
      {chips.map((c) => (
        <button
          key={c.pct}
          type="button"
          disabled={disabled}
          onClick={() => onPick(c.value)}
          className={cn(
            "h-7 rounded-lg border px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors disabled:opacity-50",
            amount === c.value ? "border-primary/50 bg-primary/[0.1] text-primary" : "border-foreground/[0.07] text-muted-foreground hover:border-foreground/[0.15] hover:text-foreground",
          )}
        >
          {c.pct === 100 ? "Max" : `${c.pct}%`}
        </button>
      ))}
    </div>
  )
}

export function balanceLabel(balance: { amountBaseUnits: string; decimals: number } | null, symbol: string): string | null {
  return balance ? `Balance ${formatCryptoAmount(balance.amountBaseUnits, balance.decimals)} ${symbol}` : null
}

/* ── Payout account form ──────────────────────────────────────────────── */

export type BeneficiaryField =
  | { kind: "text"; key: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "tel"; autoComplete?: string; invalid: boolean; invalidText: string; disabled: boolean }
  | { kind: "bank"; key: string; value: string; options: FiatSelectOption[]; onChange: (v: string) => void; disabled: boolean; listFailed: boolean; onRetry: () => void; invalid: boolean }

export function BeneficiaryFormView({
  fields,
  notices,
  error,
  save,
}: {
  fields: BeneficiaryField[]
  notices: React.ReactNode
  error: FiatErrorDescription | null
  save: { label: string; onClick: () => void; disabled: boolean; busy: boolean }
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-foreground">Recipient details</span>
        <span className="text-[12.5px] text-muted-foreground">Check these details carefully before continuing.</span>
      </div>
      {fields.map((f) =>
        f.kind === "bank" ? (
          <div key={f.key} className="flex flex-col gap-1.5">
            <FiatSelect label="Bank" value={f.value} options={f.options} onChange={f.onChange} disabled={f.disabled} />
            {f.listFailed && (
              <span className="text-[12.5px] text-muted-foreground">
                We couldn&apos;t load the bank list.{" "}
                <button type="button" onClick={f.onRetry} className="font-semibold text-primary underline-offset-2 hover:underline">Try again</button>
              </span>
            )}
            {f.invalid && <span className="text-[12px] text-debit">Choose a bank to continue.</span>}
          </div>
        ) : (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-foreground/85">{f.label}</span>
            <input
              value={f.value}
              type="text"
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              aria-invalid={f.invalid || undefined}
              disabled={f.disabled}
              onChange={(e) => f.onChange(e.target.value)}
              className={cn(
                "h-11 rounded-xl border bg-foreground/[0.025] px-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/45 disabled:opacity-50",
                f.invalid ? "border-debit/50" : "border-foreground/[0.08]",
              )}
            />
            {f.invalid && f.invalidText && <span className="text-[12px] text-debit">{f.invalidText}</span>}
          </label>
        ),
      )}
      {notices}
      {error && <FiatErrorDetail error={error} />}
      <TradeCta label={save.label} onClick={save.onClick} disabled={save.disabled} busy={save.busy} />
    </div>
  )
}

/* ── The ticket ───────────────────────────────────────────────────────── */

export function OfframpTicket({
  railSwitch,
  banners,
  countries,
  routes,
  selected,
  onCountry,
  onRoute,
  amount,
  onAmountInput,
  submitting,
  amountProblem,
  quote,
  quoteUsable,
  secondsLeft,
  payout,
  requoteNotice,
  error,
  ctaLabel,
  onCta,
  ctaDisabled,
}: {
  railSwitch: React.ReactNode
  banners: React.ReactNode
  countries: OfframpOption[]
  routes: OfframpOption[]
  selected: OfframpOption
  onCountry: (key: string) => void
  onRoute: (key: string) => void
  amount: string
  onAmountInput: (value: string) => void
  submitting: boolean
  amountProblem: string | null
  quote: FiatQuote | null
  quoteUsable: boolean
  secondsLeft: number
  payout: {
    loading: boolean
    error: FiatErrorDescription | null
    accounts: { id: string; holderName: string; maskedAccount: string; currency: string }[]
    value: string
    onChange: (id: string) => void
    formOpen: boolean
    onToggleForm: () => void
    form: React.ReactNode
  }
  requoteNotice: boolean
  error: FiatErrorDescription | null
  ctaLabel: string
  onCta: () => void
  ctaDisabled: boolean
}) {
  const balance = useSellBalance(selected.network, selected.symbol)

  const symbols = Array.from(new Set(routes.map((r) => r.symbol)))
  const channels = Array.from(new Set(routes.map((r) => r.channel)))
  const networks = routes.filter((r) => r.symbol === selected.symbol && r.channel === selected.channel)

  // Each pick keeps the other two choices where it can, and always lands on a real route.
  const pick = (want: Partial<Pick<OfframpOption, "symbol" | "channel" | "network">>) => {
    const fits = (r: OfframpOption, keys: (keyof typeof want)[]) => keys.every((k) => r[k] === (want[k] ?? selected[k]))
    const order: (keyof typeof want)[][] = [["symbol", "channel", "network"], ["symbol", "channel"], ...(want.channel ? [["channel"] as (keyof typeof want)[]] : []), ["symbol"]]
    for (const keys of order) {
      const hit = routes.find((r) => fits(r, keys))
      if (hit) return onRoute(hit.key)
    }
  }

  const coinItems: PickerItem[] = symbols.map((symbol) => ({
    key: symbol,
    label: symbol,
    sub: Array.from(new Set(routes.filter((r) => r.symbol === symbol).map((r) => r.network))).join(", "),
    art: <CoinAvatar symbol={symbol} size="lg" className="size-8 ring-1 ring-foreground/10" />,
  }))
  const currencyItems: PickerItem[] = countries.map((o) => ({
    key: countryKeyOf(o),
    label: o.currencyCode,
    sub: countryNameForCode(o.countryCode, o.countryName),
    art: <FlagArt flag={countryFlagForCode(o.countryCode)} />,
  }))

  const payoutCards: MethodCard[] = [
    ...payout.accounts.map((a) => ({ key: a.id, label: a.holderName, detail: `${a.maskedAccount} · ${a.currency}`, icon: BankIcon })),
    ...SOON_PAYOUTS,
  ]

  const rows: BreakdownRow[] = quote
    ? [
        { label: "You send", value: `${quote.sourceAmount} ${quote.sourceCurrency}` },
        ...(quote.providerRate ? [{ label: "Rate", value: quote.providerRate }] : []),
        ...(quote.providerFee ? [{ label: "Provider fee", value: quote.providerFee }] : []),
        ...(quote.worldstreetFee ? [{ label: "Worldstreet fee", value: quote.worldstreetFee }] : []),
        { label: "Network", value: quote.network },
        { label: "Quote valid for", value: quoteUsable ? formatCountdown(secondsLeft) : "Expired" },
        { label: "You receive", value: `${quote.destinationAmount} ${quote.destinationCurrency}`, strong: true },
      ]
    : [
        { label: "Rate", value: "—" },
        { label: "Fees", value: "—" },
        { label: "Network", value: selected.network },
        { label: "You receive", value: "—", strong: true },
      ]

  return (
    <div className="flex flex-col gap-5">
      {railSwitch}
      {banners}

      <div className="relative flex flex-col gap-2">
        <AmountBox
          label="You sell"
          aside={balanceLabel(balance, selected.symbol)}
          tone={amountProblem ? "error" : "default"}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SellChips balance={balance} maxFractionDigits={8} amount={amount} onPick={onAmountInput} disabled={submitting} />
              <span className={cn("text-[12px] tabular-nums", amountProblem ? "font-semibold text-debit" : "text-muted-foreground")}>
                {amountProblem ?? (quote ? `≈ ${quote.destinationAmount} ${quote.destinationCurrency}` : " ")}
              </span>
            </div>
          }
        >
          <input
            inputMode="decimal"
            aria-label={`Amount in ${selected.symbol}`}
            value={amount}
            onChange={(e) => onAmountInput(e.target.value)}
            placeholder="0"
            disabled={submitting}
            className={amountInput}
          />
          <Picker label="Coin" items={coinItems} value={selected.symbol} onChange={(symbol) => pick({ symbol })} disabled={submitting} />
        </AmountBox>

        <Joint />

        <AmountBox label="You get" tone="muted" aside={quote ? (quoteUsable ? "From your quote" : "Quote expired") : "Shown with your quote"}>
          <span className={cn(amountInput, "truncate", !quote && "text-muted-foreground/30")}>{quote ? quote.destinationAmount : "0"}</span>
          <Picker label="Currency" items={currencyItems} value={countryKeyOf(selected)} onChange={onCountry} disabled={submitting} />
        </AmountBox>
      </div>

      {networks.length > 1 && (
        <Segments id="sell-network" label="Send from" options={networks.map((r) => ({ key: r.network, label: r.network }))} value={selected.network} onChange={(network) => !submitting && pick({ network })} />
      )}
      {channels.length > 1 && (
        <Segments id="sell-channel" label="Payout method" options={channels.map((c) => ({ key: c, label: humanizeValue(c) }))} value={selected.channel} onChange={(channel) => !submitting && pick({ channel })} />
      )}

      <div className="flex flex-col gap-2">
        {payout.loading ? (
          <>
            <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">Get paid to</span>
            <span className="skel h-[66px] rounded-2xl" aria-busy aria-label="Loading payout accounts" />
          </>
        ) : (
          <>
            {payout.error && <FiatErrorDetail error={payout.error} />}
            <MethodGrid id="sell-payout" label="Get paid to" methods={payoutCards} value={payout.value} onChange={payout.onChange} disabled={submitting} />
            {payout.accounts.length === 0 && (
              <p className="px-0.5 text-[12.5px] text-muted-foreground">Add the account where you want to receive your money.</p>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-3 px-0.5">
          <span className="text-[12px] text-muted-foreground">Individual accounts only. Choose a supported bank and enter the recipient&apos;s details.</span>
          <button type="button" onClick={payout.onToggleForm} className="shrink-0 text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline">
            {payout.formOpen ? "Hide form" : "Add account"}
          </button>
        </div>
        {payout.form}
      </div>

      <Breakdown rows={rows} />

      {quote && <TradeNotice tone="info" title="A quote shows the price; it does not reserve funds. If it expires, request a new one." />}
      {requoteNotice && <TradeNotice title="That quote is no longer available. Get a fresh quote to continue." />}
      {error && <FiatErrorDetail error={error} />}

      <TradeCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />
      <p className="-mt-2 text-center text-[11.5px] leading-relaxed text-muted-foreground">Review the final amount before signing your crypto transfer.</p>
    </div>
  )
}
