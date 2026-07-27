/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongoose"],
  // Nav menus link to account pages that don't exist yet — land somewhere
  // sensible instead of a 404 until those pages are built.
  async redirects() {
    return [
      { source: "/profile", destination: "/dashboard", permanent: false },
      { source: "/settings", destination: "/dashboard", permanent: false },
      { source: "/security", destination: "/dashboard", permanent: false },
      { source: "/verification", destination: "/dashboard", permanent: false },
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
