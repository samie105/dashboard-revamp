# WorldStreet Public Exchange — design guide

This guide defines the visual and interaction system for the unauthenticated review routes. It is based on the `public/newlook.png` reference and is intentionally closer to a professional exchange terminal than to a marketing dashboard.

The public routes are a functional design preview. They use frozen demo data, but navigation, search, tabs, filters, market selection, order-ticket states, favorites, and preview modals should feel like the eventual product.

## Product posture

WorldStreet should read as a serious multi-asset exchange:

- Dense enough for price discovery and decision-making.
- Quiet enough that price, direction, and primary actions are obvious.
- Proprietary through its information hierarchy, not through decorative effects.
- Consistent across dashboard, markets, spot trading, wallet, transfers, and earn surfaces.
- Honest about public preview state: demo data is clearly labelled and no action implies a real transaction.

## Visual language

### Palette

The canvas and panels are neutral near-black. Yellow is reserved for the WorldStreet brand mark, primary action, active navigation, and selected state.

| Role | Token / value | Usage |
| --- | --- | --- |
| Canvas | `#080A0C` | Page background and terminal work area |
| Navigation | `#0B0E10` | Left rail and utility chrome |
| Panel | `#111416` | Cards, tables, chart and history surfaces |
| Raised panel | `#15191C` | Popovers, menus, active controls |
| Recessed field | `#0C0F11` | Inputs, segmented tracks, chart gutters |
| Border | `rgba(255,255,255,.105)` | Hairline structure only |
| Primary yellow | `#F5C518` | Deposit, main CTA, active marker, selected state |
| Positive | `#16C79A` | Gains, healthy status, upward movement |
| Negative | `#FF6377` | Losses, downward movement, destructive feedback |
| Informational | `#76B8ED` | Preview notice and non-transactional guidance |

Do not use yellow as a card wash, chart fill, generic icon color, decorative glow, or default link color. If a component is not an action or selected state, it should be neutral.

### Typography

- Use Satoshi for labels, tables, navigation, controls, explanatory copy, brand lockups, and large balance or price figures.
- Use the supplied 400, 500, and 700 weights consistently; use tabular numerals for balances, prices, and quantities.
- Use tabular numerals for all prices, balances, percentages, volumes, and dates.
- Keep labels compact: 11–13px for secondary data, 13–15px for primary row content.
- Use weight before color to establish hierarchy. Avoid oversized headline blocks on trading screens.

### Shape and depth

- Use 8–12px panel radii. Reserve pills for status, compact filters, and the deposit action.
- Separate panels with fill and a single hairline border. Avoid stacked shadows and glossy gradients.
- Use vertical and horizontal rules to organize data; do not create a new card for every metric.
- Motion is limited to route entrance, selection movement, and state feedback. Respect reduced-motion settings.

## Layout rules

### Global exchange shell

Desktop uses a 68px top bar and a 244px left navigation rail. The top bar contains:

1. WorldStreet wordmark.
2. Exchange, Trade, Markets, Earn, Buy crypto, and More navigation.
3. Search with a `Ctrl K` affordance.
4. Deposit as the one high-contrast action.
5. Assets, Orders, notifications, and demo profile utilities.

The left rail groups destinations into Workspace, Move money, and Earn & automate. A public preview account block sits at the bottom. Unbuilt destinations stay visible but use a neutral `Soon` marker and are not clickable.

The trading preview removes the left rail to give the market chart, order book, and ticket the width they need. It retains the global top bar and adds a small demo-data status strip.

### Dashboard

The dashboard should answer these questions in order:

1. What is my portfolio value?
2. How is it moving?
3. What can I do next?
4. Which markets or holdings need attention?

Use one primary portfolio panel, a compact account split, a performance chart, a four-metric strip, and dense market/holdings panels. Quick actions should be buttons or links with clear verbs, not decorative icon tiles.

### Markets

Markets prioritize scanning:

- Search and quote filters stay above the table.
- Market rows include symbol, name, price, 24h change, high, low, volume, market cap, and a directional sparkline.
- The row and the Trade action both lead to the same market.
- Favorites are a stateful filter, not just a star icon.
- Positive and negative movement use green and red; yellow should not encode market direction.

### Spot trading

The terminal is organized as:

- Market identity and price header.
- Chart with timeframe controls.
- Optional market rail for Pro mode.
- Order book and recent trades.
- Order ticket with explicit balance, price, quantity, total, and submit state.
- Working orders / positions beneath the action area.

Simple and Pro change the amount of information and available order types, not only the visual density. Futures remains Pro-only because leverage and liquidation data cannot be safely hidden.

### Wallet, transfers, and history

Wallet screens use ledger conventions: balances align right, network and account types are explicit, and empty states explain what the user can do next. Deposit, withdraw, swap, and bridge surfaces must state whether they are demo-only when unauthenticated.

Transactions use newest-first rows, clear direction labels, status chips, and copyable identifiers. Do not use unexplained decorative charts where a table is the better tool.

### Mobile

At 860px and below, the left rail becomes a slide-in drawer. The top bar retains search, Deposit, notifications, and profile. At 560px, the brand text and keyboard hint collapse before the data controls do. Tables may scroll horizontally; critical row information should remain visible without hover.

## Interaction rules

- Every active destination has both a yellow 3px rail marker and a neutral raised fill.
- Disabled / future features use muted text and `Soon`; they do not react to hover or click.
- Search results should be fast, keyboard-addressable, and route to a real preview destination.
- Primary actions are single-purpose. Deposit always points to the preview wallet entry point.
- Public actions never submit funds, orders, or credentials. Demo notices are informative, not alarmist.
- Notification, search, and mobile navigation popovers close on Escape and when the route changes.
- Every price-changing control should show the selected state without relying on color alone.

## Route map

| Route | Purpose |
| --- | --- |
| `/dashboard-unauth` | Portfolio overview and market snapshot |
| `/markets-unauth` | Searchable, sortable market table |
| `/trade-unauth` | Spot / futures preview terminal |
| `/wallet-unauth` | Demo balances, limits, and movements |
| `/swap-unauth` | Demo quote and swap flow |
| `/bridge-unauth` | Demo cross-network transfer flow |
| `/transactions-unauth` | Demo transaction history |
| `/launchpad-unauth` | Demo token launch discovery |

## Implementation notes

- Shared shell: `components/preview/exchange-shell.tsx`.
- Preview route detection: `components/preview/routes.ts`.
- Public-only palette and shell styling: the `Public Exchange redesign` block in `app/globals.css`.
- Shared preview disclaimer: `components/preview/page-chrome.tsx`.
- Authenticated routes are intentionally not forced into the public preview shell.
- Demo values should stay local and visibly frozen until a real market-data contract is connected.

## QA checklist

- Test every route directly without a Clerk session.
- Check the active nav row after client navigation and a hard refresh.
- Check search with `Ctrl K`, an empty query, and a non-matching query.
- Check notification popover and mobile navigation with Escape.
- Check 1280px desktop, 860px tablet, and 390px mobile widths.
- Verify yellow appears only on brand, active, selected, and primary-action states.
- Confirm charts and percentages use the same direction color.
- Confirm no preview control submits a real order, wallet transfer, or credential.
