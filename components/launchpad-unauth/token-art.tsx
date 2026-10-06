"use client"

/**
 * TokenArt — a generated mark for a token that has no uploaded icon.
 *
 * Replaces "two initials on a gradient square", which reads as a placeholder
 * (because it is one). Each token instead gets a small abstract artwork:
 *
 *   marble   soft mesh-gradient blobs under a film grain — the default look
 *   bauhaus  bold geometry: a disc, a quarter-circle, a bar
 *   orbit    concentric rings with an offset planet
 *
 * Style, palette and composition all come from a seed, so a token always
 * gets the same mark (server and client alike — no Math.random), and two
 * tokens almost never share one. The eight palettes are curated, all on dark
 * bases, so a grid of them reads as one family that sits with the gold UI
 * rather than sixteen random colours.
 *
 * An uploaded icon always wins over this.
 */

import * as React from "react"
import { mulberry32, seedOf } from "@/components/preview/seeded"

type Palette = { bg: string; a: string; b: string; c: string }

const PALETTES: Palette[] = [
  { bg: "#1a1306", a: "#f5c518", b: "#ff8a1f", c: "#fff1c2" }, // gold
  { bg: "#06160f", a: "#10b981", b: "#a7f3d0", c: "#f5c518" }, // emerald
  { bg: "#1a0b07", a: "#ff5b3a", b: "#ffb020", c: "#ffe4cc" }, // ember
  { bg: "#100b1c", a: "#8b5cf6", b: "#f0abfc", c: "#f5c518" }, // violet
  { bg: "#05121a", a: "#0ea5e9", b: "#67e8f9", c: "#e0f2fe" }, // ocean
  { bg: "#1a0910", a: "#f43f5e", b: "#fda4af", c: "#fde68a" }, // rose
  { bg: "#121211", a: "#e7e5e4", b: "#78716c", c: "#f5c518" }, // bone
  { bg: "#0c1405", a: "#a3e635", b: "#facc15", c: "#ecfccb" }, // lime
]

type Style = "marble" | "bauhaus" | "orbit"

export function TokenArt({ seed, className }: { seed: string; className?: string }) {
  const uid = React.useId().replace(/[:«»]/g, "")
  const art = React.useMemo(() => {
    const r = mulberry32(seedOf(seed))
    const p = PALETTES[Math.floor(r() * PALETTES.length)]
    const roll = r()
    const style: Style = roll < 0.36 ? "marble" : roll < 0.7 ? "bauhaus" : "orbit"
    const n = () => r()
    return { p, style, v: Array.from({ length: 12 }, n) }
  }, [seed])
  const { p, style, v } = art

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        {/* Film grain: fine turbulence, kept faint, laid over everything. */}
        <filter id={`grain-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0" />
        </filter>
        <radialGradient id={`gloss-${uid}`} cx="28%" cy="18%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`clip-${uid}`}>
          <rect width="64" height="64" />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect width="64" height="64" fill={p.bg} />

        {style === "marble" && (
          <g>
            {/* Colour all the way to the corners — a blob floating on black
                read as an orb, not a mark. */}
            <rect width="64" height="64" fill={p.a} opacity={0.35} />
            <g filter={`url(#blur-${uid})`}>
              <circle cx={v[0] * 64} cy={v[1] * 30} r={26 + v[2] * 8} fill={p.a} />
              <circle cx={v[3] * 64} cy={34 + v[4] * 30} r={22 + v[5] * 8} fill={p.b} opacity={0.95} />
              <circle cx={16 + v[6] * 32} cy={16 + v[7] * 32} r={9 + v[8] * 6} fill={p.c} opacity={0.9} />
            </g>
            {/* One crisp element gives the softness something to sit against. */}
            {v[9] < 0.5 ? (
              <circle cx={18 + v[10] * 28} cy={18 + v[11] * 28} r="7" fill="none" stroke={p.bg} strokeOpacity="0.55" strokeWidth="2.2" />
            ) : (
              <path d={`M ${8 + v[10] * 10} ${50 - v[11] * 6} Q 32 ${18 + v[11] * 12} ${56 - v[10] * 10} ${44 + v[11] * 8}`} fill="none" stroke={p.bg} strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
            )}
          </g>
        )}

        {style === "bauhaus" && (
          <g transform={`rotate(${Math.floor(v[0] * 4) * 90} 32 32)`}>
            <rect width="64" height="64" fill={p.a} opacity={0.14} />
            <circle cx={22 + v[1] * 8} cy={24 + v[2] * 8} r={16 + v[3] * 4} fill={p.a} />
            <path d={`M64 64 L${64 - 30 - v[4] * 8} 64 A ${30 + v[4] * 8} ${30 + v[4] * 8} 0 0 1 64 ${64 - 30 - v[4] * 8} Z`} fill={p.b} />
            <rect x={v[5] * 20} y={44 + v[6] * 6} width={22 + v[7] * 10} height="6" rx="3" fill={p.c} transform={`rotate(${-20 + v[8] * 40} 32 48)`} />
            <circle cx={48 - v[9] * 6} cy={14 + v[10] * 6} r="3.5" fill={p.c} />
          </g>
        )}

        {style === "orbit" && (
          <g>
            <circle cx="32" cy="32" r="30" fill={p.a} opacity={0.12} />
            {[26, 19, 12].map((rad, i) => (
              <circle key={rad} cx="32" cy="32" r={rad} fill="none" stroke={i === 1 ? p.b : p.a} strokeOpacity={0.55 - i * 0.1} strokeWidth="1.4" />
            ))}
            <circle cx="32" cy="32" r="6.5" fill={p.a} />
            {/* The planet, somewhere on the middle orbit. */}
            <circle cx={32 + Math.cos(v[0] * Math.PI * 2) * 19} cy={32 + Math.sin(v[0] * Math.PI * 2) * 19} r="4.5" fill={p.c} />
            <circle cx={32 + Math.cos(v[1] * Math.PI * 2) * 26} cy={32 + Math.sin(v[1] * Math.PI * 2) * 26} r="2.5" fill={p.b} />
          </g>
        )}

        <rect width="64" height="64" filter={`url(#grain-${uid})`} opacity="0.13" style={{ mixBlendMode: "overlay" }} />
        <rect width="64" height="64" fill={`url(#gloss-${uid})`} />
      </g>
    </svg>
  )
}
