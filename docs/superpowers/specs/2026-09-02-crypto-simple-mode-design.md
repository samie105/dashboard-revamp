# Simple mode + the first-run guide for the crypto dashboard

Date: 2026-09-02
Branch: `feat/crypto-simple-mode`
Status: approved for implementation

## The problem

Worldstreet is about to onboard people every hour who have never used
crypto. The crypto dashboard currently assumes they have. `/wallet/modern`
opens on a stack of chain cards, three counters reading Assets / Networks /
Accounts, a raw hex address, and a balance list where the same dollar
(USDC) appears three times because it sits on three networks. `/trade` opens
on a ticket that asks whether you want to size your order in dollars or in
tokens. None of that is wrong. All of it is noise to someone whose question
is "how much money do I have, and how do I add some".

Two changes answer it, and they reinforce each other:

1. **A Simple / Pro switch** on the two heavy screens. Simple is the
   default. Pro is one press away and everything that was there is still
   there.
2. **A first-run guide** on the wallet that says what the screen is, names
   the two verbs that matter, and hands over the switch.

## Non-goals

- No new backend calls, no schema change, no new dependency.
- No route changes, no nav changes.
- Nothing is deleted. Simple mode hides; Pro mode is the current screen.
- The setup ceremony (`WalletSetupFlow`) is untouched. It already owns the
  first minute of a new account and it does that well.

## Architecture

The house already has the exact three patterns this needs, and the design
uses them rather than inventing a fourth of anything.

| Need | Existing precedent | Where |
|---|---|---|
| A persisted per-user preference read by many components | module-level store + `useSyncExternalStore` | `hooks/useBalancePrivacy.ts`, `MigrationNotice.tsx` |
| A rule that must be provably "exactly once" | pure predicate in `lib/`, unit-tested without React | `lib/wallet-mode.ts` + `lib/__tests__/migration-notice.test.ts` |
| A one-time popup mounted above a page | `ResponsiveModal` + `markSeen` on show | `MigrationNoticePopup` |

Zustand is a dependency but is imported nowhere. The house pattern is the
external store. Follow the house.

### Components

```
lib/ui-mode.ts                    pure: UiMode, storage key, resolveUiMode,
                                  simpleWalletView, simpleTradeView
lib/balance-grouping.ts           pure: groupBalancesBySymbol
lib/welcome-guide.ts              pure: welcomeGuideSurfaces
components/ui-mode-provider.tsx   the store + <UiModeProvider> + useUiMode()
components/ui/mode-switch.tsx     the Segmented control, one instance shape
components/crypto/CryptoWelcomeGuide.tsx   the first-run modal
```

Wiring: `UiModeProvider` goes into `app/layout.tsx` inside `AuthProvider`
(it needs `userId` to key storage) and outside `LayoutShell` (both
`/wallet/modern` and the full-bleed `/trade` must read it).

### The preference

- Key: `ws:ui-mode:<userId>`, values `"simple" | "pro"`. Matches the
  `ws:` convention every other preference uses.
- **Default is Simple** when nothing is stored. This is the whole retention
  bet: the newcomer's first screen is the calm one, and the person who
  wants density presses Pro once and is never asked again.
- Cross-tab via the `storage` event, same as the migration store.
- `localStorage` throwing (private mode) degrades to Simple for the
  session, never to a crash.

## What Simple mode changes

### `/wallet/modern`

| Section | Pro (today) | Simple |
|---|---|---|
| Page subtitle | "Only you can open this wallet" | unchanged |
| Hero card | total or a selected chain's balance | total only |
| Hero address line | grouped hex + copy | hidden — Deposit is the way to receive |
| Hero networks label | "Ethereum · Arbitrum" | hidden |
| `WalletPocket` chain stack | 5 cards + pouch | hidden entirely |
| Action strip | Deposit · Send · Trade · Security | unchanged |
| Hero stats | Assets / Networks / Accounts | hidden |
| Locked pill | "Locked" | unchanged |
| Balances subtitle | "N assets across M networks" | "N holdings" |
| Allocation strip | shown | shown |
| Balance rows | one row per asset **per network** | **one row per asset**, networks summed |
| Row subtitle | network name | count of places, only when > 1 |
| "Share of wallet" column | shown | hidden |
| Amount column | shown | shown |
| Security modal | 3–4 rows, flat | 2 everyday rows + "Show advanced options" |

The row aggregation is the substantive one. Three USDC rows reading
`USDC / Ethereum`, `USDC / Arbitrum`, `USDC / Solana` is the single most
confusing thing on the screen for someone who thinks of USDC as "my
dollars". Simple mode sums them into one row and says "in 3 places"
underneath. Pro keeps the per-network truth.

Aggregation rules (`groupBalancesBySymbol`, pure and tested):
- Group by upper-cased symbol.
- Sum USD values; a group with any unpriced member is still priced from
  the members that priced, and the count of unpriced members is carried so
  the page can keep footnoting them.
- Sum token amounts as **decimal strings**, never floats — base units and
  decimals differ per network for the same symbol, so the amounts are
  converted to decimal first and summed with a fixed-point helper.
- Keep the first member's logo and the largest member's `networkId` as the
  representative, so the per-row Deposit button still opens somewhere real.
- Preserve the sort: biggest USD value first, unpriced last.

### `/trade`

| Control | Pro (today) | Simple |
|---|---|---|
| 24h High / Low / Volume stats | shown | hidden |
| Amount unit switch (USD / token) | shown when switchable | hidden, forced to USD |
| 25 / 50 / 75 / Max row | shown | shown |
| "Qty ≈ x SYMBOL" estimate | shown | shown |
| Markets rail, chart, orders | shown | shown |
| Venue tabs (Spot / Futures) | shown | shown |

The venue tabs stay in both modes. The existing comment defends that
choice — a visible-but-gated Futures tab is a roadmap people have already
found, and hiding it in Simple would make the two modes disagree about what
the product is.

Order type (Market / Limit) is already futures-only, so spot needs nothing.

## The first-run guide

A `ResponsiveModal` of four cards on `/wallet/modern`, shown once.

1. **"Welcome to your wallet"** — everything you hold, in one place, and
   only you can open it.
2. **"Adding money"** — press Deposit, pick what you're adding, send it to
   the address shown.
3. **"Sending money"** — press Send, choose who and how much. The wallet
   handles the rest.
4. **"Simple or Pro"** — you're in Simple. Pro shows every network, every
   account and the full breakdown. Switch any time from the top of the page.

Copy follows the plain-language rule already enforced in this directory:
no "self-custody", no "keys", no "chain", no "gas". Never imply Worldstreet
can open the wallet.

### When it shows

`welcomeGuideSurfaces({ eligible, seen, walletReady, ceremonyVisible })`:

- `eligible` — crypto backend on, and the user is signed in.
- `walletReady` — a wallet exists. A user with no wallet gets the setup
  ceremony instead; two modals at once is the failure mode to avoid.
- `ceremonyVisible` — `WalletSetupFlow` reports this already via
  `onVisibilityChange`. The guide waits for it to be false, so the person
  who just finished setup reads the guide immediately after, not through it.
- `seen` — either the local key `ws:crypto-welcome-seen:<userId>` **or**
  the profile's `onboardingCompleted` containing `"crypto-wallet"`.

Both stores are written on show: `localStorage` for instant, per-device
certainty, and `markOnboardingComplete("crypto-wallet")` for durability
across devices. The local key is what's read on the render path; the
profile is the backstop for a new device. `markSeen` fires when the modal is
shown, not when it closes — the `MigrationNoticePopup` precedent, for the
same reason (a reload mid-read has had its showing).

### Getting it back

A bare `?` `IconAction` in the wallet's `PageHeader` reopens the guide any
time. Without it the guide is a thing that happens to you once and can never
be consulted, which is exactly what makes people ask support instead.

## Testing

Vitest runs `lib/**/__tests__` and `hooks/**/__tests__` in a node
environment with no testing-library. So every rule that can be a pure
function is one, and that is what gets tested:

- `lib/__tests__/ui-mode.test.ts` — default is simple, stored wins,
  garbage in storage resolves to simple, the two view descriptors.
- `lib/__tests__/balance-grouping.test.ts` — same symbol across networks
  sums; different symbols don't merge; unpriced members counted, not
  dropped; decimals of differing precision sum exactly; ordering.
- `lib/__tests__/welcome-guide.test.ts` — hidden until a wallet exists,
  hidden while the ceremony is up, hidden once seen by either store,
  shown exactly once otherwise.

The React wiring is verified by `npm run typecheck` and `npm run build`,
plus a manual pass on both screens in both modes.

## Risks

- **A person loses a feature and doesn't know why.** Mitigated by the
  guide's fourth card, by the switch sitting in the page header where it
  reads as part of the page, and by advanced security options being behind
  a disclosure rather than gone.
- **Aggregated rows hide a network-specific problem.** The outage notices
  are per-network and stay visible in both modes, so "Solana balances are
  temporarily unavailable" still reaches a Simple user.
- **Two rows of the same symbol have different decimals.** Handled by
  summing decimal strings with fixed-point arithmetic, not floats.
