/**
 * Clerk has one primary authentication host and may have one or more
 * satellite applications. The crypto dashboard is deployed on
 * dashboard.worldstreetgold.com, while the primary sign-in surface remains on
 * www.worldstreetgold.com.
 *
 * Keep this configuration build-time/public only. Clerk's secret key never
 * belongs here.
 */

function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function configuredHost(value: string | undefined): string | undefined {
  value = configuredValue(value)
  if (!value) return undefined
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function configuredOrigin(value: string | undefined): string | undefined {
  value = configuredValue(value)
  if (!value) return undefined
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

const appHost = configuredHost(process.env.NEXT_PUBLIC_APP_URL)
const appOrigin = configuredOrigin(process.env.NEXT_PUBLIC_APP_URL)
const explicitSatellite = configuredValue(
  process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE
)

export const CLERK_IS_SATELLITE =
  explicitSatellite === "true" ||
  (explicitSatellite !== "false" &&
    process.env.NODE_ENV === "production" &&
    appHost === "dashboard.worldstreetgold.com")

export const CLERK_DOMAIN =
  configuredValue(process.env.NEXT_PUBLIC_CLERK_DOMAIN) ?? "worldstreetgold.com"

export const CLERK_SIGN_IN_URL =
  configuredValue(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL) ??
  (CLERK_IS_SATELLITE ? "https://www.worldstreetgold.com/login" : "/login")

export const CLERK_SIGN_UP_URL =
  configuredValue(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL) ??
  (CLERK_IS_SATELLITE
    ? "https://www.worldstreetgold.com/register"
    : "/register")

export const CLERK_AFTER_SIGN_IN_URL =
  configuredValue(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL) ??
  (CLERK_IS_SATELLITE ? "https://dashboard.worldstreetgold.com/" : "/")

export const CLERK_AFTER_SIGN_UP_URL =
  configuredValue(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL) ??
  (CLERK_IS_SATELLITE ? "https://dashboard.worldstreetgold.com/" : "/")

/**
 * The public origin to use when middleware constructs a return URL. In this
 * deployment the app sits behind a TLS passthrough proxy, so Next can see its
 * internal 0.0.0.0:3000 origin instead of the browser-facing hostname.
 */
export const CLERK_APP_ORIGIN =
  process.env.NODE_ENV === "production"
    ? (appOrigin ??
      (CLERK_IS_SATELLITE
        ? "https://dashboard.worldstreetgold.com"
        : undefined))
    : undefined

const ALLOWED_REDIRECT_HOSTS = new Set([
  "dashboard.worldstreetgold.com",
  "www.worldstreetgold.com",
  "worldstreetgold.com",
])

/** Reject open-redirect values while allowing the two WorldStreet auth apps. */
export function safeClerkRedirect(
  value: string | null | undefined,
  origin: string
): string | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value, origin)
    if (parsed.origin === origin) return parsed.toString()
    if (parsed.protocol !== "https:") return undefined
    if (!ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase()))
      return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function clerkLoginUrl(
  returnTo?: string,
  origin = "http://localhost:3000"
): string {
  const url = new URL(CLERK_SIGN_IN_URL, origin)
  const safeReturnTo = safeClerkRedirect(returnTo, origin)
  if (safeReturnTo) url.searchParams.set("redirect_url", safeReturnTo)
  return url.toString()
}
