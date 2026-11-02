import { Suspense } from "react"
import { CopyTradingClient } from "@/components/copy-trading/copy-trading-client"

export default function CopyTradingPage() {
  return (
    <Suspense>
      <CopyTradingClient />
    </Suspense>
  )
}
