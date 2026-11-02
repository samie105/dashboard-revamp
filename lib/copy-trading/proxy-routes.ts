/**
 * What the dashboard may ask the copy-trading service for. Anything else is a
 * 404 — notably `internal/*`, which is the service's own ingestion surface and
 * must never be reachable from a browser.
 */
const ROUTES: Array<[method: string, pattern: RegExp]> = [
  ["GET", /^leaders$/],
  ["GET", /^delegations$/],
  ["POST", /^delegations$/],
  ["POST", /^delegations\/[\w-]+\/(activate|revoke)$/],
  ["GET", /^subscriptions$/],
  ["POST", /^subscriptions$/],
  ["PATCH", /^subscriptions\/[\w-]+$/],
  ["DELETE", /^subscriptions\/[\w-]+$/],
  ["GET", /^orders$/],
]

export function isAllowedCopyRoute(method: string, path: string): boolean {
  return ROUTES.some(([m, re]) => m === method && re.test(path))
}
