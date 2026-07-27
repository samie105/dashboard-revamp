import { Suspense } from "react"
import { TradeClient } from "@/components/trade/trade-client"

export default function TradePage() {
  return (
    <Suspense>
      <TradeClient />
    </Suspense>
  )
}
