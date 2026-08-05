// What the user is currently looking at, for Vivid.
//
// Two halves:
//
// 1. PAGE_CONTEXT — a static description of each route: what's on screen and
//    what can be done there. Enough for "where am I?" / "what is this page?".
//
// 2. A live registry — components publish the state they're actually rendering
//    (selected pair, ticket side, open modal, hero balance) so Vivid can answer
//    "how much is showing?" or "what am I about to buy?" with real values.
//
// The session prompt is built ONCE when the voice session starts, so anything
// injected there goes stale the moment the user navigates. That's why this is
// read through a tool (getCurrentPageContext) instead — it's evaluated at the
// moment the question is asked.

export type PageInfo = {
  name: string
  /** What's rendered on this page. */
  summary: string
  /** What the user can do here — helps Vivid answer follow-ups. */
  actions?: string
}

export const PAGE_CONTEXT: Record<string, PageInfo> = {
  "/": {
    name: "Dashboard home",
    summary:
      "The signed-in crypto dashboard. A balance hero with four views — Total, Main (on-chain), Spot and Futures — a per-chain strip (Ethereum, Arbitrum, Solana, Sui, TON, Tron) with per-chain values and copyable addresses, " +
      "action pills (Deposit, Withdraw, Swap, Trade, History), a P&L / assets / networks stat row, promo cards, then My Holdings and a watchlist with market movers.",
    actions:
      "Switch balance view, copy a wallet address, open Deposit or Withdraw (modal), go to Swap/Trade/History, star coins on the watchlist.",
  },
  "/portfolio": {
    name: "Portfolio",
    summary:
      "The portfolio breakdown — total value, per-account split (on-chain, spot, futures), per-chain balances and performance.",
    actions: "Inspect balances per account and chain; jump to deposit, swap, or trade.",
  },
  "/assets": {
    name: "Assets",
    summary: "Every asset held — on-chain tokens and spot balances with quantities, USD values and quick actions.",
    actions: "Review holdings, jump into a trade or swap for a specific asset.",
  },
  "/transactions": {
    name: "Transaction history",
    summary:
      "The unified history: deposits, withdrawals, swaps, spot and futures trades, funding transfers — each with amount, status and time. Filterable by type.",
    actions: "Filter by type, inspect a transaction's status and reference.",
  },
  "/trading/markets": {
    name: "Markets",
    summary: "The full market list with live prices, 24h change and watchlist stars. Browsing only — orders are placed on the trade page.",
    actions: "Search or star a market, open one on the trade page.",
  },
  "/trade": {
    name: "Trading workspace",
    summary:
      "The full exchange screen. Left: the markets rail (searchable pair list). Center: candle chart with volume, and under it Positions / Open orders. Right: the live order book and the order ticket. " +
      "The top bar has the Spot/Futures toggle, the pair with its live price and 24h stats, Fund and Withdraw (they open as modals over the workspace), and the theme toggle. " +
      "On the Futures tab the ticket adds leverage, take profit and stop loss. On mobile the ticket opens as a bottom sheet from the Long/Short bar.",
    actions:
      "Switch Spot/Futures, pick a pair, read the book (clicking a level sets the limit price), fill the ticket (side, market/limit, amount, leverage, TP/SL), place an order, close a position, cancel an order, fund or withdraw the trading account.",
  },
  "/swap": {
    name: "Swap",
    summary: "Swap one token for another across chains — pick from/to tokens, enter an amount, review the rate, execute.",
    actions: "Choose tokens and chains, enter an amount, execute the swap.",
  },
  "/buy": {
    name: "Deposit USDT",
    summary:
      "The deposit flow as a full page: Buy with cash (pay from the Dollar Account, pick a network, USDT lands in the wallet) or Receive (QR + copyable address per network).",
    actions: "Enter an amount, pick a network, buy; or show the receive address and QR.",
  },
  "/sell": {
    name: "Withdraw USDT",
    summary: "The withdrawal flow as a full page — sell USDT from the wallet, dollars land in the Dollar Account.",
    actions: "Enter an amount, pick the network, withdraw.",
  },
  "/fund": {
    name: "Fund trading account",
    summary: "Move USDC from the Dollar Account into the Hyperliquid trading account, into Spot or Futures.",
    actions: "Pick Spot or Futures, enter an amount, start the transfer, watch the staged progress.",
  },
  "/trading-withdraw": {
    name: "Withdraw trading balance",
    summary: "Move USDC from the Hyperliquid trading account back to the Dollar Account.",
    actions: "Pick the source balance, enter an amount, request the withdrawal.",
  },
  "/auto-trade": {
    name: "Auto trade",
    summary: "Automated trading strategies.",
  },
  "/vivid": {
    name: "Vivid AI chat",
    summary:
      "The full Vivid text-chat page. A sidebar of saved conversations on the left, the active conversation in the middle, and a custom-instructions option for the open conversation.",
    actions: "Start a new chat, rename or delete a conversation, set custom instructions.",
  },
  "/login": { name: "Sign in", summary: "The sign-in screen." },
  "/register": { name: "Sign up", summary: "The account creation screen." },
}

export function getPageInfo(pathname: string): PageInfo {
  if (PAGE_CONTEXT[pathname]) return PAGE_CONTEXT[pathname]

  // Longest matching prefix, so nested routes inherit their parent's description.
  const prefix = Object.keys(PAGE_CONTEXT)
    .filter((route) => route !== "/" && pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)[0]

  if (prefix) return PAGE_CONTEXT[prefix]

  return { name: "WorldStreet dashboard", summary: `The page at ${pathname}.` }
}

// ── Live state registry ─────────────────────────────────────────────────────
// Components register a getter; the tool reads them all when asked. Getters are
// called at read time so the values are always current — never cached.

type Snapshot = Record<string, unknown>

const liveSources = new Map<string, () => Snapshot | null>()

export function registerVividContext(key: string, getter: () => Snapshot | null): () => void {
  liveSources.set(key, getter)
  return () => {
    // Only remove if this exact getter is still registered — guards against a
    // remount registering before the old instance's cleanup runs.
    if (liveSources.get(key) === getter) liveSources.delete(key)
  }
}

export function readLiveContext(): Snapshot {
  const out: Snapshot = {}
  for (const [key, getter] of liveSources) {
    try {
      const value = getter()
      if (value && Object.keys(value).length > 0) out[key] = value
    } catch {
      // A broken publisher shouldn't take down the whole context read.
    }
  }
  return out
}
