// GMX v2 SDK initialization and shared config
import { GmxSdk } from "@gmx-io/sdk"

const ARBITRUM_CHAIN_ID = 42161
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614

const isTestnet = process.env.GMX_TESTNET === "true"
const chainId = isTestnet ? ARBITRUM_SEPOLIA_CHAIN_ID : ARBITRUM_CHAIN_ID

export const gmxSdk = new GmxSdk({
  chainId,
  rpcUrl: process.env.ARBITRUM_RPC_URL,
})

export { chainId as GMX_CHAIN_ID, isTestnet as GMX_IS_TESTNET }
