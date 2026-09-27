import { readdir, readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

/**
 * Every fiat read hook must pass `retry: fiatReadRetry` to React Query so
 * reads only retry on guide §12.3's retryable statuses (0/502/503/504) and
 * never on 400/401/403/404/409/422 (guide §12.1). The policy itself is
 * tested in lib/crypto-backend/__tests__/fiat-errors.test.ts; this guards the
 * wiring so a new fiat hook can't ship with React Query's default retry.
 */

describe("fiat query hooks use the guide §12.3 retry policy", () => {
  it("every useQuery in hooks/crypto/useFiat*.ts sets retry: fiatReadRetry", async () => {
    const files = (await readdir("hooks/crypto")).filter((name) => /^useFiat.*\.ts$/.test(name))
    expect(files.length).toBeGreaterThanOrEqual(3)

    for (const file of files) {
      const source = await readFile(`hooks/crypto/${file}`, "utf8")
      const queries = source.match(/useQuery\(/g)?.length ?? 0
      const retries = source.match(/retry:\s*fiatReadRetry\b/g)?.length ?? 0
      expect(retries, `${file}: ${queries} useQuery call(s), ${retries} with retry: fiatReadRetry`).toBe(queries)
    }
  })
})
