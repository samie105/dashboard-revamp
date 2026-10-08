import type { Metadata } from "next"
import { LaunchpadDiscoveryPage } from "@/components/launchpad/redesign/discovery"

export const metadata: Metadata = { title: "Launchpad" }

export default function LaunchpadPage() {
  return <LaunchpadDiscoveryPage />
}
