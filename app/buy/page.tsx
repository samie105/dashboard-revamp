import { BuySellClient } from "@/components/buy-sell/buy-sell-client"
import { FiatBuyFlow } from "@/components/fiat/buy/FiatBuyFlow"
import { buySellImplementation } from "@/lib/fiat-flags"

/**
 * Buy: the released guide flow in the redesign's look. The rollback flag
 * (NEXT_PUBLIC_FIAT_BUY_FLOW=legacy, lib/fiat-flags.ts) still renders the
 * legacy Buy through BuySellClient, unchanged.
 */
export default function BuyPage() {
  if (buySellImplementation("buy") === "onswitch-buy") return <FiatBuyFlow variant="redesign" />
  return <BuySellClient mode="buy" />
}
