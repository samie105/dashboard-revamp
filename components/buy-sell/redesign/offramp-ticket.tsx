"use client"

/**
 * The local-currency Sell form. Presentational: FiatSellFlow owns the
 * selection, beneficiary, quote and order logic and passes every value and
 * handler in. What is shown is only what a person needs: how much, which coin,
 * where the money goes, and what they will get. The network is chosen for them
 * (cheapest first) and only mentioned in one quiet line.
 */

import * as React from "react"
import { BankIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Icon } from "@/components/dashboard/redesign/ui"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { FiatSelect, type FiatSelectOption } from "@/components/fiat/shared/FiatSelect"
import { TradeCta, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { AmountHero, Chip, Choice, Field, QuietChoice, QuoteSummary, fieldInput, type SummaryRow } from "@/components/buy-sell/redesign/trade-ui"
import { FlagArt, Picker, type PickerItem } from "@/components/buy-sell/redesign/ticket-parts"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { readableAmount } from "@/lib/crypto-backend/amount-format"
import { countryFlagForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"
import { serviceFeeRows } from "@/lib/crypto-backend/fiat-fee"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import type { OfframpOption } from "@/lib/crypto-backend/fiat-offramp"
import { networkLabel, preferredRoute } from "@/lib/crypto-backend/network-label"
import type { FiatQuote } from "@/lib/crypto-backend/types"
import { percentOfBalance, sellableBalance, SELL_CHIPS } from "@/lib/sell-amount-chips"

const CHANNEL_NAMES: Record<string, string> = { BANK: "Bank transfer", MOBILEMONEY: "Mobile money", CARD: "Card" }
const channelName = (channel: string) => CHANNEL_NAMES[channel.toUpperCase()] ?? channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase()

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
    <div className="flex min-w-0 flex-col gap-6 rounded-3xl border border-foreground/[0.09] bg-foreground/[0.02] p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[16px] font-semibold text-foreground">Add a bank account</h3>
        <p className="text-[13.5px] text-muted-foreground">Individual accounts only. Check the details before you continue.</p>
      </div>
      {fields.map((f) =>
        f.kind === "bank" ? (
          <div key={f.key} className="flex flex-col gap-2">
            <FiatSelect label="Bank" large value={f.value} options={f.options} onChange={f.onChange} disabled={f.disabled} />
            {f.listFailed && (
              <span className="text-[13px] text-muted-foreground">
                We couldn&apos;t load the bank list.{" "}
                <button type="button" onClick={f.onRetry} className="font-semibold text-primary underline-offset-2 hover:underline">Try again</button>
              </span>
            )}
            {f.invalid && <span className="text-[13px] text-debit">Choose a bank to continue.</span>}
          </div>
        ) : (
          <Field key={f.key} label={f.label}>
            <input
              value={f.value}
              type="text"
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              aria-invalid={f.invalid || undefined}
              disabled={f.disabled}
              onChange={(e) => f.onChange(e.target.value)}
              className={cn(fieldInput, f.invalid && "border-debit/50")}
            />
            {f.invalid && f.invalidText && <span className="text-[13px] text-debit">{f.invalidText}</span>}
          </Field>
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

  // Each pick keeps the other choices where it can, and always lands on a real route.
  const pick = (want: Partial<Pick<OfframpOption, "symbol" | "channel" | "network">>) => {
    const fits = (r: OfframpOption, keys: (keyof typeof want)[]) => keys.every((k) => r[k] === (want[k] ?? selected[k]))
    const order: (keyof typeof want)[][] = [["symbol", "channel", "network"], ["symbol", "channel"], ...(want.channel ? [["channel"] as (keyof typeof want)[]] : []), ["symbol"]]
    for (const keys of order) {
      const matches = routes.filter((r) => fits(r, keys))
      // With no network named, start from the cheapest one.
      const hit = want.network ? matches[0] : preferredRoute(matches)
      if (hit) return onRoute(hit.key)
    }
  }

  const currencyItems: PickerItem[] = countries.map((o) => ({
    key: countryKeyOf(o),
    label: o.currencyCode,
    sub: countryNameForCode(o.countryCode, o.countryName),
    art: <FlagArt flag={countryFlagForCode(o.countryCode)} />,
  }))

  const fees = quote?.providerFee && Number(quote.providerFee) > 0 ? quote.providerFee : null
  const rows: SummaryRow[] = quote
    ? [
        ...(fees ? [{ label: "Fees", value: `${readableAmount(fees, 2)} ${quote.destinationCurrency}` }] : []),
        ...serviceFeeRows(quote),
      ]
    : []
  const quoteTotal = quote ? Math.max(1, Math.round((Date.parse(quote.expiresAt) - Date.parse(quote.createdAt)) / 1000)) || 1 : 1

  return (
    <div className="flex flex-col gap-8">
      {railSwitch}
      {banners}

      <AmountHero
        label="You sell"
        ariaLabel={`Amount in ${selected.symbol}`}
        value={amount}
        onChange={onAmountInput}
        disabled={submitting}
        problem={amountProblem}
        helper={balanceLabel(balance, selected.symbol) ?? "Choose how much to sell"}
        tools={<SellChips balance={balance} maxFractionDigits={8} amount={amount} onPick={onAmountInput} disabled={submitting} />}
        chip={<Chip label={selected.symbol} art={<CoinAvatar symbol={selected.symbol} size="lg" className="size-8 ring-1 ring-foreground/10" />} />}
      />

      {symbols.length > 1 && (
        <Choice
          label="Sell"
          options={symbols.map((symbol) => ({ key: symbol, label: symbol, art: <CoinAvatar symbol={symbol} size="lg" className="size-8 ring-1 ring-foreground/10" /> }))}
          value={selected.symbol}
          onChange={(symbol) => pick({ symbol })}
          disabled={submitting}
        />
      )}

      <QuietChoice
        prefix="Sent from your Worldstreet wallet on"
        current={networkLabel(selected.network)}
        label="Network"
        options={networks.map((r) => ({ key: r.network, label: networkLabel(r.network) }))}
        value={selected.network}
        onChange={(network) => !submitting && pick({ network })}
        disabled={submitting}
      />

      {countries.length > 1 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] font-medium text-muted-foreground">You&apos;ll be paid in</span>
          <Picker label="Currency" items={currencyItems} value={countryKeyOf(selected)} onChange={onCountry} disabled={submitting} />
        </div>
      )}

      {channels.length > 1 && (
        <Choice label="Payout method" options={channels.map((c) => ({ key: c, label: channelName(c) }))} value={selected.channel} onChange={(channel) => !submitting && pick({ channel })} disabled={submitting} />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">Get paid to</span>
          {payout.accounts.length > 0 && (
            <button type="button" onClick={payout.onToggleForm} className="text-[13px] font-semibold text-primary underline-offset-2 hover:underline">
              {payout.formOpen ? "Cancel" : "Add account"}
            </button>
          )}
        </div>
        {payout.loading ? (
          <span className="skel h-[76px] rounded-3xl" aria-busy aria-label="Loading payout accounts" />
        ) : (
          <>
            {payout.error && <FiatErrorDetail error={payout.error} />}
            {payout.accounts.length > 0 && (
              <div role="radiogroup" aria-label="Payout account" className="flex flex-col gap-3">
                {payout.accounts.map((account) => {
                  const on = account.id === payout.value
                  return (
                    <button
                      key={account.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={submitting}
                      onClick={() => payout.onChange(account.id)}
                      className={cn(
                        "flex items-center gap-4 rounded-3xl border p-4 text-left transition-colors disabled:opacity-60 sm:p-5",
                        on ? "border-primary/60 bg-primary/[0.06]" : "border-foreground/[0.09] bg-foreground/[0.02] hover:border-foreground/[0.2]",
                      )}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.06] text-foreground">
                        <Icon icon={BankIcon} className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold text-foreground">{account.holderName}</span>
                        <span className="truncate text-[13px] text-muted-foreground">{account.maskedAccount}</span>
                      </span>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-foreground/30")}>
                        {on && <span className="size-2.5 rounded-full bg-primary" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {payout.accounts.length === 0 && !payout.formOpen && (
              <p className="text-[14px] text-muted-foreground">Add the bank account where you want to receive your money.</p>
            )}
          </>
        )}
        {payout.form}
      </div>

      {quote && (
        <QuoteSummary
          caption="You'll get"
          headline={`${readableAmount(quote.destinationAmount, 2)} ${quote.destinationCurrency}`}
          sub={`for ${readableAmount(quote.sourceAmount)} ${quote.sourceCurrency}`}
          rows={rows}
          seconds={secondsLeft}
          total={quoteTotal}
          usable={quoteUsable}
        />
      )}

      {requoteNotice && <TradeNotice title="That price is no longer available. Get a fresh one to continue." />}
      {error && <FiatErrorDetail error={error} />}

      <div className="flex flex-col gap-4">
        <TradeCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={submitting} />
        <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
          {quote ? "You'll check the final amount before you sign. A price doesn't hold your funds." : "You'll see the exact amount before you sign anything."}
        </p>
      </div>
    </div>
  )
}
