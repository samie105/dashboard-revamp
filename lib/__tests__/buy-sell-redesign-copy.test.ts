import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The redesigned Buy / Sell screens (components/buy-sell/redesign) must not
 * name a payment provider in anything the user reads. Comments and import
 * paths may; strings and JSX text may not.
 */
const DIR = join(process.cwd(), "components/buy-sell/redesign")

function userFacing(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^import[\s\S]*?from\s+"[^"]+"\s*$/gm, "")
}

describe("redesigned buy / sell copy", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx"))

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)("%s names no provider", (file) => {
    const text = userFacing(readFileSync(join(DIR, file), "utf8"))
    expect(text).not.toMatch(/\b(OnSwitch|Bridge)\b/i)
  })
})
