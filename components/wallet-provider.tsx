"use client"

import * as React from "react"
import { useAuth } from "@/components/auth-provider"
import {
  pregenerateWallet,
  refreshWallet as refreshWalletAction,
  getTradingWalletStatus,
} from "@/lib/wallet-actions"

// ── Types ────────────────────────────────────────────────────────────────

export interface PrivyWallet {
  walletId: string
  address: string
  publicKey: string | null
}

export interface PrivyWallets {
  ethereum: PrivyWallet
  solana: PrivyWallet
  sui: PrivyWallet
  ton: PrivyWallet
  tron: PrivyWallet
}

export interface WalletAddresses {
  ethereum: string
  solana: string
  sui: string
  ton: string
  tron: string
}

export interface TradingWallet {
  walletId: string
  address: string
  chainType: string
}

interface WalletContextType {
  wallets: PrivyWallets | null
  addresses: WalletAddresses | null
  walletsGenerated: boolean
  isLoading: boolean
  error: string | null
  setupStatus: string | null
  tradingWallet: TradingWallet | null
  hasTradingWallet: boolean
  fetchWallets: () => Promise<void>
  refreshWallets: () => Promise<void>
}

const WalletContext = React.createContext<WalletContextType | undefined>(undefined)

// ── Provider ─────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth()

  const [wallets, setWallets] = React.useState<PrivyWallets | null>(null)
  const [addresses, setAddresses] = React.useState<WalletAddresses | null>(null)
  const [walletsGenerated, setWalletsGenerated] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [setupStatus, setSetupStatus] = React.useState<string | null>(null)
  const [tradingWallet, setTradingWallet] = React.useState<TradingWallet | null>(null)
  const [hasTradingWallet, setHasTradingWallet] = React.useState(false)

  const checkTradingWallet = React.useCallback(async () => {
    if (!user?.email) return
    try {
      const status = await getTradingWalletStatus(user.email)
      if (status.success) {
        setHasTradingWallet(status.hasTradingWallet)
        if (status.tradingWallet) setTradingWallet(status.tradingWallet)
      }
    } catch (err) {
      console.warn("[Wallet] Trading wallet check failed:", err)
    }
  }, [user?.email])

  const fetchWallets = React.useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false)
      return
    }

    const MAX_RETRIES = 2
    const RETRY_DELAYS = [2000, 5000]

    setIsLoading(true)
    setError(null)
    setSetupStatus("Connecting to wallet service…")

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) setSetupStatus(`Retrying… (attempt ${attempt + 1})`)
        else setSetupStatus("Generating multi-chain wallets…")

        const data = await pregenerateWallet(user.email)

        if (data.success && data.wallets) {
          setSetupStatus("Syncing wallet addresses…")
          setWallets(data.wallets as unknown as PrivyWallets)
          setAddresses({
            ethereum: data.wallets.ethereum?.address ?? "",
            solana: data.wallets.solana?.address ?? "",
            sui: data.wallets.sui?.address ?? "",
            ton: data.wallets.ton?.address ?? "",
            tron: data.wallets.tron?.address ?? "",
          })
          if (data.tradingWallet) setTradingWallet(data.tradingWallet)
          setSetupStatus("Wallets ready")
          setWalletsGenerated(true)
          setError(null)
          setSetupStatus(null)
          setIsLoading(false)
          return
        }

        if (data.error) throw new Error(data.error)
      } catch (err) {
        console.warn(`[Wallet] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, err)
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        } else {
          console.error("[Wallet] All retries exhausted:", err)
          setError(err instanceof Error ? err.message : "Failed to load wallets")
        }
      }
    }

    setIsLoading(false)
  }, [user?.email])

  const refreshWallets = React.useCallback(async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      setError(null)

      const data = await refreshWalletAction(user.email)

      if (!data.success) throw new Error(data.error ?? "Failed to refresh wallets")

      if (data.wallets) {
        setWallets(data.wallets as unknown as PrivyWallets)
        setAddresses({
          ethereum: data.wallets.ethereum?.address ?? "",
          solana: data.wallets.solana?.address ?? "",
          sui: data.wallets.sui?.address ?? "",
          ton: data.wallets.ton?.address ?? "",
          tron: data.wallets.tron?.address ?? "",
        })
        if (data.tradingWallet) setTradingWallet(data.tradingWallet)
        setWalletsGenerated(true)
      }
    } catch (err) {
      console.error("Error refreshing wallets:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh wallets")
    } finally {
      setIsLoading(false)
    }
  }, [user?.email])

  // Auto-fetch on mount when auth is ready
  React.useEffect(() => {
    if (isLoaded && user) {
      fetchWallets()
      checkTradingWallet()
    } else if (isLoaded && !user) {
      setIsLoading(false)
    }
  }, [isLoaded, user, fetchWallets, checkTradingWallet])

  const value = React.useMemo<WalletContextType>(
    () => ({
      wallets,
      addresses,
      walletsGenerated,
      isLoading,
      error,
      setupStatus,
      tradingWallet,
      hasTradingWallet,
      fetchWallets,
      refreshWallets,
    }),
    [wallets, addresses, walletsGenerated, isLoading, error, setupStatus, tradingWallet, hasTradingWallet, fetchWallets, refreshWallets],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useWallet() {
  const ctx = React.useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>")
  return ctx
}
