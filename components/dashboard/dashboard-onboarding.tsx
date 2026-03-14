"use client"

import * as React from "react"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { fetchProfile, markOnboardingComplete } from "@/lib/profile-actions"

const DASHBOARD_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="dash-greeting"]',
    title: "Welcome to Worldstreet",
    description:
      "This is your home base. You'll see a quick greeting, your name, and a snapshot of your portfolio status.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-actions"]',
    title: "Quick Actions",
    description:
      "Deposit funds into your wallet or withdraw to your bank in a few clicks — right from the dashboard.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-balance"]',
    title: "Your Balances",
    description:
      "Switch between Total, Main, Spot, and Futures views to see the breakdown of each wallet. Balances update in real-time.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-stats"]',
    title: "Portfolio Stats",
    description:
      "Track today's P&L, active tokens held, and the number of networks your wallets are spread across.",
    placement: "top",
  },
  {
    target: '[data-onboarding="dash-markets"]',
    title: "Live Markets",
    description:
      "Browse all available trading pairs with live prices. Filter by Hot, Gainers, Losers, or search for a specific coin.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-trades"]',
    title: "Recent Market Trades",
    description:
      "See real-time trades happening on the exchange. Switch between BTC, ETH, and SOL to follow different markets.",
    placement: "top",
  },
  {
    target: '[data-onboarding="dash-watchlist"]',
    title: "Your Watchlist",
    description:
      "Assets you've starred appear here with live prices. Head to the Spot page to add more to your watchlist.",
    placement: "left",
  },
]

const STORAGE_KEY = "dashboard"

export function DashboardOnboarding() {
  const [completed, setCompleted] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    fetchProfile()
      .then((result) => {
        if (result.success && result.profile) {
          setCompleted(result.profile.onboardingCompleted?.includes(STORAGE_KEY) ?? false)
        } else {
          setCompleted(false)
        }
      })
      .catch(() => setCompleted(false))
  }, [])

  if (completed === undefined) return null

  return (
    <OnboardingFlow
      steps={DASHBOARD_STEPS}
      storageKey={STORAGE_KEY}
      completed={completed}
      onComplete={() => markOnboardingComplete(STORAGE_KEY)}
    />
  )
}
