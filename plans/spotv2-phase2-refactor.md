# Refactor: SpotV2 Phase 2 — Replace Data Sources

> Copy this into a GitHub issue when ready.

---

## Problem Statement

The SpotV2 page (`/spotv2`) has three critical data-source failures that make Phase 2 non-functional in production:

1. **Pairs API returns empty data**: The CoinGecko free API is rate-limited and frequently returns empty results on Vercel, causing the entire page to render with "No pairs found" and all downstream panels (chart, order book, trades) to show placeholder states.

2. **Chart loads extremely slowly**: The DEXScreener iframe embed loads DEXScreener's full application (~2-3s+), showing a blank panel for an extended period before rendering. There is no loading indicator, so users see an empty black box.

3. **Order book and recent trades are permanently broken**: The Binance WebSocket (`wss://stream.binance.com:9443/stream`) rejects browser connections from non-whitelisted origins (Vercel deployment domain). The `useBinanceStreams` hook connects directly from the browser, which fails with a WebSocket connection error. This means order book and recent trades never populate.

## Solution

Replace all three external data sources with more reliable alternatives:

1. **CoinGecko → CoinMarketCap API** for pair data — more generous free tier (10K calls/month), reliable on server-side, same data shape.

2. **DEXScreener iframe → TradingView Advanced Chart Widget** — fast-loading lightweight JavaScript widget (not an iframe), dark theme, minimal toolbar (option A), shows Binance CEX candle data as a price proxy.

3. **Browser Binance WebSocket → Server-side SSE proxy** — a Next.js API route opens a server-side WebSocket to Binance (no CORS issues), then streams order book + trade data to the client via Server-Sent Events (SSE). The client consumes the SSE stream with `EventSource`, giving near-real-time updates without the browser-origin restriction.

## Commits

### Commit 1: Add CoinMarketCap pairs API route

Replace the CoinGecko fetch in `app/api/spotv2/pairs/route.ts` with CoinMarketCap's `/v1/cryptocurrency/listings/latest` endpoint. Keep the same response shape (`SpotV2Pair[]`), same 1h server-side cache, same stablecoin filtering, same `TOKEN_CHAIN_MAP` for chain resolution. Add a hardcoded fallback list of the top 20 tokens (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, LINK, SHIB, UNI, MATIC, ARB, OP, ATOM, NEAR, APT, PEPE, AAVE) with approximate prices so the page never loads empty, even if CMC is down. Read the API key from `process.env.CMC_API_KEY`. Update `next.config.mjs` to allow CMC image domains. Verify the existing pair sidebar, pair types, and client code work without changes (same contract).

### Commit 2: Create TradingView chart component

Create a new `components/spotv2/tradingview-chart.tsx` client component. It renders a `<div>` container and uses `useEffect` + `useRef` to inject TradingView's embed widget script (`s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`). Props: `symbol` (e.g. "BTC"), `theme` ("dark"). The widget config should use: Binance as the exchange (symbol = `BINANCE:${symbol}USDT`), dark theme, interval "1H", hide_side_toolbar = true, hide_top_toolbar = false (just timeframes), allow_symbol_change = false, style = "1" (candlesticks), timezone = "Etc/UTC", withdateranges = true. The component should clean up the script/container on symbol change and unmount. Include a loading skeleton that shows while the widget initializes.

### Commit 3: Wire TradingView chart into SpotV2 client

Replace the `DexScreenerChart` import and usage in `spotv2-client.tsx` with the new `TradingViewChart` component. Pass the selected pair's symbol. Remove the `chain` and `contractAddress` props from the chart panel since TradingView uses Binance symbols, not on-chain addresses.

### Commit 4: Remove DEXScreener chart and utilities

Delete `components/spotv2/dexscreener-chart.tsx`. Remove `getDexScreenerUrl`, `DEXSCREENER_CHAINS`, and `NATIVE_TO_WRAPPED` from `lib/spotv2/binance.ts` (keep `toBinanceSymbol` — still needed for the SSE proxy). Clean up any unused imports.

### Commit 5: Create server-side Binance SSE proxy route

Create `app/api/spotv2/stream/route.ts`. This route accepts a GET request with `?symbol=BTC` query param. It opens a server-side WebSocket to `wss://stream.binance.com:9443/stream?streams={symbol}@depth20@100ms/{symbol}@trade` (using the `toBinanceSymbol` mapper). It returns a streaming `Response` with `Content-Type: text/event-stream`. Each Binance message is parsed and forwarded as an SSE event: `event: depth\ndata: {bids, asks}\n\n` or `event: trade\ndata: {id, price, qty, time, isBuyerMaker}\n\n`. The route should handle WebSocket errors gracefully, send a heartbeat comment every 15 seconds to keep the connection alive, and close the Binance WS when the client disconnects (using the `AbortSignal` from the request). Use the `ReadableStream` + `TextEncoder` pattern already proven in the Vivid chat API.

### Commit 6: Create SSE-based market data hook

Create `hooks/useMarketDataSSE.ts` — a client hook that replaces `useBinanceStreams`. It opens an `EventSource` to `/api/spotv2/stream?symbol={symbol}`. It listens for `depth` and `trade` events, parses them into the same `OrderBookLevel[]` and `TradeTick[]` shapes. It exports the same interface: `{ bids, asks, trades, connected, unavailable }`. It handles reconnection on error (with 3-second delay), cleans up on symbol change or unmount, and sets `unavailable = true` after 3 consecutive failures. Include a `connected` state that reflects the `EventSource.readyState`.

### Commit 7: Wire SSE hook into SpotV2 client, delete old WS hook

Replace the `useBinanceStreams` import in `spotv2-client.tsx` with `useMarketDataSSE`. The order book and recent trades components receive the same props, so no changes needed to `order-book.tsx` or `recent-trades.tsx`. Delete `hooks/useBinanceStreams.ts`. Remove the `toBinanceSymbol` import from the deleted hook (it's now only used server-side in the SSE route).

### Commit 8: Update spotv2 plan and verify

Update `plans/spotv2.md` Phase 2 section to reflect the new data sources (CoinMarketCap, TradingView, Binance SSE proxy). Verify the build passes (`next build`). Smoke-test: load `/spotv2`, confirm pairs populate immediately, chart renders within 1 second, order book and trades stream live data.

## Decision Document

### Data Source Decisions
- **CoinMarketCap over CoinGecko**: CMC free tier offers 10K monthly calls (sufficient with 1h cache). CoinGecko's free tier is too aggressively rate-limited for production Vercel deployments. The response shape is different but maps to the same `SpotV2Pair` interface.
- **Hardcoded fallback pairs**: The API route will include a static list of ~20 top tokens with approximate prices. If CMC is down, the page still loads with stale-but-valid data. This prevents the "No pairs found" state entirely.
- **CMC API key via `CMC_API_KEY` env var**: Required. Free tier at coinmarketcap.com/api.

### Chart Decisions
- **TradingView widget over DEXScreener**: TradingView loads as a lightweight JS widget (not an iframe of a full app), renders in under 1 second, and provides candlestick charts with volume, indicators, and timeframe selection — all built in. Uses Binance CEX data as a price proxy, which is acceptable since the same tokens trade at similar prices on DEXes.
- **Minimal toolbar (Option A)**: Side toolbar hidden, top toolbar shows only timeframes. No drawing tools panel. Symbol change disabled (controlled by sidebar selection). Dark theme matching the app.
- **Script injection pattern**: The TradingView widget is loaded via script tag injection in `useEffect`, with proper cleanup on re-render. This is the standard integration pattern for the free TradingView widget.

### Order Book & Trades Decisions
- **Server-side SSE proxy over direct browser WebSocket**: Binance blocks browser WebSocket connections from non-whitelisted origins. A server-side proxy has no such restriction. SSE (Server-Sent Events) was chosen over polling because it provides near-real-time updates (sub-200ms latency) with a persistent connection, matching the WebSocket experience.
- **SSE over WebSocket server**: Next.js App Router doesn't support custom WebSocket servers natively. SSE works with standard HTTP responses and the existing `ReadableStream` pattern already used in the Vivid chat API.
- **EventSource on the client**: Native browser API, automatic reconnection built in, simpler than managing a WebSocket. Falls back gracefully.
- **Same data contract**: The SSE hook exports the identical `{ bids, asks, trades, connected, unavailable }` shape, so `order-book.tsx` and `recent-trades.tsx` require zero changes.

### Architecture Decisions
- **Binance symbol mapper (`toBinanceSymbol`) stays in `lib/spotv2/binance.ts`**: Both the TradingView chart and SSE proxy need to convert platform symbols to Binance format. The DEXScreener-specific utilities are removed.
- **No new npm dependencies**: TradingView widget is loaded via CDN script. EventSource is a native browser API. CoinMarketCap is a REST call. No packages to install.
- **Pair sidebar, layout, types — unchanged**: The refactor only touches data sources. The UI components (pair-sidebar, order-book, recent-trades, layout in spotv2-client) keep their existing interfaces and visual design.

### Image Domain
- CoinMarketCap serves token logos from `s2.coinmarketcap.com`. This domain must be added to `next.config.mjs` `images.remotePatterns`.

## Testing Decisions

There is no test infrastructure in this project (no jest, vitest, or playwright configured). Manual testing is the approach for this refactor:

- **Pairs API**: Verify `/api/spotv2/pairs` returns 85+ pairs with valid prices, images, and chain mappings. Verify fallback kicks in when `CMC_API_KEY` is not set or CMC returns an error.
- **TradingView chart**: Verify the chart renders within 1 second of pair selection. Verify it updates when switching pairs. Verify dark theme matches. Verify no console errors.
- **SSE stream**: Verify `/api/spotv2/stream?symbol=BTC` sends depth and trade events in the browser's EventSource inspector. Verify order book levels update in real-time. Verify recent trades appear with buy/sell coloring. Verify switching pairs re-subscribes cleanly.
- **Edge cases**: Verify pairs not on Binance (e.g. WIF) show "unavailable" gracefully. Verify the SSE connection reconnects after network interruption.

If test infrastructure is added later, the natural test boundaries would be:
- Unit tests for `toBinanceSymbol` mapping (pure function)
- Integration test for `/api/spotv2/pairs` route (mock CMC response)
- Integration test for `/api/spotv2/stream` route (mock Binance WS, verify SSE output)

## Out of Scope

- **Order execution (Phase 3)**: The buy/sell form remains a placeholder.
- **Li.Fi integration**: No trade execution in this refactor.
- **Limit orders**: Market orders only per plan.
- **Positions / PnL / History (Phase 5)**: Bottom panel stays as placeholder.
- **Cross-chain trading (Phase 4)**: Not addressed.
- **Withdrawals (Phase 6)**: Not addressed.
- **Test infrastructure setup**: No testing framework will be added in this refactor.
- **Mobile layout changes**: The mobile stacked layout is unaffected.
- **Pair sidebar redesign**: The sidebar component is unchanged.
- **WebSocket server (custom Next.js server)**: We use SSE within the standard App Router, not a custom server.

## Further Notes

- The SSE proxy route will run as a long-lived serverless function on Vercel. Vercel's function timeout (default 10s on Hobby, 60s on Pro) may terminate the connection. If the user is on Hobby plan, the SSE stream will disconnect every ~10 seconds and `EventSource` will auto-reconnect. This is acceptable for Phase 2 — the reconnection is seamless. For production, consider upgrading to Vercel Pro or using Vercel's streaming function support.
- TradingView's free widget has a "TradingView" watermark in the bottom-right corner. This is required by their terms of service for the free tier.
- The `TOKEN_CHAIN_MAP` in the pairs route is preserved — it's still needed for Phase 3 (Li.Fi trade execution uses chain + contract address).
