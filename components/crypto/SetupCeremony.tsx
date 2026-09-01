"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import type { Stage } from "@/components/ui/flow"

/**
 * The wait while a wallet is created.
 *
 * The checklist that used to live here (`StageList`, still the right widget
 * for a transfer) read as a deployment pipeline: four dots and a connector,
 * three of them inert at any moment. It is the wrong register for this
 * particular wait. What is actually happening is that five private keys that
 * will never exist anywhere else are being drawn on this device, encrypted,
 * and written down — and the screen said nothing about that.
 *
 * So the progress indicator IS the material. A field of hex settles from the
 * front: glyphs behind the frontier are fixed, the frontier itself churns, and
 * everything ahead of it is still blank. The frontier eases toward wherever
 * the current stage is, so it keeps crawling through a slow stage instead of
 * freezing between reports, and surges when one lands.
 *
 * This follows the motion rule the rest of the app is built on — nothing loops
 * for decoration. The churn means work is in flight and stops the moment the
 * ceremony finishes. Under `prefers-reduced-motion` it never starts: the field
 * fills in one step per stage and the frontier holds still.
 *
 * The glyphs are not the user's key, and nothing here claims they are. They
 * are what work looks like.
 */

const GLYPHS = "0123456789abcdef"
/** Roughly four lines at the card's width — enough to read as a field rather
 *  than a progress bar wearing a costume, without dominating the card. */
const FIELD_SIZE = 96
/** Width of the churning frontier, in glyphs. */
const FRONTIER = 12
const TICK_MS = 55
/** Per-tick share of the remaining distance. Low enough to read as a crawl,
 *  high enough that a completed stage visibly surges. */
const EASING = 0.06

const randomGlyphs = (count: number) => {
  if (count <= 0) return ""
  const bytes = crypto.getRandomValues(new Uint8Array(count))
  let out = ""
  for (let i = 0; i < count; i += 1) out += GLYPHS[bytes[i] % GLYPHS.length]
  return out
}

/* Read once through useSyncExternalStore rather than an effect, so the very
   first paint already respects the preference and the loop below never starts
   for someone who asked for stillness. */
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const readMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const assumeMotionOnServer = () => false

export function SetupCeremony({
  stages,
  /** Index of the stage in flight; pass `stages.length` once everything is done. */
  activeIndex,
}: {
  stages: Stage[]
  activeIndex: number
}) {
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, assumeMotionOnServer)
  const finished = activeIndex >= stages.length
  const current = stages[Math.min(activeIndex, stages.length - 1)]
  const step = Math.min(activeIndex + 1, stages.length)

  // The settled prefix only ever grows, so it lives in a ref and is sliced
  // rather than regenerated — a glyph that has already resolved must never
  // change again, or the field stops reading as material and starts reading
  // as noise.
  const settledRef = useRef("")
  const churnRef = useRef("")
  const fractionRef = useRef(0)
  const [, forceRender] = useState(0)

  // Two numbers, because a stage boundary and the crawl inside a stage are
  // different facts. The FLOOR is what has actually completed and is applied
  // the instant a stage lands — easing up to it would lie about progress, and
  // on a fast machine the whole ceremony finishes in under two seconds, which
  // is less time than an eased fill needs to cross the field at all. The
  // TARGET is the far edge of the current stage, so the frontier still has
  // somewhere to crawl and a slow stage never looks hung.
  const floor = activeIndex / stages.length
  const target = finished ? 1 : Math.min(1, (activeIndex + 0.9) / stages.length)

  useEffect(() => {
    // Everything that draws randomness happens here rather than in render:
    // render stays a pure function of the refs, and the churn advances on the
    // tick that owns it.
    const settle = () => {
      const settledCount = Math.round(fractionRef.current * FIELD_SIZE)
      if (settledRef.current.length < settledCount) {
        settledRef.current += randomGlyphs(settledCount - settledRef.current.length)
      }
      const churnCount = finished ? 0 : Math.min(FRONTIER, FIELD_SIZE - settledCount)
      churnRef.current = reduceMotion || churnCount <= 0 ? "" : randomGlyphs(churnCount)
      forceRender((n) => n + 1)
    }

    fractionRef.current = Math.max(fractionRef.current, floor)

    if (reduceMotion) {
      fractionRef.current = target
      settle()
      return
    }

    settle()
    const timer = window.setInterval(() => {
      const distance = target - fractionRef.current
      // Snap the last sliver: easing alone approaches the target forever, and
      // a field that never quite fills would undercut the completion beat.
      fractionRef.current = Math.abs(distance) < 0.002 ? target : fractionRef.current + distance * EASING
      settle()
    }, TICK_MS)

    return () => window.clearInterval(timer)
  }, [target, floor, reduceMotion, finished])

  const settled = settledRef.current.slice(0, FIELD_SIZE)
  const churn = churnRef.current
  const pending = "·".repeat(Math.max(0, FIELD_SIZE - settled.length - churn.length))

  return (
    <div className="flex flex-col gap-4">
      {/* The field. `break-all` is what lets three spans flow as one block of
          material instead of three words that wrap around each other. */}
      <div
        aria-hidden
        className="rounded-xl bg-surface-sunken/60 px-3.5 py-3 ring-1 ring-border/20"
      >
        <p className="break-all font-mono text-[11px] leading-[1.95] tracking-[0.22em]">
          <span className="text-foreground/55 transition-colors duration-500">{settled}</span>
          <span className="text-primary">{churn}</span>
          <span className="text-subtle/30">{pending}</span>
        </p>
      </div>

      {/* The same fraction as the field, as a measure rather than a texture.
          It sits directly under the field it measures: below the label instead
          it read as an underline of the sentence, not as progress. */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear motion-reduce:transition-none"
          style={{ width: `${Math.round(fractionRef.current * 100)}%` }}
        />
      </div>

      {/* What the field is currently doing, and how far in. The key on the
          label crossfades it when the stage changes — the sentence is
          replaced, not mutated, so the change is legible at a glance. */}
      <div className="flex items-baseline justify-between gap-3">
        <span key={current?.key} className="ws-casc text-[13px] font-semibold">
          {finished ? "Wallet ready" : current?.label}
        </span>
        {/* A step counter next to "Wallet ready" would be counting something
            that has stopped. */}
        {finished ? null : (
          <span className="shrink-0 text-[11.5px] tabular-nums text-subtle">
            Step {step} of {stages.length}
          </span>
        )}
      </div>
    </div>
  )
}
