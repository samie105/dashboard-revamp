"use client"

import * as React from "react"
import Link from "next/link"
import "./reference-dashboard.css"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDataTransferHorizontalIcon,
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ChartLineData01Icon,
  CreditCardIcon,
  EyeIcon,
  MoreHorizontalIcon,
  Search01Icon,
  ViewOffSlashIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PREVIEW_ROUTES } from "@/components/preview/routes"

type RangeKey = "1H" | "1D" | "1W" | "1M" | "1Y" | "ALL"
type MoverTab = "Gainers" | "Losers" | "New Listings"
type AssetTab = "Assets" | "Portfolio" | "P&L" | "Recent Transactions"

const RANGE_POINTS: Record<RangeKey, number[]> = {
  "1H": [44, 52, 47, 56, 59, 54, 61, 65, 63, 70, 68, 76, 73, 79, 81, 78, 84, 82, 87, 85, 91],
  "1D": [38, 46, 43, 51, 48, 56, 61, 57, 65, 63, 71, 69, 74, 72, 79, 76, 83, 86, 84, 89, 92],
  "1W": [29, 34, 31, 39, 37, 44, 48, 45, 53, 57, 54, 62, 59, 66, 64, 70, 73, 71, 80, 78, 88],
  "1M": [38, 44, 41, 50, 44, 53, 56, 63, 53, 50, 46, 32, 31, 34, 46, 54, 60, 63, 65, 82, 94, 87, 71, 69, 70, 72, 65, 66, 64, 70, 62, 70, 61, 74, 67, 70, 68],
  "1Y": [19, 24, 22, 28, 31, 27, 36, 34, 42, 39, 47, 51, 48, 56, 54, 60, 67, 64, 73, 70, 84],
  ALL: [18, 21, 20, 26, 24, 31, 29, 37, 35, 42, 40, 49, 46, 55, 53, 61, 58, 68, 64, 75, 89],
}

const RANGE_LABELS: Record<RangeKey, string[]> = {
  "1H": ["10:00", "10:15", "10:30", "10:45", "Now"],
  "1D": ["00:00", "06:00", "12:00", "18:00", "Now"],
  "1W": ["Sep 30", "Oct 02", "Oct 04", "Oct 05", "Now"],
  "1M": ["Sep 08", "Sep 12", "Sep 16", "Sep 20", "Sep 24", "Sep 28", "Oct 02", "Oct 06"],
  "1Y": ["Jan", "Apr", "Jul", "Sep", "Now"],
  ALL: ["2024", "2025", "Q1", "Q3", "Now"],
}

const BALANCE_TILES = [
  { label: "Spot Balance", value: "$2.71", delta: "+0.07%", icon: Wallet01Icon },
  { label: "Futures Balance", value: "$0.03", delta: "+0.00%", icon: ChartLineData01Icon },
  { label: "Available Balance", value: "$2.71", delta: "99.1%", icon: Wallet01Icon, progress: 99.1 },
  { label: "In Orders", value: "$0.00", delta: "0.0%", icon: ArrowDataTransferHorizontalIcon, progress: 0 },
]

const ASSETS = [
  { symbol: "USDT", name: "Tether", amount: "2.71000000", available: "2.71000000", orders: "0.00000000", value: "$2.71", network: "Tether" },
  { symbol: "USDC", name: "USD Coin", amount: "0.00000000", available: "0.00000000", orders: "0.00000000", value: "$0.00", network: "Ethereum" },
  { symbol: "BTC", name: "Bitcoin", amount: "0.00000000", available: "0.00000000", orders: "0.00000000", value: "$0.00", network: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum", amount: "0.00000000", available: "0.00000000", orders: "0.00000000", value: "$0.00", network: "Ethereum" },
  { symbol: "SOL", name: "Solana", amount: "0.00000000", available: "0.00000000", orders: "0.00000000", value: "$0.00", network: "Solana" },
]

const MOVERS: Record<MoverTab, { symbol: string; name: string; price: string; change: string }[]> = {
  Gainers: [
    { symbol: "BTC", name: "Bitcoin", price: "$62,835.12", change: "+2.45%" },
    { symbol: "ETH", name: "Ethereum", price: "$2,448.32", change: "+1.87%" },
    { symbol: "SOL", name: "Solana", price: "$143.21", change: "+6.12%" },
    { symbol: "BNB", name: "BNB", price: "$592.41", change: "+1.21%" },
    { symbol: "XRP", name: "Ripple", price: "$0.52", change: "+3.66%" },
  ],
  Losers: [
    { symbol: "OP", name: "Optimism", price: "$1.74", change: "-4.16%" },
    { symbol: "SEI", name: "Sei", price: "$0.59", change: "-3.57%" },
    { symbol: "TIA", name: "Celestia", price: "$6.87", change: "-2.48%" },
    { symbol: "DOGE", name: "Dogecoin", price: "$0.16", change: "-1.84%" },
    { symbol: "LTC", name: "Litecoin", price: "$104.70", change: "-1.22%" },
  ],
  "New Listings": [
    { symbol: "JUP", name: "Jupiter", price: "$0.84", change: "+18.42%" },
    { symbol: "WIF", name: "dogwifhat", price: "$2.31", change: "+12.81%" },
    { symbol: "TON", name: "Toncoin", price: "$5.62", change: "+7.30%" },
    { symbol: "PYTH", name: "Pyth Network", price: "$0.29", change: "+5.72%" },
    { symbol: "SUI", name: "Sui", price: "$1.03", change: "+4.38%" },
  ],
}

function IconCircle({ icon, className }: { icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]; className?: string }) {
  return (
    <span className={cn("dashboard-icon-circle", className)}>
      <HugeiconsIcon icon={icon} className="h-[18px] w-[18px]" />
    </span>
  )
}

function DashboardChart({ range }: { range: RangeKey }) {
  const [active, setActive] = React.useState<number | null>(null)
  const points = RANGE_POINTS[range]
  const width = 760
  const height = 180
  const padX = 4
  const padY = 13
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * (width - padX * 2)
    const y = height - padY - ((point - min) / span) * (height - padY * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const positions = coords.map((point) => point.split(",").map(Number))
  const line = positions.reduce((path, point, index) => {
    if (index === 0) return `M ${point[0]} ${point[1]}`
    const previous = positions[index - 1]
    const middle = (previous[0] + point[0]) / 2
    return `${path} C ${middle} ${previous[1]}, ${middle} ${point[1]}, ${point[0]} ${point[1]}`
  }, "")
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  const selected = active === null ? null : Math.min(active, positions.length - 1)
  const duration = { "1H": 3600000, "1D": 86400000, "1W": 604800000, "1M": 2592000000, "1Y": 31536000000, ALL: 63072000000 }[range]
  const timestamp = selected === null ? "" : new Date(Date.UTC(2026, 9, 6, 14, 32) - duration * (1 - selected / (points.length - 1))).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
  const labels = RANGE_LABELS[range]

  return (
    <div className="dashboard-chart-wrap">
      <div className="dashboard-chart-axis">
        <span>$2.90</span>
        <span>$2.80</span>
        <span>$2.70</span>
        <span>$2.60</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="dashboard-chart" aria-label={`${range} demo portfolio chart. Use arrow keys to inspect values.`} role="img" tabIndex={0}
        onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setActive(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - box.left) / box.width * (points.length - 1))))) }}
        onPointerLeave={() => setActive(null)} onFocus={() => setActive(points.length - 1)} onBlur={() => setActive(null)}
        onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setActive(Math.max(0, Math.min(points.length - 1, (active ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1)))) } }}>
        <defs>
          <linearGradient id="dashboard-area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f5c518" stopOpacity="0.46" />
            <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.12, 0.37, 0.62, 0.87].map((position) => (
          <line key={position} x1="0" x2={width} y1={height * position} y2={height * position} className="dashboard-chart-grid" />
        ))}
        {[0.11, 0.27, 0.43, 0.59, 0.75, 0.91].map((position) => (
          <line key={position} x1={width * position} x2={width * position} y1="0" y2={height} className="dashboard-chart-grid dashboard-chart-grid-vertical" />
        ))}
        <path d={area} fill="url(#dashboard-area-fill)" />
        <path d={line} fill="none" className="dashboard-chart-line" />
        {selected !== null && <g><line x1={positions[selected][0]} x2={positions[selected][0]} y1="0" y2={height} className="dashboard-crosshair" /><circle cx={positions[selected][0]} cy={positions[selected][1]} r="4" className="dashboard-chart-end" /></g>}
        <circle cx={coords.at(-1)?.split(",")[0]} cy={coords.at(-1)?.split(",")[1]} r="5" className="dashboard-chart-end" />
      </svg>
      {selected !== null && <div className="dashboard-chart-tooltip" role="status" style={{ left: `${Math.min(65, Math.max(0, selected / (points.length - 1) * 80 - 10))}%` }}><small>{timestamp} UTC · Demo</small><span>Portfolio value</span><strong>${(2.6 + (points[selected] - min) / span * 0.3).toFixed(4)}</strong><span>24h change</span><em>+$0.06 (+2.40%)</em></div>}
      <div className="dashboard-chart-labels">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  )
}

function GiftIllustration() {
  return (
    <span className="dashboard-reference-gift" aria-hidden="true" />
  )
}

function PhoneIllustration() {
  return (
    <span className="dashboard-reference-phone" aria-hidden="true" />
  )
}

function QuickAction({ href, label, icon, primary }: { href: string; label: string; icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]; primary?: boolean }) {
  return (
    <Link href={href} className={cn("dashboard-quick-action", primary && "dashboard-quick-action-primary")}>
      <IconCircle icon={icon} className={primary ? "dashboard-icon-circle-primary" : undefined} />
      <span>{label}</span>
    </Link>
  )
}

export function ReferenceDashboard() {
  const [range, setRange] = React.useState<RangeKey>("1M")
  const [hidden, setHidden] = React.useState(false)
  const [moverTab, setMoverTab] = React.useState<MoverTab>("Gainers")
  const [assetTab, setAssetTab] = React.useState<AssetTab>("Assets")
  const [search, setSearch] = React.useState("")
  const [hideSmall, setHideSmall] = React.useState(false)

  const filteredAssets = ASSETS.filter((asset) => {
    if (hideSmall && asset.value === "$0.00") return false
    const query = search.trim().toLowerCase()
    return !query || `${asset.symbol} ${asset.name} ${asset.network}`.toLowerCase().includes(query)
  })

  return (
    <div className="preview-dashboard-page">
      <div className="preview-dashboard-layout">
        <div className="preview-dashboard-column">
          <section className="dashboard-welcome-card">
            <div className="dashboard-welcome-copy">
              <p className="dashboard-kicker">Good morning,</p>
              <h1>_dev Tomiwa <span aria-hidden>👋</span></h1>
              <p className="dashboard-welcome-subtitle">Welcome back! Here&apos;s an overview of your portfolio.</p>
            </div>
            <div className="dashboard-reference-mountains" aria-hidden="true" />
            <div className="dashboard-verification-card">
              <GiftIllustration />
              <div className="dashboard-verification-copy">
                <strong>Complete Identity Verification</strong>
                <span>Unlock higher limits and more features.</span>
                <Link href="/register">Verify Now <span aria-hidden>→</span></Link>
              </div>
            </div>
          </section>

          <section className="dashboard-portfolio-card">
            <div className="dashboard-portfolio-summary">
              <div className="dashboard-portfolio-label-row">
                <span>Total Portfolio Value</span>
                <button type="button" onClick={() => setHidden((value) => !value)} aria-label={hidden ? "Show portfolio value" : "Hide portfolio value"}>
                  <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : EyeIcon} className="h-[17px] w-[17px]" />
                </button>
              </div>
              <strong className="dashboard-portfolio-value">{hidden ? "$••••" : "$2.74"}</strong>
              <span className="dashboard-portfolio-btc">≈ {hidden ? "••••" : "0.000043"} BTC</span>
              <div className="dashboard-portfolio-change">
                <span>+2.40%</span>
                <strong>{hidden ? "••••" : "+$0.06"}</strong>
                <small>(24h)</small>
              </div>
            </div>
            <div className="dashboard-portfolio-chart-panel">
              <div className="dashboard-portfolio-chart-toolbar">
                <span className="dashboard-chart-caption">Performance</span>
                <div className="dashboard-range-tabs" role="tablist" aria-label="Portfolio chart range">
                  {(Object.keys(RANGE_POINTS) as RangeKey[]).map((option) => (
                    <button key={option} type="button" role="tab" aria-selected={range === option} data-active={range === option ? "true" : undefined} onClick={() => setRange(option)}>{option}</button>
                  ))}
                </div>
              </div>
              <DashboardChart key={range} range={range} />
            </div>
          </section>

          <section className="dashboard-balance-grid" aria-label="Balance summary">
            {BALANCE_TILES.map((tile) => (
              <div className="dashboard-balance-tile" key={tile.label}>
                <IconCircle icon={tile.icon} />
                <div className="dashboard-balance-copy">
                  <span>{tile.label}</span>
                  <strong>{hidden ? "$••" : tile.value}</strong>
                  {tile.progress !== undefined ? (
                    <div className="dashboard-balance-progress-row"><i><b style={{ width: `${tile.progress}%` }} /></i><small>{tile.delta}</small></div>
                  ) : <em>{tile.delta}</em>}
                </div>
              </div>
            ))}
          </section>

          <section className="dashboard-assets-card">
            <div className="dashboard-assets-toolbar">
              <div className="dashboard-assets-tabs" role="tablist" aria-label="Asset views">
                {(["Assets", "Portfolio", "P&L", "Recent Transactions"] as AssetTab[]).map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={assetTab === tab} data-active={assetTab === tab ? "true" : undefined} onClick={() => setAssetTab(tab)}>{tab}</button>
                ))}
              </div>
              <div className="dashboard-assets-tools">
                <label className="dashboard-table-search">
                  <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                  <span className="sr-only">Search assets</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." />
                </label>
                <label className="dashboard-hide-small"><input type="checkbox" checked={hideSmall} onChange={(event) => setHideSmall(event.target.checked)} /> <span>Hide small balances</span></label>
              </div>
            </div>
            <div className="dashboard-assets-table-wrap">
              <table className="dashboard-assets-table">
                <thead><tr><th>#</th><th>Asset</th><th>Total Balance</th><th>Available</th><th>In Order</th><th>USD Value <span>⌄</span></th><th>Action</th></tr></thead>
                <tbody>
                  {filteredAssets.map((asset, index) => (
                    <tr key={asset.symbol}>
                      <td>{index + 1}</td>
                      <td><span className="dashboard-asset-name"><CoinAvatar symbol={asset.symbol} size="sm" /><span><strong>{asset.symbol}</strong><small>{asset.name}</small></span></span></td>
                      <td>{asset.amount}</td>
                      <td>{asset.available}</td>
                      <td>{asset.orders}</td>
                      <td>{hidden ? "$••" : asset.value}</td>
                      <td><span className="dashboard-asset-actions"><Link href={PREVIEW_ROUTES.trade}>Trade</Link><Link href={PREVIEW_ROUTES.wallet}>Deposit</Link><Link href={PREVIEW_ROUTES.wallet}>Withdraw</Link><button type="button" aria-label={`${asset.symbol} more actions`}><HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" /></button></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAssets.length === 0 && <p className="dashboard-table-empty">No assets match this search.</p>}
            </div>
          </section>
        </div>

        <aside className="preview-dashboard-rail">
          <section className="dashboard-quick-actions-card" aria-label="Quick actions">
            <QuickAction href={PREVIEW_ROUTES.wallet} label="Deposit" icon={ArrowDownLeft01Icon} primary />
            <QuickAction href={PREVIEW_ROUTES.wallet} label="Buy Crypto" icon={CreditCardIcon} />
            <QuickAction href={PREVIEW_ROUTES.wallet} label="Withdraw" icon={ArrowUpRight01Icon} />
            <QuickAction href={PREVIEW_ROUTES.bridge} label="Transfer" icon={ArrowDataTransferHorizontalIcon} />
          </section>

          <section className="dashboard-trade-promo-card">
            <div className="dashboard-trade-promo-copy">
              <h2>Trade Anytime, Anywhere</h2>
              <p>Access 500+ cryptocurrencies with low fees and deep liquidity.</p>
              <Link href={PREVIEW_ROUTES.trade}>Trade Now <span aria-hidden>→</span></Link>
            </div>
            <PhoneIllustration />
            <div className="dashboard-promo-dots" aria-hidden><i data-active="true" /><i /><i /><i /></div>
          </section>

          <section className="dashboard-movers-card">
            <div className="dashboard-movers-heading"><h2>Top Movers</h2><Link href={PREVIEW_ROUTES.markets}>View All <span aria-hidden>→</span></Link></div>
            <div className="dashboard-mover-tabs" role="tablist" aria-label="Top movers view">
              {(["Gainers", "Losers", "New Listings"] as MoverTab[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={moverTab === tab} data-active={moverTab === tab ? "true" : undefined} onClick={() => setMoverTab(tab)}>{tab}</button>)}
            </div>
            <div className="dashboard-movers-table">
              <div className="dashboard-movers-header"><span>#</span><span>Coin</span><span>Price</span><span>24h Change</span></div>
              {MOVERS[moverTab].map((mover, index) => {
                const positive = mover.change.startsWith("+")
                return <Link href={`${PREVIEW_ROUTES.trade}?market=${mover.symbol}-USDT`} className="dashboard-mover-row" key={mover.symbol}>
                  <span>{index + 1}</span>
                  <span className="dashboard-mover-coin"><CoinAvatar symbol={mover.symbol} size="sm" /><strong>{mover.symbol}</strong><small>{mover.name}</small></span>
                  <span>{mover.price}</span>
                  <span className={positive ? "dashboard-positive" : "dashboard-negative"}>{mover.change}</span>
                </Link>
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
