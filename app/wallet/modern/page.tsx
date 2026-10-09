import type { Metadata } from "next"

import { WalletPage } from "@/components/wallet/redesign/wallet-page"

export const metadata: Metadata = {
  title: "Modern Crypto Wallet",
}

export default function ModernWalletRoute() {
  return <WalletPage />
}
