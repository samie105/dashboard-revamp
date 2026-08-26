# Backend docs snapshot

Vendored from `tomurashigaraki22/worldstreet-crypto-backend` @ `5a886608a2daa16ea38ee7ebe04ee754b8e5d837`
on 2026-08-26. These are reference copies for the self-custody integration —
the backend repo is canonical. Re-vendor when Tom changes the wallet package
schema (§7) or the signed-transaction encoding (§8.3), per the integration
guide's own drift warning.

## Local backend

Docker Desktop is not installed on this machine, so the backend's own
`docker-compose.yml` path was not used. What actually runs locally instead:

**MongoDB** — a portable MongoDB 8.0.12, no Docker, no auth. `.local-tools/`
is a sibling of both this repo and the backend clone, not inside either, so
run this from `C:\Users\owen\Downloads\Projects\worldstreet\` (separate
terminal, leave running):

```bash
.local-tools/mongodb-win32-x86_64-windows-8.0.12/bin/mongod.exe \
  --dbpath .local-tools/mongo-data --port 27017 --bind_ip 127.0.0.1
```

Listens unauthenticated on `127.0.0.1:27017`.

**Backend clone**, sibling of this repo at
`C:\Users\owen\Downloads\Projects\worldstreet\worldstreet-crypto-backend`:

```bash
cd /c/Users/owen/Downloads/Projects/worldstreet
gh repo clone tomurashigaraki22/worldstreet-crypto-backend
cd worldstreet-crypto-backend
cp .env.example .env
```

Then edit `.env`:
- `CLERK_AUTH_ENABLED=false` (example ships `=true`)
- `WALLET_AUTH_TOKEN_SECRET=` → a generated 32+ char random string (used `openssl rand -hex 32`)
- `SESSION_TOKEN_SECRET=` → a generated 32+ char random string (same method)
- `MONGODB_URI=mongodb://localhost:27017/worldstreet_crypto` — replaces the
  example's default, which embeds the `crypto_app` / `change_me_app_password`
  credentials plus an `authSource` query param, since the local mongod above
  has no auth

**`.env` quirk — comment out blank optional keys.** At snapshot `5a88660`,
`src/config/env.ts` declares several vars as `z.string().url().optional()` or
`.min(1).optional()`: `CLERK_SECRET_KEY`, `LEGACY_MONGODB_URI`, and every
`*_RPC_URL` / `*_FALLBACK_RPC_URL` except `SOLANA_RPC_URL` (which ships with a
value). Zod's `.optional()` accepts only `undefined`, not an empty string —
but `.env.example` ships every one of these as a bare `KEY=` line, and dotenv
parses that as `KEY=""`, not absent. The result: `npm run db:indexes`,
`npm run db:seed-networks`, and `npm run dev` all fail immediately at
`env.ts` module load, before ever touching Mongo. This is a backend
validation bug, not an environment problem — it reproduces on a clean
checkout with the example env file's own defaults, regardless of Docker vs.
host vs. portable Mongo. The workaround (config-only, no source edits): in
`.env`, comment out (prefix `#`) every blank `KEY=` line among the ones
above, leaving every line that already carries a value untouched. A blank
line that doesn't exist at all leaves the var `undefined`, which the
`.optional()` schemas accept.

**Install, index, seed:**

```bash
npm install
npm run db:indexes
npm run db:seed-networks
```

`db:seed-networks` upserts silently (no per-network console output — it just
logs Mongo connect/disconnect) but is idempotent and reliable; verified
directly against the `networks` collection: 9 documents total, exactly 3
`enabled: true` — `ethereum-sepolia`, `base-sepolia`, `solana-devnet` —
matching the three networks this doc set expects.

**Run** (leave this terminal running):

```bash
npm run dev
```

Expected: server listening on port 3020.

**Verify** (new terminal):

```bash
curl -s http://localhost:3020/health
curl -s http://localhost:3020/ready
curl -s -H "Authorization: Bearer dev" http://localhost:3020/v1/auth/me
curl -s -H "Authorization: Bearer dev" http://localhost:3020/v1/networks
```

Expected: health `{"success":true,...,"status":"ok"}`; ready shows
`"mongodb":"ready"`; auth/me returns a `dev_clerk_user` identity; networks
returns `success:true` with exactly `ethereum-sepolia`, `base-sepolia`, and
`solana-devnet`.
