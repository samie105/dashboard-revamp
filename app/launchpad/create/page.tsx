import type { Metadata } from "next"
import { Suspense } from "react"
import { CreateLaunch } from "@/components/launchpad/create-launch"

export const metadata: Metadata = { title: "Launch a token" }

export default function LaunchpadCreatePage() {
  // useSearchParams (the ?launch= status screen) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <CreateLaunch />
    </Suspense>
  )
}
