"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroup02Icon } from "@hugeicons/core-free-icons"

export function CommunityPageTransition({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ringRefs = useRef<(HTMLDivElement | null)[]>([])
  const iconRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Slide the whole overlay up
          gsap.to(containerRef.current, {
            yPercent: -100,
            duration: 0.6,
            ease: "power3.inOut",
            onComplete,
          })
        },
      })

      // Initial setup
      gsap.set(ringRefs.current, { scale: 0, opacity: 0 })
      gsap.set(iconRef.current, { scale: 0, opacity: 0, rotation: -90 })
      gsap.set(textRef.current, { y: 20, opacity: 0 })

      // Rings expand outward in sequence
      tl.to(ringRefs.current, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        stagger: 0.08,
        ease: "back.out(1.4)",
      })

      // Icon spins in
      tl.to(
        iconRef.current,
        {
          scale: 1,
          opacity: 1,
          rotation: 0,
          duration: 0.5,
          ease: "back.out(2)",
        },
        "-=0.3"
      )

      // Text fades up
      tl.to(
        textRef.current,
        {
          y: 0,
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
        },
        "-=0.2"
      )

      // Pulse the rings
      tl.to(ringRefs.current, {
        scale: 1.05,
        duration: 0.2,
        stagger: 0.04,
        ease: "power1.inOut",
        yoyo: true,
        repeat: 1,
      })

      // Brief hold
      tl.to({}, { duration: 0.2 })
    }, containerRef)

    return () => ctx.revert()
  }, [onComplete])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-background"
      style={{ willChange: "transform" }}
    >
      {/* Decorative orb glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Concentric rings */}
      <div className="relative flex items-center justify-center">
        {[160, 120, 80].map((size, i) => (
          <div
            key={i}
            ref={(el) => { ringRefs.current[i] = el }}
            className="absolute rounded-full border"
            style={{
              width: size,
              height: size,
              borderColor: `hsl(var(--primary) / ${0.08 + i * 0.06})`,
            }}
          />
        ))}

        {/* Center icon */}
        <div
          ref={iconRef}
          className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-primary/10"
        >
          <HugeiconsIcon icon={UserGroup02Icon} size={28} className="text-primary" />
        </div>
      </div>

      {/* Title */}
      <div ref={textRef} className="absolute bottom-[38%] text-center">
        <p className="text-sm font-semibold tracking-wider uppercase text-foreground/80">
          Community
        </p>
        <p className="text-xs text-muted-foreground mt-1">Connect · Chat · Call</p>
      </div>
    </div>
  )
}
