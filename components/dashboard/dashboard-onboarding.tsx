"use client"

import * as React from "react"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { fetchProfile, markOnboardingComplete } from "@/lib/profile-actions"

const DASHBOARD_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="dash-greeting"]',
    title: "Welcome to Worldstreet",
    description:
      "This is your home base. A quick hello up here — your money is the headline, right below.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-actions"]',
    title: "Quick Actions",
    description:
      "Deposit and withdraw without leaving this page. Each one asks where the money is coming from first — your Dollar Account, or crypto you already own.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-balance-cards"]',
    title: "Your Balances",
    /* Rewritten 2026-09-03 with the accounts themselves. It used to promise a
       "Main and Spot breakdown always in view", and both halves of that are
       now wrong: Main is called Holdings, and the cards are earned rather
       than permanent — a brand-new account sees none of them. Describing a
       card someone is not looking at is worse than describing nothing. */
    description:
      "Holdings is what you keep in your wallet. Spot is what you have moved onto the market to trade with. Each card appears once there is something in it, so this fills in as you go.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="dash-activity"]',
    title: "Activity",
    description:
      "Anything still in flight stays pinned here until it lands, with your latest movements underneath. Open View all for the full history.",
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
    target: '[data-onboarding="dash-watchlist"]',
    title: "Your Watchlist",
    description:
      "Assets you've starred appear here with live prices. Head to the Spot page to add more to your watchlist.",
    placement: "left",
  },
  {
    target: '[data-onboarding="dash-trades"]',
    title: "Recent Trades",
    description:
      "Your latest spot fills, right next to the swap desk so you can act on them.",
    placement: "top",
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
