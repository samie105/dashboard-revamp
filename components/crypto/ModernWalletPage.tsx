"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { RecoveryPanel } from "@/components/crypto/RecoveryPanel"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useCryptoNetworks } from "@/hooks/crypto/useCryptoNetworks"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { ActionPill, Balance, CardHeader, CardShell, Eyebrow, PageHeader } from "@/components/ui/system"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, Copy01Icon, RefreshIcon, Shield01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CryptoSecurityPanel } from "./CryptoSecurityPanel"
import { ModernTransferFlow } from "./ModernTransferFlow"
import { WalletKeyExportPanel } from "./WalletKeyExportPanel"
import { WalletChainProvisioningPanel } from "./WalletChainProvisioningPanel"

export function ModernWalletPage() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const networks = useCryptoNetworks()
  const userId = user?.userId ?? "anonymous"
  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const balances = useCryptoBalances()
  const [unlockOpen, setUnlockOpen] = useState(false)

  if (!isCryptoBackendEnabled) {
    return <p className="text-sm text-muted-foreground">Modern wallet tools are disabled. Set NEXT_PUBLIC_CRYPTO_ENABLED=true to enable them.</p>
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader title="Assets" subtitle="Your self-custodial crypto wallet" actions={<span className="rounded-full bg-credit-chip px-3 py-1.5 text-xs font-semibold text-credit">Modern wallet</span>} />

      <div className="flex flex-wrap gap-2">
        <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />} label="Deposit" href="/assets" />
        <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />} label="Send" href="/assets" />
        <ActionPill icon={({ className }) => <HugeiconsIcon icon={RefreshIcon} className={className} />} label="Refresh" onClick={() => { void wallet.refetch(); void networks.refetch(); void balances.refetch() }} />
      </div>

      <WalletSetupFlow walletExists={Boolean(wallet.data)} />
      {wallet.error && !wallet.needsSetup ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">Could not load the modern wallet: {wallet.error instanceof Error ? wallet.error.message : "unknown error"}</div> : null}

      {wallet.data ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <CardShell>
            <CardHeader
              title="My wallet"
              subtitle="Your modern wallet accounts across enabled networks"
              right={
                <button
                  type="button"
                  onClick={() => setUnlockOpen(true)}
                  className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Locked
                </button>
              }
            />
            <div className="space-y-3 px-4 pb-4">
              {wallet.data.accounts.map((account) => (
                <div key={account.id} className="rounded-xl bg-surface-sunken/70 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold capitalize">{account.chainFamily}</span>
                    <span className="text-xs text-muted-foreground">{account.state}</span>
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{account.canonicalAddress ?? "Address not committed"}</div>
                  <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => { if (account.canonicalAddress) void navigator.clipboard?.writeText(account.canonicalAddress) }}>
                    <HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" /> Copy address
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {networks.data?.map((network) => <span key={network.id} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-muted-foreground">{network.name} · {network.environment}</span>)}
              </div>
            </div>
          </CardShell>

          <CardShell>
            <CardHeader title="Portfolio value" subtitle="Live balances from the crypto backend" right={<HugeiconsIcon icon={Shield01Icon} className="h-5 w-5 text-primary" />} />
            <div className="px-4 pb-5">
              <Eyebrow>On-chain wallet</Eyebrow>
              <Balance value={balances.balances.length ? `${balances.balances.length} assets` : "—"} className="mt-1 text-[clamp(2rem,4vw,3rem)]" />
              <p className="mt-1 text-[13px] text-muted-foreground">Balances remain read-only until you unlock the wallet locally.</p>
            </div>
          </CardShell>
        </div>
      ) : null}

      {wallet.data && networks.data ? <CardShell><CardHeader title="Balances" subtitle="Live response from the crypto backend · refresh reads the providers again" /><div className="px-4 pb-4">{balances.isLoading ? <p className="text-sm text-muted-foreground">Loading balances…</p> : balances.error ? <p className="text-sm text-destructive">Balance endpoint failed: {balances.error instanceof Error ? balances.error.message : "unknown error"}</p> : balances.balances.length === 0 ? <p className="text-sm text-muted-foreground">The endpoint returned no non-zero balances.</p> : <><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{balances.balances.map((balance) => <div key={`${balance.accountId}:${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`} className="rounded-xl bg-surface-sunken/70 p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{balance.symbol}</span><span className="text-xs text-muted-foreground">{balance.networkName}</span></div><div className="mt-1 text-lg tabular-nums">{formatCryptoAmount(balance.amountBaseUnits, balance.decimals)}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{balance.name || (balance.asset.kind === "native" ? "Native asset" : balance.asset.identifier)}</div></div>)}</div>{balances.unavailableNetworks.length > 0 ? <p className="mt-3 text-xs text-amber-500">Some networks could not be read: {balances.unavailableNetworks.map((network) => network.networkName).join(", ")}. Their balances will appear after that provider recovers.</p> : null}</>}</div></CardShell> : null}
      {process.env.NODE_ENV !== "production" && balances.snapshot ? <details className="rounded-2xl border border-border/60 bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">Balance endpoint response</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(balances.snapshot, null, 2)}</pre></details> : null}
      <WalletUnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} />

      {wallet.data && packageQuery.data ? (
        <>
          <WalletKeyExportPanel walletId={wallet.data.id} accounts={wallet.data.accounts} packageValue={packageQuery.data} />
          <WalletChainProvisioningPanel walletId={wallet.data.id} packageValue={packageQuery.data} accounts={wallet.data.accounts} />
          <RecoveryPanel walletId={wallet.data.id} packageValue={packageQuery.data} />
          <CryptoSecurityPanel walletId={wallet.data.id} packageValue={packageQuery.data} />
          {networks.data ? <ModernTransferFlow walletId={wallet.data.id} packageValue={packageQuery.data} accounts={wallet.data.accounts} networks={networks.data} balances={balances.balances} /> : null}
        </>
      ) : null}
    </div>
  )
}
