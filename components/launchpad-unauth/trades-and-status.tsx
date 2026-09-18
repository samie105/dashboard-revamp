"use client"

/**
 * The trades tape (Stage 3) and the graduation status (Stage 4).
 *
 * ── The tape is ASSUMED, and says so in its own header ────────────────────
 * Recent trades need an index of every curve trade, which does not exist —
 * it is the same missing index that keeps a price-history chart off this
 * page. The plan still calls for a tape, because it is what makes a launch
 * feel alive, so it is here — but the "est." marker sits on the card title
 * rather than on a row, because the whole list is the assumption.
 *
 * Buys and sells take credit and debit, and nothing else on the page does:
 * this is the one list whose rows ARE money moving in a direction.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { StatusScreen } from "@/components/ui/flow"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { Assumed } from "@/components/launchpad-unauth/parts"
import {
  GRADUATION_SOL,
  ago,
  fmtSol,
  fmtTokens,
  shortAddress,
  tradesFor,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"

export function TradesTape({ launch }: { launch: LaunchView }) {
  const trades = React.useMemo(() => tradesFor(launch), [launch])

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Recent trades"
        subtitle={
          launch.status === "live" ? "On the curve" : "Before the curve closed"
        }
        right={
          <Assumed note="needs a curve-trade index that does not exist yet" />
        }
      />
      <div className="flex flex-col px-1 pb-2">
        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/80 uppercase">
          <span>Side</span>
          <span className="text-right">SOL</span>
          <span className="text-right">{launch.symbol}</span>
          <span className="text-right">When</span>
        </div>
        <ul className="slim-scroll flex max-h-[18rem] flex-col overflow-y-auto">
          {trades.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] tabular-nums transition-colors hover:bg-accent/30"
              title={`${t.side === "buy" ? "Bought" : "Sold"} by ${t.wallet}`}
            >
              <span
                className={cn(
                  "font-semibold",
                  t.side === "buy" ? "text-credit" : "text-debit"
                )}
              >
                {t.side === "buy" ? "Buy" : "Sell"}
              </span>
              <span className="truncate text-right">{t.sol.toFixed(3)}</span>
              <span className="truncate text-right text-muted-foreground">
                {fmtTokens(t.tokens)}
              </span>
              <span className="flex items-baseline justify-end gap-2 text-right text-[11.5px] whitespace-nowrap text-muted-foreground">
                <span className="hidden font-mono sm:inline">
                  {shortAddress(t.wallet)}
                </span>
                {ago(t.minutesAgo)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CardShell>
  )
}

/* ── Stage 4: graduation ───────────────────────────────────────────────────
   Where the ticket was, once there is nothing left to buy on the curve: the
   space you would trade in tells you where trading went.

   Built on StatusScreen — the same presentation bridge and funding use — so
   a launch moving to the open market reads like every other staged transfer
   in the product. No ETA and no progress bar: the migration has no published
   duration, and a bar advancing on a guess sets an expectation nobody made. */

const GRADUATION_STAGES = [
  { key: "filled", label: `Curve filled at ${GRADUATION_SOL} SOL` },
  { key: "pool", label: "Pool created, liquidity seeded" },
  { key: "market", label: "Trading on the open market" },
]

export function GraduationStatus({ launch }: { launch: LaunchView }) {
  const done = launch.status === "graduated"

  return (
    <CardShell className={CARD_HUE}>
      <StatusScreen
        state={done ? "success" : "processing"}
        figure={fmtSol(GRADUATION_SOL, 0)}
        headline={
          done
            ? `${launch.symbol} has graduated`
            : `${launch.symbol} is graduating`
        }
        caption={
          done
            ? "The curve is closed. Its SOL and the reserved supply now make up the pool, and the token trades like any other."
            : "The curve is full, so it has stopped selling. The pool is being created from the raised SOL and the reserved supply."
        }
        stages={GRADUATION_STAGES}
        activeIndex={done ? GRADUATION_STAGES.length : 1}
        autoUpdating={!done}
        primary={
          done
            ? { label: `Trade ${launch.symbol}`, href: PREVIEW_ROUTES.markets }
            : undefined
        }
      />
    </CardShell>
  )
}
