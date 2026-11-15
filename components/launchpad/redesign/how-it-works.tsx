"use client"

/**
 * "How a launch works", drawn as the thing itself: one bonding curve across
 * the section, split into its three stages (launch at the origin, trading
 * along the curve, graduation at the target into a locked pool). A price dot
 * runs the curve; buys land as it climbs; the stage it's in lights up below.
 *
 * The drawing carries no figures except the graduation target, which is the
 * real one when the board has read it. The loop plays only while on screen
 * and not at all under prefers-reduced-motion (the curve is then drawn
 * filled, with every stage lit).
 */

import * as React from "react"
import Link from "next/link"
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "motion/react"
import { ArrowRight02Icon, SquareLock02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/dashboard/redesign/ui"
import { TokenArt } from "@/components/launchpad-unauth/token-art"
import { cn } from "@/lib/utils"

/** Where the stages meet, as a share of the track's width. */
const LAUNCH_END = 0.22
const TARGET = 0.78

/** Price along the curve, 0–1, for a position 0–1 of the curve (the curve's quadratic shape). */
const shape = (x: number) => (Math.pow(1 + 3.2 * x, 2) - 1) / (Math.pow(4.2, 2) - 1)
/** Height on the track (0 bottom – 1 top) at a horizontal position p (0–1); flat after the target. */
const level = (p: number) => shape(Math.min(1, p / TARGET))

// The track's vertical frame, in % of its height.
const TOP = 16
const SPAN = 64
const yPct = (p: number) => TOP + (1 - level(p)) * SPAN

const curvePath = Array.from({ length: 49 }, (_, i) => (i / 48) * TARGET)
  .map((p, i) => `${i ? "L" : "M"}${(p * 1000).toFixed(1)},${(yPct(p) * 2).toFixed(1)}`)
  .join(" ")
const BASE_Y = (TOP + SPAN) * 2

type Phase = 0 | 1 | 2

const STEPS = [
  { n: "01", title: "Launch", body: "Name, ticker, icon. Buy a share yourself if you want. One transaction, signed on this device, and it's live.", fact: "The creator buys on the same curve as everyone" },
  { n: "02", title: "Trade on the curve", body: "From the first second anyone can buy or sell. Buys push the price up the curve, sells bring it down. No order book, so there's always a price.", fact: "The price is set by the curve" },
  { n: "03", title: "Graduate", body: "When the target is raised the curve closes and its SOL seeds an open-market pool. That liquidity is locked: nobody can pull it, the creator included.", fact: "Liquidity locked for good" },
] as const

function Buy({ p, at, label }: { p: MotionValue<number>; at: number; label: string }) {
  const opacity = useTransform(p, [at - 0.02, at, at + 0.07, at + 0.1], [0, 1, 1, 0])
  const y = useTransform(p, [at - 0.02, at + 0.1], [6, -10])
  return (
    <motion.span
      className="absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-credit/[0.14] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-credit"
      style={{ left: `${at * 100}%`, top: `calc(${yPct(at)}% - 30px)`, opacity, y }}
    >
      {label}
    </motion.span>
  )
}

function Track({ target, phase, onPhase, still }: { target: number | null; phase: Phase | null; onPhase: (p: Phase) => void; still: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-60px" })
  const p = useMotionValue(still ? 1 : 0)

  React.useEffect(() => {
    if (still) {
      p.set(1)
      return
    }
    if (!inView) return
    const run = animate(p, [0, 1], { duration: 8, ease: "linear", repeat: Infinity, repeatDelay: 1.4 })
    return () => run.stop()
  }, [inView, still, p])

  useMotionValueEvent(p, "change", (v) => {
    if (still) return
    const next: Phase = v < LAUNCH_END ? 0 : v < TARGET ? 1 : 2
    if (next !== phase) onPhase(next)
  })

  // What's been bought so far: the same curve, clipped at the dot.
  const clip = useTransform(p, (v) => `inset(0 ${(100 - Math.min(v, TARGET) * 100).toFixed(2)}% 0 0)`)
  const dotLeft = useTransform(p, (v) => `${v * 100}%`)
  const dotTop = useTransform(p, (v) => `${yPct(v)}%`)
  const graduated = phase === 2 || phase === null

  return (
    <div ref={ref} aria-hidden className="relative h-[190px] w-full select-none overflow-hidden md:h-[220px]">
      {[LAUNCH_END, TARGET].map((x) => (
        <span key={x} className={cn("absolute bottom-[14%] top-[6%] w-px", x === TARGET ? "bg-[repeating-linear-gradient(to_bottom,var(--credit)_0_4px,transparent_4px_8px)] opacity-60" : "bg-foreground/[0.07]")} style={{ left: `${x * 100}%` }} />
      ))}
      <span className="absolute top-[1%] -translate-x-full whitespace-nowrap pr-2 text-[10.5px] font-semibold tabular-nums text-credit" style={{ left: `${TARGET * 100}%` }}>
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
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${curvePath} L${TARGET * 1000},${BASE_Y} L0,${BASE_Y} Z`} fill="url(#hiw-fill)" />
          <path d={curvePath} fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </motion.div>

      {/* Past the target: the pool the curve's liquidity moves into, locked. */}
      <div className="absolute flex -translate-y-1/2 items-center" style={{ left: `calc(${TARGET * 100}% + 10px)`, right: 0, top: `${yPct(1)}%` }}>
        <span className={cn("flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-2.5 sm:justify-start transition-colors duration-500", graduated ? "border-credit/40 bg-credit/[0.1]" : "border-foreground/[0.08] bg-foreground/[0.02]")}>
          <Icon icon={SquareLock02Icon} className={cn("size-4 shrink-0 transition-colors duration-500", graduated ? "text-credit" : "text-muted-foreground")} strokeWidth={2} />
          <span className={cn("hidden truncate text-[11.5px] font-semibold transition-colors sm:block duration-500", graduated ? "text-foreground" : "text-muted-foreground")}>Open-market pool</span>
        </span>
      </div>

      {/* The launch: the token appears at the origin. */}
      <span
        className={cn("absolute size-7 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-2 transition-[box-shadow] duration-500", phase === 0 ? "shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_18%,transparent)] ring-primary" : "ring-foreground/15")}
        style={{ left: 14, top: `${yPct(0)}%` }}
      >
        <TokenArt seed="how-it-works" className="size-full" />
      </span>

      {!still && (
        <>
          <Buy p={p} at={0.3} label="+0.5 SOL" />
          <Buy p={p} at={0.47} label="+1.2 SOL" />
          <Buy p={p} at={0.63} label="+2.0 SOL" />
          <motion.span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_25%,transparent),0_0_18px_var(--primary)]"
            style={{ left: dotLeft, top: dotTop }}
          />
        </>
      )}

      <span className="absolute bottom-0 left-0 text-[10.5px] font-medium text-muted-foreground/70">SOL raised →</span>
      <span className="absolute left-10 top-0 text-[10.5px] font-medium text-muted-foreground/70">Price</span>
    </div>
  )
}

export function HowItWorks({ target, paused }: { target: number | null; paused: boolean }) {
  const reduce = Boolean(useReducedMotion())
  const [running, setPhase] = React.useState<Phase>(0)
  const phase: Phase | null = reduce ? null : running
  const onPhase = React.useCallback((p: Phase) => setPhase(p), [])

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="flex scroll-mt-6 flex-col gap-5 border-t border-foreground/[0.06] pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex flex-col gap-1">
          <h2 id="how-it-works-title" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">How a launch works</h2>
          <p className="text-[13px] text-muted-foreground">Same curve, same rules for every token, the creator included.</p>
        </div>
        {!paused && (
          <Link href="/launchpad/create" className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            Launch a token
            <Icon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        )}
      </div>

      <div className="ds-panel rounded-[22px] px-4 pb-6 pt-5 md:px-6">
        <Track target={target} phase={phase} onPhase={onPhase} still={reduce} />
        {/* Each stage's note sits under its stretch of the curve (desktop); stacked on small screens. */}
        <ol className="mt-5 grid grid-cols-1 gap-5 lg:mt-4 lg:gap-0 lg:[grid-template-columns:22fr_56fr_22fr]">
          {STEPS.map((s, i) => {
            const active = phase === i
            const lit = phase === null || active
            return (
              <li key={s.n} className={cn("flex flex-col gap-1.5", i === 1 && "lg:px-8", i === 2 && "lg:pl-4")}>
                <span className={cn("font-mono text-[11.5px] font-semibold tabular-nums transition-colors duration-300", active ? "text-primary" : "text-muted-foreground/70")}>{s.n}</span>
                <h3 className={cn("font-display text-[17px] font-semibold tracking-[-0.02em] transition-colors duration-300", lit ? "text-foreground" : "text-foreground/65")}>{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
                <p className={cn("mt-1 border-l-2 pl-2.5 text-[12px] font-medium text-foreground/75 transition-colors duration-300", active ? "border-primary" : "border-foreground/10")}>{s.fact}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
