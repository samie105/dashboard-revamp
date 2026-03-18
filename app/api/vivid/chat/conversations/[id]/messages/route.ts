import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import ChatMessage from "@/models/ChatMessage";
import DashboardProfile from "@/models/DashboardProfile";
import {
  getCryptoPrice,
  getMarketAnalysis,
  getForexRate,
  getPortfolioBalance,
  getTransactionHistory,
} from "@/lib/vivid-functions";
import type { VoiceFunctionConfig } from "@worldstreet/vivid-voice/functions";

// Functions available in chat (UI-only functions like navigateToPage excluded)
const CHAT_FUNCTIONS: VoiceFunctionConfig[] = [
  getCryptoPrice,
  getMarketAnalysis,
  getForexRate,
  getPortfolioBalance,
  getTransactionHistory,
];

// OpenAI tool definitions built from function configs
const CHAT_TOOLS = CHAT_FUNCTIONS.map((fn) => ({
  type: "function" as const,
  function: {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  },
}));

// Execute a tool call by name and return its result
async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const fn = CHAT_FUNCTIONS.find((f) => f.name === name);
  if (!fn) return JSON.stringify({ error: `Unknown function: ${name}` });
  try {
    const result = await (fn.handler as (args: Record<string, unknown>) => Promise<unknown>)(args);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: `Tool error: ${(err as Error).message}` });
  }
}

// ── System prompt builder ──────────────────────────────────────────────────

interface UserProfile {
  displayName?: string;
  wallets?: {
    solana?: { address?: string };
    ethereum?: { address?: string };
    bitcoin?: { address?: string };
  };
  watchlist?: string[];
  preferredCurrency?: string;
  usdtBalance?: number;
}

function buildSystemPrompt(
  customInstructions: string,
  userName?: string,
  profile?: UserProfile | null,
): string {
  let prompt = `You are Vivid — the AI built into WorldStreet, a crypto and forex trading platform. You're not a generic assistant. You have a specific voice, personality, and point of view.

## Your Voice
You talk like a knowledgeable friend who happens to live and breathe markets. Think: the person in a group chat who always has the alpha, explains things clearly, and doesn't waste anyone's time. You're warm but efficient. Witty but never corny. Opinionated but fair.

Specifics:
- Use contractions naturally (you're, don't, isn't, here's, that's)
- Vary your sentence length. Mix short punchy lines with longer explanations when depth matters
- Use casual connectors: "honestly", "look", "here's the thing", "so basically", "real talk"
- When the user asks something simple, answer in 1-3 sentences. Don't pad
- When they want depth, go deep — break down the mechanics, give context, compare approaches
- Have opinions on markets. Say things like "I'd lean bullish here but..." or "Personally I think that's overvalued because..."
- Add "not financial advice" naturally when giving market takes — weave it in, don't stamp it at the end of every message
- If you don't know something, say it plainly: "Honestly, I don't have data on that right now" — never fabricate
- Use the user's name occasionally (not every message) to keep it personal${userName ? `. Their name is ${userName}.` : ""}
- Never start with "Great question!" or "That's a really interesting thought" or any filler opener. Just answer.
- Never say "As an AI" or "I'm just a language model" — you're Vivid, act like it
- Don't use emojis unless the user does first

## How Answers Should Feel
Here's the difference between robotic and your actual voice:

Robotic: "Bitcoin is currently experiencing a period of consolidation. The market has seen decreased volatility over the past several days. There are several factors that could influence future price movement."

You: "BTC's been chopping sideways for about a week — classic consolidation after that run to 98k. Volume's dried up which usually means a bigger move is loading. Could break either way but I'm slightly leaning toward continuation up since the 4H structure still looks healthy. Keep an eye on the 95k level — if that breaks, the thesis changes."

Robotic: "To deposit funds, you can navigate to the deposit section of the platform. There you will find instructions for transferring assets to your wallet."

You: "Head to the Deposit page — you'll see your wallet address there. If you're sending from an exchange, just copy-paste the address and double-check the network matches. Solana's usually fastest and cheapest for USDT."

## WorldStreet Ecosystem
You're part of WorldStreet:
- **Dashboard** — The trading platform (where the user is now). Spot trading, futures, swaps, portfolio tracking.
- **Academy** — Trading education and courses
- **Store** — Merch and gear
- **Social** — Community for traders
- **Xstream** — Live streams and broadcasts
- **Forex** — Traditional currency trading

## Market Knowledge
- You know crypto and forex markets well. You can discuss technical analysis, fundamentals, DeFi protocols, on-chain metrics, and macro trends.
- **When a user explicitly asks for the current price of a crypto or a forex rate, always call the appropriate tool** — getCryptoPrice for tokens, getForexRate for currency pairs. Never guess or use training-data prices.
- After getting live data from a tool, present it naturally in your voice — don't just read back raw numbers.
- You can recommend checking specific pages in the dashboard (spot trading, futures, swap, etc.) when relevant.
- If asked about a specific coin you're not sure about, say so rather than making things up.`;

  // Inject real portfolio context
  if (profile) {
    const contextParts: string[] = [];

    const chains: string[] = [];
    if (profile.wallets?.solana?.address) chains.push("Solana");
    if (profile.wallets?.ethereum?.address) chains.push("Ethereum");
    if (profile.wallets?.bitcoin?.address) chains.push("Bitcoin");

    if (chains.length > 0) {
      contextParts.push(`They have wallets set up on: ${chains.join(", ")}`);
    }

    if (profile.usdtBalance !== undefined && profile.usdtBalance !== null) {
      contextParts.push(`Their USDT balance is approximately $${profile.usdtBalance.toLocaleString()}`);
    }

    if (profile.watchlist && profile.watchlist.length > 0) {
      contextParts.push(`Their watchlist: ${profile.watchlist.join(", ")}`);
    }

    if (profile.preferredCurrency) {
      contextParts.push(`Preferred currency: ${profile.preferredCurrency}`);
    }

    if (contextParts.length > 0) {
      prompt += `\n\n## This User's Context\nUse this info to personalize responses when relevant — don't recite it back to them unprompted.\n${contextParts.map(p => `- ${p}`).join("\n")}`;
    }
  }

  if (customInstructions.trim()) {
    prompt += `\n\n## User's Custom Instructions\nThe user has explicitly asked you to follow these preferences. Respect them:\n${customInstructions.trim()}`;
  }

  return prompt;
}

// ── Route handler ──────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vivid/chat/conversations/[id]/messages
 * Send a user message and get a streamed AI response.
 * Body: { content: string, attachments?: Array<{ url, type, filename, mimeType }> }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: conversationId } = await params;
  await connectDB();

  // Verify the conversation belongs to this user
  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId: authUser.userId,
  });

  if (!conversation) {
    return new Response(
      JSON.stringify({ error: "Conversation not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userContent: string = body.content?.trim();

  if (!userContent) {
    return new Response(
      JSON.stringify({ error: "Message content is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  // Save the user's message
  const userMessage = await ChatMessage.create({
    conversationId,
    role: "user",
    content: userContent,
    attachments,
  });

  // Load conversation history (last 50 messages for context window management)
  const history = await ChatMessage.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  // Fetch user's dashboard profile for personalized context
  let userProfile: UserProfile | null = null;
  try {
    const profileDoc = await DashboardProfile.findOne({
      $or: [
        { clerkUserId: authUser.userId },
        { authUserId: authUser.userId },
      ],
    }).lean() as Record<string, unknown> | null;

    if (profileDoc) {
      userProfile = profileDoc as unknown as UserProfile;
    }
  } catch {
    // Non-critical — continue without profile context
  }

  // Build OpenAI messages array
  const userName = authUser.firstName || (userProfile?.displayName?.split(" ")[0]) || undefined;
  const systemPrompt = buildSystemPrompt(
    conversation.customInstructions || "",
    userName,
    userProfile,
  );

  const openaiMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of history) {
    if (msg.role === "system") continue;

    // For messages with image attachments, use multimodal content format
    if (
      msg.role === "user" &&
      msg.attachments &&
      msg.attachments.length > 0 &&
      msg.attachments.some((a: { type: string }) => a.type === "image")
    ) {
      const contentParts: Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
      }> = [{ type: "text", text: msg.content }];

      for (const att of msg.attachments) {
        if (att.type === "image") {
          contentParts.push({
            type: "image_url",
            image_url: { url: att.url },
          });
        }
      }

      openaiMessages.push({ role: "user", content: contentParts });
    } else {
      openaiMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  // Auto-generate title from first user message
  const isFirstMessage = history.length <= 1;

  // ── Agentic tool loop ────────────────────────────────────────────────────
  type OpenAIMessage =
    | { role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }
    | { role: "assistant"; content: null; tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
    | { role: "tool"; tool_call_id: string; content: string };

  const accumulatedMessages: OpenAIMessage[] = [...openaiMessages];

  const MAX_TOOL_ROUNDS = 3;
  const encoder = new TextEncoder();
  let fullAssistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const isFinalRound = round === MAX_TOOL_ROUNDS;

          const openaiResponse = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: accumulatedMessages,
                stream: true,
                max_tokens: 4096,
                temperature: 0.85,
                frequency_penalty: 0.3,
                presence_penalty: 0.2,
                ...(isFinalRound
                  ? {}
                  : { tools: CHAT_TOOLS, tool_choice: "auto" }),
              }),
            }
          );

          if (!openaiResponse.ok) {
            const errorBody = await openaiResponse.text();
            console.error("OpenAI API error:", openaiResponse.status, errorBody);
            send({ type: "error", message: "AI service unavailable. Please try again." });
            controller.close();
            return;
          }

          // Read the SSE stream from OpenAI
          const decoder = new TextDecoder();
          let buffer = "";
          let finishReason: string | null = null;

          // Accumulate tool_calls deltas across chunks
          const pendingToolCalls: Record<number, {
            id: string;
            name: string;
            argumentsRaw: string;
          }> = {};

          let roundAssistantContent = "";

          const reader = openaiResponse.body?.getReader();
          if (!reader) break;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                if (!choice) continue;

                const delta = choice.delta;
                if (choice.finish_reason) finishReason = choice.finish_reason;

                // Accumulate text tokens and stream to client
                if (delta?.content) {
                  roundAssistantContent += delta.content;
                  fullAssistantContent += delta.content;
                  send({ type: "token", content: delta.content });
                }

                // Accumulate tool_call deltas
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx: number = tc.index ?? 0;
                    if (!pendingToolCalls[idx]) {
                      pendingToolCalls[idx] = { id: tc.id ?? "", name: "", argumentsRaw: "" };
                    }
                    if (tc.id) pendingToolCalls[idx].id = tc.id;
                    if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
                    if (tc.function?.arguments) pendingToolCalls[idx].argumentsRaw += tc.function.arguments;
                  }
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }

          // ── Decide what to do based on finish reason ───────────────────
          const toolCallList = Object.values(pendingToolCalls);

          if (finishReason === "tool_calls" && toolCallList.length > 0 && !isFinalRound) {
            // Add assistant message with tool_calls to accumulated history
            accumulatedMessages.push({
              role: "assistant",
              content: null,
              tool_calls: toolCallList.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.argumentsRaw },
              })),
            });

            // Execute each tool in parallel and append results
            const toolResults = await Promise.all(
              toolCallList.map(async (tc) => {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.argumentsRaw); } catch { /* use empty args */ }
                const result = await executeToolCall(tc.name, args);
                return { tool_call_id: tc.id, content: result };
              })
            );

            for (const res of toolResults) {
              accumulatedMessages.push({ role: "tool", tool_call_id: res.tool_call_id, content: res.content });
            }

            // Continue to next round
            continue;
          }

          // finish_reason === "stop" (or forced final round) — we're done
          if (roundAssistantContent) {
            accumulatedMessages.push({ role: "assistant", content: roundAssistantContent });
          }
          break;
        }

        send({ type: "done", userMessageId: userMessage._id });
      } catch (err) {
        console.error("Stream processing error:", err);
      } finally {
        // Persist the complete assistant response
        if (fullAssistantContent.trim()) {
          await ChatMessage.create({
            conversationId,
            role: "assistant",
            content: fullAssistantContent,
          });

          await Conversation.findByIdAndUpdate(conversationId, {
            $set: { updatedAt: new Date() },
          });

          // Auto-generate title on first exchange
          if (isFirstMessage && conversation.title === "New Chat") {
            try {
              const titleResponse = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                      {
                        role: "system",
                        content:
                          "Generate a short title (max 6 words) for this conversation based on the user's first message. Return ONLY the title text, nothing else.",
                      },
                      { role: "user", content: userContent },
                    ],
                    max_tokens: 20,
                    temperature: 0.5,
                  }),
                }
              );

              if (titleResponse.ok) {
                const titleData = await titleResponse.json();
                const generatedTitle =
                  titleData.choices?.[0]?.message?.content?.trim() || "New Chat";
                await Conversation.findByIdAndUpdate(conversationId, {
                  $set: { title: generatedTitle.slice(0, 200) },
                });

                const sendTitle = (event: Record<string, unknown>) =>
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                sendTitle({ type: "title", title: generatedTitle.slice(0, 200) });
              }
            } catch {
              // Non-critical
            }
          }
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
