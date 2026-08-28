"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { isCryptoBackendEnabled, isLegacyPrivyEnabled } from "@/lib/crypto-backend"
import {
  WALLET_MODE_STORAGE_PREFIX,
  canChooseWalletMode,
  resolveWalletMode,
  type WalletMode,
} from "@/lib/wallet-mode"

type WalletModeContextValue = {
  mode: WalletMode
  canChoose: boolean
  setMode: (mode: WalletMode) => void
}

const WalletModeContext = React.createContext<WalletModeContextValue | null>(null)

export function WalletModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { legacyWalletExists } = useWallet()
  const storageKey = `${WALLET_MODE_STORAGE_PREFIX}${user?.userId ?? "anonymous"}`
  const [stored, setStored] = React.useState<WalletMode | null>(null)

  // ?wallet= deep-links (from /trade share URLs) win over the saved preference,
  // then become the saved preference. localStorage can throw in private modes.
  React.useEffect(() => {
    try {
      const url = new URLSearchParams(window.location.search).get("wallet")
      const saved = window.localStorage.getItem(storageKey)
      if (url === "legacy" || url === "modern") setStored(url)
      else if (saved === "legacy" || saved === "modern") setStored(saved)
      else setStored(null)
    } catch { setStored(null) }
  }, [storageKey])

  const setMode = React.useCallback((mode: WalletMode) => {
    setStored(mode)
    try { window.localStorage.setItem(storageKey, mode) } catch {}
  }, [storageKey])

  // Deps intentionally omit `flags`: it's rebuilt every render from module
  // constants (isCryptoBackendEnabled/isLegacyPrivyEnabled never change) plus
  // legacyWalletExists, which is already listed below.
  const value = React.useMemo<WalletModeContextValue>(() => {
    const flags = { modernEnabled: isCryptoBackendEnabled, legacyEnabled: isLegacyPrivyEnabled, legacyWalletExists }
    return {
      mode: resolveWalletMode({ ...flags, stored }),
      canChoose: canChooseWalletMode(flags),
      setMode,
    }
  }, [stored, legacyWalletExists, setMode])

  return <WalletModeContext.Provider value={value}>{children}</WalletModeContext.Provider>
}

export function useWalletMode() {
  const context = React.useContext(WalletModeContext)
  if (!context) throw new Error("useWalletMode must be used inside WalletModeProvider")
  return context
}
