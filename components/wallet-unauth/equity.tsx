"use client"

/**
 * The wallet hero — one figure on the left, one chain on the right.
 *
 * Deliberately NOT an overview. Earlier drafts put a 30-day value curve and an
 * account-by-account split in the left half, and both were wrong here: a
 * performance chart is what the dashboard is for, and the balance breakdown
 * restated three columns of the balances table a screen further down. A wallet
 * is asked two questions — "how much have I got" and "where do I send it" —
 * so the left half answers the first in as few elements as it can, and the
 * whole right half goes to the second.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
  CoinsSwapIcon,
  CreditCardIcon,
  ChartLineData01Icon,
  EyeIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ActionPill,
  Balance,
  CardShell,
  DeltaChip,
  Eyebrow,
} from "@/components/ui/system"
import { HERO_HUE } from "@/components/ui/surface"
import { ChainPicker } from "@/components/wallet-unauth/chain-picker"
import { useReceiveModal } from "@/components/wallet-unauth/receive-modal"
import {
  WALLET_BTC,
  WALLET_DAY_PCT,
  WALLET_DAY_PNL,
  WALLET_TOTAL,
  formatUSD,
} from "@/components/wallet-unauth/wallet-data"

function hi(icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]) {
  const C = ({ className }: { className?: string }) => <HugeiconsIcon icon={icon} className={className} />
  C.displayName = "HugeIcon"
  return C
}

const Icons = {
  deposit: hi(ArrowDownLeft01Icon),
  withdraw: hi(ArrowUpRight01Icon),
  transfer: hi(ArrowDataTransferHorizontalIcon),
  convert: hi(CoinsSwapIcon),
  buy: hi(CreditCardIcon),
  trade: hi(ChartLineData01Icon),
}

export function Equity() {
  const [hidden, setHidden] = React.useState(false)
  const mask = (s: string) => (hidden ? "••••" : s)
  const receive = useReceiveModal()

  return (
    <div className="flex flex-col gap-4">
      <CardShell className={HERO_HUE}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* ── Left: the figure ────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-6 p-6 lg:p-8">
            <div className="flex items-center gap-2">
              <Eyebrow>Estimated total value</Eyebrow>
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                aria-label={hidden ? "Show balances" : "Hide balances"}
                title={hidden ? "Show balances" : "Hide balances"}
                className={cn(
                  "ws-icon-mono inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                  hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : EyeIcon} className="h-[15px] w-[15px]" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <Balance
                value={formatUSD(WALLET_TOTAL)}
                hidden={hidden}
                className="text-[clamp(2.75rem,5vw,4.25rem)]"
              />
              <span className="flex flex-wrap items-center gap-2">
                {/* A trading platform prices the book in BTC as well as in
                    dollars — it is the unit performance is judged in. */}
                <span className="text-[15px] font-medium tabular-nums text-muted-foreground">
                  ≈ {mask(`${WALLET_BTC.toFixed(5)} BTC`)}
                </span>
                <span aria-hidden className="h-3.5 w-px bg-border" />
                <DeltaChip value={WALLET_DAY_PCT} />
                <span
                  className={cn(
                    "text-[14px] font-semibold tabular-nums",
                    WALLET_DAY_PNL >= 0 ? "text-credit" : "text-debit",
                  )}
                >
                  {mask(`${WALLET_DAY_PNL >= 0 ? "+" : "−"}${formatUSD(Math.abs(WALLET_DAY_PNL))}`)}
                </span>
                <span className="text-[14px] text-muted-foreground">24h</span>
              </span>
            </div>
          </div>

          {/* ── Right: pick a chain, see that chain ───────────────────── */}
          <div className="flex min-w-0 flex-col border-t border-border/40 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
              <Eyebrow>Balances by chain</Eyebrow>
              <span className="text-[11.5px] text-muted-foreground">Pick a chain to see its address</span>
            </div>
            <ChainPicker mask={mask} onReceive={receive.openFor} />
          </div>
        </div>
      </CardShell>

      <div className="scrollbar-none -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        <ActionPill icon={Icons.deposit} label="Deposit" onClick={() => receive.openFor()} />
        <ActionPill icon={Icons.withdraw} label="Withdraw" />
        <ActionPill icon={Icons.transfer} label="Transfer" />
        <ActionPill icon={Icons.convert} label="Convert" />
        <ActionPill icon={Icons.trade} label="Trade" />
        <ActionPill icon={Icons.buy} label="Buy with card" />
      </div>

      {receive.render}
    </div>
  )
}
