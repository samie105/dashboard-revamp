"use client"

/**
 * A shortened address that copies the full one.
 *
 * Both ends stay visible — `7xKX…9fQa` — because an address truncated from
 * one side cannot be checked against the one you pasted, which is the only
 * reason to show it at all.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { shortAddress } from "@/components/launchpad-unauth/launch-data"

export function CopyAddress({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  React.useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {})
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1600)
      }}
      title={`Copy ${label.toLowerCase()} ${value}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11.5px] transition-colors hover:bg-accent/60",
        copied ? "text-credit" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="font-mono">
        {copied ? "Copied" : shortAddress(value)}
      </span>
    </button>
  )
}
