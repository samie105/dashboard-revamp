import { NextRequest } from "next/server"
import { toBinanceSymbol } from "@/lib/spotv2/binance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream"
const HEARTBEAT_INTERVAL = 15_000

/**
 * SSE proxy: opens a server-side WebSocket to Binance and streams
 * order-book depth + trade data to the browser via Server-Sent Events.
 *
 * Usage: GET /api/spotv2/stream?symbol=BTC
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol query param required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const binanceSymbol = toBinanceSymbol(symbol)
  const depthStream = `${binanceSymbol}@depth20@100ms`
  const tradeStream = `${binanceSymbol}@trade`
  const wsUrl = `${BINANCE_WS_BASE}?streams=${depthStream}/${tradeStream}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let ws: WebSocket | null = null
      let heartbeat: ReturnType<typeof setInterval> | null = null
      let closed = false

      function cleanup() {
        if (closed) return
        closed = true
        if (heartbeat) clearInterval(heartbeat)
        if (ws && ws.readyState !== WebSocket.CLOSED) {
          ws.close()
        }
      }

      // Close when the client disconnects
      req.signal.addEventListener("abort", cleanup)

      try {
        ws = new WebSocket(wsUrl)
      } catch {
        controller.enqueue(encoder.encode("event: error\ndata: {\"message\":\"Failed to connect to Binance\"}\n\n"))
        controller.close()
        return
      }

      ws.onopen = () => {
        // Send initial connected event
        controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"))

        // Heartbeat to keep the SSE connection alive
        heartbeat = setInterval(() => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"))
          } catch {
            cleanup()
          }
        }, HEARTBEAT_INTERVAL)
      }

      ws.onmessage = (evt: MessageEvent) => {
        if (closed) return

        try {
          const msg = JSON.parse(typeof evt.data === "string" ? evt.data : evt.data.toString())
          const streamName = msg.stream as string
          const data = msg.data

          if (streamName?.includes("@depth20")) {
            const payload = JSON.stringify({
              bids: (data.bids ?? []).map(([p, a]: [string, string]) => [parseFloat(p), parseFloat(a)]),
              asks: (data.asks ?? []).map(([p, a]: [string, string]) => [parseFloat(p), parseFloat(a)]),
            })
            controller.enqueue(encoder.encode(`event: depth\ndata: ${payload}\n\n`))
          }

          if (streamName?.includes("@trade")) {
            const payload = JSON.stringify({
              id: data.t,
              price: parseFloat(data.p),
              qty: parseFloat(data.q),
              time: data.T,
              isBuyerMaker: data.m,
            })
            controller.enqueue(encoder.encode(`event: trade\ndata: ${payload}\n\n`))
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onerror = () => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode("event: error\ndata: {\"message\":\"Binance WebSocket error\"}\n\n"))
        } catch {
          // Controller may already be closed
        }
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      }

      ws.onclose = () => {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
