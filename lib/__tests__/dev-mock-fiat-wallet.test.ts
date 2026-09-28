import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Dev mock only: with FIAT_MOCKS_ENABLED on, a mock user with no wallet gets a
 * ready modern wallet from GET /wallets/me, so the Buy flow can be tested
 * locally. With the flag off the mock still answers 404 and the real setup
 * ceremony runs as before. (The flag itself is proven false in production
 * builds by fiat-mocks-gate.test.ts.)
 */

async function loadMock(fiatMocks: boolean) {
  vi.resetModules()
  vi.doMock("@/lib/fiat-mocks", () => ({ FIAT_MOCKS_ENABLED: fiatMocks }))
  const mock = await import("@/lib/dev-mock-crypto-backend")
  mock.resetMockCryptoState()
  return mock
}

async function getWallet(fiatMocks: boolean) {
  const { devMockCryptoApiResponse } = await loadMock(fiatMocks)
  const response = await devMockCryptoApiResponse(
    new Request("https://dashboard.test/api/crypto/wallets/me"),
    "wallets/me",
  )
  if (!response) throw new Error("mock did not answer wallets/me")
  return { status: response.status, body: await response.json() }
}

afterEach(() => {
  vi.doUnmock("@/lib/fiat-mocks")
  vi.resetModules()
})

describe("dev mock GET /wallets/me", () => {
  it("returns a ready wallet with the guide's example id when fiat mocks are on", async () => {
    const { status, body } = await getWallet(true)
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe("66f000000000000000000041")
    expect(body.data.status).toBe("active")
    expect(body.data.accounts).toEqual([])
  })

  it("still returns 404 WALLET_NOT_FOUND when fiat mocks are off, so the setup ceremony runs as before", async () => {
    const { status, body } = await getWallet(false)
    expect(status).toBe(404)
    expect(body.error.code).toBe("WALLET_NOT_FOUND")
  })

  it("doesn't store the ready wallet, so a later real setup creates its own", async () => {
    const mock = await loadMock(true)
    const created = await mock.devMockCryptoApiResponse(
      new Request("https://dashboard.test/api/crypto/wallets", { method: "POST" }),
      "wallets",
    )
    const createdBody = await created!.json()
    expect(createdBody.data.id).not.toBe("66f000000000000000000041")

    const after = await mock.devMockCryptoApiResponse(
      new Request("https://dashboard.test/api/crypto/wallets/me"),
      "wallets/me",
    )
    expect((await after!.json()).data.id).toBe(createdBody.data.id)
  })
})
