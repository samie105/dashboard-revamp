"use client"

/**
 * The preview's balances table (components/wallet-unauth/balances-table.tsx)
 * on the real holdings.
 *
 * Swapped for real data:
 *  · tabs are the real accounts — Spot (the wallet's holdings), Futures (the
 *    trading account's USDC, value / withdrawable / margin), and Earn, which
 *    is coming soon and says so;
 *  · Spot holdings are all free to move, so Available is the amount and In
 *    orders is 0; Futures shows its margin in use there;
 *  · a holding the feed can't price shows "—" for value and share, and one
 *    with no 24h move shows "—" for 24h;
 *  · Deposit / Withdraw / Transfer link into the Move funds panel (a Futures
 *    row's Deposit and Withdraw are transfers in and out of it).
 * Added: the loading skeleton, the balance error / outage notices the old
 * card carried, and the "no balances yet" state with its Deposit action.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ChangeChip, Figure, Icon, Panel, PanelTitle, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { usd } from "@/lib/num"
import { countBalanceRows, filterBalanceRows, walletActionHref, type WalletAction, type WalletRow } from "@/lib/wallet-view"

const ACCOUNT_LABEL: Record<WalletRow["account"], string> = { spot: "Spot", futures: "Futures", earn: "Earn" }

function RowAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="relative text-[13px] font-semibold text-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 hover:after:scale-x-100"
    >
      {children}
    </Link>
  )
}

function SkeletonTable() {
  return (
    <ul className="flex flex-col gap-1 px-4 py-3 md:px-6" aria-label="Reading your balances">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex h-[64px] items-center gap-3">
          <span className="skel size-8 shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="skel h-3.5 w-16 rounded" />
            <span className="skel h-3 w-28 rounded" />
          </span>
          <span className="skel h-4 w-24 rounded" />
        </li>
      ))}
    </ul>
  )
}

export function BalancesTable({
  rows: all,
  tabs: accountTabs,
  loading,
  notices,
}: {
  rows: WalletRow[]
  /** The accounts to offer as tabs, in display order. */
  tabs: { key: string; label: string; soon?: boolean }[]
  loading: boolean
  /** Balance errors and network outages, rendered above the list. */
  notices?: React.ReactNode
}) {
  const pathname = usePathname()
  const [tab, setTab] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [hideZero, setHideZero] = React.useState(true)
  /** A row's action. On a Futures row, Deposit and Withdraw move money in and
   *  out of that account, which is a transfer. */
  const href = (a: WalletAction, r: WalletRow) =>
    r.account === "futures"
      ? walletActionHref(pathname, "transfer", r.symbol, a === "withdraw" ? "futures" : "spot")
      : walletActionHref(pathname, a, r.symbol, a === "transfer" ? "spot" : undefined)
  const earnTab = accountTabs.find((t) => t.key === tab)?.soon

  const q = query.trim()
  const rows = filterBalanceRows(all, { tab, query, hideZero })

  const tabs = [{ key: "all", label: "All" }, ...accountTabs].map((t) => ({
    key: t.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {t.label}
        <span className="rounded-md bg-foreground/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{countBalanceRows(all, t.key, hideZero)}</span>
      </span>
    ),
  }))

  return (
    <Panel className="pb-2">
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle className="text-[17px]">Balances</PanelTitle>
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40 sm:w-[220px] sm:flex-none">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
              <span className="sr-only">Search balances</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search coins…"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <Icon icon={Cancel01Icon} className="size-4" />
                </button>
              )}
            </label>
            <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[13px] text-foreground/80">
              <input type="checkbox" className="peer sr-only" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
              <span className="flex size-[18px] items-center justify-center rounded-[5px] border border-foreground/20 text-transparent transition-all duration-200 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                <Icon icon={Tick02Icon} className="size-3" strokeWidth={3} />
              </span>
              Hide zero
            </label>
          </div>
        </div>
        <div className="border-b border-foreground/[0.06]">
          <UnderlineTabs id="wallet-accounts" options={tabs} value={tab} onChange={setTab} className="scrollbar-none -mx-1 overflow-x-auto" />
        </div>
        {notices}
      </div>

      {loading ? (
        <SkeletonTable />
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
          <p className="text-[14px] font-semibold text-foreground">No balances yet</p>
          <p className="text-[13px] text-muted-foreground">Deposit crypto to get started.</p>
          <Link href={walletActionHref(pathname, "deposit")} scroll={false} className="mt-2 text-[13px] font-semibold text-primary hover:opacity-85">
            Deposit
          </Link>
        </div>
      ) : earnTab ? (
        <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
          <p className="text-[14px] font-semibold text-foreground">Earn is coming soon</p>
          <p className="text-[13px] text-muted-foreground">Staking and savings will show here once they open.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
          <p className="text-[14px] font-semibold text-foreground">{q ? `No coins match “${q}”` : "Nothing in this account yet"}</p>
          <p className="text-[13px] text-muted-foreground">{q ? "Try a ticker like ETH, or a network like Solana." : "Deposit, or transfer in from another account."}</p>
        </div>
      ) : (
        <>
          <div className="hidden pt-2 md:block">
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="whitespace-nowrap text-[12px] font-medium text-muted-foreground">
                  <th className="py-3 pl-6 font-medium">Asset</th>
                  <th className="hidden py-3 pr-4 font-medium xl:table-cell">Network</th>
                  <th className="py-3 pr-4 text-right font-medium">Total</th>
                  <th className="hidden py-3 pr-4 text-right font-medium 2xl:table-cell">Available</th>
                  <th className="hidden py-3 pr-4 text-right font-medium 2xl:table-cell">In orders</th>
                  <th className="py-3 pr-4 text-right font-medium">Value</th>
                  <th className="hidden py-3 pr-4 text-right font-medium lg:table-cell">24h</th>
                  <th className="w-[240px] py-3 pr-6 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((r) => (
                    <motion.tr
                      key={r.key}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="group text-[13.5px] tabular-nums"
                    >
                      <td className="ds-cell h-[64px] pl-6">
                        <span className="flex items-center gap-3">
                          <CoinAvatar symbol={r.symbol} src={r.logo} size="lg" className="size-8 ring-1 ring-foreground/10" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-semibold text-foreground">{r.symbol}</span>
                            <span className="truncate text-[12px] text-muted-foreground">
                              {r.account === "spot" ? `${r.network} · Spot` : `${ACCOUNT_LABEL[r.account]} account`}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="ds-cell hidden whitespace-nowrap pr-4 text-[13px] text-muted-foreground xl:table-cell">{r.network}</td>
                      <td className="ds-cell pr-4 text-right text-foreground/90"><Figure mask="••••">{r.amount}</Figure></td>
                      <td className="ds-cell hidden pr-4 text-right text-foreground/90 2xl:table-cell"><Figure mask="••••">{r.available ?? r.amount}</Figure></td>
                      <td className="ds-cell hidden pr-4 text-right text-foreground/60 2xl:table-cell"><Figure mask="••••">{r.held ?? "0"}</Figure></td>
                      <td className="ds-cell pr-4 text-right">
                        <span className="flex flex-col items-end gap-1.5">
                          <span className="font-semibold text-foreground">{r.value === null ? "—" : <Figure>{usd(r.value)}</Figure>}</span>
                          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-foreground/[0.06]">
                            {r.share !== null && (
                              <motion.span
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: Math.max(r.share, 0.5) / 100 }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0 origin-left rounded-full bg-primary/80"
                              />
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="ds-cell hidden pr-4 text-right lg:table-cell">
                        {r.change === undefined ? <span className="text-muted-foreground">—</span> : <ChangeChip value={r.change} size="sm" />}
                      </td>
                      <td className="ds-cell pr-6">
                        <span className="flex items-center justify-end gap-5">
                          <RowAction href={href("deposit", r)}>Deposit</RowAction>
                          <RowAction href={href("withdraw", r)}>Withdraw</RowAction>
                          <RowAction href={href("transfer", r)}>Transfer</RowAction>
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col pt-1 md:hidden">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-col gap-3 border-t border-foreground/[0.05] px-4 py-3.5 first:border-t-0">
                <div className="flex items-center gap-3">
                  <CoinAvatar symbol={r.symbol} src={r.logo} size="lg" className="size-9 ring-1 ring-foreground/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[14px] font-semibold text-foreground">{r.symbol}</span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {r.account === "spot" ? `Spot · ${r.network}` : `${ACCOUNT_LABEL[r.account]} account`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end leading-tight tabular-nums">
                    <span className="text-[14px] font-semibold text-foreground">{r.value === null ? "—" : <Figure>{usd(r.value)}</Figure>}</span>
                    <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{r.amount}</Figure></span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["deposit", "withdraw", "transfer"] as const).map((a) => (
                    <Link
                      key={a}
                      href={href(a, r)}
                      scroll={false}
                      className="flex h-9 items-center justify-center rounded-lg border border-foreground/[0.07] text-[12.5px] font-semibold capitalize text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary"
                    >
                      {a}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
