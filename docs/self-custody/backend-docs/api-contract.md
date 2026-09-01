# Phase 0 API and Identity Contract

## Authentication boundary

The existing Worldstreet application authenticates users with Clerk. The crypto backend does not implement login, signup, password reset, OAuth, or Clerk session creation.

User-facing requests send:

```http
Authorization: Bearer <Clerk JWT>
```

The backend verifies the JWT using the configured Clerk issuer, audience, and JWKS URL. The Clerk `sub` claim is the stable external identity.

```ts
type AuthenticatedIdentity = {
  clerkUserId: string;
  userId: string;
  sessionId?: string;
  claims: Record<string, unknown>;
};
```

For the first implementation, `userId` is the Clerk `sub`. The database still stores a normalized `users` and `user_identities` model so a separate internal ID can be introduced later without changing wallet ownership APIs.

## Public endpoints implemented in Phases 0–2

```text
GET  /health
GET  /ready

GET  /v1/auth/me
POST /v1/wallets
GET  /v1/wallets/me
GET  /v1/networks

GET  /internal/v1/ping
```

The `/v1/*` routes require a valid Clerk token. The `/internal/*` route requires `x-internal-service-key` and is not a replacement for Clerk user authentication.

## Response shape

Successful responses use:

```json
{
  "success": true,
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  },
  "requestId": "..."
}
```

## Wallet ownership invariant

Every wallet lookup starts from the authenticated user identity. A caller cannot select an arbitrary `userId` or wallet ID and obtain another user's wallet by changing a URL parameter.

## Development-only auth bypass

`CLERK_AUTH_ENABLED=false` is accepted only when `NODE_ENV=development` or `NODE_ENV=test`. It uses the fixed identity `dev_clerk_user` and must never be used in staging or production.
