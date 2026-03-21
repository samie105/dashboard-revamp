"use client"

import * as React from "react"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

// ── Step definitions ─────────────────────────────────────────────────────

export interface OnboardingStep {
  /** CSS selector (data attribute) for the target element to spotlight */
  target: string
  /** Title shown in the tooltip */
  title: string
  /** Description text */
  description: string
  /** Where the tooltip appears relative to the spotlight */
  placement?: "top" | "bottom" | "left" | "right"
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  steps: OnboardingStep[]
  storageKey: string
  /** Whether the user has already completed this onboarding (from profile) */
  completed?: boolean
  onComplete?: () => void
}

export function OnboardingFlow({ steps, storageKey, completed, onComplete }: Props) {
  // Temporarily disabled until we have a better onboarding system
  return null

  const [active, setActive] = React.useState(false)
  const [current, setCurrent] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [neverShowAgain, setNeverShowAgain] = React.useState(true)

  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const spotlightRef = React.useRef<SVGRectElement>(null)
  const backdropRef = React.useRef<SVGSVGElement>(null)
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const descRef = React.useRef<HTMLParagraphElement>(null)

  // Determine if already seen: profile flag takes priority, fall back to localStorage
  React.useEffect(() => {
    if (completed) return // already completed per profile
    try {
      if (typeof window !== "undefined" && localStorage.getItem(storageKey)) return // already completed locally
    } catch {}
    // Small delay so elements are rendered
    const t = setTimeout(() => setActive(true), 800)
    return () => clearTimeout(t)
  }, [storageKey, completed])

  // If profile marks completed after we've already activated, dismiss silently
  React.useEffect(() => {
    if (completed && active) setActive(false)
  }, [completed, active])

  // Measure the target element when step changes
  React.useEffect(() => {
    if (!active) return

    const step = steps[current]
    if (!step) return

    const el = document.querySelector(step.target) as HTMLElement | null
    if (!el) {
      // If element not found, skip to next step
      if (current < steps.length - 1) setCurrent((p) => p + 1)
      else finish()
      return
    }

    const r = el.getBoundingClientRect()
    setRect(r)

    // Scroll element into view if needed
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [active, current, steps])

  // GSAP animations when rect / step changes
  React.useEffect(() => {
    if (!rect || !active) return

    const pad = 8
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

    // Animate spotlight rect
    if (spotlightRef.current) {
      tl.to(spotlightRef.current, {
        attr: {
          x: rect.left - pad,
          y: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          rx: 16,
        },
        duration: 0.45,
      }, 0)
    }

    // Animate tooltip position
    if (tooltipRef.current) {
      const measuredH = tooltipRef.current.offsetHeight || 180
      const pos = getTooltipPosition(rect, steps[current]?.placement ?? "bottom", measuredH)
      tl.to(tooltipRef.current, {
        x: pos.x,
        y: pos.y,
        opacity: 1,
        scale: 1,
        duration: 0.4,
      }, 0.1)
    }

    // Animate text content (letter stagger for title)
    if (titleRef.current) {
      const title = steps[current]?.title || ""
      titleRef.current.innerHTML = title
        .split("")
        .map((ch) =>
          ch === " "
            ? " "
            : `<span class="inline-block" style="opacity:0;transform:translateY(4px)">${ch}</span>`,
        )
        .join("")

      const letters = titleRef.current.querySelectorAll("span")
      tl.to(letters, {
        opacity: 1,
        y: 0,
        duration: 0.25,
        stagger: 0.015,
      }, 0.2)
    }

    if (descRef.current) {
      tl.fromTo(descRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35 }, 0.3)
    }
  }, [rect, active, current, steps])

  // Entrance animation
  React.useEffect(() => {
    if (!active || !backdropRef.current) return
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" })
  }, [active])

  function finish() {
    // Persist immediately — don't wait for animation
    try { localStorage.setItem(storageKey, "done") } catch {}
    // Exit animation then cleanup
    const tl = gsap.timeline({
      onComplete: () => {
        setActive(false)
        onComplete?.()
      },
    })
    if (backdropRef.current) {
      tl.to(backdropRef.current, { opacity: 0, duration: 0.3 }, 0)
    }
    if (tooltipRef.current) {
      tl.to(tooltipRef.current, { opacity: 0, scale: 0.95, duration: 0.25 }, 0)
    }
  }

  function confirmDismiss() {
    setShowConfirm(false)
    if (!neverShowAgain) {
      // Don't persist — just hide for this session
      setActive(false)
      return
    }
    finish()
  }

  function next() {
    if (current < steps.length - 1) {
      // Animate out tooltip before switching
      if (tooltipRef.current) {
        gsap.to(tooltipRef.current, {
          opacity: 0,
          scale: 0.95,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => setCurrent((p) => p + 1),
        })
      } else {
        setCurrent((p) => p + 1)
      }
    } else {
      finish()
    }
  }

  function prev() {
    if (current > 0) {
      if (tooltipRef.current) {
        gsap.to(tooltipRef.current, {
          opacity: 0,
          scale: 0.95,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => setCurrent((p) => p - 1),
        })
      } else {
        setCurrent((p) => p - 1)
      }
    }
  }

  if (!active || !rect) return null

  const safeRect = rect as DOMRect
  const isFirst = current === 0
  const isLast = current === steps.length - 1
  const step = steps[current]

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      {/* SVG backdrop with cutout */}
      <svg
        ref={backdropRef}
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <mask id="onboarding-mask">
            {/* White = visible (darkened), Black = transparent (spotlight) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              ref={spotlightRef}
              x={safeRect.left - 8}
              y={safeRect.top - 8}
              width={safeRect.width + 16}
              height={safeRect.height + 16}
              rx="16"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Click layer — clicking backdrop advances, but not on tooltip */}
      <div
        className="absolute inset-0"
        onClick={next}
        style={{ cursor: "pointer" }}
      />

      {/* Spotlight pulse ring */}
      <div
        className="pointer-events-none absolute rounded-2xl border-2 border-primary/50 animate-pulse"
        style={{
          left: safeRect.left - 8,
          top: safeRect.top - 8,
          width: safeRect.width + 16,
          height: safeRect.height + 16,
          transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-10 w-[300px] rounded-2xl border border-border/40 bg-card p-4 shadow-2xl"
        style={{
          ...getTooltipPosition(safeRect, step?.placement ?? "bottom", tooltipRef.current?.offsetHeight || 180),
          opacity: 0,
          transform: "scale(0.95)",
        }}
      >
        {/* Step indicator + close */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === current ? "w-4 bg-primary" : i < current ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-lg p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
          </button>
        </div>

        {/* Title (GSAP letter-animated) */}
        <h3
          ref={titleRef}
          className="text-sm font-semibold tracking-tight mb-1"
        />

        {/* Description */}
        <p
          ref={descRef}
          className="text-xs text-muted-foreground leading-relaxed mb-4"
        >
          {step?.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={isFirst}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3" />
            Back
          </button>

          <span className="text-[10px] text-muted-foreground tabular-nums">
            {current + 1} / {steps.length}
          </span>

          <button
            onClick={next}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isLast
                ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            {isLast ? (
              <>
                Done
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
              </>
            ) : (
              <>
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Dismiss confirmation dialog ── */}
      {showConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* scrim */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

          <div className="relative z-10 w-[320px] rounded-2xl border border-border/50 bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Icon + heading */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Exit walkthrough?</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  You can restart it anytime from your profile settings.
                </p>
              </div>
            </div>

            {/* Checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none mb-4 group">
              <div
                onClick={() => setNeverShowAgain((v) => !v)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  neverShowAgain
                    ? "border-primary bg-primary"
                    : "border-border bg-transparent group-hover:border-primary/60"
                }`}
              >
                {neverShowAgain && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-none stroke-current stroke-2">
                    <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Don&apos;t show the walkthrough again</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={confirmDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-destructive/90 text-white transition-colors hover:bg-destructive"
              >
                Exit walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Position helpers ─────────────────────────────────────────────────────

function getTooltipPosition(
  rect: DOMRect,
  placement: "top" | "bottom" | "left" | "right",
  measuredHeight?: number,
): { x: number; y: number } {
  const gap = 16
  const tooltipW = 300
  const tooltipH = measuredHeight || 180

  let x: number
  let y: number

  switch (placement) {
    case "top":
      x = rect.left + rect.width / 2 - tooltipW / 2
      y = rect.top - gap - tooltipH
      break
    case "bottom":
      x = rect.left + rect.width / 2 - tooltipW / 2
      y = rect.bottom + gap
      break
    case "left":
      x = rect.left - tooltipW - gap
      y = rect.top + rect.height / 2 - tooltipH / 2
      break
    case "right":
      x = rect.right + gap
      y = rect.top + rect.height / 2 - tooltipH / 2
      break
  }

  // Clamp to viewport so the card never goes off-screen
  if (typeof window !== "undefined") {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 12
    x = Math.max(margin, Math.min(x, vw - tooltipW - margin))
    y = Math.max(margin, Math.min(y, vh - tooltipH - margin))

    // If placement was top but clamped y pushes it below rect, flip to bottom
    if (placement === "top" && y > rect.top - tooltipH) {
      y = rect.bottom + gap
      y = Math.min(y, vh - tooltipH - margin)
    }
    // If placement was bottom but card would go off bottom, flip to top
    if (placement === "bottom" && y + tooltipH > vh - margin) {
      y = rect.top - gap - tooltipH
      y = Math.max(margin, y)
    }
  }

  return { x, y }
}
