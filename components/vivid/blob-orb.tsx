"use client"

import React, { useRef, useEffect, useCallback } from "react"
import type { VividAgentState } from "@worldstreet/vivid-voice"

interface BlobOrbProps {
  state: VividAgentState
  onClick: () => void
  size?: "sm" | "md" | "lg"
  getAudioLevels: () => Uint8Array
}

const SIZE_CONFIG = {
  sm: { dimension: 72, baseRadius: 22, iconSize: 20 },
  md: { dimension: 88, baseRadius: 28, iconSize: 24 },
  lg: { dimension: 104, baseRadius: 34, iconSize: 28 },
} as const

// Yellow / amber / gold palette matching --primary
const COLORS = {
  centerGold: { r: 224, g: 182, b: 48 },   // ~#E0B630 primary gold
  edgeAmber: { r: 217, g: 158, b: 32 },     // amber-500
  activeOrange: { r: 245, g: 158, b: 11 },  // amber-400

  glowGold: "rgba(224, 182, 48, 0.55)",
  glowError: "rgba(239, 68, 68, 0.5)",

  icon: "rgba(255, 255, 255, 1)",
}

function blobRadius(
  angle: number,
  time: number,
  baseRadius: number,
  amplitude: number,
): number {
  const n1 = Math.sin(angle * 2 + time * 0.9) * 4 * amplitude
  const n2 = Math.sin(angle * 3 - time * 0.7) * 3 * amplitude
  const n3 = Math.cos(angle * 1.5 + time * 1.3) * 2.5 * amplitude
  const n4 = Math.sin(angle * 4 + time * 0.5) * 1.5 * amplitude
  return baseRadius + n1 + n2 + n3 + n4
}

const ACTIVE_STATES = new Set<VividAgentState>([
  "connecting",
  "ready",
  "listening",
  "processing",
  "speaking",
])

export default function BlobOrb({
  state,
  onClick,
  size = "md",
  getAudioLevels,
}: BlobOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number | null>(null)
  const timeRef = useRef(0)
  const { dimension, baseRadius, iconSize } = SIZE_CONFIG[size]

  const isActive = ACTIVE_STATES.has(state)
  const isError = state === "error"

  const drawBlob = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const audioData = getAudioLevels()
      const volume =
        audioData.length > 0
          ? audioData.reduce((a, b) => a + b, 0) / audioData.length / 255
          : 0

      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2

      const amp = isActive ? 0.6 + volume * 1.2 : 0.35
      const radiusBoost = isActive ? volume * 6 : 0
      const effectiveBase = baseRadius + radiusBoost

      // Outer glow halo
      const glowRadius = effectiveBase + 14
      const glowGrad = ctx.createRadialGradient(cx, cy, effectiveBase * 0.5, cx, cy, glowRadius)

      if (isError) {
        glowGrad.addColorStop(0, "rgba(239, 68, 68, 0.3)")
        glowGrad.addColorStop(0.6, "rgba(239, 68, 68, 0.12)")
        glowGrad.addColorStop(1, "rgba(239, 68, 68, 0)")
      } else {
        const glowAlpha = isActive ? 0.35 + volume * 0.3 : 0.2
        glowGrad.addColorStop(0, `rgba(224, 182, 48, ${glowAlpha})`)
        glowGrad.addColorStop(0.5, `rgba(245, 197, 66, ${glowAlpha * 0.5})`)
        glowGrad.addColorStop(1, "rgba(245, 197, 66, 0)")
      }

      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Blob shape path
      const N = 8
      const points: { x: number; y: number }[] = []

      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2
        const r = blobRadius(angle, t, effectiveBase, amp)
        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        })
      }

      ctx.beginPath()
      const firstMid = {
        x: (points[0].x + points[N - 1].x) / 2,
        y: (points[0].y + points[N - 1].y) / 2,
      }
      ctx.moveTo(firstMid.x, firstMid.y)

      for (let i = 0; i < N; i++) {
        const next = points[(i + 1) % N]
        const midX = (points[i].x + next.x) / 2
        const midY = (points[i].y + next.y) / 2
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
      }

      ctx.closePath()

      // Fill gradient
      const fillGrad = ctx.createRadialGradient(
        cx - effectiveBase * 0.2,
        cy - effectiveBase * 0.2,
        effectiveBase * 0.1,
        cx,
        cy,
        effectiveBase * 1.2,
      )

      if (isError) {
        fillGrad.addColorStop(0, "rgba(254, 100, 100, 0.95)")
        fillGrad.addColorStop(0.7, "rgba(220, 50, 50, 0.9)")
        fillGrad.addColorStop(1, "rgba(180, 30, 30, 0.85)")
      } else {
        const { centerGold: cg, edgeAmber: ea, activeOrange: ao } = COLORS
        const orangeBlend = isActive ? Math.min(volume * 1.5, 0.7) : 0.15

        fillGrad.addColorStop(
          0,
          `rgba(${cg.r}, ${cg.g}, ${cg.b}, 0.95)`,
        )
        fillGrad.addColorStop(
          0.5,
          `rgba(${Math.round(ea.r + (ao.r - ea.r) * orangeBlend)}, ${Math.round(
            ea.g + (ao.g - ea.g) * orangeBlend,
          )}, ${Math.round(ea.b + (ao.b - ea.b) * orangeBlend)}, 0.92)`,
        )
        fillGrad.addColorStop(
          1,
          `rgba(${Math.round(ea.r + (ao.r - ea.r) * orangeBlend * 0.6)}, ${Math.round(
            ea.g + (ao.g - ea.g) * orangeBlend * 0.6,
          )}, ${Math.round(ea.b + (ao.b - ea.b) * orangeBlend * 0.6)}, 0.88)`,
        )
      }

      // Shadow glow
      ctx.save()
      ctx.shadowBlur = 20 + (isActive ? volume * 15 : 0)
      ctx.shadowColor = isError ? COLORS.glowError : COLORS.glowGold
      ctx.fillStyle = fillGrad
      ctx.fill()
      ctx.restore()

      // Inner highlight
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      const highlight = ctx.createRadialGradient(
        cx - effectiveBase * 0.15,
        cy - effectiveBase * 0.25,
        0,
        cx,
        cy,
        effectiveBase * 0.8,
      )
      highlight.addColorStop(0, `rgba(255, 255, 255, ${isActive ? 0.12 + volume * 0.1 : 0.08})`)
      highlight.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = highlight
      ctx.fill()
      ctx.restore()
    },
    [baseRadius, isActive, isError, getAudioLevels],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const w = dimension
    const h = dimension
    canvas.width = w * dpr
    canvas.height = h * dpr

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)

    if (isActive) {
      const animate = () => {
        timeRef.current += 0.025
        drawBlob(ctx, w, h, timeRef.current)
        requestRef.current = requestAnimationFrame(animate)
      }
      requestRef.current = requestAnimationFrame(animate)
    } else {
      drawBlob(ctx, w, h, 0)
    }

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current)
        requestRef.current = null
      }
    }
  }, [dimension, isActive, drawBlob])

  const renderIcon = () => {
    if (state === "processing") {
      return (
        <svg
          className="animate-spin"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      )
    }

    if (state === "error") {
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    }

    if (state === "speaking") {
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      )
    }

    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <line x1="12" y1="18" x2="12" y2="21" />
      </svg>
    )
  }

  return (
    <div
      className="relative cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 select-none"
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        pointerEvents: state === "connecting" ? "none" : "auto",
        opacity: state === "connecting" ? 0.7 : 1,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ width: dimension, height: dimension }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ color: COLORS.icon }}
      >
        {renderIcon()}
      </div>
    </div>
  )
}
