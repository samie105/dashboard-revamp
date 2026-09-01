import type { Metadata } from "next"

import { SendFlow } from "@/components/crypto/send/SendFlow"

export const metadata: Metadata = {
  title: "Send Crypto",
}

export default function ModernSendRoute() {
  return <SendFlow />
}
