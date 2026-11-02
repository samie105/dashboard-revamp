import type { CopyOrder, Delegation, GrantInput, Leader, PreparedDelegation, Subscription, SubscriptionInput } from "./types"

export class CopyTradingError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "CopyTradingError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/copy-trading/${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  } catch {
    throw new CopyTradingError(0, "Couldn't reach the server. Check your connection and try again.")
  }
  const text = await res.text()
  let data: { error?: string } | null = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) throw new CopyTradingError(res.status, data?.error ?? `The server returned an error (${res.status}). Try again.`)
  return data as T
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export const copyTradingApi = {
  leaders: () => request<Leader[]>("leaders"),
  delegations: () => request<Delegation[]>("delegations"),
  prepareDelegation: (input: GrantInput) => send<PreparedDelegation>("POST", "delegations", input),
  activateDelegation: (id: string, signature: string) => send<{ delegationId: string; status: string }>("POST", `delegations/${id}/activate`, { signature }),
  revokeDelegation: (id: string, signature: string) => send<{ ok: true }>("POST", `delegations/${id}/revoke`, { signature }),
  subscriptions: () => request<Subscription[]>("subscriptions"),
  subscribe: (input: SubscriptionInput) => send<Subscription>("POST", "subscriptions", input),
  setSubscriptionStatus: (id: string, status: "active" | "paused") => send<Subscription>("PATCH", `subscriptions/${id}`, { status }),
  stopSubscription: (id: string) => send<{ ok: true }>("DELETE", `subscriptions/${id}`),
  orders: () => request<CopyOrder[]>("orders"),
}
