# Multi-stage build for the Next.js dashboard.
#
# WHY THIS EXISTS: Coolify was building with nixpacks, whose first step
# unpacks the whole nixpkgs tree into /nix/store. On a host that's already
# tight on disk that step alone fails with "No space left on device" before
# any application code is touched. A plain Docker build skips nix entirely —
# it pulls a ~200MB node:22-alpine base instead of materialising a nix store.
#
# It also produces a much smaller runtime image: Next's `standalone` output
# ships only the server and the modules it actually traced, so node_modules
# never reaches the final stage.

# ── deps ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable

# Copy only what the install needs, so this layer caches across code changes.
# The local file: dependency must be present or pnpm can't resolve it.
COPY package.json pnpm-lock.yaml ./
COPY packages/vivid-voice/package.json ./packages/vivid-voice/
RUN pnpm install --frozen-lockfile --prefer-offline

# ── build ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines NEXT_PUBLIC_* at build time, so they must be present here.
# Coolify passes them as build args; server-only secrets are injected at
# runtime instead and deliberately are NOT declared.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_SOL_RPC
ARG NEXT_PUBLIC_ETH_RPC
ARG NEXT_PUBLIC_ARB_RPC
ARG NEXT_PUBLIC_SUI_RPC_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run the server as root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
# `standalone` carries its own minimal node_modules; static/ is served from
# .next/static and is not included in it.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
