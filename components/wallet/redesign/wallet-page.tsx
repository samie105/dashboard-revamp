"use client"

/**
 * Wallet: the preview's page (app/(redesign)/wallet-unauth) on real data.
 * Same grid — hero, Move funds, balances and activity in the main column;
 * Move funds and Limits & security in a 408px side column from 2xl.
 *
 * Every hook, sum and guard is ModernWalletPage's (components/crypto/
 * ModernWalletPage.tsx, kept unused): the same balance / price / network
 * queries, the same valuation, the same setup ceremony, welcome guide,
 * unlock, security and Intertrain modals, error and outage notices.
 *
 * Unlike the preview, Move funds is mounted ONCE (placed by a media query
 * rather than rendered twice and hidden with CSS): its Withdraw tab is the
 * real send flow, and two copies would run two intents and two polls.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { DashScope } from "@/components/dash"
import { SectionMessage } from "@/components/crypto/primitives"
import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletSkeleton } from "@/components/crypto/WalletSkeleton"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { WalletSecurityModal } from "@/components/crypto/WalletSecurityModal"
import { IntertrainAddModal } from "@/components/crypto/IntertrainAddModal"
import { missingChainFamilies } from "@/components/crypto/WalletChainProvisioningPanel"
import { InlineNotice, UnavailablePanel } from "@/components/ui/flow"
import { Rise } from "@/components/ui/system"
import { WelcomeGuide } from "@/components/welcome-guide"
import { useMediaQuery } from "@/hooks/use-media-query"
import { formatCryptoAmount, useCryptoBalances } from "@/hooks/crypto/useCryptoBalances"
import { useCryptoNetworks } from "@/hooks/crypto/useCryptoNetworks"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useUsdChangeIndex, useUsdIndex } from "@/hooks/crypto/useUsdIndex"
import { CryptoBackendError, cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled, type CryptoErrorAction } from "@/lib/crypto-backend"
import { networkMetaFor } from "@/lib/crypto-backend/network-meta"
import { COIN_IMAGES } from "@/lib/coin-images"
import { NETWORK_ICON } from "@/lib/networks"
import { ACCOUNTS, accountView, asOfLabel, usdValueOf, type WalletRow } from "@/lib/wallet-view"
import { WalletHero } from "@/components/wallet/redesign/hero"
import { ActionPanel, type DepositChain } from "@/components/wallet/redesign/action-panel"
import { BalancesTable } from "@/components/wallet/redesign/balances-table"
import { SecurityLimits, WalletActivity, type SecurityView } from "@/components/wallet/redesign/activity"

const FAMILY_LABEL: Record<string, string> = {
  evm: "Ethereum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
  bitcoin: "Bitcoin",
  intertrain: "Intertrain (WSK)",
}

// Tailwind v4 leaves buttons on the default cursor; every live control here
// shows a pointer (disabled ones keep not-allowed).
const PAGE = "ws-icon-mono [&_button:not(:disabled)]:cursor-pointer [&_[role=radio]]:cursor-pointer mx-auto grid w-full max-w-[1720px] grid-cols-1 gap-4 p-4 md:gap-5 md:p-6 2xl:grid-cols-[minmax(0,1fr)_408px]"

export function WalletPage() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const networks = useCryptoNetworks()
  const balances = useCryptoBalances()
  const usdIndex = useUsdIndex()
  const changeIndex = useUsdChangeIndex()
  const userId = user?.userId ?? "anonymous"
  const wide = useMediaQuery("(min-width: 1536px)")

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })

  // The Futures (trading) account — the same request and cache key the
  // funding flow and the trade screen's funding panel use.
  const futuresQuery = useQuery({
    queryKey: ["crypto", "hyperliquid", "account", userId],
    queryFn: ({ signal }) => cryptoBackendClient.getHyperliquidAccount(signal),
    enabled: isCryptoBackendEnabled && Boolean(user?.userId) && Boolean(wallet.data),
    refetchInterval: 30_000,
    staleTime: 5_000,
  })
  const futuresBalances = futuresQuery.data?.balances ?? null

  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const [helpSignal, setHelpSignal] = React.useState(0)
  const [securityOpen, setSecurityOpen] = React.useState(false)
  const [securityInitialView, setSecurityInitialView] = React.useState<"menu" | SecurityView>("menu")
  // Only the Intertrain prompt narrows the networks pane to Intertrain.
  const [familiesToAdd, setFamiliesToAdd] = React.useState<string[] | undefined>(undefined)
  const [intertrainPromptOpen, setIntertrainPromptOpen] = React.useState(false)
  const [setupCeremony, setSetupCeremony] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState<unknown>(null)

  const refresh = balances.refresh
  const refreshBalances = React.useCallback(() => {
    setRefreshError(null)
    refresh().catch((error: unknown) => setRefreshError(error))
  }, [refresh])

  const familyOf = React.useCallback(
    (networkId: string) => (networks.data ?? []).find((network) => network.id === networkId)?.family,
    [networks.data],
  )

  /* Same pass as ModernWalletPage: total, per-family value, and where each
     stood 24h ago (value / (1 + change)), so the move is value-weighted. */
  const valuation = React.useMemo(() => {
    const family: Record<string, { now: number; before: number }> = {}
    let now = 0
    let before = 0
    let unpriced = 0
    for (const balance of balances.balances) {
      const value = usdValueOf(balance, usdIndex)
      if (value === null) {
        unpriced += 1
        continue
      }
      const change = changeIndex?.[(balance.symbol ?? "").toUpperCase()]
      const was = change !== undefined ? value / (1 + change / 100) : value
      now += value
      before += was
      const f = familyOf(balance.networkId)
      if (f) {
        family[f] ??= { now: 0, before: 0 }
        family[f].now += value
        family[f].before += was
      }
    }
    return { now, before, family, unpriced }
  }, [balances.balances, usdIndex, changeIndex, familyOf])
  const walletUsd = valuation.now
  const accounts = React.useMemo(
    () =>
      accountView(
        walletUsd,
        futuresBalances ? { accountValue: futuresBalances.perpsAccountValueUsdc, withdrawable: futuresBalances.perpsWithdrawableUsdc } : null,
      ),
    [walletUsd, futuresBalances],
  )
  const totalUsd = accounts.total

  const rows = React.useMemo<WalletRow[]>(() => {
    const list: WalletRow[] = balances.balances.map((balance) => {
      const value = usdValueOf(balance, usdIndex)
      return {
        key: `${balance.accountId}:${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`,
        symbol: balance.symbol,
        logo:
          balance.logo
          ?? (balance.asset.kind === "token" ? COIN_IMAGES[balance.symbol.toUpperCase()] : undefined)
          ?? NETWORK_ICON[networkMetaFor(balance.networkId, networks.data)?.key ?? ""],
        network: balance.networkName,
        family: familyOf(balance.networkId) ?? "",
        account: "spot" as WalletRow["account"],
        amount: formatCryptoAmount(balance.amountBaseUnits, balance.decimals),
        value,
        share: value !== null && totalUsd > 0 ? (value / totalUsd) * 100 : null,
        change: changeIndex?.[(balance.symbol ?? "").toUpperCase()],
      }
    })
    // The Futures account's collateral, as one USDC row: its value in
    // total, the withdrawable part available, the rest held as margin.
    if (futuresBalances && futuresBalances.perpsAccountValueUsdc > 0) {
      const value = futuresBalances.perpsAccountValueUsdc
      const free = Math.min(Math.max(0, futuresBalances.perpsWithdrawableUsdc), value)
      const fmt = (n: number) => String(Number(n.toFixed(2)))
      list.push({
        key: "futures:usdc",
        symbol: "USDC",
        logo: COIN_IMAGES.USDC,
        network: "Trading account",
        family: "",
        account: "futures" as const,
        amount: fmt(value),
        available: fmt(free),
        held: fmt(value - free),
        value,
        share: totalUsd > 0 ? (value / totalUsd) * 100 : null,
        change: undefined,
      })
    }
    // Biggest first; anything unpriced sinks rather than claiming a rank.
    list.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    return list
  }, [balances.balances, usdIndex, changeIndex, networks.data, familyOf, totalUsd, futuresBalances])

  /* One entry per chain family the wallet holds keys for: its address, the
     networks that address serves, and the value sitting behind it. */
  const chains = React.useMemo(() => {
    return (wallet.data?.accounts ?? [])
      .map((account) => {
        const familyNetworks = (networks.data ?? []).filter((network) => network.family === account.chainFamily)
        const meta = familyNetworks.length ? networkMetaFor(familyNetworks[0].id, networks.data) : null
        return {
          key: account.chainFamily,
          name: FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase(),
          caption: familyNetworks.map((network) => network.name).join(" · ") || account.state,
          symbol: meta?.nativeSymbol ?? account.chainFamily,
          icon: meta ? NETWORK_ICON[meta.key] : undefined,
          address: account.canonicalAddress,
          explorer: meta && account.canonicalAddress ? { name: meta.explorerName, url: meta.explorerUrl(account.canonicalAddress) } : undefined,
          value: valuation.family[account.chainFamily]?.now,
        }
      })
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  }, [wallet.data, networks.data, valuation])

  const depositChains = React.useMemo(() => chains.filter((c): c is typeof c & { address: string } => Boolean(c.address)) as DepositChain[], [chains])
  const spotUsdc = React.useMemo(() => {
    const row = balances.balances.find((b) => b.networkId === "arbitrum-one" && b.symbol.toUpperCase() === "USDC")
    if (!row) return balances.isLoading ? null : 0
    const n = Number(formatCryptoAmount(row.amountBaseUnits, row.decimals))
    return Number.isFinite(n) ? n : null
  }, [balances.balances, balances.isLoading])
  const tabs = ACCOUNTS.map((a) => ({ key: a.key, label: a.label, soon: a.soon }))
  const chainForAsset = React.useCallback((symbol: string) => rows.find((r) => r.symbol === symbol)?.family, [rows])
  const networkName = React.useCallback(
    (networkId: string) => (networks.data ?? []).find((n) => n.id === networkId)?.name ?? networkMetaFor(networkId, networks.data)?.label ?? "",
    [networks.data],
  )

  const btcPrice = usdIndex?.BTC ?? usdIndex?.btc ?? 0
  const btcEquivalent = btcPrice > 0 && totalUsd > 0 ? totalUsd / btcPrice : null
  // The 24h move is the wallet's own (the Futures account carries no
  // yesterday figure), so it is stated for Spot only.
  const dayPnl = valuation.before > 0 ? valuation.now - valuation.before : null
  const dayPct = (() => {
    if (valuation.before <= 0) return undefined
    const pct = ((valuation.now - valuation.before) / valuation.before) * 100
    return Number.isFinite(pct) && Math.abs(pct) >= 0.005 ? pct : undefined
  })()

  const outages = React.useMemo(() => {
    const byNetwork = new Map<string, string>()
    for (const item of balances.unavailableNetworks) if (!byNetwork.has(item.networkId)) byNetwork.set(item.networkId, item.networkName)
    return [...byNetwork].map(([networkId, name]) => ({ networkId, name }))
  }, [balances.unavailableNetworks])

  const networksToAdd = wallet.data ? missingChainFamilies(wallet.data.accounts).length : 0
  const hasIntertrainAccount = Boolean(wallet.data?.accounts.some((account) => account.chainFamily === "intertrain"))

  React.useEffect(() => {
    if (!wallet.data || !packageQuery.data || setupCeremony || hasIntertrainAccount) return
    if (typeof window !== "undefined" && window.sessionStorage.getItem("worldstreet:intertrain-prompt-dismissed") === "1") return
    setIntertrainPromptOpen(true)
  }, [wallet.data, packageQuery.data, setupCeremony, hasIntertrainAccount])

  const openSecurity = (view: "menu" | SecurityView, families?: string[]) => {
    setSecurityInitialView(view)
    setFamiliesToAdd(families)
    setSecurityOpen(true)
  }

  if (!isCryptoBackendEnabled) {
    return (
      <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-4">
        <UnavailablePanel
          title="The Worldstreet wallet isn't enabled"
          tone="muted"
          reason="The new wallet is still rolling out and isn't switched on for your account yet."
        />
      </DashScope>
    )
  }

  const walletLoading = wallet.isLoading && !wallet.needsSetup
  const hasWallet = Boolean(wallet.data)
  const setupIncomplete = hasWallet && packageQuery.error instanceof CryptoBackendError && packageQuery.error.status === 404
  const ceremonyUndecided = walletLoading || packageQuery.isLoading
  // The Futures account is part of the total too, so wait for its first read.
  const heroLoading = walletLoading || balances.isLoading || (usdIndex === null && balances.balances.length > 0) || futuresQuery.isLoading
  const asOf = asOfLabel(balances.generatedAt)
  const syncLine = `${asOf ?? (heroLoading ? "Syncing…" : "Not synced yet")}${valuation.unpriced > 0 ? " · Some assets have no live price" : ""}`

  const onWalletErrorAction = (action: CryptoErrorAction) => {
    if (action === "unlock") setUnlockOpen(true)
    else void wallet.refetch()
  }
  const onBalanceErrorAction = (action: CryptoErrorAction) => {
    if (action === "unlock") setUnlockOpen(true)
    else refreshBalances()
  }

  const notices =
    outages.length > 0 || balances.error || refreshError ? (
      <div className="flex flex-col gap-2">
        {balances.error || refreshError ? <SectionMessage error={balances.error ?? refreshError} onAction={onBalanceErrorAction} /> : null}
        {outages.map((outage) => (
          <InlineNotice key={outage.networkId} tone="warning">
            {outage.name} balances are temporarily unavailable — showing your last snapshot.
          </InlineNotice>
        ))}
      </div>
    ) : undefined

  const actionPanel = (
    <React.Suspense>
      <ActionPanel
        chains={depositChains}
        chainForAsset={chainForAsset}
        loading={walletLoading || networks.isLoading}
        missingNetworks={networksToAdd > 0}
        onAddNetworks={() => openSecurity("networks")}
        onSent={refreshBalances}
        spotUsdc={spotUsdc}
      />
    </React.Suspense>
  )

  return (
    <DashScope className={PAGE}>
      <WelcomeGuide ceremonyVisible={setupCeremony || ceremonyUndecided} openSignal={helpSignal} />

      {/* Mounted unconditionally, in a fixed position: it owns the one-time
          recovery-secret modal (see ModernWalletPage for the full note). */}
      <WalletSetupFlow walletExists={hasWallet || walletLoading} resume={setupIncomplete} onVisibilityChange={setSetupCeremony} />

      {wallet.error && !wallet.needsSetup ? (
        <Rise delay={40} className="2xl:col-span-2">
          <SectionMessage error={wallet.error} onAction={onWalletErrorAction} />
        </Rise>
      ) : null}

      {!hasWallet && !walletLoading && setupCeremony ? (
        <Rise delay={40} className="2xl:col-span-2">
          <WalletSkeleton />
        </Rise>
      ) : null}

      {hasWallet || walletLoading ? (
        <>
          <div className="flex min-w-0 flex-col gap-4 md:gap-5">
            <Rise>
              <WalletHero
                loading={heroLoading}
                total={totalUsd}
                btc={btcEquivalent}
                dayPct={dayPct}
                dayPnl={dayPnl}
                parts={accounts.parts}
                state={accounts.state}
                syncLine={syncLine}
                refreshing={balances.isRefreshing}
                onRefresh={refreshBalances}
                onHelp={() => setHelpSignal((value) => value + 1)}
              />
            </Rise>
            {!wide && <Rise delay={60}>{actionPanel}</Rise>}
            <Rise delay={120}>
              <BalancesTable rows={rows} tabs={tabs} loading={balances.isLoading} notices={notices} />
            </Rise>
            <Rise delay={180}>
              <WalletActivity networkName={networkName} />
            </Rise>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 md:gap-5">
            {wide && <Rise delay={80}>{actionPanel}</Rise>}
            <Rise delay={200}>
              <SecurityLimits
                chainsOn={wallet.data?.accounts.length ?? 0}
                networksToAdd={networksToAdd}
                canOpen={Boolean(wallet.data && packageQuery.data)}
                onOpen={openSecurity}
                onUnlock={() => setUnlockOpen(true)}
              />
            </Rise>
          </aside>
        </>
      ) : null}

      <WalletUnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} />

      {wallet.data && packageQuery.data ? (
        <WalletSecurityModal
          open={securityOpen}
          onOpenChange={setSecurityOpen}
          walletId={wallet.data.id}
          packageValue={packageQuery.data}
          accounts={wallet.data.accounts}
          networksToAdd={networksToAdd}
          initialView={securityInitialView}
          familiesToAdd={familiesToAdd}
        />
      ) : null}
      {wallet.data && packageQuery.data ? (
        <IntertrainAddModal
          open={intertrainPromptOpen}
          onOpenChange={(open) => {
            setIntertrainPromptOpen(open)
            if (!open && typeof window !== "undefined") window.sessionStorage.setItem("worldstreet:intertrain-prompt-dismissed", "1")
          }}
          onAdd={() => {
            setIntertrainPromptOpen(false)
            openSecurity("networks", ["intertrain"])
          }}
          onLearnMore={() => window.open("https://intertrain.online", "_blank", "noopener,noreferrer")}
        />
      ) : null}
    </DashScope>
  )
}
