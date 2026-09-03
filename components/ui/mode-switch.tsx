"use client"

import * as React from "react"

import { Segmented } from "@/components/ui/system"
import { useUiMode } from "@/components/ui-mode-provider"
import type { UiMode } from "@/lib/ui-mode"

/* One tab system, house rule: this is `Segmented`, not a new control. It is
   `sm` everywhere it appears, because it always sits beside a page title or
   in a dense top bar and must read as chrome rather than as the page's
   primary choice — the primary choice on a wallet is Deposit. */
const OPTIONS = [
  { key: "simple" as const, label: "Simple" },
  { key: "pro" as const, label: "Pro" },
]

/**
 * The Simple / Pro switch.
 *
 * Deliberately not labelled "Beginner" — nobody wants to press a button that
 * calls them one, and the mode is a preference about density, not a
 * statement about the person. "Simple" describes the screen.
 */
export function ModeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useUiMode()

  return (
    <div className={className}>
      <span className="sr-only" id="ui-mode-label">
        How much detail this screen shows
      </span>
      <Segmented<UiMode>
        size="sm"
        value={mode}
        onChange={setMode}
        options={OPTIONS}
        vividPrefix="ui-mode"
      />
    </div>
  )
}
