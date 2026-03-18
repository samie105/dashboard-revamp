"use client"

import React, { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, AiChat01Icon, File01Icon } from "@hugeicons/core-free-icons"
import type { Message } from "@/hooks/useChat"

interface ChatBubbleProps {
  message: Message
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user"

  const formattedContent = useMemo(() => {
    if (isUser) return message.content
    return formatMarkdown(message.content)
  }, [message.content, isUser])

  const formattedTime = useMemo(() => {
    const date = new Date(message.createdAt)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }, [message.createdAt])

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} group`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-linear-to-br from-violet-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? (
          <HugeiconsIcon icon={UserIcon} className="h-4 w-4" />
        ) : (
          <HugeiconsIcon icon={AiChat01Icon} className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-accent/80 text-foreground rounded-bl-md"
          }`}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, i) => (
                <div key={i}>
                  {att.type === "image" ? (
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-w-50 max-h-37.5 rounded-lg object-cover"
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                        isUser
                          ? "bg-white/20 hover:bg-white/30"
                          : "bg-background hover:bg-accent"
                      } transition-colors`}
                    >
                      <HugeiconsIcon icon={File01Icon} className="h-4 w-4" />
                      <span className="truncate max-w-37.5">{att.filename}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Message content */}
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div
              className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
              dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>

        {/* Timestamp */}
        {!message.isStreaming && (
          <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Simple markdown → HTML formatter ───────────────────────────────────────

function formatMarkdown(text: string): string {
  if (!text) return ""

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Code blocks (``` ... ```)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, lang, code) =>
      `<pre class="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2"><code class="language-${lang || "text"}">${code.trim()}</code></pre>`,
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>")

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-3 mb-1">$1</h1>')

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')

  // Wrap consecutive <li> items
  html = html.replace(
    /((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g,
    '<ul class="my-1">$1</ul>',
  )
  html = html.replace(
    /((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g,
    '<ol class="my-1">$1</ol>',
  )

  // Line breaks → paragraphs
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ""
      if (
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol")
      ) {
        return trimmed
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`
    })
    .join("\n")

  return html
}
