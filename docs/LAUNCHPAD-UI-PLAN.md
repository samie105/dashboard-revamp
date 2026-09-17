# Launchpad — UI-first plan (`/launchpad-unauth`)

**Companion to** `LAUNCHPAD-SOLANA-IMPLEMENTATION.md`, which covers the chain, the curve program and
the backend. This document covers only the screens, and it comes first on purpose.

**Status:** proposal. Nothing built.

---

## 1. Why the UI leads

Three reasons, and the third is the one that saves the most time.

**Nothing blocks it.** No curve program chosen, no Rust, no devnet, no funded wallet. Every other
page in this app was designed this way — `/dashboard-unauth` through `/bridge-unauth` — and each was
reviewed and signed off before a line of live code moved.

**It makes the open questions concrete.** "What is our fee and who pays it" is abstract in a
document. On a create form showing *creator pays 0.02 SOL, plus 1% of curve volume*, it is obvious
in five seconds whether that is right.

**It produces the backend's data contract as a by-product.** Designing the token page forces the
question of whether it shows time-to-graduation or only progress — and that is exactly the
difference between the backend needing an ETA field or not. Build the screens first and the API spec
falls out of them. Build them second and the screens get retrofitted to whatever the backend
happened to return.

---

## 2. The condition this plan is built on

Every figure on a launchpad screen is a number about someone's money, and in a preview **all of them
are invented.** That is fine in a preview and dangerous afterwards.

This session ended up cutting a Fear & Greed dial, per-network confirmation counts, bridge ETAs,
market-cap curves and fee splits from the live pages — every one of them because a preview had
invented the figure and no backend served it. Each cut cost a round of rework.

So: **`launch-data.ts` carries a manifest, maintained as the preview is built.**

```ts
/**
 * FIGURE PROVENANCE — keep this current. It is the deliverable, not a comment.
 *
 * SOURCED — a real field will exist; the shape here is the contract
 *   symbol, name, iconUrl ............ TokenLaunch (ours)
 *   creatorBps ....................... TokenLaunch.allocation (ours)
 *   solRaised, tokensSold ............ curve program account
 *   graduationLamports ............... curve program config
 *   mint, poolAddress ................ chain
 *   status ........................... TokenLaunch.status (ours)
 *
 * ASSUMED — invented here; needs a decision or a source before it ships
 *   holderCount ...................... needs an indexer. Cut, or add one.
 *   timeToGraduation ................. no ETA exists. Show progress only?
 *   priceHistory ..................... needs a curve-trade index
 *   volume24h ........................ needs the same index
 *   creatorFeeEarned ................. depends on the fee model (undecided)
 *   trendingRank ..................... needs a defined formula
 */
```

The rule that follows from it: **an ASSUMED figure may appear in the preview, but may not ship to a
live page until it moves to SOURCED.** Stage 5 hands this manifest to the backend work as its spec.

---

## 3. What the repo already gives us

Almost all of it. This is a composition job, not a new design system.

| Need | Use | Where |
|---|---|---|
| Preview shell + disclaimer | `PreviewNotice`, `SectionRule` | `components/preview/page-chrome.tsx` |
| Route registry | `PREVIEW_ROUTES` — **add `launchpad`** | `components/preview/routes.ts` |
| Preview nav | `PreviewSidebar` — already lists Launchpad as `soon` | `components/preview/sidebar.tsx` |
| Entrance motion | `Rise` | `components/ui/system.tsx` |
| Surfaces | `CardShell` + `HERO_HUE` / `CARD_HUE` | `components/ui/surface.ts` |
| Tabs / filters | `Segmented` | `components/ui/system.tsx` |
| Amount entry | `AmountField` | `components/ui/flow.tsx` |
| Primary action | `FlowCta` | `components/ui/flow.tsx` |
| Row tables | `DetailPanel` | `components/ui/flow.tsx` |
| Lifecycle screens | `StatusScreen`, `useStageProgress` | `components/ui/flow.tsx` |
| Two-pane money form | `FundingLayout`, `FundingAside`, `StageOutline` | `components/trade/funding-layout.tsx` |
| Quote countdown ring | `QuoteClock` | `components/swap/quote-detail.tsx` |
| Charts | `AreaChart`, `MiniSpark`, `Donut`, `VolumeBars`, `ScoreRing` | `components/ui/charts.tsx` |
| Coin art | `CoinAvatar` | `components/ui/coin-avatar.tsx` |
| Seeded data | `mulberry32` + `walk` | `components/dashboard-unauth/demo-data.ts` |

**Two of those are worth promoting** rather than importing across preview boundaries:

- `QuoteClock` → `components/ui/quote-clock.tsx`. The curve ticket needs the same countdown, and
  reaching into `components/swap/` for it is how a shared thing ends up with two copies.
- `mulberry32` / `walk` → `components/preview/seeded.ts`. Six preview data files will want it.

Both moves are one commit each, done in Stage 1.

---

## 4. Files

```
app/launchpad-unauth/
  page.tsx                      Stage 1 — discovery
  [launchId]/page.tsx           Stage 1 — token page
  create/page.tsx               Stage 2

components/launchpad-unauth/
  launch-data.ts                the manifest + seeded generators (§2)
  discovery-hero.tsx            Stage 1 — what a launchpad is, plus live counts
  launch-grid.tsx               Stage 1 — the feed
  launch-card.tsx               Stage 1 — one launch
  token-hero.tsx                Stage 1 — identity, price, progress
  curve-chart.tsx               Stage 1 read-only → Stage 3 interactive
  progress-rail.tsx             Stage 1 — raised vs threshold
  allocation-panel.tsx          Stage 1 — creator's share, stated plainly
  create-form.tsx               Stage 2
  create-preview.tsx            Stage 2 — the card as it will appear
  cost-summary.tsx              Stage 2 — what launching costs
  curve-ticket.tsx              Stage 3 — buy/sell
  trades-tape.tsx               Stage 3 — recent curve trades
  lifecycle-screen.tsx          Stage 4 — deploying / graduating / graduated / failed
  availability-notice.tsx       Stage 5 — paused vs not built
```

Registration, once, in Stage 1:

```ts
// components/preview/routes.ts
launchpad: "/launchpad-unauth",
```

`LayoutShell` needs no change — the launchpad is a normal padded page, not full-bleed like `/trade`.

---

## 5. The stages

Each ends somewhere reviewable. No stage depends on a later one.

### Stage 1 — Discovery + token page, read-only

The cheapest stage and the most-seen screen. **No forms, no state machine, nothing writable.**

*Discovery* (`/launchpad-unauth`): a hero stating what this is and how many launches are live, then
`Segmented` filters — Live · Graduating · Graduated — over a grid of launch cards. Each card: icon,
name/symbol, a `MiniSpark` of the curve, progress toward graduation, creator allocation.

*Token page* (`/launchpad-unauth/[launchId]`): identity and current price up top, the curve chart
with the current point marked, a progress rail with the real numbers (raised / threshold), the
allocation panel, and a placeholder where the ticket will go in Stage 3.

**Settles:** whether the concept reads. Whether progress-toward-graduation is legible without an ETA.
Whether creator allocation is prominent enough to do its job.

**Ranking note:** rank by graduation progress, not by a "trending" score. Progress is a real number
the chain will supply; trending needs a formula nobody has defined, and it is listed as ASSUMED for
exactly that reason.

### Stage 2 — Create flow

`/launchpad-unauth/create`, landscape in the shape the funding doors already use: the form on the
left, and on the right a live preview of the launch card plus a cost summary.

Form: name, symbol, description, icon, links, creator allocation (slider, hard-capped), initial buy.
The right pane answers "what am I about to make, and what does it cost" continuously as you type.

**Settles:** the fee model, the allocation cap, what validation must exist (symbol collisions,
reserved names), and whether launching feels like a considered act or a slot machine.

**This is the stage that answers the most product questions.** Worth reviewing carefully.

### Stage 3 — The curve ticket

Buy/sell on the token page. A curve buy *is* a swap with one side fixed, so it reuses the swap
ticket's two-pane shape: amount on the left, quote and countdown on the right, with slippage
explicit.

Plus a trades tape — recent curve buys and sells — which is what makes a launch feel alive.

**Settles:** the quote's shape, therefore what the buy/sell endpoints must return. `QuoteClock`
earns its promotion here.

### Stage 4 — Lifecycle

The states that always get skipped and always matter: `deploying`, `graduating`, `graduated`,
`failed`. Built on `StatusScreen` and `StageOutline`, the same grammar as bridge and funding.

Two requirements, both learned the hard way on the bridge page:

- **A numbered outline before the wait, not a progress bar.** Nothing has happened yet, so no step is
  done, active or failed. A bar advancing on a guessed duration sets an expectation no backend made.
- **A launch outlives the tab.** The screen must say so, and must be re-enterable.

**Settles:** what the reconciler has to report, and how much the UI can say without an ETA.

### Stage 5 — Availability

Three states per chain, and the UI must tell them apart:

| State | UI |
|---|---|
| Not built | Greyed, "Soon" — the pattern already in the sidebar |
| Built but paused | Visible, disabled, **shows the reason** |
| Live | Normal |

"Not built" and "paused" looking identical is how a support ticket gets opened about a feature that
was switched off deliberately.

**Ends with:** the §2 manifest reviewed, every ASSUMED figure either given a source or cut, and the
result handed over as the backend spec.

---

## 6. Review gates

The preview is worth having only if it is checked the way the other seven were:

- **375px with zero overflow.** Measure per element, not `document.scrollWidth` — a card can clip
  internally while the document does not scroll. That mistake was made once already this session.
- **44px clearance** under the mobile bottom bar at full scroll.
- **No hydration mismatch.** Every figure from the seeded PRNG; no `Date.now()` or `Math.random()`
  at render; anything clock-dependent resolved in an effect.
- **Colour discipline.** Gold is brand, primary action and active state. Credit/debit is money
  direction only. A creator allocation of 18% is **not** red — it is a fact, not a loss.
- **Every figure derives from one source.** The progress rail and the curve chart read the same
  numbers. Two components computing the same percentage independently is the fault this whole
  redesign has been removing.

---

## 7. Sequencing with the backend

Stages 1–2 need nothing from the chain. Run **Phase 0** (the 2–3 day devnet spike from the
implementation plan) in parallel with Stage 2.

By the time Stage 3 needs a quote shape, the spike will have answered what the curve program
actually returns — so the ticket is designed against reality instead of retrofitted to it. That
ordering is the only dependency between the two tracks.

---

## 8. What this plan does not do

- **It does not build the real `/launchpad`.** The preview is a design surface. Promoting it is a
  separate pass per screen, exactly as the other seven pages were promoted.
- **It does not choose the curve program.** That is open question #2 in the implementation plan, and
  the UI is deliberately built so the answer changes configuration rather than layout.
- **It does not invent an ETA.** If time-to-graduation is wanted, it needs a source; until then the
  screens show progress, which is real.
