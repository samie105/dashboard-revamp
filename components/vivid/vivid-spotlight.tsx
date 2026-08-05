"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  resolveTarget,
  setSpotlight,
  subscribeSpotlight,
  type SpotlightRequest,
} from "@/lib/vivid-page-control"

/**
 * The mask Vivid casts when it points at part of the screen.
 *
 * One fixed element. Its box-shadow is the veil — 200vmax of near-canvas black
 * around a rounded window over the target — so there is no SVG mask and no
 * four-rectangle choreography. The window's own edge carries a faint brand
 * ring, the only gold on an otherwise dimmed page.
 *
 * The overlay re-resolves the target id every frame while active: scrolling,
 * re-renders and layout shifts all just work, and consecutive spotlights glide
 * to their next window because top/left/width/height are CSS-transitioned.
 *
 * It never eats input (pointer-events: none) — the FIRST user pointerdown or
 * Escape clears it, so the user is always one gesture from their page. It also
 * clears itself on navigation and after a short timeout, so a stale mask can
 * never strand the UI.
 */

const PAD = 10 // breathing room around the target, px

type Rect = { top: number; left: number; width: number; height: number }

export default function VividSpotlight() {
  const [req, setReq] = useState<SpotlightRequest>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const pathname = usePathname()
  const raf = useRef(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to the store; also listen for the DOM event so the spotlight can
  // be driven from a console, a test, or a future embed script.
  useEffect(() => {
    const unsub = subscribeSpotlight(setReq)
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {}
      const id = detail.target
      const secs = Number(detail.seconds)
      setSpotlight(
        typeof id === "string" && id ? id : null,
        Number.isFinite(secs) && secs > 0 ? secs * 1000 : undefined,
      )
    }
    window.addEventListener("vivid:spotlight", onEvent)
    return () => {
      unsub()
      window.removeEventListener("vivid:spotlight", onEvent)
    }
  }, [])

  // Route change → stale mask, clear it.
  useEffect(() => {
    setSpotlight(null)
  }, [pathname])

  // Track the target while active. Keyed on the nonce too, so re-spotlighting
  // the same element restarts the hold instead of inheriting a dying timer.
  const activeId = req?.id ?? null
  const holdMs = req?.holdMs
  const nonce = req?.nonce

  useEffect(() => {
    if (!activeId) {
      setRect(null)
      return
    }

    // Measure once, synchronously, so the mask is on screen from the very next
    // paint. rAF only TRACKS it after that — a backgrounded or throttled tab
    // must never be the reason a highlight fails to appear.
    const measure = (): boolean => {
      const el = resolveTarget(activeId)
      if (!el) return false
      const r = el.getBoundingClientRect()
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      })
      return true
    }

    if (!measure()) {
      // Target isn't on screen (modal closed, list refiltered) — nothing to point at.
      setSpotlight(null)
      return
    }

    const tick = () => {
      if (!measure()) {
        setSpotlight(null)
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    const clear = () => setSpotlight(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear()
    }
    // Capture phase so ANY interaction anywhere dismisses, even inside portals.
    window.addEventListener("pointerdown", clear, { capture: true })
    window.addEventListener("keydown", onKey)
    timeout.current = setTimeout(clear, holdMs)

    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener("pointerdown", clear, { capture: true })
      window.removeEventListener("keydown", onKey)
      if (timeout.current) clearTimeout(timeout.current)
    }
  }, [activeId, holdMs, nonce])

  if (!activeId || !rect) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[70] rounded-[20px] transition-[top,left,width,height] duration-300 ease-out"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        // Veil + brand ring in one paint. The veil is canvas-toned, not pure
        // black, so the dimmed page still reads as the same warm surface.
        boxShadow:
          "0 0 0 200vmax rgba(12, 10, 9, 0.74), 0 0 0 1.5px rgba(255, 204, 45, 0.55), 0 0 24px 2px rgba(255, 204, 45, 0.12)",
      }}
    />
  )
}
