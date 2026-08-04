# Web ⇄ Mobile Design Parity Plan

Measured from the live iPhone 17 simulator (`worldstreet-app`, 402pt viewport) against the live web dev server (`localhost:58086`). Every number below is read off a real screenshot, not the token file.

> **Status — 2026-08-04: all six stages have landed.** Section 1 (the mobile
> grammar) is the spec the code now implements, and stays useful. Section 2
> ("what the web looks like today") describes the *before* state and no longer
> matches anything.
>
> Where each stage ended up, all in [components/ui/system.tsx](components/ui/system.tsx):
> `Balance` (font-display 300, `clamp(2.75rem, 5.5vw, 4.5rem)`, −0.02em) ·
> `Segmented` · `PageHeader` + `IconAction` · `CardHeader` (title/subtitle, no
> leading icon) · `ListRow` · `EmptyState` · `ActionPill`. The network strip and
> its per-chain figures are in [components/dashboard/user-card.tsx](components/dashboard/user-card.tsx)
> — six receivable networks over five wallet keys, since Arbitrum reuses the
> Ethereum address. The money-flow screens got their own kit in
> [components/ui/flow.tsx](components/ui/flow.tsx).
>
> The three open questions in §4 were settled by what shipped: the gold-chip
> pill won (`ActionPill`); `/portfolio` and `/assets` stayed separate rather
> than merging as mobile did; density is compressed against mobile's rhythm,
> not matched to it. The dev-server port is now pinned to 3200 in
> [.claude/launch.json](.claude/launch.json), not the `:58086` above.

---

## 1. The mobile grammar (the target)

| Element | Mobile spec |
|---|---|
| **Page header** | Title 28–32px **Poppins bold**, subtitle 15px muted directly beneath. Actions on the right are **bare icons ~22px**, no chips, no borders. |
| **Tabs** | **Fully-rounded pill container** (`radius.pill`), track `rgba(255,255,255,0.06)`, **height ~44pt**, active thumb = `surfaceAlt #292524` fully rounded, active label white semibold, inactive muted. Icons optional. |
| **Network strip** | Pill chips **~56pt tall**, `radius.pill`, `surface` fill, active = `surfaceAlt`. Content = 28pt circular token icon + **two-line stack**: label 15px semibold over value 13px muted. |
| **Eyebrow** | ~13px, uppercase, `letter-spacing 0.08em`, color `subtle #78716C`. |
| **Balance** | **~64–72px, LIGHT weight (300–400)**, tracking −0.02em, pure white. Eye toggle sits right. |
| **Action pill** (crypto home) | ~56pt tall, `radius.pill`, `surface` fill, **36pt gold circular chip** (`rgba(234,179,8,0.12)` + gold 18px icon) + 15px semibold label. |
| **Action round** (assets) | **64pt neutral circle** (`surface`) + white icon, label 13px **below**. |
| **Card** | `radius.lg 13`, `surface` fill, **no border**. In-card header = title 17px semibold + subtitle 13px muted. |
| **Empty state** | 44pt gold-tinted circular icon chip → title 17px semibold → 13px muted body → **outlined gold pill CTAs**. |
| **List row** | 44pt gold-tinted **rounded-square** icon chip (radius ~12) + 15px title + 13px muted subtitle + chevron, hairline separated. |

---

## 2. What the web looks like today — page by page

### `/` Dashboard *(pass 1 applied)*
| Element | Web now | Mobile | Verdict |
|---|---|---|---|
| Balance | 40px **bold** | ~72px **light** | ❌ the single biggest miss — reads cramped and heavy |
| Tabs | 24px text-only pills, top-right, detached from the balance | 44pt icon pill bar, directly under the balance | ❌ **"the tab system is off"** |
| Network strip | absent (only in Main view, as a raw `<select>`) | always-on value-carrying chips | ❌ missing |
| Action rail | 32px pills, 28px gold chips | 56pt pills, 36pt gold chips | ⚠️ right idea, ~60% of the size |
| Backdrop | flat black | warm gold radial glow behind the hero | ❌ missing |
| Card headers | title + subtitle ✅ | same | ✅ matches |

### `/portfolio`
| Element | Web now | Verdict |
|---|---|---|
| Tabs | **underline tabs** (Overview / Wallets / Fund Wallet) | ❌ a *third* tab system in the app |
| Card titles | **icon + title** (`▣ Portfolio`, `▣ Quick Actions`, `▣ Watchlist`) | ❌ decorative icons — removed from dashboard, still here |
| Values | "Available USDC **$0.00**" rendered in **gold** | ❌ gold used as a data colour; gold is brand-only |
| Header | "Net Worth $0.00" + Refresh, right-aligned | ❌ different header pattern from every other page |
| Quick Actions | 2 tiles w/ icon chips | ⚠️ close to mobile's ActionRound, wrong shape |

### `/assets`
Still spinning on "Setting up your multi-chain wallets" — the crypto API is timing out from this machine, so I couldn't capture it. **Flagged as unverified.**

### Cross-cutting
- **Three tab systems** in one app: segmented pill (dashboard), underline (portfolio), and whatever `/assets` uses.
- **Two header patterns**: greeting row vs. title/subtitle/right-stat.
- Gold leaking into data values on `/portfolio`.

---

## 3. Plan

### Stage 1 — Fix the hero *(the "doesn't look like the wallet UI" complaint)*
1. Balance → `font-display`, **weight 300**, `clamp(44px, 6vw, 72px)`, tracking −0.02em.
2. Move the view tabs **out of the greeting row** to directly beneath the balance.
3. Add the **always-on network strip** (All networks / Ethereum / Arbitrum / …) as value-carrying pill chips — not gated behind the Main view, not a `<select>`.
4. Scale the action rail to mobile proportions (pill ~48px, gold chip ~34px, label 14px).
5. Add the warm radial gold glow behind the hero block.

### Stage 2 — One tab system everywhere
Rewrite `Segmented` in `components/ui/system.tsx` to the mobile spec — **fully-rounded track, 40–44px tall, sliding thumb on `surfaceAlt`, optional icons** — then replace:
- `/portfolio` underline tabs → `Segmented`
- `/assets` wallet-view tabs → `Segmented`
- Markets / Recent Trades / My Holdings (already `Segmented`, will inherit the new size)

### Stage 3 — One page header
Add `PageHeader` to `system.tsx`: title (Poppins 28px) + subtitle + right-side **bare icon actions**. Apply to `/portfolio`, `/assets`, `/transactions`. The dashboard keeps its greeting row (it's the one screen with a personal salutation, same as mobile's wallet home).

### Stage 4 — Purge decorative icons + gold-as-data
- Strip `icon + title` from every card header (`/portfolio` × 3, others).
- `/portfolio` values → `text-foreground`; gold only for links/CTAs.

### Stage 5 — Shared row + empty-state primitives
Add `ListRow` (gold rounded-square icon chip + title/subtitle + chevron) and `EmptyState` (gold circular chip + title + body + outlined gold pill CTAs) to `system.tsx`; adopt across pages.

### Stage 6 — `/assets` + `/transactions`
Same treatment once the API is reachable and I can actually see them.

---

## 4. Open questions

1. **Action style on the dashboard** — mobile is inconsistent here: crypto home uses **gold-chip pills**, Assets uses **neutral round discs**. I'd standardise the web on the **gold-chip pill**. Agree?
2. **`/portfolio` vs `/assets`** — mobile folded these into one "Assets" screen with Overview/Spot/Futures/Wallets tabs. Do we merge the web's two pages the same way, or keep both?
3. **Density** — the web has ~3.5× the mobile's screen width. Should I match mobile's generous vertical rhythm exactly, or compress ~20% so a dashboard still fits above the fold?
