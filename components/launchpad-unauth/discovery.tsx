"use client"

/**
 * Launchpad discovery.
 *
 * Built around the two things people come here to do, in that order:
 *   1. find something worth buying — so the page leads with the launch
 *      closest to graduation, then a filterable grid ranked by progress
 *   2. launch their own — so "Launch a token" is the hero's one gold button,
 *      and "How it works" explains the curve in three steps, not a manual
 *
 * Every card is a link to the token page; every figure on it comes from the
 * one curve function in launch-data.ts.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight02Icon, Cancel01Icon, Rocket01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { useAvailability } from "@/components/launchpad-unauth/availability"
import {
  GRADUATION_SOL,
  LAUNCHES,
  ago,
  fmtPct,
  fmtSol,
  fmtTinyUsd,
  fmtUsd,
  viewOf,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"
import { ChainChips, LaunchAvatar, ProgressBar, StatusPill, progressLabel } from "@/components/launchpad-unauth/ui"
import { Icon, Panel, PanelTitle, PillTabs, UnderlineTabs } from "@/components/redesign/ui"

const VIEWS = LAUNCHES.map(viewOf)
const NEAR_BPS = 7500

/* ── Hero ─────────────────────────────────────────────────────────────── */

/** The curve the hero draws — the real formula's shape, as decoration. */
function HeroCurve() {
  const pts = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39
    const x = t * 320
    const y = 150 - Math.pow(t, 1.9) * 130
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox="0 0 320 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="hero-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,160 ${pts.join(" ")} 320,160`} fill="url(#hero-curve-fill)" />
      <motion.polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
      />
      <line x1="300" y1="0" x2="300" y2="160" stroke="var(--credit)" strokeDasharray="3 4" opacity="0.6" />
      <text x="296" y="14" textAnchor="end" className="fill-credit text-[10px] font-semibold">
        Graduation
      </text>
      <motion.circle cx="190" cy={150 - Math.pow(190 / 320, 1.9) * 130} r="5" className="fill-primary" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} />
    </svg>
  )
}

export function DiscoveryHero() {
  const { solana } = useAvailability()
  const live = VIEWS.filter((v) => v.status === "live")
  const raised = VIEWS.reduce((s, v) => s + Math.min(v.solRaised, GRADUATION_SOL), 0)
  const graduated = VIEWS.filter((v) => v.status === "graduated").length

  return (
    <Panel className="relative">
      <div aria-hidden className="absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(250_204_21/0.12),transparent)]" />
      <div className="relative grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">Demo data</span>
            <ChainChips />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground md:text-[40px]">
              Launch a token in a minute.
              <br />
              <span className="text-primary">Trade it from the first second.</span>
            </h1>
            <p className="max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Every token starts on a bonding curve — the price rises as people buy. When the curve raises {GRADUATION_SOL} SOL it graduates to the open market with liquidity seeded automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {solana.state === "paused" ? (
              <span className="flex h-12 items-center rounded-xl border border-warning/30 bg-warning/[0.08] px-5 text-[14px] font-semibold text-warning">Launches paused</span>
            ) : (
              <Link href={`${PREVIEW_ROUTES.launchpad}/create`} className="dash-gold-btn group flex h-12 items-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold">
                <Icon icon={Rocket01Icon} className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
                Launch a token
              </Link>
            )}
            <a href="#how-it-works" className="flex h-12 items-center rounded-xl border border-white/[0.09] px-5 text-[14px] font-semibold text-foreground/85 transition-colors hover:border-white/[0.16] hover:text-foreground">
              How it works
            </a>
          </div>
          <dl className="grid max-w-[460px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]">
            {[
              { k: "On the curve", v: String(live.length) },
              { k: "SOL raised", v: Math.round(raised).toLocaleString("en-US") },
              { k: "Graduated", v: String(graduated) },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5 bg-[#111] px-4 py-3">
                <dd className="font-display text-[20px] font-semibold tabular-nums text-foreground">{s.v}</dd>
                <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="hidden h-[240px] lg:block">
          <HeroCurve />
        </div>
      </div>
    </Panel>
  )
}

/* ── Spotlight ────────────────────────────────────────────────────────── */

/** The live launch closest to graduation — the one with momentum. */
export function Spotlight() {
  const top = [...VIEWS].filter((v) => v.status === "live").sort((a, b) => b.progressBps - a.progressBps)[0]
  if (!top) return null
  return (
    <Link href={`${PREVIEW_ROUTES.launchpad}/${top.id}`} className="group block">
      <Panel className="dash-lift relative">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_50%,rgb(250_204_21/0.08),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-8 md:p-6">
          <div className="flex items-center gap-4">
            <LaunchAvatar launch={top} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Closest to graduation</span>
              <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                {top.name} <span className="text-muted-foreground">${top.symbol}</span>
              </span>
              <span className="line-clamp-1 text-[13px] text-muted-foreground">{top.description}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-semibold tabular-nums text-foreground">
                {fmtSol(Math.min(top.solRaised, GRADUATION_SOL), 1)} <span className="font-medium text-muted-foreground">of {GRADUATION_SOL} SOL</span>
              </span>
              <span className="font-display text-[18px] font-semibold tabular-nums text-primary">{progressLabel(top.progressBps, top.status)}</span>
            </div>
            <ProgressBar bps={top.progressBps} status={top.status} size="lg" />
            <span className="text-[12px] text-muted-foreground">{fmtSol(top.remainingSol, 1)} to go · market cap {fmtUsd(top.marketCapUsd)}</span>
          </div>
          <span className="flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-primary/50 px-4 text-[13.5px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground md:self-center">
            Trade
            <Icon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </span>
        </div>
      </Panel>
    </Link>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────── */

export function LaunchCard({ launch: v, preview = false }: { launch: LaunchView; preview?: boolean }) {
  const live = v.status === "live"
  const pct = live ? v.progressBps / 100 : 100
  const body = (
    <Panel as="article" className={cn("flex h-full flex-col", !preview && "dash-lift group-hover:border-white/[0.13]")}>
      {/* Identity, with the number buyers compare first — market cap — given
          its own weight on the right instead of a phrase in small print. */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <LaunchAvatar launch={v} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-display text-[16px] font-semibold leading-tight text-foreground">{v.name}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">${v.symbol}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{v.minutesAgo < 0 ? "Not launched" : ago(v.minutesAgo)}</span>
          </span>
          {!live && <StatusPill status={v.status} className="mt-0.5 w-fit" />}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Mkt cap</span>
          <span className="font-display text-[17px] font-semibold tabular-nums text-foreground">{fmtUsd(v.marketCapUsd)}</span>
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2.8em] px-4 text-[13px] leading-[1.4] text-muted-foreground">{v.description}</p>

      {/* Progress is the story of a curve launch, so it gets a real figure. */}
      <div className="mt-auto flex flex-col gap-2 px-4 pb-4 pt-4">
        <div className="flex items-end justify-between gap-2">
          <span className={cn("font-display text-[22px] font-semibold leading-none tabular-nums", !live ? "text-credit" : pct >= NEAR_BPS / 100 ? "text-primary" : "text-foreground")}>
            {live ? `${pct.toFixed(pct < 10 ? 1 : 0)}%` : v.status === "graduating" ? "Full" : "Graduated"}
          </span>
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {live ? (
              <>
                <span className="font-semibold text-foreground/85">{Math.min(v.solRaised, GRADUATION_SOL).toFixed(1)}</span> / {GRADUATION_SOL} SOL
              </>
            ) : (
              "On the open market"
            )}
          </span>
        </div>
        <ProgressBar bps={v.progressBps} status={v.status} />
      </div>

      <dl className="grid grid-cols-3 divide-x divide-white/[0.05] border-t border-white/[0.06] bg-white/[0.015] text-[12px]">
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5">
          <dt className="text-[10.5px] text-muted-foreground">Price</dt>
          <dd className="truncate font-semibold tabular-nums text-foreground">{fmtTinyUsd(v.priceUsd)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5" title="Share of curve supply the creator bought at launch">
          <dt className="text-[10.5px] text-muted-foreground">Creator</dt>
          <dd className={cn("font-semibold tabular-nums", v.creatorBps >= 1000 ? "text-warning" : "text-foreground")}>{fmtPct(v.creatorBps)}</dd>
        </div>
        {/* Names and tickers can repeat on Solana; the mint can't. */}
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5" title={v.mint || "Assigned at launch"}>
          <dt className="text-[10.5px] text-muted-foreground">Mint</dt>
          <dd className="truncate font-mono text-[11.5px] text-foreground/85">{v.mint ? `${v.mint.slice(0, 4)}…${v.mint.slice(-4)}` : "At launch"}</dd>
        </div>
      </dl>
    </Panel>
  )
  if (preview) return body
  return (
    <Link href={`${PREVIEW_ROUTES.launchpad}/${v.id}`} className="group block h-full">
      {body}
    </Link>
  )
}

/* ── Browser (filters + grid) ─────────────────────────────────────────── */

type Filter = "trending" | "near" | "new" | "graduated"
type Sort = "progress" | "newest" | "cap"

export function LaunchBrowser() {
  const [filter, setFilter] = React.useState<Filter>("trending")
  const [sort, setSort] = React.useState<Sort>("progress")
  const [query, setQuery] = React.useState("")

  const q = query.trim().toLowerCase()
  const count = (f: Filter) => VIEWS.filter((v) => match(v, f)).length
  function match(v: LaunchView, f: Filter) {
    if (f === "near") return v.status === "live" && v.progressBps >= NEAR_BPS
    if (f === "new") return v.status === "live" && v.minutesAgo < 240
    if (f === "graduated") return v.status !== "live"
    return v.status === "live"
  }
  const rows = VIEWS.filter((v) => match(v, filter))
    .filter((v) => !q || v.name.toLowerCase().includes(q) || v.symbol.toLowerCase().includes(q))
    .sort((a, b) => (sort === "progress" ? b.progressBps - a.progressBps : sort === "newest" ? a.minutesAgo - b.minutesAgo : b.marketCapUsd - a.marketCapUsd))

  const tabs: { key: Filter; label: string }[] = [
    { key: "trending", label: "On the curve" },
    { key: "near", label: "Near graduation" },
    { key: "new", label: "New" },
    { key: "graduated", label: "Graduated" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="border-b border-white/[0.06] lg:flex-1">
          <UnderlineTabs
            id="lp-filter"
            className="scrollbar-none overflow-x-auto"
            options={tabs.map((t) => ({
              key: t.key,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {t.label}
                  <span className="rounded-md bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{count(t.key)}</span>
                </span>
              ),
            }))}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="flex items-center gap-2.5 lg:pb-2">
          <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 transition-colors focus-within:border-primary/40 lg:w-[240px] lg:flex-none">
            <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
            <span className="sr-only">Search launches</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ticker" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <Icon icon={Cancel01Icon} className="size-4" />
              </button>
            )}
          </label>
          <PillTabs
            id="lp-sort"
            size="sm"
            options={[
              { key: "progress", label: "Progress" },
              { key: "newest", label: "Newest" },
              { key: "cap", label: "Cap" },
            ]}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">{q ? `Nothing matches “${query}”` : "Nothing here yet"}</p>
          <p className="text-[13px] text-muted-foreground">{q ? "Try another name or ticker." : "Check another tab, or launch the first one."}</p>
        </Panel>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((v, i) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                <LaunchCard launch={v} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

/* ── How it works ─────────────────────────────────────────────────────── */

const STEPS = [
  { n: "01", title: "Create", body: "Name, ticker, icon and an optional creator allocation. One transaction, about 0.04 SOL plus your allocation." },
  { n: "02", title: "Trade on the curve", body: "Anyone can buy or sell from the first second. The price rises as supply is bought — no order book, always liquid." },
  { n: "03", title: "Graduate", body: `At ${GRADUATION_SOL} SOL the curve closes and the raised SOL plus a reserve seed an open-market pool. Trading continues there.` },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-6">
      <Panel className="p-5 md:p-6">
        <PanelTitle className="mb-4 text-[17px]">How it works</PanelTitle>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <span className="font-display text-[13px] font-semibold tabular-nums text-primary">{s.n}</span>
              <span className="text-[15px] font-semibold text-foreground">{s.title}</span>
              <span className="text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</span>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-[#121212] text-primary md:flex">
                  <Icon icon={ArrowRight02Icon} className="size-3" strokeWidth={2.2} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </section>
  )
}
