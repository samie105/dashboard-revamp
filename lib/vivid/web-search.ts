/**
 * Live web search backed by OpenAI's hosted `web_search` tool on the Responses API.
 *
 * Shared by two callers with different needs:
 *   - the `searchWeb` voice tool, which needs a spoken-length answer right now
 *   - the standing-watch cron, which re-runs a stored query on a schedule
 *
 * Both go through `runWebSearch` so there is one implementation of the API
 * contract, the model fallback, and the citation parsing.
 */

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses'

// The hosted `web_search` tool only works on a subset of models, and account
// access varies — if the first is not available to this key we fall through
// rather than losing the capability entirely.
export const SEARCH_MODELS = [
  process.env.VIVID_SEARCH_MODEL,
  'gpt-5.6',
  'gpt-4.1',
].filter(Boolean) as string[]

const MAX_SOURCES = 5

export type WebSearchSource = { title: string; url: string }

export type WebSearchResult =
  | { ok: true; answer: string; sources: WebSearchSource[] }
  | { ok: false; error: string; retryable: boolean }

export type RunWebSearchOptions = {
  /** How much retrieved context to give the model. 'low' is markedly faster. */
  contextSize?: 'low' | 'medium' | 'high'
  timeoutMs?: number
  /** Overrides the default answer style. */
  instructions?: string
}

/** Answer style for spoken replies — short, plain prose, no markup. */
export const VOICE_INSTRUCTIONS =
  'You are a search backend for a voice assistant. Search the web and answer the ' +
  'query factually in at most three short sentences of plain prose. ' +
  'Lead with the single most important fact. Include specific numbers, names and ' +
  'dates where they matter, and say when the information is from if it is ' +
  'time-sensitive. No markdown, no bullet points, no citation markers, no preamble — ' +
  'the text will be read aloud verbatim. ' +
  'If the search does not settle the question, say plainly what is unclear.'

export async function runWebSearch(
  query: string,
  options: RunWebSearchOptions = {},
): Promise<WebSearchResult> {
  const q = query.trim()
  if (!q) return { ok: false, error: 'No search query was provided.', retryable: false }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Web search is not configured on this server.', retryable: false }
  }

  const {
    contextSize = 'low',
    timeoutMs = 15_000,
    instructions = VOICE_INSTRUCTIONS,
  } = options

  let lastError = 'Web search is unavailable right now.'

  for (const model of SEARCH_MODELS) {
    try {
      const res = await fetch(OPENAI_RESPONSES_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          // Reasoning models default to medium effort, which regularly eats the
          // whole timeout budget before the search even returns. Low effort is
          // the fastest setting that still supports the hosted web_search tool.
          ...(model.startsWith('gpt-5') ? { reasoning: { effort: 'low' } } : {}),
          tools: [{ type: 'web_search', search_context_size: contextSize }],
          // Never let it answer from its own weights — freshness is the point.
          tool_choice: 'required',
          instructions,
          input: q,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        // A model this key cannot use — try the next one in the list.
        if (res.status === 404 || res.status === 400) {
          lastError = `Search model unavailable (${res.status})`
          continue
        }
        if (res.status === 429) {
          return {
            ok: false,
            error: 'Search is rate limited at the moment. Try again in a few seconds.',
            retryable: true,
          }
        }
        return {
          ok: false,
          error: `Search failed (${res.status}). ${body.slice(0, 200)}`,
          retryable: res.status >= 500,
        }
      }

      const data = (await res.json()) as {
        output?: Array<{
          type?: string
          content?: Array<{
            type?: string
            text?: string
            annotations?: Array<{ type?: string; url?: string; title?: string }>
          }>
        }>
        output_text?: string
      }

      const message = data.output?.find(o => o.type === 'message')
      const part = message?.content?.find(c => c.type === 'output_text') ?? message?.content?.[0]
      const answer = (part?.text ?? data.output_text ?? '').trim()

      if (!answer) {
        lastError = 'The search came back empty.'
        continue
      }

      // Dedupe citations by URL — the same page is often cited several times.
      const seen = new Set<string>()
      const sources: WebSearchSource[] = []
      for (const a of part?.annotations ?? []) {
        if (a.type !== 'url_citation' || !a.url || seen.has(a.url)) continue
        seen.add(a.url)
        sources.push({ title: a.title ?? a.url, url: a.url })
        if (sources.length >= MAX_SOURCES) break
      }

      return { ok: true, answer, sources }
    } catch (err) {
      const e = err as Error
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        // A slow model is not a dead end — the next model in the list is
        // faster. Only report the timeout if every model runs out of time.
        lastError = 'The search took too long. Tell the user it timed out and offer to retry.'
        continue
      }
      lastError = `Search failed: ${e.message}`
    }
  }

  return { ok: false, error: lastError, retryable: true }
}
