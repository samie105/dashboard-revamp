"use client"

/**
 * The buy / sell order form.
 *
 * One component, two pages: /buy-unauth and /sell-unauth render it with a
 * different `mode`, and the Buy | Sell switch at the top is a pair of links
 * between them. Everything the live flow does is here — amount, network,
 * method, a breakdown with the fee in money rather than a bare percent, a CTA
 * that names its blocker, and a staged order screen — but nothing is charged.
 *
 * The maths, so it can be checked:
 *   buy   usd = paid ÷ fiat rate · fee = usd × method % · coins = (usd − fee) ÷ price
 *   sell  usd = coins × price    · fee = usd × method % · payout = (usd − fee) × fiat rate
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDown01Icon,
  ArrowDownDoubleIcon,
  BankIcon,
  CreditCardIcon,
  Tick02Icon,
  UserSwitchIcon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QuoteClock } from "@/components/ui/quote-clock"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import {
  ASSETS,
  BUY_METHODS,
  FIATS,
  LIMITS,
  QUOTE_TTL,
  SELL_METHODS,
  STAGES,
  formatCoin,
  formatFiat,
  formatPrice,
  type Fiat,
  type Method,
  type Mode,
  type TradeAsset,
} from "@/components/buy-sell-unauth/trade-data"
import { Figure, Icon, Panel, SLIDE, type IconSvg } from "@/components/redesign/ui"

const METHOD_ICON: Record<string, IconSvg> = {
  dollar: Wallet02Icon,
  card: CreditCardIcon,
  bank: BankIcon,
  p2p: UserSwitchIcon,
}

/* ── Picker (asset or currency) ───────────────────────────────────────── */

type PickerItem = { key: string; label: string; sub: string; art: React.ReactNode }

function Picker({ items, value, onChange, label }: { items: PickerItem[]; value: string; onChange: (key: string) => void; label: string }) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)
  const current = items.find((i) => i.key === value) ?? items[0]

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border bg-white/[0.04] pl-1.5 pr-3 transition-colors",
          open ? "border-primary/45" : "border-white/[0.09] hover:border-white/[0.16]",
        )}
      >
        {current.art}
        <span className="text-[14.5px] font-semibold text-foreground">{current.label}</span>
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-30 mt-2 w-[248px] origin-top-right rounded-2xl border border-white/[0.08] bg-[#141414]/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl"
          >
            {items.map((i) => (
              <li key={i.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i.key === value}
                  onClick={() => {
                    onChange(i.key)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]",
                    i.key === value && "bg-primary/[0.08]",
                  )}
                >
                  {i.art}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold text-foreground">{i.label}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{i.sub}</span>
                  </span>
                  {i.key === value && <Icon icon={Tick02Icon} className="size-4 text-primary" strokeWidth={2.2} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

const assetItems: PickerItem[] = ASSETS.map((a) => ({
  key: a.symbol,
  label: a.symbol,
  sub: a.name,
  art: <CoinAvatar symbol={a.symbol} size="lg" className="size-8 ring-1 ring-white/10" />,
}))

const fiatItems: PickerItem[] = FIATS.map((f) => ({
  key: f.code,
  label: f.code,
  sub: f.name,
  // The currency sign, not a flag emoji: Windows renders flag emoji as two
  // bare letters ("US"), which reads as a broken icon.
  art: (
    <span className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.1] font-display text-[15px] font-semibold leading-none text-primary">
      {f.symbol}
    </span>
  ),
}))

/* ── Quote clock — a price that visibly holds, then refreshes ─────────── */

function useQuote() {
  const [left, setLeft] = React.useState(QUOTE_TTL)
  const [refreshing, setRefreshing] = React.useState(false)
  React.useEffect(() => {
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1
        setRefreshing(true)
        window.setTimeout(() => setRefreshing(false), 600)
        return QUOTE_TTL
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [])
  return { left, refreshing }
}

/* ── Amount box ───────────────────────────────────────────────────────── */

function AmountBox({
  label,
  aside,
  children,
  footer,
  tone = "default",
}: {
  label: string
  aside?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  tone?: "default" | "error" | "muted"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5",
        tone === "error" ? "border-debit/40 bg-debit/[0.03]" : tone === "muted" ? "border-white/[0.05] bg-white/[0.015]" : "border-white/[0.08] bg-white/[0.025] focus-within:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {aside && <span className="text-[12.5px] text-muted-foreground">{aside}</span>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
      {footer}
    </div>
  )
}

const amountInput =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-[34px]"

function clean(v: string) {
  return v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
}

/* ── Order screen (after confirm) ─────────────────────────────────────── */

function OrderProgress({ mode, summary, onReset }: { mode: Mode; summary: { got: string; paid: string; method: string }; onReset: () => void }) {
  const stages = STAGES[mode]
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    if (step >= stages.length) return
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 1100)
    return () => window.clearTimeout(t)
  }, [step, stages.length])
  const done = step >= stages.length

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="relative flex size-16 items-center justify-center">
          {!done && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <motion.span
            animate={{ scale: done ? 1 : 0.92 }}
            className={cn("relative flex size-16 items-center justify-center rounded-full", done ? "bg-credit/[0.14] text-credit" : "bg-primary/[0.12] text-primary")}
          >
            {done ? <Icon icon={Tick02Icon} className="size-8" strokeWidth={2.4} /> : <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          </motion.span>
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">
            {done ? (mode === "buy" ? "Purchase complete" : "Sale complete") : mode === "buy" ? "Processing your purchase" : "Processing your sale"}
          </span>
          <span className="text-[13.5px] text-muted-foreground">
            {done ? `${summary.got} is on its way. Demo only — nothing was charged.` : "This usually takes under a minute."}
          </span>
        </div>
      </div>

      <ol className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        {stages.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo"
          return (
            <li key={s} className="relative flex items-center gap-3 py-2">
              {i < stages.length - 1 && <span aria-hidden className={cn("absolute left-[11px] top-[30px] h-[calc(100%-14px)] w-px transition-colors duration-500", state === "done" ? "bg-credit/40" : "bg-white/[0.08]")} />}
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
              <span className={cn("text-[13.5px] font-medium transition-colors", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
            </li>
          )
        })}
      </ol>

      <dl className="flex flex-col gap-2 text-[13px]">
        {[
          [mode === "buy" ? "You paid" : "You sold", summary.paid],
          [mode === "buy" ? "You receive" : "You get", summary.got],
          [mode === "buy" ? "Paid with" : "Paid to", summary.method],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={PREVIEW_ROUTES.transactions} className="flex h-12 items-center justify-center rounded-xl border border-white/[0.08] text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          View history
        </Link>
        <button type="button" onClick={onReset} disabled={!done} className="dash-gold-btn h-12 rounded-xl text-[14px] font-semibold disabled:opacity-40">
          {mode === "buy" ? "Buy more" : "Sell more"}
        </button>
      </div>
    </motion.div>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

export function Ticket({
  mode,
  asset: assetKey,
  onAssetChange,
  initialMethod,
}: {
  mode: Mode
  asset: string
  onAssetChange: (symbol: string) => void
  initialMethod?: string
}) {
  const buying = mode === "buy"
  const methods = buying ? BUY_METHODS : SELL_METHODS
  const asset: TradeAsset = ASSETS.find((a) => a.symbol === assetKey) ?? ASSETS[0]
  const startMethod = methods.find((m) => m.key === initialMethod && !m.soon) ?? methods[0]

  const [fiatCode, setFiatCode] = React.useState<Fiat["code"]>(startMethod.fiats[0])
  const [methodKey, setMethodKey] = React.useState(startMethod.key)
  const [network, setNetwork] = React.useState(asset.networks[0])
  const [amount, setAmount] = React.useState(buying ? "100" : "")
  const [placed, setPlaced] = React.useState<null | { got: string; paid: string; method: string }>(null)
  const { left, refreshing } = useQuote()

  const fiat = FIATS.find((f) => f.code === fiatCode)!
  const method: Method = methods.find((m) => m.key === methodKey)!

  // A new coin resets the network to one it can actually go out on.
  React.useEffect(() => setNetwork(asset.networks[0]), [asset])

  // Switching currency keeps the method if it supports it, else picks the
  // first one that does — a NGN order can't be paid from a dollar balance.
  const pickFiat = (code: string) => {
    const next = code as Fiat["code"]
    setFiatCode(next)
    if (!method.fiats.includes(next)) setMethodKey(methods.find((m) => !m.soon && m.fiats.includes(next))!.key)
    // Carry the order's value across, rather than reading "100" as ₦100.
    const n = Number(amount)
    if (buying && n > 0) {
      const usd = n / fiat.perUsd
      const nextFiat = FIATS.find((f) => f.code === next)!
      setAmount(String(Math.round(usd * nextFiat.perUsd)))
    }
  }
  const pickMethod = (m: Method) => {
    if (m.soon) return
    setMethodKey(m.key)
    if (!m.fiats.includes(fiatCode)) pickFiat(m.fiats[0])
  }

  /* — the maths — */
  const n = Number(amount) || 0
  const usd = buying ? n / fiat.perUsd : n * asset.price
  const fee = usd * (method.feePct / 100)
  const coins = buying ? Math.max(0, (usd - fee) / asset.price) : n
  const payout = buying ? 0 : Math.max(0, (usd - fee) * fiat.perUsd)
  const dailyLeft = LIMITS.dailyUsd - LIMITS.usedTodayUsd
  // "Max" is the most you can actually sell right now — your balance, capped
  // by today's remaining limit. Max = everything you hold would hand you a
  // greyed-out button the moment you tapped it.
  const sellable = Math.min(asset.held, Math.min(LIMITS.maxUsd, dailyLeft) / asset.price)

  const blocker =
    n <= 0
      ? "Enter an amount"
      : usd < LIMITS.minUsd
        ? `Minimum is ${formatFiat(LIMITS.minUsd * fiat.perUsd, fiat, 0)}`
        : !buying && n > asset.held
          ? `You have ${formatCoin(asset.held, asset.symbol)}`
          : usd > Math.min(LIMITS.maxUsd, dailyLeft)
            ? `Daily limit left: ${formatFiat(dailyLeft * fiat.perUsd, fiat, 0)}`
            : null

  const quick = buying
    ? [50, 100, 250, 500].map((v) => ({ label: formatFiat(v * fiat.perUsd, fiat, 0), value: String(Math.round(v * fiat.perUsd)) }))
    : [25, 50, 75, 100].map((p) => ({ label: p === 100 ? "Max" : `${p}%`, value: String(Number(((sellable * p) / 100).toFixed(6))) }))

  const place = () =>
    setPlaced(
      buying
        ? { got: formatCoin(coins, asset.symbol), paid: formatFiat(n, fiat), method: method.label }
        : { got: formatFiat(payout, fiat), paid: formatCoin(n, asset.symbol), method: method.label },
    )

  return (
    // overflow-visible: the coin and currency pickers drop out of their rows
    // and must not be clipped at the panel edge.
    <Panel className="overflow-visible p-4 sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {placed ? (
          <OrderProgress
            key="progress"
            mode={mode}
            summary={placed}
            onReset={() => {
              setPlaced(null)
              setAmount(buying ? "100" : "")
            }}
          />
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            {/* Buy | Sell — links between the two pages. */}
            <div className="flex items-center justify-between gap-3">
              <div role="tablist" className="grid w-[220px] grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1">
                {(["buy", "sell"] as const).map((m) => (
                  <Link
                    key={m}
                    role="tab"
                    aria-selected={m === mode}
                    href={`${m === "buy" ? PREVIEW_ROUTES.buy : PREVIEW_ROUTES.sell}?asset=${asset.symbol}`}
                    scroll={false}
                    className={cn(
                      "relative flex h-10 items-center justify-center rounded-xl text-[14px] font-semibold capitalize transition-colors",
                      m === mode ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === mode && <span className="dash-gold-btn absolute inset-0 rounded-xl" />}
                    <span className="relative">{m}</span>
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="hidden text-right leading-tight min-[420px]:block">
                  <span className={cn("block text-[12.5px] font-semibold tabular-nums transition-colors", refreshing ? "text-primary" : "text-foreground")}>
                    1 {asset.symbol} = {formatFiat(asset.price * fiat.perUsd, fiat, asset.price * fiat.perUsd >= 100 ? 2 : 4)}
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">Price holds {left}s</span>
                </span>
                <QuoteClock seconds={left} total={QUOTE_TTL} refreshing={refreshing} />
              </div>
            </div>

            {/* Pay side */}
            <div className="relative flex flex-col gap-2">
              <AmountBox
                label={buying ? "You pay" : "You sell"}
                aside={!buying && <Figure mask="••••">{`Balance ${formatCoin(asset.held, asset.symbol)}`}</Figure>}
                tone={blocker && n > 0 ? "error" : "default"}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1.5">
                      {quick.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => setAmount(q.value)}
                          className={cn(
                            "h-7 rounded-lg border px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors",
                            amount === q.value ? "border-primary/50 bg-primary/[0.1] text-primary" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.15] hover:text-foreground",
                          )}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                    <span className={cn("text-[12px] tabular-nums", blocker && n > 0 ? "font-semibold text-debit" : "text-muted-foreground")}>
                      {blocker && n > 0 ? blocker : !buying && n > 0 ? `≈ ${formatFiat(usd * fiat.perUsd, fiat)}` : " "}
                    </span>
                  </div>
                }
              >
                <input inputMode="decimal" aria-label={buying ? "Amount to pay" : "Amount to sell"} value={amount} onChange={(e) => setAmount(clean(e.target.value))} placeholder="0" className={amountInput} />
                {buying ? (
                  <Picker label="Currency" items={fiatItems} value={fiatCode} onChange={pickFiat} />
                ) : (
                  <Picker label="Coin" items={assetItems} value={asset.symbol} onChange={(s) => { onAssetChange(s); setAmount("") }} />
                )}
              </AmountBox>

              {/* The joint between the two boxes. */}
              <span className="absolute left-1/2 top-[calc(50%-4px)] z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-[#0f0f0f] bg-[#1a1a1a] text-primary">
                <Icon icon={ArrowDownDoubleIcon} className="size-4" strokeWidth={2} />
              </span>

              {/* Receive side */}
              <AmountBox label={buying ? "You receive" : "You get"} tone="muted" aside={buying ? "Estimated" : "After fees"}>
                <span className={cn(amountInput, "truncate", (buying ? coins : payout) === 0 && "text-muted-foreground/30")}>
                  {buying
                    ? coins > 0
                      ? coins.toLocaleString("en-US", { maximumFractionDigits: asset.price > 100 ? 6 : 2 })
                      : "0"
                    : payout > 0
                      ? payout.toLocaleString("en-US", { maximumFractionDigits: 2 })
                      : "0"}
                </span>
                {buying ? (
                  <Picker label="Coin" items={assetItems} value={asset.symbol} onChange={onAssetChange} />
                ) : (
                  <Picker label="Currency" items={fiatItems} value={fiatCode} onChange={pickFiat} />
                )}
              </AmountBox>
            </div>

            {/* Network — only when there's a choice to make. */}
            {asset.networks.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">{buying ? "Deliver on" : "Send from"}</span>
                <div className="flex gap-2">
                  {asset.networks.map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setNetwork(net)}
                      aria-pressed={net === network}
                      className={cn(
                        "relative flex h-10 flex-1 items-center justify-center rounded-xl border text-[13px] font-semibold transition-colors",
                        net === network ? "border-primary/55 text-foreground" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground",
                      )}
                    >
                      {net === network && <motion.span layoutId={`net-${mode}`} transition={SLIDE} className="absolute inset-0 rounded-xl bg-primary/[0.08]" />}
                      <span className="relative">{net}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Method */}
            <div className="flex flex-col gap-2">
              <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">{buying ? "Pay with" : "Get paid to"}</span>
              <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {methods.map((m) => {
                  const on = m.key === methodKey
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-disabled={m.soon || undefined}
                      onClick={() => pickMethod(m)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        m.soon ? "cursor-not-allowed border-white/[0.05] opacity-45" : on ? "border-primary/55" : "border-white/[0.07] hover:border-white/[0.14]",
                      )}
                    >
                      {on && <motion.span layoutId={`method-${mode}`} transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.06]" />}
                      <span className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-xl border", on ? "border-primary/40 bg-primary/[0.12] text-primary" : "border-white/[0.07] bg-white/[0.03] text-foreground/80")}>
                        <Icon icon={METHOD_ICON[m.key] ?? Wallet02Icon} className="size-[18px]" />
                      </span>
                      <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                          <span className="truncate">{m.label}</span>
                          {m.soon && <span className="rounded bg-white/[0.08] px-1 text-[9.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Soon</span>}
                        </span>
                        <span className="truncate text-[12px] text-muted-foreground">{m.detail}</span>
                      </span>
                      <span className="relative flex flex-col items-end leading-tight">
                        <span className={cn("text-[12px] font-semibold", m.feePct === 0 ? "text-credit" : "text-foreground/80")}>{m.feePct === 0 ? "No fee" : `${m.feePct}%`}</span>
                        <span className="text-[11px] text-muted-foreground">{m.eta}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Breakdown */}
            <dl className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-semibold tabular-nums text-foreground">1 {asset.symbol} = ${formatPrice(asset.price)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fee{method.feePct > 0 && ` (${method.feePct}%)`}</dt>
                <dd className={cn("font-semibold tabular-nums", fee === 0 ? "text-credit" : "text-foreground")}>{fee === 0 ? "Free" : formatFiat(fee * fiat.perUsd, fiat)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Network</dt>
                <dd className="font-semibold text-foreground">{network} · fee covered</dd>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-white/[0.06] pt-3">
                <dt className="font-semibold text-foreground">{buying ? "Total charged" : "You receive"}</dt>
                <dd className="font-display text-[15px] font-semibold tabular-nums text-foreground">
                  {buying ? formatFiat(n, fiat) : formatFiat(payout, fiat)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={!!blocker}
              onClick={place}
              className={cn(
                "flex h-[52px] items-center justify-center rounded-2xl text-[15px] font-semibold transition-colors",
                // Blocked reads as neutral grey, not faded gold.
                blocker ? "border border-white/[0.07] bg-white/[0.04] text-muted-foreground" : "dash-gold-btn",
              )}
            >
              {blocker ?? (buying ? `Buy ${formatCoin(coins, asset.symbol)}` : `Sell ${formatCoin(n, asset.symbol)}`)}
            </button>
            <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">Demo only — no payment is taken and no coins move.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
