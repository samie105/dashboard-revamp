"use client"

import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"

/**
 * The name to greet someone by: the display name they set in Settings
 * (saved on their dashboard profile), else their sign-in name, else "Trader".
 * For greetings and the account menu only — anything that needs a LEGAL name
 * (fiat holder names, KYC) must keep reading the sign-in fields.
 */
export function useDisplayName(): string {
  const { user } = useAuth()
  const { profile } = useProfile()
  const chosen = profile?.displayName?.trim()
  if (chosen) return chosen
  const signIn = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : ""
  return signIn || "Trader"
}
