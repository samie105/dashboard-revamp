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
 * var leaks. External APIs (crypto-api, wallet-api, the crypto backend) still
 * reject the fake token — expect empty/error data states, which is enough for
 * frontend work.
 *
 * This lives only on dev/self-custody-preview. Never merge this branch —
 * the clean history is feat/self-custody, which contains none of this code.
 */
export const DEV_AUTH_BYPASS: boolean =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"

export const DEV_BYPASS_USER = {
  userId: "dev_bypass_user",
  email: "dev@localhost",
  firstName: "Dev",
  lastName: "User",
  imageUrl: "",
}
