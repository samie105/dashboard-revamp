/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongoose"],
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
