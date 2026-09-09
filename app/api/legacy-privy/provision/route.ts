import { currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { verifyClerkJWT } from "@/lib/auth/clerk"
import { pregenerateWallet } from "@/lib/wallet-actions"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyClerkJWT(request)

    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress.trim().toLowerCase()

    if (!email) {
      return NextResponse.json(
        { success: false, error: "A verified email address is required to provision a Privy wallet" },
        { status: 400 },
      )
    }

    const result = await pregenerateWallet(email)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Legacy wallet provisioning failed" },
        { status: 502 },
      )
    }

    const addresses = Object.fromEntries(
      Object.entries(result.wallets ?? {})
        .filter(([, wallet]) => Boolean(wallet?.address))
        .map(([chain, wallet]) => [chain, wallet.address]),
    )

    return NextResponse.json({
      success: true,
      provisioned: true,
      clerkUserId: userId,
      privyUserId: result.privyUserId,
      addresses,
      chains: Object.keys(addresses),
    })
  } catch (error) {
    console.error("[Legacy Privy Provision] Error:", error)
    return NextResponse.json(
      { success: false, error: "Legacy wallet provisioning failed" },
      { status: 500 },
    )
  }
}
