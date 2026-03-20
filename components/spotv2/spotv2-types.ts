export interface SpotV2Pair {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  image: string
  displaySymbol: string
  chain: string
  contractAddress: string | null
}

export interface SpotV2ClientProps {
  initialPairs: SpotV2Pair[]
}
