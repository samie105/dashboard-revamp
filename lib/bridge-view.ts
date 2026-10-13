/**
 * View-model helpers for the redesigned bridge page (components/bridge/
 * redesign). Pure, so the rules the screen states are tested.
 *
 * The bridge has ONE lane — USDC on Arbitrum One → WSK on Intertrain, 1:1 —
 * and the backend publishes no fee, limits, liquidity or ETA for it, so
 * nothing here invents one. What it does know comes from the ledger: each
 * bridge writes a `bridge-deposit` record (a first one also writes a
 * `bridge-approve` before it), with a status word and timestamps. The rules
 * for reading those are the old history card's (components/bridge/
 * bridge-history.tsx), unchanged.
 */

import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

export const settledOf = (status: string) => /confirm|success|complete/i.test(status)
export const failedOf = (status: string) => /fail|error|revert|cancel/i.test(status)

export type BridgeRow = {
  id: string
  amount: string | null
  status: string
  networkId: string
  txHash: string
  at: string | null
  /** When the ledger says it settled or failed. */
  endedAt: string | null
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined)

/**
 * The deposits are the transfers; an approval only matters while it is still
 * confirming with no deposit after it (the signature is done, nothing seems
 * to be moving, and the reason is the allowance).
 */
export function bridgeRows(records: CryptoTransactionRecord[]) {
  const deposits: BridgeRow[] = []
  let pendingApproval = false
  for (const record of records) {
    const action = text((record.summary ?? {}).action)
    if (action === "bridge-approve") {
      if (!settledOf(record.status) && !failedOf(record.status)) pendingApproval = true
      continue
    }
    if (action !== "bridge-deposit") continue
    deposits.push({
      id: record.id,
      amount: text((record.summary ?? {}).amount) ?? null,
      status: record.status,
      networkId: record.networkId ?? "",
      txHash: record.txHash ?? "",
      at: record.submittedAt ?? record.createdAt ?? null,
      endedAt: record.confirmedAt ?? record.failedAt ?? null,
    })
  }
  const inFlight = deposits.filter((d) => !settledOf(d.status) && !failedOf(d.status))
  const done = deposits.filter((d) => settledOf(d.status) || failedOf(d.status))
  return { inFlight, done, awaitingApproval: pendingApproval && inFlight.length === 0 }
}

/**
 * The three stages the old page named ("You sign on this device", "Arbitrum
 * reaches finality", "Intertrain mints your WSK"), and which one a deposit is
 * in. A record exists only once it is signed, so stage 0 is always done; a
 * settled deposit has cleared Arbitrum and is waiting on minting, which the
 * ledger doesn't report — so minting is shown as the current wait, never as
 * done.
 */
export const BRIDGE_STAGES = [
  { key: "sign", label: "Signed on this device", detail: "Approved locally — your key never left it" },
  { key: "source", label: "Confirming on Arbitrum One", detail: "Waiting for Arbitrum finality" },
  { key: "mint", label: "Minting on Intertrain", detail: "WSK is issued once Intertrain mints it" },
] as const

export function stageOf(status: string): number {
  if (failedOf(status)) return -1
  return settledOf(status) ? 2 : 1
}

/** "2m 15s" for how long a finished bridge took; null when it can't be told. */
export function tookLabel(row: Pick<BridgeRow, "at" | "endedAt">): string | null {
  if (!row.at || !row.endedAt) return null
  const ms = Date.parse(row.endedAt) - Date.parse(row.at)
  if (!Number.isFinite(ms) || ms < 0) return null
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

/** Relative time against a clock read in an effect (0 = not read yet). */
export function agoLabel(iso: string | null, now: number): string {
  if (!iso || now === 0) return ""
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ""
  const minutes = Math.max(0, Math.round((now - then) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}
