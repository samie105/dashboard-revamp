import { NextRequest, NextResponse } from "next/server"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/migrate-privy-type
 * One-time migration to set privy_type = 0 for all existing users
 * IMPORTANT: This should only be called once after deploying the new schema
 */
export async function POST(request: NextRequest) {
  try {
    // Simple auth check - verify a specific header/token for safety
    const authToken = request.headers.get("x-migration-token")
    const expectedToken = "xxxyyy"

    if (!expectedToken || authToken !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid migration token" },
        { status: 401 },
      )
    }

    await connectDB()

    // Update all users without privy_type or with undefined privy_type to 0 (old privy)
    const result = await UserWallet.updateMany(
      { privy_type: { $exists: false } },
      { $set: { privy_type: 0 } },
    )

    console.log(`[Migration] Updated ${result.modifiedCount} users with privy_type = 0`)

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${result.modifiedCount} users updated to privy_type = 0 (old privy)`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error: unknown) {
    console.error("[Migration] Error during privy_type migration:", error)
    return NextResponse.json(
      {
        error: "Migration failed",
        details: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
