import { notFound } from "next/navigation"
import { selfCustodyEnabled } from "@/lib/crypto/config"
import { WalletSetup } from "@/components/wallet/wallet-setup"

export default function WalletPage() {
  if (!selfCustodyEnabled()) notFound()
  return <WalletSetup />
}
