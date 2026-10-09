/**
 * View-model helpers for the redesigned launchpad (components/launchpad/
 * redesign). Pure, so the figures the screens state are tested.
 *
 * The rule the preview's own provenance list sets (components/launchpad-unauth/
 * launch-data.ts PROVENANCE): an assumed figure may not reach a live page.
 * So everything here comes off the backend's LaunchpadToken — name, symbol,
 * status, creator allocation, the curve's SOL raised / progress / graduation
 * target, the mint and createdAt. Price and market cap per launch are not in
 * the feed, and nothing here derives them.
 */

import type { LaunchpadToken } from "@/lib/crypto-backend/types"

/** Lamports (a base-unit string) as SOL; null when unusable. */
export function lamportsToSol(raw: string | undefined | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const n = Number(raw) / 1e9
  return Number.isFinite(n) ? n : null
}

/** The three states the screens draw; anything else keeps its own label. */
export type ViewStatus = "live" | "graduating" | "graduated" | "other"

export function viewStatus(status: LaunchpadToken["status"]): ViewStatus {
  return status === "live" || status === "graduating" || status === "graduated" ? status : "other"
}

export const STATUS_LABEL: Record<LaunchpadToken["status"], string> = {
  draft: "Draft",
  deploying: "Deploying",
  live: "On curve",
  graduating: "Graduating",
  graduated: "Graduated",
  failed: "Failed",
}

export type LaunchCardView = {
  id: string
  name: string
  symbol: string
  description: string | null
  iconUrl: string | null
  mint: string | null
  status: ViewStatus
  rawStatus: LaunchpadToken["status"]
  progressBps: number
  /** SOL raised, capped at the target for display; null without a curve. */
  solRaised: number | null
  graduationSol: number | null
  remainingSol: number | null
  creatorBps: number
  createdAt: string
}

export function cardView(t: LaunchpadToken): LaunchCardView {
  const raised = lamportsToSol(t.curve?.solRaised)
  const target = lamportsToSol(t.curve?.graduationLamports)
  return {
    id: t.launchId,
    name: t.name,
    symbol: t.symbol,
    description: t.description?.trim() || null,
    iconUrl: t.iconUrl || null,
    mint: t.mint || null,
    status: viewStatus(t.status),
    rawStatus: t.status,
    progressBps: t.status === "graduated" || t.status === "graduating" ? 10_000 : Math.max(0, Math.min(10_000, t.curve?.progressBps ?? 0)),
    solRaised: raised === null ? null : target !== null ? Math.min(raised, target) : raised,
    graduationSol: target,
    remainingSol: raised !== null && target !== null ? Math.max(0, target - raised) : null,
    creatorBps: t.allocation.creatorBps,
    createdAt: t.createdAt,
  }
}

/** The hero's three figures, over whichever launches have been read. */
export function heroStats(onCurve: LaunchCardView[] | undefined, graduated: LaunchCardView[] | undefined) {
  const all = [...(onCurve ?? []), ...(graduated ?? [])]
  // A launch can sit in both lists (graduating); count each once.
  const unique = [...new Map(all.map((v) => [v.id, v])).values()]
  return {
    onCurve: onCurve ? onCurve.filter((v) => v.status === "live").length : null,
    solRaised: onCurve || graduated ? unique.reduce((s, v) => s + (v.solRaised ?? 0), 0) : null,
    graduated: graduated ? graduated.filter((v) => v.status === "graduated").length : null,
  }
}

/** The live launch closest to graduation. */
export function spotlightOf(onCurve: LaunchCardView[] | undefined): LaunchCardView | null {
  return [...(onCurve ?? [])].filter((v) => v.status === "live").sort((a, b) => b.progressBps - a.progressBps)[0] ?? null
}

export type LaunchSort = "progress" | "newest"

export function sortAndSearch(rows: LaunchCardView[], query: string, sort: LaunchSort): LaunchCardView[] {
  const q = query.trim().toLowerCase()
  return rows
    .filter((v) => !q || v.name.toLowerCase().includes(q) || v.symbol.toLowerCase().includes(q))
    .sort((a, b) => (sort === "progress" ? b.progressBps - a.progressBps : Date.parse(b.createdAt) - Date.parse(a.createdAt)))
}

/** "37.4%" under 10%, "68%" above — the preview's label. */
export function progressLabel(bps: number, status: ViewStatus): string {
  if (status === "graduating") return "Full"
  if (status === "graduated") return "Graduated"
  return `${(bps / 100).toFixed(bps < 1000 ? 1 : 0)}%`
}

export function agoFrom(iso: string, now: number): string {
  if (!now) return ""
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (!Number.isFinite(m)) return ""
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  const d = Math.round(m / 1440)
  return d === 1 ? "yesterday" : `${d}d ago`
}
