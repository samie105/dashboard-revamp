"use client"

import * as React from "react"

import { InlineNotice } from "@/components/ui/flow"
import { describeCryptoError, type CryptoErrorAction } from "@/lib/crypto-backend"

/** Neutral wallet-mode chip. Deliberately NOT credit green — emerald is reserved
 *  for money direction (system.tsx house rule #1). */
export function ModeBadge({ mode }: { mode: "modern" | "legacy" }) {
  return (
    <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {mode === "modern" ? "Self-custody" : "Legacy"}
    </span>
  )
}

function truncateMiddle(value: string, keep = 6) {
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`
}

export function AddressPill({ address, className }: { address: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(address).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
      title={address}
      className={`ws-microswap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors ${copied ? "bg-credit-chip text-credit" : "bg-surface-sunken text-muted-foreground hover:bg-accent"} ${className ?? ""}`}
    >
      {truncateMiddle(address)}
      <span className="shrink-0 font-sans text-[10px] font-semibold">{copied ? "Copied" : "Copy"}</span>
    </button>
  )
}

/** Tone-tinted outcome line. Errors run through the spec §13 taxonomy so the
 *  message is actionable; success is a quiet credit-tinted sentence. */
export function SectionMessage({ error, success, onAction }: {
  error?: unknown
  success?: string | null
  onAction?: (action: CryptoErrorAction) => void
}) {
  if (error) {
    const described = describeCryptoError(error)
    return (
      <InlineNotice tone="error">
        <span className="font-semibold">{described.title}.</span> {described.message}
        {described.requestId ? <span className="ml-1 font-mono text-[10.5px] opacity-70">({described.requestId})</span> : null}
        {onAction && described.action !== "none" ? (
          <button type="button" onClick={() => onAction(described.action)} className="ml-2 font-semibold underline underline-offset-2">
            {described.action === "retry" ? "Try again"
              : described.action === "setup-wallet" ? "Set up wallet"
              : described.action === "unlock" ? "Unlock"
              : described.action === "new-intent" ? "Get a fresh quote"
              : described.action === "view-existing" ? "View status"
              : described.action === "pay-gas" ? "Pay the fee myself"
              : "Refresh session"}
          </button>
        ) : null}
      </InlineNotice>
    )
  }
  if (success) {
    return <p className="rounded-xl bg-credit-chip px-3.5 py-2.5 text-[13px] leading-relaxed text-credit">{success}</p>
  }
  return null
}

/** Secret display: blurred until deliberately revealed, auto re-blurs. */
export function KeyReveal({ label, value, network }: { label: string; value: string; network: string }) {
  const [revealed, setRevealed] = React.useState(false)
  React.useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), 45_000)
    return () => clearTimeout(timer)
  }, [revealed])
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken/70 p-3 ring-1 ring-border/25">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{network}</span>
      </div>
      <code
        aria-hidden={!revealed}
        className={`block max-h-32 select-all break-all rounded-lg bg-card/60 p-2 font-mono text-xs transition-[filter] ${revealed ? "" : "select-none blur-sm"}`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        className="self-start rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent"
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
    </div>
  )
}
