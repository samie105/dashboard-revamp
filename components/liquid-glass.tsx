"use client"

/**
 * LiquidGlassPointer — one global, rAF-throttled pointermove listener that
 * feeds --ws-spec-x/--ws-spec-y (percent coordinates) to every mounted
 * .ws-glass-edge surface, so the specular hotspot on the glass rim tracks
 * the cursor the way Liquid Glass rims track device tilt.
 *
 * Renders nothing. Skips coarse pointers entirely — on touch the rims keep
 * their static top-left light source. Only a handful of glass-edge
 * surfaces ever exist at once (modals, sheets), so the per-frame
 * querySelectorAll + rect reads are trivially cheap.
 */

import * as React from "react"

export function LiquidGlassPointer() {
  React.useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return

    let raf = 0
    let px = 0
    let py = 0

    const onMove = (e: PointerEvent) => {
      px = e.clientX
      py = e.clientY
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        for (const el of document.querySelectorAll<HTMLElement>(".ws-glass-edge")) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          el.style.setProperty("--ws-spec-x", `${(((px - r.left) / r.width) * 100).toFixed(1)}%`)
          el.style.setProperty("--ws-spec-y", `${(((py - r.top) / r.height) * 100).toFixed(1)}%`)
        }
      })
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
