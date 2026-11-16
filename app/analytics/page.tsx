import type { Metadata } from "next"

import { AnalyticsPage } from "@/components/analytics/analytics-page"

export const metadata: Metadata = { title: "Analytics" }

/** Analytics: the user's own activity, from their own records. */
export default function Analytics() {
  return <AnalyticsPage />
}
