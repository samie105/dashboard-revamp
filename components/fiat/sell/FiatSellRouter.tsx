"use client"

/**
 * Select the live fiat sell rail from backend capability discovery.
 *
 * OnSwitch remains the local-fiat flow and Bridge is the USD flow. The router
 * only presents a rail when the backend says it is available; each child then
 * performs its own corridor, wallet, beneficiary, compliance, and order
 * guards.
 */

import * as React from "react"

import { BridgeUsdSell } from "@/components/fiat/sell/BridgeUsdSell"
import { FiatSellFlow } from "@/components/fiat/sell/FiatSellFlow"
import { NeutralSellFlow } from "@/components/fiat/sell/NeutralSellFlow"
import { Segments, TradeFrame, TradeGhost, TradeUnavailable } from "@/components/buy-sell/redesign/kit"
import { ChoiceRow } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { isBridgeWithdrawalAvailable } from "@/lib/crypto-backend/fiat-capabilities"
import { isPayoutCompareEnabled } from "@/lib/crypto-backend/fiat-compare"
import { offrampOptions } from "@/lib/crypto-backend/fiat-offramp"
import { readPendingFlow } from "@/lib/pending-flow"

type Rail = "local" | "usd"
type Props = React.ComponentProps<typeof FiatSellFlow>

export function FiatSellRouter(props: Props) {
  const config = useFiatConfig()

  const localAvailable = offrampOptions(config.data).length > 0
  const usdAvailable = isBridgeWithdrawalAvailable(config.data)
  const availableRails: Rail[] = [
    ...(localAvailable ? (["local"] as const) : []),
    ...(usdAvailable ? (["usd"] as const) : []),
  ]
  const [rail, setRail] = React.useState<Rail>(() => (
    typeof window !== "undefined" && readPendingFlow("fiat-bridge-sell") ? "usd" : "local"
  ))
  const activeRail = availableRails.includes(rail) ? rail : availableRails[0] ?? rail
  // USD means identity verification, so it is only ever shown after the user asks for it,
  // never as the fallback when local payouts are missing.
  const [usdChosen, setUsdChosen] = React.useState(() => typeof window !== "undefined" && Boolean(readPendingFlow("fiat-bridge-sell")))
  const pickRail = (next: Rail) => {
    if (next === "usd") setUsdChosen(true)
    setRail(next)
  }

  // The neutral picker covers the first stages only. An order in progress, or
  // a choice to use another currency, goes to the existing flow, which already
  // tracks the order and signs the wallet transaction.
  const [handedOver, setHandedOver] = React.useState(() => typeof window !== "undefined" && Boolean(readPendingFlow("fiat-sell")))

  // The redesign's switch: same rails and state, no provider names.
  const railSwitcher = availableRails.length > 1 && props.variant === "redesign" ? (
    <Segments<Rail>
      id="sell-rail"
      label="Get paid in"
      options={[
        { key: "local", label: "Local currency" },
        { key: "usd", label: "USD" },
      ]}
      value={activeRail}
      onChange={pickRail}
    />
  ) : availableRails.length > 1 ? (
    <div className="flex flex-col gap-2">
      <Eyebrow>Sell through</Eyebrow>
      <ChoiceRow<Rail>
        columns={2}
        options={[
          { key: "local", label: "African fiat", sub: "OnSwitch" },
          { key: "usd", label: "USD", sub: "Bridge" },
        ]}
        value={activeRail}
        onChange={pickRail}
      />
    </div>
  ) : undefined

  if (activeRail === "usd" && !usdChosen && props.variant === "redesign" && config.data) {
    return (
      <TradeFrame mode="sell">
        <TradeUnavailable
          tone="muted"
          title="Naira payouts aren't available right now"
          reason="We can't offer a bank payout in naira at the moment. Check again shortly, or sell for USD instead, which needs identity verification."
          action={{ label: "Sell for USD instead", onClick: () => pickRail("usd") }}
        />
        <TradeGhost label="Check again" onClick={() => void config.refetch()} />
      </TradeFrame>
    )
  }

  if (activeRail === "usd") {
    return <BridgeUsdSell {...props} railSwitcher={railSwitcher} onOrderGone={() => { setUsdChosen(false); setRail("local") }} />
  }

  if (isPayoutCompareEnabled() && !handedOver) {
    return (
      <NeutralSellFlow
        variant={props.variant}
        railSwitcher={railSwitcher}
        onOrderPlaced={() => setHandedOver(true)}
        onUseOtherCurrency={() => setHandedOver(true)}
      />
    )
  }

  return <FiatSellFlow {...props} railSwitcher={railSwitcher} />
}
