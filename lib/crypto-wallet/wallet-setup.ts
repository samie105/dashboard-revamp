import { CryptoBackendError, cryptoBackendClient } from "@/lib/crypto-backend"
import type { CryptoWallet, CryptoWalletPackage, CryptoWalletPackageDocument, WalletAuthorizationResult } from "@/lib/crypto-backend"

import {
  derivePassphraseWrappingKey,
  deriveRecoveryWrappingKey,
  encryptKeyMaterial,
  fingerprint,
  WALLET_DEK_VERSION,
  WALLET_PACKAGE_FORMAT,
  WALLET_PASSPHRASE_KDF_ITERATIONS,
  wrapDek,
} from "./package-crypto"
import { randomBytes, toBase64Url, wipeBytes } from "./encoding"
import { generateAccountKey, generateLocalEd25519Key } from "./key-generation"
import { saveEncryptedWalletPackage } from "./local-storage"
import { setUnlockedWalletState } from "./unlock-state"

/**
 * The phases setup passes through, in the order this function runs them.
 * Reported as they START, so a checklist can show the work in flight rather
 * than a spinner: backend wallet + accounts, local key generation, local
 * encryption, then the one network write that makes it durable.
 */
export type WalletSetupStage = "account" | "keys" | "encrypt" | "commit"

type SetupOptions = {
  chainFamilies?: Array<"evm" | "solana" | "sui" | "ton" | "tron" | "bitcoin" | "intertrain">
  unlockTtlMs?: number
  walletPassphrase?: string
  authorizeWallet?: () => Promise<WalletAuthorizationResult>
  /** Progress callback for the setup checklist. Optional — omitting it leaves
   *  behaviour identical for every existing caller. */
  onStage?: (stage: WalletSetupStage) => void
}

export type SelfCustodialWalletSetupResult = {
  wallet: CryptoWallet
  package: CryptoWalletPackageDocument
  recoverySecret?: string
  passphraseConfigured: boolean
  /** @deprecated Kept for callers compiled against the previous setup result. */
  passkeyPrfSupported: false
  existing: boolean
}

const MIN_WALLET_PASSPHRASE_LENGTH = 12

export async function createSelfCustodialWallet(
  userId: string,
  options: SetupOptions = {},
): Promise<SelfCustodialWalletSetupResult> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    throw new Error("Self-custodial wallet setup requires HTTPS or localhost")
  }
  if (navigator.onLine === false) throw new Error("Connect to the internet before creating a wallet")

  const walletPassphrase = options.walletPassphrase?.trim() ?? ""
  if (walletPassphrase.length < MIN_WALLET_PASSPHRASE_LENGTH) {
    throw new Error(`Choose a wallet passphrase with at least ${MIN_WALLET_PASSPHRASE_LENGTH} characters`)
  }

  const chainFamilies = options.chainFamilies ?? ["evm", "solana", "sui", "ton", "tron", "bitcoin"]
  const stage = options.onStage ?? (() => {})
  let wallet: CryptoWallet

  // Get-or-create, at both levels: an existing wallet is reused, and an
  // existing package short-circuits the whole ceremony. That is what makes a
  // re-run after an interrupted setup safe — see the resume path in
  // ModernWalletPage.
  stage("account")
  try {
    wallet = await cryptoBackendClient.getWallet()
  } catch (error) {
    if (!(error instanceof CryptoBackendError) || error.status !== 404) throw error
    wallet = await cryptoBackendClient.createWallet()
  }

  try {
    const existingPackage = await cryptoBackendClient.getWalletPackage()
    await saveEncryptedWalletPackage(userId, String(wallet.id), existingPackage)
    return {
      wallet,
      package: existingPackage,
      passphraseConfigured: existingPackage.envelopes.some((envelope) => (envelope as { purpose?: string }).purpose === "passphrase"),
      passkeyPrfSupported: false,
      existing: true,
    }
  } catch (error) {
    if (!(error instanceof CryptoBackendError) || error.status !== 404) throw error
  }

  // The existing authenticated Clerk session authorizes first-time package
  // creation. The wallet passphrase and recovery secret remain local and are
  // never sent to Clerk or the crypto backend.
  const authorizeWallet = options.authorizeWallet ?? (() => cryptoBackendClient.authorizeWallet())
  const authorization = await authorizeWallet()
  const networks = await cryptoBackendClient.listNetworks()
  const preparedAccounts = await Promise.all(
    chainFamilies.map((chainFamily) =>
      cryptoBackendClient.prepareAccount({ chainFamily, keyAlgorithm: chainFamily === "evm" || chainFamily === "tron" || chainFamily === "bitcoin" ? "secp256k1" : "ed25519", keyType: "private-key" }),
    ),
  )
  stage("keys")
  const generated = preparedAccounts.map((account) => ({ account, key: generateAccountKey(account.chainFamily) }))

  stage("encrypt")
  const dek = randomBytes(32)
  const recoveryKey = generateLocalEd25519Key()
  const recoverySecret = toBase64Url(recoveryKey.seed)
  const recoveryEnvelopeId = crypto.randomUUID()
  const recoveryAad = `worldstreet:recovery:${wallet.id}:${recoveryEnvelopeId}`
  const recoveryWrap = await wrapDek(
    dek,
    await deriveRecoveryWrappingKey(recoveryKey.seed),
    recoveryAad,
  )

  const passphraseSalt = randomBytes(16)
  const passphraseEnvelopeId = crypto.randomUUID()
  const passphraseAad = `worldstreet:passphrase:${wallet.id}:${passphraseEnvelopeId}`
  const passphraseWrappingKey = await derivePassphraseWrappingKey(walletPassphrase, passphraseSalt)
  const passphraseWrap = await wrapDek(dek, passphraseWrappingKey, passphraseAad)
  wipeBytes(passphraseWrappingKey)

  const envelopes: Array<Record<string, unknown>> = [
    {
      envelopeId: passphraseEnvelopeId,
      purpose: "passphrase",
      methodVersion: 1,
      wrappedDek: passphraseWrap.wrappedDek,
      iv: passphraseWrap.iv,
      aad: passphraseWrap.aad,
      keyDerivationMetadata: {
        kind: "pbkdf2-sha256",
        version: 1,
        salt: toBase64Url(passphraseSalt),
        iterations: WALLET_PASSPHRASE_KDF_ITERATIONS,
      },
    },
    {
      envelopeId: recoveryEnvelopeId,
      purpose: "recovery",
      methodVersion: 1,
      wrappedDek: recoveryWrap.wrappedDek,
      iv: recoveryWrap.iv,
      aad: recoveryWrap.aad,
      keyDerivationMetadata: { kind: "recovery-secret-sha256", version: 1 },
      recoveryPublicKey: recoveryKey.publicKeyBase64Url,
      verificationFingerprint: await fingerprint(recoveryKey.publicKey),
    },
  ]
  wipeBytes(passphraseSalt)

  const packageAccounts = await Promise.all(generated.map(async ({ account, key }) => {
    try {
      const accountAad = `worldstreet:account:${wallet.id}:${account.id}`
      const encryptedKeyMaterial = await encryptKeyMaterial(key.secretKey, accountAad, dek)
      const addresses = networks
        .filter((network) => network.family === key.family)
        .map((network) => ({ networkId: network.id, address: key.canonicalAddress, isCanonical: true }))
      if (addresses.length === 0) throw new Error(`No enabled ${key.family} network is configured`)

      return {
        accountId: account.id,
        family: key.family,
        algorithm: key.algorithm,
        keyType: key.keyType,
        publicKey: key.publicKey,
        canonicalAddress: key.canonicalAddress,
        addresses,
        encryptedKeyMaterial,
        derivationMetadata: { source: "browser", version: 1 },
        capabilities: { localSigning: true },
      }
    } finally {
      wipeBytes(key.secretKey)
    }
  }))

  const packageValue = {
    format: WALLET_PACKAGE_FORMAT,
    version: Number(wallet.version ?? 0) + 1,
    baseVersion: Number(wallet.version ?? 0),
    walletId: wallet.id,
    securityVersion: Math.max(WALLET_DEK_VERSION, Number(wallet.securityVersion ?? 1)),
    accounts: packageAccounts,
    envelopes,
  } satisfies CryptoWalletPackage

  stage("commit")
  const committedPackage = await cryptoBackendClient.commitWalletPackage(
    packageValue,
    authorization.walletAuthorizationToken,
  )
  await saveEncryptedWalletPackage(userId, String(wallet.id), committedPackage)
  setUnlockedWalletState(userId, String(wallet.id), dek, options.unlockTtlMs ?? 5 * 60_000)

  wipeBytes(dek)
  wipeBytes(recoveryKey.seed)
  return {
    wallet,
    package: committedPackage,
    recoverySecret,
    passphraseConfigured: true,
    passkeyPrfSupported: false,
    existing: false,
  }
}
