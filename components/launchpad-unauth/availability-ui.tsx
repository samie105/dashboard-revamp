"use client"

/**
 * Availability, as the user sees it — and the control that fakes the switch.
 *
 * Colour: paused takes the WARNING tone, never debit and never gold. It is an
 * operational state, not a loss and not a call to action; amber is what this
 * product already uses for "something is in between" (bridge in flight,
 * graduating, quote about to expire).
 */

import * as React from "react"
import Link from "next/link"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { cn } from "@/lib/utils"
import { Segmented } from "@/components/ui/system"
import { Assumed } from "@/components/launchpad-unauth/parts"
import {
  CHAIN_LABEL,
  CHAIN_ORDER,
  PAUSE_REASONS,
  setSolana,
  useAvailability,
} from "@/components/launchpad-unauth/availability"

/* ── The chain row ──────────────────────────────────────────────────────── */

export function ChainChips() {
  const availability = useAvailability()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11.5px] text-muted-foreground">Chains</span>
      {CHAIN_ORDER.map((key) => {
        const a = availability[key]
        return (
          <span
            key={key}
            title={
              a.state === "paused"
                ? `${CHAIN_LABEL[key]} launches are paused — ${a.reason ?? "no reason given"}`
                : a.state === "soon"
                  ? `${CHAIN_LABEL[key]} launches are not available yet`
                  : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]",
              a.state === "live" && "bg-foreground/[0.07] font-semibold",
              a.state === "paused" &&
                "bg-warning-chip font-semibold text-warning",
              a.state === "soon" &&
                "font-medium text-muted-foreground/60 ring-1 ring-border/50 ring-inset"
            )}
          >
            {a.state === "live" && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-primary"
              />
            )}
            {a.state === "paused" && (
              <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5">
                <rect
                  x="2"
                  y="1.5"
                  width="2"
                  height="7"
                  rx="0.6"
                  fill="currentColor"
                />
                <rect
                  x="6"
                  y="1.5"
                  width="2"
                  height="7"
                  rx="0.6"
                  fill="currentColor"
                />
              </svg>
            )}
            {CHAIN_LABEL[key]}
            {a.state !== "live" && (
              <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase">
                {a.state === "paused" ? "Paused" : "Soon"}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/* ── The notice ─────────────────────────────────────────────────────────── */

/**
 * "Solana launches are paused", with operations' reason shown verbatim and the
 * consequence spelled out. Renders nothing while every built chain is live.
 *
 * The scope of a pause — does it stop curve TRADING, or only new launches? —
 * is a product call. Here it stops both, because a pause is the response to a
 * problem with the curve program and trading touches the program too.
 * Graduated tokens are unaffected: they trade on the AMM, not the curve. That
 * scope is marked assumed.
 */
export function PausedNotice({ compact = false }: { compact?: boolean }) {
  const { solana } = useAvailability()
  if (solana.state !== "paused") return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-chip px-4 py-3"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
      >
        <rect
          x="4"
          y="3"
          width="2.5"
          height="10"
          rx="0.8"
          fill="currentColor"
        />
        <rect
          x="9.5"
          y="3"
          width="2.5"
          height="10"
          rx="0.8"
          fill="currentColor"
        />
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-semibold text-warning">
          Solana launches are paused
        </span>
        <span className="text-[12.5px] leading-relaxed text-foreground/85">
          {solana.reason ?? "No reason was given."}
        </span>
        {!compact && (
          <span className="inline-flex flex-wrap items-center text-[12px] leading-relaxed text-muted-foreground">
            New launches and trading on curves are stopped until this is lifted.
            Tokens that have graduated trade normally.
            <Assumed note="what a pause stops is a product call — here, launches and curve trades" />
          </span>
        )}
      </div>
    </div>
  )
}

/* ── The reviewer control ───────────────────────────────────────────────── */

/**
 * Stands in for the operations switch. Dashed and labelled, like the
 * lifecycle's control, so nobody reviewing a screenshot mistakes it for part
 * of the product. It changes Solana only: Ethereum and Intertrain are not
 * built, and "paused" would claim an adapter that does not exist.
 */
export function AvailabilityReviewer() {
  const { solana } = useAvailability()
  const reasonIndex = Math.max(
    0,
    PAUSE_REASONS.findIndex((r) => r === solana.reason)
  )

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-foreground/25 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Reviewer control — not part of the product
        </span>
        <span className="text-[12px] leading-relaxed text-muted-foreground">
          Stands in for the operations switch (
          <code className="font-mono">OperationalControl</code>). Pause Solana
          here and every launchpad page responds — discovery, the create form
          and every curve ticket.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-medium">Solana</span>
        <Segmented
          size="sm"
          options={[
            { key: "live", label: "Live" },
            { key: "paused", label: "Paused" },
          ]}
          value={solana.state === "paused" ? "paused" : "live"}
          onChange={(next) =>
            setSolana(
              next === "paused"
                ? { state: "paused", reason: PAUSE_REASONS[reasonIndex] }
                : { state: "live" }
            )
          }
        />
      </div>
      {solana.state === "paused" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium">Reason shown to users</span>
          <select
            value={reasonIndex}
            onChange={(e) =>
              setSolana({
                state: "paused",
                reason: PAUSE_REASONS[Number(e.target.value)],
              })
            }
            className="h-10 w-full min-w-0 rounded-xl bg-foreground/[0.05] px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {PAUSE_REASONS.map((r, i) => (
              <option
                key={r}
                value={i}
                className="bg-popover text-popover-foreground"
              >
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

/* ── The primary action ─────────────────────────────────────────────────── */

/**
 * "Launch a token", unless launching is paused — then it says so instead of
 * leading to a form that cannot submit. A disabled gold button would still
 * read as the thing to press; this one stops being gold.
 */
export function LaunchCta() {
  const { solana } = useAvailability()
  if (solana.state === "paused") {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground/[0.08] px-6 text-[14px] font-bold text-muted-foreground"
      >
        Launches are paused
      </span>
    )
  }
  return (
    <Link
      href={`${PREVIEW_ROUTES.launchpad}/create`}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-bold text-primary-foreground shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      Launch a token
    </Link>
  )
}
