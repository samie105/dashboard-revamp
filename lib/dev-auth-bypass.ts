/**
 * Dev-only auth bypass.
 *
 * The production Clerk instance is domain-locked to worldstreetgold.com, so
 * Clerk cannot initialize on localhost and every route dead-ends at /login.
 * Setting NEXT_PUBLIC_DEV_AUTH_BYPASS=true in .env.local mocks the auth seams
 * (middleware, AuthProvider, getAuthUser, verifyClerkJWT) with a fake user.
 *
 * Double-gated: the flag is inert unless NODE_ENV === "development", so
 * `next build` / deployed environments can never bypass auth even if the env
 * var leaks. External APIs (crypto-api, wallet-api) still reject the fake
 * token — expect empty data states, which is enough for frontend work.
 */

// On THIS branch (dev/mock-auth-bypass) the bypass is hard-enabled so the
// branch can be deployed as a shareable mock-data demo without any env
// configuration. This branch must NEVER be merged into master — the clean
// history lives on feat/frontend-dev, which contains none of this code.
export const DEV_AUTH_BYPASS: boolean = true

export const DEV_BYPASS_USER = {
  userId: "dev_bypass_user",
  email: "dev@localhost",
  firstName: "Dev",
  lastName: "User",
  imageUrl: "",
}
