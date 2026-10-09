"use client"

/**
 * The preview's bridge page body (components/bridge-unauth/workspace.tsx) on
 * real data: the form, and beside it the lane, what's moving now, and what
 * moved before.
 *
 * Swapped for real data:
 *  · Lane — the one real lane, drawn the same way. Its stat strip keeps the
 *    preview's shape but states what the backend does publish (rate, status)
 *    and "—" for the limits it doesn't; there is no liquidity figure, so the
 *    liquidity bar becomes the lane's live status (with the backend's reason
 *    when it is paused or unavailable).
 *  · Moving now — bridge deposits the ledger still has in flight, placed on
 *    the three real stages, with no percentage and no countdown (the ledger
 *    carries neither). The old page's "approval still confirming" state is
 *    kept here.
 *  · Recent bridges — settled and failed deposits from the same ledger, with
 *    how long they took when both timestamps exist, and an explorer link.
 * Added: loading skeletons and the empty states.
 */

import * as React from "react"
import { motion } from "motion/react"
import { ArrowRight01Icon, Clock01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, Icon, MoreLink, Panel, PanelTitle } from "@/components/dashboard/redesign/ui"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { BRIDGE_STAGES, agoLabel, bridgeRows, failedOf, stageOf, tookLabel, type BridgeRow } from "@/lib/bridge-view"
import { BridgeTicket, DEST, SOURCE, useBridgeStatus } from "@/components/bridge/redesign/ticket"

function useNow(every = 30_000) {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return now
}

function Pair({ size = "size-8" }: { size?: string }) {
  return (
    <span className="flex shrink-0 items-center -space-x-2">
      <CoinAvatar symbol={SOURCE.mark} src={SOURCE.icon} size="lg" className={cn(size, "ring-2 ring-card")} />
      <CoinAvatar symbol={DEST.mark} src={DEST.icon} size="lg" className={cn(size, "ring-2 ring-card")} />
    </span>
  )
}

function SkeletonList({ rows = 2 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2">
          <span className="skel size-8 shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="skel h-3.5 w-36 rounded" />
            <span className="skel h-3 w-24 rounded" />
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ── Lane card ────────────────────────────────────────────────────────── */

function LaneCard() {
  const status = useBridgeStatus()
  const live = status.data?.available === true
  const state = status.isLoading ? "Checking…" : live ? "Live" : status.data?.paused ? "Paused" : "Unavailable"

  return (
    <Panel className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <PanelTitle className="text-[16px]">Lane</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">via the verified bridge contract</span>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="flex flex-col items-center gap-2 text-center">
          <CoinAvatar symbol={SOURCE.mark} src={SOURCE.icon} size="lg" className="size-12 ring-1 ring-foreground/10" />
          <span className="text-[12.5px] font-semibold text-foreground">{SOURCE.name}</span>
          <span className="text-[11px] text-muted-foreground">{SOURCE.asset}</span>
        </span>
        <span className="relative mx-1 flex h-12 items-center">
          <span className="h-px w-full border-t border-dashed border-primary/35" />
          {live && (
            <motion.span
              animate={{ left: ["0%", "100%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
            />
          )}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-foreground/[0.08] bg-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
            1 : 1
          </span>
        </span>
        <span className="flex flex-col items-center gap-2 text-center">
          <CoinAvatar symbol={DEST.mark} src={DEST.icon} size="lg" className="size-12 ring-1 ring-foreground/10" />
          <span className="text-[12.5px] font-semibold text-foreground">{DEST.name}</span>
          <span className="text-[11px] text-muted-foreground">{DEST.asset}</span>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.06] sm:grid-cols-4">
        {[
          { k: "Rate", v: `1 ${SOURCE.asset} = 1 ${DEST.asset}` },
          { k: "Fee", v: "—" },
          { k: "Minimum", v: "—" },
          { k: "Maximum", v: "—" },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-1 bg-card px-3.5 py-3 dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
            <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
            <dd className="truncate text-[13.5px] font-semibold tabular-nums text-foreground">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-muted-foreground">Lane status</span>
          <span className={cn("font-semibold", live ? "text-credit" : status.isLoading ? "text-muted-foreground" : "text-warning")}>{state}</span>
        </div>
        <span className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
          {!status.isLoading && (
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={cn("absolute inset-0 origin-left rounded-full", live ? "bg-credit/80" : "bg-warning")}
            />
          )}
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          {status.isLoading
            ? "Checking the bridge…"
            : live
              ? "Open — WSK is minted after Arbitrum finality and Intertrain consensus."
              : status.data?.reason ?? (status.isError ? "Couldn't reach the bridge status. Try again shortly." : "The bridge isn't taking deposits right now.")}
        </span>
      </div>
    </Panel>
  )
}

/* ── Moving now ───────────────────────────────────────────────────────── */

function MovingNow({ rows, loading, awaitingApproval }: { rows: BridgeRow[]; loading: boolean; awaitingApproval: boolean }) {
  const now = useNow()
  const moving = rows.length

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <PanelTitle className="text-[16px]">Moving now</PanelTitle>
          {moving > 0 && (
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
          )}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">{moving > 0 ? `${moving} in flight` : "Nothing moving"}</span>
      </div>

      {awaitingApproval && (
        <div className="flex flex-col gap-1 rounded-2xl border border-warning/25 bg-warning/[0.06] p-3.5">
          <span className="text-[12.5px] font-semibold text-warning">Approval still confirming</span>
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            You&apos;ve approved USDC for the bridge and Arbitrum is still confirming it. The deposit starts on its own once that lands.
          </span>
        </div>
      )}

      {loading && moving === 0 ? (
        <SkeletonList />
      ) : moving === 0 ? (
        !awaitingApproval && <p className="px-1 py-3 text-[13px] text-muted-foreground">No bridges in flight. Ones you start appear here until the WSK lands.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((x) => {
            const stage = stageOf(x.status)
            const s = BRIDGE_STAGES[Math.max(0, stage)]
            const href = x.txHash ? explorerTxUrl(x.networkId || SOURCE.id, x.txHash) : null
            return (
              <li key={x.id} className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] p-3.5">
                <div className="flex items-center gap-3">
                  <Pair />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13.5px] font-semibold text-foreground">
                      <Figure mask="••••">{x.amount ? `${x.amount} ${SOURCE.asset}` : `— ${SOURCE.asset}`}</Figure>
                      <span className="font-medium text-muted-foreground"> → {DEST.name}</span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {s.label} · {agoLabel(x.at, now) || s.detail}
                    </span>
                  </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-foreground/80 hover:text-primary">
                      <Icon icon={Clock01Icon} className="size-3.5" />
                      In flight
                      <Icon icon={LinkSquare02Icon} className="size-3 text-muted-foreground/60" />
                    </a>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-foreground/80">
                      <Icon icon={Clock01Icon} className="size-3.5" />
                      In flight
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {BRIDGE_STAGES.map((st, i) => (
                    <span key={st.key} className="relative h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                      {i < stage && <span className="absolute inset-0 rounded-full bg-credit/80" />}
                      {i === stage && (
                        <motion.span
                          animate={{ x: ["-100%", "300%"] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
                        />
                      )}
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ── History ──────────────────────────────────────────────────────────── */

function History({ rows, loading }: { rows: BridgeRow[]; loading: boolean }) {
  const now = useNow()

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex items-center justify-between px-2">
        <PanelTitle className="text-[16px]">Recent bridges</PanelTitle>
        <MoreLink icon={ArrowRight01Icon} href="/transactions">
          All
        </MoreLink>
      </div>
      {loading && rows.length === 0 ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <p className="px-2 pb-2 text-[13px] text-muted-foreground">No bridges yet. USDC you move into Intertrain lands here once it settles.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.slice(0, 6).map((h) => {
            const failed = failedOf(h.status)
            const took = tookLabel(h)
            const href = h.txHash ? explorerTxUrl(h.networkId || SOURCE.id, h.txHash) : null
            const body = (
              <>
                <Pair />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                    <span className="truncate">
                      {SOURCE.name} → {DEST.name}
                    </span>
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]", failed ? "bg-debit/[0.12] text-debit" : "bg-credit/[0.1] text-credit")}>
                      {failed ? "Failed" : "Landed"}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {[took ? `took ${took}` : null, agoLabel(h.at, now) || null].filter(Boolean).join(" · ") || " "}
                  </span>
                </span>
                <span className="flex flex-col items-end tabular-nums">
                  <span className={cn("text-[13px] font-semibold", failed ? "text-muted-foreground" : "text-credit")}>
                    <Figure mask="••••">{failed ? "Not sent" : h.amount ? `+${h.amount} ${DEST.asset}` : "—"}</Figure>
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    <Figure mask="••••">{h.amount ? `${h.amount} ${SOURCE.asset}` : "—"}</Figure>
                  </span>
                </span>
              </>
            )
            const cls = "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-foreground/[0.025]"
            return (
              <li key={h.id}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function BridgeWorkspace() {
  const { records, loading } = useLedgerRecords(50)
  const { inFlight, done, awaitingApproval } = React.useMemo(() => bridgeRows(records), [records])

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <BridgeTicket />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <div className="rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
          <LaneCard />
        </div>
        <div className="rise grid grid-cols-1 items-start gap-4 md:gap-5 2xl:grid-cols-2" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
          <MovingNow rows={inFlight} loading={loading} awaitingApproval={awaitingApproval} />
          <History rows={done} loading={loading} />
        </div>
      </div>
    </div>
  )
}

