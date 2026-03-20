"use client"

import { useEffect, useRef, useMemo } from "react"
import gsap from "gsap"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroup02Icon } from "@hugeicons/core-free-icons"

export function CommunityPageTransition({ onComplete }: { onComplete: () => void }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const orb2Ref = useRef<HTMLDivElement>(null)
  const ringRefs = useRef<(HTMLDivElement | null)[]>([])
  const iconRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const particleRefs = useRef<(HTMLDivElement | null)[]>([])
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const tl = gsap.timeline({
      onComplete: () => {
        // Exit: scale up + fade out the entire overlay
        gsap.to(container, {
          opacity: 0,
          scale: 1.08,
          duration: 0.45,
          ease: "power3.inOut",
          onComplete: () => onCompleteRef.current(),
        })
      },
    })

    // Initial setup
    gsap.set(ringRefs.current, { scale: 0, opacity: 0 })
    gsap.set(iconRef.current, { scale: 0, opacity: 0, rotation: -180 })
    gsap.set(textRef.current, { y: 30, opacity: 0 })
    gsap.set(particleRefs.current, { scale: 0, opacity: 0 })
    gsap.set(lineRefs.current, { scaleX: 0, opacity: 0 })
    gsap.set(gridRef.current, { opacity: 0 })
    gsap.set(orbRef.current, { scale: 0.3, opacity: 0 })
    gsap.set(orb2Ref.current, { scale: 0.3, opacity: 0 })

    // Phase 1: Background orbs bloom
    tl.to(orbRef.current, { scale: 1, opacity: 1, duration: 0.6, ease: "power2.out" }, 0)
    tl.to(orb2Ref.current, { scale: 1, opacity: 0.6, duration: 0.6, ease: "power2.out" }, 0.1)
    tl.to(gridRef.current, { opacity: 0.4, duration: 0.4, ease: "power1.in" }, 0.1)

    // Phase 2: Rings cascade outward
    tl.to(ringRefs.current, {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      stagger: 0.06,
      ease: "elastic.out(1, 0.6)",
    }, 0.15)

    // Phase 3: Radial lines emerge
    tl.to(lineRefs.current, {
      scaleX: 1,
      opacity: 0.5,
      duration: 0.3,
      stagger: 0.02,
      ease: "power2.out",
    }, 0.3)

    // Phase 4: Icon dynamic entry
    tl.to(
      iconRef.current,
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.6,
        ease: "back.out(2.5)",
      },
      0.35,
    )

    // Phase 5: Particles scatter
    tl.to(particleRefs.current, {
      scale: 1,
      opacity: 1,
      duration: 0.4,
      stagger: { each: 0.03, from: "random" },
      ease: "back.out(1.5)",
    }, 0.5)

    // Phase 6: Text reveal
    tl.to(
      textRef.current,
      {
        y: 0,
        opacity: 1,
        duration: 0.35,
        ease: "power3.out",
      },
      0.6,
    )

    // Phase 7: Icon glow pulse
    tl.to(iconRef.current, {
      boxShadow: isDark
        ? "0 0 60px 20px hsl(var(--primary) / 0.3)"
        : "0 0 60px 20px hsl(var(--primary) / 0.15)",
      duration: 0.3,
      ease: "power1.inOut",
      yoyo: true,
      repeat: 1,
    })

    // Phase 8: Breathe — rings and particles pulse
    tl.to(ringRefs.current, {
      scale: 1.08,
      duration: 0.25,
      stagger: 0.03,
      ease: "power1.inOut",
      yoyo: true,
      repeat: 1,
    }, "-=0.4")

    tl.to(particleRefs.current, {
      y: "-=6",
      duration: 0.3,
      stagger: { each: 0.02, from: "random" },
      ease: "power1.inOut",
      yoyo: true,
      repeat: 1,
    }, "-=0.5")

    // Brief hold
    tl.to({}, { duration: 0.15 })

    return () => { tl.kill() }
  }, [isDark])

  const particles = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const radius = 100 + (((i * 7 + 3) % 11) / 11) * 40
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: 2 + (((i * 5 + 2) % 9) / 9) * 3,
      opacity: isDark
        ? 0.4 + (((i * 3 + 1) % 7) / 7) * 0.3
        : 0.2 + (((i * 3 + 1) % 7) / 7) * 0.2,
    }
  }), [isDark])

  const lines = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * 360,
  }))

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-background"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Dot grid background */}
      <div
        ref={gridRef}
        className="absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(circle, hsl(var(--primary) / 0.12) 1px, transparent 1px)"
            : "radial-gradient(circle, hsl(var(--primary) / 0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Primary orb */}
      <div
        ref={orbRef}
        className="absolute rounded-full blur-3xl"
        style={{
          width: 400,
          height: 400,
          background: isDark
            ? "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)"
            : "radial-gradient(circle, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
      />

      {/* Secondary accent orb */}
      <div
        ref={orb2Ref}
        className="absolute rounded-full blur-3xl"
        style={{
          width: 250,
          height: 250,
          transform: "translate(80px, -60px)",
          background: isDark
            ? "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)"
            : "radial-gradient(circle, hsl(var(--primary) / 0.05), transparent 70%)",
        }}
      />

      {/* Radial lines */}
      {lines.map((line, i) => (
        <div
          key={`line-${i}`}
          ref={(el) => { lineRefs.current[i] = el }}
          className="absolute origin-left"
          style={{
            width: 120,
            height: 1,
            transform: `rotate(${line.angle}deg)`,
            transformOrigin: "0% 50%",
            left: "50%",
            top: "50%",
            background: isDark
              ? `linear-gradient(90deg, hsl(var(--primary) / 0.2), transparent)`
              : `linear-gradient(90deg, hsl(var(--primary) / 0.1), transparent)`,
          }}
        />
      ))}

      {/* Concentric rings — lighter borders */}
      {[200, 150, 100, 60].map((size, i) => (
        <div
          key={i}
          ref={(el) => { ringRefs.current[i] = el }}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            border: `1px solid`,
            borderColor: isDark
              ? `hsl(var(--primary) / ${0.06 + i * 0.04})`
              : `hsl(var(--primary) / ${0.04 + i * 0.03})`,
            boxShadow: isDark
              ? `0 0 ${8 + i * 4}px hsl(var(--primary) / ${0.02 + i * 0.01})`
              : "none",
          }}
        />
      ))}

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={`particle-${i}`}
          ref={(el) => { particleRefs.current[i] = el }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            transform: `translate(${p.x}px, ${p.y}px)`,
            background: `hsl(var(--primary) / ${p.opacity})`,
            boxShadow: isDark ? `0 0 6px hsl(var(--primary) / 0.2)` : "none",
          }}
        />
      ))}

      {/* Center icon */}
      <div
        ref={iconRef}
        className="relative z-10 flex items-center justify-center w-18 h-18 rounded-full"
        style={{
          background: isDark
            ? "hsl(var(--primary) / 0.12)"
            : "hsl(var(--primary) / 0.06)",
          backdropFilter: "blur(8px)",
        }}
      >
        <HugeiconsIcon icon={UserGroup02Icon} size={32} className="text-primary" />
      </div>

      {/* Title */}
      <div ref={textRef} className="absolute mt-52 text-center">
        <p className="text-sm font-bold tracking-widest uppercase text-foreground/80">
          Community
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 tracking-wide">
          Connect · Chat · Call
        </p>
      </div>
    </div>
  )
}
