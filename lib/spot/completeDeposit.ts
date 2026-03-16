/**
 * Shared deposit completion logic (Bridge + usdClassTransfer).
 *
 * Called from both:
 * - POST /api/spot/deposit/complete (user-triggered)
 * - GET /api/spot/deposit/status (auto-triggered when disbursed)
 */

import SpotDeposit, { type ISpotDeposit } from "@/models/SpotDeposit"
import { bridgeToHyperliquid } from "@/lib/hyperliquid/bridge"
import { usdClassTransfer } from "@/lib/hyperliquid/usdTransfer"
import { privyClient } from "@/lib/privy/client"
import { createAuthorizationContext } from "@/lib/privy/authorization"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

const HL_BALANCE_POLL_INTERVAL_MS = 5_000
const HL_BALANCE_POLL_MAX_ATTEMPTS = 30 // 30 * 5s = 2.5 minutes

/**
 * Poll Hyperliquid perps balance until the bridged USDC is credited.
 */
async function waitForHlCredit(
  walletAddress: string,
  expectedAmount: number,
): Promise<number> {
  const transport = new HttpTransport({ isTestnet: false })
  const info = new InfoClient({ transport })

  const threshold = expectedAmount * 0.9

  let initialBalance = 0
  try {
    const initState = await info.clearinghouseState({
      user: walletAddress as `0x${string}`,
    })
    initialBalance = parseFloat(
      (initState as any).crossMarginSummary?.accountValue ?? "0",
    )
    console.log(
      `[CompleteDeposit] Initial HL balance: ${initialBalance} USDC`,
    )
  } catch {
    // If we can't read the initial balance, fall through to polling
  }

  for (let i = 0; i < HL_BALANCE_POLL_MAX_ATTEMPTS; i++) {
    try {
      const state = await info.clearinghouseState({
        user: walletAddress as `0x${string}`,
      })

      const currentBalance = parseFloat(
        (state as any).crossMarginSummary?.accountValue ?? "0",
      )

      const increase = currentBalance - initialBalance

      if (increase >= threshold) {
        console.log(
          `[CompleteDeposit] HL credit detected: +${increase.toFixed(2)} USDC (total ${currentBalance.toFixed(2)}, attempt ${i + 1})`,
        )
        return currentBalance
      }
    } catch (err) {
      console.warn(
        `[CompleteDeposit] HL balance poll error (attempt ${i + 1}):`,
        err,
      )
    }

    await new Promise((r) => setTimeout(r, HL_BALANCE_POLL_INTERVAL_MS))
  }

  console.warn(
    `[CompleteDeposit] HL credit not detected after ${HL_BALANCE_POLL_MAX_ATTEMPTS} attempts`,
  )
  return 0
}

export interface CompleteDepositParams {
  depositId: string
  clerkUserId: string
  clerkJwt: string
}

export interface CompleteDepositResult {
  success: boolean
  partial?: boolean
  message?: string
  deposit: {
    id: string
    status: string
    bridgeTxHash?: string
    spotAmount?: number
  }
}

/**
 * Execute the bridge + usdClassTransfer pipeline for a disbursed deposit.
 */
export async function completeDeposit({
  depositId,
  clerkUserId,
  clerkJwt,
}: CompleteDepositParams): Promise<CompleteDepositResult> {
  const deposit = await SpotDeposit.findOne({
    _id: depositId,
    userId: clerkUserId,
  })

  if (!deposit) {
    throw new Error("Deposit not found")
  }

  if (!["disbursed", "bridging", "transferring"].includes(deposit.status)) {
    throw new Error(`Cannot complete deposit in status: ${deposit.status}`)
  }

  // Look up user wallet
  const { UserWallet } = await import("@/models/UserWallet")
  const userWallet = await UserWallet.findOne({ clerkUserId })
  if (!userWallet?.tradingWallet?.walletId) {
    throw new Error("Trading wallet not found")
  }

  const authContext = await createAuthorizationContext(clerkJwt)
  const { walletId, address: walletAddress } = userWallet.tradingWallet
  const amount = deposit.disbursedAmount || deposit.depositAmount

  // Stage 1: Bridge to Hyperliquid (trading wallet → HL Bridge2)
  if (deposit.status === "disbursed") {
    deposit.status = "bridging"
    await deposit.save()

    try {
      const bridgeResult = await bridgeToHyperliquid({
        privyClient,
        walletId,
        amount,
        authorizationContext: authContext,
      })

      if (!bridgeResult.success) {
        deposit.status = "failed"
        deposit.errorMessage = bridgeResult.error || "Bridge transfer failed"
        await deposit.save()
        throw new Error(deposit.errorMessage)
      }

      deposit.bridgeTxHash = bridgeResult.txHash
      deposit.bridgedAmount = amount
      deposit.status = "transferring"
      await deposit.save()

      console.log(`[CompleteDeposit] Bridge done: ${bridgeResult.txHash}`)
    } catch (bridgeErr: any) {
      if (deposit.status !== "failed") {
        deposit.status = "failed"
        deposit.errorMessage = bridgeErr.message || "Bridge error"
        await deposit.save()
      }
      throw bridgeErr
    }
  }

  if (deposit.status === "bridging") {
    deposit.status = "transferring"
    await deposit.save()
  }

  // Stage 2: Wait for HL to credit the bridge deposit, then usdClassTransfer
  if (deposit.status === "transferring") {
    try {
      const hlBalance = await waitForHlCredit(walletAddress, amount)

      if (hlBalance <= 0) {
        deposit.errorMessage =
          "Bridge succeeded but HL credit not detected yet. USDC may still be in transit. Try again later."
        deposit.status = "completed"
        deposit.spotAmount = 0
        deposit.completedAt = new Date()
        await deposit.save()

        return {
          success: true,
          partial: true,
          message: deposit.errorMessage,
          deposit: {
            id: deposit._id.toString(),
            status: deposit.status,
            bridgeTxHash: deposit.bridgeTxHash,
            spotAmount: 0,
          },
        }
      }

      const transferResult = await usdClassTransfer({
        privyClient,
        walletId,
        walletAddress,
        authorizationContext: authContext,
        amount: deposit.bridgedAmount || amount,
        toPerp: false, // Perps → Spot
      })

      if (!transferResult.success) {
        deposit.errorMessage = `Bridge succeeded but Perps→Spot transfer failed: ${transferResult.error}. USDC is in your Perps wallet.`
        deposit.status = "completed"
        deposit.spotAmount = 0
        deposit.completedAt = new Date()
        await deposit.save()

        return {
          success: true,
          partial: true,
          message: deposit.errorMessage,
          deposit: {
            id: deposit._id.toString(),
            status: deposit.status,
          },
        }
      }

      deposit.spotAmount = deposit.bridgedAmount || amount
      deposit.status = "completed"
      deposit.completedAt = new Date()
      await deposit.save()

      console.log(
        `[CompleteDeposit] Full pipeline done for deposit ${deposit._id}`,
      )

      return {
        success: true,
        deposit: {
          id: deposit._id.toString(),
          status: "completed",
          bridgeTxHash: deposit.bridgeTxHash,
          spotAmount: deposit.spotAmount,
        },
      }
    } catch (transferErr: any) {
      deposit.errorMessage = `Bridge OK but Perps→Spot failed: ${transferErr.message}. USDC is in Perps.`
      deposit.status = "completed"
      deposit.spotAmount = 0
      deposit.completedAt = new Date()
      await deposit.save()

      return {
        success: true,
        partial: true,
        message: deposit.errorMessage,
        deposit: {
          id: deposit._id.toString(),
          status: deposit.status,
        },
      }
    }
  }

  return {
    success: true,
    deposit: {
      id: deposit._id.toString(),
      status: deposit.status,
    },
  }
}
