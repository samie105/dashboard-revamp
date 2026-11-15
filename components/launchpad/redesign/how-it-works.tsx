"use client"

/**
 * "How a launch works", drawn as the thing itself: one bonding curve across
 * the section, split into its three stages (launch at the origin, trading
 * along the curve, graduation at the target into a locked pool).
 *
 * A price dot plays a launch's life: the creator's buy, buys pushing the
 * price up, a sell pulling it back, the curve filling and its liquidity
 * pouring into the pool, which locks. The stage the dot is in lights up on
 * the curve and in its note below, with a line showing how far through the
 * stage it is.
 *
 * It's interactive: hover or drag across the curve to scrub; pick a stage to
 * jump to it. Autoplay resumes a few seconds after the last touch.
 *
 * The drawing carries no figures except the graduation target, which is the
 * real one when the board has read it (the readout's "x / target SOL" is the
 * target times the curve's progress). The loop plays only while on screen and
 * not at all under prefers-reduced-motion (the curve is then drawn complete;
 * scrubbing and the stage buttons still work).
 */

import * as React from "react"
import Link from "next/link"
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react"
import { ArrowRight02Icon, SquareLock02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/dashboard/redesign/ui"
import { TokenArt } from "@/components/launchpad-unauth/token-art"
import { cn } from "@/lib/utils"

/* ── Geometry ─────────────────────────────────────────────────────────── */

/** Where the stages meet, as a share of the track's width. */
const LAUNCH_END = 0.3
const TARGET = 0.72
const ZONES = [
  [0, LAUNCH_END],
  [LAUNCH_END, TARGET],
  [TARGET, 1],
] as const

/** Price along the curve, 0–1, for a position 0–1 of the curve (a bonding curve's convex rise). */
const shape = (x: number) => (Math.pow(1 + 2.4 * x, 2) - 1) / (Math.pow(3.4, 2) - 1)
/** Height on the track (0 bottom – 1 top) at a horizontal position p (0–1); flat after the target. */
const level = (p: number) => shape(Math.min(1, p / TARGET))

// The track's vertical frame, in % of its height.
const TOP = 16
const SPAN = 68
const yPct = (p: number) => TOP + (1 - level(p)) * SPAN

const curvePath = Array.from({ length: 49 }, (_, i) => (i / 48) * TARGET)
  .map((p, i) => `${i ? "L" : "M"}${(p * 1000).toFixed(1)},${(yPct(p) * 2).toFixed(1)}`)
  .join(" ")
const BASE_Y = (TOP + SPAN) * 2

/* ── The story: time (0–1) → position on the curve ────────────────────── */

// Up the curve, a sell pulls it back, up to the target, then into the pool; hold.
const T_KEYS = [0, 0.38, 0.45, 0.82, 0.92, 1]
const P_KEYS = [0, 0.4, 0.355, TARGET, 1, 1]
const LOOP_S = 11

/** The time at which the story first reaches position x (for scrubbing). */
function timeAt(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  if (v <= P_KEYS[2]!) return (v / P_KEYS[1]!) * T_KEYS[1]!
  if (v <= TARGET) return T_KEYS[2]! + ((v - P_KEYS[2]!) / (TARGET - P_KEYS[2]!)) * (T_KEYS[3]! - T_KEYS[2]!)
  return T_KEYS[3]! + ((v - TARGET) / (1 - TARGET)) * (T_KEYS[4]! - T_KEYS[3]!)
}
const posAt = (t: number): number => {
  for (let i = 1; i < T_KEYS.length; i++) {
    if (t <= T_KEYS[i]!) {
      const a = T_KEYS[i - 1]!
      const f = (t - a) / (T_KEYS[i]! - a || 1)
      return P_KEYS[i - 1]! + f * (P_KEYS[i]! - P_KEYS[i - 1]!)
    }
  }
  return 1
}

/** Where each stage button sends the dot (time). */
const STAGE_T = [0.07, 0.62, 0.95]

type Phase = 0 | 1 | 2
const phaseOf = (p: number): Phase => (p < LAUNCH_END ? 0 : p < TARGET ? 1 : 2)

const EVENTS: { t: number; label: string; tone: "creator" | "buy" | "sell" }[] = [
  { t: 0.05, label: "Creator +0.3 SOL", tone: "creator" },
  { t: 0.2, label: "+0.8 SOL", tone: "buy" },
  { t: 0.32, label: "+1.5 SOL", tone: "buy" },
  { t: 0.415, label: "−0.6 SOL", tone: "sell" },
  { t: 0.6, label: "+2.4 SOL", tone: "buy" },
  { t: 0.73, label: "+3.1 SOL", tone: "buy" },
]

const STEPS = [
  { n: "01", title: "Launch", body: "Name, ticker, icon. Buy a share yourself if you want. One transaction, signed on this device, and it's live.", fact: "The creator buys on the same curve as everyone" },
  { n: "02", title: "Trade on the curve", body: "From the first second anyone can buy or sell. Buys push the price up the curve, sells bring it down. No order book, so there's always a price.", fact: "The price is set by the curve, not by anyone" },
  { n: "03", title: "Graduate", body: "When the target is raised the curve closes and its SOL seeds an open-market pool. That liquidity is locked: nobody can pull it, the creator included.", fact: "Liquidity locked for good" },
] as const

/* ── Pieces ───────────────────────────────────────────────────────────── */

function Event({ t, e }: { t: MotionValue<number>; e: (typeof EVENTS)[number] }) {
  const x = posAt(e.t)
  const opacity = useTransform(t, [e.t - 0.015, e.t, e.t + 0.06, e.t + 0.085], [0, 1, 1, 0])
  const y = useTransform(t, [e.t - 0.015, e.t + 0.085], [8, -10])
  return (
    <motion.span
      className={cn(
        "absolute -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums",
        e.tone === "sell" ? "bg-debit/[0.15] text-debit" : e.tone === "creator" ? "bg-primary/[0.16] text-primary" : "bg-credit/[0.14] text-credit",
      )}
      style={{ left: `max(${x * 100}%, 52px)`, top: `calc(${yPct(x)}% - 32px)`, opacity, y }}
    >
      {e.label}
    </motion.span>
  )
}

function ZoneBand({ i, phase }: { i: number; phase: Phase | null }) {
  const [a, b] = ZONES[i]!
  return (
    <span
      className={cn("absolute -bottom-5 -top-6 transition-colors duration-500", phase === i ? (i === 2 ? "bg-credit/[0.035]" : "bg-primary/[0.035]") : "bg-transparent")}
      style={{ left: i === 0 ? "calc(-1 * var(--hiw-pad))" : `${a * 100}%`, right: i === 2 ? "calc(-1 * var(--hiw-pad))" : `${(1 - b) * 100}%` }}
    />
  )
}

function StageNote({ i, p, phase, onPick }: { i: number; p: MotionValue<number>; phase: Phase | null; onPick: (i: number) => void }) {
  const s = STEPS[i]!
  const [a, b] = ZONES[i]!
  const fill = useTransform(p, (v) => Math.max(0, Math.min(1, (v - a) / (b - a))))
  const active = phase === i
  const lit = phase === null || active
  return (
    <li className={cn(i < 2 && "lg:pr-8")}>
      <button
        type="button"
        onClick={() => onPick(i)}
        aria-pressed={active}
        className="group flex w-full flex-col rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-4 focus-visible:ring-offset-card"
      >
        <span className="relative block h-[2px] w-full overflow-hidden rounded-full bg-foreground/[0.07]">
          <motion.span className={cn("absolute inset-0 origin-left rounded-full", i === 2 ? "bg-credit" : "bg-primary")} style={{ scaleX: fill }} />
        </span>
        <span className="mt-4 flex items-baseline gap-2">
          <span className={cn("font-mono text-[11.5px] font-semibold tabular-nums transition-colors duration-300", active ? (i === 2 ? "text-credit" : "text-primary") : "text-muted-foreground/70")}>{s.n}</span>
          <span className={cn("font-display text-[17px] font-semibold tracking-[-0.02em] transition-colors duration-300 group-hover:text-foreground", lit ? "text-foreground" : "text-foreground/60")}>{s.title}</span>
        </span>
        <span className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.body}</span>
        <span className="mt-3 text-[12px] font-medium text-foreground/75">{s.fact}</span>
      </button>
    </li>
  )
}

/* ── The section ──────────────────────────────────────────────────────── */

export function HowItWorks({ target, paused }: { target: number | null; paused: boolean }) {
  const reduce = Boolean(useReducedMotion())
  const track = React.useRef<HTMLDivElement>(null)
  const plot = React.useRef<HTMLDivElement>(null)
  const inView = useInView(track, { margin: "-60px" })
  const t = useMotionValue(reduce ? 1 : 0)
  const p = useTransform(t, posAt)
  const [phase, setPhase] = React.useState<Phase>(reduce ? 2 : 0)
  const [held, setHeld] = React.useState(false)
  const run = React.useRef<AnimationPlaybackControls | null>(null)
  const resume = React.useRef<number | undefined>(undefined)

  // Autoplay: loop the story while visible, unless the viewer is holding it.
  React.useEffect(() => {
    if (reduce || !inView || held) return
    const from = t.get() >= 0.999 ? 0 : t.get()
    const first = animate(t, [from, 1], { duration: LOOP_S * (1 - from), ease: "linear" })
    let loop: AnimationPlaybackControls | null = null
    first.then(() => {
      loop = animate(t, [0, 1], { duration: LOOP_S, ease: "linear", repeat: Infinity, repeatDelay: 1.2 })
      run.current = loop
    })
    run.current = first
    return () => {
      first.stop()
      loop?.stop()
    }
  }, [reduce, inView, held, t])

  React.useEffect(() => () => window.clearTimeout(resume.current), [])

  useMotionValueEvent(p, "change", (v) => {
    const next = phaseOf(v)
    if (next !== phase) setPhase(next)
  })

  const hold = (release: number) => {
    setHeld(true)
    run.current?.stop()
    window.clearTimeout(resume.current)
    if (!reduce) resume.current = window.setTimeout(() => setHeld(false), release)
  }

  const scrubTo = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect()
    if (!box) return
    hold(2500)
    t.set(timeAt((clientX - box.left) / box.width))
  }

  const pick = (i: number) => {
    hold(5000)
    if (reduce) t.set(STAGE_T[i]!)
    else animate(t, STAGE_T[i]!, { duration: 0.7, ease: [0.22, 1, 0.36, 1] })
  }

  const shown: Phase | null = reduce && !held ? null : phase
  const clip = useTransform(p, (v) => `inset(0 ${(100 - Math.min(v, TARGET) * 100).toFixed(2)}% 0 0)`)
  const dotLeft = useTransform(p, (v) => `${v * 100}%`)
  const dotTop = useTransform(p, (v) => `${yPct(v)}%`)
  const pour = useTransform(p, [TARGET, 1], [0, 1])
  // The dot pours into the pool at the target rather than sitting on it.
  const dotOpacity = useTransform(p, [TARGET, TARGET + 0.06], [1, 0])
  const readout = useTransform(p, (v) => {
    const pct = Math.min(1, v / TARGET)
    if (v >= TARGET) return target !== null ? `${target.toLocaleString("en-US")} SOL raised · curve closed` : "Target raised · curve closed"
    return target !== null ? `${Math.round(pct * 100)}% · ${(pct * target).toFixed(1)} / ${target.toLocaleString("en-US")} SOL` : `${Math.round(pct * 100)}% of the target`
  })
  const graduated = shown === null || shown === 2

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="mt-2 flex scroll-mt-6 flex-col gap-6 border-t border-foreground/[0.06] pt-10 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex flex-col gap-2">
          <h2 id="how-it-works-title" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">How a launch works</h2>
          <p className="text-[13px] text-muted-foreground">Same curve, same rules for every token, the creator included. Drag across the curve to play it.</p>
        </div>
        {!paused && (
          <Link href="/launchpad/create" className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            Launch a token
            <Icon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        )}
      </div>

      <div className="ds-panel overflow-hidden rounded-[22px]">
        {/* The curve. Decorative: the notes below say the same in words. */}
        <div
          ref={track}
          aria-hidden
          className="relative h-[232px] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden [--hiw-pad:16px] md:h-[272px] md:[--hiw-pad:24px]"
          onPointerMove={(e) => scrubTo(e.clientX)}
          onPointerDown={(e) => scrubTo(e.clientX)}
        >
          <div ref={plot} className="absolute inset-x-[var(--hiw-pad)] bottom-5 top-6">
            {[0, 1, 2].map((i) => <ZoneBand key={i} i={i} phase={shown} />)}
            {[LAUNCH_END, TARGET].map((x) => (
              <span key={x} className={cn("absolute bottom-[12%] top-[10%] w-px", x === TARGET ? "bg-[repeating-linear-gradient(to_bottom,var(--credit)_0_4px,transparent_4px_8px)] opacity-70" : "bg-foreground/[0.07]")} style={{ left: `${x * 100}%` }} />
            ))}
            <span className="absolute top-0 hidden -translate-x-full whitespace-nowrap pr-2 text-[10.5px] sm:block font-semibold tabular-nums text-credit" style={{ left: `${TARGET * 100}%` }}>
              {target !== null ? `${target.toLocaleString("en-US")} SOL target` : "Target"}
            </span>

            <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <line x1="0" x2="1000" y1={BASE_Y} y2={BASE_Y} className="stroke-foreground/10" vectorEffect="non-scaling-stroke" />
              <path d={curvePath} fill="none" className="stroke-foreground/20" strokeWidth="2" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
            </svg>
            <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
              <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                <defs>
                  <linearGradient id="hiw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={`${curvePath} L${TARGET * 1000},${BASE_Y} L0,${BASE_Y} Z`} fill="url(#hiw-fill)" />
                <path d={curvePath} fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </motion.div>

            {/* Past the target: the pool. It fills as the curve's SOL pours in, then locks. */}
            <div className="absolute flex flex-col" style={{ left: `calc(${TARGET * 100}% + 16px)`, right: 0, top: `calc(${yPct(1)}% - 18px)`, height: 96 }}>
              <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border transition-colors duration-500", graduated ? "border-credit/45" : "border-foreground/[0.1] border-dashed")}>
                <motion.span className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-[linear-gradient(to_top,color-mix(in_oklab,var(--credit)_32%,transparent),color-mix(in_oklab,var(--credit)_8%,transparent))]" style={{ scaleY: pour }} />
                <span className="relative flex items-center justify-center gap-2 px-2.5 pt-2.5 sm:justify-start">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-500", graduated ? "bg-credit text-white" : "bg-foreground/[0.06] text-muted-foreground")}>
                    <Icon icon={SquareLock02Icon} className="size-4" strokeWidth={2} />
                  </span>
                  <span className="hidden min-w-0 flex-col sm:flex">
                    <span className={cn("truncate text-[12px] font-semibold transition-colors duration-500", graduated ? "text-foreground" : "text-muted-foreground")}>Open-market pool</span>
                    <span className="truncate text-[10.5px] text-muted-foreground">{graduated ? "Liquidity locked" : "Opens at graduation"}</span>
                  </span>
                </span>
              </div>
            </div>

            {/* The launch: the token appears at the origin. */}
            <span
              className={cn("absolute size-8 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-2 transition-[box-shadow] duration-500", shown === 0 ? "shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_20%,transparent)] ring-primary" : "ring-foreground/15")}
              style={{ left: 16, top: `${yPct(0)}%` }}
            >
              <TokenArt seed="how-it-works" className="size-full" />
            </span>

            {EVENTS.map((e) => <Event key={e.t} t={t} e={e} />)}

            <motion.span
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_25%,transparent),0_0_18px_var(--primary)]"
              style={{ left: dotLeft, top: dotTop, opacity: dotOpacity }}
            />
            {/* Live readout of where the curve is. */}
            <span className="pointer-events-none absolute left-0 top-0 flex items-center gap-2 text-[11px] tabular-nums">
              <span className={cn("rounded-md px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] transition-colors duration-300", shown === 2 ? "bg-credit/[0.14] text-credit" : "bg-primary/[0.14] text-primary")}>{shown === 0 ? "Launch" : shown === 2 ? "Graduated" : "Trading"}</span>
              <motion.span className="font-semibold text-foreground/85">{readout}</motion.span>
            </span>

            <span className="absolute bottom-0 left-0 text-[10.5px] font-medium text-muted-foreground/70">SOL raised →</span>
          </div>
        </div>

        <ol className="grid grid-cols-1 gap-8 border-t border-foreground/[0.06] px-4 py-6 md:px-6 lg:gap-0 lg:[grid-template-columns:30fr_42fr_28fr]">
          {[0, 1, 2].map((i) => <StageNote key={i} i={i} p={p} phase={shown} onPick={pick} />)}
        </ol>
      </div>
    </section>
  )
}
