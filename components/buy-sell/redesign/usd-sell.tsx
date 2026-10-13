"use client"

/**
 * The USD withdrawal (Sell → USD) in the preview ticket's look.
 * Presentational: BridgeUsdSell owns the network, channel, beneficiary and
 * order logic and renders these when its variant is "redesign". There's no
 * quote for this rail (BridgeUsdSell's header), so the receive box says what
 * arrives rather than how much. Channels are only those the backend returns
 * as available (guide §5 lines 405-411); accounts only verified, owned ones.
 * No provider names.
 */

import * as React from "react"
import { BankIcon, UserSwitchIcon, Wallet02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Icon } from "@/components/dashboard/redesign/ui"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { Segments, TradeCta, TradeGhost, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { AmountBox, Breakdown, Joint, MethodGrid, amountInput, type MethodCard } from "@/components/buy-sell/redesign/ticket-parts"
import { SellChips, balanceLabel, useSellBalance } from "@/components/buy-sell/redesign/offramp-ticket"
import { ComplianceRows } from "@/components/buy-sell/redesign/usd-buy"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import type { FiatCustomer } from "@/lib/crypto-backend/types"

const SOON_PAYOUTS: MethodCard[] = [
  { key: "soon:dollar", label: "Dollar Account", detail: "Credit your Dollar Account", icon: Wallet02Icon, soon: true },
  { key: "soon:p2p", label: "P2P", detail: "Sell directly to people", icon: UserSwitchIcon, soon: true },
]

export function UsdSellTicket({
  railSwitch,
  banners,
  amount,
  onAmountInput,
  pending,
  amountProblem,
  networks,
  networkId,
  networkName,
  onNetwork,
  channels,
  channel,
  channelLabel,
  onChannel,
  accounts,
  accountsLoading,
  beneficiaryId,
  onBeneficiary,
  error,
  ctaLabel,
  onCta,
  ctaDisabled,
}: {
  railSwitch: React.ReactNode
  banners: React.ReactNode
  amount: string
  onAmountInput: (value: string) => void
  pending: boolean
  amountProblem: string | null
  networks: { networkId: string; networkName: string }[]
  networkId: string
  networkName: string
  onNetwork: (id: string) => void
  channels: { key: string; label: string }[]
  channel: string
  channelLabel: string
  onChannel: (key: string) => void
  accounts: { id: string; holderName: string; maskedAccount: string; channel: string }[]
  accountsLoading: boolean
  beneficiaryId: string
  onBeneficiary: (id: string) => void
  error: FiatErrorDescription | null
  ctaLabel: string
  onCta: () => void
  ctaDisabled: boolean
}) {
  const balance = useSellBalance(networkId, "USDC")
  const cards: MethodCard[] = [
    ...accounts.map((a) => ({ key: a.id, label: a.holderName, detail: `${a.maskedAccount} · ${a.channel.toUpperCase()}`, icon: BankIcon })),
    ...SOON_PAYOUTS,
  ]

  return (
    <div className="flex flex-col gap-5">
      {railSwitch}
      {banners}

      <div className="relative flex flex-col gap-2">
        <AmountBox
          label="You sell"
          aside={balanceLabel(balance, "USDC")}
          tone={amountProblem ? "error" : "default"}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SellChips balance={balance} maxFractionDigits={6} amount={amount} onPick={onAmountInput} disabled={pending} />
              <span className={cn("text-[12px]", amountProblem ? "font-semibold text-debit" : "text-muted-foreground")}>{amountProblem ?? " "}</span>
            </div>
          }
        >
          <input inputMode="decimal" aria-label="Amount in USDC" value={amount} onChange={(e) => onAmountInput(e.target.value)} placeholder="0" disabled={pending} className={amountInput} />
          <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-4">
            <CoinAvatar symbol="USDC" size="lg" className="size-8 ring-1 ring-foreground/10" />
            <span className="text-[14.5px] font-semibold text-foreground">USDC</span>
          </span>
        </AmountBox>
        <Joint />
        <AmountBox label="You get" tone="muted" aside="After processing">
          <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">USD to your verified account</span>
          <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-4">
            <span className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.1] text-primary">
              <Icon icon={BankIcon} className="size-4" />
            </span>
            <span className="text-[14.5px] font-semibold text-foreground">USD</span>
          </span>
        </AmountBox>
      </div>

      {networks.length > 1 && (
        <Segments id="usd-sell-network" label="Send from" options={networks.map((n) => ({ key: n.networkId, label: n.networkName }))} value={networkId} onChange={(id) => !pending && onNetwork(id)} />
      )}
      {channels.length > 1 && (
        <Segments id="usd-sell-channel" label="Payout method" options={channels} value={channel} onChange={(key) => !pending && onChannel(key)} />
      )}

      <div className="flex flex-col gap-2">
        {accountsLoading ? (
          <>
            <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">Get paid to</span>
            <span className="skel h-[66px] rounded-2xl" aria-busy aria-label="Loading USD accounts" />
          </>
        ) : (
          <>
            <MethodGrid id="usd-sell-payout" label="Get paid to" methods={cards} value={beneficiaryId} onChange={onBeneficiary} disabled={pending} />
            {accounts.length === 0 && (
              <TradeNotice title="No verified USD account is available for this payout method. Add and verify your own account before withdrawing." />
            )}
          </>
        )}
        <span className="px-0.5 text-[12px] text-muted-foreground">Only your own verified account can receive this payout.</span>
      </div>

      <Breakdown
        rows={[
          { label: "You send", value: `${amount.trim() || "0"} USDC` },
          { label: "Network", value: networkName },
          { label: "Payout method", value: channelLabel },
          { label: "You receive", value: "USD after processing", strong: true },
        ]}
      />
      <TradeNotice tone="info" title="There's no quote for USD withdrawals. Review the amount, network, payout method and account before you continue." />
      {error && <FiatErrorDetail error={error} />}

      <TradeCta label={ctaLabel} onClick={onCta} disabled={ctaDisabled} busy={pending} />
      <p className="-mt-2 text-center text-[11.5px] leading-relaxed text-muted-foreground">You&apos;ll review and sign the crypto transfer before the payout begins.</p>
    </div>
  )
}

/** BridgeUsdSell's "approval required" screen. */
export function UsdSellVerify({
  railSwitch,
  complianceError,
  record,
  showRecord,
  kyc,
  onRefresh,
}: {
  railSwitch: React.ReactNode
  complianceError: FiatErrorDescription | null
  record?: FiatCustomer
  showRecord: boolean
  kyc: React.ReactNode
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {railSwitch}
      <div className="flex flex-col gap-1">
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">Verify your identity</span>
        <span className="text-[13.5px] text-muted-foreground">Approval is required before a USD withdrawal can be created.</span>
      </div>
      {complianceError && <FiatErrorDetail error={complianceError} />}
      {showRecord && (record ? <ComplianceRows record={record} /> : <p className="text-[13px] text-muted-foreground">No verification on file yet.</p>)}
      {kyc ?? <TradeNotice tone="info" title="Your USD payout profile isn't approved yet. Refresh after onboarding is complete." />}
      <TradeGhost label="Refresh status" onClick={onRefresh} />
    </div>
  )
}
