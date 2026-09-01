import { describe, expect, it, vi } from "vitest"
import { CryptoApi, createTimeoutFetcher } from "@/lib/crypto/api"
import { CryptoApiError } from "@/lib/crypto/client"

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

describe("CryptoApi.getAuthMe", () => {
  it("calls /v1/auth/me with the Clerk bearer token and unwraps data", async () => {
    const fetcher = vi.fn(async () =>
      envelope({ userId: "u1", clerkUserId: "c1", claims: {} }),
    ) as unknown as typeof fetch
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => "tok",
      fetcher,
    })
    const me = await api.getAuthMe()
    expect(me).toEqual({ userId: "u1", clerkUserId: "c1", claims: {} })
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe("http://localhost:3020/v1/auth/me")
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok")
  })

  it("throws CryptoApiError with the server's code on an error envelope", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "AUTH_REQUIRED", message: "no" },
          requestId: "r1",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => "tok",
      fetcher,
    })
    const err = await api.getAuthMe().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CryptoApiError)
    expect((err as CryptoApiError).code).toBe("AUTH_REQUIRED")
    expect((err as CryptoApiError).status).toBe(401)
  })

  it("throws CLERK_TOKEN_MISSING when no token is available", async () => {
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => undefined,
    })
    const err = await api.getAuthMe().catch((e: unknown) => e)
    expect((err as CryptoApiError).code).toBe("CLERK_TOKEN_MISSING")
  })
})

describe("createTimeoutFetcher", () => {
  it("aborts a request that exceeds the timeout", async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))
      })
    const fetcher = createTimeoutFetcher(20, hang)
    await expect(fetcher("http://example.test/")).rejects.toMatchObject({
      name: "TimeoutError",
    })
  })

  it("passes fast responses through untouched", async () => {
    const fast: typeof fetch = async () => envelope({ ok: true })
    const fetcher = createTimeoutFetcher(1000, fast)
    const res = await fetcher("http://example.test/")
    expect(res.status).toBe(200)
  })
})
