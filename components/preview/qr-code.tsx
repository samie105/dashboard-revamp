"use client"

/**
 * QrCode — the address QR, drawn as SVG rather than a raster.
 *
 * `QRCode.toDataURL()` (what the live receive panel uses) bakes in a PNG with
 * a white card behind it. That is the conventional, safest rendering, and it
 * is also why every receive sheet in crypto has the same white postage stamp
 * glued to a dark modal. Building the matrix ourselves gets three things the
 * raster cannot give:
 *
 *   · a TRANSPARENT background, so the pane's own surface shows through
 *   · rounded finder "eyes" instead of three hard bitmap squares
 *   · a real hole punched for the brand mark, rather than a logo dropped on
 *     top of modules the scanner still needs to read
 *
 * ── On inverted QR ────────────────────────────────────────────────────────
 * The spec assumes DARK modules on a LIGHT background. Rendering light-on-dark
 * inverts that. Every current phone camera (iOS Camera, Android/Google Lens)
 * and every major wallet handles inversion, but some older or cheaper
 * dedicated scanners do not, and the spec is on their side. Two mitigations
 * are baked in below and both are load-bearing, not polish:
 *
 *   · error correction is forced to H (~30% recoverable), so the logo hole
 *     and the softened module corners cost nothing that matters
 *   · the modules render at full foreground contrast — never a muted tone
 *
 * If a scanner ever does fail in the wild, the fix is to give the QR a light
 * plate again, not to dim the modules further.
 */

import * as React from "react"
import QRCode from "qrcode"
import { cn } from "@/lib/utils"

/** Fraction of the symbol's width cleared in the middle for the brand mark. */
const LOGO_FRACTION = 0.22

export function QrCode({
  value,
  logoSrc = "/worldstreet-logo/WorldStreet1.png",
  className,
  title,
}: {
  value: string
  /** Pass null to draw the symbol with no hole punched in it. */
  logoSrc?: string | null
  className?: string
  /** Accessible name — a QR with no text alternative is a dead end. */
  title?: string
}) {
  const matrix = React.useMemo(() => {
    if (!value) return null
    try {
      // H: the logo occludes the centre, so the symbol has to be able to lose
      // ~30% of itself and still decode.
      const qr = QRCode.create(value, { errorCorrectionLevel: "H" })
      const size = qr.modules.size
      const data = qr.modules.data
      return { size, at: (x: number, y: number) => data[y * size + x] === 1 }
    } catch {
      return null
    }
  }, [value])

  if (!matrix) return null

  const { size, at } = matrix
  // The spec's quiet zone is 4 modules. It looks like wasted padding and it
  // is not: it is how a scanner finds the symbol's edge.
  const quiet = 4
  const dim = size + quiet * 2

  // The centre hole, in module coordinates, snapped to whole modules so the
  // cleared area has straight edges instead of half-eaten dots.
  const holeSpan = Math.max(5, Math.round(size * LOGO_FRACTION) | 1)
  const holeStart = Math.floor((size - holeSpan) / 2)
  const holeEnd = holeStart + holeSpan
  const inHole = (x: number, y: number) =>
    logoSrc !== null && x >= holeStart && x < holeEnd && y >= holeStart && y < holeEnd

  // Finder patterns own the three corners; they are drawn as eyes below, so
  // the module loop has to skip them or it paints over the rounded shapes.
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)

  // Square, edge-to-edge modules in ONE path.
  //
  // An earlier draft drew each module as a detached circle at 0.4 radius. It
  // looked better and it was the wrong call: separated dots leave a gap
  // between neighbouring dark modules, and stacking that on top of an
  // inverted colour scheme is two deviations from the spec at once on the
  // thing a scanner has to binarise. The corners are softened on the finder
  // eyes instead, where the geometry stays exact.
  const dots: string[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!at(x, y) || inFinder(x, y) || inHole(x, y)) continue
      dots.push(`M${x} ${y}h1v1h-1z`)
    }
  }

  /** One finder eye — the shape a scanner locates FIRST, so its module counts
   *  are exact: a 7×7 outer ring one module thick, and a 3×3 core. Only the
   *  corner radius is ours. */
  const eye = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`} transform={`translate(${ox} ${oy})`}>
      <rect x="0.5" y="0.5" width="6" height="6" rx="1.9" ry="1.9" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="2" y="2" width="3" height="3" rx="1" ry="1" fill="currentColor" />
    </g>
  )

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label={title ?? "QR code"}
      className={cn("h-full w-full text-foreground", className)}
    >
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={dots.join(" ")} fill="currentColor" shapeRendering="crispEdges" />
        {eye(0, 0)}
        {eye(size - 7, 0)}
        {eye(0, size - 7)}
        {logoSrc && (
          <image
            href={logoSrc}
            x={holeStart + 0.6}
            y={holeStart + 0.6}
            width={holeSpan - 1.2}
            height={holeSpan - 1.2}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </g>
    </svg>
  )
}
