"use client"

/**
 * A wall around one panel, so a panel that throws doesn't take the screen.
 *
 * This app has no error boundaries at all — no app/error.tsx, no
 * global-error.tsx, nothing. React's default for an uncaught render error is
 * to unmount the whole tree, so a single component throwing inside a modal
 * produces no modal, no message, and nothing in the UI to act on. That is
 * exactly what "I click Withdraw and the modal doesn't come up" looks like
 * from the outside, and it is indistinguishable from a button that isn't
 * wired to anything.
 *
 * The money-flow modal is the first place this matters, because its panels are
 * the most complex things in the app — SendFlow alone pulls balances, quotes,
 * intents, a signer and an unlock dialog — and they are reached by a button
 * that gives no other feedback.
 *
 * WHAT THIS IS NOT: a way to keep going after a failure. The panel is dead
 * once it throws. What the boundary buys is that the FAILURE IS VISIBLE — the
 * user gets a sentence instead of a blank, the message is on screen to report,
 * and the modal's own chrome (title, back, close) is still there to leave with.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

type Props = {
  children: React.ReactNode
  /** Names the surface in the fallback — "Send", "Deposit", and so on. */
  label?: string
  /** Bumping this resets the boundary, so leaving and re-entering retries. */
  resetKey?: string | number
}

type State = { error: Error | null }

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The console is the only place this was ever going to be reported from,
    // so make it findable rather than leaving it to React's own noise.
    console.error(`[panel] ${this.props.label ?? "A panel"} failed to render`, error, info)
  }

  componentDidUpdate(prev: Props) {
    /* Reset when the caller says the surface changed. Without this, one throw
       poisons the boundary for the life of the modal — reopening it on a
       different step would keep showing the old failure. */
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex flex-col items-start gap-3 p-4 sm:p-5">
        <div className="flex w-full items-start gap-2 rounded-xl bg-warning-chip px-3 py-2.5">
          <HugeiconsIcon icon={AlertCircleIcon} className="mt-px h-4 w-4 shrink-0 text-warning" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[13px] font-semibold text-warning">
              {this.props.label ?? "This screen"} couldn’t load
            </p>
            <p className="text-[12px] leading-relaxed text-warning/90">
              Nothing was sent and nothing has changed. Close this and try again — if it keeps
              happening, the message below is the useful part to report.
            </p>
          </div>
        </div>
        <p className="w-full break-words rounded-xl bg-surface-sunken px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          {error.message || String(error)}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="inline-flex h-9 items-center rounded-full bg-surface-sunken px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          Try again
        </button>
      </div>
    )
  }
}
