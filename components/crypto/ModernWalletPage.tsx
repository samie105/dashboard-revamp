"use client"

import { useMemo, useState, type ComponentType, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, ChartLineData01Icon, EyeIcon, RefreshIcon, Shield01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { ModeBadge, SectionMessage } from "@/components/crypto/primitives"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { WalletSetupFlow } from "@/components/crypto/WalletSetupFlow"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { WalletSecurityModal } from "@/components/crypto/WalletSecurityModal"
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
import { missingChainFamilies } from "./WalletChainProvisioningPanel"

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
  const inner = (
    <>
      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:brightness-110 motion-reduce:group-hover:translate-y-0 ${circle}`}
      >
        <Icon className="h-5 w-5" />
        {dot ? (
          <span
            aria-hidden
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
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

/** Formats an address like an embossed card number. */
function groupedAddress(address?: string) {
  return address ? `${address.slice(0, 6)}  ••••  ••••  ${address.slice(-6)}` : "••••  ••••  ••••  ••••"
}

/** The gold chip — pure brand furniture on the card objects. */
function CardChip() {
  return (
    <span
      aria-hidden
      className="grid h-6 w-8 grid-cols-2 gap-px overflow-hidden rounded-[5px] bg-gradient-to-br from-yellow-200/70 via-yellow-500/60 to-yellow-800/60 p-[3px]"
    >
      <span className="rounded-[1px] bg-black/25" />
      <span className="rounded-[1px] bg-black/10" />
      <span className="rounded-[1px] bg-black/10" />
      <span className="rounded-[1px] bg-black/25" />
    </span>
  )
}

/** Everything one card in the wallet needs to render — the WorldStreet
 *  total card and each chain card share this shape. */
type WalletCardData = {
  key: string
  label: string
  /** undefined = nothing priced yet; render an em dash, never $0.00. */
  value?: number
  /** 24h move for what this card holds. undefined = the feed didn't say. */
  change?: number
  address?: string
  /** Network brand hue for chain cards; absent = the gold WorldStreet card. */
  hue?: string
  symbol?: string
  networksLabel?: string
}

/**
 * The wallet pocket — cards tucked into a pouch with their top edges showing.
 * Hover peeks a card out; click deals it onto the hero. The pouch front is
 * the WorldStreet card's own face, and the way back to the total view.
 *
 * What makes this read as a POCKET rather than a list of coloured rows:
 *
 *  · each card is a real card — 92px of card, of which only the top 40px is
 *    ever visible, so what you see is a card DISAPPEARING into something
 *    rather than a 40px-tall strip that happens to be rounded;
 *  · the stack funnels: cards behind are inset a few px each, the way a fan
 *    of cards narrows toward the back of a pocket;
 *  · every card casts a shadow UPWARD onto the one behind it, and the pouch
 *    casts the deepest one of all — that gradient at the pouch mouth is what
 *    sells "these go inside";
 *  · the pouch has a lit lip, dashed stitching, and a gold hairline. Leather
 *    with a brand stamp, not another rounded rectangle.
 */
function WalletPocket({
  cards,
  selected,
  onSelect,
  hidden,
  totalUsd,
  loading,
}: {
  cards: WalletCardData[]
  selected: string
  onSelect: (key: string) => void
  hidden: boolean
  totalUsd: number
  loading: boolean
}) {
  const chainCards = cards.filter((card) => card.key !== "worldstreet")
  const depth = chainCards.length
  const totalActive = selected === "worldstreet"
  return (
    <div className="flex w-[292px] shrink-0 flex-col justify-end">
      <div className="flex flex-col">
        {chainCards.map((card, index) => {
          const active = selected === card.key
          const hue = card.hue ?? "#57534E"
          // Cards further back sit narrower, so the stack tapers into the
          // pouch instead of stacking like table rows.
          const inset = (depth - 1 - index) * 5
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelect(card.key)}
              aria-pressed={active}
              aria-label={`Show ${card.label}`}
              style={{
                zIndex: index + 1,
                marginLeft: inset,
                marginRight: inset,
                // Each card deals in a beat after the one behind it, and
                // leans a different way on the way down.
                animationDelay: `${140 + index * 70}ms`,
                ["--deal-tilt" as string]: index % 2 ? "2.5deg" : "-2.5deg",
              }}
              // flex-col + justify-start is load-bearing, not decoration: a
              // bare <button> centres its content box vertically, which put
              // every card's name in the middle of its 92px body — i.e. down
              // on the NEXT card's visible strip — and let the value spill
              // past the card's right edge.
              className={`ws-card-deal group/card relative -mb-[52px] flex h-[92px] flex-col items-stretch justify-start rounded-[13px] px-3.5 pt-3 text-left shadow-[0_-9px_20px_-6px_rgb(0_0_0/0.75)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.985] motion-reduce:transition-none ${
                active ? "-translate-y-2.5" : "hover:-translate-y-2.5 motion-reduce:hover:translate-y-0"
              }`}
            >
              {/* The printed face: the chain's colour burning brightest at the
                  corner that catches light, falling to card stock. */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-[13px]"
                style={{ background: `linear-gradient(118deg, ${hue}A6 0%, ${hue}47 30%, #1A1614 66%, #100E0C 100%)` }}
              />
              {/* The cut edge catching the light. */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px rounded-t-[13px] bg-gradient-to-r from-transparent via-white/40 to-transparent"
              />
              <span
                aria-hidden
                className={`absolute inset-0 rounded-[13px] ring-1 ring-inset transition-colors ${
                  active ? "ring-white/40" : "ring-white/[0.12] group-hover/card:ring-white/25"
                }`}
              />
              {/* You-are-here, in the same gold tick the sidebar rail uses. */}
              {active ? (
                <span aria-hidden className="absolute left-0 top-3 h-4 w-[3px] rounded-r-full bg-primary" />
              ) : null}
              <span className="relative flex w-full items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {card.symbol ? <CoinAvatar symbol={card.symbol} size="sm" className="h-[18px] w-[18px] shrink-0" /> : null}
                  <span className={`truncate text-[12px] font-semibold tracking-[0.01em] transition-colors ${active ? "text-white" : "text-white/85"}`}>
                    {card.label}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/65">
                  {card.value !== undefined ? (hidden ? AMOUNT_MASK : usd(card.value)) : "—"}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* The pouch front. Its upward shadow is the pocket's mouth — the dark
          the cards vanish into. */}
      <button
        type="button"
        onClick={() => onSelect("worldstreet")}
        aria-pressed={totalActive}
        aria-label="Show your total balance"
        style={{ animationDelay: `${140 + depth * 70}ms`, ["--deal-tilt" as string]: "0deg" }}
        className="ws-card-deal relative z-20 h-[116px] overflow-hidden rounded-[18px] text-left shadow-[0_-16px_28px_-8px_rgb(0_0_0/0.85),0_20px_38px_-14px_rgb(0_0_0/0.7)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(168deg,#3A3532_0%,#241F1C_44%,#14110F_100%)]" />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 100% at 100% 0%, rgba(234,179,8,0.15) 0%, transparent 62%)" }}
        />
        {/* The lip: a lit top edge over a short fall of light. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <span aria-hidden className="absolute inset-x-0 top-0 h-7 bg-[linear-gradient(180deg,rgb(255_255_255/0.08),transparent)]" />
        {/* Stitching. */}
        <span aria-hidden className="absolute inset-[7px] rounded-[12px] border border-dashed border-white/[0.11]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px] p-px" style={GOLD_STROKE} />
        <span className="relative flex h-full flex-col items-center justify-center gap-0.5 px-4">
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/worldstreet-logo/WorldStreet1.png" alt="" className="h-4 w-4 opacity-90" />
            <span className="text-[11px] font-semibold tracking-[0.02em] text-white/80">WorldStreet</span>
          </span>
          <span className="text-[23px] font-semibold tabular-nums leading-tight text-white">
            {loading ? "––" : hidden ? AMOUNT_MASK : usd(totalUsd)}
          </span>
          <span className={`text-[9.5px] font-semibold uppercase tracking-[0.14em] transition-colors ${totalActive ? "text-primary/90" : "text-white/40"}`}>
            Total balance
          </span>
        </span>
      </button>
    </div>
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
  // To the minute. Seconds on a snapshot that refreshes on a timer is
  // precision the number doesn't have.
  return `As of ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
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
  const [securityOpen, setSecurityOpen] = useState(false)
  // True while the setup ceremony owns the page. Creation flips `hasWallet`
  // true the instant it succeeds, so without this the finished wallet would
  // render BEHIND the flow's "Your wallet is ready" card and its "Open your
  // wallet" button would point at a wallet that was already on screen.
  const [setupCeremony, setSetupCeremony] = useState(false)
  // The hero card's press-to-copy flash for the primary address.
  const [cardCopied, setCardCopied] = useState(false)
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

  // Which card is dealt onto the hero — the WorldStreet total by default,
  // or the chain card picked from the pocket.
  const [selectedCard, setSelectedCard] = useState("worldstreet")
  const walletCards = useMemo<WalletCardData[]>(() => {
    /** A move, or null when there isn't one to report. "+0.00%" on a cold
     *  feed claims knowledge nobody handed us. */
    const moveOf = (bucket?: { now: number; before: number }) => {
      if (!bucket || bucket.before <= 0) return undefined
      const pct = ((bucket.now - bucket.before) / bucket.before) * 100
      return Number.isFinite(pct) && Math.abs(pct) >= 0.005 ? pct : undefined
    }
    const chainCards = (wallet.data?.accounts ?? []).map((account) => {
      const familyNetworks = networksForFamily(account.chainFamily, networks.data)
      const meta = familyNetworks.length ? networkMetaFor(familyNetworks[0].id, networks.data) : null
      return {
        key: account.chainFamily,
        label: FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase(),
        value: valuation.family[account.chainFamily]?.now,
        change: moveOf(valuation.family[account.chainFamily]),
        address: account.canonicalAddress,
        hue: meta?.hue,
        symbol: meta?.nativeSymbol ?? account.chainFamily,
        networksLabel: familyNetworks.map((network) => network.name).join(" · ") || account.state,
      }
    })
    return [
      {
        key: "worldstreet",
        label: "WorldStreet",
        value: totalUsd,
        change: moveOf(valuation),
        address: primaryAccount?.canonicalAddress,
      },
      ...chainCards,
    ]
  }, [wallet.data, networks.data, valuation, totalUsd, primaryAccount])
  const activeCard = walletCards.find((card) => card.key === selectedCard) ?? walletCards[0]
  const isTotalCard = activeCard.key === "worldstreet"
  const selectCard = (key: string) => {
    setSelectedCard(key)
    setCardCopied(false)
  }

  // The provisioning panel now lives inside the security modal, where nobody
  // would ever find it on their own — so the Security verb wears a dot when
  // there is something in there worth opening.
  const networksToAdd = wallet.data ? missingChainFamilies(wallet.data.accounts).length : 0

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

      {/* The wallet body waits for the ceremony to hand the page over — one
          screen at a time, so "Open your wallet" always opens something. */}
      {(hasWallet || walletLoading) && !setupCeremony ? (
        <>
          {/* ── The hero card + the wallet pocket. The pocket holds every
                 card; clicking one deals it onto the hero, which re-skins to
                 that chain's hue, value, and address. ── */}
          <Rise delay={40} className="flex flex-wrap items-stretch gap-6">
            <section className="relative w-full max-w-[560px] flex-1 basis-[340px] overflow-hidden rounded-[20px] shadow-[0_28px_64px_-28px_rgb(0_0_0/0.65)]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#2E2A27_0%,#1C1917_48%,#100E0D_100%)]" />
              {/* Every card's tint is mounted at once and crossfaded by
                  opacity. Swapping one inline `background` would cut hard —
                  background-image can't transition — and a card changing its
                  colour with a jump-cut looks like a bug, not a deal. */}
              {walletCards.map((card) => (
                <div
                  key={card.key}
                  aria-hidden
                  className="absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none"
                  style={{
                    opacity: card.key === activeCard.key ? 1 : 0,
                    background:
                      card.key === "worldstreet"
                        ? "radial-gradient(120% 90% at 100% 0%, rgba(234,179,8,0.16) 0%, rgba(234,179,8,0.045) 45%, transparent 68%)"
                        : `radial-gradient(120% 90% at 100% 0%, ${card.hue ?? "#57534E"}4D 0%, ${card.hue ?? "#57534E"}16 45%, transparent 68%)`,
                  }}
                />
              ))}
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-primary/[0.05] blur-3xl" />
              {/* Card stock: fine engraved diagonals, barely there. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(115deg,transparent_0_9px,rgb(255_255_255/0.65)_9px_10px)]"
              />
              {/* Both rings live at once and crossfade with the tint: gold is
                  the brand card's, a plain white hairline is every other. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-[20px] p-px transition-opacity duration-500 motion-reduce:transition-none ${isTotalCard ? "opacity-90" : "opacity-0"}`}
                style={GOLD_STROKE}
              />
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-white/15 transition-opacity duration-500 motion-reduce:transition-none ${isTotalCard ? "opacity-0" : "opacity-100"}`}
              />
              {/* Light travelling the laminate, replayed on every deal. */}
              <span
                key={`sheen-${activeCard.key}`}
                aria-hidden
                className="ws-card-sheen pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]"
              />

              {/* Keyed so dealing a new card replays the settle. */}
              <div key={activeCard.key} className="ws-card-face-in relative flex h-full flex-col justify-between gap-5 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {isTotalCard ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/worldstreet-logo/WorldStreet1.png" alt="" className="h-6 w-6 opacity-90" />
                        <span className="text-[13px] font-semibold tracking-[0.02em] text-white/90">WorldStreet</span>
                      </>
                    ) : (
                      <>
                        <CoinAvatar symbol={activeCard.symbol ?? ""} size="lg" className="h-6 w-6 shrink-0" />
                        <span className="truncate text-[13px] font-semibold tracking-[0.02em] text-white/90">{activeCard.label}</span>
                      </>
                    )}
                  </div>
                  <CardChip />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <Eyebrow className="text-white/45">{isTotalCard ? "Est. Total Value" : `${activeCard.label} balance`}</Eyebrow>
                    <button
                      type="button"
                      onClick={toggleHidden}
                      aria-label={hidden ? "Show balances" : "Hide balances"}
                      className={`transition-colors ${hidden ? "text-primary" : "text-white/40 hover:text-white/80"}`}
                    >
                      <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                  {heroLoading ? (
                    <Skel className="my-1.5 h-[clamp(2.4rem,5vw,3.4rem)] w-[clamp(12rem,24vw,18rem)] rounded-lg" />
                  ) : (
                    <Balance
                      value={activeCard.value !== undefined ? usd(activeCard.value) : "—"}
                      hidden={hidden}
                      className="text-[clamp(2.4rem,5vw,3.4rem)] text-white"
                    />
                  )}
                  {/* The move comes first — it's the thing you look for after
                      the figure itself. The sync time is bookkeeping and is
                      sized like it. */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {!heroLoading && activeCard.change !== undefined ? (
                      <>
                        <DeltaChip value={activeCard.change} className="px-2 py-0.5 text-[12px]" />
                        <span className="text-[12px] font-medium text-white/40">24h</span>
                        <span aria-hidden className="text-white/20">·</span>
                      </>
                    ) : null}
                    <p className="text-[12px] text-white/40">
                      {asOf ?? (heroLoading ? "Syncing…" : "Not synced yet")}
                      {unpriced > 0 ? " · Some assets have no live price" : ""}
                    </p>
                    {refreshAction}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <button
                    type="button"
                    disabled={!activeCard.address}
                    aria-label={activeCard.address ? `Copy ${activeCard.label} address` : "Address pending"}
                    onClick={() => {
                      const address = activeCard.address
                      if (!address) return
                      navigator.clipboard?.writeText(address).then(() => {
                        setCardCopied(true)
                        setTimeout(() => setCardCopied(false), 1600)
                      }).catch(() => {})
                    }}
                    className={`font-mono text-[13px] tracking-[0.13em] transition-colors ${cardCopied ? "text-credit" : "text-white/75 hover:text-white"}`}
                  >
                    {cardCopied ? "Address copied" : groupedAddress(activeCard.address)}
                  </button>
                  <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] ${isTotalCard ? "text-primary/90" : "text-white/45"}`}>
                    {isTotalCard ? "Only yours" : activeCard.networksLabel}
                  </span>
                </div>
              </div>
            </section>

            <WalletPocket
              cards={walletCards}
              selected={activeCard.key}
              onSelect={selectCard}
              hidden={hidden}
              totalUsd={totalUsd}
              loading={heroLoading}
            />
          </Rise>

          {/* The verbs, in the round grammar every wallet trains — gold on
              the one primary verb only. */}
          <Rise delay={80} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex gap-5">
              <RoundAction icon={DepositGlyph} label="Deposit" primary onClick={() => openReceive()} />
              <RoundAction icon={SendGlyph} label="Send" href="/wallet/modern/send" />
              <RoundAction icon={TradeGlyph} label="Trade" href="/trade" />
              <RoundAction
                icon={SecurityGlyph}
                label="Security"
                onClick={() => setSecurityOpen(true)}
                dot={networksToAdd > 0}
              />
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center divide-x divide-border/40">
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
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Locked
              </button>
            </div>
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
        />
      ) : null}
    </div>
  )
}
