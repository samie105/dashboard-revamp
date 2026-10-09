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
import { Segments } from "@/components/buy-sell/redesign/kit"
import { ChoiceRow } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { isBridgeWithdrawalAvailable } from "@/lib/crypto-backend/fiat-capabilities"
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
      onChange={setRail}
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
        onChange={setRail}
      />
    </div>
  ) : undefined

  if (activeRail === "usd") {
    return <BridgeUsdSell {...props} railSwitcher={railSwitcher} />
  }

  return <FiatSellFlow {...props} railSwitcher={railSwitcher} />
}
