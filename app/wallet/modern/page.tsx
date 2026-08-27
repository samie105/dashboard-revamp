import type { Metadata } from "next"

import { ModernWalletPage } from "@/components/crypto/ModernWalletPage"

export const metadata: Metadata = {
  title: "Modern Crypto Wallet",
}

export default function ModernWalletRoute() {
  return <ModernWalletPage />
}
