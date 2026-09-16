"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, ChartLineData01Icon, EyeIcon, HelpCircleIcon, RefreshIcon, Shield01Icon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { ModeBadge, SectionMessage } from "@/components/crypto/primitives"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletSkeleton } from "@/components/crypto/WalletSkeleton"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { WalletSecurityModal } from "@/components/crypto/WalletSecurityModal"
import { IntertrainAddModal } from "@/components/crypto/IntertrainAddModal"
import { SendModal } from "@/components/crypto/SendModal"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { InlineNotice, UnavailablePanel } from "@/components/ui/flow"
import {
  Balance,
  CardHeader,
  CardShell,
  DeltaChip,
  EmptyState,
  Eyebrow,
  IconAction,
  PageHeader,
  Rise,
  SectionRule,
  Skel,
  SkeletonRows,
  WeightBar,
  allocationColor,
} from "@/components/ui/system"
import { CARD_HUE, HERO_HUE } from "@/components/ui/surface"
import { Movements } from "@/components/wallet/movements"
import { ChainPicker, type ChainGroup, type ChainHolding } from "@/components/wallet/chain-picker"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { formatCryptoAmount, useCryptoBalances, type CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"
import { COIN_IMAGES } from "@/lib/coin-images"
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
import { WelcomeGuide } from "@/components/welcome-guide"
import { missingChainFamilies } from "./WalletChainProvisioningPanel"
import { NETWORK_ICON } from "@/lib/networks"

const PAGE = "flex flex-col gap-6 p-4 md:p-6 lg:p-8"
const SUBTITLE = "Only you can open this wallet"

const FAMILY_LABEL: Record<string, string> = {
  evm: "Ethereum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
  intertrain: "Intertrain (WSK)",
}

/* The allocation strip and the per-row share bars both read from the house
   rank ladder (`allocationColor`) rather than a local neutral ramp. It looks
   like a gold exception but isn't: the ladder is ORDINAL, so a colour means
   "first, second, third", never "this asset is gold" — and it's the same
   ladder the Assets donut and the Portfolio bars use, so one holding wears
   one colour everywhere in the app. A private ramp here made this the only
   page that described composition in its own dialect. */

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
  dot,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  primary?: boolean
  href?: string
  onClick?: () => void
  /** Something is waiting behind this verb. Gold, because "there is
   *  something here for you" is exactly the active-state meaning gold is
   *  reserved for. */
  dot?: boolean
}) {
  const circle = primary
    ? "bg-primary text-primary-foreground shadow-[0_10px_28px_-10px_rgba(234,179,8,0.55)]"
    : "bg-surface-sunken text-foreground ring-1 ring-border/25"
  // Sized up on small screens, where this row is the whole control surface of
  // the wallet and a 48px target competes with nothing. Desktop keeps the
  // tighter figure — there the row sits beside the counters and reads fine.
  const inner = (
    <>
      <span
        className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:brightness-110 motion-reduce:group-hover:translate-y-0 sm:h-12 sm:w-12 ${circle}`}
      >
        <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
        {dot ? (
          <span
            aria-hidden
            className="absolute right-0 top-0 h-3 w-3 rounded-full bg-primary ring-2 ring-background sm:h-2.5 sm:w-2.5"
          />
        ) : null}
      </span>
      <span className="text-[12.5px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground sm:text-[11.5px] sm:font-medium">
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

function usdValueOf(balance: CryptoBalanceResult, index: Record<string, number> | null): number | null {
  // Stablecoins are worth one dollar by contract. They must not disappear
  // from the wallet total merely because the optional market-price request is
  // delayed, rate-limited, or returned without a stablecoin symbol.
  const stable = ["USDC", "USDT", "USDC.E", "USDT.E"].includes(balance.symbol.toUpperCase())
  if (stable) {
    const amount = Number(formatCryptoAmount(balance.amountBaseUnits, balance.decimals))
    return Number.isFinite(amount) ? amount : null
  }
  // WSK is mint-gated 1:1 against USD. Its value is a protocol invariant,
  // not a market quote, so it must remain valued even when the external
  // price feed has no WSK listing (or has not loaded yet).
  if (balance.symbol.toUpperCase() === "WSK") {
    if (!/^\d+$/.test(balance.amountBaseUnits) || balance.decimals < 0) return null
    const amount = Number(balance.amountBaseUnits) / 10 ** balance.decimals
    return Number.isFinite(amount) ? amount : null
  }
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
  // To the minute. Seconds on a snapshot that refreshes on a timer is
  // precision the number doesn't have.
  return `As of ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
}

/**
 * The wallet page — one view, for everybody.
 *
 * This page used to render two depths behind the Simple/Pro switch, keeping
 * the chain cards, the address, the hero counters and the share column away
 * from anyone who had not opted into Pro. The 2026-09-03 product review took
 * the switch off this page: everybody understands what is going on in a
 * wallet, so splitting it in two bought nothing here and cost the people who
 * actually trade the view they need. The switch itself is not gone from the
 * app — it moved to the screens where the two depths mean something, swap and
 * trade. Nothing on this page reads a mode any more, and if you are hunting
 * for a flag to hide something behind again, its absence is the decision.
 */
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
  // Bumped by the header's help button to re-open the welcome guide. A
  // counter, so a second press re-opens it without a reset in between.
  const [helpSignal, setHelpSignal] = useState(0)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [securityInitialView, setSecurityInitialView] = useState<"menu" | "networks">("menu")
  const [intertrainPromptOpen, setIntertrainPromptOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  // True while the setup ceremony owns the page. Creation flips `hasWallet`
  // true the instant it succeeds, so without this the finished wallet would
  // render BEHIND the flow's "Your wallet is ready" card and its "Open your
  // wallet" button would point at a wallet that was already on screen.
  const [setupCeremony, setSetupCeremony] = useState(false)
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

  /**
   * One pass over the balances producing everything the cards wear: the
   * total, the value sitting behind each network's address, and — for both —
   * where that money stood 24 hours ago.
   *
   * The 24h side is DERIVED rather than fetched. A holding worth `v` today
   * after a `c`% move was worth `v / (1 + c/100)` yesterday, so summing the
   * "before" column gives a properly value-weighted move; averaging the
   * percentages instead would let a $5 position outvote a $5,000 one. A
   * symbol the feed never move-stamped contributes the same figure to both
   * columns, so it dilutes the answer toward zero rather than inventing a
   * move for itself.
   */
  const valuation = useMemo(() => {
    const family: Record<string, { now: number; before: number }> = {}
    let now = 0
    let before = 0
    let unpricedCount = 0
    for (const balance of balances.balances) {
      const value = usdValueOf(balance, usdIndex)
      if (value === null) {
        unpricedCount += 1
        continue
      }
      const change = changeIndex?.[(balance.symbol ?? "").toUpperCase()]
      const was = change !== undefined ? value / (1 + change / 100) : value
      now += value
      before += was
      const chainFamily = (networks.data ?? []).find((network) => network.id === balance.networkId)?.family
      if (chainFamily) {
        let bucket = family[chainFamily]
        if (!bucket) {
          bucket = { now: 0, before: 0 }
          family[chainFamily] = bucket
        }
        bucket.now += value
        bucket.before += was
      }
    }
    return { now, before, family, unpriced: unpricedCount }
  }, [balances.balances, networks.data, usdIndex, changeIndex])

  const totalUsd = valuation.now
  const unpriced = valuation.unpriced

  /**
   * The rows the balances card renders: one per holding per place it sits,
   * biggest first, each carrying its share of the wallet and its rank on that
   * ladder.
   *
   * Sorting matters more than it looks: the backend returns balances grouped
   * by account, so the list arrived in creation order — $289 of ETH sat above
   * $1,267 of SOL for no reason a reader could see. Anything the feed
   * couldn't price sinks to the bottom rather than claiming a position it
   * can't justify.
   *
   * There used to be a second, collapsed-by-symbol version of this list that
   * Simple mode showed instead. It went with the switch (see the note on the
   * component): the per-place list is the one the send flow works from, so it
   * is the one the wallet shows at rest, and the place name under each symbol
   * is what keeps two USDC rows from reading as the same money twice.
   */
  const displayRows = useMemo(() => {
    const rows = balances.balances.map((balance) => ({
      key: `${balance.accountId}:${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`,
      symbol: balance.symbol,
      // Token art wins over the network mark. A token balance (for example
      // TRUMP on Solana) is not the same thing as the chain it lives on.
      logo: balance.logo
        ?? (balance.asset.kind === "token" ? COIN_IMAGES[balance.symbol.toUpperCase()] : undefined)
        ?? NETWORK_ICON[networkMetaFor(balance.networkId, networks.data)?.key ?? ""],
      subtitle: balance.networkName,
      amount: formatCryptoAmount(balance.amountBaseUnits, balance.decimals),
      depositAsset: balance.symbol,
      value: usdValueOf(balance, usdIndex),
      share: null as number | null,
      relative: null as number | null,
      rank: 0,
    }))
    rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    const top = rows[0]?.value ?? 0
    rows.forEach((row, index) => {
      row.rank = index
      row.share = row.value !== null && totalUsd > 0 ? (row.value / totalUsd) * 100 : null
      // The BAR is scaled against the largest holding, not against the whole
      // wallet; the PERCENTAGE beside it is the true share. A well-spread
      // wallet tops out around 17%, so absolute-width bars were ten nubs of
      // near-identical length — technically honest and completely unreadable.
      // Filling the track for the biggest holding restores the one thing the
      // column is for: telling at a glance which rows are the big ones.
      row.relative = row.value !== null && top > 0 ? (row.value / top) * 100 : null
    })
    return rows
  }, [balances.balances, networks.data, usdIndex, totalUsd])

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


  // The provisioning panel now lives inside the security modal, where nobody
  // would ever find it on their own — so the Security verb wears a dot when
  // there is something in there worth opening.
  const networksToAdd = wallet.data ? missingChainFamilies(wallet.data.accounts).length : 0
  const hasIntertrainAccount = Boolean(wallet.data?.accounts.some((account) => account.chainFamily === "intertrain"))

  useEffect(() => {
    if (!wallet.data || !packageQuery.data || setupCeremony || hasIntertrainAccount) return
    if (typeof window !== "undefined" && window.sessionStorage.getItem("worldstreet:intertrain-prompt-dismissed") === "1") return
    setIntertrainPromptOpen(true)
  }, [wallet.data, packageQuery.data, setupCeremony, hasIntertrainAccount])

  const heroStats = useMemo(() => {
    const pricedNetworks = new Set(balances.balances.map((balance) => balance.networkId))
    return [
      { label: "Assets", value: balances.balances.length },
      { label: "Networks", value: pricedNetworks.size },
      { label: "Accounts", value: wallet.data?.accounts.length ?? 0 },
    ]
  }, [balances.balances, wallet.data])

  /**
   * The hero's right half: one entry per chain FAMILY, biggest first.
   *
   * Families rather than networks because one 0x… address serves every EVM
   * chain, and listing them separately asks someone to copy the same string
   * three times and guess which copy was right.
   */
  const chainGroups = useMemo<ChainGroup[]>(() => {
    const groups = (wallet.data?.accounts ?? []).map((account) => {
      const familyNetworks = networksForFamily(account.chainFamily, networks.data)
      const meta = familyNetworks.length ? networkMetaFor(familyNetworks[0].id, networks.data) : null
      const networkIds = new Set(familyNetworks.map((network) => network.id))
      const holdings: ChainHolding[] = balances.balances
        .filter((balance) => balance.accountId === account.id && networkIds.has(balance.networkId))
        .map((balance) => ({
          key: `${balance.networkId}:${balance.asset.kind}:${balance.asset.identifier}`,
          symbol: balance.symbol,
          logo:
            balance.logo
            ?? (balance.asset.kind === "token" ? COIN_IMAGES[balance.symbol.toUpperCase()] : undefined)
            ?? NETWORK_ICON[networkMetaFor(balance.networkId, networks.data)?.key ?? ""],
          amount: formatCryptoAmount(balance.amountBaseUnits, balance.decimals),
          value: usdValueOf(balance, usdIndex),
        }))
      // Same rule as the balances list: anything the feed could not price
      // sinks rather than claiming a rank it cannot justify.
      holdings.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      return {
        key: account.chainFamily,
        name: FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase(),
        caption: familyNetworks.map((network) => network.name).join(" · ") || account.state,
        symbol: meta?.nativeSymbol ?? account.chainFamily,
        icon: meta ? NETWORK_ICON[meta.key] : undefined,
        value: valuation.family[account.chainFamily]?.now,
        address: account.canonicalAddress,
        holdings,
      }
    })
    groups.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    return groups
  }, [wallet.data, networks.data, balances.balances, usdIndex, valuation])

  /* The book priced in BTC as well as in dollars — the unit a trading
     platform's performance is judged in. Null when the feed has no BTC price:
     dividing by a missing number is how a wallet claims to hold 0.00000 BTC. */
  const btcPrice = usdIndex?.BTC ?? usdIndex?.btc ?? 0
  const btcEquivalent = btcPrice > 0 && totalUsd > 0 ? totalUsd / btcPrice : null

  /* The 24h move in dollars, from the same before/after pass the percentage
     comes from, so the two can never disagree. */
  const dayPnl = valuation.before > 0 ? valuation.now - valuation.before : null
  /** The wallet's own 24h move, or undefined when there is none to report —
   *  "+0.00%" on a cold feed claims knowledge nobody handed us. */
  const dayPct = (() => {
    if (valuation.before <= 0) return undefined
    const pct = ((valuation.now - valuation.before) / valuation.before) * 100
    return Number.isFinite(pct) && Math.abs(pct) >= 0.005 ? pct : undefined
  })()

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
  /* Whether the ceremony owns this page is not yet knowable while either of
     the queries behind it is in flight: the wallet lookup decides whether
     there is one to make, and the package lookup is what reveals an
     interrupted setup. `setupCeremony` reads false during both — not because
     the ceremony is staying away, but because it has not been asked yet.
     The welcome guide waits on this rather than on `setupCeremony` alone.
     Without it the guide opened into the gap and the ceremony landed on top
     of it a moment later, which is the stack it is written to avoid. */
  const ceremonyUndecided = walletLoading || packageQuery.isLoading
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

  /* The Simple/Pro switch used to lead this row. It is gone from the wallet
     (see the note on the component) and lives on swap and trade now. The help
     button is what stops the welcome guide being a thing that happens to you
     once and can never be consulted again — the reason people ask support
     instead. */
  const headerActions = (
    <>
      <IconAction
        icon={({ className }: { className?: string }) => (
          <HugeiconsIcon icon={HelpCircleIcon} className={className} />
        )}
        label="How this wallet works"
        onClick={() => setHelpSignal((value) => value + 1)}
      />
      <span className="hidden sm:inline-flex">
        <ModeBadge mode="modern" />
      </span>
    </>
  )

  return (
    <div className={PAGE}>
      <Rise>
        <PageHeader title="Wallet" subtitle={SUBTITLE} actions={headerActions} />
      </Rise>

      {/* Shown once per person, app-wide — the dashboard mounts the same
          guide, so most people meet it before they ever reach this page
          and this instance stays silent. It is here for the header help
          button, and because the ceremony is the one thing that has to
          hold it back: two modals at once is what `ceremonyVisible`
          guards. */}
      <WelcomeGuide
        ceremonyVisible={setupCeremony || ceremonyUndecided}
        openSignal={helpSignal}
      />

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
          BECAUSE the wallet exists.
          (3) IT RENDERS A MODAL, not a card in this position — the position
          still matters for (1), but nothing appears here in the page flow
          except the invitation shown once the flow has been dismissed. */}
      <WalletSetupFlow
        walletExists={hasWallet || walletLoading}
        resume={setupIncomplete}
        onVisibilityChange={setSetupCeremony}
      />

      {wallet.error && !wallet.needsSetup ? (
        <Rise delay={40}>
          <SectionMessage error={wallet.error} onAction={onWalletErrorAction} />
        </Rise>
      ) : null}

      {/* The ceremony is a modal over this page now, not a card that replaces
          it, so the page keeps its body and is read through the backdrop's
          blur. Before a wallet exists there is no body to read, so it holds
          the outline of the one being made instead of going blank. */}
      {!hasWallet && !walletLoading && setupCeremony ? (
        <Rise delay={40}>
          <WalletSkeleton />
        </Rise>
      ) : null}

      {hasWallet || walletLoading ? (
        <>
          {/* ── The hero card + the wallet pocket. The pocket holds every
                 card; clicking one deals it onto the hero, which re-skins to
                 that chain's hue, value, and address. ── */}
          {/* ── The hero: one figure on the left, one chain on the right ──
                 This replaced a deck of credit-card tiles. The deck looked
                 good and answered almost nothing — you could not read the
                 balances behind the top card, and the address needed a press
                 to reveal. A wallet is asked two questions, "how much have I
                 got" and "where do I send it", so the left half answers the
                 first in as few elements as it can and the whole right half
                 goes to the second. */}
          <Rise delay={40}>
            <CardShell className={HERO_HUE}>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                {/* ── Left: the figure ──────────────────────────────────── */}
                <div className="flex flex-col justify-center gap-6 p-6 lg:p-8">
                  <div className="flex items-center gap-2">
                    <Eyebrow>Estimated total value</Eyebrow>
                    <button
                      type="button"
                      onClick={toggleHidden}
                      aria-label={hidden ? "Show balances" : "Hide balances"}
                      title={hidden ? "Show balances" : "Hide balances"}
                      className={`ws-icon-mono inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${hidden ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : EyeIcon} className="h-[15px] w-[15px]" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {heroLoading ? (
                      <Skel className="my-1.5 h-[clamp(2.75rem,5vw,4.25rem)] w-[min(18rem,80%)] rounded-lg" />
                    ) : (
                      <Balance
                        value={usd(totalUsd)}
                        hidden={hidden}
                        className="text-[clamp(2.75rem,5vw,4.25rem)]"
                      />
                    )}
                    <span className="flex flex-wrap items-center gap-2">
                      {/* Each of these renders only when there is something
                          to say. A wallet that cannot price itself in BTC, or
                          has no yesterday to compare against, says nothing
                          rather than printing a zero that reads as a fact. */}
                      {btcEquivalent !== null && (
                        <>
                          <span className="text-[15px] font-medium tabular-nums text-muted-foreground">
                            ≈ {hidden ? AMOUNT_MASK : `${btcEquivalent.toFixed(5)} BTC`}
                          </span>
                          {(dayPct !== undefined || dayPnl !== null) && (
                            <span aria-hidden className="h-3.5 w-px bg-border" />
                          )}
                        </>
                      )}
                      {dayPct !== undefined && <DeltaChip value={dayPct} />}
                      {dayPnl !== null && (
                        <span
                          className={`text-[14px] font-semibold tabular-nums ${dayPnl >= 0 ? "text-credit" : "text-debit"}`}
                        >
                          {hidden ? AMOUNT_MASK : `${dayPnl >= 0 ? "+" : "−"}${usd(Math.abs(dayPnl))}`}
                        </span>
                      )}
                      {(dayPct !== undefined || dayPnl !== null) && (
                        <span className="text-[14px] text-muted-foreground">24h</span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                      {asOf ?? (heroLoading ? "Syncing…" : "Not synced yet")}
                      {unpriced > 0 ? " · Some assets have no live price" : ""}
                      {refreshAction}
                    </span>
                  </div>
                </div>

                {/* ── Right: pick a chain, see that chain ────────────────── */}
                <div className="flex min-w-0 flex-col border-t border-border/40 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
                    <Eyebrow>Balances by chain</Eyebrow>
                    <span className="text-[11.5px] text-muted-foreground">
                      Pick a chain to see its address
                    </span>
                  </div>
                  <ChainPicker
                    groups={chainGroups}
                    usd={usd}
                    mask={(value: string) => (hidden ? AMOUNT_MASK : value)}
                    onReceive={() => openReceive()}
                  />
                </div>
              </div>
            </CardShell>
          </Rise>

          {/* The verbs, in the round grammar every wallet trains — gold on
              the one primary verb only. */}
          {/* On a phone these two rows are the wallet's entire control surface,
              so each spans the full width and shares it out rather than
              huddling at one end. From sm up they sit on one line, actions
              left and counters right, which is what the desktop width wants. */}
          <Rise delay={80} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
            <div className="flex w-full justify-between sm:w-auto sm:justify-start sm:gap-5">
              <RoundAction icon={DepositGlyph} label="Deposit" primary onClick={() => openReceive()} />
              <RoundAction icon={SendGlyph} label="Send" onClick={() => setSendOpen(true)} />
              <RoundAction icon={TradeGlyph} label="Trade" href="/trade" />
              <RoundAction
                icon={SecurityGlyph}
                label="Security"
                onClick={() => { setSecurityInitialView("menu"); setSecurityOpen(true) }}
                dot={networksToAdd > 0}
              />
            </div>
            <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:gap-5">
              {/* ASSETS · NETWORKS · ACCOUNTS — the shape of the wallet in
                  three figures, for everybody. */}
              <div className="flex flex-1 items-center divide-x divide-border/40 sm:flex-none">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-1 flex-col items-center gap-1 px-2 first:pl-0 last:pr-0 sm:flex-none sm:items-end sm:px-5"
                  >
                    {/* The caption stays small on purpose. "ACCOUNTS" beside
                        "NETWORKS" beside "ASSETS" plus the Locked pill is
                        already most of a 390px row; the figure is the part
                        worth enlarging, and it is the part that grew. */}
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                      {stat.label}
                    </span>
                    <span className="text-[17px] font-semibold tabular-nums sm:text-[13.5px]">
                      {heroLoading ? "––" : stat.value}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-sunken px-4 text-[13px] font-semibold sm:min-h-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-2.5 sm:py-1 sm:text-xs"
              >
                Locked
              </button>
            </div>
          </Rise>

          {/* Section rules, the same grammar the dashboard grid uses: a label
              and a hairline to the end of the row. Cheap, and it does what
              another card title could not — it groups. */}
          <Rise delay={140}>
            <SectionRule label="Balances" note="Everything you hold, priced" />
          </Rise>

          <Rise delay={160}>
            <CardShell className={CARD_HUE}>
              <CardHeader
                title="Balances"
                subtitle={
                  displayRows.length === 0
                    ? undefined
                    : `${balances.balances.length} assets across ${new Set(balances.balances.map((b) => b.networkId)).size} networks`
                }
                right={refreshAction}
              />
              {/* Portfolio allocation — the same rank ladder the rows below
                  use. Hidden with the figures it would reveal. */}
              {!hidden && allocation.length > 0 && totalUsd > 0 ? (
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
                    {allocation.map((segment, index) => (
                      <span
                        key={segment.label}
                        className="h-full"
                        style={{
                          width: `${Math.max(1.5, (segment.value / totalUsd) * 100)}%`,
                          background: allocationColor(index),
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {allocation.map((segment, index) => (
                      <span key={segment.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: allocationColor(index) }} />
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
                  {/* Column labels. The list carries four facts per row on a
                      wide card; without a header they're four unlabelled
                      numbers and the reader has to infer which is which. */}
                  <div className="flex items-center gap-3 px-4 pb-1.5 pt-0.5">
                    <span className="w-9 shrink-0" />
                    <span className="min-w-0 flex-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                      Asset
                    </span>
                    <span className="hidden w-[150px] shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 lg:block">
                      Share of wallet
                    </span>
                    <span className="hidden w-[112px] shrink-0 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 sm:block">
                      Amount
                    </span>
                    <span className="w-[104px] shrink-0 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                      Value
                    </span>
                    <span className="w-8 shrink-0" />
                  </div>
                  {displayRows.map(({ key, symbol, logo, subtitle, amount, value, depositAsset, share, relative, rank }) => {
                    const change = changeIndex?.[(symbol ?? "").toUpperCase()]
                    return (
                      <div
                        key={key}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                      >
                        <CoinAvatar symbol={symbol} src={logo} size="lg" className="h-9 w-9 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14px] font-semibold">{symbol}</span>
                          {subtitle ? (
                            <span className="truncate text-[12.5px] text-muted-foreground">{subtitle}</span>
                          ) : null}
                        </span>

                        {/* What this holding is OF the wallet — the fact the
                            wide card had room for and wasn't showing. Shares
                            the house rank ladder, so a row's colour matches
                            its slice on Assets and Portfolio. */}
                        <span className="hidden w-[150px] shrink-0 items-center gap-2.5 lg:flex">
                          {share !== null && relative !== null && !hidden ? (
                            <>
                              <WeightBar pct={relative} rank={rank} className="flex-1" />
                              <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                                {share >= 1 ? Math.round(share) : "<1"}%
                              </span>
                            </>
                          ) : null}
                        </span>

                        <span className="hidden w-[112px] shrink-0 text-right text-[13.5px] tabular-nums text-muted-foreground sm:block">
                          {hidden ? AMOUNT_MASK : amount}
                        </span>

                        <span className="flex w-[104px] shrink-0 flex-col items-end">
                          <span className="text-[14px] font-semibold tabular-nums">
                            {value !== null ? (hidden ? AMOUNT_MASK : usd(value)) : "—"}
                          </span>
                          <span className="flex items-center gap-1.5 text-[12px] tabular-nums">
                            {/* Amount rides under the value where there's no
                                column for it. */}
                            <span className="text-muted-foreground sm:hidden">{hidden ? AMOUNT_MASK : amount}</span>
                            {/* 24h move — a market fact, not a holding, so it
                                stays visible under privacy masking. */}
                            {change !== undefined ? (
                              <span className={change >= 0 ? "text-credit" : "text-debit"}>
                                {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                              </span>
                            ) : null}
                          </span>
                        </span>

                        {/* Deposit — credit-tinted on hover (money in), never
                            gold: that belongs to the page's one primary CTA.
                            Rests hidden on a pointer device so ten rows aren't
                            ten competing buttons; always there on touch, which
                            has no hover to reveal it. */}
                        <button
                          type="button"
                          onClick={() => openReceive(depositAsset)}
                          aria-label={`Deposit ${symbol}`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 opacity-100 transition-all hover:bg-credit-chip hover:text-credit focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <HugeiconsIcon icon={ArrowDownLeft01Icon} className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardShell>
          </Rise>

          <Rise delay={200}>
            <SectionRule label="History" note="Money in and out of this wallet" />
          </Rise>

          {/* The wallet had no history at all — "did my deposit land?" meant
              leaving the page and coming back. */}
          <Rise delay={220}>
            <Movements />
          </Rise>
        </>
      ) : null}

      <WalletUnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} />
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} asset={receiveAsset} />
      {/* Money out opens over the wallet, the way money in already does. */}
      <SendModal
        open={sendOpen}
        onOpenChange={(next) => {
          setSendOpen(next)
          // Balances go stale the moment a send lands; re-read on the way out
          // rather than leaving the hero showing the pre-send figure.
          if (!next) refreshBalances()
        }}
      />

      {/* Security lives behind the Security verb rather than as four cards
          stacked below the fold. Mounted only once the package is loaded —
          every panel inside needs it. */}
      {wallet.data && packageQuery.data ? (
        <WalletSecurityModal
          open={securityOpen}
          onOpenChange={setSecurityOpen}
          walletId={wallet.data.id}
          packageValue={packageQuery.data}
          accounts={wallet.data.accounts}
          networksToAdd={networksToAdd}
          initialView={securityInitialView}
          familiesToAdd={securityInitialView === "networks" ? ["intertrain"] : undefined}
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
            setSecurityInitialView("networks")
            setSecurityOpen(true)
          }}
          onLearnMore={() => window.open("https://intertrain.online", "_blank", "noopener,noreferrer")}
        />
      ) : null}
    </div>
  )
}
