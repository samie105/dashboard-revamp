import { currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { verifyClerkJWT } from "@/lib/auth/clerk"
import { pregenerateWallet } from "@/lib/wallet-actions"

// Temporary, deliberately narrow allowlist for provisioning a test wallet.
// Do not replace this with a client-provided email.
const ALLOWED_EMAIL = "emmanuelhudson355@gmail.com"

export async function POST(request: NextRequest) {
  try {
    await verifyClerkJWT(request)

    const user = await currentUser()
    const email = user?.emailAddresses
      .map((address) => address.emailAddress.trim().toLowerCase())
      .find((address) => address === ALLOWED_EMAIL)

    if (!email) {
      return NextResponse.json(
        { success: false, error: "This provisioning route is not enabled for this account" },
        { status: 403 },
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
