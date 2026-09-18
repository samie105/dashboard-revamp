"use client"

/**
 * Stage 4 — what happens after "Launch".
 *
 * Built on StatusScreen, the presentation bridge and futures funding already
 * use, so a launch in flight reads like every other staged transfer in the
 * product rather than inventing a fourth dialect.
 *
 * ── The reviewer control ──────────────────────────────────────────────────
 * The states are stepped through by hand, with a control that is labelled as
 * not part of the product. They are NOT auto-advanced on a timer. A timer
 * would be a guessed duration dressed as progress — exactly what this
 * redesign removed from the bridge page and keeps off every launchpad screen.
 * Stepping by hand lets each state be reviewed for as long as it takes, and
 * lets "failed" be reviewed at all, which a happy-path timer never would.
 *
 * ── It outlives the tab ───────────────────────────────────────────────────
 * Every state change is written to `pending-launch`. Close the page while it
 * is signing or confirming and the launchpad offers to resume it — see
 * `ResumeBanner` below.
 */

import * as React from "react"
import Link from "next/link"
import { CardShell, Segmented } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { StatusScreen } from "@/components/ui/flow"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { LaunchCard } from "@/components/launchpad-unauth/launch-card"
import {
  draftAsLaunch,
  fmtPct,
  fmtSol,
  type Draft,
} from "@/components/launchpad-unauth/launch-data"
import {
  IN_FLIGHT,
  savePending,
  usePendingLaunch,
  type LifecycleState,
} from "@/components/launchpad-unauth/pending-launch"

/* The steps a launch reports. One transaction, so there is no partial
   success: either all of this lands or none of it does. */
const DEPLOY_STAGES = [
  { key: "signed", label: "Signed on this device" },
  { key: "sent", label: "Sent to Solana" },
  { key: "confirmed", label: "Confirmed — token and curve created" },
  { key: "open", label: "Open for trading" },
]

const ACTIVE_INDEX: Record<LifecycleState, number> = {
  signing: 0,
  confirming: 2,
  live: DEPLOY_STAGES.length,
  // Failed at confirmation: signed and sent, never confirmed.
  failed: 2,
}

const REVIEW_STATES: { key: LifecycleState; label: string }[] = [
  { key: "signing", label: "Signing" },
  { key: "confirming", label: "Confirming" },
  { key: "live", label: "Live" },
  { key: "failed", label: "Failed" },
]

/** Solana's base fee is 5,000 lamports per signature — a chain constant, not a
 *  preview assumption, which is why it is stated plainly below. */
const BASE_FEE_SOL = 0.000005

export function LaunchLifecycle({
  draft,
  totalSol,
  onEdit,
  onStartOver,
}: {
  draft: Draft
  totalSol: number
  /** Back to the form with the draft intact. */
  onEdit: () => void
  /** Clear everything and begin a new launch. */
  onStartOver: () => void
}) {
  const pending = usePendingLaunch()
  // The stored record is the source of truth, exactly as the server record
  // would be in production. Before it has been read, show the first state.
  const state: LifecycleState = pending?.state ?? "signing"
  const startedAt = pending?.startedAt ?? null
  const symbol = draftAsLaunch(draft).symbol

  const setState = (next: LifecycleState) =>
    savePending({ draft, state: next, startedAt: Date.now() })

  const inFlight = IN_FLIGHT.includes(state)

  return (
    <CardShell className={CARD_HUE}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col justify-center p-2 sm:p-4 lg:p-6">
          <StatusScreen
            state={
              state === "live"
                ? "success"
                : state === "failed"
                  ? "failure"
                  : "processing"
            }
            figure={fmtSol(totalSol, 3)}
            headline={
              state === "signing"
                ? "Waiting for your signature"
                : state === "confirming"
                  ? `Creating $${symbol}`
                  : state === "live"
                    ? `$${symbol} is live`
                    : "The launch didn't go through"
            }
            caption={
              state === "signing" ? (
                "Approve the launch in your wallet. Nothing is sent until you do."
              ) : state === "confirming" ? (
                <>
                  It&apos;s with Solana now.{" "}
                  <span className="font-semibold text-foreground">
                    You can close this page
                  </span>{" "}
                  — the launch carries on, and the launchpad will offer to bring
                  you back to it.
                </>
              ) : state === "live" ? (
                `The curve is open and $${symbol} can be bought and sold.${
                  draft.creatorBps > 0
                    ? ` Your ${fmtPct(draft.creatorBps)} allocation is in your wallet.`
                    : ""
                }`
              ) : (
                <>
                  Solana didn&apos;t confirm it in time, so nothing was created.
                  A launch is all or nothing: your creation fee
                  {draft.creatorBps > 0 ? " and allocation" : ""} were never
                  taken. Only the network fee for the attempt — {BASE_FEE_SOL}{" "}
                  SOL — was spent.
                </>
              )
            }
            stages={DEPLOY_STAGES}
            activeIndex={ACTIVE_INDEX[state]}
            stageStartedAt={inFlight ? startedAt : null}
            autoUpdating={inFlight}
            primary={
              state === "failed"
                ? { label: "Try again", onClick: () => setState("signing") }
                : state === "live"
                  ? {
                      label: "Back to launches",
                      href: PREVIEW_ROUTES.launchpad,
                    }
                  : undefined
            }
            secondary={
              state === "failed"
                ? { label: "Edit the launch", onClick: onEdit }
                : state === "live"
                  ? { label: "Launch another", onClick: onStartOver }
                  : undefined
            }
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 border-t border-border/40 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7">
          <div className="flex flex-col gap-2">
            <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {/* The card shows the token as it will look once live. While it is
                  still signing, or after a failure, that is a preview — the
                  token does not exist, so it is not "on the curve" yet. */}
              {state === "live"
                ? "Your launch"
                : "How it will appear once live"}
            </span>
            <LaunchCard
              launch={{
                ...draftAsLaunch(draft),
                // Live means it launched just now; otherwise it hasn't.
                minutesAgo: state === "live" ? 0 : -1,
              }}
            />
          </div>

          {/* Plainly not the product. Dashed, labelled, and set apart, so
              nobody reviewing a screenshot mistakes it for a real control. */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-foreground/25 p-3.5">
            <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Reviewer control — not part of the product
            </span>
            <span className="text-[11.5px] leading-relaxed text-muted-foreground">
              Steps through the states the real launch would report. Pick one
              and leave it there for as long as you need.
            </span>
            <div className="scrollbar-none min-w-0 overflow-x-auto">
              <Segmented
                size="sm"
                options={REVIEW_STATES}
                value={state}
                onChange={setState}
              />
            </div>
          </div>

          {/* Only while in flight. Once it settles, StatusScreen's own actions
              include the way back, and a second link would repeat it. */}
          {inFlight && (
            <Link
              href={PREVIEW_ROUTES.launchpad}
              className="text-center text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {inFlight
                ? "Leave this page — the launch carries on"
                : "Back to launches"}
            </Link>
          )}
        </aside>
      </div>
    </CardShell>
  )
}

/**
 * "You have a launch in progress", on the pages you would come back to.
 *
 * Only while it is IN FLIGHT. A finished launch is not something to resume,
 * and a banner that outlived its launch would be noise on every visit.
 */
export function ResumeBanner({ onResume }: { onResume?: () => void }) {
  const pending = usePendingLaunch()
  if (!pending || !IN_FLIGHT.includes(pending.state)) return null
  const symbol = pending.draft.symbol || "your token"

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1 text-[13px]">
        <span className="font-semibold">${symbol} is still launching</span>
        <span className="text-muted-foreground">
          {" "}
          —{" "}
          {pending.state === "signing"
            ? "waiting for your signature"
            : "confirming on Solana"}
          .
        </span>
      </span>
      {onResume ? (
        <button
          type="button"
          onClick={onResume}
          className="rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Resume
        </button>
      ) : (
        <Link
          href={`${PREVIEW_ROUTES.launchpad}/create`}
          className="rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Resume
        </Link>
      )}
    </div>
  )
}
