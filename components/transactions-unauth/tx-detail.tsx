"use client"

/**
 * One transaction, in full — the answer to "where is my money?".
 *
 * Order of the panel is the order of the questions: what happened (type,
 * status, amount), how far it got (the timeline), then the proof (addresses,
 * hash, fee) and the next step (retry, deposit again, explorer).
 *
 * Rendered in the side column on wide screens and inside a sheet below that.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  Exchange01Icon,
  LinkSquare02Icon,
  Refresh01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { walletHref } from "@/components/preview/routes"
import { directionOf, formatAmount, formatUSD, usdOf, type Tx, type TxKind } from "@/components/transactions-unauth/tx-data"
import { Figure, Icon, type IconSvg } from "@/components/redesign/ui"

/* ── Vocabulary shared with the list ──────────────────────────────────── */

export const KIND_META: Record<TxKind, { label: string; icon: IconSvg }> = {
  deposit: { label: "Deposit", icon: ArrowDownLeft01Icon },
  withdrawal: { label: "Withdrawal", icon: ArrowUpRight01Icon },
  swap: { label: "Swap", icon: ArrowLeftRightIcon },
  trade: { label: "Trade", icon: Exchange01Icon },
  transfer: { label: "Transfer", icon: ArrowLeftRightIcon },
}

export function kindTone(kind: TxKind) {
  const d = directionOf(kind)
  return d === "credit"
    ? "border-credit/25 bg-credit/[0.1] text-credit"
    : d === "debit"
      ? "border-debit/25 bg-debit/[0.1] text-debit"
      : "border-primary/25 bg-primary/[0.08] text-primary"
}

export function StatusChip({ tx, className }: { tx: Tx; className?: string }) {
  if (tx.status === "pending") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-md bg-warning/[0.12] px-2 py-0.5 text-[11px] font-bold tabular-nums text-warning", className)}>
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-warning opacity-70" />
          <span className="relative size-1.5 rounded-full bg-warning" />
        </span>
        {tx.confirmations ? `${tx.confirmations[0]}/${tx.confirmations[1]}` : "Pending"}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
        tx.status === "failed" ? "bg-debit/[0.12] text-debit" : "bg-credit/[0.1] text-credit",
        className,
      )}
    >
      {tx.status === "failed" ? "Failed" : "Completed"}
    </span>
  )
}

/** Signed amount text for the primary leg. */
export function amountText(tx: Tx) {
  const d = directionOf(tx.kind)
  const sign = d === "credit" ? "+" : d === "debit" ? "−" : ""
  return `${sign}${formatAmount(tx.amount)} ${tx.asset}`
}

/** Day labels resolved on the client — the server can't know the viewer's calendar. */
export function useDayLabel() {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => setNow(Date.now()), [])
  return React.useCallback(
    (offset: number, style: "heading" | "short" = "heading") => {
      if (offset === 0) return "Today"
      if (offset === 1) return "Yesterday"
      if (now === null) return `${offset} days ago`
      const d = new Date(now - offset * 86_400_000)
      return new Intl.DateTimeFormat("en-US", style === "heading" ? { weekday: "long", month: "short", day: "numeric" } : { month: "short", day: "numeric" }).format(d)
    },
    [now],
  )
}

export function truncateMiddle(s: string, head = 8, tail = 6) {
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

type Step = { label: string; hint?: string; state: "done" | "current" | "failed" | "todo" }

function stepsFor(tx: Tx): Step[] {
  const failed = tx.status === "failed"
  const pending = tx.status === "pending"
  switch (tx.kind) {
    case "deposit":
      return [
        { label: "Detected on chain", hint: tx.network, state: "done" },
        {
          label: "Confirming",
          hint: tx.confirmations ? `${tx.confirmations[0]} of ${tx.confirmations[1]} confirmations` : "Network confirmations",
          state: pending ? "current" : "done",
        },
        { label: "Credited to Funding", hint: pending ? "As soon as confirmations complete" : undefined, state: pending ? "todo" : "done" },
      ]
    case "withdrawal":
      return failed
        ? [
            { label: "Requested", state: "done" },
            { label: "Rejected by the network", hint: "Funds were returned to your wallet", state: "failed" },
          ]
        : [
            { label: "Requested", state: "done" },
            { label: "Broadcast", hint: tx.network, state: "done" },
            { label: "Confirmed", hint: "Arrived at the destination", state: "done" },
          ]
    case "swap":
    case "trade":
      return [
        { label: tx.kind === "swap" ? "Swap submitted" : "Order placed", hint: tx.network, state: "done" },
        { label: "Filled", hint: `${formatAmount(tx.toAmount ?? 0)} ${tx.toAsset} received`, state: "done" },
      ]
    case "transfer":
      return [{ label: "Moved instantly", hint: `${tx.network} · no fee`, state: "done" }]
  }
}

function Timeline({ tx }: { tx: Tx }) {
  const steps = stepsFor(tx)
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <motion.li
          key={s.label}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.08 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex gap-3 pb-4 last:pb-0"
        >
          {i < steps.length - 1 && (
            <span aria-hidden className={cn("absolute left-[11px] top-6 bottom-0 w-px", s.state === "done" ? "bg-credit/40" : "bg-white/[0.1]")} />
          )}
          <span
            className={cn(
              "relative flex size-6 shrink-0 items-center justify-center rounded-full border",
              s.state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
              s.state === "current" && "border-warning/50 bg-warning/[0.12] text-warning",
              s.state === "failed" && "border-debit/40 bg-debit/[0.12] text-debit",
              s.state === "todo" && "border-white/[0.12] text-muted-foreground",
            )}
          >
            {s.state === "done" && <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} />}
            {s.state === "failed" && <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.6} />}
            {s.state === "current" && <span className="size-2 animate-pulse rounded-full bg-warning" />}
          </span>
          <span className="flex min-w-0 flex-col pt-0.5">
            <span className={cn("text-[13px] font-semibold", s.state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
            {s.hint && <span className="text-[12px] text-muted-foreground">{s.hint}</span>}
          </span>
        </motion.li>
      ))}
    </ol>
  )
}

/* ── Detail rows ──────────────────────────────────────────────────────── */

function CopyValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {})
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      title={value}
      className="group inline-flex min-w-0 items-center gap-1.5 text-right"
    >
      <span className={cn("truncate text-[12.5px] text-foreground", mono && "font-mono")}>{truncateMiddle(value, 10, 8)}</span>
      <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5 shrink-0 transition-colors", copied ? "text-credit" : "text-muted-foreground group-hover:text-primary")} />
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/[0.05] py-3 first:border-t-0">
      <dt className="shrink-0 text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

export function TxDetail({ tx, onClose }: { tx: Tx; onClose?: () => void }) {
  const dayLabel = useDayLabel()
  const meta = KIND_META[tx.kind]
  const d = directionOf(tx.kind)
  const twoLeg = !!tx.toAsset
  const onChain = tx.kind === "deposit" || tx.kind === "withdrawal" || tx.kind === "swap"

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-11 items-center justify-center rounded-2xl border", kindTone(tx.kind))}>
            <Icon icon={meta.icon} className="size-5" strokeWidth={2} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-display text-[16px] font-semibold text-foreground">{meta.label}</span>
            <StatusChip tx={tx} className="w-fit" />
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Icon icon={Cancel01Icon} className="size-5" />
          </button>
        )}
      </div>

      {/* Amount — one leg, or both legs of a swap/trade. */}
      <div className="rounded-2xl border border-white/[0.06] bg-[radial-gradient(120%_100%_at_0%_0%,rgb(250_204_21/0.05),transparent_60%)] p-4">
        {twoLeg ? (
          <div className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <CoinAvatar symbol={tx.asset} size="lg" className="size-8 ring-1 ring-white/10" />
              <span className="font-display text-[17px] font-semibold tabular-nums"><Figure mask="••••">{`${formatAmount(tx.amount)} ${tx.asset}`}</Figure></span>
              <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{formatUSD(usdOf(tx.asset, tx.amount))}</Figure></span>
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-primary">
              <Icon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-end gap-1.5 text-right">
              <CoinAvatar symbol={tx.toAsset!} size="lg" className="size-8 ring-1 ring-white/10" />
              <span className="font-display text-[17px] font-semibold tabular-nums text-credit"><Figure mask="••••">{`${formatAmount(tx.toAmount ?? 0)} ${tx.toAsset}`}</Figure></span>
              <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{formatUSD(usdOf(tx.toAsset!, tx.toAmount ?? 0))}</Figure></span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CoinAvatar symbol={tx.asset} size="lg" className="size-10 ring-1 ring-white/10" />
            <span className="flex flex-col">
              <span
                className={cn(
                  "font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] tabular-nums",
                  tx.status === "failed" ? "text-muted-foreground line-through decoration-debit/60" : d === "credit" ? "text-credit" : "text-foreground",
                )}
              >
                <Figure mask="••••">{amountText(tx)}</Figure>
              </span>
              <span className="text-[12.5px] text-muted-foreground"><Figure mask="••••">{formatUSD(usdOf(tx.asset, tx.amount))}</Figure></span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Progress</span>
        <Timeline tx={tx} />
      </div>

      <dl className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4">
        <Row label="Date">{`${dayLabel(tx.dayOffset, "short")}, ${tx.time}`}</Row>
        <Row label={tx.kind === "transfer" ? "Route" : "Network"}>{tx.network}</Row>
        {tx.counterparty && (
          <Row label={tx.kind === "deposit" ? "From" : "To"}>
            <CopyValue value={tx.counterparty} />
          </Row>
        )}
        {onChain && (
          <Row label="Transaction hash">
            <CopyValue value={tx.hash} />
          </Row>
        )}
        <Row label="Network fee">
          {tx.fee > 0 ? (
            <span className="tabular-nums">
              {formatAmount(tx.fee)} {tx.feeAsset}
              <span className="ml-1.5 text-muted-foreground">({formatUSD(usdOf(tx.feeAsset, tx.fee))})</span>
            </span>
          ) : (
            <span className="text-credit">Free</span>
          )}
        </Row>
        <Row label="Reference">
          <span className="font-mono text-[12.5px] uppercase text-muted-foreground">{tx.id}</span>
        </Row>
      </dl>

      <div className="flex gap-2.5">
        {onChain && (
          <a
            href="#"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-[13.5px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
          >
            <Icon icon={LinkSquare02Icon} className="size-4" />
            View on explorer
          </a>
        )}
        {tx.status === "failed" && tx.kind === "withdrawal" && (
          <Link href={walletHref("withdraw", tx.asset)} className="dash-gold-btn flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold">
            <Icon icon={Refresh01Icon} className="size-4" strokeWidth={2} />
            Retry withdrawal
          </Link>
        )}
        {tx.kind === "deposit" && tx.status === "completed" && (
          <Link href={walletHref("deposit", tx.asset)} className="dash-gold-btn flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold">
            Deposit again
          </Link>
        )}
      </div>
    </div>
  )
}
