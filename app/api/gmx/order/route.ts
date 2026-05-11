import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ensureUserWallet } from "@/lib/ensureUserWallet"
import { signTypedData } from "@/lib/privy/signing"
import { buildGmxOrder, submitGmxOrder } from "@/lib/gmx/actions"

const MIN_ORDER_VALUE = 10

function formatOrderError(raw: string): string {
  if (/insufficient funds/i.test(raw)) {
    return "Your trading wallet needs ETH for gas. Please deposit ETH to your Arbitrum wallet and try again."
  }
  if (/minimum value/i.test(raw)) {
    return `Minimum order value is $${MIN_ORDER_VALUE}. Please increase your order amount.`
  }
  if (/insufficient margin|not enough|insufficient balance/i.test(raw)) {
    return "Insufficient balance to place this order."
  }
  if (/slippage/i.test(raw)) {
    return "Order failed due to slippage. Try increasing your slippage tolerance."
  }
  if (/invalid price|price must be/i.test(raw)) {
    return "The order price is invalid. Please adjust and try again."
  }
  return `Order failed: ${raw}`
}

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId, getToken } = await auth()
    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      )
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { success: false, error: "Authentication token required" },
        { status: 401 },
      )
    }

    const body = await request.json()
    const {
      marketTokenAddress,
      isLong,
      sizeDeltaUsd,
      collateralDeltaAmount,
      acceptablePrice,
      orderType,
    } = body

    if (!marketTokenAddress || sizeDeltaUsd == null || collateralDeltaAmount == null) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: marketTokenAddress, sizeDeltaUsd, collateralDeltaAmount" },
        { status: 400 },
      )
    }

    // Resolve user's trading wallet
    const userWallet = await ensureUserWallet(authUserId)
    if (!userWallet?.tradingWallet?.walletId || !userWallet?.tradingWallet?.address) {
      return NextResponse.json(
        { success: false, error: "Wallet setup failed. Please refresh and try again." },
        { status: 404 },
      )
    }

    const account = userWallet.tradingWallet.address
    const walletId = userWallet.tradingWallet.walletId

    // Build the GMX order
    const order = await buildGmxOrder({
      marketTokenAddress,
      isLong: isLong ?? true,
      sizeDeltaUsd: BigInt(sizeDeltaUsd),
      collateralDeltaAmount: BigInt(collateralDeltaAmount),
      account,
      acceptablePrice: acceptablePrice ? BigInt(acceptablePrice) : undefined,
      orderType: orderType ?? "market",
    })

    // Sign the EIP-712 typed data via Privy
    // The order object from the SDK should contain domain, types, and value
    const typedData = {
      domain: order.domain,
      types: order.types,
      primaryType: order.primaryType ?? "Order",
      message: order.value ?? order.message,
    }

    const signature = await signTypedData(walletId, typedData, clerkJwt)

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Failed to sign order" },
        { status: 500 },
      )
    }

    // Submit via GMX relay (gasless)
    const result = await submitGmxOrder(order, signature)

    return NextResponse.json({
      success: true,
      data: {
        txHash: result.txHash,
        orderKey: result.orderKey,
      },
    })
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Failed to execute GMX order"
    console.error("[GMX Order] Error:", err)
    const friendly = formatOrderError(rawMessage)
    return NextResponse.json(
      { success: false, error: friendly },
      { status: 500 },
    )
  }
}
