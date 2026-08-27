import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()
const remoteBase = process.env.CRYPTO_API_URL || "https://crypto-backend.worldstreetgold.com"
const localProxyBase = process.env.CRYPTO_PROXY_URL

async function check(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } })
  const body = await response.text()
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${body.slice(0, 180)}`)
  console.log(`PASS ${url} (${response.status})`)
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path)
  }
  return files
}

await check(`${remoteBase.replace(/\/$/, "")}/health`)
await check(`${remoteBase.replace(/\/$/, "")}/ready`)
if (localProxyBase) {
  await check(`${localProxyBase.replace(/\/$/, "")}/api/crypto/health`)
  await check(`${localProxyBase.replace(/\/$/, "")}/api/crypto/ready`)
}

const modernRoots = ["components/crypto", "hooks/crypto", "lib/crypto-backend", "lib/crypto-wallet", "app/api/crypto"]
const modernFiles = (await Promise.all(modernRoots.map((directory) => filesUnder(join(root, directory))))).flat()
const violations = []
for (const file of modernFiles) {
  const source = await readFile(file, "utf8")
  if (/import[\s\S]{0,160}from\s+["'][^"']*privy/i.test(source)) violations.push(file)
}
if (violations.length > 0) throw new Error(`Modern crypto files import Privy: ${violations.join(", ")}`)
console.log(`PASS modern boundary scan (${modernFiles.length} files, no Privy imports)`)
