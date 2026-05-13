import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import {
  FIAT_DEPOSIT_NETWORKS,
  getAdminFiatAvailability,
  type AdminFiatAvailabilityResponse,
  type FiatDepositNetwork,
} from "@/lib/deposit/admin-fiat"

function unavailableResponse(message: string): AdminFiatAvailabilityResponse {
  return {
    success: false,
    token: "USDT",
    chains: FIAT_DEPOSIT_NETWORKS.reduce(
      (acc, network) => {
        acc[network] = { enabled: false, available: 0, reason: message }
        return acc
      },
      {} as Record<FiatDepositNetwork, { enabled: boolean; available: number; reason: string }>,
    ),
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const availability = await getAdminFiatAvailability()
    return NextResponse.json(availability)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deposit service unavailable"
    console.error("GET /api/deposit/availability error:", error)
    return NextResponse.json(unavailableResponse(message), { status: 503 })
  }
}
