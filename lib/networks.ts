/**
 * Networks the wallet can receive on — mirrors the mobile app's
 * `features/crypto/ui/chains.ts` NETWORKS registry exactly.
 *
 * This list is deliberately hardcoded: it is DISPLAY metadata, not data. The
 * value on each chip comes from the live balances feed.
 *
 * EVM L2s reuse the ethereum wallet's address (`chain` says which wallet-record
 * address a network reads), mirroring how MetaMask repeats the 0x address per
 * network — which is why there are 6 networks but only 5 wallet addresses.
 */

/** The wallet-record chains we actually hold keys on. */
export type WalletChain = "ethereum" | "solana" | "sui" | "ton" | "tron"

export type NetworkMeta = {
  key: string
  label: string
  /** Which wallet-record chain supplies this network's address. */
  chain: WalletChain
  /** Coin whose logo in the price feed doubles as the network mark. */
  nativeSymbol: string
  hue: string
  explorerName: string
  explorerUrl: (address: string) => string
  txUrl: (hash: string) => string
}

export const NETWORKS: NetworkMeta[] = [
  {
    key: "ethereum",
    label: "Ethereum",
    chain: "ethereum",
    nativeSymbol: "ETH",
    hue: "#627EEA",
    explorerName: "Etherscan",
    explorerUrl: (a) => `https://etherscan.io/address/${a}`,
    txUrl: (h) => `https://etherscan.io/tx/${h}`,
  },
  {
    key: "arbitrum",
    label: "Arbitrum",
    chain: "ethereum",
    nativeSymbol: "ETH",
    hue: "#2D374B",
    explorerName: "Arbiscan",
    explorerUrl: (a) => `https://arbiscan.io/address/${a}`,
    txUrl: (h) => `https://arbiscan.io/tx/${h}`,
  },
  {
    key: "solana",
    label: "Solana",
    chain: "solana",
    nativeSymbol: "SOL",
    hue: "#9945FF",
    explorerName: "Solscan",
    explorerUrl: (a) => `https://solscan.io/account/${a}`,
    txUrl: (h) => `https://solscan.io/tx/${h}`,
  },
  {
    key: "sui",
    label: "Sui",
    chain: "sui",
    nativeSymbol: "SUI",
    hue: "#4DA2FF",
    explorerName: "Suiscan",
    explorerUrl: (a) => `https://suiscan.xyz/mainnet/account/${a}`,
    txUrl: (h) => `https://suiscan.xyz/mainnet/tx/${h}`,
  },
  {
    key: "ton",
    label: "TON",
    chain: "ton",
    nativeSymbol: "TON",
    hue: "#0098EA",
    explorerName: "Tonviewer",
    explorerUrl: (a) => `https://tonviewer.com/${a}`,
    txUrl: (h) => `https://tonviewer.com/transaction/${h}`,
  },
  {
    key: "tron",
    label: "Tron",
    chain: "tron",
    nativeSymbol: "TRX",
    hue: "#FF060A",
    explorerName: "Tronscan",
    explorerUrl: (a) => `https://tronscan.org/#/address/${a}`,
    txUrl: (h) => `https://tronscan.org/#/transaction/${h}`,
  },
]

/** CoinGecko marks for the native coin of each network. */
export const NETWORK_ICON: Record<string, string> = {
  ethereum: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",
  arbitrum: "https://coin-images.coingecko.com/coins/images/16547/small/arb.jpg",
  solana: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
  sui: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
  ton: "https://coin-images.coingecko.com/coins/images/17980/small/photo_2024-09-10_17.09.00.jpeg",
  tron: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",
}
