"use client"

/**
 * The swap card — landscape, with the quote beside the form.
 *
 * The live card is a tall single column: You pay, a chain selector, the flip
 * button, You get, another chain selector, then Max slippage. The quote —
 * rate, fee, route, impact — is below all of that, off the fold, so the
 * numbers you would decide on are never on screen at the same time as the
 * amount you are deciding about.
 *
 * Here the form takes the left and the QUOTE takes the right, and the quote
 * leads with the thing the live page never mentions at all: swap quotes
 * EXPIRE. A rate you were shown thirty seconds ago is not a rate you can
 * still take, and a card that does not say so is a card that sets up a
 * failure at signing time.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDataTransferVerticalIcon,
  ArrowDown01Icon,
  InformationCircleIcon,
  Search01Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { HERO_HUE } from "@/components/ui/surface"
import {
  QUOTE_TTL_SECONDS,
  SLIPPAGE_OPTIONS,
  TOKENS,
  formatAmount,
  formatRate,
  formatUSD,
  quoteFor,
  tokenByKey,
  tokenKey,
} from "@/components/swap-unauth/swap-data"

/* ── Token picker ─────────────────────────────────────────────────────────── */

function TokenPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (key: string) => void
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const token = tokenByKey(value)

  const rows = TOKENS.filter((t) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.chain.toLowerCase().includes(q)
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${label}: ${token.symbol} on ${token.chain}`}
        className="ws-icon-mono flex shrink-0 items-center gap-2 rounded-full bg-card/70 py-1.5 pl-1.5 pr-3 ring-1 ring-border/60 transition-colors hover:bg-accent/60"
      >
        <CoinAvatar symbol={token.symbol} size="md" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13.5px] font-semibold">{token.symbol}</span>
          {/* The chain belongs ON the token, not in a separate selector
              underneath it — they are one choice, not two. */}
          <span className="text-[10.5px] text-muted-foreground">{token.chain}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          {/* Click-away. A picker that only closes by re-pressing its trigger
              is a picker people leave open. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="ws-card-glass absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl bg-card/95 shadow-xl ring-1 ring-border/60">
            <label className="relative flex items-center border-b border-border/40 px-3 py-2">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute left-5 h-3.5 w-3.5 text-muted-foreground"
              />
              <span className="sr-only">Search tokens</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Token or chain"
                className="h-8 w-full min-w-0 rounded-full bg-foreground/[0.05] pl-7 pr-7 text-[13px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear"
                  className="ws-icon-mono absolute right-5 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <div className="slim-scroll max-h-64 overflow-y-auto">
              {rows.length === 0 ? (
                <span className="block px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                  No token matches.
                </span>
              ) : (
                rows.map((t) => {
                  const k = tokenKey(t)
                  const active = k === value
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        onChange(k)
                        setOpen(false)
                        setQuery("")
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/[0.12]" : "hover:bg-accent/50",
                      )}
                    >
                      <CoinAvatar symbol={t.symbol} size="md" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="text-[13px] font-semibold">{t.symbol}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {t.name} · {t.chain}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                        {formatAmount(t.balance, t.decimals)}
                      </span>
                      {active && (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          className="ws-icon-mono h-3.5 w-3.5 shrink-0 text-primary"
                        />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Quote expiry ─────────────────────────────────────────────────────────── */

/**
 * Counts a quote down and reports when it lapses. Starts on mount, never at
 * render, so the server and the client agree on the first paint.
 */
function useQuoteClock(resetKey: string, active: boolean) {
  const [left, setLeft] = React.useState(QUOTE_TTL_SECONDS)

  React.useEffect(() => {
    setLeft(QUOTE_TTL_SECONDS)
    // A quote for no amount is not a quote, so it does not age. Without this
    // the card sat at "expired" over an empty form, and the CTA wore the
    // amber refresh styling while reading "Enter an amount".
    if (!active) return
    const id = setInterval(() => setLeft((s) => (s <= 0 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [resetKey, active])

  const refresh = React.useCallback(() => setLeft(QUOTE_TTL_SECONDS), [])
  return { left, expired: active && left <= 0, refresh }
}

function Line({
  label,
  value,
  tone,
  hint,
  strong,
}: {
  label: string
  value: React.ReactNode
  tone?: "warning" | "muted" | "credit" | "debit"
  hint?: string
  strong?: boolean
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="ws-icon-mono h-3 w-3 text-muted-foreground/60"
          />
        )}
      </span>
      <span
        title={hint}
        className={cn(
          "tabular-nums",
          strong ? "text-[13.5px] font-semibold" : "font-medium",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
          tone === "credit" && "text-credit",
          tone === "debit" && "text-debit",
        )}
      >
        {value}
      </span>
    </span>
  )
}

/* ── The card ─────────────────────────────────────────────────────────────── */

export function SwapCard({
  fromKey,
  toKey,
  onFromKey,
  onToKey,
}: {
  // The pair is lifted: the rate chart above this card has to price the same
  // two tokens, and two components each owning their own idea of the pair is
  // how a page ends up quoting one thing and charting another.
  fromKey: string
  toKey: string
  onFromKey: (k: string) => void
  onToKey: (k: string) => void
}) {
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState(0.5)

  const from = tokenByKey(fromKey)
  const to = tokenByKey(toKey)
  const value = Number(amount) || 0
  const q = quoteFor({ from, to, fromAmount: value, slippagePct: slippage })

  // Any change to the terms is a new quote, so the clock restarts.
  const clock = useQuoteClock(`${fromKey}|${toKey}|${amount}|${slippage}`, value > 0)

  const flip = () => {
    onFromKey(toKey)
    onToKey(fromKey)
    setAmount("")
  }

  const tooBig = value > from.balance
  const ready = value > 0 && !tooBig && !clock.expired
  const crossChain = from.chain !== to.chain

  const cta = !value
    ? "Enter an amount"
    : tooBig
      ? `Not enough ${from.symbol}`
      : clock.expired
        ? "Quote expired — refresh"
        : `Swap ${from.symbol} for ${to.symbol}`

  return (
    <CardShell className={HERO_HUE}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ── Left: the form ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 p-5 lg:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex flex-col">
              <span className="font-display text-[17px] font-semibold leading-tight">Swap</span>
              <span className="text-[12px] text-muted-foreground">
                {crossChain ? `${from.chain} → ${to.chain}` : `On ${from.chain}`}
              </span>
            </span>
          </div>

          {/* You pay */}
          <div className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-4">
            <span className="flex items-baseline justify-between gap-2">
              <Eyebrow className="text-[11px]">You pay</Eyebrow>
              <span className={cn("text-[11.5px] tabular-nums", tooBig ? "text-debit" : "text-muted-foreground")}>
                Balance {formatAmount(from.balance, from.decimals)} {from.symbol}
              </span>
            </span>
            <div className="flex items-center gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Amount to swap"
                className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-light tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
              <TokenPicker value={fromKey} onChange={onFromKey} label="Pay with" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {formatUSD(value * from.price)}
              </span>
              <div className="flex gap-1">
                {[25, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount((from.balance * (p / 100)).toFixed(from.decimals))}
                    className="h-6 rounded-full bg-card/60 px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Flip. Overlapping the two panes so the direction reads as one
              control rather than a button floating in a gap. */}
          <div className="relative h-0">
            <button
              type="button"
              onClick={flip}
              aria-label="Swap direction"
              className="ws-icon-mono absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card ring-1 ring-border/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={ArrowDataTransferVerticalIcon} className="h-4 w-4" />
            </button>
          </div>

          {/* You get */}
          <div className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-4">
            <span className="flex items-baseline justify-between gap-2">
              <Eyebrow className="text-[11px]">You get</Eyebrow>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Balance {formatAmount(to.balance, to.decimals)} {to.symbol}
              </span>
            </span>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-display text-[28px] font-light tabular-nums",
                  value > 0 ? "text-foreground" : "text-muted-foreground/40",
                )}
              >
                {value > 0 ? formatAmount(q.toAmount, to.decimals) : "0.00"}
              </span>
              <TokenPicker value={toKey} onChange={onToKey} label="Receive" />
            </div>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {formatUSD(q.toAmount * to.price)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
              Max slippage
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="ws-icon-mono h-3 w-3 text-muted-foreground/60"
              />
            </span>
            <div className="flex gap-1">
              {SLIPPAGE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlippage(s)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors",
                    slippage === s
                      ? "bg-primary/[0.16] text-primary ring-1 ring-primary/45"
                      : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: the quote ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 border-t border-border/40 p-5 lg:border-l lg:border-t-0 lg:p-6">
          {/* Expiry. The live card never mentions that a quote has a life. */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl p-3",
              clock.expired ? "bg-debit-chip" : "bg-foreground/[0.05]",
            )}
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <svg viewBox="0 0 36 36" className="absolute h-9 w-9 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-foreground/[0.1]" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={cn(clock.expired ? "stroke-debit" : "stroke-primary")}
                  strokeDasharray={`${(clock.left / QUOTE_TTL_SECONDS) * 94.2} 94.2`}
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
              </svg>
              <span
                className={cn(
                  "text-[11.5px] font-bold tabular-nums",
                  clock.expired ? "text-debit" : "text-primary",
                )}
              >
                {clock.left}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12.5px] font-semibold">
                {clock.expired ? "Quote expired" : value > 0 ? "Quote expires" : "Indicative rate"}
              </span>
              <span className="text-[11.5px] leading-tight text-muted-foreground">
                {clock.expired
                  ? "Prices have moved on"
                  : value > 0
                    ? `Locked for ${clock.left}s at this rate`
                    : "Enter an amount to lock a quote"}
              </span>
            </span>
            <button
              type="button"
              onClick={clock.refresh}
              className="shrink-0 rounded-full bg-card/70 px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground ring-1 ring-border/60 transition-colors hover:text-foreground"
            >
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.05] p-3.5">
            <Eyebrow className="text-[11px]">Quote</Eyebrow>
            <Line
              label="Rate"
              value={`1 ${from.symbol} = ${formatRate(q.rate)} ${to.symbol}`}
              strong
            />
            <Line
              label="Minimum received"
              value={value > 0 ? `${formatAmount(q.minReceived, to.decimals)} ${to.symbol}` : "—"}
              hint={`After ${slippage}% slippage`}
            />
            <Line
              label="Price impact"
              value={value > 0 ? `${q.priceImpactPct.toFixed(2)}%` : "—"}
              tone={q.priceImpactPct > 1 ? "warning" : "muted"}
            />
            <Line
              label="Network fee"
              value={value > 0 ? formatUSD(q.networkFeeUsd) : "—"}
              tone="muted"
            />
            <Line
              label="Protocol fee"
              value={value > 0 ? formatUSD(q.protocolFeeUsd) : "—"}
              tone="muted"
            />
            <Line
              label="Arrives in"
              value={q.etaSeconds >= 60 ? `~${Math.round(q.etaSeconds / 60)} min` : `~${q.etaSeconds}s`}
              tone="muted"
            />
          </div>

          {/* The working, shown. The live page's own subtitle promises this
              and then shows nothing of it. */}
          <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.05] p-3.5">
            <Eyebrow className="text-[11px]">Route · {q.hops.length} step{q.hops.length > 1 ? "s" : ""}</Eyebrow>
            <ol className="flex flex-col gap-2">
              {q.hops.map((h, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold",
                      h.kind === "bridge"
                        ? "bg-warning-chip text-warning"
                        : "bg-primary/[0.15] text-primary",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[12.5px] font-medium">{h.venue}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{h.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            disabled={!ready && !clock.expired}
            onClick={() => clock.expired && clock.refresh()}
            className={cn(
              "mt-auto h-12 shrink-0 rounded-xl text-[14.5px] font-semibold transition-colors",
              clock.expired
                ? "bg-warning text-background hover:bg-warning/90"
                : ready
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-foreground/[0.05] text-muted-foreground",
            )}
          >
            {cta}
          </button>
        </div>
      </div>
    </CardShell>
  )
}
