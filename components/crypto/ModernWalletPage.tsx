"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, RefreshIcon, Shield01Icon } from "@hugeicons/core-free-icons"

import { useAuth } from "@/components/auth-provider"
import { AddressPill, ModeBadge, SectionMessage } from "@/components/crypto/primitives"
import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { RecoveryPanel } from "@/components/crypto/RecoveryPanel"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { InlineNotice, UnavailablePanel } from "@/components/ui/flow"
import {
  ActionPill,
  Balance,
  CardHeader,
  CardShell,
  EmptyState,
  Eyebrow,
  IconAction,
  ListRow,
  PageHeader,
  Rise,
  Skel,
  SkeletonRows,
} from "@/components/ui/system"
import { formatCryptoAmount, useCryptoBalances, type CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"
import { useCryptoNetworks } from "@/hooks/crypto/useCryptoNetworks"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useUsdIndex } from "@/hooks/crypto/useUsdIndex"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
  type CryptoErrorAction,
  type CryptoNetwork,
} from "@/lib/crypto-backend"
import { networkMetaFor } from "@/lib/crypto-backend/network-meta"
import { usd } from "@/lib/num"
import { CryptoSecurityPanel } from "./CryptoSecurityPanel"
import { ModernTransferFlow } from "./ModernTransferFlow"
import { WalletKeyExportPanel } from "./WalletKeyExportPanel"
import { WalletChainProvisioningPanel } from "./WalletChainProvisioningPanel"

const PAGE = "flex flex-col gap-6 p-4 md:p-6 lg:p-8"
const SUBTITLE = "Self-custodial — keys never leave this device"

const FAMILY_LABEL: Record<string, string> = {
  evm: "EVM",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

const DepositGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />
const SendGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />
const SecurityGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={Shield01Icon} className={className} />

/**
 * One holding's USD value, or `null` when nothing here can be trusted: no
 * live price for the symbol, or an amount that didn't parse. Never NaN — an
 * unpriced asset is excluded from the total and footnoted instead.
 */
function usdValueOf(balance: CryptoBalanceResult, index: Record<string, number> | null): number | null {
  const price = index?.[(balance.symbol ?? "").toUpperCase()]
  if (price === undefined || !Number.isFinite(price) || price <= 0) return null
  const amount = Number(formatCryptoAmount(balance.amountBaseUnits, balance.decimals))
  if (!Number.isFinite(amount)) return null
  return amount * price
}

/** The networks one account's address is valid on — a family has one address. */
function networksForFamily(family: string, networks: CryptoNetwork[] | undefined) {
  return (networks ?? []).filter((network) => network.family === family)
}

function asOfLabel(generatedAt: string | null): string | null {
  if (!generatedAt) return null
  const date = new Date(generatedAt)
  if (Number.isNaN(date.getTime())) return null
  return `As of ${date.toLocaleTimeString()}`
}

export function ModernWalletPage() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const networks = useCryptoNetworks()
  const balances = useCryptoBalances()
  const usdIndex = useUsdIndex()
  const userId = user?.userId ?? "anonymous"

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })

  const [unlockOpen, setUnlockOpen] = useState(false)
  // Task 11 mounts ModernReceiveModal on this state; the pill already owns it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [receiveOpen, setReceiveOpen] = useState(false)
  // refresh() rejects on a failed read. Swallowing it (the old `void` call)
  // left the page showing a stale snapshot with no explanation.
  const [refreshError, setRefreshError] = useState<unknown>(null)

  const refresh = balances.refresh
  const refreshBalances = () => {
    setRefreshError(null)
    refresh().catch((error: unknown) => setRefreshError(error))
  }

  const { total: totalUsd, unpriced } = useMemo(() => {
    let total = 0
    let unpricedCount = 0
    for (const balance of balances.balances) {
      const value = usdValueOf(balance, usdIndex)
      if (value === null) unpricedCount += 1
      else total += value
    }
    return { total, unpriced: unpricedCount }
  }, [balances.balances, usdIndex])

  // One notice per network, not per account — the same chain being down for
  // two accounts is one outage to read about.
  const outages = useMemo(() => {
    const byNetwork = new Map<string, string>()
    for (const item of balances.unavailableNetworks) {
      if (!byNetwork.has(item.networkId)) byNetwork.set(item.networkId, item.networkName)
    }
    return [...byNetwork].map(([networkId, networkName]) => ({ networkId, networkName }))
  }, [balances.unavailableNetworks])

  if (!isCryptoBackendEnabled) {
    return (
      <div className={PAGE}>
        <PageHeader title="Wallet" subtitle={SUBTITLE} actions={<ModeBadge mode="modern" />} />
        <UnavailablePanel
          title="The Worldstreet wallet isn't enabled"
          tone="muted"
          reason="Self-custody is still rolling out and isn't switched on for this account yet."
        />
      </div>
    )
  }

  const walletLoading = wallet.isLoading && !wallet.needsSetup
  const hasWallet = Boolean(wallet.data)
  // Prices are part of the hero figure, so the total waits for them too —
  // otherwise it prints an under-counted number and then jumps. Nothing to
  // value means nothing to wait for.
  const heroLoading = walletLoading || balances.isLoading || (usdIndex === null && balances.balances.length > 0)
  const asOf = asOfLabel(balances.generatedAt)

  const onWalletErrorAction = (action: CryptoErrorAction) => {
    if (action === "unlock") setUnlockOpen(true)
    else void wallet.refetch()
  }
  const onBalanceErrorAction = (action: CryptoErrorAction) => {
    if (action === "unlock") setUnlockOpen(true)
    else refreshBalances()
  }

  const refreshAction = (
    <IconAction
      icon={({ className }: { className?: string }) => (
        <HugeiconsIcon icon={RefreshIcon} className={`${className} ${balances.isRefreshing ? "animate-spin" : ""}`} />
      )}
      label={balances.isRefreshing ? "Syncing…" : "Refresh balances"}
      onClick={refreshBalances}
    />
  )

  return (
    <div className={PAGE}>
      <Rise>
        <PageHeader title="Wallet" subtitle={SUBTITLE} actions={<ModeBadge mode="modern" />} />
      </Rise>

      {/* Two invariants live on this one line — read both before editing it.
          (1) FIXED POSITION, MOUNTED UNCONDITIONALLY: this component owns the
          one-time recovery-secret modal, and it renders that from *mutation*
          state (WalletSetupFlow.tsx:49-56) which dies with the instance. The
          wallet query is invalidated the moment creation succeeds, so gating
          the mount on `wallet.needsSetup` would unmount it exactly then and
          destroy the user's only copy of the secret. Suppression is the
          PROP's job, never the mount's.
          (2) LOADING-AWARE PROP: `walletExists` is what hides the "create a
          wallet" CTA, and `Boolean(wallet.data)` is false during the first
          fetch as well as on a confirmed 404 — so a bare `hasWallet` offered
          setup on every cold load, beside the skeleton cards. Claiming the
          wallet "exists" while the query is unsettled keeps the CTA away
          until a 404 actually says setup is needed. It fails open on purpose:
          any settled non-404 state still offers setup, and creation is
          idempotent (`setup.data.existing`), so a weird backend answer can
          never strand a user with no way to make a wallet. */}
      <WalletSetupFlow walletExists={hasWallet || walletLoading} />

      {wallet.error && !wallet.needsSetup ? (
        <Rise delay={40}>
          <SectionMessage error={wallet.error} onAction={onWalletErrorAction} />
        </Rise>
      ) : null}

      {hasWallet || walletLoading ? (
        <>
          <Rise delay={40} className="flex w-fit flex-col gap-1">
            <Eyebrow>Est. Total Value</Eyebrow>
            {heroLoading ? (
              <Skel className="my-1.5 h-[clamp(2rem,4vw,3rem)] w-[clamp(11rem,22vw,17rem)] rounded-lg" />
            ) : (
              <Balance value={usd(totalUsd)} className="text-[clamp(2rem,4vw,3rem)]" />
            )}
            <div className="flex items-center gap-1">
              <p className="text-[13px] text-muted-foreground">
                {asOf ?? (heroLoading ? "Syncing…" : "Not synced yet")}
                {unpriced > 0 ? " · Some assets have no live price" : ""}
              </p>
              {refreshAction}
            </div>
          </Rise>

          {/* The verbs sit under the figure they act on (design-system §05). */}
          <Rise delay={80} className="flex flex-wrap gap-2">
            <ActionPill icon={DepositGlyph} label="Deposit" onClick={() => setReceiveOpen(true)} />
            <ActionPill icon={SendGlyph} label="Send" href="/wallet/modern/send" />
            <ActionPill icon={SecurityGlyph} label="Security" href="#security" />
          </Rise>

          <Rise delay={120}>
            <CardShell>
              <CardHeader
                title="Accounts"
                subtitle="One address per chain family"
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
              {walletLoading ? (
                <SkeletonRows rows={2} label="Reading your accounts" />
              ) : (
                <div className="flex flex-col pb-2">
                  {(wallet.data?.accounts ?? []).map((account) => {
                    const familyNetworks = networksForFamily(account.chainFamily, networks.data)
                    const meta = familyNetworks.length ? networkMetaFor(familyNetworks[0].id, networks.data) : null
                    const symbol = meta?.nativeSymbol ?? account.chainFamily
                    return (
                      <ListRow
                        key={account.id}
                        icon={() => <CoinAvatar symbol={symbol} size="lg" className="h-6 w-6" />}
                        title={FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase()}
                        subtitle={familyNetworks.map((network) => network.name).join(" · ") || account.state}
                        right={
                          account.canonicalAddress ? (
                            <AddressPill address={account.canonicalAddress} />
                          ) : (
                            // An AddressPill with no address is a control that
                            // copies nothing — say what's actually true instead.
                            <span className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              Address pending
                            </span>
                          )
                        }
                      />
                    )
                  })}
                </div>
              )}
            </CardShell>
          </Rise>

          <Rise delay={160}>
            <CardShell>
              <CardHeader title="Balances" right={refreshAction} />
              {outages.length > 0 || balances.error || refreshError ? (
                <div className="flex flex-col gap-2 px-4 pb-3">
                  {balances.error || refreshError ? (
                    <SectionMessage error={balances.error ?? refreshError} onAction={onBalanceErrorAction} />
                  ) : null}
                  {outages.map((outage) => (
                    <InlineNotice key={outage.networkId} tone="warning">
                      {outage.networkName} balances are temporarily unavailable — showing your last snapshot.
                    </InlineNotice>
                  ))}
                </div>
              ) : null}
              {balances.isLoading ? (
                <SkeletonRows rows={4} label="Reading your balances" />
              ) : balances.balances.length === 0 ? (
                <EmptyState
                  illustration="noCrypto"
                  title="No balances yet"
                  description="Deposit crypto to get started."
                  ctas={[{ label: "Deposit", href: "#" }]}
                />
              ) : (
                <div className="flex flex-col pb-2">
                  {balances.balances.map((balance) => {
                    const value = usdValueOf(balance, usdIndex)
                    return (
                      <ListRow
                        key={`${balance.accountId}:${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`}
                        icon={() => <CoinAvatar symbol={balance.symbol} src={balance.logo} size="lg" className="h-6 w-6" />}
                        title={balance.symbol}
                        subtitle={balance.networkName}
                        right={
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="text-[14px] font-semibold tabular-nums">
                              {formatCryptoAmount(balance.amountBaseUnits, balance.decimals)}
                            </span>
                            {value !== null ? (
                              <span className="text-[12px] text-muted-foreground tabular-nums">{usd(value)}</span>
                            ) : null}
                          </span>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </CardShell>
          </Rise>
        </>
      ) : null}

      <WalletUnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} />
      {/* ModernReceiveModal mounts here (Task 11) */}

      {wallet.data && packageQuery.data ? (
        <Rise delay={200}>
          <div id="security" className="flex flex-col gap-6">
            <CryptoSecurityPanel walletId={wallet.data.id} packageValue={packageQuery.data} />
            <RecoveryPanel walletId={wallet.data.id} packageValue={packageQuery.data} />
            <WalletKeyExportPanel walletId={wallet.data.id} accounts={wallet.data.accounts} packageValue={packageQuery.data} />
            <WalletChainProvisioningPanel walletId={wallet.data.id} packageValue={packageQuery.data} accounts={wallet.data.accounts} />
          </div>
        </Rise>
      ) : null}

      {/* Kept only until Task 13 lands /wallet/modern/send, which deletes this
          component and this slot. Removing it now would leave the Send pill as
          the sole — and not-yet-built — way to move money. */}
      {wallet.data && packageQuery.data && networks.data ? (
        <ModernTransferFlow
          walletId={wallet.data.id}
          packageValue={packageQuery.data}
          accounts={wallet.data.accounts}
          networks={networks.data}
          balances={balances.balances}
        />
      ) : null}
    </div>
  )
}
