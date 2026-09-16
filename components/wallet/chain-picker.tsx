"use client"

/**
 * The chain picker — the right half of the wallet hero.
 *
 * This replaces the card deck. The deck fanned the networks out as a stack of
 * coloured tiles, which looked good and answered almost nothing: you could not
 * read the balances behind the top card, and the one thing you came for — the
 * address — needed a press to reveal. Here the whole pane is the answer: a
 * master list of families on the left, the selected family's detail on the
 * right, address in full and in monospace.
 *
 * FAMILIES, not networks, because one 0x… address serves Ethereum, Arbitrum
 * and every other EVM chain. Listing them separately asks someone to copy the
 * same string three times and guess which copy was the right one.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"

export type ChainHolding = {
  key: string
  symbol: string
  logo?: string
  amount: string
  value: number | null
}

export type ChainGroup = {
  key: string
  /** "Ethereum", "Solana" … */
  name: string
  /** The networks this one address covers, e.g. "Ethereum · Arbitrum". */
  caption: string
  symbol: string
  icon?: string
  value: number | undefined
  address?: string
  holdings: ChainHolding[]
}

/** Keep both ends visible. An address truncated from one side only is an
 *  address you cannot verify, which defeats the point of showing it. */
function truncate(address: string, head = 14, tail = 10) {
  return address.length <= head + tail ? address : `${address.slice(0, head)}…${address.slice(-tail)}`
}

export function ChainPicker({
  groups,
  usd,
  mask,
  onReceive,
}: {
  groups: ChainGroup[]
  /** The page's own formatter, so the hero and this pane round alike. */
  usd: (value: number) => string
  mask: (s: string) => string
  /** Opens the receive modal already showing this family. */
  onReceive?: (key: string) => void
}) {
  const [key, setKey] = React.useState<string>("")
  const [copied, setCopied] = React.useState(false)
  // A selection can outlive the family that carried it — an account can leave
  // the wallet — so the first group is the fallback, never a blank pane.
  const chain = groups.find((c) => c.key === key) ?? groups[0]

  // Selecting a different chain must not leave a stale "Copied" tick sitting
  // under an address the user never copied.
  const select = (next: string) => {
    setKey(next)
    setCopied(false)
  }

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const copy = () => {
    if (!chain?.address) return
    navigator.clipboard?.writeText(chain.address).catch(() => {})
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  if (!chain) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[12.5px] text-muted-foreground">
        Your chains appear here once the wallet finishes setting up.
      </div>
    )
  }

  const funded = chain.holdings.filter((h) => h.value === null || h.value > 0)

  return (
    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      {/* ── Master: the families ─────────────────────────────────────────── */}
      <div
        role="listbox"
        aria-label="Select a chain"
        className="slim-scroll flex max-h-[19rem] min-w-0 flex-col overflow-y-auto border-b border-border/40 p-2 sm:border-b-0 sm:border-r"
      >
        {groups.map((c) => {
          const active = c.key === chain.key
          const count = c.holdings.filter((h) => h.value === null || h.value > 0).length
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
              <CoinAvatar symbol={c.symbol} src={c.icon} size="md" />
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
                  {count || "No"} asset{count === 1 ? "" : "s"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-[12.5px] font-semibold tabular-nums",
                  !c.value ? "text-muted-foreground/45" : "text-foreground",
                )}
              >
                {/* An unpriced family shows a dash, not $0.00 — "we could not
                    price this" and "this is empty" are different facts. */}
                {c.value === undefined ? "—" : mask(usd(c.value))}
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
            <span className="truncate font-display text-[22px] font-semibold leading-tight tracking-[-0.01em]">
              {chain.name}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="font-display text-[24px] font-light leading-none tabular-nums">
              {chain.value === undefined ? "—" : mask(usd(chain.value))}
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
            {onReceive && chain.address && (
              <button
                type="button"
                onClick={() => onReceive(chain.key)}
                className="text-[11.5px] font-semibold text-primary transition-opacity hover:opacity-80"
              >
                Show QR
              </button>
            )}
          </span>
          {chain.address ? (
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
          ) : (
            <span className="rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-[12.5px] text-muted-foreground">
              No address on this chain yet.
            </span>
          )}
          {/* The preview printed a confirmation count and a minimum here.
              Both were invented: nothing in this app knows either figure per
              network, so neither is claimed. */}
        </div>

        {/* What is actually sitting on it. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Eyebrow className="text-[11px]">Holdings</Eyebrow>
          {funded.length === 0 ? (
            <span className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
              Nothing here yet. Send to the address above to fund {chain.name}.
            </span>
          ) : (
            <div className="slim-scroll flex max-h-[10rem] flex-col divide-y divide-border/25 overflow-y-auto">
              {funded.map((h) => (
                <span key={h.key} className="flex items-center gap-2.5 py-1.5">
                  <CoinAvatar symbol={h.symbol} src={h.logo} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{h.symbol}</span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
                    {mask(h.amount)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
                    {h.value === null ? "—" : mask(usd(h.value))}
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
