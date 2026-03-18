"use client"

import React, { useRef, useEffect } from "react"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ChartLineData03Icon,
  IdeaIcon,
  ShieldKeyIcon,
  BalanceScaleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import type { Message } from "@/hooks/useChat"
import ChatBubble from "./ChatBubble"

interface ChatMessageListProps {
  messages: Message[]
  loading: boolean
  isGenerating: boolean
}

export default function ChatMessageList({
  messages,
  loading,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const emptyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Micro-animations on empty state mount
  useEffect(() => {
    if (messages.length !== 0 || loading) return
    const el = emptyRef.current
    if (!el) return

    const heading = el.querySelector<HTMLElement>(".empty-heading")
    const sub = el.querySelector<HTMLElement>(".empty-sub")
    const cards = el.querySelectorAll<HTMLElement>(".suggestion-card")

    gsap.set([heading, sub, ...cards], { opacity: 0, y: 12 })

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.to(heading, { opacity: 1, y: 0, duration: 0.45 })
      .to(sub, { opacity: 1, y: 0, duration: 0.35 }, "-=0.2")
      .to(cards, { opacity: 1, y: 0, duration: 0.3, stagger: 0.07 }, "-=0.1")

    return () => { tl.kill() }
  }, [messages.length, loading])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div ref={emptyRef} className="max-w-lg w-full">
          <div className="text-center mb-10">
            <h2 className="empty-heading text-2xl font-semibold text-foreground tracking-tight">
              How can I help you today?
            </h2>
            <p className="empty-sub text-sm text-muted-foreground mt-2">
              Ask about markets, strategies, portfolios, or anything trading-related.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="suggestion-card group text-left p-4 rounded-xl border border-border/40 hover:border-border hover:bg-accent/40 transition-all"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("vivid:suggestion", {
                      detail: { text: s.prompt },
                    }),
                  )
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <HugeiconsIcon
                        icon={s.icon}
                        className="h-4 w-4 text-muted-foreground shrink-0"
                      />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {s.category}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-snug line-clamp-2">
                      {s.label}
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0 mt-0.5 group-hover:translate-x-0.5"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {messages
          .filter((m) => m.role !== "system")
          .map((msg, i) => (
            <ChatBubble key={msg._id || `msg-${i}`} message={msg} />
          ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Suggestion prompts ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  {
    icon: ChartLineData03Icon,
    category: "Markets",
    label: "What's the current state of the crypto market?",
    prompt: "What's the current state of the crypto market?",
  },
  {
    icon: IdeaIcon,
    category: "Learn",
    label: "Explain DeFi yield farming in simple terms",
    prompt: "Explain DeFi yield farming to me in simple terms",
  },
  {
    icon: ShieldKeyIcon,
    category: "Security",
    label: "Best practices for securing my crypto wallet",
    prompt: "What are the best practices for securing my crypto wallet?",
  },
  {
    icon: BalanceScaleIcon,
    category: "Compare",
    label: "Bitcoin vs Ethereum as investments",
    prompt: "Compare Bitcoin vs Ethereum as investments. What are the key differences?",
  },
]
