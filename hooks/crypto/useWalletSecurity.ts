"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoWalletPackage, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import {
  authenticateAndUnlockWallet,
  buildRecoveryPackage,
  createRecoveryProof,
  rotateWalletPackage,
  replaceWalletPasskeyWithRecovery,
  registerNewWalletPasskey,
  setWalletPassphraseWithRecovery,
  unlockWalletWithPassphrase,
  unlockWalletWithPin,
  setWalletPin,
  unlockWalletWithRecoverySecret,
  authorizeWalletWithRecoverySecret,
  addWalletChains,
} from "@/lib/crypto-wallet/wallet-security"
import { clearUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { saveEncryptedWalletPackage } from "@/lib/crypto-wallet/local-storage"
import { setUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"

export function useWalletSecurity(walletId?: string) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const authorizationTokenRef = useRef<string | null>(null)
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn

  useEffect(() => {
    authorizationTokenRef.current = null
    clearUnlockedWalletState()
  }, [userId])

  const registerPasskey = useCallback(async () => {
    const result = await registerNewWalletPasskey()
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.recovery(userId) })
    return result
  }, [queryClient, userId])

  const authenticatePasskey = useCallback(async () => {
    if (!walletId) throw new Error("A wallet ID is required to authorize the wallet")
    const result = await authenticateAndUnlockWallet(userId, walletId)
    authorizationTokenRef.current = result.walletAuthorizationToken
    return result
  }, [userId, walletId])

  const unlockWithRecoverySecret = useCallback(async (packageValue: CryptoWalletPackageDocument, recoverySecret: string) => {
    if (!walletId) throw new Error("A wallet ID is required to unlock the wallet")
    return unlockWalletWithRecoverySecret(userId, walletId, packageValue, recoverySecret)
  }, [userId, walletId])

  const unlockWithPassphrase = useCallback(async (packageValue: CryptoWalletPackageDocument, passphrase: string) => {
    if (!walletId) throw new Error("A wallet ID is required to unlock the wallet")
    return unlockWalletWithPassphrase(userId, walletId, packageValue, passphrase)
  }, [userId, walletId])

  const unlockWithPin = useCallback(async (packageValue: CryptoWalletPackageDocument, pin: string) => {
    if (!walletId) throw new Error("A wallet ID is required to unlock the wallet")
    return unlockWalletWithPin(userId, walletId, packageValue, pin)
  }, [userId, walletId])

  const setPin = useCallback(async (packageValue: CryptoWalletPackageDocument, passphrase: string, pin: string) => {
    if (!walletId) throw new Error("A wallet ID is required to configure the wallet PIN")
    const result = await setWalletPin(userId, walletId, packageValue, passphrase, pin, () => cryptoBackendClient.authorizeWallet())
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
    return result
  }, [queryClient, userId, walletId])

  const setPassphraseWithRecovery = useCallback(async (packageValue: CryptoWalletPackageDocument, recoverySecret: string, passphrase: string) => {
    if (!walletId) throw new Error("A wallet ID is required to configure the wallet passphrase")
    const result = await setWalletPassphraseWithRecovery(userId, walletId, packageValue, recoverySecret, passphrase, () => authorizeWalletWithRecoverySecret(recoverySecret))
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
    return result
  }, [queryClient, userId, walletId])

  const replacePasskey = useCallback(async (packageValue: CryptoWalletPackageDocument, recoverySecret: string) => {
    if (!walletId) throw new Error("A wallet ID is required to replace the wallet passkey")
    const result = await replaceWalletPasskeyWithRecovery(userId, walletId, packageValue, recoverySecret)
    authorizationTokenRef.current = result.walletAuthorizationToken
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.devices(userId) })
    return result
  }, [queryClient, userId, walletId])

  const getRecoveryStatus = useCallback(() => cryptoBackendClient.getRecoveryStatus(), [])
  const startRecovery = useCallback(() => cryptoBackendClient.startRecovery(), [])
  const completeRecovery = useCallback((input: {
    recoveryId: string
    recoveryPublicKey: string
    signature: string
    package: CryptoWalletPackage
  }) => cryptoBackendClient.completeRecovery(input), [])
  const prepareRecoveryPackage = useCallback((packageValue: CryptoWalletPackageDocument, recoverySecret: string) => {
    return buildRecoveryPackage(packageValue, recoverySecret)
  }, [])

  const rotateWallet = useCallback(async (recoverySecret: string, passphrase: string) => {
    if (!walletId) throw new Error("A wallet ID is required to rotate the wallet")
    const result = await rotateWalletPackage(userId, walletId, recoverySecret, passphrase, () => authorizeWalletWithRecoverySecret(recoverySecret))
    await saveEncryptedWalletPackage(userId, walletId, result.package)
    setUnlockedWalletState(userId, walletId, result.dek, 5 * 60_000)
    result.dek.fill(0)
    authorizationTokenRef.current = null
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.wallet(userId) })
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.devices(userId) })
    return result.package
  }, [queryClient, userId, walletId])

  const addChains = useCallback(async (packageValue: CryptoWalletPackageDocument, passphrase: string, recoverySecret: string) => {
    if (!walletId) throw new Error("A wallet ID is required to add chains")
    const result = await addWalletChains(userId, walletId, packageValue, passphrase, recoverySecret, () => authorizeWalletWithRecoverySecret(recoverySecret))
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.wallet(userId) })
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
    // Both balance keys — the wallet page reads `balanceSnapshot`, so without
    // it the chains just added stay missing from the balances until a reload.
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
    await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
    return result
  }, [queryClient, userId, walletId])

  const devices = useQuery({
    queryKey: cryptoQueryKeys.devices(userId),
    queryFn: () => cryptoBackendClient.listDevices(),
    enabled,
    staleTime: 60_000,
  })

  const enrollDevice = useCallback(async (input: {
    label: string
    platform?: string
    publicKey: string
    keyAgreementPublicKey?: string
  }) => {
    const token = authorizationTokenRef.current
    if (!token) throw new Error("Authenticate the wallet before enrolling a device")
    return cryptoBackendClient.startDeviceEnrollment(input, token)
  }, [])

  const completeDeviceEnrollment = useCallback(async (input: { deviceId: string; ceremonyId: string; signature: string }) => {
    const token = authorizationTokenRef.current
    if (!token) throw new Error("Authenticate the wallet before completing device enrollment")
    const result = await cryptoBackendClient.completeDeviceEnrollment(input, token)
    await devices.refetch()
    return result
  }, [devices])

  const revokeDevice = useCallback(async (deviceId: string, recoverySecret: string) => {
    const token = (await authorizeWalletWithRecoverySecret(recoverySecret)).walletAuthorizationToken
    const result = await cryptoBackendClient.revokeDevice(deviceId, token)
    authorizationTokenRef.current = null
    clearUnlockedWalletState()
    await devices.refetch()
    return result
  }, [devices])

  const makeRecoveryProof = useCallback((recoverySecret: string, challenge: string) => {
    return createRecoveryProof(recoverySecret, challenge)
  }, [])

  const clear = useCallback(() => {
    authorizationTokenRef.current = null
    clearUnlockedWalletState()
  }, [])

  return {
    registerPasskey,
    authenticatePasskey,
    unlockWithPassphrase,
    unlockWithPin,
    setPin,
    unlockWithRecoverySecret,
    setPassphraseWithRecovery,
    replacePasskey,
    getRecoveryStatus,
    startRecovery,
    completeRecovery,
    prepareRecoveryPackage,
    rotateWallet,
    addChains,
    makeRecoveryProof,
    devices: devices.data ?? [],
    devicesLoading: devices.isLoading,
    enrollDevice,
    completeDeviceEnrollment,
    revokeDevice,
    clear,
  }
}
