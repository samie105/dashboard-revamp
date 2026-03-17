import { privyClient } from "./client"

export interface UserWallets {
  ethereum: {
    id: string
    address: string
    chainType: "ethereum"
  }
  solana: {
    id: string
    address: string
    chainType: "solana"
  }
  sui: {
    id: string
    address: string
    chainType: "sui"
  }
  ton: {
    id: string
    address: string
    chainType: "ton"
  }
  tron: {
    id: string
    address: string
    chainType: "tron"
  }
}

/**
 * Create all 5 chain wallets for a Privy user
 */
export async function createUserWallets(
  privyUserId: string,
): Promise<UserWallets> {
  const [ethWallet, solWallet, suiWallet, tonWallet, tronWallet] =
    await Promise.all([
      privyClient.wallets().create({
        chain_type: "ethereum",
        owner_id: privyUserId,
      }),
      privyClient.wallets().create({
        chain_type: "solana",
        owner_id: privyUserId,
      }),
      privyClient.wallets().create({
        chain_type: "sui",
        owner_id: privyUserId,
      }),
      privyClient.wallets().create({
        chain_type: "ton",
        owner_id: privyUserId,
      }),
      privyClient.wallets().create({
        chain_type: "tron",
        owner_id: privyUserId,
      }),
    ])

  return {
    ethereum: {
      id: ethWallet.id,
      address: ethWallet.address,
      chainType: "ethereum",
    },
    solana: {
      id: solWallet.id,
      address: solWallet.address,
      chainType: "solana",
    },
    sui: {
      id: suiWallet.id,
      address: suiWallet.address,
      chainType: "sui",
    },
    ton: {
      id: tonWallet.id,
      address: tonWallet.address,
      chainType: "ton",
    },
    tron: {
      id: tronWallet.id,
      address: tronWallet.address,
      chainType: "tron",
    },
  }
}

/**
 * Get all wallets for a Privy user
 */
export async function getUserWallets(privyUserId: string) {
  const walletsCursor = await privyClient.wallets().list({
    user_id: privyUserId,
  })

  const walletList: { id: string; address: string; chain_type: string; public_key?: string }[] = []
  for await (const wallet of walletsCursor) {
    walletList.push(wallet)
  }

  const ethereum = walletList.find((w) => w.chain_type === "ethereum")
  const solana = walletList.find((w) => w.chain_type === "solana")
  const sui = walletList.find((w) => w.chain_type === "sui")
  const ton = walletList.find((w) => w.chain_type === "ton")
  const tron = walletList.find((w) => w.chain_type === "tron")

  return {
    ethereum: ethereum
      ? {
          id: ethereum.id,
          address: ethereum.address,
          chain_type: "ethereum" as const,
        }
      : null,
    solana: solana
      ? {
          id: solana.id,
          address: solana.address,
          chain_type: "solana" as const,
        }
      : null,
    sui: sui
      ? {
          id: sui.id,
          address: sui.address,
          chain_type: "sui" as const,
        }
      : null,
    ton: ton
      ? {
          id: ton.id,
          address: ton.address,
          chain_type: "ton" as const,
        }
      : null,
    tron: tron
      ? {
          id: tron.id,
          address: tron.address,
          chain_type: "tron" as const,
        }
      : null,
  }
}
