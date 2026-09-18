# Launchpad (Solana) — backend spec from the UI preview

This is the Stage 5 handover from `docs/LAUNCHPAD-UI-PLAN.md`. It comes from the
figure provenance manifest in `components/launchpad-unauth/launch-data.ts`
(`PROVENANCE`). Every number shown on `/launchpad-unauth` screens appears below.

**Rule:** a live launchpad page may only show a figure that has a source in
§1. Anything in §2 stays in the preview until a decision moves it to §1. If
the decision is "not doing it", the UI removes the figure.

## 1. Sourced: what the backend must serve

| Figure | Source | Screens | Backend work |
|---|---|---|---|
| Name, symbol, description, links | `TokenLaunch` (written at draft) | all | CRUD on `TokenLaunch` |
| Creator allocation % | `TokenLaunch.allocation` | all | Enforce the cap server-side, not just in the form |
| SOL raised, tokens sold | Curve program pool account | discovery, token | Read the pool account. Cache the read with a short TTL |
| Graduation threshold | Curve program config | all | Expose in `GET /launchpad/config` |
| Price and market cap | Derived from pool reserves | all | Arithmetic over the reserves. Never a separate feed |
| Supply split (curve / reserve) | Curve program config | token, create | `GET /launchpad/config` |
| Launch status | `TokenLaunch.status` (reconciler) | discovery, token | Reconciler moves status draft → signing → confirming → live / failed → graduating → graduated |
| Mint and pool addresses | Chain | token | Stored on `TokenLaunch` once confirmed |
| Launched … ago | `TokenLaunch.createdAt` | discovery, token | — |
| SOL → USD | Existing `getPrices` | all | None |
| Buy / sell quote | Program math over live reserves | token | `POST /launchpad/:id/quote` → `{ out, minOut, impact, expiresAt }`. Use the program's own math. The client never reimplements it |
| Price impact, minimum received | Quote + user slippage | token | Part of the quote response |
| Chain availability + pause reason | `OperationalControl` keys `launchpad_solana`, `launchpad_ethereum`, `launchpad_intertrain` → `{ paused, reason }` | all | `GET /launchpad/availability`. The server must refuse launch and curve-trade requests while a chain is paused. The UI state alone doesn't stop them |

## 2. Assumed: decisions needed before these can go live

| Figure | Preview value | Decision needed | Recommendation |
|---|---|---|---|
| Curve constants | 30 SOL virtual / 1.073B virtual tokens / 85 SOL graduation | Which curve program (open question #2) | Take the program's values from config. Nothing should be hard-coded |
| Creation fee | 0.02 SOL | Fee model (open question #3) | Decide before launch, then serve it from config |
| Trading fee | 1% | Fee model (open question #3) | Same as the creation fee |
| Network rent | ~0.022 SOL | — | **Replace with a simulation.** Simulate the launch transaction and show the real rent. Never show a fixed estimate |
| Allocation cap | 20% (`LAUNCHPAD_MAX_CREATOR_BPS`) | Product | Keep it as an env/config value that the server enforces |
| "Near graduation" | 75% | Product | A UI filter threshold. It can stay a frontend constant once agreed |
| What a pause stops | New launches **and** curve trades. Graduated tokens are unaffected | Product | Keep as shown. A pause is the response to a curve-program problem, and trading touches that program too |
| Buy past the threshold | Only the excess is refused | Depends on the program | Follow the chosen program and show its behaviour in the quote |
| Name / symbol rules | `validateDraft()` + `RESERVED_SYMBOLS` | Product | Move to the server and run the same rules on both sides |
| Recent trades | Seeded tape | Needs a curve-trade index | **Cut from v1** unless the indexer is built. The price-history chart needs the same index |
| Your SOL / token balance | Demo wallet | — | Wire to the existing wallet balances hook. No new backend needed |

## 3. Endpoints, summarised

```
GET  /launchpad/config                 curve constants, fees, caps
GET  /launchpad/availability           per-chain { state, reason }
GET  /launchpad/launches?filter=       discovery feed (status, raised, sold, createdAt)
GET  /launchpad/launches/:id           one launch + pool snapshot
POST /launchpad/launches               create draft → returns unsigned tx
POST /launchpad/launches/:id/submit    signed tx → status "confirming"
POST /launchpad/launches/:id/quote     buy/sell quote, expiresAt (preview TTL 20s)
```

The server must check availability on every mutating call.

## 4. §6 review gates: results for this pass

Checked on discovery, a live token (`ember`), a graduated token
(`gilded-finch`) and create, with Solana set to live and then to paused. The
four lifecycle states and the capped ticket were checked in Stages 3–4 and are
unchanged.

- **Overflow at 375px (per element):** none on any page, in either state.
- **Bottom-bar clearance:** the create page's last control clears the bar.
- **Hydration:** no mismatch warnings. Availability reads through
  `useSyncExternalStore`, and the server snapshot is the defaults.
- **Colour discipline:** paused uses the warning tone. The launch button
  stops being gold while paused. Gold is not used for any disabled state.
- **Single source:** every figure appears in `PROVENANCE`, and each page's
  manifest card lists the figures on that page.
