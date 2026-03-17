import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import WalletTransfer from "@/models/WalletTransfer"
import { createAuthorizationContext } from "@/lib/privy/authorization"
import { privyClient } from "@/lib/privy/client"
import { parseUnits, encodeFunctionData, toHex } from "viem"
import { arbitrum } from "viem/chains"

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "boolean" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const

const CONFIG = {
  chain: arbitrum,
  arbChainId: 42161,
  hlBridgeAddress: "0x2Df1c51E09aecf9cacb7bc98cb1742757f163df7",
  usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
}

function sanitizeError(error: any): string {
  const message = error.message || String(error)

  if (message.includes('{"error":')) {
    try {
      const match = message.match(/\{.*\}/)
      if (match) {
        const errorDetail = JSON.parse(match[0])
        const innerError = errorDetail.error

        if (typeof innerError === "string") {
          if (innerError.includes("insufficient funds"))
            return "Insufficient funds for gas + transfer value."
          if (innerError.includes("exceeds the balance"))
            return "Insufficient funds for this transaction."
          return innerError
        }
      }
    } catch (e) {}
  }

  if (message.includes("insufficient funds"))
    return "Insufficient funds for gas + transfer value."
  if (message.includes("missing_or_invalid_token"))
    return "Session expired. Please refresh."

  return message
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

    const { amount, asset = "USDC" } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 },
      )
    }

    await connectDB()

    let userWallet = await UserWallet.findOne({ clerkUserId: authUserId })
    console.log(
      `[Internal Transfer] Lookup by clerkUserId (${authUserId}): ${userWallet ? "Found ✓" : "Not Found ✗"}`,
    )

    if (!userWallet) {
      const { currentUser } = await import("@clerk/nextjs/server")
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses[0]?.emailAddress

      if (email) {
        userWallet = await UserWallet.findOne({ email })
        console.log(
          `[Internal Transfer] Lookup by email (${email}): ${userWallet ? "Found ✓" : "Not Found ✗"}`,
        )

        if (userWallet && !userWallet.clerkUserId) {
          userWallet.clerkUserId = authUserId
          await userWallet.save()
          console.log(
            `[Internal Transfer] Linked clerkUserId ${authUserId} to existing wallet record`,
          )
        }
      }
    }

    if (
      !userWallet ||
      !userWallet.tradingWallet?.address ||
      !userWallet.wallets?.ethereum?.address
    ) {
      const missingDetails = []
      if (!userWallet) missingDetails.push("No wallet record found")
      else {
        if (!userWallet.tradingWallet?.address)
          missingDetails.push("Trading wallet missing in DB")
        if (!userWallet.wallets?.ethereum?.address)
          missingDetails.push("Main wallet missing in DB")
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Wallets not fully initialized. Please set up your trading wallet first.",
          details: missingDetails.join(", "),
          debug: {
            clerkUserId: authUserId,
            foundEmail: userWallet?.email || "unknown",
          },
        },
        { status: 404 },
      )
    }

    const mainWalletAddress =
      userWallet.tradingWallet?.address ||
      userWallet.wallets.ethereum.address
    const mainWalletId =
      userWallet.tradingWallet?.walletId ||
      userWallet.wallets.ethereum.walletId
    const tradingWalletAddress =
      userWallet.tradingWallet?.address || mainWalletAddress

    console.log(
      `[Hyperliquid Deposit] Using Wallet ID: ${mainWalletId} (Address: ${mainWalletAddress})`,
    )

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { success: false, error: "Failed to get auth token" },
        { status: 401 },
      )
    }

    const authContext = await createAuthorizationContext(clerkJwt)

    const HL_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7"
    const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

    let txParams: any = {}

    if (asset.toUpperCase() === "ETH") {
      txParams = {
        to: HL_BRIDGE,
        value: toHex(parseUnits(amount.toString(), 18)),
      }
    } else {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [
          HL_BRIDGE as `0x${string}`,
          parseUnits(amount.toString(), 6),
        ],
      })

      txParams = {
        to: ARBITRUM_USDC,
        data,
        value: "0x0",
      }
    }

    console.log(
      `[Hyperliquid Deposit] Initiating sponsored transaction via Privy Server SDK...`,
    )

    const result = await (privyClient.wallets as any)
      .ethereum()
      .sendTransaction(mainWalletId, {
        sponsor: true,
        caip2: "eip155:42161",
        params: {
          transaction: txParams,
        },
        authorization_context: authContext,
      })

    const txHash = result.hash
    console.log(
      `[Hyperliquid Deposit] Transaction successful! Hash: ${txHash}`,
    )

    WalletTransfer.create({
      userId: authUserId,
      type: "internal",
      direction: "main-to-spot",
      chain: "arbitrum",
      token: asset,
      amount: parseFloat(amount),
      fromAddress: mainWalletAddress,
      toAddress: HL_BRIDGE,
      txHash,
      status: "confirmed",
      memo: "Hyperliquid deposit via Privy",
    }).catch((e: unknown) => console.error("Failed to record transfer:", e))

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        from: mainWalletAddress,
        to: HL_BRIDGE,
        amount,
        asset,
      },
    })
  } catch (error: any) {
    console.error("[Internal Transfer] Error:", error)
    const userFriendlyError = sanitizeError(error)

    return NextResponse.json(
      {
        success: false,
        error: userFriendlyError,
        details: error.message,
      },
      { status: 500 },
    )
  }
}
