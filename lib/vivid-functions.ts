import {
  createVividFunction,
  buildParameters,
  stringParam,
  enumParam,
  numberParam,
  booleanParam,
} from '@worldstreet/vivid-voice/functions'
import type { VoiceFunctionConfig } from '@worldstreet/vivid-voice/functions'
import {
  DESTINATION_IDS,
  PANEL_IDS,
  describeDestinations,
  describePanels,
  findDestination,
  findPanel,
} from './vivid-destinations'
import { getPageInfo, readLiveContext } from './vivid-page-context'
import {
  DEFAULT_HOLD_MS,
  GUARD_ATTR,
  listTargets,
  missReport,
  performScroll,
  scrollToTarget,
  setNativeInput,
  setSpotlight,
  waitForPanelSettle,
  waitForTarget,
} from './vivid-page-control'
import { runWebSearch } from './vivid/web-search'

/** sessionStorage key used to replay a panel request across a navigation. */
export const PENDING_PANEL_KEY = 'vivid:pending-panel'

// =============================================================================
// Constants
// =============================================================================

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const BACKEND_URL = 'https://trading.watchup.site'

// Forex rate cache (module-level, 60s TTL)
let _forexCache: { rates: Record<string, number>; fetchedAt: number } | null = null
const FOREX_CACHE_TTL = 60_000

// CoinGecko ID mapping for supported symbols
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  LINK: 'chainlink',
  AVAX: 'avalanche-2',
  MATIC: 'polygon-matic-token',
  LTC: 'litecoin',
  UNI: 'uniswap',
  XLM: 'stellar',
  ATOM: 'cosmos',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
}


// =============================================================================
// Client Functions (run in browser)
// =============================================================================

export const navigateToPage = createVividFunction({
  name: 'navigateToPage',
  description:
    'Take the user to a screen anywhere in the WorldStreet ecosystem. ' +
    'Pass the destination id — NOT a URL path. Some destinations live on other ' +
    'WorldStreet apps and will load a new site, which is expected.\n' +
    describeDestinations(),
  parameters: buildParameters({
    destination: enumParam(
      'Which screen to open. Must be one of the listed destination ids.',
      DESTINATION_IDS,
      true,
    ),
  }),
  handler: async ({ destination }: { destination?: string }) => {
    if (typeof window === 'undefined') return { error: 'Navigation is only available in the browser' }

    const target = findDestination(destination ?? '')
    if (!target) {
      // Better to say so than to push a path that 404s.
      return {
        error: `Unknown destination "${destination}".`,
        validDestinations: DESTINATION_IDS,
      }
    }

    if (target.external) {
      window.location.assign(target.url)
    } else {
      window.dispatchEvent(new CustomEvent('vivid:navigate', { detail: { path: target.url } }))
    }

    return { success: true, opened: target.label, url: target.url, leftThisApp: target.external }
  },
  executionContext: 'client',
})

export const openPanel = createVividFunction({
  name: 'openPanel',
  description:
    'Open one of the money flows as a modal over whatever screen the user is on — ' +
    'deposit, withdraw, fund the trading account, withdraw the trading balance. ' +
    'These are NOT pages; they open on top and the screen behind stays live.\n' +
    describePanels(),
  parameters: buildParameters({
    panel: enumParam('Which panel to open. Must be one of the listed panel ids.', PANEL_IDS, true),
  }),
  handler: async ({ panel }: { panel?: string }) => {
    if (typeof window === 'undefined') return { error: 'Panels are only available in the browser' }

    const target = findPanel(panel ?? '')
    if (!target) {
      return { error: `Unknown panel "${panel}".`, validPanels: PANEL_IDS }
    }

    // Listeners flip `handled` synchronously during dispatch. If nothing handled
    // it, the owning provider isn't mounted — stash the request and navigate;
    // the provider replays it on mount.
    const detail: { panel: string; handled: boolean } = { panel: target.id, handled: false }
    window.dispatchEvent(new CustomEvent('vivid:open-panel', { detail }))

    if (!detail.handled) {
      try {
        sessionStorage.setItem(PENDING_PANEL_KEY, target.id)
      } catch {
        /* private mode — the navigation below still gets them to the right page */
      }
      window.dispatchEvent(new CustomEvent('vivid:navigate', { detail: { path: target.route } }))
      await waitForPanelSettle()
      return {
        success: true,
        opened: target.label,
        navigatedFirst: true,
        availableTargets: listTargets(),
      }
    }

    // The panel is portalled and animates in, so it is legitimately absent for
    // a few frames after the event. Wait for it, then hand its controls straight
    // back — no second listPageControls round trip before filling anything in.
    await waitForPanelSettle()
    return { success: true, opened: target.label, availableTargets: listTargets() }
  },
  executionContext: 'client',
})

export const getCurrentPageContext = createVividFunction({
  name: 'getCurrentPageContext',
  description:
    "Find out what the user is looking at right now — the page they are on, what is rendered on it, " +
    'and live on-screen values (which pair and side the trade ticket holds, which balance view is showing, ' +
    'whether a modal is up). ' +
    'CALL THIS whenever the user says "this page", "this screen", "here", "what am I looking at", ' +
    '"what does this mean", or asks about something visible without naming it. ' +
    'The page changes as they navigate, so never rely on what you were told earlier in the conversation — check.',
  parameters: buildParameters({}),
  handler: async () => {
    if (typeof window === 'undefined') return { error: 'Page context is only available in the browser' }

    const path = window.location.pathname + window.location.search
    const info = getPageInfo(window.location.pathname)
    const live = readLiveContext()

    return {
      path,
      page: info.name,
      whatIsOnScreen: info.summary,
      ...(info.actions ? { whatTheUserCanDoHere: info.actions } : {}),
      ...(Object.keys(live).length > 0
        ? { liveOnScreen: live }
        : { note: 'No live values published by this page — describe it from whatIsOnScreen.' }),
    }
  },
  executionContext: 'client',
})

export const showAlert = createVividFunction({
  name: 'showAlert',
  description: 'Show an alert message to the user',
  parameters: buildParameters({
    message: stringParam('The message to display', true),
  }),
  handler: async ({ message }) => {
    if (typeof window !== 'undefined') {
      alert(message)
    }
    return { success: true }
  },
  executionContext: 'client',
})

export const lookAtCamera = createVividFunction({
  name: 'lookAtCamera',
  description:
    "Look through the user's camera. Call this whenever the user asks about something physical or visual — " +
    '"what am I holding", "look at this", "can you see this chart on my other screen", "what does this say". ' +
    'A fresh camera frame is added to the conversation right before your response, so just describe what you see. ' +
    'If the camera is off, the browser will ask the user for permission first.',
  parameters: buildParameters({}),
  handler: async () => {
    if (typeof window === 'undefined') return { error: 'Camera is only available in the browser' }
    // Ask the voice control (which owns the camera stream and the realtime
    // connection) to capture a frame and inject it into the conversation.
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('vivid:look-result', onResult)
        resolve({ error: 'Camera capture timed out. Ask the user to enable their camera.' })
      }, 10000)
      const onResult = (e: Event) => {
        clearTimeout(timeout)
        window.removeEventListener('vivid:look-result', onResult)
        resolve((e as CustomEvent).detail)
      }
      window.addEventListener('vivid:look-result', onResult)
      window.dispatchEvent(new CustomEvent('vivid:look'))
    })
  },
  executionContext: 'client',
})

// =============================================================================
// Page control — Vivid's hands on the screen
// =============================================================================
// The DOM is the registry: anything carrying data-vivid-target is reachable,
// nothing else is. listPageControls is the model's eyes; every miss returns the
// live target list so a wrong id self-corrects in one round trip.

export const listPageControls = createVividFunction({
  name: 'listPageControls',
  description:
    'See everything on the current screen you can point at, fill or press — sections, buttons and ' +
    'inputs, each with a stable id. CALL THIS FIRST whenever you intend to control the page: ids ' +
    'differ per screen and per modal, and this list is the live truth. Items marked guarded move ' +
    'real money and need the user to confirm out loud before pressControl will fire them.',
  parameters: buildParameters({}),
  handler: async () => {
    if (typeof window === 'undefined') return { error: 'Page control is only available in the browser' }
    const targets = listTargets()
    return targets.length > 0
      ? { targets }
      : { targets, note: 'Nothing controllable is visible here. Navigate or open a panel first.' }
  },
  executionContext: 'client',
})

export const spotlightSection = createVividFunction({
  name: 'spotlightSection',
  description:
    'Physically SHOW the user something: scroll it into view and dim everything else so only that ' +
    'element stays lit. Use it whenever you say "here", "this button", "right there" — e.g. showing ' +
    'where the order book is, where to set leverage, where a balance lives. The mask ' +
    'clears on its own when the user touches the page. Get ids from listPageControls.',
  parameters: buildParameters({
    target: stringParam('The data-vivid-target id of the element to spotlight.', true),
    seconds: numberParam(
      'How long to hold the mask. Defaults to 4. Raise it only when your spoken explanation ' +
        'genuinely runs longer than that, so the highlight is still up when you finish the sentence.',
    ),
  }),
  handler: async ({ target, seconds }: { target?: string; seconds?: number }) => {
    if (typeof window === 'undefined') return { error: 'Page control is only available in the browser' }
    const el = await waitForTarget(target ?? '')
    if (!el) return missReport(target ?? '')
    // Clamp: below 2s the mask reads as a glitch, above 10s it feels stuck.
    const hold = Number.isFinite(seconds) && seconds! > 0 ? Math.min(Math.max(seconds!, 2), 10) * 1000 : undefined
    scrollToTarget(el)
    setSpotlight(target!, hold)
    return {
      success: true,
      spotlighting: target,
      heldForSeconds: (hold ?? DEFAULT_HOLD_MS) / 1000,
      note: 'The rest of the page is dimmed. It clears on its own, or the moment the user touches the page.',
    }
  },
  executionContext: 'client',
})

export const scrollPage = createVividFunction({
  name: 'scrollPage',
  description:
    'Scroll the screen for the user. Fixed, smooth, repeatable jumps — call it again for ' +
    '"keep going", "more", "further down". If a panel or modal is open it scrolls THAT, not the ' +
    'page behind it. Use direction top or bottom to jump straight to either end. The result tells ' +
    'you where you landed and whether you have hit the end, so you never claim to scroll past it. ' +
    'To bring one specific thing into view, prefer spotlightSection — it scrolls and points.',
  parameters: buildParameters({
    direction: enumParam('Which way to go.', ['down', 'up', 'top', 'bottom'], true),
    amount: enumParam(
      'How far, as a share of the visible height: small ~a third, medium ~three quarters ' +
        '(default), large ~one and a half screens. Ignored for top and bottom.',
      ['small', 'medium', 'large'],
    ),
    pixels: numberParam(
      'Exact distance in pixels — use when the user names a number ("scroll down 300"). Overrides amount.',
    ),
  }),
  handler: async ({ direction, amount, pixels }: { direction?: string; amount?: string; pixels?: number }) => {
    if (typeof window === 'undefined') return { error: 'Scrolling is only available in the browser' }
    const dir = (direction ?? 'down') as 'up' | 'down' | 'top' | 'bottom'
    const size = (amount ?? 'medium') as 'small' | 'medium' | 'large'
    const r = await performScroll(dir, size, pixels)
    return {
      success: true,
      scrolled: dir,
      by: Math.abs(r.scrolled),
      of: r.surface,
      atTop: r.atTop,
      atBottom: r.atBottom,
      ...(r.scrolled === 0
        ? { note: r.atBottom ? 'Already at the bottom.' : r.atTop ? 'Already at the top.' : 'Nothing to scroll.' }
        : {}),
    }
  },
  executionContext: 'client',
})

export const clearSpotlight = createVividFunction({
  name: 'clearSpotlight',
  description: 'Remove the spotlight mask and restore the page, e.g. when moving on to a new topic.',
  parameters: buildParameters({}),
  handler: async () => {
    if (typeof window === 'undefined') return { error: 'Page control is only available in the browser' }
    setSpotlight(null)
    return { success: true }
  },
  executionContext: 'client',
})

export const fillField = createVividFunction({
  name: 'fillField',
  description:
    'Type into an input on screen for the user — an amount, a limit price, a search. Works exactly like ' +
    'keyboard input, so the page reacts as they would expect (tickets recompute, forms validate). ' +
    'Filling never submits anything: pair with pressControl only after the user asks. ' +
    'Get ids from listPageControls; only kind "input" targets are fillable.',
  parameters: buildParameters({
    target: stringParam('The data-vivid-target id of the input to fill.', true),
    value: stringParam('Exactly what to type into it. Plain digits for amounts — no currency symbols or commas.', true),
  }),
  handler: async ({ target, value }: { target?: string; value?: string }) => {
    if (typeof window === 'undefined') return { error: 'Page control is only available in the browser' }
    const el = await waitForTarget(target ?? '')
    if (!el) return missReport(target ?? '')
    scrollToTarget(el)
    const result = setNativeInput(el, value ?? '')
    if (!result.ok) {
      return { error: `"${target}" is not a fillable input.`, availableTargets: listTargets() }
    }
    if (result.settled !== result.wrote) {
      // The component rejected or reformatted it — say so rather than claiming success.
      return {
        partial: true,
        filled: target,
        requested: value,
        fieldNowShows: result.settled,
        note: 'The field did not keep exactly what was typed. Read back what it shows before continuing.',
      }
    }
    return { success: true, filled: target, fieldNowShows: result.settled }
  },
  executionContext: 'client',
})

export const pressControl = createVividFunction({
  name: 'pressControl',
  description:
    'Press a button or link on screen for the user — switch a tab, pick a pair, apply a Max amount, ' +
    'submit a form they asked you to submit. Controls marked guarded move real money (placing orders, ' +
    'closing positions, transfers): for those you MUST first tell the user exactly what will happen ' +
    'and hear them agree, then call again with confirmed=true. ' +
    'Never set confirmed on your own initiative. Get ids from listPageControls.',
  parameters: buildParameters({
    target: stringParam('The data-vivid-target id of the button or link to press.', true),
    confirmed: booleanParam(
      'Only for guarded controls: true once the user has verbally agreed to this exact action.',
    ),
  }),
  handler: async ({ target, confirmed }: { target?: string; confirmed?: boolean }) => {
    if (typeof window === 'undefined') return { error: 'Page control is only available in the browser' }
    const el = await waitForTarget(target ?? '')
    if (!el) return missReport(target ?? '')
    if (el.hasAttribute(GUARD_ATTR) && !confirmed) {
      scrollToTarget(el)
      setSpotlight(target!)
      return {
        needsConfirmation: true,
        control: target,
        note:
          'This moves real money, so it is spotlighted but NOT pressed. Tell the user exactly what ' +
          'pressing it will do, and only after they clearly agree call pressControl again with confirmed=true.',
      }
    }
    scrollToTarget(el)
    el.click()
    return { success: true, pressed: target }
  },
  executionContext: 'client',
})

export const searchWeb = createVividFunction({
  name: 'searchWeb',
  description:
    'Search the live internet and get back a short, current answer with sources. Use for news, ' +
    'current events, companies, products, people, places — anything outside WorldStreet where being ' +
    'out of date would make you wrong. NOT for crypto prices, forex, balances or transaction ' +
    'history — those have dedicated tools.',
  parameters: buildParameters({
    query: stringParam(
      'A complete, self-contained search query. Resolve pronouns from the conversation first.',
      true,
    ),
  }),
  handler: async ({ query }: { query?: string }) => {
    if (!query || !query.trim()) return { error: 'Give searchWeb a real query.' }
    const result = await runWebSearch(query.trim())
    if (!result.ok) {
      return { error: result.error, retryable: result.retryable }
    }
    return { answer: result.answer, sources: result.sources }
  },
  executionContext: 'server',
})

// =============================================================================
// Server Functions (run via /api/vivid/function)
// =============================================================================

export const getCryptoPrice = createVividFunction({
  name: 'getCryptoPrice',
  description:
    'Get the current price, 24h change, market cap, and volume for one or more cryptocurrencies. ' +
    'If no symbol is given, returns top coins overview. ' +
    'Supported symbols: BTC, ETH, SOL, USDT, USDC, XRP, ADA, DOGE, DOT, LINK, AVAX, MATIC, LTC, UNI, XLM, ATOM, NEAR, APT, SUI.',
  parameters: buildParameters({
    symbol: stringParam(
      'Crypto symbol (e.g. BTC, ETH, SOL). Leave empty for market overview.',
      false,
    ),
  }),
  handler: async ({ symbol }: { symbol?: string }) => {
    try {
      const appBase =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.NEXTAUTH_URL ??
        'http://localhost:3000'

      let coins: Array<{
        id: string
        symbol: string
        name: string
        price: number
        change24h: number
        marketCap: number
        volume24h: number
      }> = []

      let globalStats: {
        totalMarketCap: number | null
        totalVolume: number | null
        btcDominance: number | null
      } | null = null

      try {
        const cacheRes = await fetch(`${appBase}/api/prices`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        })
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json()
          coins = (cacheData.coins ?? []).map((c: {
            id: string; symbol: string; name: string;
            price: number; change24h: number; marketCap: number; volume24h: number
          }) => ({
            id: c.id,
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            price: c.price,
            change24h: Math.round((c.change24h ?? 0) * 100) / 100,
            marketCap: c.marketCap,
            volume24h: c.volume24h,
          }))
          if (cacheData.globalStats) {
            globalStats = {
              totalMarketCap: cacheData.globalStats.totalMarketCap ?? null,
              totalVolume: cacheData.globalStats.totalVolume ?? null,
              btcDominance: cacheData.globalStats.btcDominance
                ? Math.round(cacheData.globalStats.btcDominance * 100) / 100
                : null,
            }
          }
        }
      } catch {
        // Fall through to direct CoinGecko fetch
      }

      // Fallback: hit CoinGecko directly if the cache route failed
      if (coins.length === 0) {
        const coinIds = Object.values(SYMBOL_TO_COINGECKO).join(',')
        const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          return { error: `Market data temporarily unavailable (${res.status})` }
        }
        const raw = await res.json()
        coins = raw.map((c: {
          id: string; symbol: string; name: string;
          current_price: number; price_change_percentage_24h: number;
          market_cap: number; total_volume: number
        }) => ({
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change24h: Math.round((c.price_change_percentage_24h ?? 0) * 100) / 100,
          marketCap: c.market_cap,
          volume24h: c.total_volume,
        }))
      }

      // Filter to requested symbol
      if (symbol) {
        const sym = symbol.toUpperCase()
        const coin = coins.find(c => c.symbol === sym) ??
          coins.find(c => c.id === SYMBOL_TO_COINGECKO[sym])

        if (!coin) {
          return { error: `Couldn't find data for ${sym}. Supported: ${Object.keys(SYMBOL_TO_COINGECKO).join(', ')}` }
        }

        return {
          symbol: coin.symbol,
          name: coin.name,
          price: coin.price,
          change24h: coin.change24h,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
        }
      }

      // No symbol — return top 10 overview + global stats
      return { coins: coins.slice(0, 10), globalStats }
    } catch (err) {
      return { error: `Failed to fetch prices: ${(err as Error).message}` }
    }
  },
  executionContext: 'server',
})

export const getPortfolioBalance = createVividFunction({
  name: 'getPortfolioBalance',
  description:
    'Get the authenticated user\'s wallet balance, wallet addresses, and open trading positions. ' +
    'Returns USDT balance, wallet addresses (Solana, Ethereum, Bitcoin), and any open positions.',
  parameters: buildParameters({}),
  handler: async () => {
    try {
      const profileRes = await fetch('/api/profile', {
        credentials: 'include',
        signal: AbortSignal.timeout(10_000),
      })

      if (profileRes.status === 401) {
        return { error: 'You need to be logged in for me to check your portfolio.' }
      }
      if (!profileRes.ok) {
        return { error: 'Could not fetch your profile. Please try again.' }
      }

      const { profile } = await profileRes.json()
      if (!profile) {
        return { error: 'No profile found. You may need to set up your account first.' }
      }

      const wallets: Record<string, string | null> = {
        solana: profile.wallets?.solana?.address ?? null,
        ethereum: profile.wallets?.ethereum?.address ?? null,
        bitcoin: profile.wallets?.bitcoin?.address ?? null,
      }

      const usdtBalance = profile.usdtBalance ?? profile.wallets?.solana?.usdtBalance ?? null

      let openPositions: unknown[] = []
      try {
        const posRes = await fetch(
          `${BACKEND_URL}/api/trades/open`,
          { credentials: 'include', signal: AbortSignal.timeout(8_000) },
        )
        if (posRes.ok) {
          const posData = await posRes.json()
          openPositions = Array.isArray(posData) ? posData : posData.trades ?? posData.positions ?? []
        }
      } catch {
        // Non-critical
      }

      return {
        usdtBalance,
        wallets,
        openPositionsCount: openPositions.length,
        openPositions: openPositions.slice(0, 5),
      }
    } catch (err) {
      return { error: `Failed to fetch portfolio: ${(err as Error).message}` }
    }
  },
  executionContext: 'client',
})

export const getMarketAnalysis = createVividFunction({
  name: 'getMarketAnalysis',
  description:
    'Get market data and chart analysis for a specific cryptocurrency over a given timeframe. ' +
    'Returns price history, high/low, percent change, and volume. ' +
    'Supported symbols: BTC, ETH, SOL, XRP, ADA, DOGE, DOT, LINK, AVAX, LTC.',
  parameters: buildParameters({
    symbol: stringParam('Crypto symbol to analyze (e.g. BTC, ETH, SOL). Default: BTC.', false),
    timeframe: enumParam(
      'Time period for the analysis',
      ['1H', '4H', '1D', '1W', '1M'],
      false,
    ),
  }),
  handler: async ({ symbol, timeframe }: { symbol?: string; timeframe?: string }) => {
    try {
      const sym = (symbol || 'BTC').toUpperCase()
      const tf = timeframe || '1D'

      const geckoId = SYMBOL_TO_COINGECKO[sym]
      if (!geckoId) {
        return { error: `Unsupported symbol: ${sym}. Try one of: BTC, ETH, SOL, XRP, ADA, DOGE, DOT, LINK, AVAX, LTC.` }
      }

      const tfToDays: Record<string, string> = {
        '1H': '0.042',
        '4H': '0.167',
        '1D': '1',
        '1W': '7',
        '1M': '30',
      }
      const days = tfToDays[tf] || '1'

      const [chartRes, priceRes] = await Promise.all([
        fetch(
          `${COINGECKO_API}/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
        ),
        fetch(
          `${COINGECKO_API}/coins/${geckoId}?localization=false&tickers=false&community_data=false&developer_data=false`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
        ),
      ])

      if (!chartRes.ok) {
        return { error: `Chart data unavailable for ${sym} (${chartRes.status})` }
      }

      const chartData = await chartRes.json() as {
        prices: [number, number][]
        total_volumes: [number, number][]
      }

      const prices = chartData.prices || []
      if (prices.length === 0) {
        return { error: `No price data available for ${sym} over ${tf}` }
      }

      const priceValues = prices.map(p => p[1])
      const high = Math.max(...priceValues)
      const low = Math.min(...priceValues)
      const start = priceValues[0]
      const end = priceValues[priceValues.length - 1]
      const changePercent = start > 0 ? Math.round(((end - start) / start) * 10000) / 100 : 0

      const volumes = chartData.total_volumes || []
      const totalVolume = volumes.reduce((sum, v) => sum + (v[1] || 0), 0)

      let currentData: Record<string, unknown> = {}
      if (priceRes.ok) {
        const coinDetail = await priceRes.json() as {
          market_data?: {
            current_price?: { usd?: number }
            market_cap?: { usd?: number }
            total_volume?: { usd?: number }
            price_change_percentage_24h?: number
            price_change_percentage_7d?: number
            price_change_percentage_30d?: number
            ath?: { usd?: number }
            ath_change_percentage?: { usd?: number }
          }
        }
        const md = coinDetail.market_data
        if (md) {
          currentData = {
            currentPrice: md.current_price?.usd,
            marketCap: md.market_cap?.usd,
            volume24h: md.total_volume?.usd,
            change24h: md.price_change_percentage_24h
              ? Math.round(md.price_change_percentage_24h * 100) / 100
              : null,
            change7d: md.price_change_percentage_7d
              ? Math.round(md.price_change_percentage_7d * 100) / 100
              : null,
            change30d: md.price_change_percentage_30d
              ? Math.round(md.price_change_percentage_30d * 100) / 100
              : null,
            allTimeHigh: md.ath?.usd,
            distanceFromATH: md.ath_change_percentage?.usd
              ? Math.round(md.ath_change_percentage.usd * 100) / 100
              : null,
          }
        }
      }

      return {
        symbol: sym,
        timeframe: tf,
        periodHigh: high,
        periodLow: low,
        periodStart: start,
        periodEnd: end,
        periodChangePercent: changePercent,
        periodVolume: totalVolume,
        dataPoints: prices.length,
        ...currentData,
      }
    } catch (err) {
      return { error: `Analysis failed: ${(err as Error).message}` }
    }
  },
  executionContext: 'client',
})

export const getTransactionHistory = createVividFunction({
  name: 'getTransactionHistory',
  description:
    'Get the authenticated user\'s recent transaction history — including trades and swap history. ' +
    'Filter by type: "trades" for spot/futures trades, "swaps" for token swaps, or "all" for everything.',
  parameters: buildParameters({
    type: enumParam(
      'Type of transactions to fetch',
      ['all', 'trades', 'swaps'],
      false,
    ),
    limit: numberParam(
      'Maximum number of transactions to return (default 10, max 50)',
      false,
    ),
  }),
  handler: async ({ type, limit }: { type?: string; limit?: number }) => {
    try {
      const txType = type || 'all'
      const maxItems = Math.min(Math.max(limit || 10, 1), 50)

      const results: {
        trades?: unknown[]
        swaps?: unknown[]
        tradeError?: string
        swapError?: string
      } = {}

      if (txType === 'all' || txType === 'trades') {
        try {
          const res = await fetch(
            `${BACKEND_URL}/api/trades?limit=${maxItems}`,
            { credentials: 'include', signal: AbortSignal.timeout(8_000) },
          )
          if (res.ok) {
            const data = await res.json()
            results.trades = Array.isArray(data) ? data.slice(0, maxItems) : data.trades?.slice(0, maxItems) ?? []
          } else {
            results.tradeError = `Trade history unavailable (${res.status})`
          }
        } catch {
          results.tradeError = 'Could not reach the trading backend'
        }
      }

      if (txType === 'all' || txType === 'swaps') {
        try {
          const res = await fetch(
            `/api/swap/history?limit=${maxItems}`,
            { credentials: 'include', signal: AbortSignal.timeout(8_000) },
          )
          if (res.ok) {
            const data = await res.json()
            results.swaps = Array.isArray(data.swaps) ? data.swaps.slice(0, maxItems) : []
          } else {
            results.swapError = 'Could not fetch swap history'
          }
        } catch {
          results.swapError = 'Could not fetch swap history'
        }
      }

      const totalCount = (results.trades?.length ?? 0) + (results.swaps?.length ?? 0)

      return {
        totalTransactions: totalCount,
        ...results,
      }
    } catch (err) {
      return { error: `Failed to fetch history: ${(err as Error).message}` }
    }
  },
  executionContext: 'client',
})

export const getForexRate = createVividFunction({
  name: 'getForexRate',
  description:
    'Get current foreign exchange (forex) rates. ' +
    'Provide pair as "BASE/QUOTE" (e.g. "EUR/USD", "USD/NGN"). ' +
    'If no pair is specified, returns a summary of major pairs and NGN rates vs USD.',
  parameters: buildParameters({
    pair: stringParam(
      'Currency pair to look up, formatted as BASE/QUOTE (e.g. "EUR/USD", "USD/NGN", "GBP/JPY"). Leave empty for a major-pairs overview.',
      false,
    ),
  }),
  handler: async ({ pair }: { pair?: string }) => {
    try {
      const now = Date.now()
      if (!_forexCache || now - _forexCache.fetchedAt > FOREX_CACHE_TTL) {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        })
        if (!res.ok) {
          return { error: `Forex data temporarily unavailable (${res.status})` }
        }
        const data = await res.json()
        if (data.result !== 'success') {
          return { error: 'Forex data unavailable right now. Try again shortly.' }
        }
        _forexCache = { rates: data.rates as Record<string, number>, fetchedAt: now }
      }

      const rates = _forexCache.rates

      if (pair) {
        const [rawBase, rawQuote] = pair.toUpperCase().split('/')
        if (!rawBase || !rawQuote) {
          return { error: `Invalid pair format. Use BASE/QUOTE, e.g. "EUR/USD" or "USD/NGN".` }
        }

        const baseRate = rawBase === 'USD' ? 1 : rates[rawBase]
        const quoteRate = rawQuote === 'USD' ? 1 : rates[rawQuote]

        if (!baseRate) return { error: `Unknown currency: ${rawBase}` }
        if (!quoteRate) return { error: `Unknown currency: ${rawQuote}` }

        const rate = quoteRate / baseRate

        return {
          pair: `${rawBase}/${rawQuote}`,
          rate: Math.round(rate * 100000) / 100000,
          base: rawBase,
          quote: rawQuote,
          description: `1 ${rawBase} = ${(Math.round(rate * 10000) / 10000).toLocaleString()} ${rawQuote}`,
          dataSource: 'open.er-api.com',
          updatedAt: new Date(_forexCache.fetchedAt).toISOString(),
        }
      }

      const majors = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NGN']
      const overview = majors
        .filter(c => rates[c])
        .map(c => ({
          pair: `USD/${c}`,
          rate: Math.round(rates[c] * 10000) / 10000,
        }))

      return {
        base: 'USD',
        rates: overview,
        dataSource: 'open.er-api.com',
        updatedAt: new Date(_forexCache.fetchedAt).toISOString(),
      }
    } catch (err) {
      return { error: `Failed to fetch forex rates: ${(err as Error).message}` }
    }
  },
  executionContext: 'server',
})


// =============================================================================
// Registry
// =============================================================================

export const allFunctions: VoiceFunctionConfig[] = [
  // Getting around + acting on the screen
  navigateToPage,
  openPanel,
  getCurrentPageContext,
  listPageControls,
  spotlightSection,
  scrollPage,
  clearSpotlight,
  fillField,
  pressControl,
  lookAtCamera,
  // Data
  getCryptoPrice,
  getPortfolioBalance,
  getMarketAnalysis,
  getTransactionHistory,
  getForexRate,
  searchWeb,
  // Misc
  showAlert,
]
