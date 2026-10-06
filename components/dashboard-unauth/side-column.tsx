"use client"

/**
 * The right-hand column: act, discover, watch.
 *
 *  · Quick actions — the four verbs, one tap each. Deposit is the only gold
 *    disc because it is the only action a new account can take first.
 *  · Promo carousel — one message at a time, auto-advancing, paused while the
 *    pointer is on it so nothing slides out from under a click.
 *  · Top movers and market mood — what the market is doing right now.
 */

import * as React from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUpRight01Icon,
  CreditCardIcon,
  Download04Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES, walletHref, type WalletAction } from "@/components/preview/routes"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { GAINERS, LOSERS, MARKET_MOOD, NEW_LISTINGS, formatPrice, type Mover } from "@/components/dashboard-unauth/demo-data"
import { ChangeChip, Icon, MoreLink, Panel, PanelTitle, PillTabs, type IconSvg } from "@/components/redesign/ui"

/* ── Quick actions ─────────────────────────────────────────────────────────
   Four tiles in a 2×2 grid rather than a row of floating discs. A tile has
   room to say what the verb DOES ("Card, bank or P2P"), which a 12px label
   under a circle never did, and the grid holds its shape from a 360px phone
   to the 392px side column without anything wrapping. Deposit is the only
   gold tile: it is the one action a new account can take first. */

// Deposit / Withdraw / Transfer open the wallet's action panel on that tab.
// Buy Crypto opens its own page (not in the rail).
const ACTIONS: { label: string; hint: string; icon: IconSvg; action?: WalletAction; href?: string; primary?: boolean }[] = [
  { label: "Deposit", hint: "Crypto or cash", icon: Download04Icon, action: "deposit", primary: true },
  { label: "Buy Crypto", hint: "Card, bank or Dollar Account", icon: CreditCardIcon, href: PREVIEW_ROUTES.buy },
  { label: "Withdraw", hint: "To bank or wallet", icon: Upload04Icon, action: "withdraw" },
  { label: "Transfer", hint: "Spot ⇄ Futures", icon: ArrowLeftRightIcon, action: "transfer" },
]

export function QuickActions() {
  return (
    <Panel className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between px-0.5">
        <PanelTitle className="text-[16px]">Quick actions</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">No fees on deposits</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.action ? walletHref(a.action) : (a.href ?? "#")}
            className={cn(
              "group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-left outline-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-4",
              a.primary
                ? "dash-gold-tile text-primary-foreground"
                : "border border-white/[0.07] bg-white/[0.025] text-foreground hover:border-primary/30 hover:bg-primary/[0.04]",
            )}
          >
            {/* Corner glow — gold tiles carry a highlight, plain tiles warm on hover. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 size-24 rounded-full transition-opacity duration-300",
                a.primary
                  ? "bg-white/30 blur-2xl"
                  : "bg-primary/20 opacity-0 blur-2xl group-hover:opacity-100",
              )}
            />

            <span className="relative flex items-start justify-between">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-colors duration-300",
                  a.primary
                    ? "bg-black/[0.12] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
                    : "border border-white/[0.07] bg-white/[0.04] text-foreground/85 group-hover:border-primary/30 group-hover:text-primary",
                )}
              >
                <Icon icon={a.icon} className="size-[19px]" strokeWidth={a.primary ? 2 : 1.8} />
              </span>
              <Icon
                icon={ArrowUpRight01Icon}
                className={cn(
                  "size-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
                  a.primary ? "text-primary-foreground/70" : "text-muted-foreground/50 group-hover:text-primary",
                )}
                strokeWidth={2}
              />
            </span>

            <span className="relative mt-4 flex flex-col gap-0.5">
              <span className="text-[14.5px] font-semibold leading-tight tracking-[-0.01em]">{a.label}</span>
              <span className={cn("truncate text-[12px] font-medium", a.primary ? "text-primary-foreground/65" : "text-muted-foreground")}>
                {a.hint}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

/* ── Promo carousel ────────────────────────────────────────────────────── */

const SLIDES = [
  {
    title: "Trade Anytime, Anywhere",
    body: "Access 500+ cryptocurrencies with low fees and deep liquidity.",
    cta: "Trade now",
    art: "/illustrations/crypto-trade.png",
  },
  {
    title: "Swap in One Tap",
    body: "Move between any two coins across nine networks — no order book needed.",
    cta: "Try swap",
    art: "/illustrations/crypto-swap.png",
  },
  {
    title: "Buy Crypto with Card",
    body: "Visa, Mastercard and Apple Pay. Coins land in your wallet in minutes.",
    cta: "Buy now",
    art: "/illustrations/crypto-buy.png",
  },
]

const SLIDE_MS = 6000

export function PromoCarousel() {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [index, paused])

  const slide = SLIDES[index]

  return (
    <Panel
      className="dash-promo min-h-[196px]"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div aria-hidden className="absolute -right-16 top-1/2 size-72 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(250,204,21,0.2),transparent)]" />

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative grid h-full grid-cols-[minmax(0,1fr)_132px] items-center gap-2 p-6 pb-9"
          aria-live="polite"
        >
          <div className="flex min-w-0 flex-col items-start gap-2">
            <h3 className="font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{slide.title}</h3>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{slide.body}</p>
            <a
              href="#"
              className="group mt-2.5 inline-flex h-10 items-center gap-2 rounded-xl border border-primary/60 px-4 text-[13.5px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
            >
              {slide.cta}
              <Icon icon={ArrowRight02Icon} className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
            </a>
          </div>
          <motion.div
            initial={{ scale: 0.9, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative size-[132px]"
          >
            <Image src={slide.art} alt="" fill sizes="132px" className="animate-[dash-float_5s_ease-in-out_infinite] object-contain drop-shadow-[0_14px_28px_rgba(250,204,21,0.25)]" />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Dots double as a progress bar for the current slide. */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className={cn(
              "relative h-1.5 overflow-hidden rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              i === index ? "w-6 bg-white/15" : "w-1.5 bg-white/25 hover:bg-white/45",
            )}
          >
            {i === index && (
              <span
                key={`${index}-${paused}`}
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{
                  animation: `dash-progress ${SLIDE_MS}ms linear forwards`,
                  animationPlayState: paused ? "paused" : "running",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </Panel>
  )
}

/* ── Top movers ────────────────────────────────────────────────────────── */

type MoverTab = "gainers" | "losers" | "new"
const MOVER_DATA: Record<MoverTab, Mover[]> = { gainers: GAINERS, losers: LOSERS, new: NEW_LISTINGS }

export function TopMovers() {
  const [tab, setTab] = React.useState<MoverTab>("gainers")
  const rows = MOVER_DATA[tab]

  return (
    <Panel className="flex flex-col gap-4 px-5 pb-3 pt-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[17px]">Top Movers</PanelTitle>
        <MoreLink icon={ArrowRight01Icon}>View all</MoreLink>
      </div>

      <PillTabs
        id="movers"
        options={[
          { key: "gainers", label: "Gainers" },
          { key: "losers", label: "Losers" },
          { key: "new", label: "New Listings" },
        ]}
        value={tab}
        onChange={setTab}
        className="self-start"
      />

      <div>
        <div className="grid grid-cols-[22px_minmax(0,1fr)_auto_78px] items-center gap-3 border-b border-white/[0.06] px-1 pb-2.5 text-[12px] font-medium text-muted-foreground">
          <span>#</span>
          <span>Coin</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h Change</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={tab}
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{ show: { transition: { staggerChildren: 0.035 } }, hidden: {} }}
          >
            {rows.map((m, i) => (
              <motion.li
                key={m.symbol}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-[22px_minmax(0,1fr)_auto_78px] items-center gap-3 rounded-xl border-b border-white/[0.04] px-1 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025]"
              >
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <CoinAvatar symbol={m.symbol} size="lg" className="size-9 ring-1 ring-white/10" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold text-foreground">{m.symbol}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{m.name}</span>
                  </span>
                </span>
                <span className="text-right text-[13.5px] font-medium tabular-nums text-foreground">{formatPrice(m.price)}</span>
                <ChangeChip value={m.changePct} size="sm" className="justify-self-end" />
              </motion.li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </Panel>
  )
}

/* ── Market mood ───────────────────────────────────────────────────────── */

export function MarketMood() {
  const { score, label, yesterday, lastWeek } = MARKET_MOOD
  // A 180° arc, drawn with stroke-dasharray so it can animate in.
  const R = 70
  const arc = Math.PI * R
  const angle = Math.PI * (1 - score / 100)
  const knob = { x: 90 + R * Math.cos(angle), y: 86 - R * Math.sin(angle) }

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[17px]">Market Sentiment</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">Fear &amp; Greed</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-[180px] shrink-0">
          <svg viewBox="0 0 180 96" className="w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="mood-grad" x1="0" x2="1">
                <stop offset="0" stopColor="var(--debit)" />
                <stop offset="0.5" stopColor="var(--warning)" />
                <stop offset="1" stopColor="var(--credit)" />
              </linearGradient>
            </defs>
            <path d={`M ${90 - R} 86 A ${R} ${R} 0 0 1 ${90 + R} 86`} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="10" strokeLinecap="round" />
            <motion.path
              d={`M ${90 - R} 86 A ${R} ${R} 0 0 1 ${90 + R} 86`}
              fill="none"
              stroke="url(#mood-grad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={arc}
              initial={{ strokeDashoffset: arc }}
              animate={{ strokeDashoffset: arc * (1 - score / 100) }}
              transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.circle
              cx={knob.x}
              cy={knob.y}
              r="7"
              className="fill-foreground stroke-background"
              strokeWidth="3"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5, type: "spring", stiffness: 400, damping: 20 }}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{score}</span>
            <span className="mt-1 text-[12px] font-semibold text-credit">{label}</span>
          </div>
        </div>

        <dl className="flex flex-1 flex-col gap-3 text-[13px]">
          {[
            { k: "Yesterday", v: yesterday },
            { k: "Last week", v: lastWeek },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-2 border-b border-white/[0.05] pb-3 last:border-b-0 last:pb-0">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className="font-semibold tabular-nums">
                {r.v} <span className={cn("text-[11.5px] font-medium", r.v >= 55 ? "text-credit" : r.v >= 45 ? "text-warning" : "text-debit")}>{r.v >= 55 ? "Greed" : r.v >= 45 ? "Neutral" : "Fear"}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}
