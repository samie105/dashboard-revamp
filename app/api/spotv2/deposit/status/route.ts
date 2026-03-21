import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"
import SpotV2Deposit from "@/models/SpotV2Deposit"
import SpotV2LedgerTx from "@/models/SpotV2LedgerTx"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!ADMIN_URL || !ADMIN_KEY) {
      return NextResponse.json(
        { error: "Admin backend not configured" },
        { status: 503 },
      )
    }

    const { searchParams } = new URL(request.url)
    const adminDepositId = searchParams.get("id")

    if (!adminDepositId) {
      return NextResponse.json(
        { error: "Missing deposit id" },
        { status: 400 },
      )
    }

    await connectDB()

    // Verify caller owns this deposit (Bug #8 fix)
    const localDeposit = await SpotV2Deposit.findOne({
      adminDepositId,
      userId: clerkUserId,
    })

    if (!localDeposit) {
      return NextResponse.json(
        { error: "Deposit not found" },
        { status: 404 },
      )
    }

    // If already credited, just return current state without polling admin
    if (localDeposit.credited) {
      return NextResponse.json({
        success: true,
        deposit: {
          id: localDeposit._id,
          adminDepositId,
          status: localDeposit.status,
          depositChain: localDeposit.depositChain,
          depositToken: localDeposit.depositToken,
          depositAmount: localDeposit.depositAmount,
          depositTxHash: localDeposit.depositTxHash,
          credited: true,
          creditedAmount: localDeposit.creditedAmount,
        },
      })
    }

    // Auto-expire deposits stuck in early states for more than 15 minutes
    const stuckStatuses = ["initiated", "sending"]
    if (stuckStatuses.includes(localDeposit.status)) {
      const ageMs = Date.now() - new Date(localDeposit.createdAt).getTime()
      if (ageMs > 15 * 60 * 1000) {
        localDeposit.status = "failed"
        localDeposit.errorMessage = "Deposit timed out. Please try again."
        await localDeposit.save()

        return NextResponse.json({
          success: true,
          deposit: {
            id: localDeposit._id,
            adminDepositId,
            status: "failed",
            errorMessage: localDeposit.errorMessage,
          },
        })
      }
    }

    // Poll admin backend for deposit status
    const adminRes = await fetch(
      `${ADMIN_URL}/api/deposits/status/${encodeURIComponent(adminDepositId)}`,
      { headers: { "x-api-key": ADMIN_KEY } },
    )

    if (!adminRes.ok) {
      // Return local state if admin is unreachable
      return NextResponse.json({
        success: true,
        deposit: {
          id: localDeposit._id,
          adminDepositId,
          status: localDeposit.status,
          depositChain: localDeposit.depositChain,
          depositToken: localDeposit.depositToken,
          depositAmount: localDeposit.depositAmount,
          depositTxHash: localDeposit.depositTxHash,
        },
      })
    }

    const adminData = await adminRes.json()
    const adminDeposit = adminData.deposit || adminData
    const adminStatus = adminDeposit.status || "pending"

    // Update local deposit status based on admin status
    if (adminStatus === "failed" || adminStatus === "rejected") {
      localDeposit.status = "failed"
      localDeposit.errorMessage =
        adminDeposit.reason || "Deposit rejected"
      await localDeposit.save()
    } else if (adminStatus === "expired") {
      localDeposit.status = "expired"
      await localDeposit.save()
    } else if (
      adminStatus === "verified" ||
      adminStatus === "completed" ||
      adminStatus === "disbursed"
    ) {
      // Admin has confirmed the on-chain deposit — credit the ledger ONCE
      // Use atomic findOneAndUpdate with credited:false guard (Bug #1 fix)
      const creditAmount = parseFloat(
        adminDeposit.requestedAmount ||
          adminDeposit.depositAmount ||
          "0",
      )

      if (creditAmount > 0) {
        const guardedUpdate = await SpotV2Deposit.findOneAndUpdate(
          {
            _id: localDeposit._id,
            credited: false,
          },
          {
            $set: {
              credited: true,
              creditedAmount: creditAmount,
              status: "completed",
            },
          },
          { new: true },
        )

        if (guardedUpdate) {
          // Credit was applied — now update the ledger
          const updatedLedger = await SpotV2Ledger.findOneAndUpdate(
            { userId: clerkUserId, token: "USDC" },
            {
              $inc: { available: creditAmount },
              $setOnInsert: { locked: 0 },
            },
            { upsert: true, new: true },
          )

          // Write audit trail
          await SpotV2LedgerTx.create({
            userId: clerkUserId,
            type: "deposit",
            token: "USDC",
            amount: creditAmount,
            balanceAfter: updatedLedger.available,
            ref: adminDepositId,
            refModel: "SpotV2Deposit",
          })

          console.log(
            `[SpotV2 Deposit] Credited ${creditAmount} USDC to ${clerkUserId} (deposit ${adminDepositId})`,
          )
        }
        // else: credited was already true — another poll beat us, no double-credit
      }

      // Refresh local state
      await localDeposit.updateOne({
        status: "completed",
        depositTxHash: adminDeposit.depositTxHash || localDeposit.depositTxHash,
      })
    } else if (
      adminStatus === "detected" ||
      adminStatus === "matched"
    ) {
      localDeposit.status = "verified"
      localDeposit.depositTxHash =
        adminDeposit.depositTxHash || localDeposit.depositTxHash
      await localDeposit.save()
    }

    // Reload to get latest state
    const finalDeposit = await SpotV2Deposit.findById(localDeposit._id)

    return NextResponse.json({
      success: true,
      deposit: {
        id: finalDeposit!._id,
        adminDepositId,
        status: finalDeposit!.status,
        depositChain: finalDeposit!.depositChain,
        depositToken: finalDeposit!.depositToken,
        depositAmount: finalDeposit!.depositAmount,
        depositTxHash: finalDeposit!.depositTxHash,
        credited: finalDeposit!.credited,
        creditedAmount: finalDeposit!.creditedAmount,
      },
    })
  } catch (error: unknown) {
    console.error("[SpotV2 Deposit Status] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
