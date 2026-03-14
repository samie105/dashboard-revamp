"use server"

import { PrivyClient } from "@privy-io/node"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { auth } from "@clerk/nextjs/server"

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

// ── Types ────────────────────────────────────────────────────────────────

export type WalletInfo = {
  walletId: string
  address: string
  publicKey: string | null
}

export type WalletResult = {
  success: boolean
  privyUserId?: string
  wallets?: Record<string, WalletInfo>
  tradingWallet?: { walletId: string; address: string; chainType: string } | null
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

const CHAIN_TYPES = ["ethereum", "solana", "sui", "ton", "tron"] as const

function extractWallets(privyUser: unknown): Record<string, WalletInfo> {
  const wallets: Record<string, WalletInfo> = {}
  const accounts: Array<Record<string, string>> =
    (privyUser as Record<string, unknown>).linkedAccounts as Array<Record<string, string>> ??
    (privyUser as Record<string, unknown>).linked_accounts as Array<Record<string, string>> ??
    []

  for (const chain of CHAIN_TYPES) {
    const wallet = accounts.find(
      (a) => a.type === "wallet" && (a.chainType === chain || a.chain_type === chain),
    )
    if (wallet) {
      wallets[chain] = {
        walletId: wallet.id,
        address: wallet.address,
        publicKey: wallet.publicKey ?? wallet.public_key ?? null,
      }
    }
  }
  return wallets
}

function hasCompleteWallets(wallets: unknown): boolean {
  if (!wallets || typeof wallets !== "object") return false
  const w = wallets as Record<string, unknown>
  // At least ETH + one other chain means wallets were created
  return Boolean(
    w.ethereum && (w.ethereum as Record<string, string>).address,
  )
}

// ── Server Actions ───────────────────────────────────────────────────────

export async function pregenerateWallet(email: string): Promise<WalletResult> {
  try {
    const { userId: clerkUserId } = await auth()

    if (!email || !clerkUserId) {
      return { success: false, error: "Authentication and email are required" }
    }

    await connectDB()

    // 1. Check DB — trust the local record to avoid unnecessary Privy API calls
    const existing = await UserWallet.findOne({ email }).lean()
    if (existing?.privyUserId && hasCompleteWallets(existing.wallets)) {
      // Ensure clerkUserId is linked
      if (!existing.clerkUserId || existing.clerkUserId !== clerkUserId) {
        await UserWallet.updateOne({ email }, { $set: { clerkUserId } })
      }
      return {
        success: true,
        privyUserId: existing.privyUserId,
        wallets: existing.wallets,
        tradingWallet: existing.tradingWallet ?? null,
      }
    }

    // 2. Create Privy user + wallets (only for first-time users or corrupt DB records)
    let privyUser
    try {
      privyUser = await privy.users().create({
        linked_accounts: [
          { type: "custom_auth", custom_user_id: clerkUserId },
          { type: "email", address: email },
        ],
        wallets: [
          { chain_type: "ethereum" },
          { chain_type: "solana" },
          { chain_type: "sui" },
          { chain_type: "ton" },
          { chain_type: "tron" },
        ],
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : ""
      const status = (error as { status?: number }).status

      // User already exists in Privy — fetch by email instead of DID parsing
      if (msg.includes("Input conflict") || status === 409 || status === 422) {
        try {
          privyUser = await privy.users().getByEmailAddress({ address: email })
        } catch {
          return { success: false, error: "User exists in Privy but could not be fetched" }
        }
      } else {
        console.error("[Privy Pregenerate] Create failed:", error)
        return { success: false, error: msg || "Failed to create Privy user" }
      }
    }

    if (!privyUser) {
      return { success: false, error: "Failed to create or fetch Privy user" }
    }

    // 3. Extract wallets from Privy response
    const wallets = extractWallets(privyUser)

    // 4. Upsert DB
    const userWallet = await UserWallet.findOneAndUpdate(
      { email },
      {
        email,
        clerkUserId,
        privyUserId: (privyUser as { id: string }).id,
        wallets,
      },
      { upsert: true, new: true },
    ).lean()

    return {
      success: true,
      privyUserId: (privyUser as { id: string }).id,
      wallets: userWallet.wallets,
      tradingWallet: userWallet.tradingWallet ?? null,
    }
  } catch (error: unknown) {
    console.error("[Privy Pregenerate] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export type TradingWalletStatus = {
  success: boolean
  hasTradingWallet: boolean
  tradingWallet?: { walletId: string; address: string; chainType: string; initialized: boolean } | null
  error?: string
}

export async function getTradingWalletStatus(email: string): Promise<TradingWalletStatus> {
  try {
    const { userId: clerkUserId } = await auth()
    if (!email || !clerkUserId) {
      return { success: false, hasTradingWallet: false, error: "Authentication required" }
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({
      $or: [{ email }, { clerkUserId }],
    }).lean()

    if (!userWallet?.privyUserId) {
      return { success: false, hasTradingWallet: false, error: "User record not found" }
    }

    const tw = userWallet.tradingWallet as {
      walletId?: string
      address?: string
      chainType?: string
      initialized?: boolean
    } | null

    return {
      success: true,
      hasTradingWallet: Boolean(tw?.walletId),
      tradingWallet: tw?.walletId
        ? {
            walletId: tw.walletId,
            address: tw.address ?? "",
            chainType: tw.chainType ?? "ethereum",
            initialized: tw.initialized ?? false,
          }
        : null,
    }
  } catch (error: unknown) {
    console.error("[getTradingWalletStatus] Error:", error)
    return {
      success: false,
      hasTradingWallet: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function refreshWallet(email: string): Promise<WalletResult> {
  try {
    if (!email) {
      return { success: false, error: "Email is required" }
    }

    await connectDB()

    // Fetch fresh data from Privy using the public SDK method
    let user
    try {
      user = await privy.users().getByEmailAddress({ address: email })
    } catch {
      return { success: false, error: "User not found in Privy. Please create wallets first." }
    }

    if (!user) {
      return { success: false, error: "User data not found" }
    }

    const wallets = extractWallets(user)

    // Upsert DB — preserve tradingWallet
    const userWallet = await UserWallet.findOneAndUpdate(
      { email },
      { $set: { privyUserId: user.id, wallets } },
      { upsert: true, new: true },
    ).lean()

    return {
      success: true,
      privyUserId: user.id,
      wallets,
      tradingWallet: userWallet.tradingWallet ?? null,
    }
  } catch (error: unknown) {
    console.error("[Privy] Error refreshing wallet:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
