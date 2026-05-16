// GMX v2 SDK initialization and shared config
import { GmxSdk } from "@gmx-io/sdk"

const ARBITRUM_CHAIN_ID = 42161
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614
const ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc"
const ARBITRUM_SEPOLIA_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc"
const GMX_ORACLE_URL = "https://arbitrum-api.gmxinfra.io"
const GMX_SUBSQUID_URL =
  "https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql"

const isTestnet = process.env.GMX_TESTNET === "true"
const chainId = isTestnet ? ARBITRUM_SEPOLIA_CHAIN_ID : ARBITRUM_CHAIN_ID
const rpcUrl =
  process.env.ARBITRUM_RPC_URL ??
  (isTestnet ? ARBITRUM_SEPOLIA_RPC_URL : ARBITRUM_RPC_URL)
const oracleUrl = process.env.GMX_ORACLE_URL ?? GMX_ORACLE_URL
const subsquidUrl = process.env.GMX_SUBSQUID_URL ?? GMX_SUBSQUID_URL

export const gmxSdk = new GmxSdk({
  chainId,
  oracleUrl,
  rpcUrl,
  subsquidUrl,
})

export { chainId as GMX_CHAIN_ID, isTestnet as GMX_IS_TESTNET }
