"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  CheckmarkCircle01Icon,
  ArrowDown01Icon,
  Clock01Icon,
  StarIcon,
  InformationCircleIcon,
  Timer01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  ShieldCheck,
  Copy01Icon,
  CheckmarkSquare01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useIsMobile } from "@/hooks/use-mobile"

// ── Types ────────────────────────────────────────────────────────────────

interface Advertiser {
  id: string
  name: string
  avatar: string
  isVerified: boolean
  isMerchant: boolean
  orders: number
  completionRate: number
  avgRelease: string
  rating: number
}

interface P2POffer {
  id: string
  advertiser: Advertiser
  asset: string
  fiat: string
  price: number
  minAmount: number
  maxAmount: number
  available: number
  paymentMethods: PaymentMethod[]
  side: "buy" | "sell"
}

interface PaymentMethod {
  name: string
  icon: string
  type: "bank" | "mobile" | "wallet"
}

type P2PMode = "p2p" | "express"
type TradeSide = "buy" | "sell"
type TradeStep = "form" | "payment" | "confirm" | "complete"

// ── Constants ────────────────────────────────────────────────────────────

const ASSETS = [
  { symbol: "USDT", name: "Tether", icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "BTC", name: "Bitcoin", icon: "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "BNB", name: "BNB", icon: "https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { symbol: "SOL", name: "Solana", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
] as const

const PAYMENT_METHODS: PaymentMethod[] = [
  { name: "Bank Transfer", icon: "https://img.icons8.com/color/48/bank-building.png", type: "bank" },
  { name: "Opay", icon: "https://img.icons8.com/color/48/circled-o.png", type: "mobile" },
  { name: "Palmpay", icon: "https://img.icons8.com/color/48/palm-scan.png", type: "mobile" },
  { name: "Moniepoint", icon: "https://img.icons8.com/color/48/money-transfer.png", type: "mobile" },
  { name: "Kuda", icon: "https://img.icons8.com/color/48/k.png", type: "mobile" },
  { name: "Cash App", icon: "https://img.icons8.com/color/48/dollar-coin.png", type: "wallet" },
  { name: "Wise", icon: "https://img.icons8.com/color/48/worldwide-location.png", type: "wallet" },
]

function getPaymentMethod(name: string): PaymentMethod {
  return PAYMENT_METHODS.find(p => p.name === name) ?? { name, icon: "https://img.icons8.com/color/48/bank-building.png", type: "bank" }
}

const AVATAR_URLS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Adebayo",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Chidinma",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=KingDavid",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Amina",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=ObiFX",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Fatou",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Tunde",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Grace",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Emeka",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Blessing",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Sola",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Ngozi",
]

const MOCK_OFFERS: P2POffer[] = [
  {
    id: "1",
    advertiser: { id: "a1", name: "Adebayo_FX", avatar: AVATAR_URLS[0], isVerified: true, isMerchant: true, orders: 3847, completionRate: 99.2, avgRelease: "2 min", rating: 4.9 },
    asset: "USDT", fiat: "NGN", price: 1620, minAmount: 10000, maxAmount: 5000000, available: 45230,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay"), getPaymentMethod("Palmpay")], side: "buy",
  },
  {
    id: "2",
    advertiser: { id: "a2", name: "Chidinma_Trade", avatar: AVATAR_URLS[1], isVerified: true, isMerchant: false, orders: 1254, completionRate: 98.7, avgRelease: "5 min", rating: 4.8 },
    asset: "USDT", fiat: "NGN", price: 1618, minAmount: 5000, maxAmount: 3000000, available: 28100,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Kuda")], side: "buy",
  },
  {
    id: "3",
    advertiser: { id: "a3", name: "KingDavid_OTC", avatar: AVATAR_URLS[2], isVerified: true, isMerchant: true, orders: 6512, completionRate: 99.5, avgRelease: "1 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1625, minAmount: 50000, maxAmount: 10000000, available: 120000,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay"), getPaymentMethod("Moniepoint")], side: "buy",
  },
  {
    id: "4",
    advertiser: { id: "a4", name: "Amina_Exchange", avatar: AVATAR_URLS[3], isVerified: false, isMerchant: false, orders: 342, completionRate: 96.1, avgRelease: "8 min", rating: 4.5 },
    asset: "USDT", fiat: "NGN", price: 1615, minAmount: 2000, maxAmount: 500000, available: 8500,
    paymentMethods: [getPaymentMethod("Opay"), getPaymentMethod("Palmpay")], side: "buy",
  },
  {
    id: "5",
    advertiser: { id: "a5", name: "ObiFX_Pro", avatar: AVATAR_URLS[4], isVerified: true, isMerchant: true, orders: 4201, completionRate: 99.8, avgRelease: "1 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1622, minAmount: 20000, maxAmount: 8000000, available: 95000,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay"), getPaymentMethod("Kuda"), getPaymentMethod("Moniepoint")], side: "buy",
  },
  {
    id: "6",
    advertiser: { id: "a6", name: "Fatou_P2P", avatar: AVATAR_URLS[5], isVerified: true, isMerchant: false, orders: 876, completionRate: 97.9, avgRelease: "4 min", rating: 4.7 },
    asset: "USDT", fiat: "NGN", price: 1619, minAmount: 10000, maxAmount: 2000000, available: 15600,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Palmpay")], side: "buy",
  },
  {
    id: "7",
    advertiser: { id: "a7", name: "Tunde_Crypto", avatar: AVATAR_URLS[6], isVerified: true, isMerchant: true, orders: 2890, completionRate: 98.5, avgRelease: "3 min", rating: 4.8 },
    asset: "USDT", fiat: "NGN", price: 1630, minAmount: 5000, maxAmount: 4000000, available: 62000,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay")], side: "sell",
  },
  {
    id: "8",
    advertiser: { id: "a8", name: "Grace_OTC", avatar: AVATAR_URLS[7], isVerified: true, isMerchant: false, orders: 1567, completionRate: 99.0, avgRelease: "3 min", rating: 4.9 },
    asset: "USDT", fiat: "NGN", price: 1632, minAmount: 10000, maxAmount: 6000000, available: 41000,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Moniepoint"), getPaymentMethod("Kuda")], side: "sell",
  },
  {
    id: "9",
    advertiser: { id: "a9", name: "Emeka_FX", avatar: AVATAR_URLS[8], isVerified: false, isMerchant: false, orders: 210, completionRate: 95.3, avgRelease: "10 min", rating: 4.3 },
    asset: "USDT", fiat: "NGN", price: 1635, minAmount: 2000, maxAmount: 1000000, available: 5200,
    paymentMethods: [getPaymentMethod("Opay"), getPaymentMethod("Palmpay")], side: "sell",
  },
  {
    id: "10",
    advertiser: { id: "a10", name: "Blessing_Trade", avatar: AVATAR_URLS[9], isVerified: true, isMerchant: true, orders: 5102, completionRate: 99.6, avgRelease: "2 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1628, minAmount: 30000, maxAmount: 15000000, available: 200000,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay"), getPaymentMethod("Moniepoint"), getPaymentMethod("Kuda")], side: "sell",
  },
  {
    id: "11",
    advertiser: { id: "a11", name: "Sola_BTC", avatar: AVATAR_URLS[10], isVerified: true, isMerchant: true, orders: 1892, completionRate: 99.1, avgRelease: "2 min", rating: 4.9 },
    asset: "BTC", fiat: "NGN", price: 172500000, minAmount: 50000, maxAmount: 20000000, available: 0.45,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Opay")], side: "buy",
  },
  {
    id: "12",
    advertiser: { id: "a12", name: "Ngozi_ETH", avatar: AVATAR_URLS[11], isVerified: true, isMerchant: false, orders: 756, completionRate: 98.2, avgRelease: "5 min", rating: 4.7 },
    asset: "ETH", fiat: "NGN", price: 5940000, minAmount: 20000, maxAmount: 10000000, available: 3.8,
    paymentMethods: [getPaymentMethod("Bank Transfer"), getPaymentMethod("Kuda"), getPaymentMethod("Palmpay")], side: "buy",
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtAmount(n: number, fiat: string): string {
  if (fiat === "NGN") return `₦${n.toLocaleString()}`
  if (fiat === "USD") return `$${n.toLocaleString()}`
  if (fiat === "GBP") return `£${n.toLocaleString()}`
  if (fiat === "EUR") return `€${n.toLocaleString()}`
  return n.toLocaleString()
}

function fmtAvailable(n: number, asset: string): string {
  if (asset === "BTC" || asset === "ETH" || asset === "BNB" || asset === "SOL") {
    return `${n.toFixed(4)} ${asset}`
  }
  return `${n.toLocaleString()} ${asset}`
}

function getAssetInfo(symbol: string) {
  return ASSETS.find(a => a.symbol === symbol) ?? ASSETS[0]
}

// ── Offer Card ───────────────────────────────────────────────────────────

function OfferCard({ offer, side, onTrade }: { offer: P2POffer; side: TradeSide; onTrade: (offer: P2POffer) => void }) {
  const adv = offer.advertiser
  const assetInfo = getAssetInfo(offer.asset)

  return (
    <div className="group rounded-2xl border border-border/40 bg-card p-4 transition-all hover:border-border/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Advertiser info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border border-border/30">
              <AvatarImage src={adv.avatar} alt={adv.name} />
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                {adv.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {adv.isVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{adv.name}</span>
              {adv.isMerchant && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                  Merchant
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{adv.orders.toLocaleString()} orders</span>
              <span className="text-border">·</span>
              <span>{adv.completionRate}%</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5">
                <HugeiconsIcon icon={StarIcon} className="h-2.5 w-2.5 text-amber-400" />
                {adv.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Price & limits */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-1.5">
            <img src={assetInfo.icon} alt={assetInfo.symbol} className="h-4 w-4 rounded-full" />
            <span className="text-lg font-bold tabular-nums">
              {fmtAmount(offer.price, offer.fiat)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Limit: {fmtAmount(offer.minAmount, offer.fiat)} – {fmtAmount(offer.maxAmount, offer.fiat)}
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Available:</span>
          <span className="text-[11px] font-medium">{fmtAvailable(offer.available, offer.asset)}</span>
          <span className="mx-1 text-border">|</span>
          <div className="flex flex-wrap items-center gap-1">
            {offer.paymentMethods.map((pm) => (
              <span
                key={pm.name}
                className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                <img src={pm.icon} alt={pm.name} className="h-3 w-3 rounded-sm" />
                {pm.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <HugeiconsIcon icon={Timer01Icon} className="h-3 w-3" />
            ~{adv.avgRelease}
          </span>
          <button
            onClick={() => onTrade(offer)}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
              side === "buy"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {side === "buy" ? "Buy" : "Sell"} {offer.asset}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Express Trade Card ───────────────────────────────────────────────────

function ExpressTrade() {
  const [expressSide, setExpressSide] = React.useState<TradeSide>("buy")
  const [expressAsset, setExpressAsset] = React.useState("USDT")
  const [fiatAmount, setFiatAmount] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isDone, setIsDone] = React.useState(false)

  const assetInfo = getAssetInfo(expressAsset)
  const rate = expressAsset === "USDT" ? 1620 : expressAsset === "BTC" ? 172500000 : expressAsset === "ETH" ? 5940000 : expressAsset === "BNB" ? 945000 : 265000
  const cryptoAmount = fiatAmount ? (parseFloat(fiatAmount.replace(/,/g, "")) / rate) : 0

  function handleExpress() {
    if (!fiatAmount || cryptoAmount <= 0) return
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setIsDone(true)
      setTimeout(() => { setIsDone(false); setFiatAmount("") }, 3000)
    }, 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex flex-col gap-5">
            {/* Buy/Sell toggle */}
            <div className="flex items-center rounded-xl bg-accent/50 p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setExpressSide(s)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    expressSide === s
                      ? s === "buy" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "buy" ? "Buy Crypto" : "Sell Crypto"}
                </button>
              ))}
            </div>

            {/* Asset selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">I want to {expressSide}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {ASSETS.map((a) => (
                  <button
                    key={a.symbol}
                    onClick={() => setExpressAsset(a.symbol)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      expressAsset === a.symbol
                        ? "bg-primary text-white"
                        : "bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <img src={a.icon} alt={a.symbol} className="h-4 w-4 rounded-full" />
                    {a.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {expressSide === "buy" ? "I want to spend" : "I want to sell for"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                <input
                  type="text"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border/40 bg-accent/30 py-3 pl-8 pr-4 text-lg font-bold tabular-nums outline-none transition-colors focus:border-primary/50 focus:bg-accent/50"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Rate: {fmtAmount(rate, "NGN")}/{expressAsset}</span>
                {cryptoAmount > 0 && (
                  <span className="font-medium text-foreground">
                    ≈ {cryptoAmount.toFixed(expressAsset === "BTC" ? 8 : expressAsset === "ETH" ? 6 : 2)} {expressAsset}
                  </span>
                )}
              </div>
            </div>

            {/* Payment method preview */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Payment method</label>
              <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-accent/20 p-3">
                <img src="https://img.icons8.com/color/48/bank-building.png" alt="" className="h-6 w-6" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Bank Transfer</span>
                  <span className="text-[11px] text-muted-foreground">Instant processing</span>
                </div>
                <HugeiconsIcon icon={ArrowDown01Icon} className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleExpress}
              disabled={!fiatAmount || cryptoAmount <= 0 || isProcessing}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                expressSide === "buy"
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing...
                </>
              ) : isDone ? (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4" />
                  Order Completed!
                </>
              ) : (
                <>
                  {expressSide === "buy" ? "Buy" : "Sell"} {expressAsset} Instantly
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-muted-foreground">
              Express trades are processed instantly at the platform rate. Funds will be {expressSide === "buy" ? "credited to your wallet" : "sent to your bank"} within minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── P2P Trade Flow Dialog ────────────────────────────────────────────────

function P2PTradeDialog({
  open,
  onOpenChange,
  offer,
  side,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  offer: P2POffer | null
  side: TradeSide
}) {
  const isMobile = useIsMobile()
  const [step, setStep] = React.useState<TradeStep>("form")
  const [fiatInput, setFiatInput] = React.useState("")
  const [selectedPayment, setSelectedPayment] = React.useState<PaymentMethod | null>(null)
  const [timeLeft, setTimeLeft] = React.useState(900)
  const [paymentMade, setPaymentMade] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (open && offer) {
      setStep("form")
      setFiatInput("")
      setSelectedPayment(offer.paymentMethods[0] ?? null)
      setTimeLeft(900)
      setPaymentMade(false)
    }
  }, [open, offer])

  // Countdown
  React.useEffect(() => {
    if (step !== "payment" && step !== "confirm") return
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(interval)
  }, [step])

  if (!offer) return null

  const assetInfo = getAssetInfo(offer.asset)
  const fiatNum = parseFloat(fiatInput.replace(/,/g, "")) || 0
  const cryptoAmount = fiatNum / offer.price
  const isValidAmount = fiatNum >= offer.minAmount && fiatNum <= offer.maxAmount
  const timerMins = Math.floor(timeLeft / 60)
  const timerSecs = timeLeft % 60

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleConfirmPayment() {
    setPaymentMade(true)
    setStep("confirm")
    // Simulate seller confirmation after delay
    setTimeout(() => setStep("complete"), 3000)
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
        <div className="flex items-center gap-3">
          {step !== "form" && step !== "complete" && (
            <button
              onClick={() => setStep(step === "confirm" ? "payment" : "form")}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 rotate-180" />
            </button>
          )}
          <div className="flex flex-col gap-0.5">
            <Dialog.Title className="text-base font-semibold">
              {step === "form" && `${side === "buy" ? "Buy" : "Sell"} ${offer.asset}`}
              {step === "payment" && "Make Payment"}
              {step === "confirm" && "Confirming Payment"}
              {step === "complete" && "Trade Complete!"}
            </Dialog.Title>
            {step !== "complete" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={offer.advertiser.avatar} />
                  <AvatarFallback className="text-[8px]">{offer.advertiser.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                {offer.advertiser.name}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(step === "payment" || step === "confirm") && (
            <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
              {timerMins}:{timerSecs.toString().padStart(2, "0")}
            </span>
          )}
          <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-4 w-4" />
          </Dialog.Close>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto p-5">
        {/* ─── STEP: Form ─── */}
        {step === "form" && (
          <div className="flex flex-col gap-5">
            {/* Price + Asset */}
            <div className="flex items-center justify-between rounded-xl bg-accent/30 p-3">
              <div className="flex items-center gap-2">
                <img src={assetInfo.icon} alt="" className="h-6 w-6 rounded-full" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{assetInfo.symbol}</span>
                  <span className="text-[11px] text-muted-foreground">{assetInfo.name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold tabular-nums">{fmtAmount(offer.price, offer.fiat)}</span>
                <span className="block text-[11px] text-muted-foreground">per {offer.asset}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Amount ({offer.fiat})</label>
              <input
                type="text"
                value={fiatInput}
                onChange={(e) => setFiatInput(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder={`${fmtAmount(offer.minAmount, offer.fiat)} - ${fmtAmount(offer.maxAmount, offer.fiat)}`}
                className="w-full rounded-xl border border-border/40 bg-accent/30 px-4 py-3 text-lg font-bold tabular-nums outline-none transition-colors focus:border-primary/50"
              />
              {fiatNum > 0 && (
                <span className="text-xs text-muted-foreground">
                  You will {side === "buy" ? "receive" : "send"}: <strong>{cryptoAmount.toFixed(offer.asset === "BTC" ? 8 : offer.asset === "ETH" ? 6 : 2)} {offer.asset}</strong>
                </span>
              )}
            </div>

            {/* Payment method */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
              <div className="flex flex-col gap-1.5">
                {offer.paymentMethods.map((pm) => (
                  <button
                    key={pm.name}
                    onClick={() => setSelectedPayment(pm)}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      selectedPayment?.name === pm.name
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/40 bg-accent/20 hover:border-border/60"
                    }`}
                  >
                    <img src={pm.icon} alt={pm.name} className="h-6 w-6 rounded" />
                    <span className="text-sm font-medium">{pm.name}</span>
                    {selectedPayment?.name === pm.name && (
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep("payment")}
              disabled={!isValidAmount || !selectedPayment}
              className={`w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                side === "buy"
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {side === "buy" ? "Buy" : "Sell"} {offer.asset}
            </button>
          </div>
        )}

        {/* ─── STEP: Payment ─── */}
        {step === "payment" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-amber-500/10 p-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
              Transfer {fmtAmount(fiatNum, offer.fiat)} to the seller&apos;s account below
            </div>

            {/* Payment details */}
            <div className="rounded-xl border border-border/40 bg-accent/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <img src={selectedPayment?.icon ?? ""} alt="" className="h-5 w-5 rounded" />
                <span className="text-sm font-semibold">{selectedPayment?.name}</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Account Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{offer.advertiser.name.replace("_", " ")}</span>
                    <button onClick={() => handleCopy(offer.advertiser.name)} className="text-muted-foreground hover:text-foreground">
                      <HugeiconsIcon icon={copied ? CheckmarkSquare01Icon : Copy01Icon} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">0123456789</span>
                    <button onClick={() => handleCopy("0123456789")} className="text-muted-foreground hover:text-foreground">
                      <HugeiconsIcon icon={copied ? CheckmarkSquare01Icon : Copy01Icon} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Bank</span>
                  <span className="text-sm font-medium">First Bank of Nigeria</span>
                </div>
                <div className="border-t border-border/30 pt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-lg font-bold text-primary tabular-nums">{fmtAmount(fiatNum, offer.fiat)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-accent/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important:</strong> Please ensure you transfer the exact amount shown above. The crypto will be held in escrow and released once the seller confirms payment.
            </div>

            <button
              onClick={handleConfirmPayment}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90"
            >
              I&apos;ve Made the Payment
            </button>
          </div>
        )}

        {/* ─── STEP: Confirming ─── */}
        {step === "confirm" && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500/30 border-t-amber-500" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold">Waiting for Seller</h3>
              <p className="text-sm text-muted-foreground">
                The seller is verifying your payment. This usually takes 1-5 minutes.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-accent/30 px-4 py-3">
              <img src={assetInfo.icon} alt="" className="h-5 w-5 rounded-full" />
              <span className="text-sm font-semibold">
                {cryptoAmount.toFixed(offer.asset === "BTC" ? 8 : 2)} {offer.asset}
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 text-muted-foreground" />
              <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Your Wallet</span>
            </div>
          </div>
        )}

        {/* ─── STEP: Complete ─── */}
        {step === "complete" && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold">Trade Complete!</h3>
              <p className="text-sm text-muted-foreground">
                {cryptoAmount.toFixed(offer.asset === "BTC" ? 8 : 2)} {offer.asset} has been {side === "buy" ? "credited to" : "deducted from"} your wallet.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 rounded-xl bg-accent/30 p-4 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{fmtAmount(fiatNum, offer.fiat)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Crypto Received</span>
                <span className="font-medium">{cryptoAmount.toFixed(offer.asset === "BTC" ? 8 : 2)} {offer.asset}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-medium">{fmtAmount(offer.price, offer.fiat)}/{offer.asset}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Seller</span>
                <span className="font-medium">{offer.advertiser.name}</span>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Mobile drag handle */}
      {isMobile && (
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border/60" />
      )}
    </>
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={`fixed z-50 flex flex-col bg-background text-sm shadow-2xl transition duration-200 ease-in-out outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 ${
            isMobile
              ? "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t data-ending-style:translate-y-10 data-starting-style:translate-y-10"
              : "top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border data-ending-style:scale-95 data-starting-style:scale-95"
          }`}
        >
          {content}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── How It Works Section ─────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    { step: "01", title: "Place an Order", desc: "Browse offers from verified traders and pick one that matches your price and payment method.", icon: Search01Icon },
    { step: "02", title: "Make Payment", desc: "Send payment via the advertiser's listed method. Your crypto is held safely in escrow during the trade.", icon: Wallet01Icon },
    { step: "03", title: "Receive Crypto", desc: "Once the seller confirms payment, crypto is released from escrow directly to your wallet.", icon: CheckmarkCircle01Icon },
  ]
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/30">
        <HugeiconsIcon icon={InformationCircleIcon} className="h-4.5 w-4.5 text-primary" />
        <h3 className="text-sm font-bold">How P2P Trading Works</h3>
      </div>
      <div className="grid grid-cols-1 gap-0 divide-y divide-border/20 md:grid-cols-3 md:gap-0 md:divide-y-0 md:divide-x">
        {steps.map((s) => (
          <div key={s.step} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HugeiconsIcon icon={s.icon} className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[11px] font-bold text-primary/60">STEP {s.step}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">{s.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Safety Tips Section ──────────────────────────────────────────────────

function SafetyTipsSection() {
  const tips = [
    { title: "Use Escrow", desc: "Always trade within the platform escrow system. Never send crypto directly outside of a trade." },
    { title: "Verify Payment", desc: "Never release crypto before confirming payment has been received in your account." },
    { title: "Check Reputation", desc: "Review the advertiser's completion rate, order count, and reviews before trading." },
    { title: "Listed Methods Only", desc: "Only use the payment methods listed in the trade. Report any requests to pay elsewhere." },
  ]
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/30">
        <HugeiconsIcon icon={ShieldCheck} className="h-4.5 w-4.5 text-emerald-500" />
        <h3 className="text-sm font-bold">Safety Tips</h3>
      </div>
      <div className="grid grid-cols-1 gap-0 divide-y divide-border/20 sm:grid-cols-2 sm:divide-y-0">
        {tips.map((t, i) => (
          <div key={i} className={`flex items-start gap-3 p-5 ${i < 2 ? "sm:border-b sm:border-border/20" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold">{t.title}</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">{t.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Client ──────────────────────────────────────────────────────────

export function P2PClient() {
  const [mode, setMode] = React.useState<P2PMode>("p2p")
  const [side, setSide] = React.useState<TradeSide>("buy")
  const [asset, setAsset] = React.useState<string>("USDT")
  const [search, setSearch] = React.useState("")
  const [tradeOffer, setTradeOffer] = React.useState<P2POffer | null>(null)
  const [tradeDialogOpen, setTradeDialogOpen] = React.useState(false)

  const offers = React.useMemo(() => {
    return MOCK_OFFERS.filter((o) => {
      if (o.side !== side) return false
      if (o.asset !== asset) return false
      if (search) {
        const q = search.toLowerCase()
        if (!o.advertiser.name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [side, asset, search])

  function handleTrade(offer: P2POffer) {
    setTradeOffer(offer)
    setTradeDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">P2P Trading</h1>
        <p className="text-sm text-muted-foreground">
          Buy and sell crypto directly with other traders using local payment methods
        </p>
      </div>

      {/* Mode Nav: P2P / Express */}
      <div className="flex items-center gap-1 rounded-xl bg-accent/50 p-1 w-fit">
        <button
          onClick={() => setMode("p2p")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
            mode === "p2p"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          P2P Trading
        </button>
        <button
          onClick={() => setMode("express")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
            mode === "express"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Express
          <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">Fast</span>
        </button>
      </div>

      {/* ─── P2P Mode ─── */}
      {mode === "p2p" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Buy / Sell toggle */}
            <div className="flex items-center rounded-xl bg-accent/50 p-1">
              <button
                onClick={() => setSide("buy")}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  side === "buy"
                    ? "bg-emerald-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  side === "sell"
                    ? "bg-red-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sell
              </button>
            </div>

            {/* Asset pills with icons */}
            <div className="flex items-center gap-1">
              {ASSETS.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => setAsset(a.symbol)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    asset === a.symbol
                      ? "bg-primary text-white"
                      : "bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <img src={a.icon} alt={a.symbol} className="h-3.5 w-3.5 rounded-full" />
                  {a.symbol}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-1.75 h-3.5 w-3.5 text-muted-foreground"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search advertiser..."
                className="w-40 rounded-xl bg-accent/50 py-1.5 pl-8 pr-3 text-xs outline-none transition-all focus:w-56 focus:bg-accent"
              />
            </div>
          </div>

          {/* Offers */}
          <div className="flex flex-col gap-3">
            {offers.length > 0 ? (
              offers.map((o) => <OfferCard key={o.id} offer={o} side={side} onTrade={handleTrade} />)
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card py-16 text-center">
                <HugeiconsIcon icon={Search01Icon} className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <span className="text-sm font-medium text-muted-foreground">
                  No {side} offers for {asset}
                </span>
                <span className="mt-1 text-xs text-muted-foreground/70">
                  Try switching to {side === "buy" ? "sell" : "buy"} or another asset
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Express Mode ─── */}
      {mode === "express" && <ExpressTrade />}

      {/* ─── How It Works & Safety Tips ─── */}
      <div className="flex flex-col gap-4 mt-4">
        <HowItWorksSection />
        <SafetyTipsSection />
      </div>

      {/* Trade Dialog */}
      <P2PTradeDialog
        open={tradeDialogOpen}
        onOpenChange={setTradeDialogOpen}
        offer={tradeOffer}
        side={side}
      />
    </div>
  )
}
