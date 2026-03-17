import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Connection, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"
import { createPublicClient, http, parseAbi, formatUnits, formatEther } from "viem"
import { mainnet, arbitrum } from "viem/chains"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"

// ── RPC Endpoints ────────────────────────────────────────────────────────

const SOL_RPC =
  process.env.NEXT_PUBLIC_SOL_RPC ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com"

const ETH_RPC =
  process.env.NEXT_PUBLIC_ETH_RPC || "https://cloudflare-eth.com"

const ARB_RPC =
  process.env.NEXT_PUBLIC_ARB_RPC || "https://arb1.arbitrum.io/rpc"

const SUI_RPC =
  process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443"

const TRON_BALANCE_API =
  process.env.TRON_BALANCE_API || "https://trading.watchup.site/api/tron/balance"

// ── Token Constants ──────────────────────────────────────────────────────

const SOL_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
const SOL_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const
const ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const

const ARB_USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const
const ARB_USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const
const ARB_USDC_BRIDGED_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" as const

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
])

// ── Balance Result Type ──────────────────────────────────────────────────

interface TokenBalance {
  symbol: string
  name: string
  chain: string
  balance: number
  contractAddress?: string
  isNative: boolean
}

// ── Fetchers ─────────────────────────────────────────────────────────────

async function fetchSolanaBalances(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const connection = new Connection(SOL_RPC, "confirmed")
    const pubkey = new PublicKey(address)

    // Native SOL
    const lamports = await connection.getBalance(pubkey)
    results.push({
      symbol: "SOL",
      name: "Solana",
      chain: "solana",
      balance: lamports / 1e9,
      isNative: true,
    })

    // SPL tokens (USDT, USDC)
    const [tokenAccounts, token2022Accounts] = await Promise.all([
      connection
        .getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID })
        .catch(() => ({ value: [] })),
      connection
        .getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_2022_PROGRAM_ID })
        .catch(() => ({ value: [] })),
    ])

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value]

    for (const { account } of allAccounts) {
      const parsed = account.data.parsed
      if (!parsed || parsed.type !== "account") continue
      const info = parsed.info
      const mint: string = info.mint
      const uiAmount: number = info.tokenAmount?.uiAmount ?? 0

      if (mint === SOL_USDT_MINT) {
        results.push({
          symbol: "USDT",
          name: "Tether",
          chain: "solana",
          balance: uiAmount,
          contractAddress: SOL_USDT_MINT,
          isNative: false,
        })
      } else if (mint === SOL_USDC_MINT) {
        results.push({
          symbol: "USDC",
          name: "USD Coin",
          chain: "solana",
          balance: uiAmount,
          contractAddress: SOL_USDC_MINT,
          isNative: false,
        })
      }
    }
  } catch (err) {
    console.error("[wallet/balances] Solana fetch error:", err)
  }
  return results
}

async function fetchEthereumBalances(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(ETH_RPC),
    })

    // Native ETH
    const ethBalance = await client.getBalance({ address: address as `0x${string}` })
    results.push({
      symbol: "ETH",
      name: "Ethereum",
      chain: "ethereum",
      balance: parseFloat(formatEther(ethBalance)),
      isNative: true,
    })

    // USDT
    try {
      const usdtBal = await client.readContract({
        address: ETH_USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      results.push({
        symbol: "USDT",
        name: "Tether",
        chain: "ethereum",
        balance: parseFloat(formatUnits(usdtBal, 6)),
        contractAddress: ETH_USDT_ADDRESS,
        isNative: false,
      })
    } catch (e) {
      console.error("[wallet/balances] ETH USDT error:", e)
    }

    // USDC
    try {
      const usdcBal = await client.readContract({
        address: ETH_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      results.push({
        symbol: "USDC",
        name: "USD Coin",
        chain: "ethereum",
        balance: parseFloat(formatUnits(usdcBal, 6)),
        contractAddress: ETH_USDC_ADDRESS,
        isNative: false,
      })
    } catch (e) {
      console.error("[wallet/balances] ETH USDC error:", e)
    }
  } catch (err) {
    console.error("[wallet/balances] Ethereum fetch error:", err)
  }
  return results
}

async function fetchArbitrumBalances(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const client = createPublicClient({
      chain: arbitrum,
      transport: http(ARB_RPC),
    })

    // Native ETH on Arbitrum
    const ethBalance = await client.getBalance({ address: address as `0x${string}` })
    results.push({
      symbol: "ETH",
      name: "Ethereum",
      chain: "arbitrum",
      balance: parseFloat(formatEther(ethBalance)),
      isNative: true,
    })

    // USDT on Arbitrum
    try {
      const usdtBal = await client.readContract({
        address: ARB_USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      results.push({
        symbol: "USDT",
        name: "Tether",
        chain: "arbitrum",
        balance: parseFloat(formatUnits(usdtBal, 6)),
        contractAddress: ARB_USDT_ADDRESS,
        isNative: false,
      })
    } catch (e) {
      console.error("[wallet/balances] ARB USDT error:", e)
    }

    // Native USDC on Arbitrum
    try {
      const usdcBal = await client.readContract({
        address: ARB_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      results.push({
        symbol: "USDC",
        name: "USD Coin",
        chain: "arbitrum",
        balance: parseFloat(formatUnits(usdcBal, 6)),
        contractAddress: ARB_USDC_ADDRESS,
        isNative: false,
      })
    } catch (e) {
      console.error("[wallet/balances] ARB USDC error:", e)
    }

    // Bridged USDC.e on Arbitrum
    try {
      const usdceBal = await client.readContract({
        address: ARB_USDC_BRIDGED_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      const bal = parseFloat(formatUnits(usdceBal, 6))
      if (bal > 0) {
        results.push({
          symbol: "USDC.e",
          name: "Bridged USDC",
          chain: "arbitrum",
          balance: bal,
          contractAddress: ARB_USDC_BRIDGED_ADDRESS,
          isNative: false,
        })
      }
    } catch (e) {
      console.error("[wallet/balances] ARB USDC.e error:", e)
    }
  } catch (err) {
    console.error("[wallet/balances] Arbitrum fetch error:", err)
  }
  return results
}

async function fetchSuiBalance(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const res = await fetch(SUI_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address, "0x2::sui::SUI"],
      }),
    })
    const data = await res.json()
    const balanceInMist = data.result?.totalBalance || "0"
    results.push({
      symbol: "SUI",
      name: "Sui",
      chain: "sui",
      balance: parseFloat(balanceInMist) / 1e9,
      isNative: true,
    })
  } catch (err) {
    console.error("[wallet/balances] SUI fetch error:", err)
  }
  return results
}

async function fetchTonBalance(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const res = await fetch(
      `https://go.getblock.io/8a928018fe2741ed90779091f68c571d/getAddressInformation?address=${encodeURIComponent(address)}`,
    )
    const data = await res.json()
    if (data.ok) {
      const nanoTon = data.result?.balance || "0"
      results.push({
        symbol: "TON",
        name: "TON",
        chain: "ton",
        balance: parseFloat(nanoTon) / 1e9,
        isNative: true,
      })
    }
  } catch (err) {
    console.error("[wallet/balances] TON fetch error:", err)
  }
  return results
}

async function fetchTronBalances(address: string): Promise<TokenBalance[]> {
  const results: TokenBalance[] = []
  try {
    const res = await fetch(`${TRON_BALANCE_API}/${encodeURIComponent(address)}`)
    if (!res.ok) return results
    const data = await res.json()
    if (!data.success) return results

    const trxBalance = parseFloat(data.trx?.balance || "0")
    results.push({
      symbol: "TRX",
      name: "Tron",
      chain: "tron",
      balance: trxBalance,
      isNative: true,
    })

    // Token balances (USDT TRC-20 etc.)
    const tokens = data.tokens || []
    for (const token of tokens) {
      if (token.symbol && parseFloat(token.balance || "0") > 0) {
        results.push({
          symbol: token.symbol,
          name: token.name || token.symbol,
          chain: "tron",
          balance: parseFloat(token.balance),
          contractAddress: token.contractAddress,
          isNative: false,
        })
      }
    }
  } catch (err) {
    console.error("[wallet/balances] TRON fetch error:", err)
  }
  return results
}

// ── Route ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const userWallet = await UserWallet.findOne({ clerkUserId }).lean()

    if (!userWallet) {
      return NextResponse.json({ balances: [], totalUsd: 0 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wallets = (userWallet as Record<string, any>).wallets || {}

    // Fetch all chains in parallel
    const [solana, ethereum, arbBalances, sui, ton, tron] = await Promise.all([
      wallets.solana?.address
        ? fetchSolanaBalances(wallets.solana.address)
        : Promise.resolve([]),
      wallets.ethereum?.address
        ? fetchEthereumBalances(wallets.ethereum.address)
        : Promise.resolve([]),
      wallets.ethereum?.address
        ? fetchArbitrumBalances(wallets.ethereum.address)
        : Promise.resolve([]),
      wallets.sui?.address
        ? fetchSuiBalance(wallets.sui.address)
        : Promise.resolve([]),
      wallets.ton?.address
        ? fetchTonBalance(wallets.ton.address)
        : Promise.resolve([]),
      wallets.tron?.address
        ? fetchTronBalances(wallets.tron.address)
        : Promise.resolve([]),
    ])

    const balances = [...solana, ...ethereum, ...arbBalances, ...sui, ...ton, ...tron]

    return NextResponse.json({ balances })
  } catch (error) {
    console.error("[wallet/balances] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 },
    )
  }
}
