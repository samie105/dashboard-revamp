"use client"

import { useEffect, useState } from "react"

import { useModernWalletSetup } from "@/hooks/crypto/useModernWalletSetup"
import { CardHeader, CardShell, Eyebrow } from "@/components/ui/system"

function RecoverySecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-secret-title">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border bg-background p-5 shadow-2xl">
        <div>
          <h2 id="recovery-secret-title" className="text-lg font-semibold">Save your wallet recovery secret</h2>
          <p className="mt-1 text-sm text-muted-foreground">This is the only time the new recovery secret is shown. You need it to recover the wallet, change the passphrase, rotate keys, or revoke devices.</p>
        </div>
        <code className="block max-h-40 select-all break-all rounded-xl border bg-surface-sunken p-3 text-xs leading-5">{secret}</code>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => void navigator.clipboard?.writeText(secret)}>Copy recovery secret</button>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => {
            const blob = new Blob([secret], { type: "text/plain" })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = "worldstreet-wallet-recovery-secret.txt"
            anchor.click()
            URL.revokeObjectURL(url)
          }}>Download secret</button>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-1" />
          <span>I have saved this recovery secret somewhere secure and offline.</span>
        </label>
        <button type="button" disabled={!saved} onClick={onClose} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">I saved it — continue</button>
      </div>
    </div>
  )
}

/** Opt-in modern wallet setup. The legacy WalletProvider remains untouched. */
export function WalletSetupFlow({ walletExists = false }: { walletExists?: boolean }) {
  const setup = useModernWalletSetup()
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (setup.data?.recoverySecret) {
      setRecoveryModalOpen(true)
    }
  }, [setup.data])

  if (!setup.isReady) return null
  if (walletExists && !recoveryModalOpen) return null

  return (
    <>
      {!walletExists ? <CardShell>
        <CardHeader title="Set up your self-custodial wallet" subtitle="A separate modern wallet that works alongside your legacy Privy wallet" />
        <div className="space-y-4 px-4 pb-4">
        <div className="rounded-xl bg-surface-sunken/70 p-3">
          <Eyebrow>Private by design</Eyebrow>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Keys are generated and encrypted in this browser. The backend stores wallet metadata and ciphertext only.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            One modern wallet is provisioned per Clerk account. Your wallet passphrase unlocks the encrypted keys locally, while the recovery secret is the emergency key for security changes. Your existing legacy Privy wallet stays available separately.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="wallet-passphrase" className="text-sm font-medium">Wallet passphrase</label>
          <input
            id="wallet-passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => { setPassphrase(event.target.value); setLocalError(null) }}
            autoComplete="new-password"
            placeholder="At least 12 characters"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
          <input
            id="wallet-passphrase-confirmation"
            type="password"
            value={passphraseConfirmation}
            onChange={(event) => { setPassphraseConfirmation(event.target.value); setLocalError(null) }}
            autoComplete="new-password"
            placeholder="Confirm wallet passphrase"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Use a strong phrase you can remember. It is never sent to WorldStreet or stored by Clerk.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (passphrase.length < 12) { setLocalError("Use at least 12 characters for the wallet passphrase"); return }
            if (passphrase !== passphraseConfirmation) { setLocalError("The wallet passphrases do not match"); return }
            setLocalError(null)
            void setup.createWallet({ passphrase })
          }}
          disabled={setup.isPending}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {setup.isPending ? "Creating encrypted wallet…" : "Create modern wallet"}
        </button>

        {setup.data && !setup.data.existing ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-credit">Modern wallet is ready.</p>
            <p className="text-muted-foreground">Wallet unlock: passphrase configured · recovery secret configured</p>
            {setup.data.recoverySecret ? <p className="text-xs text-amber-600">Recovery secret saved-confirmation required before leaving this setup.</p> : null}
          </div>
        ) : null}

        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

        {setup.error instanceof Error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{setup.error.message}</p>
          </div>
        ) : null}
        </div>
      </CardShell> : null}
      {recoveryModalOpen && setup.data?.recoverySecret ? <RecoverySecretModal secret={setup.data.recoverySecret} onClose={() => setRecoveryModalOpen(false)} /> : null}
    </>
  )
}
