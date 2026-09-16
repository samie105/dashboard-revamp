"use client"

/**
 * The chain picker — the right half of the wallet hero.
 *
 * The live wallet fans the networks out as a stack of coloured tiles. The
 * stack looks good and answers almost nothing: you cannot read the balances
 * behind the top card, and the one thing you came for — the address — is not
 * on any of them.
 *
 * This keeps the idea (pick a chain, see that chain) and makes it work:
 * a master list on the left of the pane, the selected family's detail on the
 * right. Families, not chains, because ONE 0x… address serves Ethereum,
 * Arbitrum and Avalanche, and listing them separately asks the user to copy
 * the same string three times and guess which one was right.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CHAIN_GROUPS, formatAmount, formatUSD } from "@/components/wallet-unauth/wallet-data"

/** Keep both ends visible. An address truncated from one side only is an
 *  address you cannot verify, which defeats the point of showing it. */
function truncate(address: string, head = 14, tail = 10) {
  return address.length <= head + tail ? address : `${address.slice(0, head)}…${address.slice(-tail)}`
}

export function ChainPicker({
  mask,
  onReceive,
}: {
  mask: (s: string) => string
  /** Opens the receive modal already showing this chain. */
  onReceive?: (key: string) => void
}) {
  const [key, setKey] = React.useState(CHAIN_GROUPS[0].key)
  const [copied, setCopied] = React.useState(false)
  const chain = CHAIN_GROUPS.find((c) => c.key === key) ?? CHAIN_GROUPS[0]

  const copy = () => {
    navigator.clipboard?.writeText(chain.address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Selecting a different chain must not leave a stale "Copied" tick sitting
  // under an address the user never copied.
  const select = (next: string) => {
    setKey(next)
    setCopied(false)
  }

  return (
    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      {/* ── Master: the families, ranked by value ────────────────────────── */}
      <div
        role="listbox"
        aria-label="Select a chain"
        className="slim-scroll flex max-h-[19rem] min-w-0 flex-col overflow-y-auto border-b border-border/40 p-2 sm:border-b-0 sm:border-r"
      >
        {CHAIN_GROUPS.map((c) => {
          const active = c.key === chain.key
          return (
            <button
              key={c.key}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => select(c.key)}
              className={cn(
                "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                active
                  // Same grammar as the nav rail's current row: gold fading out
                  // to the right, with a marker at the edge.
                  ? "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_16%,transparent)_0%,color-mix(in_oklab,var(--primary)_5%,transparent)_55%,transparent_85%)]"
                  : "hover:bg-foreground/[0.04]",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                />
              )}
              <CoinAvatar symbol={c.symbol} size="md" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    "truncate text-[13px] leading-tight",
                    active ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                  )}
                >
                  {c.name}
                </span>
                <span className="truncate text-[11px] leading-tight text-muted-foreground">
                  {c.assets.filter((a) => a.total > 0).length || "No"} asset
                  {c.assets.filter((a) => a.total > 0).length === 1 ? "" : "s"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-[12.5px] font-semibold tabular-nums",
                  c.value === 0 ? "text-muted-foreground/45" : "text-foreground",
                )}
              >
                {mask(formatUSD(c.value, { compact: true }))}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Detail: the selected family ──────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <Eyebrow className="text-[11px]">{chain.caption}</Eyebrow>
            <span className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em]">
              {chain.name}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="font-display text-[24px] font-light leading-none tabular-nums">
              {mask(formatUSD(chain.value, { maxFrac: 0 }))}
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
              On this chain
            </span>
          </span>
        </div>

        {/* The address. It is the reason this pane exists, so it gets the
            full string, monospace, and one obvious control. */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <Eyebrow className="text-[11px]">Deposit address</Eyebrow>
            {onReceive && (
              <button
                type="button"
                onClick={() => onReceive(chain.key)}
                className="text-[11.5px] font-semibold text-primary transition-opacity hover:opacity-80"
              >
                Show QR
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={copy}
            title={copied ? "Copied" : `Copy ${chain.address}`}
            className={cn(
              "ws-icon-mono group flex items-center gap-2.5 rounded-xl bg-foreground/[0.05] px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
              copied && "ring-1 ring-credit/40",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground/85">
              {truncate(chain.address)}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold",
                copied ? "text-credit" : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
          <span className="text-[11.5px] text-muted-foreground">
            {chain.confirmations} confirmation{chain.confirmations > 1 ? "s" : ""} to credit · minimum{" "}
            {chain.minimum}
          </span>
        </div>

        {/* What is actually sitting on it. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Eyebrow className="text-[11px]">Holdings</Eyebrow>
          {chain.assets.filter((a) => a.total > 0).length === 0 ? (
            <span className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
              Nothing here yet. Send to the address above to fund {chain.name}.
            </span>
          ) : (
            <div className="flex flex-col divide-y divide-border/25">
              {chain.assets
                .filter((a) => a.total > 0)
                .map((a) => (
                  <span key={a.symbol} className="flex items-center gap-2.5 py-1.5">
                    <CoinAvatar symbol={a.symbol} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{a.symbol}</span>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
                      {mask(formatAmount(a.total))}
                    </span>
                    <span className="w-20 shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
                      {mask(formatUSD(a.value, { maxFrac: 0 }))}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
