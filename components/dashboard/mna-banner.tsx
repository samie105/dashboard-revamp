"use client"

/**
 * House-token banner — the one marketing surface allowed above the balance
 * hero. A gold dusk gathers on the right with ghost coins drifting in it,
 * a minted MNA coin glints on the left, and a light
 * band sweeps the strip. The CTA scrolls to the Worldstreet token card and
 * flashes it; when the Buy-MNA flow ships it points there instead.
 *
 * Dismissible, and it stays dismissed (localStorage) — a promo that
 * reappears every visit trains people to stop seeing it.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

const DISMISS_KEY = "ws-mna-banner-dismissed"

/** A minted coin, drawn in CSS: gold conic rim, dark face, monogram — with
 *  a shine band sweeping across it on the banner's cadence. */
function MnaCoin() {
  return (
    <span
      aria-hidden
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_26px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
      style={{
        background:
          "conic-gradient(from 220deg, #8a6d1f, #f3d97c 22%, #a8842a 46%, #f7e29a 68%, #8a6d1f)",
      }}
    >
      <span
        className="flex h-[48px] w-[48px] items-center justify-center rounded-full font-display text-lg font-bold text-primary"
        style={{
          background: "radial-gradient(120% 120% at 30% 25%, #2a2416, #171310 70%)",
        }}
      >
        M
      </span>
      {/* The coin glints on the same clock as the strip's sheen. */}
      <span
        className="ws-banner-sheen absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        style={{ animationDelay: "1.7s" }}
      />
    </span>
  )
}

export function MnaBanner() {
  // "unknown" until localStorage has been read — rendering nothing first
  // avoids a hydration mismatch and a flash-then-vanish for dismissers.
  const [state, setState] = React.useState<"unknown" | "show" | "hidden">("unknown")

  React.useEffect(() => {
    try {
      setState(localStorage.getItem(DISMISS_KEY) ? "hidden" : "show")
    } catch {
      setState("show")
    }
  }, [])

  const dismiss = () => {
    setState("hidden")
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch { /* private mode — it just comes back next visit */ }
  }

  const goToToken = () => {
    const card = document.getElementById("worldstreet-token-card")
    if (!card) return
    card.scrollIntoView({ behavior: "smooth", block: "center" })
    // Flash after the scroll has (mostly) arrived, so the pulse is seen.
    window.setTimeout(() => {
      card.classList.remove("ws-target-flash")
      void card.offsetWidth
      card.classList.add("ws-target-flash")
      card.addEventListener(
        "animationend",
        () => card.classList.remove("ws-target-flash"),
        { once: true },
      )
    }, 450)
  }

  if (state !== "show") return null

  return (
    <div className="rise ws-card-glass ws-glass-edge relative overflow-hidden rounded-2xl bg-card/80 ring-1 ring-primary/30">
      {/* Gold dusk — a real scene, not a tint: deep wash from the right,
          an answering glow behind the coin, and three ghost coins drifting
          in the field (the Kash photo's coins, rebuilt as material). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(110% 220% at 100% 50%, color-mix(in oklab, var(--primary) 30%, transparent) 0%, color-mix(in oklab, var(--primary) 10%, transparent) 34%, transparent 62%),
              radial-gradient(40% 160% at 4% 50%, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 70%)`,
          }}
        />
        <span
          className="ws-aurora-a absolute right-[6.5rem] top-1/2 hidden h-16 w-16 -translate-y-1/2 rounded-full sm:block"
          style={{
            border: "1px solid color-mix(in oklab, var(--primary) 45%, transparent)",
            background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 18%, transparent), transparent)",
          }}
        />
        <span
          className="ws-aurora-b absolute right-44 top-0 hidden h-10 w-10 rounded-full lg:block"
          style={{
            border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
            background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 12%, transparent), transparent)",
            animationDelay: "-6s",
          }}
        />
        <span
          className="ws-aurora-a absolute -bottom-4 right-6 hidden h-12 w-12 rounded-full sm:block"
          style={{
            border: "1px solid color-mix(in oklab, var(--primary) 35%, transparent)",
            background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 15%, transparent), transparent)",
            animationDelay: "-9s",
          }}
        />
      </div>
      {/* The sweeping light band — gold-warmed, brighter than before. */}
      <span
        aria-hidden
        className="ws-banner-sheen pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--primary)_22%,rgb(255_255_255/0.10))] to-transparent"
      />

      <div className="relative flex items-center gap-4 px-4 py-4 sm:px-5">
        <MnaCoin />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15.5px] font-bold leading-tight tracking-[-0.01em] sm:text-[17px]">
            Own a piece of{" "}
            <span className="bg-gradient-to-r from-primary via-[#f5d97a] to-primary bg-clip-text text-transparent">
              Worldstreet
            </span>
          </p>
          <p className="mt-1 hidden text-[12.5px] leading-snug text-muted-foreground sm:block">
            MNA is the house token — buy it with your Dollar Account, or trade WMNA on the open market.
          </p>
        </div>

        <button
          type="button"
          onClick={goToToken}
          className="ws-cta-breathe flex h-10 shrink-0 items-center rounded-full bg-primary px-5 text-[13.5px] font-bold text-primary-foreground shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)] transition-all hover:bg-primary/90 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Get MNA
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
