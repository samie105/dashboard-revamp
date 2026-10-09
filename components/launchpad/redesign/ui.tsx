"use client"

/**
 * The preview's shared launchpad pieces (components/launchpad-unauth/ui.tsx)
 * on real data: the token mark, status pill, progress-to-graduation bar,
 * chain chips and the paused notice.
 *
 * Swapped for real data: chain availability and the pause reason come from
 * GET /launchpad/availability (the real OperationalControl), not the
 * preview's sessionStorage switch; the reviewer-only "Preview controls" panel
 * is not carried over.
 */

import * as React from "react"
import { motion } from "motion/react"
import { PauseIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { TokenArt } from "@/components/launchpad-unauth/token-art"
import { Icon } from "@/components/dashboard/redesign/ui"
import type { LaunchpadAvailability, LaunchpadToken } from "@/lib/crypto-backend/types"
import { STATUS_LABEL, type ViewStatus } from "@/lib/launchpad-view"

const AVATAR = { sm: "size-8 rounded-[9px]", md: "size-11 rounded-[12px]", lg: "size-16 rounded-[17px]", xl: "size-20 rounded-[21px]" } as const

/** The uploaded icon, or a generated mark seeded from the mint (the one thing
 *  unique per token on Solana), falling back to the ticker. */
export function LaunchAvatar({ symbol, iconUrl, mint, size = "md", className }: { symbol: string; iconUrl?: string | null; mint?: string | null; size?: keyof typeof AVATAR; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block shrink-0 overflow-hidden ring-1 ring-foreground/10", AVATAR[size], className)}>
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="size-full object-cover" />
      ) : (
        <TokenArt seed={mint || symbol || "draft"} className="size-full" />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]" />
    </span>
  )
}

export function StatusPill({ status, raw, className }: { status: ViewStatus; raw: LaunchpadToken["status"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]",
        status === "graduating" ? "bg-warning/[0.12] text-warning" : raw === "failed" ? "bg-debit/[0.12] text-debit" : "bg-foreground/[0.07] text-foreground/75",
        className,
      )}
    >
      {status === "live" && (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-credit opacity-60 motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-credit" />
        </span>
      )}
      {STATUS_LABEL[raw]}
    </span>
  )
}

/** Gold while filling, warm past 75%, full when graduated. */
export function ProgressBar({ bps, status, size = "md", className }: { bps: number; status: ViewStatus; size?: "sm" | "md" | "lg"; className?: string }) {
  const pct = status === "live" || status === "other" ? Math.min(100, bps / 100) : 100
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Progress toward graduation"
      className={cn("relative block overflow-hidden rounded-full bg-foreground/[0.07]", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}
    >
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "absolute inset-0 origin-left rounded-full",
          status === "graduated" ? "bg-credit/80" : status === "graduating" ? "bg-warning" : pct >= 75 ? "bg-gradient-to-r from-primary to-[#ffb020] shadow-[0_0_12px_rgb(250_190_20/0.5)]" : "bg-primary",
        )}
      />
    </span>
  )
}

const CHAIN_ORDER = ["solana", "ethereum", "intertrain"] as const
const CHAIN_LABEL = { solana: "Solana", ethereum: "Ethereum", intertrain: "Intertrain" } as const

export function ChainChips({ availability, className }: { availability: LaunchpadAvailability | undefined; className?: string }) {
  if (!availability) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {CHAIN_ORDER.map((key) => {
        const a = availability[key]
        if (!a) return null
        return (
          <span
            key={key}
            title={a.state === "paused" ? `${CHAIN_LABEL[key]} launches are paused — ${a.reason ?? ""}` : a.state === "soon" ? `${CHAIN_LABEL[key]} launches aren't available yet` : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              a.state === "live" && "border border-credit/25 bg-credit/[0.07] text-foreground",
              a.state === "paused" && "border border-warning/30 bg-warning/[0.1] text-warning",
              a.state === "soon" && "border border-foreground/[0.06] text-muted-foreground/50",
            )}
          >
            {a.state === "live" && <span className="size-1.5 rounded-full bg-credit" />}
            {a.state === "paused" && <Icon icon={PauseIcon} className="size-3" strokeWidth={2.4} />}
            {CHAIN_LABEL[key]}
            {a.state !== "live" && <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{a.state === "paused" ? "Paused" : "Soon"}</span>}
          </span>
        )
      })}
    </div>
  )
}

/** Nothing while Solana is live; when paused, operations' reason verbatim. */
export function PausedNotice({ availability, compact = false }: { availability: LaunchpadAvailability | undefined; compact?: boolean }) {
  const solana = availability?.solana
  if (solana?.state !== "paused") return null
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/[0.07] p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning/[0.15] text-warning">
        <Icon icon={PauseIcon} className="size-4" strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13.5px] font-semibold text-foreground">Solana launches are paused</span>
        <span className="text-[12.5px] leading-relaxed text-foreground/80">“{solana.reason ?? "No reason was given."}”</span>
        {!compact && <span className="text-[12px] text-muted-foreground">Graduated tokens trade on the open market as normal.</span>}
      </div>
    </div>
  )
}

/** The availability query every launchpad screen reads (same key as before). */
export { useLaunchAvailability } from "./use-availability"
