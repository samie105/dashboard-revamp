"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { EmptyState, Eyebrow, PageHeader, Segmented } from "@/components/ui/system"
import { InlineNotice } from "@/components/ui/flow"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { approvePreparedHyperliquidAgent } from "@/lib/crypto-wallet"
import { revocationTypedData, signDelegationTypedData } from "@/lib/crypto-wallet/delegation-signing"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { copyTradingApi } from "@/lib/copy-trading/api"
import { buildGrantInput, type GrantForm } from "@/lib/copy-trading/forms"
import type { Delegation } from "@/lib/copy-trading/types"
import { AccessPanel, type AccessStage } from "./access-panel"
import { DiscoverPanel } from "./discover-panel"
import { FollowingPanel } from "./following-panel"
import { ActivityPanel } from "./activity-panel"

type Tab = "discover" | "following" | "activity" | "access"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

export function CopyTradingClient() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<Tab>("discover")
  const [stage, setStage] = React.useState<AccessStage>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resume = React.useRef<(() => void) | null>(null)

  const userKey = user?.userId ?? "anonymous"
  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userKey),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const delegations = useQuery({ queryKey: ["copy-trading", "delegations"], queryFn: copyTradingApi.delegations, refetchInterval: 30_000 })
  const subscriptions = useQuery({ queryKey: ["copy-trading", "subscriptions"], queryFn: copyTradingApi.subscriptions, refetchInterval: 15_000 })
  const leaders = useQuery({ queryKey: ["copy-trading", "leaders"], queryFn: copyTradingApi.leaders, staleTime: 60_000 })
  const orders = useQuery({ queryKey: ["copy-trading", "orders"], queryFn: copyTradingApi.orders, refetchInterval: 10_000 })

  const evmAccount = wallet.data?.accounts.find((a) => a.chainFamily === "evm" && a.state === "active")
  const master = evmAccount?.canonicalAddress
  const walletBlocker = !isCryptoBackendEnabled
    ? "Modern wallet backend is not enabled"
    : !wallet.data ? "Create your modern wallet first"
    : !evmAccount || !master ? "Your modern wallet has no active EVM account"
    : !packageQuery.data ? "Preparing your modern wallet" : null

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["copy-trading"] })

  /** Run a signing action, asking for the wallet passphrase first if it is locked. */
  function withUnlock(action: () => Promise<void>) {
    if (!user?.userId || !wallet.data?.id) return
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) {
      resume.current = () => void action()
      setUnlockOpen(true)
      return
    }
    void action()
  }

  function createAccess(form: GrantForm) {
    if (walletBlocker || !user?.userId || !wallet.data?.id || !packageQuery.data || !evmAccount || !master) return
    const built = buildGrantInput(form, master)
    if (!built.ok) return setError(built.error)
    const userId = user.userId, walletId = wallet.data.id, pkg = packageQuery.data, accountId = evmAccount.id
    withUnlock(async () => {
      setError(null)
      try {
        setStage("prepare")
        const prepared = await copyTradingApi.prepareDelegation(built.value)
        setStage("grant")
        const signature = await signDelegationTypedData(userId, walletId, pkg, accountId, prepared.typedData)
        setStage("venue")
        const approval = await cryptoBackendClient.createHyperliquidIntent({ type: "approveAgent", agentAddress: prepared.delegateAddress, agentName: "Worldstreet copy trading", idempotencyKey: crypto.randomUUID() })
        await approvePreparedHyperliquidAgent(userId, walletId, pkg, accountId, approval)
        setStage("activate")
        // Hyperliquid can take a moment to list a freshly approved agent.
        for (let attempt = 0; ; attempt++) {
          try { await copyTradingApi.activateDelegation(prepared.delegationId, signature); break }
          catch (e) { if (attempt >= 5 || !messageOf(e, "").includes("approve the delegate")) throw e; await sleep(1500) }
        }
        setStage("done")
        await refresh()
      } catch (e) {
        setStage("idle")
        setError(messageOf(e, "Trading access could not be set up."))
      }
    })
  }

  function revokeAccess(d: Delegation) {
    if (walletBlocker || !user?.userId || !wallet.data?.id || !packageQuery.data || !evmAccount || !master) return
    const userId = user.userId, walletId = wallet.data.id, pkg = packageQuery.data, accountId = evmAccount.id
    withUnlock(async () => {
      setError(null)
      try {
        const signature = await signDelegationTypedData(userId, walletId, pkg, accountId, revocationTypedData(master, d.ref))
        await copyTradingApi.revokeDelegation(d.ref, signature)
        await refresh()
      } catch (e) { setError(messageOf(e, "Access could not be revoked.")) }
    })
  }

  const active = (delegations.data ?? []).filter((d) => d.status === "active" && d.grant.expiresAt * 1000 > Date.now())
  const serviceDown = delegations.isError || leaders.isError

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <PageHeader title="Copy trading" subtitle="Mirror on-platform traders with the amount and limits you choose" back="/" />
      <InlineNotice tone="warning">
        Copy trading can place trades only. Your delegate key can&rsquo;t withdraw or transfer funds, and you set its limits. Trading can lose money.
      </InlineNotice>
      {serviceDown && <InlineNotice tone="error">Copy trading is unavailable right now. Nothing is being copied or changed.</InlineNotice>}
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <Segmented<Tab>
        grow
        value={tab}
        onChange={setTab}
        options={[
          { key: "discover", label: "Discover" },
          { key: "following", label: "Following" },
          { key: "activity", label: "Activity" },
          { key: "access", label: "Access" },
        ]}
      />
      {tab === "discover" && (
        leaders.isLoading ? <Eyebrow>Loading traders…</Eyebrow>
        : (leaders.data ?? []).length === 0 ? <EmptyState title="No traders to copy yet" description="Traders appear here when they join the copy-trading program." />
        : <DiscoverPanel leaders={leaders.data ?? []} delegations={active} following={(subscriptions.data ?? []).filter((s) => s.status !== "stopped").map((s) => s.leaderId)} onNeedAccess={() => setTab("access")} onSubscribed={async () => { await refresh(); setTab("following") }} />
      )}
      {tab === "following" && <FollowingPanel subscriptions={subscriptions.data ?? []} leaders={leaders.data ?? []} loading={subscriptions.isLoading} onChanged={refresh} />}
      {tab === "activity" && <ActivityPanel orders={orders.data ?? []} loading={orders.isLoading} />}
      {tab === "access" && <AccessPanel delegations={delegations.data ?? []} loading={delegations.isLoading} blocker={walletBlocker} stage={stage} onCreate={createAccess} onRevoke={revokeAccess} />}
      <WalletUnlockDialog action="permission-change" open={unlockOpen} onOpenChange={setUnlockOpen} onUnlocked={() => { const a = resume.current; resume.current = null; a?.() }} />
    </div>
  )
}
