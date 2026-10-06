"use client"

/**
 * Balances — every coin, by account, with what is free to move.
 *
 * Each row's Deposit / Withdraw / Transfer is a link into the action panel
 * with that coin pre-selected (`?action=withdraw&asset=SOL`), so acting on a
 * row never means re-finding the coin in a form.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ACCOUNTS, BALANCE_ROWS, formatAmount, formatUSD, type AccountKey } from "@/components/wallet-unauth/wallet-data"
import { walletHref } from "@/components/preview/routes"
import { ChangeChip, Figure, Icon, Panel, PanelTitle, UnderlineTabs } from "@/components/redesign/ui"

type Tab = AccountKey | "all"

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

export function BalancesTable() {
  const [tab, setTab] = React.useState<Tab>("all")
  const [query, setQuery] = React.useState("")
  const [hideZero, setHideZero] = React.useState(true)

  const q = query.trim().toLowerCase()
  const rows = BALANCE_ROWS.filter(
    (r) =>
      (tab === "all" || r.account === tab) &&
      (!hideZero || r.value > 0) &&
      (!q || r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
  )

  const count = (k: Tab) => BALANCE_ROWS.filter((r) => (k === "all" || r.account === k) && (!hideZero || r.value > 0)).length
  const tabs = [{ key: "all" as Tab, label: "All" }, ...ACCOUNTS.map((a) => ({ key: a.key as Tab, label: a.label }))].map((t) => ({
    key: t.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {t.label}
        <span className="rounded-md bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{count(t.key)}</span>
      </span>
    ),
  }))

  return (
    <Panel className="pb-2">
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle className="text-[17px]">Balances</PanelTitle>
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 transition-colors focus-within:border-primary/40 sm:w-[220px] sm:flex-none">
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
              <span className="flex size-[18px] items-center justify-center rounded-[5px] border border-white/20 text-transparent transition-all duration-200 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                <Icon icon={Tick02Icon} className="size-3" strokeWidth={3} />
              </span>
              Hide zero
            </label>
          </div>
        </div>
        <div className="border-b border-white/[0.06]">
          <UnderlineTabs id="wallet-accounts" options={tabs} value={tab} onChange={setTab} className="scrollbar-none -mx-1 overflow-x-auto" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
          <p className="text-[14px] font-semibold text-foreground">{q ? `No coins match “${query}”` : "Nothing in this account yet"}</p>
          <p className="text-[13px] text-muted-foreground">{q ? "Try a ticker like BTC, or a name like Solana." : "Deposit, or transfer in from another account."}</p>
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
                      key={`${r.symbol}-${r.account}`}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="group text-[13.5px] tabular-nums"
                    >
                      <td className="dash-cell h-[64px] pl-6">
                        <span className="flex items-center gap-3">
                          <CoinAvatar symbol={r.symbol} size="lg" className="size-8 ring-1 ring-white/10" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-semibold text-foreground">{r.symbol}</span>
                            <span className="truncate text-[12px] text-muted-foreground">
                              {r.name} · {ACCOUNTS.find((a) => a.key === r.account)?.label}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="dash-cell hidden pr-4 text-[13px] text-muted-foreground xl:table-cell">{r.network}</td>
                      <td className="dash-cell pr-4 text-right text-foreground/90"><Figure mask="••••">{formatAmount(r.total)}</Figure></td>
                      <td className="dash-cell hidden pr-4 text-right text-foreground/90 2xl:table-cell"><Figure mask="••••">{formatAmount(r.available)}</Figure></td>
                      <td className="dash-cell hidden pr-4 text-right text-foreground/60 2xl:table-cell"><Figure mask="••••">{formatAmount(r.inOrder + r.locked)}</Figure></td>
                      <td className="dash-cell pr-4 text-right">
                        <span className="flex flex-col items-end gap-1.5">
                          <span className="font-semibold text-foreground"><Figure>{formatUSD(r.value)}</Figure></span>
                          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.span
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: Math.max(r.share, 0.5) / 100 }}
                              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute inset-0 origin-left rounded-full bg-primary/80"
                            />
                          </span>
                        </span>
                      </td>
                      <td className="dash-cell hidden pr-4 text-right lg:table-cell">
                        <ChangeChip value={r.changePct} size="sm" />
                      </td>
                      <td className="dash-cell pr-6">
                        <span className="flex items-center justify-end gap-5">
                          <RowAction href={walletHref("deposit", r.symbol)}>Deposit</RowAction>
                          <RowAction href={walletHref("withdraw", r.symbol)}>Withdraw</RowAction>
                          <RowAction href={walletHref("transfer", r.symbol)}>Transfer</RowAction>
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
              <li key={`${r.symbol}-${r.account}`} className="flex flex-col gap-3 border-t border-white/[0.05] px-4 py-3.5 first:border-t-0">
                <div className="flex items-center gap-3">
                  <CoinAvatar symbol={r.symbol} size="lg" className="size-9 ring-1 ring-white/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[14px] font-semibold text-foreground">{r.symbol}</span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {ACCOUNTS.find((a) => a.key === r.account)?.label} · {r.network}
                    </span>
                  </span>
                  <span className="flex flex-col items-end leading-tight tabular-nums">
                    <span className="text-[14px] font-semibold text-foreground"><Figure>{formatUSD(r.value)}</Figure></span>
                    <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{formatAmount(r.total)}</Figure></span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["deposit", "withdraw", "transfer"] as const).map((a) => (
                    <Link
                      key={a}
                      href={walletHref(a, r.symbol)}
                      scroll={false}
                      className="flex h-9 items-center justify-center rounded-lg border border-white/[0.07] text-[12.5px] font-semibold capitalize text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary"
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
