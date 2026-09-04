import { notFound, redirect } from "next/navigation"
import { selfCustodyEnabled } from "@/lib/crypto/config"

export default function WalletPage() {
  if (!selfCustodyEnabled()) notFound()
  redirect("/wallet/modern")
}
