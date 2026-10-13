import type { Metadata } from "next"
import { LaunchTokenPage } from "@/components/launchpad/redesign/token"

type Props = { params: Promise<{ launchId: string }> }

export const metadata: Metadata = { title: "Launchpad" }

export default async function LaunchpadTokenPage({ params }: Props) {
  const { launchId } = await params
  return <LaunchTokenPage launchId={launchId} />
}
