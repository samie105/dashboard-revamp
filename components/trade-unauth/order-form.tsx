"use client"

/**
 * The two order forms — spot and perpetuals.
 *
 * Both share one skeleton: side → order type → price → amount with a
 * percentage slider → a summary of exactly what happens → a button in the
 * side's colour that names its blocker. What differs is the summary:
 *
 *   spot   total, fee, and the balance left after
 *   perps  margin, notional, LIQUIDATION PRICE, fee and funding — the
 *          numbers a leverage slider controls and the live ticket never shows
 *
 * Nothing is sent. A placed spot order lands in Open orders (cancellable) or
 * Order history; a perp opens a position in Positions.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  FEE_RATE,
  balanceOf,
  formatPrice,
  quoteFor,
  type Book,
  type Market,
  type Order,
  type OrderType,
} from "@/components/trade-unauth/trade-data"
import { FUTURES_EQUITY, quotePosition, type MarginMode, type Perp, type Position } from "@/components/trade-unauth/futures-data"
import { Figure, Icon, Panel, SLIDE } from "@/components/redesign/ui"

/* ── Shared parts ─────────────────────────────────────────────────────── */

export type Picked = { price: number; nonce: number } | null

function SideTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; tone: "credit" | "debit" }[] }) {
  return (
    <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={cn("relative h-10 rounded-xl text-[14px] font-semibold transition-colors", on ? "text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {on && (
              <motion.span
                layoutId="order-side"
                transition={SLIDE}
                className={cn("absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]", o.tone === "credit" ? "bg-credit" : "bg-debit")}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function TypeTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-white/[0.06]">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={cn("relative pb-2.5 text-[13px] font-semibold transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
            {on && <motion.span layoutId="order-type" transition={SLIDE} className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  suffix,
  disabled,
  placeholder,
  invalid,
  flash,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  suffix: React.ReactNode
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
  /** Briefly highlight — used when a book click fills the price. */
  flash?: number
}) {
  return (
    <label
      key={flash}
      className={cn(
        "flex h-12 items-center gap-2 rounded-xl border px-3.5 transition-colors",
        disabled ? "border-white/[0.05] bg-white/[0.015]" : invalid ? "border-debit/50 bg-debit/[0.03]" : "border-white/[0.08] bg-white/[0.025] focus-within:border-primary/45",
        flash ? "animate-[field-flash_0.9s_ease-out]" : "",
      )}
    >
      <span className="w-14 shrink-0 text-[12px] font-medium text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        className="min-w-0 flex-1 bg-transparent text-right text-[14px] font-semibold tabular-nums text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/60 disabled:text-muted-foreground"
      />
      <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">{suffix}</span>
    </label>
  )
}

/** 0–100 slider with snap marks at the quarters. */
function PercentSlider({ value, onChange, tone }: { value: number; onChange: (v: number) => void; tone: "credit" | "debit" }) {
  const track = React.useRef<HTMLDivElement>(null)
  const set = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    let v = Math.round(((clientX - box.left) / box.width) * 100)
    v = Math.max(0, Math.min(100, v))
    // Snap within 3% of a mark — quarters are what people actually want.
    for (const m of [0, 25, 50, 75, 100]) if (Math.abs(v - m) <= 3) v = m
    onChange(v)
  }
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-1">
      <div
        ref={track}
        role="slider"
        aria-label="Percent of available"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(100, value + 5))
          if (e.key === "ArrowLeft") onChange(Math.max(0, value - 5))
        }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          set(e.clientX)
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        className="relative h-5 cursor-pointer touch-none outline-none"
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.08]" />
        <span className={cn("absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full", tone === "credit" ? "bg-credit" : "bg-debit")} style={{ width: `${value}%` }} />
        {[0, 25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-[#0f0f0f]", value >= m ? (tone === "credit" ? "bg-credit" : "bg-debit") : "bg-[#2a2a2a]")}
            style={{ left: `${m}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0f0f0f] bg-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.25)]"
          style={{ left: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-[10.5px] font-medium tabular-nums text-muted-foreground">
        {[0, 25, 50, 75, 100].map((m) => (
          <button key={m} type="button" onClick={() => onChange(m)} className="hover:text-foreground">
            {m}%
          </button>
        ))}
      </div>
    </div>
  )
}

function Summary({ rows }: { rows: { k: string; v: React.ReactNode; tone?: string }[] }) {
  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-3 text-[12.5px]">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{r.k}</dt>
          <dd className={cn("font-semibold tabular-nums text-foreground", r.tone)}>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Cta({ blocker, tone, children, onClick }: { blocker: string | null; tone: "credit" | "debit"; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!!blocker}
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center rounded-xl text-[14.5px] font-semibold transition-[filter,background-color]",
        blocker
          ? "border border-white/[0.07] bg-white/[0.04] text-muted-foreground"
          : cn("text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110 active:brightness-95", tone === "credit" ? "bg-credit" : "bg-debit"),
      )}
    >
      {blocker ?? children}
    </button>
  )
}

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-xl border border-credit/25 bg-credit/[0.07] px-3.5 py-2.5 text-[12.5px] font-medium text-credit"
          role="status"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null)
  const t = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(t.current), [])
  return {
    msg,
    show: (m: string) => {
      setMsg(m)
      window.clearTimeout(t.current)
      t.current = window.setTimeout(() => setMsg(null), 3200)
    },
  }
}

const trim = (v: number, d: number) => String(Number(v.toFixed(d)))

/** Ids for orders and positions placed this session. A module counter, not a
 *  clock — unique across both forms and across Spot ↔ Futures remounts. */
let seq = 0
const nextId = () => `local-${++seq}`

/* ── Spot ─────────────────────────────────────────────────────────────── */

export function SpotForm({
  market,
  book,
  picked,
  onPlace,
  initialSide = "buy",
}: {
  market: Market
  book: Book
  picked: Picked
  onPlace: (o: Order) => void
  initialSide?: "buy" | "sell"
}) {
  const [side, setSide] = React.useState<"buy" | "sell">(initialSide)
  const [type, setType] = React.useState<OrderType>("limit")
  const [price, setPrice] = React.useState(trim(market.price, 6))
  const [amount, setAmount] = React.useState("")
  const [pct, setPct] = React.useState(0)
  const { msg, show } = useToast()

  // A new pair resets the form to that pair's price.
  React.useEffect(() => {
    setPrice(trim(market.price, 6))
    setAmount("")
    setPct(0)
  }, [market.id, market.price])

  // A click in the book: switch to Limit at that price.
  React.useEffect(() => {
    if (!picked) return
    setType((t) => (t === "market" ? "limit" : t))
    setPrice(trim(picked.price, 8))
  }, [picked])

  const px = type === "market" ? market.price : Number(price) || 0
  const qty = Number(amount) || 0
  const quoteBal = balanceOf(market.quote)
  const baseBal = balanceOf(market.base)
  const total = qty * px
  const fee = total * FEE_RATE
  const maxQty = side === "buy" ? (px > 0 ? quoteBal / (px * (1 + FEE_RATE)) : 0) : baseBal
  const q = type === "market" && qty > 0 ? quoteFor({ market, book, side, quoteAmount: total, slippagePct: 0.5 }) : null
  const tone = side === "buy" ? "credit" : "debit"

  const setFromPct = (p: number) => {
    setPct(p)
    setAmount(p === 0 ? "" : trim((maxQty * p) / 100, market.price >= 100 ? 5 : 3))
  }
  const setFromAmount = (v: string) => {
    setAmount(v)
    setPct(maxQty > 0 ? Math.min(100, Math.round(((Number(v) || 0) / maxQty) * 100)) : 0)
  }

  const blocker =
    type !== "market" && px <= 0
      ? "Enter a price"
      : qty <= 0
        ? "Enter an amount"
        : side === "buy" && total + fee > quoteBal
          ? `Not enough ${market.quote}`
          : side === "sell" && qty > baseBal
            ? `Not enough ${market.base}`
            : null

  const place = () => {
    const filled = type === "market"
    onPlace({
      id: nextId(),
      pairId: market.id,
      side,
      type,
      status: filled ? "filled" : "open",
      price: px,
      amount: qty,
      filledPct: filled ? 100 : 0,
      date: "Today",
      time: new Date().toTimeString().slice(0, 5),
      route: market.chains[0] ?? "—",
    })
    show(filled ? `${side === "buy" ? "Bought" : "Sold"} ${amount} ${market.base} at market (demo)` : `${type === "stop" ? "Stop" : "Limit"} order placed — see Open orders (demo)`)
    setAmount("")
    setPct(0)
  }

  return (
    <div className="flex flex-col gap-4">
      <SideTabs
        value={side}
        onChange={(v) => {
          setSide(v)
          setAmount("")
          setPct(0)
        }}
        options={[
          { key: "buy", label: "Buy", tone: "credit" },
          { key: "sell", label: "Sell", tone: "debit" },
        ]}
      />
      <TypeTabs
        value={type}
        onChange={setType}
        options={[
          { key: "limit", label: "Limit" },
          { key: "market", label: "Market" },
          { key: "stop", label: "Stop" },
        ]}
      />

      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between text-[12px] text-muted-foreground">
          <span>Available</span>
          <span className="font-semibold tabular-nums text-foreground">
            <Figure mask="••••">{side === "buy" ? `${quoteBal.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${market.quote}` : `${baseBal.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${market.base}`}</Figure>
          </span>
        </div>
        {type === "market" ? (
          <Field label="Price" value="" placeholder="Best market price" disabled suffix={market.quote} />
        ) : (
          <Field label={type === "stop" ? "Trigger" : "Price"} value={price} onChange={setPrice} suffix={market.quote} flash={picked?.nonce} />
        )}
        <Field label="Amount" value={amount} onChange={setFromAmount} suffix={market.base} invalid={!!blocker && qty > 0 && blocker.startsWith("Not enough")} />
        <PercentSlider value={pct} onChange={setFromPct} tone={tone} />
        <Field label="Total" value={qty > 0 ? trim(total, 2) : ""} onChange={(v) => setFromAmount(px > 0 ? trim((Number(v) || 0) / px, 6) : "")} suffix={market.quote} placeholder="0.00" />
      </div>

      <Summary
        rows={[
          { k: type === "market" ? "Est. price" : type === "stop" ? "Triggers at" : "Price", v: `${formatPrice(px)} ${market.quote}` },
          { k: `Fee (${(FEE_RATE * 100).toFixed(2)}%)`, v: qty > 0 ? `${fee.toFixed(fee < 1 ? 4 : 2)} ${market.quote}` : "—" },
          ...(q ? [{ k: "Price impact", v: `${q.impactPct.toFixed(3)}%`, tone: q.impactPct > 1 ? "text-warning" : "text-credit" }] : []),
          { k: side === "buy" ? "You spend" : "You receive", v: qty > 0 ? `${(side === "buy" ? total + fee : total - fee).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${market.quote}` : "—" },
        ]}
      />

      <Cta blocker={blocker} tone={tone} onClick={place}>
        {side === "buy" ? "Buy" : "Sell"} {market.base}
      </Cta>
      <Toast message={msg} />
    </div>
  )
}

/* ── Perpetuals ───────────────────────────────────────────────────────── */

function LeverageSlider({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const marks = [1, ...[0.25, 0.5, 0.75].map((f) => Math.max(2, Math.round(max * f))), max]
  const track = React.useRef<HTMLDivElement>(null)
  const set = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    const f = Math.max(0, Math.min(1, (clientX - box.left) / box.width))
    onChange(Math.max(1, Math.round(1 + f * (max - 1))))
  }
  const pos = ((value - 1) / (max - 1)) * 100
  const risky = value >= max * 0.5

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">Leverage</span>
        <span className={cn("rounded-lg px-2 py-0.5 font-display text-[14px] font-semibold tabular-nums", risky ? "bg-warning/[0.12] text-warning" : "bg-primary/[0.1] text-primary")}>{value}×</span>
      </div>
      <div
        ref={track}
        role="slider"
        aria-label="Leverage"
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(max, value + 1))
          if (e.key === "ArrowLeft") onChange(Math.max(1, value - 1))
        }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          set(e.clientX)
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        className="relative h-5 cursor-pointer touch-none outline-none"
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.08]" />
        {/* Gold while it's moderate, amber past half the max, red near the top:
            the fill says how much rope you're giving the position. */}
        <span
          className={cn("absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition-colors duration-300", value >= max * 0.8 ? "bg-debit" : risky ? "bg-warning" : "bg-primary")}
          style={{ width: `${pos}%` }}
        />
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0f0f0f] bg-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.25)]" style={{ left: `${pos}%` }} />
      </div>
      <div className="flex justify-between text-[10.5px] font-medium tabular-nums text-muted-foreground">
        {marks.map((m) => (
          <button key={m} type="button" onClick={() => onChange(m)} className={cn("hover:text-foreground", value === m && "text-foreground")}>
            {m}×
          </button>
        ))}
      </div>
    </div>
  )
}

export function PerpForm({
  perp,
  picked,
  onOpen,
  initialSide = "long",
}: {
  perp: Perp
  picked: Picked
  onOpen: (p: Position) => void
  initialSide?: "long" | "short"
}) {
  const [side, setSide] = React.useState<"long" | "short">(initialSide)
  const [type, setType] = React.useState<"market" | "limit">("market")
  const [mode, setMode] = React.useState<MarginMode>("isolated")
  const [lev, setLev] = React.useState(Math.min(10, perp.maxLeverage))
  const [price, setPrice] = React.useState(trim(perp.markPrice, 6))
  const [margin, setMargin] = React.useState("")
  const [pct, setPct] = React.useState(0)
  const [tpsl, setTpsl] = React.useState(false)
  const [tp, setTp] = React.useState("")
  const [sl, setSl] = React.useState("")
  const { msg, show } = useToast()

  React.useEffect(() => {
    setLev((l) => Math.min(l, perp.maxLeverage))
    setPrice(trim(perp.markPrice, 6))
    setMargin("")
    setPct(0)
    setTp("")
    setSl("")
  }, [perp.id, perp.markPrice, perp.maxLeverage])

  React.useEffect(() => {
    if (!picked) return
    setType("limit")
    setPrice(trim(picked.price, 8))
  }, [picked])

  const entry = type === "market" ? perp.markPrice : Number(price) || 0
  const m = Number(margin) || 0
  const q = quotePosition({ perp, side, margin: m, leverage: lev, entryPrice: entry })
  const avail = FUTURES_EQUITY.available
  const tone = side === "long" ? "credit" : "debit"
  // How far price can move against you before liquidation, as a percent.
  const liqDistance = entry > 0 ? Math.abs((q.liquidationPrice - entry) / entry) * 100 : 0

  const tpN = Number(tp) || 0
  const slN = Number(sl) || 0
  const tpWrong = tpsl && tpN > 0 && (side === "long" ? tpN <= entry : tpN >= entry)
  const slWrong = tpsl && slN > 0 && (side === "long" ? slN >= entry || slN <= q.liquidationPrice : slN <= entry || slN >= q.liquidationPrice)

  const blocker =
    type === "limit" && entry <= 0
      ? "Enter a price"
      : m <= 0
        ? "Enter margin"
        : m + q.fee > avail
          ? "Not enough margin available"
          : tpWrong
            ? `Take profit must be ${side === "long" ? "above" : "below"} entry`
            : slWrong
              ? "Stop loss must sit between entry and liquidation"
              : null

  const open = () => {
    onOpen({
      id: nextId(),
      perpId: perp.id,
      side,
      leverage: lev,
      mode,
      size: q.size,
      entry,
      margin: m,
      liquidation: q.liquidationPrice,
      takeProfit: tpN || undefined,
      stopLoss: slN || undefined,
    })
    show(`${side === "long" ? "Long" : "Short"} ${perp.base} ${lev}× opened — see Positions (demo)`)
    setMargin("")
    setPct(0)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1">
          {(["cross", "isolated"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn("h-8 rounded-lg text-[12.5px] font-semibold capitalize transition-colors", mode === k ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {k}
            </button>
          ))}
        </div>
        <span className="rounded-xl border border-white/[0.06] px-2.5 py-2 text-[11.5px] font-semibold tabular-nums text-muted-foreground">Max {perp.maxLeverage}×</span>
      </div>

      <SideTabs
        value={side}
        onChange={setSide}
        options={[
          { key: "long", label: "Long", tone: "credit" },
          { key: "short", label: "Short", tone: "debit" },
        ]}
      />
      <TypeTabs
        value={type}
        onChange={setType}
        options={[
          { key: "market", label: "Market" },
          { key: "limit", label: "Limit" },
        ]}
      />

      <LeverageSlider value={lev} max={perp.maxLeverage} onChange={setLev} />

      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between text-[12px] text-muted-foreground">
          <span>Available margin</span>
          <span className="font-semibold tabular-nums text-foreground">
            <Figure mask="••••">{`${avail.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`}</Figure>
          </span>
        </div>
        {type === "market" ? (
          <Field label="Price" value="" placeholder={`Mark ${formatPrice(perp.markPrice)}`} disabled suffix="USDT" />
        ) : (
          <Field label="Price" value={price} onChange={setPrice} suffix="USDT" flash={picked?.nonce} />
        )}
        <Field
          label="Margin"
          value={margin}
          onChange={(v) => {
            setMargin(v)
            setPct(Math.min(100, Math.round(((Number(v) || 0) / avail) * 100)))
          }}
          suffix="USDT"
          invalid={blocker === "Not enough margin available"}
        />
        <PercentSlider
          value={pct}
          tone={tone}
          onChange={(p) => {
            setPct(p)
            // Leave room for the fee at 100%, or Max always fails by a few cents.
            setMargin(p === 0 ? "" : trim(((avail / (1 + lev * 0.0005)) * p) / 100, 2))
          }}
        />
      </div>

      <button type="button" onClick={() => setTpsl((v) => !v)} aria-expanded={tpsl} className="flex items-center justify-between text-[12.5px] font-semibold text-foreground/85">
        <span className="flex items-center gap-2">
          <span className={cn("flex size-4 items-center justify-center rounded-[4px] border transition-colors", tpsl ? "border-primary bg-primary" : "border-white/25")}>
            {tpsl && <span className="size-1.5 rounded-[1px] bg-primary-foreground" />}
          </span>
          Take profit / Stop loss
        </span>
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", tpsl && "rotate-180")} strokeWidth={2} />
      </button>
      <AnimatePresence initial={false}>
        {tpsl && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="-mt-1 flex flex-col gap-2 overflow-hidden">
            <Field label="TP" value={tp} onChange={setTp} suffix="USDT" placeholder={side === "long" ? "Above entry" : "Below entry"} invalid={tpWrong} />
            <Field label="SL" value={sl} onChange={setSl} suffix="USDT" placeholder={side === "long" ? "Below entry" : "Above entry"} invalid={slWrong} />
          </motion.div>
        )}
      </AnimatePresence>

      <Summary
        rows={[
          { k: "Position size", v: m > 0 ? `${q.size.toLocaleString("en-US", { maximumFractionDigits: 5 })} ${perp.base}` : "—" },
          { k: "Notional", v: m > 0 ? `$${q.notional.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—" },
          {
            k: "Liquidation price",
            v: m > 0 ? `${formatPrice(q.liquidationPrice)} (${liqDistance.toFixed(1)}% away)` : "—",
            tone: m > 0 ? (liqDistance < 5 ? "text-debit" : liqDistance < 15 ? "text-warning" : "text-foreground") : undefined,
          },
          { k: "Fee (0.05%)", v: m > 0 ? `$${q.fee.toFixed(2)}` : "—" },
          {
            k: "Funding / 8h",
            v: m > 0 ? `${q.fundingPer8h >= 0 ? "+" : "−"}$${Math.abs(q.fundingPer8h).toFixed(2)}` : `${perp.fundingPct >= 0 ? "+" : ""}${perp.fundingPct.toFixed(4)}%`,
            tone: m > 0 ? (q.fundingPer8h >= 0 ? "text-credit" : "text-debit") : undefined,
          },
        ]}
      />

      {m > 0 && liqDistance < 5 && (
        <p className="-mt-1 flex items-start gap-2 rounded-xl border border-debit/25 bg-debit/[0.06] px-3 py-2.5 text-[12px] leading-snug text-foreground/85">
          <Icon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-debit" />A {liqDistance.toFixed(1)}% move against you closes this position. Lower the leverage to give it room.
        </p>
      )}

      <Cta blocker={blocker} tone={tone} onClick={open}>
        {side === "long" ? "Long" : "Short"} {perp.base} {lev}×
      </Cta>
      <Toast message={msg} />
    </div>
  )
}

/** The order-form panel: a Spot/Perp-aware wrapper with the panel chrome. */
export function OrderPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-[15px] font-semibold">{title}</span>
        <span className="text-[11.5px] font-medium text-muted-foreground">Demo — nothing is sent</span>
      </div>
      {children}
    </Panel>
  )
}
