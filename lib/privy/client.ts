import { PrivyClient } from "@privy-io/node"

const APP_ENV: Record<number, [string, string]> = {
  0: ["PRIVY_APP_ID", "PRIVY_APP_SECRET"],
  1: ["NEW_PRIVY_APP_ID", "NEW_PRIVY_APP_SECRET"],
  2: ["THIRD_PRIVY_APP_ID", "THIRD_PRIVY_APP_SECRET"],
  3: ["FOURTH_PRIVY_APP_ID", "FOURTH_PRIVY_APP_SECRET"],
}

export function getPrivyClient(privyType = 0) {
  const [idName, secretName] = APP_ENV[privyType] ?? APP_ENV[0]
  const appId = process.env[idName]
  const appSecret = process.env[secretName]
  if (!appId) throw new Error(`${idName} is not set`)
  if (!appSecret) throw new Error(`${secretName} is not set`)
  return new PrivyClient({ appId, appSecret })
}

if (!process.env.PRIVY_APP_ID) {
  throw new Error("PRIVY_APP_ID is not set")
}

if (!process.env.PRIVY_APP_SECRET) {
  throw new Error("PRIVY_APP_SECRET is not set")
}

export const privyClient = getPrivyClient(0)
