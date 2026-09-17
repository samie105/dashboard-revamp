# Launchpad — Solana implementation plan

**Status:** proposal, not yet started. Nothing in either repo references a launchpad today.
**Scope:** token creation, allocations (no vesting), bonding curve, liquidity seeding, on Solana first.
**Chains after this:** Ethereum, then Intertrain. Per-chain availability is a runtime switch — see §7.

---

## 1. The decision that shapes everything else

A bonding curve has to hold buyers' SOL and price every trade without anyone trusting us. That is an
**on-chain program**, and there are only three ways to get one.

| Option | What it costs | Verdict |
|---|---|---|
| **A. Write our own Anchor program** | Rust, a new toolchain, a new deploy pipeline, and an audit before it can hold a dollar. Realistically 3–6 months before launch, and the audit is the long pole, not the code. | **No** — see below |
| **B. Integrate an existing curve program** (Meteora DBC, Raydium LaunchLab) | An SDK dependency, config per launch, and reading someone else's account layout. Weeks. | **Yes** |
| **C. Custodial curve** — we hold the SOL in our own wallet and price trades off-chain | Fastest to build and the worst idea here. It makes us a custodian of other people's money on a product that is otherwise self-custodial, and it means a bug in our pricing code is a loss of funds with no on-chain recourse. | **No** |

### Recommendation: B

Three reasons, in order of weight:

1. **There is no Rust anywhere in this stack.** The backend is TypeScript/Express/Mongoose. Option A
   is not "add a file", it is adding a language, a build system, a deployment target and an audit
   budget. That is a separate project that happens to be adjacent to this one.
2. **The curve is not the hard part — graduation is.** Moving from curve to a real AMM pool without
   a window where the price can be manipulated is the part that gets launchpads exploited. Meteora
   DBC and Raydium LaunchLab both do curve → migration → LP seeding as one audited path. That is
   *all three* of the things this brief asks for, already solved.
3. **Option C fails the product's own premise.** Everything in this wallet is "you sign, on your
   device, and we never hold your keys". A custodial curve contradicts that on the one screen where
   people are handing over the most money.

> **Consequence to accept up front:** with B, the curve shape, fee split and graduation threshold
> are *the program's* parameters, not ours. We configure, we do not invent. If a specific curve
> shape is a product requirement rather than a preference, that pushes toward A and the timeline
> changes completely. **This needs confirming before any code is written.**

Everything below assumes **B, with Meteora DBC as the reference integration.** Raydium LaunchLab is
a near-identical swap-in; the structure of this plan does not change if we pick it.

---

## 2. What we build vs. what the program gives us

| Concern | Owner |
|---|---|
| Mint creation + metadata | **The curve program.** It creates the mint as part of the launch instruction. We do not hand-roll SPL mint creation, and we do not need Metaplex as a direct dependency. |
| Curve pricing, buys, sells | The curve program |
| Graduation + LP seeding | The curve program |
| Who may launch, and on which chain | **Us** (§7) |
| Launch metadata, discovery, search | **Us** (§4) |
| Creator allocation | **Us + program** — see §3 |
| Building, validating, signing and submitting every transaction | **Us**, through the existing intent pipeline (§5) |
| Showing a launched token in Markets / Trade | **Us** — it is a `SpotMarket` row (§8) |

---

## 3. Allocations, without vesting

The brief says allocations, no vesting. With a curve program, that means exactly one thing:

**A creator allocation is a creator pre-buy, executed atomically with the launch.** The creator's
tokens come off the same curve as everyone else's, at the curve's starting price, in the same
transaction that creates the pool. There is no separate mint and no locked tranche to release later,
which is precisely why "no vesting" is easy here.

Model it as a percentage of curve supply with a hard cap:

```ts
allocation: {
  creatorBps: number      // 0–2000, i.e. up to 20% of curve supply
  creatorLamports: string // what that pre-buy actually costs, quoted at build time
}
```

**Cap it and show it.** A creator who takes 40% of supply at the floor price and sells into the
first buyers is the single most common launchpad rug, and the number is public on-chain either way —
so it belongs on the launch screen, before anyone buys, not in a docs page. `creatorBps` is rendered
on the token page permanently.

---

## 4. Data model (backend)

One new collection. It is an **index over on-chain state, never the source of truth** — the same
discipline `SpotMarket` follows. If Mongo and the chain disagree, the chain is right and the row is
stale.

```ts
// src/models/TokenLaunch.ts
export type TokenLaunchStatus =
  | 'draft'        // created in our UI, nothing on-chain yet
  | 'deploying'    // launch tx signed and submitted, awaiting confirmation
  | 'live'         // on the curve, tradable
  | 'graduating'   // threshold reached, migration submitted
  | 'graduated'    // AMM pool live, curve closed
  | 'failed'       // deploy reverted; terminal

export interface ITokenLaunch {
  launchId: string              // our id, stable across the whole lifecycle
  userId: ObjectId              // creator
  walletId: ObjectId
  accountId: ObjectId

  chainFamily: 'solana'         // widened to 'evm' | 'intertrain' later
  networkId: string             // 'solana-mainnet-beta'

  name: string
  symbol: string
  description?: string
  iconUrl?: string
  links?: { website?: string; x?: string; telegram?: string }

  // On-chain identity — absent until 'live'
  mint?: string
  poolAddress?: string
  curveConfig?: string          // the program's config account

  allocation: { creatorBps: number; creatorLamports?: string }

  // Denormalised curve state, refreshed by the worker in §6
  curve?: {
    solRaised: string           // lamports
    tokensSold: string          // base units
    progressBps: number         // 0–10000 toward graduation
    graduationLamports: string  // the threshold, copied at launch
  }

  graduation?: { migratedAt: Date; ammPoolAddress: string; txHash: string }

  deployIntentIds: string[]     // ties the lifecycle back to the ledger
  status: TokenLaunchStatus
  failureReason?: string
  createdAt: Date
  updatedAt: Date
}
```

**Indexes:** `{ launchId }` unique · `{ mint }` sparse unique · `{ userId, createdAt: -1 }` ·
`{ status, networkId }` · `{ networkId, 'curve.progressBps': -1 }` for the discovery feed.

Add these to `src/scripts/verifyIndexes.ts` in the same commit. Every other model in this repo is
listed there and a new collection that is not becomes invisible to the index check.

---

## 5. The flows

All four reuse the existing pipeline, unchanged: **create intent → validate → simulate → client signs
on device → submit → reconcile.** Nothing about the launchpad needs a new signing path, which is the
main reason this is a weeks-long project and not a quarter-long one.

### 5.1 Create a launch

```
POST /launchpad/launches            → { launchId }              (draft, no chain contact)
POST /launchpad/launches/:id/deploy → { intents: [...] }         (unsigned)
POST /transactions/intents/:id/submit                            (existing route, unchanged)
```

`deploy` builds the launch transaction through the curve SDK and wraps it exactly as
`jupiter.ts:52` does:

```ts
TransactionIntent.create({
  userId, walletId, accountId,
  chainFamily: 'solana',
  networkId: network.networkId,
  intentType: 'chain-specific',
  intentPayload: { type: 'launchpad-create', launchId, symbol, creatorBps },
  normalizedSummary: {
    action: 'launchpad-create',
    chainFamily: 'solana',
    networkId: network.networkId,
    from: account.canonicalAddress,
    to: account.canonicalAddress,
    asset: { kind: 'token', identifier: mint },
    amount: creatorLamports ?? '0',
  },
  unsignedTransaction: unsigned,
  validationResult: validation,
  simulationResult: simulation,
  status: 'awaiting_signature',
  idempotencyKey: body.idempotencyKey,
  expiresAt: new Date(Date.now() + env.TRANSACTION_INTENT_TTL_SECONDS * 1000),
})
```

**The mint keypair is a problem worth naming.** A new mint usually needs its own keypair to sign the
create instruction, and our wallet only signs with the user's account key. Two ways out, in order of
preference:

1. **Use a program that derives the mint as a PDA** — no extra signer, nothing to store. Check this
   first; if the chosen program does this, the problem disappears entirely.
2. **Generate the mint keypair server-side, sign that one instruction server-side, and have the user
   sign as fee payer and authority.** The mint keypair is throwaway — it has no authority after
   creation — but it is still a private key our server touched, so it is never persisted and never
   logged.

> **This is the first thing to prototype.** It decides whether §5.1 is simple or fiddly, and it is
> answerable in an afternoon against devnet.

### 5.2 Buy / sell on the curve

```
POST /launchpad/launches/:id/buy   { amountLamports, slippageBps } → { intents }
POST /launchpad/launches/:id/sell  { amountBaseUnits, slippageBps } → { intents }
```

Same intent shape, `action: 'launchpad-buy' | 'launchpad-sell'`. Quote from the curve program's own
math — **never from our own reimplementation of the curve.** If we compute an expected output and
the program computes another, the user sees one number and gets a different one, which is the exact
class of fault this codebase has been cleaning up everywhere else.

`slippageBps` is mandatory on both. A curve buy with no floor is a free option for anyone watching
the mempool.

### 5.3 Graduation

Threshold reached → the program allows migration. Migration is permissionless in both candidate
programs, so **a worker triggers it; it is not the user's job to notice.**

Status moves `live → graduating → graduated`. The row keeps `ammPoolAddress` and the migration hash
so the token page can show where the liquidity actually went.

### 5.4 Reconciliation

A launch outlives the browser tab that started it, exactly like a bridge. Reuse that shape: a
`launchpad` worker on a 30s interval that reads pool accounts for every `deploying | live |
graduating` row, updates `curve`, and advances status. On `deploying`, confirm the mint exists before
declaring `live` — a submitted transaction is not a landed one.

---

## 6. Workers

```
src/workers/launchpadReconciler.ts   // curve state + status transitions, 30s
src/workers/launchpadGraduator.ts    // fires migration when progressBps >= 10000
```

Both follow `spotMarketRegistry.ts`: an `enabled` env flag, an initial delay, `unref()`ed timers, and
a `running` guard so a slow pass never overlaps itself.

```
LAUNCHPAD_ENABLED=false                  # master switch, default off
LAUNCHPAD_RECONCILER_ENABLED=false
LAUNCHPAD_GRADUATION_ENABLED=false
LAUNCHPAD_CURVE_PROGRAM_ID=...
LAUNCHPAD_FEE_BPS=100
LAUNCHPAD_MAX_CREATOR_BPS=2000
```

> Set these defaults to `false` deliberately. `SPOT_MARKET_REGISTRY_ENABLED` defaults false and that
> is why the spot registry is empty in production today — a default-off flag is invisible until
> someone goes looking. **Add all of these to the deploy runbook in the same PR that adds the flag.**

---

## 7. Per-chain availability

The brief asks for chains to be "selectively pushed out". Do **not** add a new bespoke mechanism —
extend `OperationalControl`, which already exists as a DB-backed kill switch behind
`SystemControlService`:

```ts
key: 'wallet_operations'
  | 'launchpad_solana'
  | 'launchpad_ethereum'
  | 'launchpad_intertrain'
```

Why this and not an env var: **it flips without a redeploy.** If a curve program is exploited on a
Tuesday afternoon, "edit env, rebuild image, recreate container" is the wrong response time. It also
gives `reason` and `updatedBy` for free, and the frontend can render the reason instead of a dead
button.

Three states per chain, and the UI must distinguish them:

| State | Meaning | UI |
|---|---|---|
| Not built | No adapter for this chain yet | Greyed row, "Soon" — the pattern already in the sidebar |
| Built, paused | Adapter exists, control paused | Visible, disabled, **shows `reason`** |
| Live | Available | Normal |

"Not built" and "paused" looking identical is how a support ticket gets opened about a feature that
was switched off on purpose.

---

## 8. Making a launched token tradable

A graduated token should appear in Markets and Trade like anything else. It is a `SpotMarket` row —
`active`, `chartSupported`, `priceUsd > 0`, which is the filter `/trading/spot/markets` already uses.

On graduation, the worker writes the `SpotMarket` row with `venue: 'jupiter'`, `baseToken: mint`,
`quoteToken: USDC`. Nothing on the frontend needs to change: the registry is already the catalogue
for both screens.

**Do not list a token while it is still on the curve.** The trade screen routes through Jupiter, and
a pre-graduation token has no Jupiter route — it would show up, be clickable, and fail at quote time.

---

## 9. Frontend

Routes, following the shape of the pages already shipped:

```
/launchpad                    discovery — live curves, ranked by progress
/launchpad/create             the create form
/launchpad/[launchId]         token page — curve chart, buy/sell ticket, progress, creator allocation
```

Components mirror the swap ticket, because a curve buy *is* a swap with one side fixed:

```
components/launchpad/
  launch-card.tsx        one launch in the discovery grid
  create-form.tsx        landscape: form left, live preview + cost summary right
  curve-chart.tsx        price vs supply, with the current point marked
  curve-ticket.tsx       buy/sell — reuse the swap ticket's two-pane shape
  progress-rail.tsx      raised / threshold, with the real numbers
  launch-history.tsx     a creator's own launches, from the ledger
```

**Reuse, do not re-invent:** `CardShell` + `CARD_HUE`, `SectionRule`, `AmountField`, `FlowCta`,
`StatusScreen`, `DetailPanel`, the `FundingLayout` two-pane shell from the futures doors, and
`QuoteClock` for the quote countdown. The design language is settled; this screen should not
introduce a dialect.

Sidebar: `Launchpad` is already listed as `soon: true` in `components/app-sidebar.tsx`. Shipping it
is deleting that flag and pointing `url` at `/launchpad`.

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Curve program is exploited | Per-chain `OperationalControl` pause, reachable in seconds without a deploy |
| Creator rug via oversized allocation | `LAUNCHPAD_MAX_CREATOR_BPS` enforced server-side; `creatorBps` shown permanently on the token page |
| Our quote disagrees with the program's | Quote *only* from the program's own math — never a local reimplementation |
| Graduation stalls | `launchpadGraduator` retries with backoff; `graduating` is a visible state, not a silent one |
| A launch outlives the tab | Reconciler worker owns state, exactly like the bridge |
| Mint keypair handling | Prefer PDA-derived mints; if impossible, ephemeral server keypair, never persisted or logged |
| Name/symbol impersonation | Deny-list of existing listed symbols at draft time; the check is cheap and the alternative is a fake USDC on our own launchpad |

---

## 11. Phasing

Each phase ends somewhere shippable. Nothing here is "build it all then test it".

**Phase 0 — Spike (2–3 days).** Devnet. Create one token through the chosen program end to end, from
a script. Answer: does the mint need its own signer? What are the real curve parameters? What does
graduation actually cost? **Do not skip this** — it decides §5.1 and the timeline.

**Phase 1 — Create, backend.** `TokenLaunch` model, `POST /launches`, `POST /:id/deploy`, adapter
allowlist, reconciler. Devnet only, flags off. Done when a token can be created by curl and confirms.

**Phase 2 — Create, frontend.** `/launchpad/create`, the launch's own status screen, `/launchpad/[id]`
read-only. Done when a token can be launched from the UI on devnet.

**Phase 3 — Trade the curve.** Buy/sell routes, curve ticket, curve chart, progress rail. Done when
a second user can buy on devnet and the creator can sell.

**Phase 4 — Graduation.** Graduator worker, `SpotMarket` write-through, AMM link on the token page.
Done when a devnet token graduates and appears in Markets.

**Phase 5 — Discovery + mainnet.** `/launchpad` feed, symbol deny-list, `OperationalControl` wiring,
runbook entry. Done when the Solana control can be flipped on in production.

Ethereum reuses Phases 1–5 with a different adapter and program. Intertrain is last, and cannot be
scoped until the question below is answered.

---

## 12. Open questions

These block specific phases and are not things I can answer from the code.

1. **Is a custom curve shape a product requirement, or is a configured standard curve acceptable?**
   Blocks §1. If custom, this is a Rust project with an audit and the estimate changes completely.
2. **Meteora DBC or Raydium LaunchLab?** Blocks Phase 0. Comparable; pick on fee terms and whichever
   has the healthier TS SDK today.
3. **What is our fee, and who pays it** — creator at launch, a cut of curve volume, or both?
   Blocks Phase 1's config.
4. **Who may launch?** Anyone with a wallet, or KYC-gated? Blocks Phase 5 and possibly Phase 1's
   authorisation check.
5. **What does launching on Intertrain mean?** Is there a token standard, a factory, an RPC method?
   Blocks all Intertrain work. If the answer is "nothing yet", Intertrain is a chain project before
   it is a launchpad project.
6. **Do we moderate names, icons and links?** Someone will launch something ugly on day one.

---

## 13. What this plan does not cover

Stated so nobody discovers it mid-build:

- **Vesting** — explicitly out of scope per the brief. If it returns, it is a program capability
  question first, not a UI question.
- **Ethereum and Intertrain adapters** — structure applies, specifics do not.
- **Secondary-market fee capture** after graduation.
- **Airdrops, allowlists, or presale rounds** — a curve with a creator pre-buy is the whole of v1.
- **The legal position.** Running a token launchpad has a regulatory surface well beyond the wallet.
  That question is not mine to answer and is not answered here.
