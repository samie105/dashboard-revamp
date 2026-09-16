"use client"

/**
 * The swap workspace.
 *
 * It exists to own ONE pair. The rate chart and the swap card both need to
 * know which two tokens are in play, and letting each hold its own copy is
 * how a page ends up charting one pair while quoting another — the same class
 * of split-brain fault as the live trade screen pricing SOL at two different
 * numbers on one page.
 */

import * as React from "react"
import { RateChart } from "@/components/swap-unauth/rate-chart"
import { SwapCard } from "@/components/swap-unauth/swap-card"
import { DEFAULT_FROM, DEFAULT_TO } from "@/components/swap-unauth/swap-data"

export function SwapWorkspace() {
  const [fromKey, setFromKey] = React.useState(DEFAULT_FROM)
  const [toKey, setToKey] = React.useState(DEFAULT_TO)

  return (
    <div className="flex flex-col gap-4">
      <RateChart fromKey={fromKey} toKey={toKey} />
      <SwapCard fromKey={fromKey} toKey={toKey} onFromKey={setFromKey} onToKey={setToKey} />
    </div>
  )
}
