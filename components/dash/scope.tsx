/**
 * The redesign's type, scoped to one subtree.
 *
 * Plus Jakarta Sans for the interface and Sora for display figures, the same
 * faces the previews load (components/redesign/fonts.ts). Only what's inside
 * <DashScope> changes; the rest of the app keeps Public Sans and Poppins until
 * the lead decides on an app-wide switch. `--font-display` is re-pointed on
 * the wrapper, so existing `font-display` components inside it pick up Sora.
 * Unlike the preview's .dash-root it paints no background: surfaces come from
 * the theme tokens.
 */

import * as React from "react"

import { dashDisplay, dashSans } from "@/components/redesign/fonts"
import { cn } from "@/lib/utils"

export function DashScope({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className={cn("dash-scope", dashSans.variable, dashDisplay.variable, className)}
      style={{ "--font-display": "var(--font-dash-display)", ...style } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
