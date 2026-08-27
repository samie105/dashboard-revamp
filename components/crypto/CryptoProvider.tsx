"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { isCryptoBackendEnabled, isLegacyPrivyEnabled } from "@/lib/crypto-backend"
import { useCryptoNetworks } from "@/hooks/crypto/useCryptoNetworks"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useModernWalletSetup } from "@/hooks/crypto/useModernWalletSetup"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"

type CryptoContextValue = {
  modernEnabled: boolean
  legacyEnabled: boolean
  wallet: ReturnType<typeof useCryptoWalletState>
  networks: ReturnType<typeof useCryptoNetworks>
  setup: ReturnType<typeof useModernWalletSetup>
  security: ReturnType<typeof useWalletSecurity>
}

const CryptoContext = createContext<CryptoContextValue | null>(null)

export function CryptoProvider({ children }: { children: ReactNode }) {
  const wallet = useCryptoWalletState()
  const networks = useCryptoNetworks()
  const setup = useModernWalletSetup()
  const security = useWalletSecurity(wallet.data?.id)

  const value = useMemo(() => ({
    modernEnabled: isCryptoBackendEnabled,
    legacyEnabled: isLegacyPrivyEnabled,
    wallet,
    networks,
    setup,
    security,
  }), [wallet, networks, setup, security])

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
}

export function useCryptoContext() {
  const context = useContext(CryptoContext)
  if (!context) throw new Error("useCryptoContext must be used inside CryptoProvider")
  return context
}
