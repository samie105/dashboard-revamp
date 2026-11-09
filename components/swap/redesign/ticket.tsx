"use client"

/**
 * The preview's swap form (components/swap-unauth/ticket.tsx) on the real
 * swap. Same anatomy: slippage menu and quote clock in the header, two amount
 * boxes joined by the flip button, the details, a button that names its
 * blocker, and a staged screen after.
 *
 * Every number and every action is useSwapTicket's — the same state, quote,
 * refresh clock, blocker ladder and submit the old ticket ran (moved verbatim
 * into components/swap/use-swap-ticket.ts). This file only draws it.
 *
 * Swapped for real data:
 *  · one dropdown picks chain and token together (the preview's token +
 *    chain badge), listing each routable chain's whitelisted tokens with the
 *    wallet's balance; pasting a contract address offers it as a custom
 *    token, as the old picker did;
 *  · rate, minimum received, price impact, fees and arrival come from the
 *    quote only, and read "—" until it lands;
 *  · the clock is the real 30s refresh, and pressing it re-quotes now;
 *  · the staged screen follows the swap through the ledger (signed → route →
 *    delivered) instead of a timer.
 * Not carried over: the $ / coin unit switch and the 25/50/75% chips (the
 * preview has neither; Max stays), and the Simple/Pro switch — the page is
 * the full view.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Alert02Icon, ArrowDown01Icon, ArrowUpDownIcon, RepeatIcon, Search01Icon, Settings02Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { qty, usd } from "@/lib/num"
import type { CoinData } from "@/lib/actions"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QuoteClock } from "@/components/ui/quote-clock"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/error-state"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { Figure, Icon, Panel } from "@/components/dashboard/redesign/ui"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { acceptAmountInput } from "@/lib/wallet-view"
import { balanceOf, durationLabel, optionKey, quoteFigures, tokenOptions, type RouteStep } from "@/lib/swap-redesign"
import { chainMeta, QUOTE_TTL_SECONDS, swapAssetForToken } from "@/components/swap/swap-model"
import { looksLikeTokenIdentifier, tokenIdentifier, type SwapTicketState } from "@/components/swap/use-swap-ticket"

/* ── Token picker ─────────────────────────────────────────────────────── */

function ChainBadge({ chain, className }: { chain: string; className?: string }) {
  return (
    <span className={cn("rounded-md border border-foreground/[0.08] bg-foreground/[0.04] px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground", className)}>
      {chain}
    </span>
  )
}

function TokenPicker({
  coin,
  chain,
  otherKey,
  options,
  balanceFor,
  onPick,
  label,
}: {
  coin: CoinData | null
  chain: string
  otherKey: string | null
  options: { key: string; chain: string; coin: CoinData }[]
  balanceFor: (chain: string, symbol: string) => number
  onPick: (chain: string, coin: CoinData) => void
  label: string
}) {
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
  const list = options.filter(
    (o) => !q || o.coin.symbol.toLowerCase().includes(q) || o.coin.name.toLowerCase().includes(q) || chainMeta(o.chain).label.toLowerCase().includes(q),
  )
  // A pasted contract address on this side's chain — the old picker's custom token.
  const custom = query.trim()
  const canUseCustom = looksLikeTokenIdentifier(chain, custom) && !options.some((o) => o.chain === chain && tokenIdentifier(chain, o.coin).toLowerCase() === custom.toLowerCase())
  const currentKey = coin ? optionKey(chain, coin.symbol) : null

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
          "flex h-12 items-center gap-2 rounded-full border bg-foreground/[0.04] pl-1.5 pr-3 transition-colors",
          open ? "border-primary/45" : "border-foreground/[0.09] hover:border-foreground/[0.16]",
        )}
      >
        {coin ? (
          <>
            <CoinAvatar symbol={coin.symbol} src={coin.image || undefined} size="lg" className="size-9 ring-1 ring-foreground/10" />
            <span className="flex flex-col items-start leading-tight">
              <span className="max-w-[96px] truncate text-[14.5px] font-semibold text-foreground">{coin.symbol}</span>
              <span className="text-[10.5px] font-medium text-muted-foreground">{chainMeta(chain).label}</span>
            </span>
          </>
        ) : (
          <span className="pl-2 text-[13px] text-muted-foreground">Choose</span>
        )}
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-30 mt-2 w-[min(300px,calc(100vw-48px))] origin-top-right rounded-2xl border border-foreground/[0.08] bg-popover/98 p-2 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            <label className="mb-1.5 flex h-10 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.03] px-3 focus-within:border-primary/40">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground" />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search token, network or address"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
            </label>
            <ul role="listbox" className="slim-scroll max-h-[280px] overflow-y-auto">
              {canUseCustom && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(chain, { id: custom, symbol: `${custom.slice(0, 6)}…${custom.slice(-4)}`, name: "Custom token", price: 0, change24h: 0, marketCap: 0, volume24h: 0, image: "", contractAddress: custom })
                      setOpen(false)
                    }}
                    className="mb-1 flex w-full flex-col rounded-xl border border-primary/30 bg-primary/[0.08] px-3 py-2.5 text-left"
                  >
                    <span className="text-[13px] font-semibold text-foreground">Use token address on {chainMeta(chain).label}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{custom}</span>
                  </button>
                </li>
              )}
              {list.length === 0 && !canUseCustom && <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No token matches “{query}”</li>}
              {list.map((o) => {
                const selected = o.key === currentKey
                const isOther = o.key === otherKey
                const held = balanceFor(o.chain, o.coin.symbol)
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onPick(o.chain, o.coin)
                        setOpen(false)
                      }}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]", selected && "bg-primary/[0.08]")}
                    >
                      <CoinAvatar symbol={o.coin.symbol} src={o.coin.image || undefined} size="lg" className="size-8 ring-1 ring-foreground/10" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                          {o.coin.symbol}
                          <ChainBadge chain={chainMeta(o.chain).label} />
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground">{isOther ? "On the other side — picking it flips" : o.coin.name}</span>
                      </span>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                        <Figure mask="••••">{held > 0 ? qty(held) : "—"}</Figure>
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

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3]

function SlippageMenu({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = React.useState(false)
  const [custom, setCustom] = React.useState(SLIPPAGE_OPTIONS.includes(value) ? "" : String(value))
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
          open ? "border-primary/45 text-foreground" : "border-foreground/[0.08] text-muted-foreground hover:text-foreground",
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
            className="absolute left-0 top-full z-30 mt-2 w-[260px] rounded-2xl border border-foreground/[0.08] bg-popover/98 p-4 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl"
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
                    value === s && !custom ? "border-primary/55 bg-primary/[0.1] text-primary" : "border-foreground/[0.07] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}%
                </button>
              ))}
            </div>
            <label className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-foreground/[0.07] px-3 focus-within:border-primary/40">
              <input
                inputMode="decimal"
                aria-label="Custom slippage tolerance, in percent"
                value={custom}
                onChange={(e) => {
                  const v = e.target.value
                  if (!/^[0-9]*\.?[0-9]*$/.test(v)) return
                  setCustom(v)
                  // The old field's rule: 0–50%, past that it isn't a guard.
                  const n = parseFloat(v)
                  if (Number.isFinite(n) && n >= 0 && n <= 50) onChange(n)
                }}
                placeholder="Custom"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] tabular-nums outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </label>
            {value > 5 && <p className="mt-2 text-[11.5px] font-medium text-warning">Above 5% you can be filled a long way from the price shown.</p>}
            {value >= 3 && value <= 5 && <p className="mt-2 text-[11.5px] font-medium text-warning">High slippage — you may get noticeably less than quoted.</p>}
            {value > 0 && value < 0.1 && <p className="mt-2 text-[11.5px] font-medium text-warning">Below 0.1% most swaps are cancelled before they fill.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Progress (after confirm) ─────────────────────────────────────────── */

export type PlacedSwap = {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  steps: RouteStep[]
  txHash?: string
}

function SwapProgress({ placed, onReset }: { placed: PlacedSwap; onReset: () => void }) {
  const { records } = useLedgerRecords(50)
  // The ledger row carrying this swap's hash, once the ledger lists it.
  const record = React.useMemo(
    () => (placed.txHash ? records.find((r) => r.txHash && r.txHash.toLowerCase() === placed.txHash!.toLowerCase()) : undefined),
    [records, placed.txHash],
  )
  const status = record?.status ?? "submitted"
  const done = status === "confirmed" || status === "completed"
  const failed = /fail|revert|cancel|expired/i.test(status)

  const steps = [
    "Signed on this device",
    ...placed.steps.map((s) => (s.kind === "bridge" ? `Bridge via ${s.venue}` : `Swap on ${s.venue}`)),
    `${placed.toSymbol} delivered`,
  ]
  // Signing is done the moment we're here; the route is the wait; delivery
  // is only ever marked when the ledger says the swap confirmed.
  const stateOf = (i: number) => (i === 0 || done ? "done" : failed ? "todo" : i === steps.length - 1 ? "todo" : "current")

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="relative flex size-16 items-center justify-center">
          {!done && !failed && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <span
            className={cn(
              "relative flex size-16 items-center justify-center rounded-full",
              done ? "bg-credit/[0.14] text-credit" : failed ? "bg-debit/[0.12] text-debit" : "bg-primary/[0.12] text-primary",
            )}
          >
            {done ? <Icon icon={Tick02Icon} className="size-8" strokeWidth={2.4} /> : failed ? <Icon icon={Alert02Icon} className="size-7" /> : <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          </span>
        </span>
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{done ? "Swap complete" : failed ? "Swap failed" : "Swapping…"}</span>
        <span className="flex items-center gap-2 text-[14px] font-semibold tabular-nums">
          <CoinAvatar symbol={placed.fromSymbol} size="md" />
          {qty(placed.fromAmount)} {placed.fromSymbol}
          <Icon icon={ArrowDown01Icon} className="size-4 -rotate-90 text-muted-foreground" />
          <CoinAvatar symbol={placed.toSymbol} size="md" />
          <span className="text-credit">
            ≈ {qty(placed.toAmount)} {placed.toSymbol}
          </span>
        </span>
        <span className="text-[13px] text-muted-foreground">
          {done
            ? "Your new balance will show in a moment."
            : failed
              ? "The ledger reports this swap didn't go through."
              : `Swap sent — it usually lands within a minute. Safe to leave this page.${placed.txHash ? ` Reference ${placed.txHash.slice(0, 10)}…${placed.txHash.slice(-6)}.` : ""}`}
        </span>
      </div>

      <ol className="flex flex-col rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
        {steps.map((s, i) => {
          const state = stateOf(i)
          return (
            <li key={`${s}-${i}`} className="relative flex items-center gap-3 py-2">
              {i < steps.length - 1 && (
                <span aria-hidden className={cn("absolute left-[11px] top-[30px] h-[calc(100%-14px)] w-px transition-colors duration-500", state === "done" ? "bg-credit/40" : "bg-foreground/[0.08]")} />
              )}
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                  state === "current" && "border-primary/50 bg-primary/[0.1]",
                  state === "todo" && "border-foreground/[0.1]",
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
        <Link href="/transactions" className="flex h-12 items-center justify-center rounded-xl border border-foreground/[0.08] text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          View history
        </Link>
        <button type="button" onClick={onReset} className="ds-gold h-12 rounded-xl text-[14px] font-semibold">
          New swap
        </button>
      </div>
    </motion.div>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

const amountClass =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-[34px]"

export function SwapTicket({ t, error, steps }: { t: SwapTicketState; error?: string; steps: RouteStep[] }) {
  const { balances } = useCryptoBalances()
  const [inverted, setInverted] = React.useState(false)
  const [spin, setSpin] = React.useState(0)
  const [placed, setPlaced] = React.useState<PlacedSwap | null>(null)
  const pending = React.useRef<Omit<PlacedSwap, "txHash"> | null>(null)

  const options = React.useMemo(() => tokenOptions(t.available), [t.available])
  const balanceFor = React.useCallback((chain: string, symbol: string) => balanceOf(balances, chain, symbol, (b, d) => formatCryptoAmount(b, d, 12)), [balances])

  const fromKey = t.fromCoin ? optionKey(t.fromChain, t.fromCoin.symbol) : null
  const toKey = t.toCoin ? optionKey(t.toChain, t.toCoin.symbol) : null
  const n = t.numericFrom
  const figures = quoteFigures(t.quoteData, n, t.estimatedTo)
  const impactHigh = figures.impact !== null && figures.impact >= 3
  const ready = t.buttonText === "Swap"
  const fromDecimals = t.fromCoin ? (swapAssetForToken(t.fromChain, t.fromCoin.symbol)?.decimals ?? 18) : 18

  // The submit landed: move to the staged screen with what was swapped.
  React.useEffect(() => {
    if (t.swapResult?.success && pending.current) {
      setPlaced({ ...pending.current, txHash: t.swapResult.txHash })
      pending.current = null
    }
  }, [t.swapResult])

  const pickFrom = (chain: string, coin: CoinData) => {
    if (optionKey(chain, coin.symbol) === toKey) return flip()
    t.setFromChain(chain)
    t.setFromCoin(coin)
  }
  const pickTo = (chain: string, coin: CoinData) => {
    if (optionKey(chain, coin.symbol) === fromKey) return flip()
    t.setToChain(chain)
    t.setToCoin(coin)
  }
  function flip() {
    setSpin((s) => s + 180)
    t.flipPair()
  }
  const swap = () => {
    if (t.fromCoin && t.toCoin) pending.current = { fromSymbol: t.fromCoin.symbol, toSymbol: t.toCoin.symbol, fromAmount: n, toAmount: t.estimatedTo, steps }
    void t.handleSwap()
  }

  const rateText =
    figures.rate === null || !t.fromCoin || !t.toCoin
      ? "—"
      : inverted
        ? `1 ${t.toCoin.symbol} = ${qty(1 / figures.rate)} ${t.fromCoin.symbol}`
        : `1 ${t.fromCoin.symbol} = ${qty(figures.rate)} ${t.toCoin.symbol}`
  const toBalance = t.toCoin ? balanceFor(t.toChain, t.toCoin.symbol) : 0
  const label = ready ? (impactHigh ? "Swap anyway" : `Swap ${t.fromCoin?.symbol} for ${t.toCoin?.symbol}`) : t.buttonText

  return (
    <Panel className="overflow-visible p-4 sm:p-6">
      {error && t.available.length === 0 ? (
        <ErrorState message={error} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {placed ? (
            <SwapProgress
              key="progress"
              placed={placed}
              onReset={() => {
                setPlaced(null)
                t.setSwapResult(null)
              }}
            />
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">Swap</span>
                  <SlippageMenu value={t.slippage} onChange={t.setSlippage} />
                </div>
                <button
                  type="button"
                  onClick={t.requestFreshQuote}
                  disabled={n <= 0}
                  title="Get a new price now"
                  className="flex items-center gap-2.5 rounded-xl px-1 disabled:cursor-default"
                >
                  <span className="hidden text-right text-[11.5px] leading-tight text-muted-foreground min-[420px]:block">
                    {n <= 0
                      ? "Enter an amount for a live quote"
                      : t.refreshingQuote
                        ? "Getting a new price…"
                        : t.secondsLeft === null
                          ? "Waiting for a price"
                          : `Quote refreshes in ${t.secondsLeft}s`}
                  </span>
                  <QuoteClock seconds={t.secondsLeft} total={QUOTE_TTL_SECONDS} refreshing={t.refreshingQuote} />
                </button>
              </div>

              <div className="relative flex flex-col gap-2">
                {/* From */}
                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5",
                    t.insufficientBalance ? "border-debit/40 bg-debit/[0.03]" : "border-foreground/[0.08] bg-foreground/[0.025] focus-within:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-muted-foreground">You pay</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Figure mask="••••">{`Balance ${qty(t.fromCoinBalance)}`}</Figure>
                      <button
                        type="button"
                        onClick={() => t.setPercentage(1)}
                        disabled={t.fromCoinBalance <= 0}
                        className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary hover:bg-primary/20 disabled:opacity-40"
                      >
                        Max
                      </button>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      inputMode="decimal"
                      aria-label="Amount to swap, in coins"
                      data-vivid-target="swap-amount"
                      data-vivid-label="The amount to swap from"
                      value={t.fromAmount}
                      onChange={(e) => {
                        const next = acceptAmountInput(e.target.value, fromDecimals)
                        if (next !== null) t.setFromAmount(next)
                      }}
                      placeholder="0"
                      className={amountClass}
                    />
                    <TokenPicker label="Token to pay" coin={t.fromCoin} chain={t.fromChain} otherKey={toKey} options={options} balanceFor={balanceFor} onPick={pickFrom} />
                  </div>
                  <div className="flex justify-between text-[12px] tabular-nums">
                    <span className={t.insufficientBalance ? "font-semibold text-debit" : "text-muted-foreground"}>
                      {t.insufficientBalance && t.fromCoin ? `Not enough ${t.fromCoin.symbol}` : t.usdValue > 0 ? `≈ ${usd(t.usdValue)}` : " "}
                    </span>
                  </div>
                </div>

                {/* Flip — the joint actually swaps the two sides. */}
                <button
                  type="button"
                  onClick={flip}
                  aria-label="Swap the two coins around"
                  title="Swap the two coins around"
                  className="absolute left-1/2 top-1/2 z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card bg-muted text-primary transition-colors hover:bg-accent"
                >
                  <motion.span animate={{ rotate: spin }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex">
                    <Icon icon={ArrowUpDownIcon} className="size-[18px]" strokeWidth={2} />
                  </motion.span>
                </button>

                {/* To */}
                <div className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.05] bg-foreground/[0.015] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-muted-foreground">You receive</span>
                    <span className="text-muted-foreground">
                      <Figure mask="••••">{`Balance ${qty(toBalance)}`}</Figure>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.loadingFirstQuote ? (
                      <Skeleton className="h-9 w-36 flex-1" />
                    ) : (
                      <span className={cn(amountClass, "truncate transition-opacity", t.estimatedTo <= 0 && "text-muted-foreground/30", t.refreshingQuote && "opacity-55")}>
                        {t.estimatedTo > 0 ? qty(t.estimatedTo) : "0"}
                      </span>
                    )}
                    <TokenPicker label="Token to receive" coin={t.toCoin} chain={t.toChain} otherKey={fromKey} options={options} balanceFor={balanceFor} onPick={pickTo} />
                  </div>
                  <div className="text-[12px] tabular-nums text-muted-foreground">
                    {t.estimatedTo > 0 && t.toPrice > 0 && !t.loadingFirstQuote ? `≈ ${usd(t.estimatedTo * t.toPrice)}` : " "}
                  </div>
                </div>
              </div>

              {/* Details — the quote's own figures, or "—" until it lands. */}
              <dl className="flex flex-col gap-2.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4 py-3.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={() => setInverted((v) => !v)}
                      disabled={figures.rate === null}
                      className="group inline-flex items-center gap-1.5 font-semibold tabular-nums text-foreground hover:text-primary disabled:hover:text-foreground"
                    >
                      <span className={cn("transition-colors", t.refreshingQuote && "text-primary")}>{rateText}</span>
                      {figures.rate !== null && <Icon icon={RepeatIcon} className="size-3.5 text-muted-foreground group-hover:text-primary" />}
                    </button>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Minimum received</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{figures.minReceived !== null && t.toCoin ? qty(figures.minReceived, t.toCoin.symbol) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Price impact</dt>
                  <dd className={cn("font-semibold tabular-nums", figures.impact === null ? "text-foreground" : figures.impact >= 3 ? "text-debit" : figures.impact >= 1 ? "text-warning" : "text-foreground")}>
                    {figures.impact === null ? "—" : `${figures.impact < 0.01 ? "<0.01" : figures.impact.toFixed(2)}%`}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Fees</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{figures.feesUsd === null ? "—" : usd(figures.feesUsd)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Arrives in</dt>
                  <dd className="font-semibold text-foreground">{figures.arrivesSeconds === null ? "—" : durationLabel(figures.arrivesSeconds)}</dd>
                </div>
              </dl>

              {impactHigh && ready && figures.impact !== null && (
                <p className="flex items-start gap-2.5 rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground/85">
                  <Icon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-debit" />
                  This trade moves the price {figures.impact.toFixed(2)}%. Splitting it into smaller swaps would get you a better rate.
                </p>
              )}

              {t.quoteError && !t.quoteLoading && n > 0 && <p className="text-[12.5px] text-warning">{t.quoteError}</p>}
              {t.swapResult && !t.swapResult.success && (
                <p className="rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground/85">{t.swapResult.error}</p>
              )}

              <button
                type="button"
                disabled={!t.canSwap}
                onClick={swap}
                data-vivid-target="swap-submit"
                data-vivid-guard=""
                aria-label="Execute swap"
                data-vivid-label="Execute the swap. Moves real money."
                className={cn(
                  "flex h-[52px] items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-colors",
                  !t.canSwap
                    ? "border border-foreground/[0.07] bg-foreground/[0.04] text-muted-foreground"
                    : impactHigh
                      ? "bg-debit text-white transition-[filter] hover:brightness-110"
                      : "ds-gold",
                )}
              >
                {(t.loadingFirstQuote || t.swapLoading) && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                {label}
              </button>
              <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">You sign on this device — your key never leaves it.</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <WalletUnlockDialog action="swap" open={t.unlockOpen} onOpenChange={t.setUnlockOpen} onUnlocked={t.resumeUnlocked} />
    </Panel>
  )
}
