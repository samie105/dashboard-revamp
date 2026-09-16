"use client"

/**
 * The trading shell — the action bar plus the workspace.
 *
 * It exists so the page can stay a server component while Deposit, Transfer
 * and Withdraw still open the same modal state the workspace renders. The
 * live screen puts these three in the top bar too; what it does not do is
 * give any of them a state after you press the button.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { TradeWorkspace } from "@/components/trade-unauth/workspace"
import { FUTURES_EQUITY } from "@/components/trade-unauth/futures-data"
import type { FlowKind } from "@/components/trade-unauth/transfer-modal"

const ACTIONS: { key: FlowKind; label: string; icon: typeof ArrowDownLeft01Icon; primary?: boolean }[] = [
  { key: "deposit", label: "Deposit", icon: ArrowDownLeft01Icon, primary: true },
  { key: "transfer", label: "Transfer", icon: ArrowDataTransferHorizontalIcon },
  { key: "withdraw", label: "Withdraw", icon: ArrowUpRight01Icon },
]

export function TradeShell() {
  const [flow, setFlow] = React.useState<FlowKind | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {/* Stacks on a phone: side by side, the balance and three buttons wrapped
          into three ragged rows with Deposit stranded on its own. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {/* The trading balance, stated where the funding actions are. The
            live bar has the three buttons and no balance beside them, so
            "Deposit" is an instruction with no context. */}
        <span className="flex items-baseline gap-2 sm:mr-auto">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Trading balance
          </span>
          <span className="font-display text-[17px] font-semibold tabular-nums">
            ${FUTURES_EQUITY.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            ${FUTURES_EQUITY.available.toLocaleString("en-US", { maximumFractionDigits: 0 })} free
          </span>
        </span>

        {/* Equal thirds on a phone; natural width from `sm` up. */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setFlow(a.key)}
            className={cn(
              "ws-icon-mono inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors sm:px-4",
              a.primary
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={a.icon} className="h-4 w-4" />
            {a.label}
          </button>
        ))}
        </div>
      </div>

      <TradeWorkspace flow={flow} onFlow={setFlow} />
    </div>
  )
}
