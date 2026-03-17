import { NextRequest, NextResponse } from "next/server"
import { PrivyClient as PrivyNodeClient } from "@privy-io/node"
import { createViemAccount } from "@privy-io/node/viem"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { HyperliquidService } from "@/lib/hyperliquid/client"
import { auth } from "@clerk/nextjs/server"
import {
  createAuthorizationContext,
  validateAuthorizationContext,
} from "@/lib/privy/authorization"

const privyNode = new PrivyNodeClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, clerkUserId } = body

    if (!email || !clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Email and Clerk user ID are required" },
        { status: 400 },
      )
    }

    const { userId, getToken } = await auth()

    if (!userId || userId !== clerkUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized - Authentication required",
        },
        { status: 401 },
      )
    }

    let clerkJwt: string | null = null
    try {
      clerkJwt = await getToken()
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to get authentication token" },
        { status: 401 },
      )
    }

    if (!clerkJwt) {
      return NextResponse.json(
        { success: false, error: "Authentication token not available" },
        { status: 401 },
      )
    }

    let authorizationContext
    try {
      authorizationContext = await createAuthorizationContext(clerkJwt)

      if (!validateAuthorizationContext(authorizationContext)) {
        throw new Error("Invalid authorization context received")
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create authorization context",
        },
        { status: 401 },
      )
    }

    await connectDB()

    let privyUser
    let userWallet = await UserWallet.findOne({ email })

    if (userWallet?.privyUserId) {
      try {
        privyUser = await privyNode.users().get(userWallet.privyUserId)

        if (userWallet.clerkUserId !== clerkUserId) {
          userWallet.clerkUserId = clerkUserId
          await userWallet.save()
        }
      } catch {
        privyUser = null
        await UserWallet.deleteOne({ email })
        userWallet = null
      }
    }

    if (!privyUser) {
      const linkedAccounts: any[] = [
        { type: "custom_auth", custom_user_id: clerkUserId },
        { type: "email", address: email },
      ]

      const walletAuthId = process.env.PRIVY_WALLET_AUTH_ID
      const signerConfig = walletAuthId
        ? [{ signer_id: walletAuthId }]
        : undefined

      try {
        privyUser = await privyNode.users().create({
          linked_accounts: linkedAccounts,
          wallets: [
            {
              chain_type: "ethereum",
              additional_signers: signerConfig,
            } as any,
            {
              chain_type: "solana",
              additional_signers: signerConfig,
            } as any,
            { chain_type: "sui" } as any,
            { chain_type: "ton" } as any,
            { chain_type: "tron" } as any,
          ],
        })
      } catch (createError: any) {
        if (
          createError.message?.includes("Input conflict") ||
          createError.status === 422
        ) {
          const conflictMatch = createError.message?.match(
            /did:privy:[a-z0-9]+/i,
          )
          const existingDid = conflictMatch ? conflictMatch[0] : null

          if (existingDid) {
            privyUser = await privyNode.users().get(existingDid)
          } else {
            throw createError
          }
        } else {
          throw createError
        }
      }

      const wallets: any = {}
      const chainTypes = ["ethereum", "solana", "sui", "ton", "tron"]

      for (const chainType of chainTypes) {
        const userWallets = []
        for await (const wallet of privyNode.wallets().list({
          user_id: privyUser.id,
          chain_type: chainType as any,
        })) {
          userWallets.push(wallet)
        }

        if (userWallets.length > 0) {
          const wallet = userWallets[0]
          wallets[chainType] = {
            walletId: wallet.id,
            address: wallet.address,
            publicKey: wallet.public_key || null,
          }
        }
      }

      userWallet = await UserWallet.create({
        email,
        clerkUserId,
        privyUserId: privyUser.id,
        wallets,
      })
    }

    if (!userWallet?.wallets?.ethereum) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Ethereum wallet found. Please create your main wallets first.",
        },
        { status: 400 },
      )
    }

    const existingWallets = []
    for await (const wallet of privyNode.wallets().list({
      user_id: privyUser.id,
      chain_type: "ethereum",
    })) {
      existingWallets.push(wallet)
    }

    const mainWalletId = userWallet.wallets.ethereum.walletId
    const mainWalletInPrivy = existingWallets.find(
      (w) => w.id === mainWalletId,
    )

    if (!mainWalletInPrivy) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Main wallet not found in Privy. Database may be out of sync.",
        },
        { status: 400 },
      )
    }

    let targetWallet = mainWalletInPrivy
    const existingSecondaryWallet = existingWallets.find(
      (w) => w.id !== mainWalletId,
    )

    if (existingSecondaryWallet) {
      targetWallet = existingSecondaryWallet
    }

    const tradingWallet = targetWallet

    if (userWallet) {
      userWallet.wallets.ethereum = {
        walletId: tradingWallet.id,
        address: tradingWallet.address,
        publicKey:
          (tradingWallet as any).public_key ||
          (tradingWallet as any).publicKey ||
          null,
      }

      userWallet.tradingWallet = {
        walletId: tradingWallet.id,
        address: tradingWallet.address,
        chainType: "ethereum",
        initialized: false,
      }
      await userWallet.save()
    }

    let viemAccount
    try {
      viemAccount = createViemAccount(privyNode, {
        walletId: tradingWallet.id,
        address: tradingWallet.address as `0x${string}`,
        authorizationContext: authorizationContext,
      })
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create Viem account for trading",
        },
        { status: 500 },
      )
    }

    let hyperliquidSetup
    try {
      const hyperliquidService = new HyperliquidService({ testnet: false })

      hyperliquidSetup = await hyperliquidService.initializeTradingWallet(
        {
          address: tradingWallet.address,
          walletId: tradingWallet.id,
          chainType: "ethereum",
        },
        viemAccount,
      )

      if (userWallet && hyperliquidSetup.success) {
        userWallet.tradingWallet.initialized = true
        userWallet.tradingWallet.timestamp = new Date()
        await userWallet.save()
      }
    } catch (hyperliquidError) {
      hyperliquidSetup = {
        success: false,
        initialized: false,
        error:
          hyperliquidError instanceof Error
            ? hyperliquidError.message
            : "Unknown error",
        timestamp: new Date().toISOString(),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        privyUserId: privyUser.id,
        mainWallet: {
          id: userWallet.wallets.ethereum.walletId,
          address: userWallet.wallets.ethereum.address,
          chainType: "ethereum",
        },
        tradingWallet: {
          id: tradingWallet.id,
          address: tradingWallet.address,
          chainType: "ethereum",
        },
        viemAccount: {
          address: viemAccount.address,
          ready: true,
          authorized: true,
        },
        hyperliquid: hyperliquidSetup,
        authorization: {
          authenticated: true,
          contextCreated: !!authorizationContext,
          contextValid: validateAuthorizationContext(
            authorizationContext,
          ),
          keysCount:
            authorizationContext.user_jwts?.length ??
            authorizationContext.authorization_private_keys?.length ?? 0,
        },
        debug: {
          totalEthereumWallets: existingWallets.length,
          mainWalletFoundInPrivy: !!mainWalletInPrivy,
          isUnifiedWallet: true,
        },
      },
    })
  } catch (error) {
    console.error("[Trading Wallet] Setup error:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to setup trading wallet",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const clerkUserId = searchParams.get("clerkUserId")

    if (!email || !clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Email and Clerk user ID are required" },
        { status: 400 },
      )
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({
      $or: [{ email }, { clerkUserId }],
    })

    if (!userWallet?.privyUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "User record not found in database",
          code: "USER_NOT_FOUND",
        },
        { status: 404 },
      )
    }

    let privyUser
    try {
      privyUser = await privyNode.users().get(userWallet.privyUserId)
    } catch {
      return NextResponse.json(
        { success: false, error: "Privy user not found" },
        { status: 404 },
      )
    }

    const ethereumWallets = []
    for await (const wallet of privyNode.wallets().list({
      user_id: privyUser.id,
      chain_type: "ethereum",
    })) {
      ethereumWallets.push({
        id: wallet.id,
        address: wallet.address,
        chainType: "ethereum",
      })
    }

    const mainWalletId = userWallet.wallets?.ethereum?.walletId
    const mainWallet = ethereumWallets.find((w) => w.id === mainWalletId)
    const tradingWallet = mainWallet

    return NextResponse.json({
      success: true,
      data: {
        privyUserId: privyUser.id,
        hasMainWallet: !!mainWallet,
        hasTradingWallet: !!mainWallet,
        mainWallet: mainWallet || null,
        tradingWallet: tradingWallet || null,
        ethereumWallets,
        totalEthereumWallets: ethereumWallets.length,
        isUnified: true,
        debug: {
          mainWalletIdFromDB: mainWalletId,
          mainWalletFoundInPrivy: !!mainWallet,
        },
      },
    })
  } catch (error) {
    console.error("[Trading Wallet] Status check error:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get trading wallet status",
      },
      { status: 500 },
    )
  }
}
