"use client"

import React, { useRef, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiChat01Icon,
  ChartLineData03Icon,
  IdeaIcon,
  ShieldKeyIcon,
  BalanceScaleIcon,
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

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20 border-t-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-5">
            <HugeiconsIcon icon={AiChat01Icon} className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Vivid AI</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Your AI-powered trading assistant. Ask about crypto markets, trading strategies,
            portfolio analysis, or anything else.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="text-left px-4 py-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-muted-foreground group"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("vivid:suggestion", {
                      detail: { text: s.prompt },
                    }),
                  )
                }}
              >
                <HugeiconsIcon
                  icon={s.icon}
                  className="h-4.5 w-4.5 text-primary mb-1.5 group-hover:scale-110 transition-transform"
                />
                <span className="line-clamp-2">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-3xl mx-auto space-y-5">
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
    label: "What's the current state of the crypto market?",
    prompt: "What's the current state of the crypto market?",
  },
  {
    icon: IdeaIcon,
    label: "Explain DeFi yield farming to me",
    prompt: "Explain DeFi yield farming to me in simple terms",
  },
  {
    icon: ShieldKeyIcon,
    label: "Best practices for securing my crypto wallet",
    prompt: "What are the best practices for securing my crypto wallet?",
  },
  {
    icon: BalanceScaleIcon,
    label: "Compare Bitcoin vs Ethereum as investments",
    prompt: "Compare Bitcoin vs Ethereum as investments. What are the key differences?",
  },
]
