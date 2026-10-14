/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ship only the traced server + its modules. The Dockerfile copies
  // .next/standalone, so node_modules never reaches the runtime image.
  output: "standalone",
  serverExternalPackages: ["mongoose"],
  // The isolated dashboard-test image is built on the small Watchup VPS.
  // Keep its static-generation worker count bounded without changing the
  // normal production build profile.
  experimental:
    process.env.NEXT_PUBLIC_WORLDSTREET_DASHBOARD_TEST_MODE === "true"
      ? { cpus: 1 }
      : undefined,
  // Nav menus link to account pages that don't exist yet — land somewhere
  // sensible instead of a 404 until those pages are built.
  async redirects() {
    return [
      { source: "/security", destination: "/dashboard", permanent: false },
      // KYC lives on the hub, which owns the Didit flow — send deep links and
      // bookmarks there rather than bouncing them to the dashboard.
      { source: "/verification", destination: "https://www.worldstreetgold.com/verification", permanent: false },
      { source: "/transfer", destination: "/fund", permanent: false },
      { source: "/futures", destination: "/trade?market=futures", permanent: false },
      { source: "/spotv2", destination: "/trade?market=spot", permanent: false },
      { source: "/deposit", destination: "/buy", permanent: false },
      { source: "/withdraw", destination: "/sell", permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "s2.coinmarketcap.com" },
      { protocol: "https", hostname: "cryptologos.cc" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "pub-5e1c5c5bc64e4f0c9ba97982fb529df0.r2.dev" },
    ],
  },
}

export default nextConfig
