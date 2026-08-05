"use client"

/**
 * Vivid page control — the layer that lets the assistant put its hands on the
 * screen: scroll to a section, spotlight it, fill an input, press a control.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 * The DOM is the registry. Anything Vivid may touch carries
 * `data-vivid-target="some-id"`; nothing else is reachable. That one decision
 * does most of the engineering:
 *
 *  - No per-page registration, no context, no state to keep in sync. A modal
 *    that mounts brings its targets; unmounting removes them. Server components
 *    can declare targets — it's just an attribute.
 *  - The model never guesses selectors. It calls listPageControls() to see what
 *    exists RIGHT NOW, ids are stable strings, and a miss returns the live list
 *    so the model self-corrects in one round trip.
 *  - Optional `data-vivid-label` overrides the visible text as the description;
 *    `data-vivid-guard` marks money-moving controls that need spoken
 *    confirmation before pressControl will fire them.
 *
 * The spotlight itself is ONE fixed element whose box-shadow does the veil
 * (0 0 0 200vmax of near-black) — no SVG mask, no four-panel dance, and the
 * rounded corners come free. Moving it between targets is a CSS transition on
 * top/left/width/height, so consecutive highlights glide instead of blinking.
 */

export const TARGET_ATTR = "data-vivid-target"
export const LABEL_ATTR = "data-vivid-label"
export const GUARD_ATTR = "data-vivid-guard"

export type VividTarget = {
  id: string
  /** What this thing is, for the model: explicit label, aria-label, or text. */
  label: string
  kind: "input" | "button" | "link" | "section"
  /** True for money-moving controls: pressControl requires spoken confirmation. */
  guarded: boolean
}

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const s = getComputedStyle(el)
  return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0"
}

function kindOf(el: Element): VividTarget["kind"] {
  const tag = el.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return "input"
  if (tag === "button" || el.getAttribute("role") === "button") return "button"
  if (tag === "a") return "link"
  return "section"
}

function labelOf(el: Element): string {
  const explicit = el.getAttribute(LABEL_ATTR) || el.getAttribute("aria-label")
  if (explicit) return explicit
  const placeholder = el.getAttribute("placeholder")
  if (placeholder) return placeholder
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim()
  return text.length > 72 ? `${text.slice(0, 72)}…` : text || el.tagName.toLowerCase()
}

/** Everything Vivid may touch on the current screen, visible things only. */
export function listTargets(): VividTarget[] {
  if (typeof document === "undefined") return []
  const out: VividTarget[] = []
  document.querySelectorAll(`[${TARGET_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(TARGET_ATTR)
    if (!id || !isVisible(el)) return
    out.push({ id, label: labelOf(el), kind: kindOf(el), guarded: el.hasAttribute(GUARD_ATTR) })
  })
  return out
}

export function resolveTarget(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector(`[${TARGET_ATTR}="${CSS.escape(id)}"]`)
  return el instanceof HTMLElement && isVisible(el) ? el : null
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Resolve a target, waiting for it to turn up.
 *
 * Modals are portalled AND animate in from opacity-0, so an element asked for
 * the instant a panel opens is legitimately absent for a few frames. Polling on
 * a timer rather than rAF matters: rAF is throttled to nothing in a background
 * tab, which would make this hang exactly when the page is least able to help.
 */
export async function waitForTarget(id: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const el = resolveTarget(id)
    if (el) return el
    if (Date.now() >= deadline) return null
    await sleep(60)
  }
}

/**
 * Wait for a just-opened panel to finish arriving.
 *
 * Settles when the set of visible target ids stops changing for two
 * consecutive polls — that covers a portalled modal, an in-place view switch,
 * and an async panel that fills in late, without hard-coding any of them.
 */
export async function waitForPanelSettle(timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let previous = ""
  let stable = 0
  for (;;) {
    const now = listTargets()
      .map((t) => t.id)
      .join(",")
    stable = now === previous ? stable + 1 : 0
    previous = now
    if (stable >= 2 || Date.now() >= deadline) return
    await sleep(70)
  }
}

/** The standard miss reply: what was asked for, what actually exists. */
export function missReport(id: string) {
  return {
    error: `No visible control "${id}" on this screen.`,
    availableTargets: listTargets(),
    hint: "Ids change per screen. Pick one of availableTargets, or call listPageControls after navigating.",
  }
}

export function scrollToTarget(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
}

/**
 * Numeric fields here guard their onChange with patterns like
 * /^[0-9]*\.?[0-9]*$/ and simply RETURN on a mismatch — so "₦4,000" or
 * "4000 naira" is silently swallowed and the field stays empty. A spoken
 * amount arrives in exactly those shapes, so strip to digits before typing
 * rather than hoping the model always sends them clean.
 */
function coerceForInput(el: HTMLElement, value: string): string {
  const numeric =
    (el as HTMLInputElement).inputMode === "decimal" ||
    (el as HTMLInputElement).inputMode === "numeric" ||
    (el as HTMLInputElement).type === "number"
  if (!numeric) return value
  const cleaned = value.replace(/[^0-9.]/g, "")
  // Keep only the first decimal point: "1.2.3" -> "1.23"
  const [head, ...rest] = cleaned.split(".")
  return rest.length > 0 ? `${head}.${rest.join("")}` : head
}

/**
 * Set a React-controlled input the way a keyboard would. Assigning .value
 * directly is invisible to React — the native setter + a bubbling input event
 * is what its onChange actually listens for.
 *
 * Returns what the field ACTUALLY holds afterwards, so a caller can tell the
 * difference between "typed" and "typed and the component kept it".
 */
export function setNativeInput(
  el: HTMLElement,
  value: string,
): { ok: false } | { ok: true; wrote: string; settled: string } {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof HTMLInputElement
        ? window.HTMLInputElement.prototype
        : null
  if (!proto) return { ok: false }
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  if (!setter) return { ok: false }

  const wrote = coerceForInput(el, value)
  el.focus()
  setter.call(el, wrote)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
  return { ok: true, wrote, settled: (el as HTMLInputElement).value }
}

// ── Scrolling ────────────────────────────────────────────────────────────────

/**
 * What should actually move when Vivid is told "scroll down".
 *
 * An open modal scrolls its own body, not the page behind it — scrolling the
 * window while a dialog is up looks broken. So prefer the topmost dialog's
 * scrollable box, then any scrollable ancestor chain, and fall back to the page.
 */
export function scrollSurface(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [data-slot="responsive-modal-content"]',
  )
  const dialog = dialogs[dialogs.length - 1]
  if (dialog) {
    if (dialog.scrollHeight > dialog.clientHeight + 4) return dialog
    const inner = dialog.querySelectorAll<HTMLElement>("*")
    for (const el of inner) {
      const s = getComputedStyle(el)
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) return el
    }
    // A dialog is up but nothing inside scrolls — moving the page would be wrong.
    return dialog
  }
  return null // null means "the window"
}

export type ScrollAmount = "small" | "medium" | "large"

/** Fractions of the visible height — fixed, repeatable jumps. */
const STEP: Record<ScrollAmount, number> = { small: 0.35, medium: 0.8, large: 1.6 }

export async function performScroll(
  direction: "up" | "down" | "top" | "bottom",
  amount: ScrollAmount = "medium",
  /** Exact distance in px — overrides `amount` when given. */
  pixels?: number,
): Promise<{ scrolled: number; position: number; atTop: boolean; atBottom: boolean; surface: string }> {
  const el = scrollSurface()
  const view = el ? el.clientHeight : window.innerHeight
  const max = el
    ? el.scrollHeight - el.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight
  const at = () => (el ? el.scrollTop : window.scrollY)
  const from = at()

  let to: number
  if (direction === "top") to = 0
  else if (direction === "bottom") to = max
  else {
    const step =
      typeof pixels === "number" && Number.isFinite(pixels) && pixels > 0
        ? Math.round(pixels)
        : Math.round(view * STEP[amount])
    to = direction === "down" ? from + step : from - step
  }
  to = Math.max(0, Math.min(to, Math.max(max, 0)))

  const go = (behavior: ScrollBehavior) => {
    if (el) {
      el.scrollTo({ top: to, behavior })
    } else {
      window.scrollTo({ top: to, behavior })
    }
  }

  go("smooth")

  // Smooth scrolling is animation-driven, so a throttled or backgrounded tab can
  // leave it stalled part-way — which would read to the user as "it ignored me".
  // Give it a beat, then snap the rest of the way if it didn't arrive.
  if (Math.abs(to - from) > 2) {
    await sleep(450)
    if (Math.abs(at() - to) > 8) go("auto")
    await sleep(60)
  }

  const landed = at()
  return {
    scrolled: landed - from,
    position: landed,
    atTop: landed <= 1,
    atBottom: landed >= max - 1,
    surface: el ? "the open panel" : "the page",
  }
}

// ── Spotlight store ──────────────────────────────────────────────────────────
// Module-level singleton: the functions write to it, the <VividSpotlight />
// overlay subscribes. An id, not an element — the overlay re-resolves every
// frame so it survives re-renders, scrolling and layout shifts.
//
// The nonce exists so re-spotlighting the SAME target restarts its hold timer.
// Without it React sees an unchanged id, skips the effect, and the second
// "look — this one" would inherit the dying countdown of the first.

export type SpotlightRequest = { id: string; holdMs: number; nonce: number } | null

type SpotlightListener = (req: SpotlightRequest) => void

let current: SpotlightRequest = null
let nonce = 0
const listeners = new Set<SpotlightListener>()

/** Default hold, mirrored in VividSpotlight — short enough never to feel stuck. */
export const DEFAULT_HOLD_MS = 4_000

export function setSpotlight(id: string | null, holdMs: number = DEFAULT_HOLD_MS) {
  current = id ? { id, holdMs, nonce: ++nonce } : null
  listeners.forEach((l) => l(current))
}

export function getSpotlight() {
  return current
}

export function subscribeSpotlight(fn: SpotlightListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
