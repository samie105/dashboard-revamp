"use client"

/**
 * The swap form.
 *
 * Same anatomy as the buy / sell form so the two read as one product: two
 * stacked amount boxes joined by a control, then the details, then a button
 * that names its blocker. Here the joint is a FLIP button (it actually swaps
 * the two sides), and the details are the swap's own: rate (tap to invert),
 * minimum received after slippage, price impact, fees and ETA.
 *
 * State (tokens, amount, slippage) lives in the workspace, because the rate
 * chart and the route card beside this form read the same quote.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUpDownIcon,
  RepeatIcon,
  Search01Icon,
  Settings02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QuoteClock } from "@/components/ui/quote-clock"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import {
  QUOTE_TTL_SECONDS,
  SLIPPAGE_OPTIONS,
  TOKENS,
  formatAmount,
  formatRate,
  formatUSD,
  tokenKey,
  type Quote,
  type Token,
} from "@/components/swap-unauth/swap-data"
import { Figure, Icon, Panel } from "@/components/redesign/ui"

/* ── Token picker ─────────────────────────────────────────────────────── */

function ChainBadge({ chain, className }: { chain: string; className?: string }) {
  return (
    <span className={cn("rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground", className)}>
      {chain}
    </span>
  )
}

function TokenPicker({ value, other, onChange, label }: { value: Token; other: Token; onChange: (key: string) => void; label: string }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const wrap = React.useRef<HTMLDivElement>(null)
  const search = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    search.current?.focus()
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const list = TOKENS.filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.chain.toLowerCase().includes(q))

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          setQuery("")
        }}
        className={cn(
          "flex h-12 items-center gap-2 rounded-full border bg-white/[0.04] pl-1.5 pr-3 transition-colors",
          open ? "border-primary/45" : "border-white/[0.09] hover:border-white/[0.16]",
        )}
      >
        <CoinAvatar symbol={value.symbol} size="lg" className="size-9 ring-1 ring-white/10" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[14.5px] font-semibold text-foreground">{value.symbol}</span>
          <span className="text-[10.5px] font-medium text-muted-foreground">{value.chain}</span>
        </span>
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-30 mt-2 w-[min(300px,calc(100vw-48px))] origin-top-right rounded-2xl border border-white/[0.08] bg-[#141414]/98 p-2 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl"
          >
            <label className="mb-1.5 flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 focus-within:border-primary/40">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground" />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search token or network"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
            </label>
            <ul role="listbox" className="slim-scroll max-h-[280px] overflow-y-auto">
              {list.length === 0 && <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No token matches “{query}”</li>}
              {list.map((t) => {
                const key = tokenKey(t)
                const selected = key === tokenKey(value)
                const isOther = key === tokenKey(other)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(key)
                        setOpen(false)
                      }}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]", selected && "bg-primary/[0.08]")}
                    >
                      <CoinAvatar symbol={t.symbol} size="lg" className="size-8 ring-1 ring-white/10" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                          {t.symbol}
                          <ChainBadge chain={t.chain} />
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground">{isOther ? "On the other side — picking it flips" : t.name}</span>
                      </span>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                        <Figure mask="••••">{formatAmount(t.balance, t.decimals)}</Figure>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Slippage ─────────────────────────────────────────────────────────── */

function SlippageMenu({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = React.useState(false)
  const [custom, setCustom] = React.useState("")
  const wrap = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    return () => window.removeEventListener("pointerdown", onDown)
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Slippage ${value}%`}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12.5px] font-semibold tabular-nums transition-colors",
          open ? "border-primary/45 text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon icon={Settings02Icon} className={cn("size-4 transition-transform duration-500", open && "rotate-90")} />
        {value}%
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-30 mt-2 w-[260px] rounded-2xl border border-white/[0.08] bg-[#141414]/98 p-4 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl"
          >
            <span className="text-[13px] font-semibold text-foreground">Max slippage</span>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">If the price moves more than this before the swap lands, it cancels instead.</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {SLIPPAGE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s)
                    setCustom("")
                  }}
                  className={cn(
                    "h-8 rounded-lg border text-[12px] font-semibold tabular-nums transition-colors",
                    value === s && !custom ? "border-primary/55 bg-primary/[0.1] text-primary" : "border-white/[0.07] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}%
                </button>
              ))}
            </div>
            <label className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] px-3 focus-within:border-primary/40">
              <input
                inputMode="decimal"
                value={custom}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "")
                  setCustom(v)
                  const n = Number(v)
                  if (n > 0 && n <= 50) onChange(n)
                }}
                placeholder="Custom"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] tabular-nums outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </label>
            {value >= 3 && <p className="mt-2 text-[11.5px] font-medium text-warning">High slippage — you may get noticeably less than quoted.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Quote clock ──────────────────────────────────────────────────────── */

/** Restarts whenever the inputs that shape the quote change. */
function useQuoteClock(signature: string, live: boolean) {
  const [left, setLeft] = React.useState(QUOTE_TTL_SECONDS)
  const [refreshing, setRefreshing] = React.useState(false)
  React.useEffect(() => setLeft(QUOTE_TTL_SECONDS), [signature])
  React.useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1
        setRefreshing(true)
        window.setTimeout(() => setRefreshing(false), 600)
        return QUOTE_TTL_SECONDS
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [live])
  return { left: live ? left : null, refreshing }
}

/* ── Progress (after confirm) ─────────────────────────────────────────── */

function SwapProgress({ from, to, quote, onReset }: { from: Token; to: Token; quote: Quote; onReset: () => void }) {
  const steps = [
    `Approve ${from.symbol}`,
    ...quote.hops.map((h) => (h.kind === "bridge" ? `Bridge via ${h.venue}` : `Swap on ${h.venue}`)),
    `${to.symbol} delivered`,
  ]
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    if (step >= steps.length) return
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 1000)
    return () => window.clearTimeout(t)
  }, [step, steps.length])
  const done = step >= steps.length

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="relative flex size-16 items-center justify-center">
          {!done && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <span className={cn("relative flex size-16 items-center justify-center rounded-full", done ? "bg-credit/[0.14] text-credit" : "bg-primary/[0.12] text-primary")}>
            {done ? <Icon icon={Tick02Icon} className="size-8" strokeWidth={2.4} /> : <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          </span>
        </span>
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{done ? "Swap complete" : "Swapping…"}</span>
        <span className="flex items-center gap-2 text-[14px] font-semibold tabular-nums">
          <CoinAvatar symbol={from.symbol} size="md" />
          {formatAmount(quote.fromAmount, from.decimals)} {from.symbol}
          <Icon icon={ArrowDown01Icon} className="size-4 -rotate-90 text-muted-foreground" />
          <CoinAvatar symbol={to.symbol} size="md" />
          <span className="text-credit">
            {formatAmount(quote.toAmount, to.decimals)} {to.symbol}
          </span>
        </span>
        {done && <span className="text-[13px] text-muted-foreground">Demo only — nothing was sent.</span>}
      </div>

      <ol className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        {steps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo"
          return (
            <li key={s} className="relative flex items-center gap-3 py-2">
              {i < steps.length - 1 && <span aria-hidden className={cn("absolute left-[11px] top-[30px] h-[calc(100%-14px)] w-px transition-colors duration-500", state === "done" ? "bg-credit/40" : "bg-white/[0.08]")} />}
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                  state === "current" && "border-primary/50 bg-primary/[0.1]",
                  state === "todo" && "border-white/[0.1]",
                )}
              >
                {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              <span className={cn("text-[13.5px] font-medium", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={PREVIEW_ROUTES.transactions} className="flex h-12 items-center justify-center rounded-xl border border-white/[0.08] text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          View history
        </Link>
        <button type="button" onClick={onReset} disabled={!done} className="dash-gold-btn h-12 rounded-xl text-[14px] font-semibold disabled:opacity-40">
          New swap
        </button>
      </div>
    </motion.div>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

const amountClass =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-[34px]"

export function SwapTicket({
  from,
  to,
  amount,
  slippage,
  quote,
  onFrom,
  onTo,
  onFlip,
  onAmount,
  onSlippage,
}: {
  from: Token
  to: Token
  amount: string
  slippage: number
  quote: Quote
  onFrom: (key: string) => void
  onTo: (key: string) => void
  onFlip: () => void
  onAmount: (v: string) => void
  onSlippage: (v: number) => void
}) {
  const [inverted, setInverted] = React.useState(false)
  const [spin, setSpin] = React.useState(0)
  const [placed, setPlaced] = React.useState<null | { from: Token; to: Token; quote: Quote }>(null)
  const n = Number(amount) || 0
  const { left, refreshing } = useQuoteClock(`${tokenKey(from)}|${tokenKey(to)}|${amount}|${slippage}`, n > 0)

  const same = tokenKey(from) === tokenKey(to)
  const impactHigh = quote.priceImpactPct >= 3
  const blocker = same
    ? "Pick two different tokens"
    : n <= 0
      ? "Enter an amount"
      : n > from.balance
        ? `Not enough ${from.symbol}`
        : null

  const flip = () => {
    setSpin((s) => s + 180)
    onFlip()
  }

  const rateText = inverted
    ? `1 ${to.symbol} = ${formatRate(1 / (quote.rate || 1))} ${from.symbol}`
    : `1 ${from.symbol} = ${formatRate(quote.rate)} ${to.symbol}`

  return (
    // overflow-visible: the token pickers and the slippage menu drop out of
    // their rows and must not be clipped at the panel edge.
    <Panel className="overflow-visible p-4 sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {placed ? (
          <SwapProgress
            key="progress"
            from={placed.from}
            to={placed.to}
            quote={placed.quote}
            onReset={() => {
              setPlaced(null)
              onAmount("")
            }}
          />
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">Swap</span>
                <SlippageMenu value={slippage} onChange={onSlippage} />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="hidden text-right text-[11.5px] leading-tight text-muted-foreground min-[420px]:block">
                  {left === null ? "Enter an amount for a live quote" : `Quote refreshes in ${left}s`}
                </span>
                <QuoteClock seconds={left} total={QUOTE_TTL_SECONDS} refreshing={refreshing} />
              </div>
            </div>

            <div className="relative flex flex-col gap-2">
              {/* From */}
              <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5", blocker && n > 0 && !same ? "border-debit/40 bg-debit/[0.03]" : "border-white/[0.08] bg-white/[0.025] focus-within:border-primary/40")}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You pay</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Figure mask="••••">{`Balance ${formatAmount(from.balance, from.decimals)}`}</Figure>
                    <button type="button" onClick={() => onAmount(String(from.balance))} className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary hover:bg-primary/20">
                      Max
                    </button>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    aria-label="Amount to swap"
                    value={amount}
                    onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                    placeholder="0"
                    className={amountClass}
                  />
                  <TokenPicker label="Token to pay" value={from} other={to} onChange={onFrom} />
                </div>
                <div className="flex justify-between text-[12px] tabular-nums">
                  <span className={blocker && n > 0 && !same ? "font-semibold text-debit" : "text-muted-foreground"}>
                    {blocker && n > 0 && !same ? blocker : n > 0 ? `≈ ${formatUSD(n * from.price)}` : " "}
                  </span>
                </div>
              </div>

              {/* Flip — the joint actually swaps the two sides. */}
              <button
                type="button"
                onClick={flip}
                aria-label="Flip tokens"
                className="absolute left-1/2 top-1/2 z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0f0f0f] bg-[#1a1a1a] text-primary transition-colors hover:bg-[#222]"
              >
                <motion.span animate={{ rotate: spin }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex">
                  <Icon icon={ArrowUpDownIcon} className="size-[18px]" strokeWidth={2} />
                </motion.span>
              </button>

              {/* To */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You receive</span>
                  <span className="text-muted-foreground">
                    <Figure mask="••••">{`Balance ${formatAmount(to.balance, to.decimals)}`}</Figure>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(amountClass, "truncate", n === 0 && "text-muted-foreground/30")}>{n > 0 && !same ? formatAmount(quote.toAmount, to.decimals) : "0"}</span>
                  <TokenPicker label="Token to receive" value={to} other={from} onChange={onTo} />
                </div>
                <div className="text-[12px] tabular-nums text-muted-foreground">{n > 0 && !same ? `≈ ${formatUSD(quote.toAmount * to.price)}` : " "}</div>
              </div>
            </div>

            {/* Details */}
            <dl className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Rate</dt>
                <dd>
                  <button type="button" onClick={() => setInverted((v) => !v)} className="group inline-flex items-center gap-1.5 font-semibold tabular-nums text-foreground hover:text-primary">
                    <span className={cn("transition-colors", refreshing && "text-primary")}>{rateText}</span>
                    <Icon icon={RepeatIcon} className="size-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Minimum received</dt>
                <dd className="font-semibold tabular-nums text-foreground">{n > 0 && !same ? `${formatAmount(quote.minReceived, to.decimals)} ${to.symbol}` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Price impact</dt>
                <dd className={cn("font-semibold tabular-nums", !(n > 0 && !same) ? "text-foreground" : quote.priceImpactPct >= 3 ? "text-debit" : quote.priceImpactPct >= 1 ? "text-warning" : "text-credit")}>
                  {n > 0 && !same ? `${quote.priceImpactPct < 0.01 ? "<0.01" : quote.priceImpactPct.toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fees</dt>
                <dd className="font-semibold tabular-nums text-foreground">{n > 0 && !same ? formatUSD(quote.networkFeeUsd + quote.protocolFeeUsd) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Arrives in</dt>
                <dd className="font-semibold text-foreground">{quote.etaSeconds >= 60 ? `~${Math.round(quote.etaSeconds / 60)} min` : `~${quote.etaSeconds} sec`}</dd>
              </div>
            </dl>

            {impactHigh && n > 0 && !blocker && (
              <p className="flex items-start gap-2.5 rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground/85">
                <Icon icon={Alert02Icon} className="mt-0.5 size-4 text-debit" />
                This trade moves the price {quote.priceImpactPct.toFixed(2)}%. Splitting it into smaller swaps would get you a better rate.
              </p>
            )}

            <button
              type="button"
              disabled={!!blocker}
              onClick={() => setPlaced({ from, to, quote })}
              className={cn(
                "flex h-[52px] items-center justify-center rounded-2xl text-[15px] font-semibold transition-colors",
                // Blocked reads as neutral grey, not faded gold — a dimmed gold
                // button looks broken rather than "not yet".
                blocker
                  ? "pointer-events-none border border-white/[0.07] bg-white/[0.04] text-muted-foreground"
                  : impactHigh
                    ? "bg-debit text-white transition-[filter] hover:brightness-110"
                    : "dash-gold-btn",
              )}
            >
              {blocker ?? (impactHigh ? "Swap anyway" : `Swap ${from.symbol} for ${to.symbol}`)}
            </button>
            <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">Demo only — no swap is sent.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
