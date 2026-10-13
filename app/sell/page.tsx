import { BuySellClient } from "@/components/buy-sell/buy-sell-client"
import { FiatSellRouter } from "@/components/fiat/sell/FiatSellRouter"
import { buySellImplementation } from "@/lib/fiat-flags"

/**
 * Sell: the released guide flow in the redesign's look. The rollback flag
 * (NEXT_PUBLIC_FIAT_SELL_FLOW=legacy, lib/fiat-flags.ts) still renders the
 * legacy Sell through BuySellClient, unchanged.
 */
export default function SellPage() {
  if (buySellImplementation("sell") === "onswitch-sell") return <FiatSellRouter variant="redesign" />
  return <BuySellClient mode="sell" />
}
