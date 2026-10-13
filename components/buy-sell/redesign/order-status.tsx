"use client"

/**
 * The preview's order screen (OrderProgress in components/buy-sell-unauth/
 * ticket.tsx), taking the classic StatusScreen's props so the flows can swap
 * one for the other: badge, headline, caption, staged checklist, the
 * reference with copy, the "updates automatically" line, and the actions.
 */

import * as React from "react"
import { motion } from "motion/react"

import { StatusBadge, Stages } from "@/components/buy-sell/redesign/ticket-parts"
import { TradeGhost } from "@/components/buy-sell/redesign/kit"

type Action = { label: string; onClick?: () => void }

export function TradeStatus({
  state,
  figure,
  headline,
  caption,
  stages,
  activeIndex = 0,
  reference,
  autoUpdating = true,
  notice,
  primary,
  secondary,
}: {
  state: "processing" | "success" | "failure" | "review"
  figure?: string
  headline: string
  caption?: React.ReactNode
  stages?: string[]
  activeIndex?: number
  reference?: string | null
  autoUpdating?: boolean
  notice?: React.ReactNode
  primary?: Action
  secondary?: Action
}) {
  const [copied, setCopied] = React.useState(false)
  return (
    <motion.section aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <StatusBadge state={state === "success" ? "done" : state === "failure" ? "problem" : state === "review" ? "review" : "working"} />
        <div className="flex flex-col gap-1">
          {figure && <span className="font-display text-[15px] font-semibold tabular-nums text-muted-foreground">{figure}</span>}
          <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{headline}</span>
          {caption && <span className="text-[13.5px] leading-relaxed text-muted-foreground">{caption}</span>}
        </div>
      </div>

      {stages && stages.length > 0 && <Stages stages={stages} active={activeIndex} />}

      {notice}

      {(reference || (state === "processing" && autoUpdating)) && (
        <div className="flex flex-col items-center gap-1.5 text-center">
          {reference && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(reference).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
              className="inline-flex max-w-full items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              title="Copy reference"
            >
              <span className="shrink-0">Ref</span>
              <span className="truncate font-mono">{reference}</span>
              <span className={copied ? "shrink-0 font-semibold text-credit" : "shrink-0 font-semibold"}>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
          {state === "processing" && autoUpdating && <span className="text-[11.5px] text-muted-foreground">Updates automatically — you can leave this page.</span>}
        </div>
      )}

      {(primary || secondary) && (
        <div className={primary && secondary ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1"}>
          {secondary && <TradeGhost label={secondary.label} onClick={secondary.onClick} />}
          {primary && (
            <button type="button" onClick={primary.onClick} className="dash-gold-btn h-12 rounded-xl px-4 text-[14px] font-semibold">
              {primary.label}
            </button>
          )}
        </div>
      )}
    </motion.section>
  )
}
