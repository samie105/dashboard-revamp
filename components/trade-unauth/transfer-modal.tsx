"use client"

/**
 * Deposit / Withdraw / Transfer for the trading account — and the PROCESSING
 * state the live flow never shows.
 *
 * The live "Fund trading account" modal is one screen: a big zero, a From row,
 * an Available row, an amber note saying bridge deposits "usually take a few
 * minutes", and a disabled CTA. Press it and the modal closes. The few minutes
 * it warned you about happen somewhere you cannot see, which is exactly the
 * window in which a person refreshes, re-sends, or opens support.
 *
 * So this is a three-step flow — amount → review → progress — and the third
 * step is the point. It reuses the app's own money-flow stage grammar
 * (`ws-stage-rail-active`, `ws-stage-halo` in globals.css) so a staged
 * transfer looks the same here as everywhere else in the product.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
  Tick02Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { FUTURES_EQUITY } from "@/components/trade-unauth/futures-data"

export type FlowKind = "deposit" | "withdraw" | "transfer"

const COPY: Record<FlowKind, { title: string; description: string; cta: string; icon: typeof ArrowDownLeft01Icon }> = {
  deposit: {
    title: "Fund trading account",
    description: "Move USDC from your wallet into your trading account.",
    cta: "Deposit",
    icon: ArrowDownLeft01Icon,
  },
  withdraw: {
    title: "Withdraw to wallet",
    description: "Move USDC out of your trading account and back on-chain.",
    cta: "Withdraw",
    icon: ArrowUpRight01Icon,
  },
  transfer: {
    title: "Transfer between accounts",
    description: "Move funds between spot and futures. Instant, no network fee.",
    cta: "Transfer",
    icon: ArrowDataTransferHorizontalIcon,
  },
}

/** Sources, with the balance each actually has. */
const SOURCES = [
  { key: "arbitrum", label: "Modern wallet · Arbitrum", balance: 1023.44, bridged: true, minutes: 3 },
  { key: "solana", label: "Modern wallet · Solana", balance: 5120, bridged: true, minutes: 1 },
  { key: "spot", label: "Spot account", balance: 24180.44, bridged: false, minutes: 0 },
]

type Step = "amount" | "review" | "progress"

function usd(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── The stage list — what the live flow hides ────────────────────────────── */

type Stage = { key: string; label: string; detail: string }

function stagesFor(kind: FlowKind, bridged: boolean): Stage[] {
  if (kind === "transfer" || !bridged) {
    return [
      { key: "submit", label: "Submitted", detail: "Instruction accepted" },
      { key: "settle", label: "Settled", detail: "Balance updated" },
    ]
  }
  return kind === "deposit"
    ? [
        { key: "submit", label: "Signed", detail: "Transaction broadcast" },
        { key: "confirm", label: "Confirming on Arbitrum", detail: "12 confirmations needed" },
        { key: "bridge", label: "Bridging", detail: "Crossing to the trading venue" },
        { key: "credit", label: "Credited", detail: "Ready to trade" },
      ]
    : [
        { key: "submit", label: "Requested", detail: "Withdrawal queued" },
        { key: "risk", label: "Risk check", detail: "Open positions and margin verified" },
        { key: "bridge", label: "Bridging", detail: "Returning to your wallet" },
        { key: "credit", label: "Arrived", detail: "Visible in your wallet" },
      ]
}

function Progress({
  kind,
  bridged,
  amount,
  onDone,
}: {
  kind: FlowKind
  bridged: boolean
  amount: number
  onDone: () => void
}) {
  const stages = React.useMemo(() => stagesFor(kind, bridged), [kind, bridged])
  const [active, setActive] = React.useState(0)

  // Walks the checklist so the state is DEMONSTRATED rather than described.
  // Real timings come from the chain; the preview steps on a timer.
  React.useEffect(() => {
    if (active >= stages.length) return
    const id = setTimeout(() => setActive((i) => i + 1), active === 0 ? 900 : 2200)
    return () => clearTimeout(id)
  }, [active, stages.length])

  const done = active >= stages.length

  // The close button's copy depends on whether anything is still running, and
  // that state lives here — so it has to travel back up.
  React.useEffect(() => {
    if (done) onDone()
  }, [done, onDone])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1.5 py-2 text-center">
        <span className="font-display text-[34px] font-light leading-none tabular-nums">
          {usd(amount)} <span className="text-[18px] text-muted-foreground">USDC</span>
        </span>
        <span className={cn("text-[13px] font-medium", done ? "text-credit" : "text-warning")}>
          {done
            ? kind === "withdraw"
              ? "Arrived in your wallet"
              : "Available to trade"
            : bridged
              ? "Usually takes a few minutes"
              : "Settling now"}
        </span>
      </div>

      <ol className="flex flex-col">
        {stages.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "waiting"
          const last = i === stages.length - 1
          return (
            <li key={s.key} className="flex gap-3">
              {/* Rail + dot. The active rail sweeps, the active dot breathes —
                  the app's own money-flow grammar. */}
              <span className="flex flex-col items-center">
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {state === "active" && (
                    <span className="ws-stage-halo absolute h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                  <span
                    className={cn(
                      "relative flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                      state === "done" && "bg-credit-chip text-credit",
                      state === "active" && "bg-primary text-primary-foreground",
                      state === "waiting" && "bg-foreground/[0.08] text-muted-foreground/50",
                    )}
                  >
                    {state === "done" ? (
                      <HugeiconsIcon icon={Tick02Icon} className="ws-icon-mono h-3 w-3" />
                    ) : (
                      <span className="text-[10px] font-bold tabular-nums">{i + 1}</span>
                    )}
                  </span>
                </span>
                {!last && (
                  <span
                    className={cn(
                      "w-[2px] flex-1 rounded-full",
                      state === "done"
                        ? "bg-credit/50"
                        : state === "active"
                          ? "ws-stage-rail-active"
                          : "bg-foreground/[0.08]",
                    )}
                    style={{ minHeight: 26 }}
                  />
                )}
              </span>
              <span className={cn("flex flex-col pb-4", state === "waiting" && "opacity-50")}>
                <span className="text-[13px] font-medium leading-tight">{s.label}</span>
                <span className="text-[11.5px] leading-tight text-muted-foreground">{s.detail}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {done && (
        <div className="flex items-start gap-2.5 rounded-xl bg-credit-chip p-3.5">
          <HugeiconsIcon icon={Tick02Icon} className="ws-icon-mono mt-px h-4 w-4 shrink-0 text-credit" />
          <span className="text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-credit">Done.</span> You can close this — the balance is
            already updated.
          </span>
        </div>
      )}
    </div>
  )
}

/* ── The modal ────────────────────────────────────────────────────────────── */

export function TransferModal({
  kind,
  open,
  onOpenChange,
}: {
  kind: FlowKind
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const copy = COPY[kind]
  const [step, setStep] = React.useState<Step>("amount")
  const [sourceKey, setSourceKey] = React.useState(SOURCES[0].key)
  const [amount, setAmount] = React.useState("")
  const [settled, setSettled] = React.useState(false)

  const source =
    kind === "withdraw"
      ? { key: "futures", label: "Futures account", balance: FUTURES_EQUITY.available, bridged: true, minutes: 3 }
      : (SOURCES.find((s) => s.key === sourceKey) ?? SOURCES[0])

  // A reopened modal should start at the beginning, not on someone else's
  // finished progress screen.
  React.useEffect(() => {
    if (open) {
      setStep("amount")
      setAmount("")
      setSettled(false)
    }
  }, [open, kind])

  const value = Number(amount) || 0
  const tooBig = value > source.balance
  const ready = value > 0 && !tooBig

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="gap-4 p-5 sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{copy.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{copy.description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {/* A three-dot spine, so "there are more steps after this" is visible
            from the first screen rather than a surprise. */}
        <span className="flex items-center gap-1.5" aria-hidden>
          {(["amount", "review", "progress"] as Step[]).map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                (["amount", "review", "progress"] as Step[]).indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-foreground/[0.1]",
              )}
            />
          ))}
        </span>

        {step === "amount" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] text-muted-foreground">$</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label="Amount"
                  className="w-40 bg-transparent text-center font-display text-[38px] font-light tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                USDC
              </span>
              <span className={cn("text-[12px] tabular-nums", tooBig ? "text-debit" : "text-muted-foreground")}>
                {tooBig ? "More than you have" : `${usd(source.balance)} available`}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(((source.balance * p) / 100).toFixed(2))}
                  className="h-8 rounded-full bg-foreground/[0.05] text-[12px] font-semibold text-muted-foreground ring-1 ring-transparent transition-colors hover:text-foreground hover:ring-primary/35"
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>

            {kind !== "withdraw" && (
              <div className="flex flex-col gap-1.5">
                <Eyebrow className="text-[11px]">From</Eyebrow>
                {/* A source PICKER. The live modal states one source as a fact
                    with no way to choose another. */}
                <div className="flex flex-col gap-1">
                  {SOURCES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSourceKey(s.key)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                        s.key === sourceKey
                          ? "bg-primary/[0.12] ring-1 ring-primary/40"
                          : "bg-foreground/[0.05] hover:bg-accent/60",
                      )}
                    >
                      <CoinAvatar symbol="USDC" size="md" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium">{s.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {s.bridged ? `Bridged · ~${s.minutes} min` : "Internal · instant"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] tabular-nums">{usd(s.balance)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!ready}
              onClick={() => setStep("review")}
              className={cn(
                "h-12 rounded-xl text-[14.5px] font-semibold transition-colors",
                ready
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-foreground/[0.05] text-muted-foreground",
              )}
            >
              {value > 0 ? "Review" : "Enter an amount"}
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 rounded-xl bg-foreground/[0.05] p-4">
              <Row label="Amount" value={`${usd(value)} USDC`} strong />
              <Row label="From" value={source.label} />
              <Row label="To" value={kind === "withdraw" ? "Modern wallet" : "Futures account"} />
              <span className="my-0.5 h-px bg-border/50" />
              <Row label="Network fee" value={source.bridged ? "$0.42" : "None"} muted />
              <Row
                label="Arrives"
                value={source.bridged ? `in ~${source.minutes} min` : "instantly"}
                muted
              />
              <Row label="You receive" value={`${usd(value)} USDC`} strong />
            </div>

            {source.bridged && (
              <div className="flex items-start gap-2.5 rounded-xl bg-warning-chip p-3.5">
                <HugeiconsIcon
                  icon={Shield01Icon}
                  className="ws-icon-mono mt-px h-4 w-4 shrink-0 text-warning"
                />
                <span className="text-[12px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-warning">This crosses a bridge.</span> You will be able
                  to watch each step on the next screen — no need to refresh or send again.
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="h-12 flex-1 rounded-xl bg-foreground/[0.05] text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("progress")}
                className="h-12 flex-[2] rounded-xl bg-primary text-[14.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {copy.cta} {usd(value)} USDC
              </button>
            </div>
          </div>
        )}

        {step === "progress" && (
          <>
            <Progress
              kind={kind}
              bridged={source.bridged}
              amount={value}
              onDone={() => setSettled(true)}
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "h-12 rounded-xl text-[14px] font-semibold transition-colors",
                settled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground",
              )}
            >
              {settled ? "Done" : "Close — this keeps running"}
            </button>
          </>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-[13.5px] font-semibold" : "font-medium",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </span>
  )
}
