"use client"

/**
 * One transaction, in full: the preview's detail panel
 * (components/transactions-unauth/tx-detail.tsx) on a real record.
 *
 * Kept from the preview: the header, the amount box (one leg, or both legs of
 * a swap), the vertical progress steps, the detail list and the explorer
 * button. Swapped for the record's own data: every label, amount, address and
 * time. Left out because no record carries them: confirmations, the network
 * fee, and the "retry" / "deposit again" shortcuts.
 */

import * as React from "react"
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
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, Icon, type IconSvg } from "@/components/dashboard/redesign/ui"
import {
  amountText,
  chainLabel,
  directionOf,
  explorerUrl,
  fmtAmount,
  fmtFiat,
  glyphOf,
  isStopped,
  stepsFor,
  truncateMiddle,
  typeLabel,
  type KindGlyph,
} from "@/lib/transactions-view"
import type { UnifiedTransaction } from "@/types/transactions"

/* ── Vocabulary shared with the list ──────────────────────────────────── */

export const GLYPH_ICON: Record<KindGlyph, IconSvg> = {
  in: ArrowDownLeft01Icon,
  out: ArrowUpRight01Icon,
  swap: ArrowLeftRightIcon,
  trade: Exchange01Icon,
}

export function kindTone(tx: UnifiedTransaction) {
  const d = directionOf(tx)
  return d === "in"
    ? "border-credit/25 bg-credit/[0.1] text-credit"
    : d === "out"
      ? "border-debit/25 bg-debit/[0.1] text-debit"
      : "border-primary/25 bg-primary/[0.08] text-primary"
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** The preview's chip for pending, failed and completed; processing pings
 *  like pending, and cancelled / expired take a quiet neutral chip (the
 *  preview has neither state). */
export function StatusChip({ tx, className }: { tx: UnifiedTransaction; className?: string }) {
  if (tx.status === "pending" || tx.status === "processing") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-md bg-warning/[0.12] px-2 py-0.5 text-[11px] font-bold tabular-nums text-warning", className)}>
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-warning opacity-70" />
          <span className="relative size-1.5 rounded-full bg-warning" />
        </span>
        {tx.status === "pending" ? "Pending" : "Processing"}
      </span>
    )
  }
  const label = { completed: "Completed", failed: "Failed", cancelled: "Cancelled", expired: "Expired" }[tx.status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
        tx.status === "failed"
          ? "bg-debit/[0.12] text-debit"
          : tx.status === "completed"
            ? "bg-credit/[0.1] text-credit"
            : "bg-foreground/[0.07] text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  )
}

/** The second line under an amount: what it was worth, when that is known. */
export function worthText(tx: UnifiedTransaction): string | null {
  if (tx.fiatAmount != null) return fmtFiat(tx.fiatAmount, tx.fiatCurrency)
  if (tx.valueUsd != null) return fmtFiat(tx.valueUsd)
  return null
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

function Timeline({ tx }: { tx: UnifiedTransaction }) {
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
            <span aria-hidden className={cn("absolute bottom-0 left-[11px] top-6 w-px", s.state === "done" ? "bg-credit/40" : "bg-foreground/[0.1]")} />
          )}
          <span
            className={cn(
              "relative flex size-6 shrink-0 items-center justify-center rounded-full border",
              s.state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
              s.state === "current" && "border-warning/50 bg-warning/[0.12] text-warning",
              s.state === "failed" && "border-debit/40 bg-debit/[0.12] text-debit",
              s.state === "todo" && "border-foreground/[0.12] text-muted-foreground",
            )}
          >
            {s.state === "done" && <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} />}
            {s.state === "failed" && <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.6} />}
            {s.state === "current" && <span className="size-2 animate-pulse rounded-full bg-warning" />}
          </span>
          <span className="flex min-w-0 flex-col pt-0.5">
            <span className={cn("text-[13px] font-semibold", s.state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
            {s.at && <span className="text-[12px] text-muted-foreground">{`${fmtDate(s.at)}, ${fmtTime(s.at)}`}</span>}
          </span>
        </motion.li>
      ))}
    </ol>
  )
}

/* ── Detail rows ──────────────────────────────────────────────────────── */

function CopyValue({ value, display, mono = true }: { value: string; display?: string; mono?: boolean }) {
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
      <span className={cn("truncate text-[12.5px] text-foreground", mono && "font-mono")}>{display ?? truncateMiddle(value, 10, 8)}</span>
      <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5 shrink-0 transition-colors", copied ? "text-credit" : "text-muted-foreground group-hover:text-primary")} />
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-foreground/[0.05] py-3 first:border-t-0">
      <dt className="shrink-0 text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end text-right text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

export function TxDetail({ tx, onClose }: { tx: UnifiedTransaction; onClose?: () => void }) {
  const d = directionOf(tx)
  const stopped = isStopped(tx.status)
  const twoLeg = tx.type === "swap" && Boolean(tx.toToken) && tx.toToken !== tx.token
  const worth = worthText(tx)
  const noRoute = !tx.chain && !tx.fromAddress && !tx.toAddress && !tx.bankDetails && !tx.direction

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-11 items-center justify-center rounded-2xl border", kindTone(tx))}>
            <Icon icon={GLYPH_ICON[glyphOf(tx)]} className="size-5" strokeWidth={2} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-display text-[16px] font-semibold text-foreground">{typeLabel(tx)}</span>
            <StatusChip tx={tx} className="w-fit" />
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Icon icon={Cancel01Icon} className="size-5" />
          </button>
        )}
      </div>

      {/* Amount — one leg, or both legs of a swap. */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-[radial-gradient(120%_100%_at_0%_0%,color-mix(in_oklab,var(--primary)_5%,transparent),transparent_60%)] p-4">
        {twoLeg ? (
          <div className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <CoinAvatar symbol={tx.token} size="lg" className="size-8 ring-1 ring-foreground/10" />
              <span className={cn("font-display text-[17px] font-semibold tabular-nums", stopped && "text-muted-foreground line-through decoration-debit/60")}>
                <Figure mask="••••">{`${fmtAmount(tx.amount)} ${tx.token}`}</Figure>
              </span>
              {worth && <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{worth}</Figure></span>}
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-foreground/[0.08] bg-foreground/[0.03] text-primary">
              <Icon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-end gap-1.5 text-right">
              <CoinAvatar symbol={tx.toToken!} size="lg" className="size-8 ring-1 ring-foreground/10" />
              <span className="font-display text-[17px] font-semibold tabular-nums text-credit">
                {/* The received amount is only shown once its precision is known. */}
                {tx.toAmount != null ? <Figure mask="••••">{`${fmtAmount(Number(tx.toAmount))} ${tx.toToken}`}</Figure> : tx.toToken}
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CoinAvatar symbol={tx.token} size="lg" className="size-10 ring-1 ring-foreground/10" />
            <span className="flex flex-col">
              <span
                className={cn(
                  "font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] tabular-nums",
                  stopped ? "text-muted-foreground line-through decoration-debit/60" : d === "in" ? "text-credit" : "text-foreground",
                )}
              >
                <Figure mask="••••">{amountText(tx)}</Figure>
              </span>
              {worth && <span className="text-[12.5px] text-muted-foreground"><Figure mask="••••">{worth}</Figure></span>}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Progress</span>
        <Timeline tx={tx} />
      </div>

      <dl className="flex flex-col rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4">
        <Row label="Date">{`${fmtDate(tx.createdAt)}, ${fmtTime(tx.createdAt)}`}</Row>
        {tx.chain && <Row label="Network">{chainLabel(tx.chain)}</Row>}
        {tx.type === "swap" && tx.fromChain && tx.toChain && tx.fromChain !== tx.toChain && (
          <Row label="Bridge">{`${chainLabel(tx.fromChain)} → ${chainLabel(tx.toChain)}`}</Row>
        )}
        {tx.fromAddress && (
          <Row label="From">
            <CopyValue value={tx.fromAddress} />
          </Row>
        )}
        {tx.toAddress && (
          <Row label="To">
            <CopyValue value={tx.toAddress} />
          </Row>
        )}
        {tx.direction && !tx.fromAddress && !tx.toAddress && (
          <Row label="Route">{tx.direction.replace(/-/g, " → ")}</Row>
        )}
        {tx.bankDetails && (
          <>
            <Row label="Bank">{tx.bankDetails.bankName}</Row>
            <Row label="Account">{`${tx.bankDetails.accountName} · ${tx.bankDetails.accountNumber}`}</Row>
          </>
        )}
        {tx.pair && <Row label="Pair">{tx.pair}</Row>}
        {tx.side && <Row label="Side">{String(tx.side).toUpperCase()}</Row>}
        {tx.price != null && <Row label="Price">{fmtFiat(tx.price)}</Row>}
        {tx.exchangeRate != null && <Row label="Rate">{`1 ${tx.token} = ${fmtFiat(tx.exchangeRate, tx.fiatCurrency)}`}</Row>}
        {noRoute && <Row label="Route"><span className="text-muted-foreground">Stayed inside WorldStreet</span></Row>}
        {tx.txHash && (
          <Row label="Transaction hash">
            <CopyValue value={tx.txHash} />
          </Row>
        )}
        <Row label="Reference">
          <CopyValue value={tx.id} display={`#${tx.id.slice(-8).toUpperCase()}`} />
        </Row>
      </dl>

      {tx.txHash && (
        <div className="flex gap-2.5">
          <a
            href={explorerUrl(tx.chain, tx.txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-foreground/[0.08] text-[13.5px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
          >
            <Icon icon={LinkSquare02Icon} className="size-4" />
            View on explorer
          </a>
        </div>
      )}
    </div>
  )
}
