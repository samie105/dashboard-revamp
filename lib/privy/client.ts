import { PrivyClient } from "@privy-io/node"

if (!process.env.PRIVY_APP_ID) {
  throw new Error("PRIVY_APP_ID is not set")
}

if (!process.env.PRIVY_APP_SECRET) {
  throw new Error("PRIVY_APP_SECRET is not set")
}

export const privyClient = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
})
