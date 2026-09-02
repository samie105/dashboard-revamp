"use client"

/**
 * TokenIdentity — what you are actually buying.
 *
 * The registry is 9,000+ rows and a ticker is not an identity: "TRUMP" names
 * several unrelated tokens, the same symbol is listed once per chain, and
 * anybody can mint a contract called USDC. The one thing that says which token
 * this is, is its contract address — so the ticket shows it, in mono, with a
 * copy control and a link to the chain's own explorer.
 *
 * Every field here comes from the registry row. Where the row doesn't carry an
 * address, the panel says nothing rather than showing a placeholder: an
 * identity you can't verify is worse than an admission that we can't show one.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"

function shortAddress(address: string) {
  return address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address
}

export function TokenIdentity({
  symbol,
  icon,
  network,
  address,
  explorerUrl,
  explorerName,
  className,
}: {
  symbol: string
  icon?: string | null
  /** Human chain name — "Solana". */
  network: string | null
  /** The base token's contract on that chain, where the registry carries one. */
  address: string | null
  explorerUrl: string | null
  explorerName: string | null
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  if (!address) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      /* A clipboard the browser withheld is not an error worth a banner — the
         address is on screen and selectable either way. */
    }
  }

  return (
    <section
      aria-label={`About ${symbol}`}
      data-vivid-target="trade-token-identity"
      data-vivid-label="The token's contract address and explorer link"
      className={cn("flex flex-col gap-1", className)}
    >
      <h4 className="px-1 text-[12px] font-semibold text-muted-foreground">
        What you&apos;re buying
      </h4>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface-sunken/70 p-3">
        <div className="flex items-center gap-2.5">
          <CoinAvatar symbol={symbol} src={icon} size="md" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">{symbol}</span>
            {network && (
              <span className="truncate text-[11px] text-muted-foreground">on {network}</span>
            )}
          </span>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-vivid-target="trade-token-explorer"
              data-vivid-label={`Open this token on ${explorerName ?? "the chain explorer"}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {explorerName ?? "Explorer"}
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={copy}
          data-vivid-target="trade-token-copy-address"
          data-vivid-label="Copy this token's contract address"
          aria-label={`Copy the ${symbol} contract address`}
          className="group flex items-center justify-between gap-2 rounded-xl bg-background/50 px-2.5 py-2 text-left transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            {shortAddress(address)}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold transition-colors",
              copied ? "text-credit" : "text-subtle group-hover:text-foreground",
            )}
          >
            <HugeiconsIcon
              icon={copied ? Tick02Icon : Copy01Icon}
              className="h-3.5 w-3.5"
            />
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
    </section>
  )
}
