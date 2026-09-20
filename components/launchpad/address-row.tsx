"use client"

/**
 * An on-chain address, at a size you can actually read and check.
 *
 * People compare these character by character before sending money, so the
 * address is shown in full where there is room, in monospace, with copy and
 * explorer beside it — not squeezed into a 12px pill.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export function explorerUrl(address: string, networkId: string) {
  const cluster = networkId === "solana-devnet" ? "?cluster=devnet" : ""
  return `https://solscan.io/account/${address}${cluster}`
}

export function AddressRow({
  label,
  value,
  networkId,
  hint,
}: {
  label: string
  value: string
  networkId: string
  hint?: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* a blocked clipboard costs the shortcut, not the address: it is on screen */
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-foreground/[0.04] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[11px] text-muted-foreground/80">{hint}</span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed break-all select-all">
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
            copied
              ? "bg-credit/15 text-credit"
              : "bg-foreground/[0.07] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={explorerUrl(value, networkId)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full bg-foreground/[0.07] px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          Solscan
        </a>
      </div>
    </div>
  )
}
