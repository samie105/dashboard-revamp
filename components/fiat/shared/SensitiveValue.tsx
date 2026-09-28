"use client"

/**
 * A provider display value with copy, and masking for sensitive bank details
 * (guide lines 856-858: "masking/copy controls appropriate for sensitive bank
 * details"). Plain text only; the value is never logged or stored.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { maskValue } from "@/lib/crypto-backend/fiat-display"

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function SensitiveValue({ value, sensitive }: { value: string; sensitive: boolean }) {
  const [revealed, setRevealed] = React.useState(!sensitive)
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono tabular-nums">{revealed ? value : maskValue(value)}</span>
      {sensitive && (
        <Button variant="ghost" size="xs" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Show"}
        </Button>
      )}
      <CopyButton value={value} />
    </span>
  )
}
