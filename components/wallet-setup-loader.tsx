"use client"

import * as React from "react"
import gsap from "gsap"

/**
 * Inline wallet setup loader — sits inside the page content area,
 * NOT a full-screen takeover. Shows real-time status with GSAP
 * letter-by-letter text animations.
 */
export function WalletSetupLoader({ status }: { status?: string | null }) {
  const display = status || "Connecting…"
  const textRef = React.useRef<HTMLSpanElement>(null)
  const prevText = React.useRef("")

  // GSAP letter animation on text change
  React.useEffect(() => {
    if (!textRef.current || display === prevText.current) return
    prevText.current = display

    const el = textRef.current
    // Split text into individual letter spans
    el.innerHTML = display
      .split("")
      .map((ch) =>
        ch === " "
          ? " "
          : `<span class="inline-block" style="opacity:0;transform:translateY(6px)">${ch}</span>`,
      )
      .join("")

    const letters = el.querySelectorAll("span")
    if (letters.length) {
      gsap.to(letters, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.02,
        ease: "power2.out",
      })
    }
  }, [display])

  return (
    <div className="flex flex-col items-center justify-center py-32">
      {/* Minimal spinner */}
      <div className="relative mb-8 size-10">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
      </div>

      {/* Animated status text */}
      <span
        ref={textRef}
        className="text-sm font-medium text-muted-foreground tracking-tight"
        aria-live="polite"
      >
        {display}
      </span>

      <p className="mt-3 text-[10px] text-muted-foreground/50">
        Setting up your multi-chain wallets
      </p>
    </div>
  )
}
