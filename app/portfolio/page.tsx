import { PortfolioClient } from "@/components/portfolio/portfolio-client"

/**
 * Portfolio — one screen for everything you own.
 *
 * This used to be a server page that fetched the coin catalogue for a
 * watchlist, while `/assets` rendered a client that fetched the same feed
 * again for the same holdings. The two pages were the same answer twice, so
 * they are one page now and `/assets` redirects here. The client owns its own
 * data (it already polls that feed on a minute), which is why the loader and
 * its skeleton are gone rather than moved.
 */
export default function PortfolioPage() {
  return <PortfolioClient />
}
