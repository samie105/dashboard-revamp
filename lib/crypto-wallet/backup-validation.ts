import { WALLET_PACKAGE_FORMAT } from "./package-crypto"

/**
 * Backup restore validation (spec §12). A backup file is untrusted input —
 * it can be corrupted, stale, or (worst case) someone else's export dropped
 * into this browser by mistake. `validateBackup` is the single gate every
 * restore path runs through before anything is written to local storage.
 */

export const WALLET_BACKUP_FORMAT = "worldstreet-encrypted-wallet-backup-v1" as const

const GENERIC_PROBLEM = "That file isn't a Worldstreet backup."
const WRONG_WALLET_PROBLEM = "This backup belongs to a different wallet."
const TAMPERED_PROBLEM =
  "This backup's contents don't match its integrity checksum — the file may have been altered or is corrupted."
export const LEGACY_BACKUP_WARNING = "This backup predates integrity checks."

/**
 * Deterministic JSON serialization used ONLY to compute the integrity
 * checksum: object keys are sorted recursively so the same logical value
 * always produces the same bytes, independent of property insertion order.
 * The export path (`serializeEncryptedWalletPackage`) and this validation
 * path both run the package body through this exact function — that
 * symmetry is what makes the checksum meaningful. Never use this for
 * anything that round-trips back through `JSON.parse` (key order is lost).
 */
export function canonicalizeForChecksum(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeForChecksum).join(",")}]`
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeForChecksum(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** SHA-256 over the canonical JSON of a backup's package body, as lowercase hex. */
export async function computeBackupChecksum(packageValue: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeForChecksum(packageValue))
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export type BackupValidationResult = { ok: true; warnings: string[] } | { ok: false; problem: string }

/**
 * Validates an already-JSON-parsed backup file before any of it is written.
 * Callers are expected to catch `JSON.parse` failures themselves and surface
 * them with the same `GENERIC_PROBLEM` copy this function uses for other
 * unrecognizable input — see `previewWalletBackupRestore` in local-storage.ts.
 *
 * A backup exported before this checksum/userId scoping shipped carries
 * neither `checksum` nor `userId` (both were added to the wrapper together).
 * Such a backup is accepted — rejecting genuinely old backups outright would
 * strand users who made them in good faith — but only its wallet id can be
 * checked, so it comes back `ok: true` with `LEGACY_BACKUP_WARNING` in
 * `warnings` instead of a silent pass. A backup carrying a `checksum` is
 * assumed to be current-format and gets the full check: userId scoping and
 * a checksum recomputation over the canonical package body.
 */
export async function validateBackup(input: {
  backup: unknown
  expectedWalletId: string
  expectedUserId: string
}): Promise<BackupValidationResult> {
  const { backup, expectedWalletId, expectedUserId } = input

  if (!backup || typeof backup !== "object") return { ok: false, problem: GENERIC_PROBLEM }
  const file = backup as Record<string, unknown>

  if (typeof file.backupFormat !== "string" || !file.backupFormat) return { ok: false, problem: GENERIC_PROBLEM }
  if (file.backupFormat !== WALLET_BACKUP_FORMAT) {
    return {
      ok: false,
      problem: `This backup uses format "${file.backupFormat}", which this version of the app doesn't understand. Update the app and try again.`,
    }
  }

  if (!file.package || typeof file.package !== "object") return { ok: false, problem: GENERIC_PROBLEM }
  const pkg = file.package as Record<string, unknown>

  if (pkg.format !== WALLET_PACKAGE_FORMAT) return { ok: false, problem: GENERIC_PROBLEM }
  if (!Array.isArray(pkg.accounts) || pkg.accounts.length === 0) return { ok: false, problem: GENERIC_PROBLEM }
  if (!Array.isArray(pkg.envelopes) || pkg.envelopes.length === 0) return { ok: false, problem: GENERIC_PROBLEM }
  if (String(pkg.walletId) !== expectedWalletId) return { ok: false, problem: WRONG_WALLET_PROBLEM }

  const warnings: string[] = []
  const checksum = typeof file.checksum === "string" && file.checksum ? file.checksum : null

  if (!checksum) {
    warnings.push(LEGACY_BACKUP_WARNING)
    return { ok: true, warnings }
  }

  if (typeof file.userId !== "string" || file.userId !== expectedUserId) {
    return { ok: false, problem: WRONG_WALLET_PROBLEM }
  }

  const actual = await computeBackupChecksum(pkg)
  if (actual !== checksum) return { ok: false, problem: TAMPERED_PROBLEM }

  return { ok: true, warnings }
}
