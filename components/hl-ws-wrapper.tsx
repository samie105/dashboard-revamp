"use client"

import { useWallet } from "@/components/wallet-provider"
import { HyperliquidWsProvider } from "@/hooks/useHyperliquidWs"

export function HlWsWrapper({ children }: { children: React.ReactNode }) {
  const { tradingWallet } = useWallet()
  return (
    <HyperliquidWsProvider userAddress={tradingWallet?.address}>
      {children}
    </HyperliquidWsProvider>
  )
}
