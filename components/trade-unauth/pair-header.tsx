"use client"

/**
 * The bar across the top of the terminal: which market, its price, and the
 * day's numbers — plus the Spot / Futures switch.
 *
 * The pair name is the market picker. It opens a searchable list (quote tabs
 * and favourites on spot), so changing market never means leaving the
 * screen. On futures the stats change to what a perp trader watches: mark
 * price, funding with a countdown to the next stamp, and open interest.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, Search01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PAIRS, formatCompact, formatPrice, type Market } from "@/components/trade-unauth/trade-data"
import { PERPS, type Perp } from "@/components/trade-unauth/futures-data"
import { Icon, Panel, SLIDE, Spark } from "@/components/redesign/ui"

export type Venue = "spot" | "futures"

/* ── Market picker ────────────────────────────────────────────────────── */

type QuoteTab = "fav" | "USDT" | "BTC" | "ETH"

export function MarketPicker({ venue, current, onPick, compact = false }: { venue: Venue; current: Market; onPick: (id: string) => void; compact?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [tab, setTab] = React.useState<QuoteTab>("USDT")
  const [favs, setFavs] = React.useState<string[]>(["BTC-USDT", "SOL-USDT", "ETH-USDT", "BTC-PERP", "SOL-PERP"])
  const wrap = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    input.current?.focus()
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
  const universe: Market[] = venue === "spot" ? PAIRS : PERPS
  const list = universe
    .filter((m) => (venue === "futures" ? true : tab === "fav" ? favs.includes(m.id) : m.quote === tab))
    .filter((m) => !q || m.base.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    .sort((a, b) => b.volumeUsd - a.volumeUsd)

  return (
    // Compact (phone): the wrapper goes static, so the list anchors to the
    // sticky header and spans the screen instead of hanging off the pair
    // button and running past the right edge.
    <div ref={wrap} className={cn("relative", compact && "max-lg:static")}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          setQuery("")
        }}
        className={cn("flex min-w-0 items-center rounded-2xl transition-colors", compact ? "gap-2 px-1 py-1" : "gap-3 px-2 py-1.5", open ? "bg-white/[0.06]" : "hover:bg-white/[0.04]")}
      >
        <CoinAvatar symbol={current.base} size="lg" className={cn("ring-1 ring-white/10", compact ? "size-8" : "size-10")} />
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className={cn("flex items-center gap-1.5 font-display font-semibold tracking-[-0.02em]", compact ? "text-[16px]" : "text-[18px]")}>
            {current.base}
            <span className="text-muted-foreground">/{venue === "futures" ? "USDT" : current.quote}</span>
            {venue === "futures" && !compact && <span className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-primary">Perp</span>}
          </span>
          {/* Compact (phone): the perp tag rides on the second line instead of
              widening the first one into the venue switch. */}
          <span className="truncate text-[12px] text-muted-foreground">
            {compact && venue === "futures" ? <span className="font-semibold text-primary">Perpetual · {(current as Perp).maxLeverage}×</span> : current.name}
          </span>
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
            className={cn(
              "absolute left-0 top-full z-40 mt-2 w-[min(420px,calc(100vw-40px))] origin-top-left rounded-2xl border border-white/[0.08] bg-[#131313]/98 p-2 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl",
              compact && "max-lg:inset-x-3 max-lg:mt-1 max-lg:w-auto",
            )}
          >
            <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 focus-within:border-primary/40">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground" />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={venue === "spot" ? "Search pairs" : "Search contracts"}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
            </label>
            {venue === "spot" && (
              <div className="mt-2 flex gap-1 px-1">
                {(["fav", "USDT", "BTC", "ETH"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn("relative h-7 rounded-lg px-2.5 text-[12px] font-semibold transition-colors", tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    {tab === t && <motion.span layoutId="picker-tab" transition={SLIDE} className="absolute inset-0 rounded-lg bg-primary/[0.1]" />}
                    <span className="relative flex items-center gap-1">
                      {t === "fav" ? <Icon icon={StarIcon} className="size-3.5" /> : t}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 grid grid-cols-[24px_minmax(0,1fr)_auto_72px] gap-2 px-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground">
              <span />
              <span>{venue === "spot" ? "Pair" : "Contract"}</span>
              <span className="text-right">Price</span>
              <span className="text-right">24h</span>
            </div>
            <ul role="listbox" className="slim-scroll max-h-[340px] overflow-y-auto">
              {list.length === 0 && <li className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">{tab === "fav" && !q ? "Star a pair to pin it here." : "No market matches."}</li>}
              {list.map((m) => {
                const fav = favs.includes(m.id)
                return (
                  <li key={m.id} className={cn("grid grid-cols-[24px_minmax(0,1fr)_auto_72px] items-center gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.05]", m.id === current.id && "bg-primary/[0.07]")}>
                    <button
                      type="button"
                      aria-label={fav ? `Unstar ${m.base}` : `Star ${m.base}`}
                      onClick={() => setFavs((f) => (fav ? f.filter((x) => x !== m.id) : [...f, m.id]))}
                      className={cn("flex size-6 items-center justify-center rounded-md", fav ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                    >
                      <Icon icon={StarIcon} className={cn("size-3.5", fav && "fill-primary")} />
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={m.id === current.id}
                      onClick={() => {
                        onPick(m.id)
                        setOpen(false)
                      }}
                      className="col-span-3 grid grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-2 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <CoinAvatar symbol={m.base} size="md" className="size-6" />
                        <span className="truncate text-[13px] font-semibold">
                          {m.base}
                          <span className="font-medium text-muted-foreground">/{venue === "futures" ? "USDT" : m.quote}</span>
                          {venue === "futures" && <span className="ml-1.5 text-[10.5px] font-semibold text-primary">{(m as Perp).maxLeverage}×</span>}
                        </span>
                      </span>
                      <span className="text-right text-[12.5px] font-medium tabular-nums">{formatPrice(m.price)}</span>
                      <span className={cn("text-right text-[12px] font-semibold tabular-nums", m.changePct >= 0 ? "text-credit" : "text-debit")}>
                        {m.changePct >= 0 ? "+" : "−"}
                        {Math.abs(m.changePct).toFixed(2)}%
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

/* ── Funding countdown ────────────────────────────────────────────────── */

function useCountdown(minutes: number) {
  const [left, setLeft] = React.useState(minutes * 60)
  React.useEffect(() => setLeft(minutes * 60), [minutes])
  React.useEffect(() => {
    const t = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 8 * 3600)), 1000)
    return () => window.clearInterval(t)
  }, [])
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/* ── Header ───────────────────────────────────────────────────────────── */

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-foreground">{children}</span>
    </div>
  )
}

export function PairHeader({
  venue,
  onVenue,
  market,
  perp,
  onPick,
}: {
  venue: Venue
  onVenue: (v: Venue) => void
  market: Market
  perp: Perp
  onPick: (id: string) => void
}) {
  const current = venue === "spot" ? market : perp
  const up = current.changePct >= 0
  const countdown = useCountdown(perp.fundingInMinutes)

  return (
    <Panel className="overflow-visible">
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-6 lg:pr-4">
        {/* Phone: the switch gets its own full-width row — beside the pair
            name it ran off the right edge of a 375px screen. */}
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 lg:hidden">
          {(["spot", "futures"] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={venue === v} onClick={() => onVenue(v)} className={cn("relative h-9 rounded-lg text-[13px] font-semibold capitalize", venue === v ? "text-primary-foreground" : "text-muted-foreground")}>
              {venue === v && <motion.span layoutId="venue-m" transition={SLIDE} className="dash-gold-btn absolute inset-0 rounded-lg" />}
              <span className="relative">{v}</span>
            </button>
          ))}
        </div>
        <MarketPicker venue={venue} current={current} onPick={onPick} />

        <div className="flex items-baseline gap-2.5 px-2 lg:flex-col lg:items-start lg:gap-0.5 lg:px-0">
          <motion.span key={current.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className={cn("font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums", up ? "text-credit" : "text-debit")}>
            {formatPrice(venue === "futures" ? perp.markPrice : market.price)}
          </motion.span>
          <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
            {up ? "+" : "−"}
            {Math.abs(current.changePct).toFixed(2)}%
          </span>
        </div>

        {/* Stats scroll sideways on narrow screens rather than wrapping into
            a ragged grid. */}
        <div className="scrollbar-none -mx-1 flex items-center gap-6 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-1 lg:px-0 lg:pb-0">
          {venue === "futures" ? (
            <>
              <Stat label="Mark">{formatPrice(perp.markPrice)}</Stat>
              <Stat label="Index">{formatPrice(perp.price)}</Stat>
              <Stat label="Funding / Countdown">
                <span className={perp.fundingPct >= 0 ? "text-credit" : "text-debit"}>
                  {perp.fundingPct >= 0 ? "+" : ""}
                  {perp.fundingPct.toFixed(4)}%
                </span>
                <span className="ml-1.5 text-muted-foreground">{countdown}</span>
              </Stat>
              <Stat label="Open interest">${formatCompact(perp.openInterestUsd)}</Stat>
              <Stat label="24h volume">${formatCompact(perp.volumeUsd)}</Stat>
            </>
          ) : (
            <>
              <Stat label="24h high">{formatPrice(market.high)}</Stat>
              <Stat label="24h low">{formatPrice(market.low)}</Stat>
              <Stat label="24h volume">${formatCompact(market.volumeUsd)}</Stat>
              <Stat label="Market cap">${formatCompact(market.marketCapUsd)}</Stat>
              <Stat label="Network">{market.chains[0]}</Stat>
            </>
          )}
          <Spark points={current.series} width={96} height={30} className="ml-auto hidden 2xl:block" />
        </div>

        <div role="tablist" className="hidden grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 lg:grid">
          {(["spot", "futures"] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={venue === v} onClick={() => onVenue(v)} className={cn("relative h-9 rounded-lg px-4 text-[13px] font-semibold capitalize transition-colors", venue === v ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {venue === v && <motion.span layoutId="venue-d" transition={SLIDE} className="dash-gold-btn absolute inset-0 rounded-lg" />}
              <span className="relative">{v}</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}
