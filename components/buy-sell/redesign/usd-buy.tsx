"use client"

/**
 * The USD rail of Buy in the preview's look. Presentational only: the data,
 * polls, mutations and copy decisions stay in BridgeUsdBuy and
 * BridgeKycPanel, which render these when their variant is "redesign".
 * The preview has no USD design, so these are styled in its language:
 * the pay/receive boxes as a route, the breakdown box for bank details,
 * the recent-orders rows for deposits. No provider names.
 */

import * as React from "react"
import { ArrowDown01Icon, BankIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Icon } from "@/components/dashboard/redesign/ui"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { TradeCta, TradeGhost, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { AmountBox, Joint } from "@/components/buy-sell/redesign/ticket-parts"
import { describeComplianceRecord } from "@/lib/crypto-backend/fiat-compliance"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"
import type { FiatCustomer, FiatVirtualAccountActivity } from "@/lib/crypto-backend/types"

const label = "px-0.5 text-[12.5px] font-semibold text-foreground/85"
const box = "rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015]"

/** Your bank → your wallet, in the pay / receive boxes. */
export function UsdRoute() {
  return (
    <div className="relative flex flex-col gap-2">
      <AmountBox label="You send">
        <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">A bank transfer from your US bank</span>
        <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-4">
          <span className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.1] text-primary">
            <Icon icon={BankIcon} className="size-4" />
          </span>
          <span className="text-[14.5px] font-semibold text-foreground">USD</span>
        </span>
      </AmountBox>
      <Joint />
      <AmountBox label="You receive" tone="muted">
        <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">In your Worldstreet wallet</span>
        <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-4">
          <CoinAvatar symbol="USDC" size="lg" className="size-8 ring-1 ring-foreground/10" />
          <span className="text-[14.5px] font-semibold text-foreground">USDC</span>
        </span>
      </AmountBox>
    </div>
  )
}

/** BridgeUsdBuy's page: the account area, then the identity check when one is required. */
export function UsdBuyLayout({ account, kyc }: { account: React.ReactNode; kyc?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <UsdRoute />
      {account}
      {kyc}
    </div>
  )
}

export function UsdLoading() {
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="Loading">
      <span className="skel h-4 w-28 rounded" />
      <span className="skel h-[160px] rounded-2xl" />
    </div>
  )
}

export function UsdLoadError({ error, onRetry }: { error: FiatErrorDescription; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <FiatErrorDetail error={error} />
      <TradeCta label="Try again" onClick={onRetry} />
    </div>
  )
}

/* ── One account: deposit details + deposits ──────────────────────────── */

export function UsdAccountView({
  rows,
  note,
  status,
  deposits,
}: {
  rows: { label: string; value: React.ReactNode }[]
  note: string
  status: string
  deposits: React.ReactNode
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className={label}>Send USD to</span>
        {rows.length > 0 ? (
          <dl className={cn(box, "flex flex-col divide-y divide-foreground/[0.06] px-4")}>
            {rows.map((r) => (
              <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-[13px]">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="min-w-0 font-semibold text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={cn(box, "px-4 py-3 text-[13px] text-muted-foreground")}>Deposit details aren&apos;t available yet. We&apos;ll keep checking.</p>
        )}
        <p className="px-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{note}</p>
        <dl className={cn(box, "flex justify-between gap-3 px-4 py-3 text-[13px]")}>
          <dt className="text-muted-foreground">Account status</dt>
          <dd className="font-semibold text-foreground">{status}</dd>
        </dl>
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>Deposits</span>
        {deposits}
      </div>
    </>
  )
}

export function UsdDepositsLoading() {
  return <span className="skel h-12 rounded-2xl" aria-busy aria-label="Loading deposits" />
}

export function UsdDeposits({ items, rail, when, status }: { items: FiatVirtualAccountActivity[]; rail: (i: FiatVirtualAccountActivity) => string; when: (i: FiatVirtualAccountActivity) => string; status: (i: FiatVirtualAccountActivity) => string }) {
  return (
    <ul className={cn(box, "flex flex-col p-1.5")}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.08] text-primary">
            <Icon icon={BankIcon} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold tabular-nums text-credit">+{item.amount} {item.currency}</span>
            <span className="truncate text-[12px] text-muted-foreground">{[rail(item), when(item)].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{status(item)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Guide §10.2 lines 955-956: an empty list means no reconciled activity yet, not a failed payment. */
export function UsdNoDeposits() {
  return <p className={cn(box, "px-4 py-3 text-[13px] leading-relaxed text-muted-foreground")}>No deposits yet. Bank transfers show here once they&apos;ve been received.</p>
}

/* ── No account yet ───────────────────────────────────────────────────── */

export function CreateUsdAccountView({
  readinessCopy,
  refusal,
  cta,
}: {
  readinessCopy: string | null
  refusal: FiatErrorDescription | null
  cta: { label: string; disabled: boolean; busy: boolean; onClick: () => void }
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className={label}>Your USD account</span>
      <p className={cn(box, "px-4 py-3 text-[13px] leading-relaxed text-muted-foreground")}>
        Get US bank details to send USD to. What you send arrives as USDC in your Worldstreet wallet.
      </p>
      {readinessCopy && <TradeNotice title="USD deposits are unavailable" detail={readinessCopy} />}
      {refusal && <FiatErrorDetail error={refusal} />}
      <TradeCta label={cta.label} onClick={cta.onClick} disabled={cta.disabled} busy={cta.busy} />
    </div>
  )
}

/* ── Identity check ───────────────────────────────────────────────────── */

export function KycCard({ open, onToggle, hasRecord, children }: { open: boolean; onToggle: () => void; hasRecord: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(box, "flex flex-col p-4")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-start justify-between gap-3 text-left">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-foreground">Identity check</span>
          <span className="text-[12.5px] leading-relaxed text-muted-foreground">
            {hasRecord
              ? "Your verification is on file. Open this to continue or refresh it."
              : "Needed before we can give you USD bank details. Local-currency buying doesn't use this check."}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-primary">
          {open ? "Hide" : hasRecord ? "Review" : "Start"}
          <Icon icon={ArrowDown01Icon} className={cn("size-4 transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
        </span>
      </button>
      {open && <div className="mt-4 border-t border-foreground/[0.06] pt-4">{children}</div>}
    </div>
  )
}

const humanize = (value: string | null | undefined) => value?.replace(/_/g, " ") || "Unavailable"

/** ComplianceStatusList's rows for one record, without the provider label. */
export function ComplianceRows({ record }: { record: FiatCustomer }) {
  const view = describeComplianceRecord(record)
  const rows = [
    { label: "Status", value: humanize(view.status) },
    { label: "Identity check", value: humanize(view.kycStatus) },
    { label: "Terms", value: humanize(view.tosStatus) },
    ...view.endorsements.map((e) => ({ label: `Endorsement: ${humanize(e.name)}`, value: humanize(e.status) })),
    ...(view.lastSyncedAt ? [{ label: "Last checked", value: new Date(view.lastSyncedAt).toLocaleString() }] : []),
  ]
  return (
    <dl className={cn(box, "flex flex-col gap-2 px-4 py-3 text-[13px]")}>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-semibold capitalize text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export type KycField = { key: string; label: string; value: string; type: string; autoComplete: string; maxLength?: number; invalid: boolean }

export function KycFormView({
  record,
  fields,
  onField,
  pending,
  startError,
  unsafeLink,
  cta,
  link,
  finishing,
  onFinish,
  finishError,
}: {
  record?: FiatCustomer
  fields: KycField[]
  onField: (key: string, value: string) => void
  pending: boolean
  startError: FiatErrorDescription | null
  unsafeLink: boolean
  cta: { label: string; disabled: boolean; onClick: () => void }
  link: string | null
  finishing: boolean
  onFinish: () => void
  finishError: FiatErrorDescription | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        We verify your identity before we can give you USD bank details. Verification happens on our partner&apos;s secure page, which opens in a new tab.
      </p>
      {record && <ComplianceRows record={record} />}
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-foreground/85">{f.label}</span>
            <input
              value={f.value}
              type={f.type}
              autoComplete={f.autoComplete}
              maxLength={f.maxLength}
              aria-invalid={f.invalid || undefined}
              disabled={pending}
              onChange={(e) => onField(f.key, e.target.value)}
              className={cn(
                "h-11 rounded-xl border bg-foreground/[0.025] px-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/45 disabled:opacity-50",
                f.invalid ? "border-debit/50" : "border-foreground/[0.08]",
              )}
            />
            {f.invalid && <span className="text-[12px] text-debit">Check this field.</span>}
          </label>
        ))}
      </div>
      {startError && <FiatErrorDetail error={startError} />}
      {unsafeLink && <TradeNotice tone="error" title="We couldn't open the verification page safely" detail="Please contact support." />}
      <TradeCta label={cta.label} onClick={cta.onClick} disabled={cta.disabled} busy={pending} />
      {link && (
        <div className={cn(box, "flex flex-col gap-2.5 px-4 py-3 text-[13px]")}>
          <span className="text-muted-foreground">
            Verification opened in a new tab. If it didn&apos;t open,{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">open it here</a>.
          </span>
          <TradeGhost label={finishing ? "Checking your verification…" : "I've finished"} onClick={onFinish} disabled={finishing} />
        </div>
      )}
      {finishError && <FiatErrorDetail error={finishError} />}
    </div>
  )
}
