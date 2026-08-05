// Every place Vivid can take the user, in one list.
//
// THIS app is the crypto dashboard (dashboard.worldstreetgold.com, and the
// vivid-enabled instance at dashboardvivid.worldstreetgold.com). The welcome
// hub, community and the other WorldStreet platforms live on the hub app at
// worldstreetgold.com — those destinations carry absolute URLs and load a
// different site, which is expected.
//
// Navigation is an enum over these ids (not a free-form path) so the model can
// never invent a route that doesn't exist here.

const HUB = "https://www.worldstreetgold.com"

export type Destination = {
  /** Stable id — this is what the model picks. */
  id: string
  /** Human name, used in the tool description. */
  label: string
  /** Same-origin path, or an absolute URL for another WorldStreet app. */
  url: string
  /** Absolute URLs need a full page load, not a Next router push. */
  external: boolean
  /** Shown to the model so it can match intent to destination. */
  description: string
}

export const DESTINATIONS: Destination[] = [
  // ── This app (the crypto dashboard) ───────────────────────────────────────
  {
    id: "dashboard",
    label: "Dashboard home",
    url: "/",
    external: false,
    description:
      "The main dashboard — total balance hero with Total/Main/Spot/Futures views, per-chain wallet strip, Deposit/Withdraw/Swap/Trade/History actions, holdings, watchlist and market movers. The default 'home'.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    url: "/portfolio",
    external: false,
    description: "Portfolio breakdown — balances by account and chain, allocation, and performance.",
  },
  {
    id: "assets",
    label: "Assets",
    url: "/assets",
    external: false,
    description: "Every asset the user holds — on-chain tokens and spot balances, with values and actions.",
  },
  {
    id: "transactions",
    label: "Transaction history",
    url: "/transactions",
    external: false,
    description: "The unified history — deposits, withdrawals, swaps, trades, funding transfers, with statuses.",
  },
  {
    id: "markets",
    label: "Markets",
    url: "/trading/markets",
    external: false,
    description: "The full market list with prices, 24h change and watchlist stars — browsing, not order entry.",
  },
  {
    id: "trade_spot",
    label: "Spot trading",
    url: "/trade?market=spot",
    external: false,
    description:
      "The exchange workspace on the SPOT tab — chart, order book, markets rail and the buy/sell ticket. Go here to actually place a spot order.",
  },
  {
    id: "trade_futures",
    label: "Futures trading",
    url: "/trade?market=futures",
    external: false,
    description:
      "The exchange workspace on the FUTURES tab — leverage up to the contract max, TP/SL, positions with liquidation and margin. Go here to long or short.",
  },
  {
    id: "swap",
    label: "Swap",
    url: "/swap",
    external: false,
    description: "Swap one token for another across chains at live rates.",
  },
  {
    id: "auto_trade",
    label: "Auto trade",
    url: "/auto-trade",
    external: false,
    description: "Automated trading strategies.",
  },
  {
    id: "vivid_chat",
    label: "Vivid AI chat",
    url: "/vivid",
    external: false,
    description: "The full Vivid text-chat page with saved conversations.",
  },

  // ── Hub app (separate site) ───────────────────────────────────────────────
  {
    id: "hub",
    label: "Welcome hub",
    url: `${HUB}/welcome`,
    external: true,
    description:
      "The WorldStreet hub on the main site — NGN/USD cash balances, conversions, and the grid of all platforms. Cash (naira/dollar) actions live THERE, not on this dashboard.",
  },
  {
    id: "community",
    label: "Community",
    url: `${HUB}/community`,
    external: true,
    description: "Direct messages and voice/video calls with other traders, on the main site.",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    url: `${HUB}/leaderboard`,
    external: true,
    description: "The weekly trading competition on the main site.",
  },
]

export const DESTINATION_IDS = DESTINATIONS.map((d) => d.id)

export function findDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id)
}

export function describeDestinations(): string {
  return (
    "Destinations:\n" +
    DESTINATIONS.map((d) => `- ${d.id}: ${d.label} — ${d.description}`).join("\n")
  )
}

// ── Panels — things that open ON TOP of the app, not as their own page ──────
//
// The four money doors all render in the money-flow modal (desktop) / bottom
// drawer (mobile). The MoneyFlowProvider listens for vivid:open-panel and flips
// `handled` synchronously; since it is mounted on every route, no navigation
// fallback is normally needed — but the replay path still works if that ever
// changes.

export type Panel = {
  id: string
  label: string
  /** Route whose mount handles the panel, for the stash-and-navigate fallback. */
  route: string
  description: string
}

export const PANELS: Panel[] = [
  {
    id: "deposit",
    label: "Deposit USDT",
    route: "/",
    description:
      "Buy USDT with the Dollar Account, or show the wallet address + QR to receive crypto from outside. 'Add money', 'deposit', 'receive crypto'.",
  },
  {
    id: "withdraw",
    label: "Withdraw USDT",
    route: "/",
    description: "Send USDT out — sell to the Dollar Account. 'Withdraw my crypto', 'cash out'.",
  },
  {
    id: "fund_trading",
    label: "Fund trading account",
    route: "/trade",
    description:
      "Move USDC from the Dollar Account into the Hyperliquid trading account (Spot or Futures). Needed before placing trades if the trading balance is empty.",
  },
  {
    id: "withdraw_trading",
    label: "Withdraw trading balance",
    route: "/trade",
    description: "Move USDC out of the Hyperliquid trading account back to the Dollar Account.",
  },
]

export const PANEL_IDS = PANELS.map((p) => p.id)

export function findPanel(id: string): Panel | undefined {
  return PANELS.find((p) => p.id === id)
}

export function describePanels(): string {
  return "Panels:\n" + PANELS.map((p) => `- ${p.id}: ${p.label} — ${p.description}`).join("\n")
}
