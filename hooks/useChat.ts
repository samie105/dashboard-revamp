"use client";

import { useState, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Attachment {
  url: string;
  type: "image" | "document";
  filename: string;
  mimeType: string;
}

export interface Message {
  _id?: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: Attachment[];
  createdAt: string;
  isStreaming?: boolean;
}

export interface Conversation {
  _id: string;
  title: string;
  customInstructions: string;
  createdAt: string;
  updatedAt: string;
}

interface UseChatReturn {
  // Conversations
  conversations: Conversation[];
  activeConversation: Conversation | null;
  conversationsLoading: boolean;
  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation | null>;
  selectConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateCustomInstructions: (id: string, instructions: string) => Promise<void>;

  // Messages
  messages: Message[];
  messagesLoading: boolean;

  // Chat
  sendMessage: (content: string, attachments?: Attachment[], conversationOverride?: Conversation) => Promise<void>;
  isGenerating: boolean;
  stopGenerating: () => void;

  // Errors
  error: string | null;
  clearError: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChat(): UseChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<Conversation | null>(null);

  // Keep ref in sync with state so sendMessage always reads the latest value
  activeConversationRef.current = activeConversation;

  const clearError = useCallback(() => setError(null), []);

  // ── Fetch all conversations ──────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const res = await fetch("/api/vivid/chat/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  // ── Create a new conversation ────────────────────────────────────────

  const createConversation = useCallback(
    async (title?: string): Promise<Conversation | null> => {
      try {
        const res = await fetch("/api/vivid/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "New Chat" }),
        });
        if (!res.ok) throw new Error("Failed to create conversation");
        const data = await res.json();
        const newConvo: Conversation = data.conversation;
        setConversations((prev) => [newConvo, ...prev]);
        setActiveConversation(newConvo);
        setMessages([]);
        return newConvo;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create conversation"
        );
        return null;
      }
    },
    []
  );

  // ── Select / load a conversation ─────────────────────────────────────

  const selectConversation = useCallback(async (id: string) => {
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/vivid/chat/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      setActiveConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation"
      );
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // ── Rename a conversation ────────────────────────────────────────────

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/vivid/chat/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error("Failed to rename conversation");
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) => (c._id === id ? data.conversation : c))
        );
        if (activeConversationRef.current?._id === id) {
          setActiveConversation(data.conversation);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to rename conversation"
        );
      }
    },
    []
  );

  // ── Delete a conversation ────────────────────────────────────────────

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/vivid/chat/conversations/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete conversation");
        setConversations((prev) => prev.filter((c) => c._id !== id));
        if (activeConversationRef.current?._id === id) {
          setActiveConversation(null);
          setMessages([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete conversation"
        );
      }
    },
    []
  );

  // ── Update custom instructions ───────────────────────────────────────

  const updateCustomInstructions = useCallback(
    async (id: string, instructions: string) => {
      try {
        const res = await fetch(`/api/vivid/chat/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customInstructions: instructions }),
        });
        if (!res.ok) throw new Error("Failed to update instructions");
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) => (c._id === id ? data.conversation : c))
        );
        if (activeConversationRef.current?._id === id) {
          setActiveConversation(data.conversation);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update custom instructions"
        );
      }
    },
    []
  );

  // ── Send a message with streaming ────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, attachments: Attachment[] = [], conversationOverride?: Conversation) => {
      const convo = conversationOverride || activeConversationRef.current;
      if (!convo) {
        setError("No active conversation");
        return;
      }

      setError(null);

      // Add user message to UI immediately
      const tempUserMsg: Message = {
        conversationId: convo._id,
        role: "user",
        content,
        attachments,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Add placeholder for assistant streaming response
      const tempAssistantMsg: Message = {
        conversationId: convo._id,
        role: "assistant",
        content: "",
        attachments: [],
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, tempAssistantMsg]);
      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(
          `/api/vivid/chat/conversations/${convo._id}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, attachments }),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to send message");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(trimmed.slice(6));

              if (event.type === "token") {
                // Append token to the streaming assistant message
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === "assistant" && lastMsg.isStreaming) {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      content: lastMsg.content + event.content,
                    };
                  }
                  return updated;
                });
              } else if (event.type === "title") {
                // Update conversation title
                const convoId = convo._id;
                setActiveConversation((prev) =>
                  prev ? { ...prev, title: event.title } : prev
                );
                setConversations((prev) =>
                  prev.map((c) =>
                    c._id === convoId
                      ? { ...c, title: event.title }
                      : c
                  )
                );
              } else if (event.type === "done") {
                // Mark streaming as complete
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === "assistant" && lastMsg.isStreaming) {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      isStreaming: false,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User cancelled — mark streaming as complete with what we have
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg.isStreaming) {
              if (lastMsg.content.trim()) {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  isStreaming: false,
                };
              } else {
                // Remove empty assistant message
                updated.pop();
              }
            }
            return updated;
          });
        } else {
          // Remove the failed assistant message
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg.isStreaming) {
              updated.pop();
            }
            return updated;
          });
          setError(
            err instanceof Error ? err.message : "Failed to send message"
          );
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  // ── Stop generating ──────────────────────────────────────────────────

  const stopGenerating = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    conversations,
    activeConversation,
    conversationsLoading,
    fetchConversations,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    updateCustomInstructions,
    messages,
    messagesLoading,
    sendMessage,
    isGenerating,
    stopGenerating,
    error,
    clearError,
  };
}
