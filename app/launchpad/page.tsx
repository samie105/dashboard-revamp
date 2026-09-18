import type { Metadata } from "next"
import { LaunchpadDiscovery } from "@/components/launchpad/discovery"

export const metadata: Metadata = { title: "Launchpad" }

export default function LaunchpadPage() {
  return <LaunchpadDiscovery />
}
