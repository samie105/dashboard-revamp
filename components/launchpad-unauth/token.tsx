"use client"

/**
 * A launch's own page.
 *
 * The order is the order of a buyer's questions:
 *   header   what is it, what's it worth, how close to graduating
 *   left     where the price is going (the curve, with "you are here"),
 *            who's trading it, what it says about itself
 *   right    the ticket — and right under it, how much the creator holds,
 *            because "can I buy" and "should I" belong side by side
 *
 * Every figure comes from the one curve function in launch-data.ts, so the
 * chart, the progress bar and the ticket's quote cannot disagree.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Alert02Icon, ArrowLeft01Icon, Globe02Icon, Tick02Icon, TelegramIcon, NewTwitterIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { QuoteClock } from "@/components/ui/quote-clock"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { useAvailability } from "@/components/launchpad-unauth/availability"
import {
  CREATE_FEE_SOL,
  CURVE_QUOTE_TTL,
  CURVE_SUPPLY,
  DEMO_SOL_BALANCE,
  GRADUATION_SOL,
  RESERVE_SUPPLY,
  SOL_USD,
  TOTAL_SUPPLY,
  TRADE_FEE_BPS,
  ago,
  curvePoints,
  demoTokenBalance,
  fmtPct,
  fmtSol,
  fmtTinyUsd,
  fmtTokens,
  fmtUsd,
  quoteCurve,
  shortAddress,
  tradesFor,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"
import { CopyChip, LaunchAvatar, PausedNotice, ProgressBar, StatusPill, progressLabel } from "@/components/launchpad-unauth/ui"
import { Figure, Icon, Panel, PanelTitle, PillTabs, SLIDE } from "@/components/redesign/ui"

/* ── Header ───────────────────────────────────────────────────────────── */

export function TokenHeader({ launch: v }: { launch: LaunchView }) {
  const links = [
    v.links.website && { href: v.links.website, icon: Globe02Icon, label: "Website" },
    v.links.x && { href: `https://x.com/${v.links.x.replace(/^@/, "")}`, icon: NewTwitterIcon, label: "X" },
    v.links.telegram && { href: `https://t.me/${v.links.telegram.replace(/^@/, "")}`, icon: TelegramIcon, label: "Telegram" },
  ].filter(Boolean) as { href: string; icon: typeof Globe02Icon; label: string }[]

  return (
    <div className="flex flex-col gap-3">
      <Link href={PREVIEW_ROUTES.launchpad} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
        All launches
      </Link>
      <Panel className="relative">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 140% at 0% 0%, hsl(${v.hue} 70% 50% / 0.14), transparent 60%)` }} />
        <div className="relative flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex min-w-0 items-center gap-4">
            <LaunchAvatar launch={v} size="xl" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">{v.name}</h1>
                <span className="font-display text-[18px] font-semibold text-muted-foreground">${v.symbol}</span>
                <StatusPill status={v.status} />
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">Demo</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>Launched {ago(v.minutesAgo)}</span>
                <span>·</span>
                <span>by</span>
                <CopyChip value={v.creator} />
                {v.mint && (
                  <>
                    <span>· mint</span>
                    <CopyChip value={v.mint} />
                  </>
                )}
                {links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" title={l.label} className="flex size-7 items-center justify-center rounded-lg border border-white/[0.07] text-muted-foreground transition-colors hover:text-foreground">
                    <Icon icon={l.icon} className="size-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] lg:ml-auto lg:min-w-[380px]">
            {[
              { k: "Market cap", v: fmtUsd(v.marketCapUsd) },
              { k: "Price", v: fmtTinyUsd(v.priceUsd) },
              { k: "Creator holds", v: fmtPct(v.creatorBps), warn: v.creatorBps >= 1000 },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5 bg-[#111] px-4 py-3">
                <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
                <dd className={cn("font-display text-[17px] font-semibold tabular-nums", s.warn ? "text-warning" : "text-foreground")}>{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex flex-col gap-2 border-t border-white/[0.06] px-5 py-4 md:px-6">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="text-muted-foreground">
              {v.status === "live" ? (
                <>
                  <span className="font-semibold tabular-nums text-foreground">{fmtSol(Math.min(v.solRaised, GRADUATION_SOL), 2)}</span> raised of {GRADUATION_SOL} SOL ·{" "}
                  <span className="font-semibold tabular-nums text-foreground">{fmtSol(v.remainingSol, 2)}</span> to graduation
                </>
              ) : v.status === "graduating" ? (
                "The curve is full — liquidity is being seeded"
              ) : (
                "Graduated — trading on the open market"
              )}
            </span>
            <span className="font-display text-[16px] font-semibold tabular-nums text-primary">{progressLabel(v.progressBps, v.status)}</span>
          </div>
          <ProgressBar bps={v.progressBps} status={v.status} size="lg" />
        </div>
      </Panel>
    </div>
  )
}

/* ── Curve chart ──────────────────────────────────────────────────────── */

/**
 * Price against supply sold — the curve as configured, which exists before a
 * single trade. The filled part is what's been bought; the dot is now; the
 * dashed line is graduation. Hover reads off any point.
 */
export function CurveChart({ launch: v }: { launch: LaunchView }) {
  const pts = React.useMemo(() => curvePoints(80), [])
  const wrap = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(0)
  const [hover, setHover] = React.useState<number | null>(null)
  React.useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const H = 240
  const PAD_L = 4
  const PAD_R = 64
  const PAD_B = 26
  const maxSold = pts[pts.length - 1].sold
  const maxP = pts[pts.length - 1].price * 1.08
  const x = (sold: number) => PAD_L + (sold / maxSold) * (w - PAD_L - PAD_R)
  const y = (price: number) => 8 + (1 - price / maxP) * (H - PAD_B - 8)
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.sold).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")
  const nowSold = v.tokensSold
  const filled = pts.filter((p) => p.sold <= nowSold)
  const fillPath = filled.length > 1 ? `${filled.map((p, i) => `${i ? "L" : "M"}${x(p.sold).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")} L${x(nowSold)},${y(v.priceSol)} L${x(nowSold)},${H - PAD_B} L${x(0)},${H - PAD_B} Z` : ""
  const hp = hover !== null ? pts[hover] : null

  return (
    <Panel className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle className="text-[16px]">Bonding curve</PanelTitle>
        <span className="text-[12px] text-muted-foreground">Price rises as supply is bought</span>
      </div>
      <div
        ref={wrap}
        className="relative w-full touch-pan-y select-none"
        style={{ height: H }}
        onPointerMove={(e) => {
          const box = wrap.current?.getBoundingClientRect()
          if (!box || w === 0) return
          const t = (e.clientX - box.left - PAD_L) / (w - PAD_L - PAD_R)
          setHover(t >= 0 && t <= 1 ? Math.round(t * (pts.length - 1)) : null)
        }}
        onPointerLeave={() => setHover(null)}
      >
        {w > 0 && (
          <svg width={w} height={H} className="absolute inset-0" aria-hidden>
            <defs>
              <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={PAD_L} x2={w - PAD_R} y1={y(maxP * f * 0.92)} y2={y(maxP * f * 0.92)} stroke="rgb(255 255 255 / 0.05)" />
                <text x={w - 4} y={y(maxP * f * 0.92)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/75 text-[10.5px] tabular-nums">
                  {fmtTinyUsd(maxP * f * 0.92 * SOL_USD)}
                </text>
              </g>
            ))}
            {fillPath && <path d={fillPath} fill="url(#curve-fill)" />}
            <path d={line} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={2} strokeDasharray="4 4" />
            {filled.length > 1 && (
              <motion.path
                d={filled.map((p, i) => `${i ? "L" : "M"}${x(p.sold).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
              />
            )}
            <line x1={x(maxSold)} x2={x(maxSold)} y1={0} y2={H - PAD_B} stroke="var(--credit)" strokeDasharray="3 4" opacity={0.6} />
            <text x={x(maxSold) - 6} y={14} textAnchor="end" className="fill-credit text-[10.5px] font-semibold">
              Graduates at {GRADUATION_SOL} SOL
            </text>
            {v.status === "live" && (
              <g>
                <circle cx={x(nowSold)} cy={y(v.priceSol)} r={12} className="fill-primary/20">
                  <animate attributeName="r" values="7;14;7" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle cx={x(nowSold)} cy={y(v.priceSol)} r={5} className="fill-primary stroke-[#0f0f0f]" strokeWidth={2} />
              </g>
            )}
            {hp && (
              <g>
                <line x1={x(hp.sold)} x2={x(hp.sold)} y1={0} y2={H - PAD_B} stroke="rgb(255 255 255 / 0.25)" strokeDasharray="3 3" />
                <circle cx={x(hp.sold)} cy={y(hp.price)} r={4} className="fill-foreground" />
              </g>
            )}
            {[0, 0.25, 0.5, 0.75, 1].map((f, k) => (
              <text key={f} x={x(maxSold * f)} y={H - 8} textAnchor={k === 0 ? "start" : k === 4 ? "end" : "middle"} className="fill-muted-foreground/70 text-[10.5px] tabular-nums">
                {fmtTokens(maxSold * f)}
              </text>
            ))}
          </svg>
        )}
        {hp && (
          <div className="pointer-events-none absolute top-6 z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-[#141414]/95 px-3 py-2 text-center shadow-lg" style={{ left: Math.min(w - 90, Math.max(90, x(hp.sold))) }}>
            <span className="block text-[13px] font-semibold tabular-nums">{fmtTinyUsd(hp.price * SOL_USD)}</span>
            <span className="block text-[11px] text-muted-foreground">
              {fmtTokens(hp.sold)} sold · {fmtSol(hp.sol, 1)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" /> Bought so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-white/30" /> Still on the curve
        </span>
        {v.status === "live" && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> You are here · {fmtTinyUsd(v.priceUsd)}
          </span>
        )}
      </div>
    </Panel>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

type Side = "buy" | "sell"
const SLIPPAGE = [50, 100, 200, 500]
/** Above this the impact row turns warning — a young curve is thin, and a
 *  big buy moves it a lot; worth saying before, not after. */
const IMPACT_WARN_PCT = 5

export function CurveTicket({ launch: v }: { launch: LaunchView }) {
  const [side, setSide] = React.useState<Side>("buy")
  const [amount, setAmount] = React.useState("")
  const [slip, setSlip] = React.useState(100)
  const [left, setLeft] = React.useState<number | null>(null)
  const [signing, setSigning] = React.useState(false)
  const { solana } = useAvailability()

  const tokenBal = React.useMemo(() => demoTokenBalance(v), [v])
  const balance = side === "buy" ? DEMO_SOL_BALANCE : tokenBal
  const value = Number(amount)
  const quote = React.useMemo(() => quoteCurve(side, value, v, slip), [side, value, v, slip])
  const over = Number.isFinite(value) && value > balance

  // A new amount / side / tolerance is a new quote: restart the clock.
  // Derived during render rather than in an effect, so it costs one render.
  const quoteKey = quote ? `${side}:${value}:${slip}` : null
  const [clockKey, setClockKey] = React.useState<string | null>(null)
  if (quoteKey !== clockKey) {
    setClockKey(quoteKey)
    setLeft(quoteKey ? CURVE_QUOTE_TTL : null)
    setSigning(false)
  }
  React.useEffect(() => {
    if (left === null) return
    const t = window.setTimeout(() => setLeft((s) => (s === null ? null : s <= 1 ? CURVE_QUOTE_TTL : s - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [left])

  const quick =
    side === "buy"
      ? ["0.1", "0.5", "1", "5"].map((s) => ({ label: `${s} SOL`, value: s }))
      : [25, 50, 100].map((p) => ({ label: p === 100 ? "Max" : `${p}%`, value: String(Math.floor((tokenBal * p) / 100)) }))

  if (solana.state === "paused") {
    return (
      <Panel className="flex flex-col gap-3 p-4">
        <PanelTitle className="text-[15px]">Trading on this curve is paused</PanelTitle>
        <PausedNotice compact />
        <span className="text-[12.5px] text-muted-foreground">Your {v.symbol} is safe. Buying and selling reopen when the pause lifts.</span>
      </Panel>
    )
  }

  const blocker = !quote ? "Enter an amount" : over ? (side === "buy" ? "Not enough SOL" : `Not enough ${v.symbol}`) : null

  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[15px]">Trade ${v.symbol}</PanelTitle>
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          {left !== null && <span className="tabular-nums">Quote {left}s</span>}
          <QuoteClock seconds={left} total={CURVE_QUOTE_TTL} />
        </div>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={side === s}
            onClick={() => {
              setSide(s)
              setAmount("")
            }}
            className={cn("relative h-10 rounded-xl text-[14px] font-semibold capitalize transition-colors", side === s ? "text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {side === s && <motion.span layoutId="curve-side" transition={SLIDE} className={cn("absolute inset-0 rounded-xl", s === "buy" ? "bg-credit" : "bg-debit")} />}
            <span className="relative">{s}</span>
          </button>
        ))}
      </div>

      <div className={cn("flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors", over ? "border-debit/40 bg-debit/[0.03]" : "border-white/[0.08] bg-white/[0.025] focus-within:border-primary/40")}>
        <div className="flex justify-between text-[12px] text-muted-foreground">
          <span>{side === "buy" ? "You pay" : "You sell"}</span>
          <span className="tabular-nums">
            Balance <Figure mask="••••">{side === "buy" ? fmtSol(DEMO_SOL_BALANCE, 2) : `${fmtTokens(tokenBal)} ${v.symbol}`}</Figure>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            aria-label={side === "buy" ? "SOL to spend" : `${v.symbol} to sell`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums outline-none placeholder:text-muted-foreground/30"
          />
          <span className="text-[14px] font-semibold text-muted-foreground">{side === "buy" ? "SOL" : v.symbol}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={side === "sell" && tokenBal === 0}
              onClick={() => setAmount(q.value)}
              className={cn("h-7 rounded-lg border px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors disabled:opacity-40", amount === q.value ? "border-primary/50 bg-primary/[0.1] text-primary" : "border-white/[0.07] text-muted-foreground hover:text-foreground")}
            >
              {q.label}
            </button>
          ))}
        </div>
        {side === "sell" && tokenBal === 0 && <span className="text-[12px] text-muted-foreground">You don&apos;t hold any {v.symbol} yet.</span>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">Max slippage</span>
        <PillTabs id="curve-slip" size="sm" options={SLIPPAGE.map((s) => ({ key: String(s), label: `${s / 100}%` }))} value={String(slip)} onChange={(k) => setSlip(Number(k))} />
      </div>

      <AnimatePresence initial={false}>
        {quote && (
          <motion.dl initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-3 text-[12.5px]">
            {[
              { k: "You receive", v: side === "buy" ? `${fmtTokens(quote.amountOut)} ${v.symbol}` : fmtSol(quote.amountOut, 4), strong: true },
              { k: "Price impact", v: `${quote.priceImpactPct.toFixed(2)}%`, tone: quote.priceImpactPct >= IMPACT_WARN_PCT ? "text-warning" : "text-foreground" },
              { k: `Fee (${fmtPct(TRADE_FEE_BPS)})`, v: fmtSol(quote.feeSol, 5) },
              { k: "Minimum received", v: side === "buy" ? `${fmtTokens(quote.minOut)} ${v.symbol}` : fmtSol(quote.minOut, 4) },
            ].map((r) => (
              <div key={r.k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{r.k}</dt>
                <dd className={cn("font-semibold tabular-nums", r.tone ?? "text-foreground", r.strong && "font-display text-[14px]")}>{r.v}</dd>
              </div>
            ))}
            {quote.cappedAtSol !== undefined && (
              <div className="mt-1 flex items-start gap-2 rounded-lg bg-warning/[0.08] px-2.5 py-2 text-[12px] leading-snug text-foreground/85">
                <Icon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0 text-warning" />
                This buy fills the curve. Only {fmtSol(quote.cappedAtSol, 3)} is taken — the rest stays in your wallet, and the token graduates.
              </div>
            )}
          </motion.dl>
        )}
      </AnimatePresence>

      {signing ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-4 text-center">
          <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-[13.5px] font-semibold">Approve in your wallet</span>
          <span className="text-[12px] text-muted-foreground">Demo — nothing is signed or sent.</span>
          <button type="button" onClick={() => setSigning(false)} className="text-[12.5px] font-semibold text-primary hover:opacity-85">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!!blocker}
          onClick={() => setSigning(true)}
          className={cn(
            "flex h-12 items-center justify-center rounded-xl text-[14.5px] font-semibold transition-[filter]",
            blocker ? "border border-white/[0.07] bg-white/[0.04] text-muted-foreground" : cn("text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110", side === "buy" ? "bg-credit" : "bg-debit"),
          )}
        >
          {blocker ?? (side === "buy" ? `Buy ${v.symbol}` : `Sell ${v.symbol}`)}
        </button>
      )}
    </Panel>
  )
}

/* ── Graduation ───────────────────────────────────────────────────────── */

/** Where the ticket was, once the curve is closed: where trading went. No ETA
 *  on graduating — the migration has no published duration, and a bar on a
 *  guess would set an expectation nobody made. */
export function GraduationCard({ launch: v }: { launch: LaunchView }) {
  const done = v.status === "graduated"
  const steps = [`Curve filled at ${GRADUATION_SOL} SOL`, "Pool created, liquidity seeded", "Trading on the open market"]
  const active = done ? 3 : 1
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <PanelTitle className="text-[16px]">{done ? `${v.symbol} has graduated` : `${v.symbol} is graduating`}</PanelTitle>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {done ? "The curve is closed. Its SOL and the reserved supply now make up the pool, and the token trades like any other." : "The curve is full, so it stopped selling. The pool is being created from the raised SOL and the reserved supply."}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const state = i < active ? "done" : i === active ? "current" : "todo"
          return (
            <li key={s} className="flex items-center gap-3">
              <span className={cn("flex size-6 items-center justify-center rounded-full border", state === "done" && "border-credit/40 bg-credit/[0.12] text-credit", state === "current" && "border-warning/50 bg-warning/[0.1]", state === "todo" && "border-white/[0.1]")}>
                {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-warning" /> : null}
              </span>
              <span className={cn("text-[13px] font-medium", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
            </li>
          )
        })}
      </ol>
      {done && (
        <Link href={PREVIEW_ROUTES.markets} className="dash-gold-btn flex h-11 items-center justify-center rounded-xl text-[14px] font-semibold">
          Trade {v.symbol} on the market
        </Link>
      )}
    </Panel>
  )
}

/* ── Supply ───────────────────────────────────────────────────────────── */

/** Where the billion tokens are: sold on the curve (with the creator's slice
 *  called out), still for sale, and the reserve that seeds the pool. */
export function SupplyCard({ launch: v }: { launch: LaunchView }) {
  const sold = Math.min(v.tokensSold, CURVE_SUPPLY)
  const creator = Math.min(v.creatorTokens, sold)
  const segments = [
    { k: "Creator", v: creator, cls: "bg-warning", hint: `${fmtPct(v.creatorBps)} of curve supply, bought at launch` },
    { k: "Bought by others", v: sold - creator, cls: "bg-primary", hint: "Sold on the curve" },
    { k: "Still on the curve", v: CURVE_SUPPLY - sold, cls: "bg-white/20", hint: "Available to buy" },
    { k: "Pool reserve", v: RESERVE_SUPPLY, cls: "bg-credit/70", hint: "Paired with the raised SOL at graduation" },
  ]
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-baseline justify-between">
        <PanelTitle className="text-[15px]">Supply</PanelTitle>
        <span className="text-[12px] tabular-nums text-muted-foreground">{fmtTokens(TOTAL_SUPPLY)} total</span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <motion.span
            key={s.k}
            title={`${s.k} · ${fmtTokens(s.v)}`}
            initial={{ width: 0 }}
            animate={{ width: `${(s.v / TOTAL_SUPPLY) * 100}%` }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className={cn("h-full", s.cls)}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {segments.map((s) => (
          <li key={s.k} className="flex items-center gap-3">
            <span className={cn("size-2.5 shrink-0 rounded-[3px]", s.cls)} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13px] font-medium text-foreground">{s.k}</span>
              <span className="truncate text-[11.5px] text-muted-foreground">{s.hint}</span>
            </span>
            <span className="text-right tabular-nums">
              <span className="block text-[13px] font-semibold text-foreground">{fmtTokens(s.v)}</span>
              <span className="block text-[11px] text-muted-foreground">{((s.v / TOTAL_SUPPLY) * 100).toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
      {v.creatorBps >= 1000 && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2.5 text-[12px] leading-snug text-foreground/85">
          <Icon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0 text-warning" />
          The creator holds {fmtPct(v.creatorBps)} of curve supply — enough to move the price if they sell.
        </p>
      )}
    </Panel>
  )
}

/* ── Trades ───────────────────────────────────────────────────────────── */

export function TradesCard({ launch: v }: { launch: LaunchView }) {
  const trades = React.useMemo(() => tradesFor(v, 14), [v])
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  return (
    <Panel className="flex flex-col gap-2 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex items-baseline justify-between px-2 pb-1">
        <PanelTitle className="text-[15px]">Recent trades</PanelTitle>
        <span className="text-[12px] text-muted-foreground">On the curve</span>
      </div>
      {trades.length === 0 ? (
        <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">No trades yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-[52px_1fr_1fr_auto] gap-3 px-2 pb-1 text-[11px] font-medium text-muted-foreground">
            <span>Side</span>
            <span className="text-right">SOL</span>
            <span className="text-right">{v.symbol}</span>
            <span className="text-right">Wallet · when</span>
          </div>
          <ul className="flex flex-col">
            {trades.map((t) => (
              <li key={t.id} className="grid grid-cols-[52px_1fr_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-[12.5px] tabular-nums transition-colors hover:bg-white/[0.025]">
                <span className={cn("w-fit rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", t.side === "buy" ? "bg-credit/[0.12] text-credit" : "bg-debit/[0.12] text-debit")}>{t.side}</span>
                <span className="text-right font-semibold text-foreground">{t.sol.toFixed(3)}</span>
                <span className="text-right text-foreground/80">{fmtTokens(t.tokens)}</span>
                <span className="text-right text-[11.5px] text-muted-foreground">
                  <span className="hidden font-mono sm:inline">{shortAddress(t.wallet)} · </span>
                  {ready ? ago(t.minutesAgo) : " "}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

/* ── About & terms ────────────────────────────────────────────────────── */

export function AboutCard({ launch: v }: { launch: LaunchView }) {
  const terms = [
    { k: "Graduates at", v: `${GRADUATION_SOL} SOL raised` },
    { k: "Curve supply", v: `${fmtTokens(CURVE_SUPPLY)} (${(CURVE_SUPPLY / TOTAL_SUPPLY) * 100}%)` },
    { k: "Pool reserve", v: `${fmtTokens(RESERVE_SUPPLY)} (${(RESERVE_SUPPLY / TOTAL_SUPPLY) * 100}%)` },
    { k: "Trading fee", v: fmtPct(TRADE_FEE_BPS) },
    { k: "Creation fee", v: fmtSol(CREATE_FEE_SOL) },
  ]
  return (
    <Panel className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <PanelTitle className="text-[15px]">About {v.name}</PanelTitle>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{v.description}</p>
      </div>
      <div className="flex flex-col gap-2">
        <PanelTitle className="text-[15px]">Launch terms</PanelTitle>
        <dl className="flex flex-col divide-y divide-white/[0.05]">
          {terms.map((t) => (
            <div key={t.k} className="flex justify-between gap-3 py-2 text-[12.5px]">
              <dt className="text-muted-foreground">{t.k}</dt>
              <dd className="font-semibold tabular-nums text-foreground">{t.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}
