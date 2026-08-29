"use client"

import { useMemo, useState, type ComponentType, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, ChartLineData01Icon, EyeIcon, RefreshIcon, Shield01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { AddressPill, ModeBadge, SectionMessage } from "@/components/crypto/primitives"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { RecoveryPanel } from "@/components/crypto/RecoveryPanel"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { InlineNotice, UnavailablePanel } from "@/components/ui/flow"
import {
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
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { formatCryptoAmount, useCryptoBalances, type CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"
import { useUsdChangeIndex } from "@/hooks/crypto/useUsdIndex"
import { useCryptoNetworks } from "@/hooks/crypto/useCryptoNetworks"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useUsdIndex } from "@/hooks/crypto/useUsdIndex"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
  type CryptoErrorAction,
  type CryptoNetwork,
} from "@/lib/crypto-backend"
import { networkMetaFor } from "@/lib/crypto-backend/network-meta"
import { usd } from "@/lib/num"
import { CryptoSecurityPanel } from "./CryptoSecurityPanel"
import { WalletKeyExportPanel } from "./WalletKeyExportPanel"
import { WalletChainProvisioningPanel } from "./WalletChainProvisioningPanel"

const PAGE = "flex flex-col gap-6 p-4 md:p-6 lg:p-8"
const SUBTITLE = "Only you can open this wallet"

const FAMILY_LABEL: Record<string, string> = {
  evm: "Ethereum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

/** Gradient stroke for the glass address cards — brand gold dissolving
 *  diagonally to nothing, identical to the dashboard's account cards
 *  (user-card.tsx): a masked ring so the translucent fill keeps showing the
 *  silk field through the card. */
const GOLD_STROKE: CSSProperties = {
  background:
    "linear-gradient(135deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, var(--primary) 14%, transparent) 38%, transparent 68%)",
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  maskComposite: "exclude",
}

/** Allocation strip tones — a neutral opacity ladder, never gold: gold is
 *  brand/action, and the DS forbids it as a data colour. */
const ALLOCATION_TONES = ["bg-foreground/75", "bg-foreground/50", "bg-foreground/30", "bg-foreground/[0.18]", "bg-foreground/10"]

const AMOUNT_MASK = "••••"

const DepositGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />
const SendGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />
const SecurityGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={Shield01Icon} className={className} />
const TradeGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={ChartLineData01Icon} className={className} />

/** The round icon-button-with-label — the action grammar every consumer
 *  wallet trains people on. Gold only on the single primary verb. */
function RoundAction({
  icon: Icon,
  label,
  primary,
  href,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  primary?: boolean
  href?: string
  onClick?: () => void
}) {
  const circle = primary
    ? "bg-primary text-primary-foreground shadow-[0_10px_28px_-10px_rgba(234,179,8,0.55)]"
    : "bg-surface-sunken text-foreground ring-1 ring-border/25"
  const inner = (
    <>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:brightness-110 motion-reduce:group-hover:translate-y-0 ${circle}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11.5px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        {label}
      </span>
    </>
  )
  const shell = "group flex flex-col items-center gap-1.5"
  return href ? (
    <Link href={href} className={shell}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={shell}>{inner}</button>
  )
}

/** The card in the wallet — a payment-card object carrying the brand mark,
 *  a chip, and the primary address grouped like a card number. Deliberately
 *  dark in both themes: a black-and-gold card stays a black-and-gold card
 *  on a light desk. Press to copy the full address. */
function WalletCardVisual({ address, label }: { address?: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const grouped = address
    ? `${address.slice(0, 6)}  ••••  ••••  ${address.slice(-6)}`
    : "••••  ••••  ••••  ••••"
  return (
    <button
      type="button"
      disabled={!address}
      aria-label={address ? `Copy ${label} address` : "Address pending"}
      onClick={() => {
        if (!address) return
        navigator.clipboard?.writeText(address).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }).catch(() => {})
      }}
      className="group relative hidden aspect-[1.586] w-[290px] shrink-0 overflow-hidden rounded-2xl text-left transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 lg:block"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#2E2A27_0%,#1C1917_48%,#100E0D_100%)]" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(130% 100% at 100% 0%, rgba(234,179,8,0.16) 0%, rgba(234,179,8,0.045) 42%, transparent 64%)" }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl p-px opacity-90" style={GOLD_STROKE} />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/worldstreet-logo/WorldStreet1.png" alt="" className="h-6 w-6 opacity-90" />
          <span
            aria-hidden
            className="grid h-6 w-8 grid-cols-2 gap-px overflow-hidden rounded-[5px] bg-gradient-to-br from-yellow-200/70 via-yellow-500/60 to-yellow-800/60 p-[3px]"
          >
            <span className="rounded-[1px] bg-black/25" />
            <span className="rounded-[1px] bg-black/10" />
            <span className="rounded-[1px] bg-black/10" />
            <span className="rounded-[1px] bg-black/25" />
          </span>
        </div>
        <span className="font-mono text-[13px] tracking-[0.13em] text-white/85">{grouped}</span>
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {copied ? "Address copied" : label}
            </span>
            <span className="text-[11.5px] font-semibold tracking-[0.02em] text-white/90">WorldStreet</span>
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary/90">Only yours</span>
        </div>
      </div>
    </button>
  )
}

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
  const changeIndex = useUsdChangeIndex()
  const userId = user?.userId ?? "anonymous"

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })

  const [unlockOpen, setUnlockOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  // Scopes the modal's warning to one token when opened from a balance row;
  // `null` from the Deposit pill or the empty-state CTA, the wallet's
  // generic "receive anything" view. Kept (not cleared) on close, matching
  // ReceiveModal's precedent — clearing it in the same tick would unmount
  // the modal's content before its exit animation plays.
  const [receiveAsset, setReceiveAsset] = useState<string | null>(null)
  const openReceive = (asset: string | null = null) => {
    setReceiveAsset(asset)
    setReceiveOpen(true)
  }
  // refresh() rejects on a failed read. Swallowing it (the old `void` call)
  // left the page showing a stale snapshot with no explanation.
  const [refreshError, setRefreshError] = useState<unknown>(null)

  const refresh = balances.refresh
  const refreshBalances = () => {
    setRefreshError(null)
    refresh().catch((error: unknown) => setRefreshError(error))
  }

  const { hidden, toggle: toggleHidden } = useBalancePrivacy()

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

  // USD value held per chain family — each glass address card wears the value
  // that actually lives behind that address.
  const familyUsd = useMemo(() => {
    const map: Record<string, number> = {}
    for (const balance of balances.balances) {
      const family = (networks.data ?? []).find((network) => network.id === balance.networkId)?.family
      const value = usdValueOf(balance, usdIndex)
      if (family && value !== null) map[family] = (map[family] ?? 0) + value
    }
    return map
  }, [balances.balances, networks.data, usdIndex])

  // Portfolio allocation by asset for the strip above the balance rows —
  // top four assets named, everything else folded into "Other".
  const allocation = useMemo(() => {
    const totals = new Map<string, number>()
    for (const balance of balances.balances) {
      const value = usdValueOf(balance, usdIndex)
      if (value !== null && value > 0) totals.set(balance.symbol, (totals.get(balance.symbol) ?? 0) + value)
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 4)
    const rest = sorted.slice(4).reduce((sum, [, value]) => sum + value, 0)
    const segments = [...top.map(([symbol, value]) => ({ label: symbol, value }))]
    if (rest > 0) segments.push({ label: "Other", value: rest })
    return segments
  }, [balances.balances, usdIndex])

  // The card visual wears the wallet's primary identity — the Ethereum
  // address by convention, or whatever account exists first.
  const primaryAccount = useMemo(
    () => (wallet.data?.accounts ?? []).find((account) => account.chainFamily === "evm") ?? wallet.data?.accounts[0],
    [wallet.data],
  )

  const heroStats = useMemo(() => {
    const pricedNetworks = new Set(balances.balances.map((balance) => balance.networkId))
    return [
      { label: "Assets", value: balances.balances.length },
      { label: "Networks", value: pricedNetworks.size },
      { label: "Accounts", value: wallet.data?.accounts.length ?? 0 },
    ]
  }, [balances.balances, wallet.data])

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
          reason="The new wallet is still rolling out and isn't switched on for your account yet."
        />
      </div>
    )
  }

  const walletLoading = wallet.isLoading && !wallet.needsSetup
  const hasWallet = Boolean(wallet.data)
  // A wallet with no encrypted package is a setup that was interrupted between
  // the backend wallet and the commit — the tab was closed, or the commit
  // failed. `createSelfCustodialWallet` get-or-creates at BOTH levels (an
  // existing wallet is reused; an existing package short-circuits the whole
  // ceremony), so re-running it is safe: it picks up the orphaned wallet and
  // finishes it with fresh keys instead of stranding the user with an account
  // they can neither use nor recreate.
  const setupIncomplete =
    hasWallet && packageQuery.error instanceof CryptoBackendError && packageQuery.error.status === 404
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
          state (WalletSetupFlow derives the modal straight off
          `setup.data?.recoverySecret`) which dies with the instance — as does
          the staged progress of an attempt in flight. The wallet query is invalidated the moment
          creation succeeds, so gating the mount on `wallet.needsSetup` would
          unmount it exactly then and destroy the user's only copy of the
          secret. Suppression is the PROP's job, never the mount's.
          (2) LOADING-AWARE PROP: `walletExists` is what hides the "create a
          wallet" CTA, and `Boolean(wallet.data)` is false during the first
          fetch as well as on a confirmed 404 — so a bare `hasWallet` offered
          setup on every cold load, beside the skeleton cards. Claiming the
          wallet "exists" while the query is unsettled keeps the CTA away
          until a 404 actually says setup is needed. It fails open on purpose:
          any settled non-404 state still offers setup, and creation is
          idempotent (`setup.data.existing`), so a weird backend answer can
          never strand a user with no way to make a wallet.
          `resume` is the one thing allowed to overrule the suppression: a
          wallet whose package 404s needs the flow back on screen precisely
          BECAUSE the wallet exists. */}
      <WalletSetupFlow walletExists={hasWallet || walletLoading} resume={setupIncomplete} />

      {wallet.error && !wallet.needsSetup ? (
        <Rise delay={40}>
          <SectionMessage error={wallet.error} onAction={onWalletErrorAction} />
        </Rise>
      ) : null}

      {hasWallet || walletLoading ? (
        <>
          {/* ── The wallet card — the page's thesis as one object. Glass fill
                 over the silk field, the gold gradient-stroke ring, ambient
                 gold bloom inside; balance, shape stats, and the verbs all
                 live ON the card, like the thing in your pocket. ── */}
          <Rise delay={40}>
            <section className="ws-card-glass relative overflow-hidden rounded-2xl bg-card/70 p-5 md:p-6">
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl p-px" style={GOLD_STROKE} />
              {/* Ambient gold, hero pages only (DS §atmosphere) — two soft
                  blooms, never a flood. */}
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-primary/[0.08] blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-60 w-60 rounded-full bg-primary/[0.04] blur-3xl" />

              <div className="relative flex flex-col gap-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex w-fit flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <Eyebrow>Est. Total Value</Eyebrow>
                      <button
                        type="button"
                        onClick={toggleHidden}
                        aria-label={hidden ? "Show balances" : "Hide balances"}
                        className={`transition-colors ${hidden ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
                      >
                        <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                    {heroLoading ? (
                      <Skel className="my-1.5 h-[clamp(2.4rem,5vw,3.6rem)] w-[clamp(12rem,24vw,19rem)] rounded-lg" />
                    ) : (
                      <Balance value={usd(totalUsd)} hidden={hidden} className="text-[clamp(2.4rem,5vw,3.6rem)]" />
                    )}
                    <div className="flex items-center gap-1">
                      <p className="text-[13px] text-muted-foreground">
                        {asOf ?? (heroLoading ? "Syncing…" : "Not synced yet")}
                        {unpriced > 0 ? " · Some assets have no live price" : ""}
                      </p>
                      {refreshAction}
                    </div>
                  </div>

                  {/* The card in the wallet — primary address as the card
                      number, press to copy. lg+ only; mobile leads with the
                      figure and the verbs. */}
                  <WalletCardVisual
                    address={primaryAccount?.canonicalAddress}
                    label={primaryAccount ? (FAMILY_LABEL[primaryAccount.chainFamily] ?? primaryAccount.chainFamily) : "Wallet"}
                  />
                </div>

                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                  {/* The verbs, in the round grammar every wallet trains —
                      gold on the one primary verb only. */}
                  <div className="flex gap-5">
                    <RoundAction icon={DepositGlyph} label="Deposit" primary onClick={() => openReceive()} />
                    <RoundAction icon={SendGlyph} label="Send" href="/wallet/modern/send" />
                    <RoundAction icon={TradeGlyph} label="Trade" href="/trade" />
                    <RoundAction icon={SecurityGlyph} label="Security" href="#security" />
                  </div>

                  {/* The wallet's shape at a glance — real counts, no invented data. */}
                  <div className="hidden items-center divide-x divide-border/40 sm:flex">
                    {heroStats.map((stat) => (
                      <div key={stat.label} className="flex flex-col items-end gap-1 px-5 first:pl-0 last:pr-0">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                          {stat.label}
                        </span>
                        <span className="text-[13.5px] font-semibold tabular-nums">
                          {heroLoading ? "––" : stat.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </Rise>

          <Rise delay={120} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Eyebrow>Your addresses</Eyebrow>
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Locked
              </button>
            </div>
            {walletLoading ? (
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:overflow-visible">
                {[0, 1, 2].map((index) => (
                  <Skel key={index} className="h-[104px] min-w-[200px] flex-1 rounded-2xl sm:min-w-0" />
                ))}
              </div>
            ) : (
              // The dashboard's glass account-card grammar (user-card.tsx):
              // translucent fill over the silk field, gold gradient-stroke
              // ring, hover lift. Each card is one address you can share.
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:overflow-visible">
                {(wallet.data?.accounts ?? []).map((account) => {
                  const familyNetworks = networksForFamily(account.chainFamily, networks.data)
                  const meta = familyNetworks.length ? networkMetaFor(familyNetworks[0].id, networks.data) : null
                  const symbol = meta?.nativeSymbol ?? account.chainFamily
                  const value = familyUsd[account.chainFamily]
                  return (
                    <div
                      key={account.id}
                      className="ws-card-glass group relative flex min-w-[200px] flex-1 shrink-0 flex-col gap-3 rounded-2xl bg-card/70 p-4 pb-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/60 hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.5)] motion-reduce:hover:translate-y-0 sm:min-w-0"
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl p-px opacity-80 transition-opacity group-hover:opacity-100" style={GOLD_STROKE} />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <CoinAvatar symbol={symbol} size="lg" className="h-7 w-7 shrink-0" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-[13px] font-semibold leading-tight">
                              {FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase()}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">
                              {familyNetworks.map((network) => network.name).join(" · ") || account.state}
                            </span>
                          </div>
                        </div>
                        {value !== undefined && value > 0 ? (
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
                            {hidden ? AMOUNT_MASK : usd(value)}
                          </span>
                        ) : null}
                      </div>
                      {account.canonicalAddress ? (
                        <AddressPill address={account.canonicalAddress} className="w-fit" />
                      ) : (
                        // An AddressPill with no address is a control that
                        // copies nothing — say what's actually true instead.
                        <span className="w-fit rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          Address pending
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Rise>

          <Rise delay={160}>
            <CardShell>
              <CardHeader
                title="Balances"
                subtitle={balances.balances.length > 0 ? `${balances.balances.length} assets across ${new Set(balances.balances.map((b) => b.networkId)).size} networks` : undefined}
                right={refreshAction}
              />
              {/* Portfolio allocation — a neutral-toned strip (gold is never
                  a data colour). Hidden with the figures it would reveal. */}
              {!hidden && allocation.length > 0 && totalUsd > 0 ? (
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
                    {allocation.map((segment, index) => (
                      <span
                        key={segment.label}
                        className={`${ALLOCATION_TONES[index] ?? ALLOCATION_TONES[ALLOCATION_TONES.length - 1]} h-full`}
                        style={{ width: `${Math.max(1.5, (segment.value / totalUsd) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {allocation.map((segment, index) => (
                      <span key={segment.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span aria-hidden className={`h-2 w-2 rounded-full ${ALLOCATION_TONES[index] ?? ALLOCATION_TONES[ALLOCATION_TONES.length - 1]}`} />
                        {segment.label}
                        <span className="font-semibold tabular-nums">{Math.round((segment.value / totalUsd) * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
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
                  ctas={[{ label: "Deposit", onClick: () => openReceive() }]}
                />
              ) : (
                <div className="flex flex-col pb-2">
                  {balances.balances.map((balance) => {
                    const value = usdValueOf(balance, usdIndex)
                    const change = changeIndex?.[(balance.symbol ?? "").toUpperCase()]
                    return (
                      <ListRow
                        key={`${balance.accountId}:${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`}
                        icon={() => <CoinAvatar symbol={balance.symbol} src={balance.logo} size="lg" className="h-6 w-6" />}
                        title={balance.symbol}
                        subtitle={balance.networkName}
                        right={
                          <span className="flex shrink-0 items-center gap-1">
                            {/* Per-row deposit affordance — credit-tinted on
                                hover (money in), never gold: that's reserved
                                for the page's one primary CTA. */}
                            <button
                              type="button"
                              onClick={() => openReceive(balance.symbol)}
                              aria-label={`Deposit ${balance.symbol}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-credit-chip hover:text-credit"
                            >
                              <HugeiconsIcon icon={ArrowDownLeft01Icon} className="h-4 w-4" />
                            </button>
                            <span className="flex flex-col items-end">
                              <span className="text-[14px] font-semibold tabular-nums">
                                {hidden ? AMOUNT_MASK : formatCryptoAmount(balance.amountBaseUnits, balance.decimals)}
                              </span>
                              <span className="flex items-center gap-1.5 text-[12px] tabular-nums">
                                {value !== null ? (
                                  <span className="text-muted-foreground">{hidden ? AMOUNT_MASK : usd(value)}</span>
                                ) : null}
                                {/* 24h move — a market fact, not a holding, so it
                                    stays visible under privacy masking. */}
                                {change !== undefined ? (
                                  <span className={change >= 0 ? "text-credit" : "text-debit"}>
                                    {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                                  </span>
                                ) : null}
                              </span>
                            </span>
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
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} asset={receiveAsset} />

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

    </div>
  )
}
