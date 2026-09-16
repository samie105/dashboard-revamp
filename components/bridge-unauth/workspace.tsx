"use client"

/**
 * Owns the selected route so the card and anything that follows it agree on
 * which lane is in play.
 */

import * as React from "react"
import { BridgeCard } from "@/components/bridge-unauth/bridge-card"
import { DEFAULT_ROUTE } from "@/components/bridge-unauth/bridge-data"

export function BridgeWorkspace() {
  const [routeId, setRouteId] = React.useState(DEFAULT_ROUTE)
  return <BridgeCard routeId={routeId} onRoute={setRouteId} />
}
