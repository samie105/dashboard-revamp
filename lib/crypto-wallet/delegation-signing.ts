import { privateKeyToAccount } from "viem/accounts"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

/**
 * Sign a copy-trading delegation, or its revocation.
 *
 * The typed data comes from a server, so this refuses to sign anything that is
 * not exactly a WorldStreet trade delegation for THIS wallet: a compromised or
 * confused service must not be able to get an unrelated EIP-712 message (a
 * token Permit, say) signed through this path.
 */
export const DELEGATION_DOMAIN_NAME = "WorldStreet Trade Delegation"

export interface TypedDataInput {
  domain: { name: string; version: string }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, string>
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("")}`
}

/** Throws unless the payload is a trade-only grant or revocation for `address`. */
export function assertSafeDelegationPayload(td: TypedDataInput, address: string) {
  if (td.domain?.name !== DELEGATION_DOMAIN_NAME) throw new Error("Refusing to sign: not a WorldStreet delegation")
  if (td.primaryType !== "Delegation" && td.primaryType !== "Revocation") throw new Error("Refusing to sign: unexpected message type")
  if (Object.keys(td.types).some((t) => t !== td.primaryType)) throw new Error("Refusing to sign: unexpected extra types")
  if (td.message.delegator?.toLowerCase() !== address.toLowerCase()) throw new Error("Refusing to sign: this grant is for a different wallet")
  if (td.primaryType === "Delegation" && td.message.scope !== "trade-only") throw new Error("Refusing to sign: scope is not trade-only")
  if (td.primaryType === "Revocation" && td.message.action !== "revoke") throw new Error("Refusing to sign: not a revocation")
}

export async function signDelegationTypedData(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  accountId: string,
  typedData: TypedDataInput,
): Promise<`0x${string}`> {
  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const account = privateKeyToAccount(bytesToHex(secret))
    assertSafeDelegationPayload(typedData, account.address)
    const fields = typedData.types[typedData.primaryType]
    const message = Object.fromEntries(fields.map((f) => [f.name, f.type.startsWith("uint") ? BigInt(typedData.message[f.name]) : typedData.message[f.name]]))
    return await account.signTypedData({ domain: typedData.domain, types: typedData.types, primaryType: typedData.primaryType, message })
  } finally {
    wipeBytes(secret)
  }
}

/** The revocation message for a delegation; sign it with signDelegationTypedData. */
export function revocationTypedData(delegator: string, delegationId: string): TypedDataInput {
  return {
    domain: { name: DELEGATION_DOMAIN_NAME, version: "1" },
    types: { Revocation: [{ name: "delegator", type: "address" }, { name: "delegationId", type: "string" }, { name: "action", type: "string" }] },
    primaryType: "Revocation",
    message: { delegator: delegator.toLowerCase(), delegationId, action: "revoke" },
  }
}
