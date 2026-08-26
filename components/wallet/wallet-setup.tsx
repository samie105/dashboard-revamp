"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import {
  CardHeader,
  CardShell,
  EmptyState,
  ListRow,
  PageHeader,
  Skel,
} from "@/components/ui/system"
import { CryptoApiError, type WalletDetails } from "@/lib/crypto/client"
import type { AuthMe } from "@/lib/crypto/api"
import { useCryptoApi } from "@/hooks/useCryptoApi"
import { useNetworks } from "@/hooks/useNetworks"

const WalletGlyph = (p: { className?: string }) => (
  <HugeiconsIcon icon={Wallet01Icon} {...p} />
)
const AddGlyph = (p: { className?: string }) => (
  <HugeiconsIcon icon={Add01Icon} {...p} />
)

export function WalletSetup() {
  const api = useCryptoApi()
  const { networks, loading: networksLoading, error: networksError } = useNetworks()
  const [identity, setIdentity] = useState<AuthMe | null>(null)
  const [wallet, setWallet] = useState<WalletDetails | null>(null)
  const [walletState, setWalletState] = useState<"loading" | "absent" | "ready">("loading")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setIdentity(await api.getAuthMe())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crypto backend unreachable")
      return
    }
    try {
      setWallet(await api.client.getWallet())
      setWalletState("ready")
    } catch (e) {
      // 404 NOT_FOUND before first creation is the documented normal state.
      if (e instanceof CryptoApiError && e.code === "NOT_FOUND") setWalletState("absent")
      else setError(e instanceof Error ? e.message : "Failed to load wallet")
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const createWallet = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await api.client.createWalletWithAccounts(["evm", "solana"])
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet creation failed")
    } finally {
      setBusy(false)
    }
  }, [api, load])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Wallet"
        subtitle={
          identity
            ? `Connected as ${identity.clerkUserId}`
            : "Connecting to the wallet service…"
        }
      />

      {error && (
        <div className="rounded-2xl bg-debit-chip px-4 py-3 text-[13px] text-debit">
          {error}
        </div>
      )}

      <CardShell>
        <CardHeader
          title="Your wallet"
          subtitle="Self-custodial — keys never leave this device"
        />
        {walletState === "loading" && !error && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Skel className="h-12" />
            <Skel className="h-12" />
          </div>
        )}
        {walletState === "absent" && (
          <>
            <EmptyState
              icon={WalletGlyph}
              title="No wallet yet"
              description="Create your wallet to reserve accounts on every supported chain. Keys are generated and secured in the next step — nothing sensitive happens yet."
            />
            <div className="flex justify-center pb-6">
              <button
                onClick={createWallet}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                <AddGlyph className="h-3.5 w-3.5" />
                {busy ? "Creating…" : "Create wallet"}
              </button>
            </div>
          </>
        )}
        {walletState === "ready" && wallet && (
          <div className="flex flex-col pb-2">
            {wallet.accounts.map((account) => (
              <ListRow
                key={account.id}
                icon={WalletGlyph}
                title={account.chainFamily === "evm" ? "EVM account" : "Solana account"}
                subtitle={
                  account.canonicalAddress ??
                  "Reserved — awaiting activation (passkey + key generation, next release)"
                }
                right={
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {account.state}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </CardShell>

      <CardShell>
        <CardHeader
          title="Networks"
          subtitle="Enabled by the wallet service — testnets during rollout"
        />
        {networksLoading ? (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Skel className="h-12" />
            <Skel className="h-12" />
            <Skel className="h-12" />
          </div>
        ) : networksError ? (
          <p className="px-4 pb-4 text-[13px] text-muted-foreground">{networksError}</p>
        ) : (
          <div className="flex flex-col pb-2">
            {networks.map((network) => (
              <ListRow
                key={network.id}
                title={network.name}
                subtitle={`${network.family} · ${network.environment}`}
                right={
                  network.chainId !== undefined ? (
                    <span className="text-[12px] text-muted-foreground">
                      #{network.chainId}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </CardShell>
    </div>
  )
}
