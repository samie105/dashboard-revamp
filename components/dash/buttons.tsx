"use client"

/**
 * Gold for the action, neutral for everything else. A blocked gold button
 * turns neutral grey (not faded gold) and its label names the blocker; busy
 * keeps the gold, because the action was taken and is running.
 */

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type Size = "md" | "lg"
const SIZE: Record<Size, string> = {
  md: "h-11 rounded-xl px-4 text-[14px]",
  lg: "h-[52px] rounded-2xl px-5 text-[15px]",
}

const BASE = "inline-flex items-center justify-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
const NEUTRAL = "border border-foreground/[0.09] bg-foreground/[0.04] text-foreground transition-colors hover:border-foreground/[0.16] hover:bg-foreground/[0.06]"
const BLOCKED = "cursor-not-allowed border border-foreground/[0.07] bg-foreground/[0.04] text-muted-foreground"

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  size?: Size
  busy?: boolean
  fullWidth?: boolean
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

export function GoldButton({ size = "md", busy = false, fullWidth = false, disabled, className, children, ...rest }: ButtonProps) {
  const blocked = disabled && !busy
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(BASE, SIZE[size], blocked ? BLOCKED : "ds-gold", busy && "cursor-progress", fullWidth && "w-full", className)}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function NeutralButton({ size = "md", busy = false, fullWidth = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(BASE, SIZE[size], NEUTRAL, "disabled:cursor-not-allowed disabled:opacity-50", fullWidth && "w-full", className)}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

/** A neutral button that navigates. */
export function NeutralLink({ href, size = "md", className, children }: { href: string; size?: Size; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(BASE, SIZE[size], NEUTRAL, className)}>
      {children}
    </Link>
  )
}

/** Quiet gold text link with an arrow, the preview's "View all". */
export function MoreLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1 text-[13px] font-semibold text-primary outline-none hover:underline focus-visible:underline", className)}>
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </Link>
  )
}
