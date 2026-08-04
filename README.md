# WorldStreet Dashboard

The crypto dashboard behind **www.worldstreetgold.com** — balances, transfers,
spot and futures trading, swaps, transactions, community chat and calls, and
Vivid (the voice agent).

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 +
shadcn/ui · Clerk · Privy · MongoDB.

> **The code is the source of truth.** This file is a map to it, kept honest
> against the tree on 2026-08-04. Anything in [docs/archive/](docs/archive/README.md)
> describes a version of this app that no longer exists.

---

## Quickstart

```bash
pnpm install
```

Copy the environment (see [Environment](#environment) — `.env.example` is out
of date), then:

```bash
pnpm dev
```

The dev server is pinned to **port 3200** by [.claude/launch.json](.claude/launch.json).
Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`,
`pnpm format`.

You need a Clerk session to see anything — every route except `/login` and
`/register` is gated at three layers (middleware, `AuthGate`, and the API
proxy). In production an unauthenticated visit bounces to the hub's login page.

---

## The one thing to understand first

This dashboard **owns almost no backend**. Commit `7300099` rebuilt it as a
client of the standalone `worldstreet-crypto` service, mirroring how the mobile
app works. The only real API routes left in `app/api/` are Vivid's.

Data reaches the UI down **two separate paths**, and knowing which one you're
on explains most of the codebase:

**1. Through the proxy — anything user-specific or money-moving.**

```
component → lib/crypto-api.ts → /api/*  →  app/api/[...path]/route.ts
                                            ├── worldstreet-crypto  (CRYPTO_API_URL)
                                            └── worldstreet-wallet   (WALLET_API_URL)
                                                └── only GET dollar/balances
```

[app/api/[...path]/route.ts](app/api/%5B...path%5D/route.ts) swaps the browser's
Clerk session cookie for the bearer token the services expect. Its `FORWARDED`
allowlist is deliberately exact-match by default — a trailing slash means
"prefix", anything else must match exactly, so a bare `swap` entry can't
silently capture a future `swap-history`. Read the header comment before adding
to it; the migration protocol (add the entry in the same change that deletes
the local route, never before) is written there.

[lib/crypto-api.ts](lib/crypto-api.ts) is the typed client over that surface,
mirroring the mobile app's `src/features/crypto/api/index.ts` 1:1 so both
clients share one contract.

**2. Direct from this app — public market data.**

- [lib/actions.ts](lib/actions.ts) — server actions calling CoinGecko and
  Hyperliquid for prices, spot/futures markets, klines and forex. Feeds the
  dashboard, portfolio, markets and swap screens.
- [lib/hl-public.ts](lib/hl-public.ts) — Hyperliquid's public info API,
  unauthenticated, straight from the client. Feeds the trade page's order book
  and candles.

Collapsing path 2 fully into the mobile app's shape is the unfinished half of
Phase 4 in [plans/crypto-service-migration.md](plans/crypto-service-migration.md).

---

## Auth

Clerk, and one detail that has bitten before: **this app is the primary Clerk
domain** — sign-in actually happens here. It must never declare
`isSatellite`/`domain`, which made it a satellite of itself and hung every
visit on "Verifying identity…" waiting for a handshake with itself. The comment
at [app/layout.tsx:45](app/layout.tsx:45) guards this. Satellite config belongs
on academy/vision/arcade, which point back here.

Three gates, in order: [middleware.ts](middleware.ts) (server, redirects to the
hub login), [components/auth-gate.tsx](components/auth-gate.tsx) (client shell),
and the proxy's own token check.

## Wallets

Privy custody, provisioned server-side across five chains (ethereum, solana,
sui, ton, tron; Arbitrum reuses the Ethereum address, so six *receivable*
networks over five keys). [components/wallet-provider.tsx](components/wallet-provider.tsx)
holds the client-side state; [lib/privy/](lib/privy) holds the per-chain
signing, gas sponsorship and authorization.

**Privy is sharded across three apps.** New signups land in whichever app
`SIGNUP_PRIVY_TYPE` points at ([lib/wallet-actions.ts:10](lib/wallet-actions.ts:10)) —
bumped each time an app hits Privy's account limit. Existing users keep their
`privyType`, so all three sets of credentials must stay configured.

## Design system

Real, and unusually strict — a port of the mobile app's grammar, measured off a
live simulator rather than guessed.

- [app/globals.css](app/globals.css) — tokens. Warm stone ladder in dark
  (`#0C0A09` canvas → `#141110` sunken → `#1C1917` card → `#292524` raised) and
  semantic money colours (`--credit` / `--debit` / `--warning` plus chip tints,
  retuned per theme so both clear the contrast floor).
- [components/ui/system.tsx](components/ui/system.tsx) — the primitives, with
  the house rules in the header comment: colour carries meaning only, cards
  separate by fill rather than outline, every figure tabular, no decorative
  leading icons, active segments are neutral raised fill and never gold.
- [components/ui/flow.tsx](components/ui/flow.tsx) — shared chrome for every
  money-movement flow (buy, sell, fund, withdraw, swap): amount-as-hero, CTAs
  that state their blocker instead of sitting silently disabled, staged
  progress instead of a spinner.

New surfaces should compose these, not re-invent them. See
[DESIGN-PARITY-PLAN.md](DESIGN-PARITY-PLAN.md) for the spec they implement.

---

## Layout of the repo

| Path | What's in it |
|---|---|
| `app/` | Routes. Most pages are thin — a `Suspense` boundary around a client component in `components/`. |
| `app/api/[...path]/` | The proxy. Read its header comment first. |
| `app/api/vivid/` | The only real local API: voice token minting, chat conversations, function calls. |
| `components/ui/` | Design system + shadcn primitives. |
| `components/<feature>/` | One folder per surface: `dashboard`, `assets`, `portfolio`, `trade`, `trading`, `swap`, `fund`, `buy-sell`, `transactions`, `community`, `vivid`. |
| `lib/` | `actions.ts` (market data), `crypto-api.ts` (service client), `privy/`, `community/`, `vivid-functions.ts`. |
| `hooks/` | Data hooks — balances, positions, unified transactions, chat. |
| `models/` | Mongoose schemas. Only what the dashboard still writes: profiles, community chat and calls, wallet records, swap and transfer history. |
| `packages/vivid-voice/` | Local workspace package — the voice agent SDK (`@worldstreet/vivid-voice`), consumed pre-built from `dist/`. |
| `plans/` | Live plans. |
| `docs/archive/` | Superseded — see [its index](docs/archive/README.md). |

### Routes

`/` dashboard · `/portfolio` · `/assets` · `/transactions` · `/swap` ·
`/buy` · `/sell` · `/fund` · `/trading-withdraw` · `/trading/markets` ·
`/community` · `/vivid` · `/trade` (spot **and** futures, selected by
`?market=`) · `/auto-trade`.

`/trade` and `/vivid` render full-bleed with no sidebar or navbar
([components/layout-shell.tsx](components/layout-shell.tsx)). Legacy paths
(`/spotv2`, `/futures`, `/deposit`, `/withdraw`, `/transfer`) and the
not-yet-built account pages redirect from [next.config.mjs](next.config.mjs).

### Other services

Community runs on Cloudflare RealtimeKit (video calls), Ably (realtime
messaging) and R2 (uploads). Vivid runs on the OpenAI Realtime API.

---

## Environment

`.env.example` predates the rebuild: it still lists Flutterwave, Tron and GMX
variables that nothing reads, and misses several the code requires. **It also
contains real credentials that need rotating** — see Phase 5 of
[plans/crypto-service-migration.md](plans/crypto-service-migration.md).

What the code actually reads today:

| Group | Variables |
|---|---|
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| Services | `CRYPTO_API_URL`, `WALLET_API_URL`, `ADMIN_BACKEND_URL`, `ADMIN_BACKEND_API_KEY` |
| Database | `MONGODB_URI` |
| Privy (×3 apps) | `PRIVY_APP_ID`/`PRIVY_APP_SECRET`, `NEW_PRIVY_APP_ID`/`NEW_PRIVY_APP_SECRET`, `THIRD_PRIVY_APP_ID`/`THIRD_PRIVY_APP_SECRET`, `GAS_SPONSORSHIP_ENABLED` |
| Community | `ABLY_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_REALTIME_API_KEY`, `CLOUDFLARE_REALTIME_ORG_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| Vivid | `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL` |
| RPC | `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_SUI_RPC_URL` |

Server-only secrets are injected at runtime. Only `NEXT_PUBLIC_*` is needed at
build time, because Next inlines it — the Dockerfile declares exactly those as
build args and deliberately declares no secrets.

## Deployment

Coolify, from the hand-written [Dockerfile](Dockerfile) — multi-stage, pnpm
with a frozen lockfile, Next `standalone` output, non-root runtime. It exists
because nixpacks unpacked the whole nixpkgs tree into `/nix/store` and ran the
host out of disk before touching any application code. Don't reintroduce
nixpacks.

---

## Documentation

**Current**

- [plans/crypto-service-migration.md](plans/crypto-service-migration.md) — the
  live architectural plan. Phases 1–4 landed; Phase 5 (delete the proxy, drop
  the chain SDKs, rotate secrets) has not. Its open decisions are still open.
- [PRD_SPONSORED_FEES.md](PRD_SPONSORED_FEES.md) +
  [plans/sponsored-fees.md](plans/sponsored-fees.md) — gas sponsorship, shipped.
- [DESIGN-PARITY-PLAN.md](DESIGN-PARITY-PLAN.md) — the mobile grammar the design
  system implements. All six stages landed.
- [REMB.md](REMB.md) — the Remb context CLI (`.remb.yml`). `CLAUDE.md` is
  generated by it and gitignored.

**Historical** — [docs/archive/](docs/archive/README.md): the pre-rebuild
project guide, the SpotV2 ledger engine, the Flutterwave fiat ramp, and the GMX
integration that was never built. The index says what each one got wrong.
