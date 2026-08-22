"use client"

/**
 * House-token banner — the one marketing surface allowed above the balance
 * hero. WorldStreet's own take on the classic "buy the token" strip: stone
 * glass with a gold wash bleeding in from the right, a minted MNA coin, a
 * light band sweeping the strip every few seconds, and a gold CTA that
 * scrolls to the Worldstreet token card (price, holdings, explainer) and
 * flashes it. When the Buy-MNA flow ships, the CTA points there instead.
 *
 * Dismissible, and it stays dismissed (localStorage) — a promo that
 * reappears every visit trains people to stop seeing it.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

const DISMISS_KEY = "ws-mna-banner-dismissed"

/** A minted coin, drawn in CSS: gold conic rim, dark face, monogram. */
function MnaCoin() {
  return (
    <span
      aria-hidden
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
      style={{
        background:
          "conic-gradient(from 220deg, #8a6d1f, #f3d97c 22%, #a8842a 46%, #f7e29a 68%, #8a6d1f)",
      }}
    >
      <span
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full font-display text-[15px] font-bold text-primary"
        style={{
          background: "radial-gradient(120% 120% at 30% 25%, #2a2416, #171310 70%)",
        }}
      >
        M
      </span>
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
    <div className="rise ws-card-glass relative overflow-hidden rounded-2xl bg-card/80 ring-1 ring-primary/25">
      {/* Gold bleeding in from the right — atmosphere, not a photograph. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 160% at 100% 50%, color-mix(in oklab, var(--primary) 16%, transparent) 0%, transparent 55%)",
          }}
        />
        <div
          className="ws-aurora-b absolute -right-10 -top-10 h-32 w-72 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 20%, transparent), transparent)",
          }}
        />
      </div>
      {/* The sweeping light band. */}
      <span
        aria-hidden
        className="ws-banner-sheen pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
      />

      <div className="relative flex items-center gap-3.5 px-4 py-3.5 sm:gap-4 sm:px-5">
        <MnaCoin />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14.5px] font-semibold leading-tight tracking-[-0.01em] sm:text-[15.5px]">
            Own a piece of Worldstreet
          </p>
          <p className="mt-0.5 hidden text-[12.5px] leading-snug text-muted-foreground sm:block">
            MNA is the house token — buy it with your Dollar Account, or trade WMNA on the open market.
          </p>
        </div>
        <button
          type="button"
          onClick={goToToken}
          className="flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-all hover:bg-primary/90 active:scale-[0.97] motion-reduce:active:scale-100"
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
