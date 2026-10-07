"use client"

/**
 * The right-hand column: act, then watch. Copied from the preview
 * (components/dashboard-unauth/side-column.tsx) on real data.
 *
 *  · Quick actions — the preview's four tiles. Deposit and Withdraw open the
 *    wallet's receive and send dialogs (the surfaces the old action rail
 *    opened), Buy Crypto goes to /buy, Transfer goes to /trade where the
 *    Spot ⇄ Futures funding panel lives (a deep link into it is a logged
 *    follow-up). Subtitles say what each does. The "No fees on deposits"
 *    note is not shown: nothing confirms it.
 *  · Promo carousel — the preview's, with copy rewritten to claim only what
 *    the app does, each slide linking to its page.
 *  · Top movers — market-wide gainers and losers from the price feed. The
 *    New Listings tab is there as in the preview, showing its empty state (no
 *    listing dates exist anywhere in the app). When the feed has no 24h
 *    changes, the list says so instead of ranking zeroes.
 *  · Market sentiment — today's Fear & Greed reading: /insights' own, else
 *    the public alternative.me index (data.tsx useFearGreed), with the
 *    preview's Yesterday / Last week rows from the index's past readings. The
 *    panel waits with a skeleton, and says so when there is no reading.
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
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { SendModal } from "@/components/crypto/SendModal"
import { formatPrice } from "@/components/dashboard/redesign/format"
import { useDashboardData } from "@/components/dashboard/redesign/data"
import { ChangeChip, Icon, MoreLink, Panel, PanelTitle, PillTabs, type IconSvg } from "@/components/dashboard/redesign/ui"

type Mover = { symbol: string; name: string; price: number; changePct: number; image?: string }

/* ── Quick actions ─────────────────────────────────────────────────────────
   Four tiles in a 2×2 grid rather than a row of floating discs. A tile has
   room to say what the verb DOES ("Card, bank or P2P"), which a 12px label
   under a circle never did, and the grid holds its shape from a 360px phone
   to the 392px side column without anything wrapping. Deposit is the only
   gold tile: it is the one action a new account can take first. */

// Deposit / Withdraw open the wallet's own receive and send dialogs; Buy
// Crypto and Transfer are pages. Vivid targets are the old action rail's.
const ACTIONS: {
  label: string
  hint: string
  icon: IconSvg
  open?: "receive" | "send"
  href?: string
  primary?: boolean
  vivid?: { target: string; label: string }
}[] = [
  { label: "Deposit", hint: "Your wallet addresses", icon: Download04Icon, open: "receive", primary: true, vivid: { target: "open-deposit", label: "Show your wallet addresses to deposit crypto" } },
  { label: "Buy Crypto", hint: "Local currency or USD", icon: CreditCardIcon, href: "/buy", vivid: { target: "go-fiat-buy", label: "Buy crypto with African local currency or USD" } },
  { label: "Withdraw", hint: "Send to a wallet", icon: Upload04Icon, open: "send", vivid: { target: "open-send", label: "Send crypto out of your wallet" } },
  { label: "Transfer", hint: "Spot ⇄ Futures", icon: ArrowLeftRightIcon, href: "/trade" },
]

export function QuickActions() {
  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)
  return (
    <Panel className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between px-0.5">
        <PanelTitle className="text-[16px]">Quick actions</PanelTitle>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {ACTIONS.map((a) => {
          const className = cn(
              "group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-left outline-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-4",
              a.primary
                ? "ds-gold text-primary-foreground"
                : "border border-foreground/[0.07] bg-foreground/[0.025] text-foreground hover:border-primary/30 hover:bg-primary/[0.04]",
            )
          const vivid = a.vivid ? { "data-vivid-target": a.vivid.target, "data-vivid-label": a.vivid.label } : {}
          const tile = (
            <>
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
                    : "border border-foreground/[0.07] bg-foreground/[0.04] text-foreground/85 group-hover:border-primary/30 group-hover:text-primary",
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
            </>
          )
          return a.href ? (
            <Link key={a.label} href={a.href} className={className} {...vivid}>
              {tile}
            </Link>
          ) : (
            <button
              key={a.label}
              type="button"
              onClick={() => (a.open === "receive" ? setReceiveOpen(true) : setSendOpen(true))}
              className={className}
              {...vivid}
            >
              {tile}
            </button>
          )
        })}
      </div>
      {/* The wallet's own receive and send dialogs, mounted once. */}
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
      <SendModal open={sendOpen} onOpenChange={setSendOpen} />
    </Panel>
  )
}

/* ── Promo carousel ────────────────────────────────────────────────────────
   The preview's carousel, with copy that only claims what the app does (the
   preview's slides promised card, Visa / Mastercard / Apple Pay and 500+
   coins). Each button goes to the real page it names. */

const SLIDES = [
  {
    title: "Trade Anytime, Anywhere",
    body: "Spot and futures markets with live prices, straight from your wallet.",
    cta: "Trade now",
    href: "/trade",
    art: "/illustrations/crypto-trade.png",
  },
  {
    title: "Swap in One Tap",
    body: "Exchange one coin for another — no order book needed.",
    cta: "Try swap",
    href: "/swap",
    art: "/illustrations/crypto-swap.png",
  },
  {
    title: "Buy Crypto Your Way",
    body: "Pay in your local currency or USD. Coins land in your Worldstreet wallet.",
    cta: "Buy now",
    href: "/buy",
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
      // A fixed height, not a minimum: slides with longer copy must not make
      // the panel (and everything under it) jump as the carousel advances.
      // Sized for the longest slide at the narrowest column; the title and
      // body clamp so no slide can push past it.
      className="ds-promo h-[240px]"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div aria-hidden className="absolute -right-16 top-1/2 size-72 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_20%,transparent),transparent)]" />

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
            <h3 className="line-clamp-2 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{slide.title}</h3>
            <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{slide.body}</p>
            <Link
              href={slide.href}
              className="group mt-2.5 inline-flex h-10 items-center gap-2 rounded-xl border border-primary/60 px-4 text-[13.5px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
            >
              {slide.cta}
              <Icon icon={ArrowRight02Icon} className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </div>
          <motion.div
            initial={{ scale: 0.9, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative size-[132px]"
          >
            <Image src={slide.art} alt="" fill sizes="132px" className="animate-[dash-float_5s_ease-in-out_infinite] object-contain drop-shadow-[0_14px_28px_color-mix(in_oklab,var(--primary)_25%,transparent)]" />
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
              "relative h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              i === index ? "w-6 bg-foreground/15" : "w-1.5 bg-foreground/25 hover:bg-foreground/45",
            )}
          >
            {/* The fill slides in on `transform` (compositor-only, so it stays
                smooth while the page is still loading) instead of animating
                `width`. Keyed by the slide only: pausing freezes it in place
                rather than remounting it back to empty. */}
            {i === index && (
              <span
                key={index}
                className="ds-progress absolute inset-0 rounded-full bg-primary"
                style={{
                  animationDuration: `${SLIDE_MS}ms`,
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
const MOVERS_SHOWN = 5

export function TopMovers() {
  const { coins } = useDashboardData()
  const [tab, setTab] = React.useState<MoverTab>("gainers")
  const priced = coins.filter((c) => c.price > 0 && Number.isFinite(c.change24h))
  /* The 24h figure comes from an enrichment that is often absent; then every
     coin reads 0 and a "ranking" would be invented. */
  const hasMoves = priced.some((c) => c.change24h !== 0)
  const rows: Mover[] = [...priced]
    .filter((c) => (tab === "gainers" ? c.change24h > 0 : c.change24h < 0))
    .sort((a, b) => (tab === "gainers" ? b.change24h - a.change24h : a.change24h - b.change24h))
    .slice(0, MOVERS_SHOWN)
    .map((c) => ({ symbol: c.symbol, name: c.name, price: c.price, changePct: c.change24h, image: c.image }))

  return (
    <Panel className="flex flex-col gap-4 px-5 pb-3 pt-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[17px]">Top Movers</PanelTitle>
        <MoreLink icon={ArrowRight01Icon} href="/trading/markets">View all</MoreLink>
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
        <div className="grid grid-cols-[22px_minmax(0,1fr)_auto_78px] items-center gap-3 border-b border-foreground/[0.06] px-1 pb-2.5 text-[12px] font-medium text-muted-foreground">
          <span>#</span>
          <span>Coin</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h Change</span>
        </div>
        {/* Not in the preview: the feed has no 24h changes, or nothing moved this way. */}
        {tab === "new" ? (
          // No listing dates exist anywhere in the app, so there is nothing to rank.
          <p className="px-1 py-8 text-center text-[13px] text-muted-foreground">New listings aren&apos;t available yet.</p>
        ) : !hasMoves || rows.length === 0 ? (
          <p className="px-1 py-8 text-center text-[13px] text-muted-foreground">
            {!hasMoves ? "24-hour changes aren't available right now." : tab === "gainers" ? "Nothing is up in the last 24 hours." : "Nothing is down in the last 24 hours."}
          </p>
        ) : (
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
                className="grid grid-cols-[22px_minmax(0,1fr)_auto_78px] items-center gap-3 rounded-xl border-b border-foreground/[0.04] px-1 py-3 transition-colors last:border-b-0 hover:bg-foreground/[0.025]"
              >
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <CoinAvatar symbol={m.symbol} src={m.image} size="lg" className="size-9 ring-1 ring-foreground/10" />
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
        )}
      </div>
    </Panel>
  )
}

/* ── Market mood ───────────────────────────────────────────────────────── */

export function MarketMood() {
  const { fearGreed } = useDashboardData()
  const reading = fearGreed ?? null
  const score = reading?.value ?? 0
  const label = reading?.classification ?? ""
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

      {fearGreed === undefined ? (
        // Not in the preview: the reading is still on its way.
        <div className="flex items-center gap-5" aria-hidden>
          <span className="skel h-[96px] w-[180px] shrink-0 rounded-t-full" />
          <span className="flex flex-col gap-2">
            <span className="skel h-7 w-12 rounded" />
            <span className="skel h-4 w-20 rounded" />
          </span>
        </div>
      ) : !reading ? (
        // Not in the preview: no reading from either source.
        <p className="py-8 text-center text-[13px] text-muted-foreground">Market sentiment isn&apos;t available right now.</p>
      ) : (
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
            <path d={`M ${90 - R} 86 A ${R} ${R} 0 0 1 ${90 + R} 86`} fill="none" stroke="color-mix(in oklab, var(--foreground) 6%, transparent)" strokeWidth="10" strokeLinecap="round" />
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
            <span className={cn("mt-1 text-[12px] font-semibold", score >= 55 ? "text-credit" : score >= 45 ? "text-warning" : "text-debit")}>{label}</span>
          </div>
        </div>

        {/* The preview's Yesterday / Last week rows, from the index's own past
            readings and labels. A row the index has no reading for is left out. */}
        {(reading.yesterday || reading.lastWeek) && (
          <dl className="flex flex-1 flex-col gap-3 text-[13px]">
            {[
              { k: "Yesterday", r: reading.yesterday },
              { k: "Last week", r: reading.lastWeek },
            ]
              .filter((row): row is { k: string; r: { value: number; classification: string } } => Boolean(row.r))
              .map(({ k, r }) => (
                <div key={k} className="flex items-center justify-between gap-2 border-b border-foreground/[0.05] pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums">
                    {r.value}{" "}
                    <span className={cn("text-[11.5px] font-medium", r.value >= 55 ? "text-credit" : r.value >= 45 ? "text-warning" : "text-debit")}>{r.classification}</span>
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </div>
      )}
    </Panel>
  )
}
