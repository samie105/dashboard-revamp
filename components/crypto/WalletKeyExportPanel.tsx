"use client"

import { useState } from "react"
import bs58 from "bs58"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"

import type { CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useAuth } from "@/components/auth-provider"
import { decryptLocalAccountKey } from "@/lib/crypto-wallet/account-secrets"
import { wipeBytes } from "@/lib/crypto-wallet/encoding"
import { toBase64Url } from "@/lib/crypto-wallet/encoding"

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function exportedKey(account: CryptoWalletAccount, secret: Uint8Array) {
  if (account.chainFamily === "solana") return { label: "Solana base58 secret key", value: bs58.encode(secret) }
  if (account.chainFamily === "sui") return { label: "Sui bech32 private key", value: Ed25519Keypair.fromSecretKey(secret).getSecretKey() }
  if (account.chainFamily === "evm") return { label: "EVM private key", value: `0x${bytesToHex(secret)}` }
  if (account.chainFamily === "tron") return { label: "TRON private key", value: bytesToHex(secret) }
  if (account.chainFamily === "ton") return { label: "TON Ed25519 seed", value: bytesToHex(secret) }
  return { label: `${account.chainFamily} private key`, value: toBase64Url(secret) }
}

export function WalletKeyExportPanel({ walletId, accounts, packageValue }: { walletId: string; accounts: CryptoWalletAccount[]; packageValue: CryptoWalletPackageDocument }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<{ account: CryptoWalletAccount; label: string; value: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportAccount(account: CryptoWalletAccount) {
    if (!user?.userId) return
    setError(null)
    try {
      const secret = await decryptLocalAccountKey(user.userId, walletId, packageValue, account.id)
      try {
        const result = exportedKey(account, secret)
        setSelected({ account, ...result })
      } finally {
        wipeBytes(secret)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unlock the wallet before exporting a key")
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border p-4">
      <div>
        <h2 className="font-semibold">Export individual wallet keys</h2>
        <p className="text-sm text-muted-foreground">Unlock the wallet first. Keys are decrypted only in this browser and are never uploaded.</p>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-sunken/70 p-3 text-sm">
            <div className="min-w-0"><p className="font-medium capitalize">{account.chainFamily}</p><p className="truncate text-xs text-muted-foreground">{account.canonicalAddress}</p></div>
            <button type="button" onClick={() => void exportAccount(account)} className="rounded-xl border px-3 py-2 text-xs font-medium">Export private key</button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {selected ? (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3" role="dialog" aria-modal="true" aria-label={`${selected.account.chainFamily} private key`}>
          <div><p className="font-semibold">{selected.account.chainFamily} private key</p><p className="text-xs text-destructive">Anyone with this key controls the address. Do not paste it into chat or upload it.</p></div>
          <p className="text-xs text-muted-foreground">Format: {selected.label}</p>
          <code className="block max-h-32 select-all break-all rounded-lg border bg-background p-2 text-xs">{selected.value}</code>
          <div className="flex gap-2"><button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => void navigator.clipboard?.writeText(selected.value)}>Copy key</button><button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => setSelected(null)}>Close</button></div>
        </div>
      ) : null}
    </section>
  )
}
