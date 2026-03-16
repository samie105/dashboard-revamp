import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotDeposit, { type ISpotDeposit } from "@/models/SpotDeposit"
import { completeDeposit } from "@/lib/spot/completeDeposit"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const depositId = searchParams.get("depositId")

    await connectDB()

    let deposit: ISpotDeposit | null

    if (depositId) {
      deposit = await SpotDeposit.findOne({
        _id: depositId,
        userId: clerkUserId,
      })
    } else {
      deposit = await SpotDeposit.findOne({
        userId: clerkUserId,
        status: { $nin: ["completed", "failed", "expired"] },
      }).sort({ createdAt: -1 })
    }

    if (!deposit) {
      return NextResponse.json({ deposit: null })
    }

    // Auto-expire deposits stuck in early states for more than 10 minutes
    const stuckStatuses = ["initiated", "sending_usdt"]
    if (stuckStatuses.includes(deposit.status)) {
      const ageMs = Date.now() - new Date(deposit.createdAt).getTime()
      if (ageMs > 10 * 60 * 1000) {
        deposit.status = "failed"
        deposit.errorMessage =
          "Deposit timed out during initialization. Please try again."
        await deposit.save()
      }
    }

    const pollableStatuses = [
      "awaiting_deposit",
      "deposit_detected",
      "disbursing",
      "initiated",
      "sending_usdt",
    ]
    if (
      ADMIN_URL &&
      ADMIN_KEY &&
      deposit.adminDepositId &&
      pollableStatuses.includes(deposit.status)
    ) {
      try {
        const adminRes = await fetch(
          `${ADMIN_URL}/api/deposits/status/${deposit.adminDepositId}`,
          { headers: { "x-api-key": ADMIN_KEY } },
        )

        if (adminRes.ok) {
          const adminData = await adminRes.json()
          const adminStatus =
            adminData.deposit?.status || adminData.status

          if (
            adminStatus === "completed" ||
            adminStatus === "disbursed"
          ) {
            deposit.status = "disbursed"
            deposit.disburseTxHash =
              adminData.deposit?.disburseTxHash ||
              adminData.disburseTxHash
            deposit.disbursedAmount =
              adminData.deposit?.disbursedAmount ||
              deposit.depositAmount
            await deposit.save()

            try {
              const clerkJwt = await getToken()
              if (clerkJwt) {
                await completeDeposit({
                  depositId: deposit._id.toString(),
                  clerkUserId,
                  clerkJwt,
                })
                deposit = await SpotDeposit.findById(deposit._id)
              }
            } catch (completeErr) {
              console.error(
                "[Spot Deposit Status] Auto-complete failed:",
                completeErr,
              )
            }
          } else if (
            adminStatus === "verified" ||
            adminStatus === "approved" ||
            adminStatus === "disbursing"
          ) {
            deposit.status = "disbursing"
            await deposit.save()
          } else if (
            adminStatus === "detected" ||
            adminStatus === "matched"
          ) {
            deposit.status = "deposit_detected"
            deposit.depositTxHash =
              adminData.deposit?.txHash || adminData.txHash
            await deposit.save()
          } else if (
            adminStatus === "failed" ||
            adminStatus === "rejected"
          ) {
            deposit.status = "failed"
            deposit.errorMessage =
              adminData.deposit?.reason || "Deposit rejected by admin"
            await deposit.save()
          } else if (adminStatus === "expired") {
            deposit.status = "expired"
            await deposit.save()
          }
        }
      } catch (adminErr) {
        console.warn(
          "[Spot Deposit Status] Admin poll failed, returning local state:",
          adminErr,
        )
      }
    }

    return NextResponse.json({
      deposit: deposit
        ? {
            id: deposit._id,
            status: deposit.status,
            depositChain: deposit.depositChain,
            depositToken: deposit.depositToken,
            depositAmount: deposit.depositAmount,
            treasuryAddress: deposit.treasuryAddress,
            treasuryChain: deposit.treasuryChain,
            depositTxHash: deposit.depositTxHash,
            disburseTxHash: deposit.disburseTxHash,
            bridgeTxHash: deposit.bridgeTxHash,
            disbursedAmount: deposit.disbursedAmount,
            bridgedAmount: deposit.bridgedAmount,
            spotAmount: deposit.spotAmount,
            errorMessage: deposit.errorMessage,
            createdAt: deposit.createdAt,
            updatedAt: deposit.updatedAt,
          }
        : null,
    })
  } catch (error: any) {
    console.error("[Spot Deposit Status] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}
