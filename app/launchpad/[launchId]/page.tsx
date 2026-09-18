import type { Metadata } from "next"
import { LiveTokenPage } from "@/components/launchpad/live-token-page"

type Props = { params: Promise<{ launchId: string }> }

export const metadata: Metadata = { title: "Launchpad" }

export default async function LaunchpadTokenPage({ params }: Props) {
  const { launchId } = await params
  return <LiveTokenPage launchId={launchId} />
}
