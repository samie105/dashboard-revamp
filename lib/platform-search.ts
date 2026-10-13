import { PREVIEW_ROUTES, walletHref } from "@/components/preview/routes"
import { PAIRS } from "@/components/trade-unauth/trade-data"
import { PERPS } from "@/components/trade-unauth/futures-data"

/** The part of the product a result belongs to. Keep this user-facing: it is
 * the answer to "where will this take me?", not an implementation name. */
export type PlatformSearchLocation =
  | "Exchange"
  | "Markets"
  | "Spot"
  | "Futures"
  | "Swap"
  | "Bridge"
  | "Wallet"
  | "Fiat"
  | "Account"

export type PlatformSearchKind = "feature" | "spot-market" | "futures-market"

export type PlatformSearchItem = {
  id: string
  label: string
  detail: string
  location: PlatformSearchLocation
  href: string
  kind: PlatformSearchKind
  /** Search-only terms such as a pair id or a common feature synonym. */
  keywords: string[]
}

function tradeHref(market: "spot" | "futures", pair: string) {
  return `${PREVIEW_ROUTES.trade}?market=${market}&pair=${encodeURIComponent(pair)}`
}

const FEATURES: PlatformSearchItem[] = [
  {
    id: "feature:exchange",
    label: "Exchange overview",
    detail: "Balances, activity and quick actions",
    location: "Exchange",
    href: PREVIEW_ROUTES.dashboard,
    kind: "feature",
    keywords: ["dashboard", "home", "overview"],
  },
  {
    id: "feature:markets",
    label: "Markets",
    detail: "Prices, movers and market data",
    location: "Markets",
    href: PREVIEW_ROUTES.markets,
    kind: "feature",
    keywords: ["prices", "coins", "assets", "market"],
  },
  {
    id: "feature:spot",
    label: "Spot trading",
    detail: "Buy and sell pairs at market or limit",
    location: "Spot",
    href: tradeHref("spot", "SOL-USDT"),
    kind: "feature",
    keywords: ["trade", "spot", "exchange", "market order", "limit order"],
  },
  {
    id: "feature:futures",
    label: "Futures trading",
    detail: "Perpetual contracts and leverage",
    location: "Futures",
    href: tradeHref("futures", "BTC-PERP"),
    kind: "feature",
    keywords: ["trade", "futures", "perpetual", "perps", "leverage"],
  },
  {
    id: "feature:wallet",
    label: "Wallet overview",
    detail: "Balances across your accounts",
    location: "Wallet",
    href: PREVIEW_ROUTES.wallet,
    kind: "feature",
    keywords: ["wallet", "balance", "assets", "holdings"],
  },
  {
    id: "feature:transactions",
    label: "Transactions",
    detail: "Deposits, withdrawals, swaps and transfers",
    location: "Wallet",
    href: PREVIEW_ROUTES.transactions,
    kind: "feature",
    keywords: ["history", "activity", "ledger", "payments"],
  },
  {
    id: "feature:deposit",
    label: "Fund wallet",
    detail: "Deposit crypto or buy with fiat",
    location: "Fiat",
    href: walletHref("deposit"),
    kind: "feature",
    keywords: ["deposit", "fund", "add money", "onramp", "fiat", "cash"],
  },
  {
    id: "feature:withdraw",
    label: "Withdraw",
    detail: "Send crypto or cash out to a destination",
    location: "Wallet",
    href: walletHref("withdraw"),
    kind: "feature",
    keywords: ["withdrawal", "payout", "offramp", "cash out", "send"],
  },
  {
    id: "feature:swap",
    label: "Swap",
    detail: "Exchange one asset for another",
    location: "Swap",
    href: PREVIEW_ROUTES.swap,
    kind: "feature",
    keywords: ["convert", "exchange", "bridge"],
  },
  {
    id: "feature:bridge",
    label: "Bridge",
    detail: "Move assets across networks",
    location: "Bridge",
    href: PREVIEW_ROUTES.bridge,
    kind: "feature",
    keywords: ["cross-chain", "network", "transfer"],
  },
  {
    id: "feature:buy",
    label: "Buy crypto",
    detail: "Card, bank or Dollar Account",
    location: "Fiat",
    href: PREVIEW_ROUTES.buy,
    kind: "feature",
    keywords: ["buy", "fiat", "cash", "card", "bank"],
  },
  {
    id: "feature:sell",
    label: "Sell crypto",
    detail: "Cash out to your account or bank",
    location: "Fiat",
    href: PREVIEW_ROUTES.sell,
    kind: "feature",
    keywords: ["sell", "fiat", "cash", "payout", "bank"],
  },
  {
    id: "feature:settings",
    label: "Settings",
    detail: "Profile, security and identity verification",
    location: "Account",
    href: PREVIEW_ROUTES.settings,
    kind: "feature",
    keywords: ["account", "profile", "security", "kyc", "verification"],
  },
]

const SPOT_MARKETS: PlatformSearchItem[] = PAIRS.map((market) => ({
  id: `spot:${market.id}`,
  label: `${market.base}/${market.quote}`,
  detail: `${market.name} · ${market.chains.join(", ") || "Spot market"}`,
  location: "Spot",
  href: tradeHref("spot", market.id),
  kind: "spot-market",
  keywords: [
    market.id,
    market.base,
    market.name,
    market.quote,
    ...market.chains,
  ],
}))

const FUTURES_MARKETS: PlatformSearchItem[] = PERPS.map((market) => ({
  id: `futures:${market.id}`,
  label: `${market.base}/USDT Perp`,
  detail: `${market.name} perpetual · up to ${market.maxLeverage}×`,
  location: "Futures",
  href: tradeHref("futures", market.id),
  kind: "futures-market",
  keywords: [
    market.id,
    market.base,
    market.name,
    "perpetual",
    "perp",
    "futures",
  ],
}))

/** One index for the header search. Feature rows come first for an empty query;
 * market rows make coin, pair, and venue searches useful. */
export const PLATFORM_SEARCH_ITEMS: readonly PlatformSearchItem[] = [
  ...FEATURES,
  ...SPOT_MARKETS,
  ...FUTURES_MARKETS,
]

function normalized(value: string) {
  return value.trim().toLowerCase()
}

function scoreItem(item: PlatformSearchItem, query: string): number | null {
  const label = normalized(item.label)
  const detail = normalized(item.detail)
  const location = normalized(item.location)
  const keywords = item.keywords.map(normalized)
  const haystack = [label, detail, location, ...keywords]
  const terms = normalized(query).split(/\s+/).filter(Boolean)

  if (terms.length === 0) return 0
  if (!terms.every((term) => haystack.some((field) => field.includes(term))))
    return null

  let score = 0
  for (const term of terms) {
    if (label === term) score += 120
    else if (label.startsWith(term)) score += 100
    else if (keywords.some((keyword) => keyword === term)) score += 90
    else if (keywords.some((keyword) => keyword.startsWith(term))) score += 75
    else if (location === term) score += 70
    else score += 45
  }
  return score
}

/** Search features, spot pairs, and futures contracts with venue-aware ranking. */
export function searchPlatform(
  query: string,
  limit = 10
): PlatformSearchItem[] {
  const q = normalized(query)
  if (!q) return PLATFORM_SEARCH_ITEMS.slice(0, limit)

  return PLATFORM_SEARCH_ITEMS.map((item, index) => ({
    item,
    index,
    score: scoreItem(item, q),
  }))
    .filter(
      (
        entry
      ): entry is { item: PlatformSearchItem; index: number; score: number } =>
        entry.score !== null
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item)
}
