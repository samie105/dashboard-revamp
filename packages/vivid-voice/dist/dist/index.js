'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/provider.tsx

// src/functions.ts
function createVividFunction(config) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.name)) {
    throw new Error(
      `Invalid function name "${config.name}". Must start with a letter or underscore and contain only alphanumeric characters and underscores.`
    );
  }
  if (!config.description || config.description.trim().length === 0) {
    throw new Error(`Function "${config.name}" must have a description.`);
  }
  return {
    ...config,
    executionContext: config.executionContext ?? "client"
  };
}
var FunctionRegistry = class {
  constructor() {
    this.functions = /* @__PURE__ */ new Map();
  }
  /**
   * Register a function
   */
  register(config) {
    if (this.functions.has(config.name)) {
      console.warn(`[Vivid] Function "${config.name}" is already registered. Overwriting.`);
    }
    this.functions.set(config.name, config);
  }
  /**
   * Register multiple functions at once
   */
  registerAll(configs) {
    for (const config of configs) {
      this.register(config);
    }
  }
  /**
   * Unregister a function by name
   */
  unregister(name) {
    return this.functions.delete(name);
  }
  /**
   * Get a function by name
   */
  get(name) {
    return this.functions.get(name);
  }
  /**
   * Check if a function is registered
   */
  has(name) {
    return this.functions.has(name);
  }
  /**
   * Get all registered functions
   */
  getAll() {
    return Array.from(this.functions.values());
  }
  /**
   * Get all client-side functions
   */
  getClientFunctions() {
    return this.getAll().filter((fn) => fn.executionContext === "client");
  }
  /**
   * Get all server-side functions
   */
  getServerFunctions() {
    return this.getAll().filter((fn) => fn.executionContext === "server");
  }
  /**
   * Convert all registered functions to OpenAI tool definitions
   */
  toOpenAITools() {
    return this.getAll().map(functionToOpenAITool);
  }
  /**
   * Clear all registered functions
   */
  clear() {
    this.functions.clear();
  }
  /**
   * Get the count of registered functions
   */
  get size() {
    return this.functions.size;
  }
};
function functionToOpenAITool(config) {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters
  };
}
async function executeFunction(registry, name, args) {
  const startTime = performance.now();
  const fn = registry.get(name);
  if (!fn) {
    return {
      success: false,
      error: `Function "${name}" not found`,
      executionTime: performance.now() - startTime
    };
  }
  try {
    const result = await fn.handler(args);
    return {
      success: true,
      result,
      executionTime: performance.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime
    };
  }
}
function stringParam(description, required = true) {
  return { type: "string", description, _required: required };
}
function numberParam(description, required = false) {
  return { type: "number", description, _required: required };
}
function booleanParam(description, required = false) {
  return { type: "boolean", description, _required: required };
}
function enumParam(description, options, required = false) {
  return { type: "string", description, enum: options, _required: required };
}
function buildParameters(params) {
  const properties = {};
  const required = [];
  for (const [key, param] of Object.entries(params)) {
    const { _required, ...prop } = param;
    properties[key] = prop;
    if (_required) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    ...required.length > 0 ? { required } : {}
  };
}

// src/prompt.ts
var VIVID_BASE_PROMPT = `You are Vivid, a calm and knowledgeable voice AI assistant created by Worldstreet. You're the voice behind Worldstreet's ecosystem of platforms \u2014 from the Academy to Xstream, the Store, and the Community.

## Your Identity
- Name: Vivid
- Creator: Worldstreet
- Purpose: The voice AI powering Worldstreet's ecosystem \u2014 Academy, Xstream (livestreaming), Store (e-commerce), and Community (social platform)
- Personality: Warm, composed, and genuinely helpful \u2014 like a knowledgeable advisor who takes time to actually listen

## Worldstreet Ecosystem
You are aware of and can assist across all Worldstreet platforms:
- **Worldstreet Academy** \u2014 Learning and education platform
- **Xstream** \u2014 Livestreaming platform
- **Worldstreet Store** \u2014 E-commerce marketplace
- **Worldstreet Community** \u2014 Social media platform for connecting and collaboration
When relevant, you can suggest resources or features from other platforms in the ecosystem.

## Core Behavior Guidelines

### Personality & Tone
- Be warm and conversational, but measured \u2014 no unnecessary filler, no over-the-top enthusiasm
- Use natural speech: contractions and casual phrasing are fine, but keep a calm, grounded tone
- Avoid hollow hype phrases like "Great choice!", "Amazing!", "Absolutely!" \u2014 they undermine trust
- Match the user's energy without amplifying it: if they're direct, be direct; if they're relaxed, stay relaxed
- Show genuine interest in helping \u2014 be present and focused, not performatively cheerful

### Greetings & Personalization
- When you know the user's name, greet them naturally: "Hi Sarah", "Good to hear from you, Marcus"
- Remember context from the conversation and reference it naturally
- If this is a first interaction, give a calm welcome and briefly say what you can help with
- For returning users, keep it simple: "Hi, what can I help you with?"

### Being Proactive
- Don't just answer questions \u2014 notice what the user might need next
- After completing a task, mention a logical next step if there is one: "You can also check..." or "If you need to..."
- If the user seems unsure, offer options without overwhelming them
- Only suggest things that are genuinely useful \u2014 don't pad responses

### Navigation
- When the user asks to go somewhere, briefly confirm before navigating: "Taking you to Spot Trading" or "Heading to your assets now"
- Keep the confirmation short \u2014 one phrase, then navigate immediately
- Do not ask for permission before navigating unless the destination is ambiguous

### Action Execution
- When calling functions, acknowledge briefly: "Let me check that" or "One moment"
- After getting results, summarize conversationally \u2014 don't read raw data back
- Confirm before doing anything destructive or irreversible: "Just to confirm \u2014 you want to delete that?"
- If something fails, stay calm: "That didn't work. Let me try a different approach" or suggest a next step
- Never surface raw technical errors \u2014 translate them into plain language

### Knowledge & Honesty
- Be upfront about what you can and can't do
- If you don't know something, say so plainly: "I'm not sure about that, but here's what I can help with"
- Guide users toward features they might not know about, without being pushy
- When relevant, point them to the right Worldstreet platform for their need

### Safety & Privacy
- Never ask for sensitive info like passwords, card numbers, or SSNs through voice
- Protect user privacy in every interaction
- Follow all applicable data protection guidelines

### Error Handling
- Stay calm when things go wrong \u2014 don't catastrophize
- Give clear, practical guidance on next steps
- Don't keep retrying failed actions without checking with the user first

## Response Format
- Keep responses short: 1-3 sentences for most things
- For complex info, break it into short chunks \u2014 don't info-dump
- Ask a clarifying question if you're genuinely unsure what they mean
- Speak at a natural pace \u2014 this is a conversation, not a presentation`;
async function buildSystemPrompt(platformContext, user, pathname) {
  let fullPrompt = VIVID_BASE_PROMPT;
  if (platformContext) {
    try {
      const platformPrompt = await platformContext(user, pathname);
      if (platformPrompt && platformPrompt.trim().length > 0) {
        fullPrompt += `

## Platform-Specific Context

${platformPrompt.trim()}`;
      }
    } catch (error) {
      console.error("[Vivid] Error generating platform context:", error);
    }
  }
  if (user) {
    fullPrompt += `

## Current User
`;
    fullPrompt += `- User ID: ${user.id}
`;
    if (user.firstName) {
      const greeting = user.firstName;
      fullPrompt += `- Name: ${greeting}${user.lastName ? ` ${user.lastName}` : ""}
`;
      fullPrompt += `- IMPORTANT: Address this user by their first name (${greeting}) in a friendly way
`;
    }
    if (user.email) {
      fullPrompt += `- Email: ${user.email}
`;
    }
  }
  return fullPrompt;
}
function generateFunctionInstructions(functionNames) {
  if (functionNames.length === 0) {
    return "";
  }
  return `
## Available Functions
You have access to the following functions to help the user:
${functionNames.map((name) => `- ${name}`).join("\n")}

When a user asks you to do something that matches one of these functions:
1. Let them know what you're doing in a natural way ("Let me check that for you")
2. Call the function with the right parameters
3. Wait for the result
4. Share the outcome conversationally \u2014 don't just read back raw data

If you're not sure which function to use, ask the user to clarify. If a task is done and there's a logical next step, proactively suggest it.`;
}
var VIVID_TEST_PROMPT = `You are Vivid, a test voice assistant by Worldstreet. Keep responses very brief and friendly. Available functions will be provided separately.`;

// src/realtime-client.ts
var _RealtimeClient = class _RealtimeClient {
  constructor(config, events) {
    this.pc = null;
    this.dc = null;
    this.audioElement = null;
    this.mediaStream = null;
    // Audio Analysis
    this.audioContext = null;
    this.analyser = null;
    this.microphoneNode = null;
    this.remoteNode = null;
    this.state = "idle";
    this.isSpeakingRef = false;
    this.config = config;
    this.events = events;
  }
  /**
   * Connect to OpenAI Realtime API via WebRTC
   */
  async connect() {
    if (this.pc) {
      console.warn("[Vivid] Already connected");
      return;
    }
    this.setState("connecting");
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });
      this.pc = pc;
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      this.audioElement = audioEl;
      document.body.appendChild(audioEl);
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.5;
      } catch (e) {
        console.warn("[Vivid] Failed to initialize AudioContext for visualization:", e);
      }
      pc.ontrack = (event) => {
        console.log("[Vivid] Received remote audio track:", event.track.kind, event.streams.length, "streams");
        const stream2 = event.streams[0];
        audioEl.srcObject = stream2;
        audioEl.play().catch((e) => {
          console.warn("[Vivid] Audio autoplay blocked:", e);
        });
        if (this.audioContext && this.analyser && stream2) {
          try {
            this.remoteNode = this.audioContext.createMediaStreamSource(stream2);
            this.remoteNode.connect(this.analyser);
          } catch (e) {
            console.warn("[Vivid] Failed to connect remote stream to analyser:", e);
          }
        }
      };
      pc.onconnectionstatechange = () => {
        console.log("[Vivid] Connection state:", pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          this.disconnect();
        }
      };
      pc.oniceconnectionstatechange = () => {
        console.log("[Vivid] ICE connection state:", pc.iceConnectionState);
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.mediaStream = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      if (this.audioContext && this.analyser) {
        try {
          this.microphoneNode = this.audioContext.createMediaStreamSource(stream);
          this.microphoneNode.connect(this.analyser);
        } catch (e) {
          console.warn("[Vivid] Failed to connect microphone to analyser:", e);
        }
      }
      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onopen = () => {
        console.log("[Vivid] Data channel open");
        this.setState("ready");
        setTimeout(() => {
          if (dc.readyState === "open") {
            dc.send(JSON.stringify({ type: "response.create" }));
          }
        }, 1e3);
      };
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (err) {
          console.error("[Vivid] Error parsing event:", err);
        }
      };
      dc.onclose = () => {
        console.log("[Vivid] Data channel closed");
        this.setState("idle");
        this.events.onResponseDone();
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(
        `${_RealtimeClient.REALTIME_URL}?model=${_RealtimeClient.MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.sessionToken}`,
            "Content-Type": "application/sdp"
          },
          body: offer.sdp
        }
      );
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP exchange failed (${sdpResponse.status}): ${errorText}`);
      }
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[Vivid] WebRTC connection established");
    } catch (error) {
      console.error("[Vivid] Connection failed:", error);
      this.setState("error");
      this.events.onError(error instanceof Error ? error : new Error(String(error)));
      this.disconnect();
    }
  }
  /**
   * Get current audio frequency data for visualization
   */
  getAudioLevels() {
    if (!this.analyser) {
      return new Uint8Array(0);
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
  /**
   * Disconnect from the API
   */
  disconnect() {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {
      });
      this.audioContext = null;
      this.analyser = null;
      this.microphoneNode = null;
      this.remoteNode = null;
    }
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.parentNode?.removeChild(this.audioElement);
      this.audioElement = null;
    }
    this.isSpeakingRef = false;
    this.setState("idle");
  }
  /**
   * Send audio data - not used with WebRTC (audio flows via media tracks)
   * Kept for API compatibility
   */
  sendAudio(_base64Audio) {
  }
  /**
   * Commit the audio buffer (for manual turn detection)
   */
  commitAudioBuffer() {
    this.sendEvent({ type: "input_audio_buffer.commit" });
  }
  /**
   * Clear the audio buffer
   */
  clearAudioBuffer() {
    this.sendEvent({ type: "input_audio_buffer.clear" });
  }
  /**
   * Send a function call result back to the API
   */
  sendFunctionResult(callId, result) {
    this.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result)
      }
    });
    this.sendEvent({ type: "response.create" });
  }
  /**
   * Cancel the current response
   */
  cancelResponse() {
    this.sendEvent({ type: "response.cancel" });
  }
  /**
   * Send a text message
   */
  sendMessage(text) {
    this.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }]
      }
    });
    this.sendEvent({ type: "response.create" });
  }
  /**
   * Check if connected
   */
  isConnected() {
    return this.dc?.readyState === "open";
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get the media stream (for audio visualizers)
   */
  getMediaStream() {
    return this.mediaStream;
  }
  // ============================================================================
  // Private Methods
  // ============================================================================
  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.events.onStateChange(state);
    }
  }
  sendEvent(event) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(event));
    }
  }
  handleEvent(event) {
    switch (event.type) {
      case "session.created":
        console.log("[Vivid] Session created:", JSON.stringify(event.session || {}, null, 2));
        break;
      case "session.updated":
        console.log("[Vivid] Session updated");
        break;
      case "conversation.item.input_audio_transcription.completed":
        console.log("[Vivid] User said:", event.transcript);
        this.events.onTranscript(event.transcript, true);
        break;
      case "conversation.item.input_audio_transcription.failed":
        console.warn("[Vivid] Transcription failed:", JSON.stringify(event.error || event));
        break;
      case "response.audio_transcript.done":
        console.log("[Vivid] AI said:", event.transcript);
        this.events.onTranscript(event.transcript, true);
        break;
      case "response.audio.delta":
        if (!this.isSpeakingRef) {
          this.isSpeakingRef = true;
          this.setState("speaking");
          console.log("[Vivid] AI started speaking (audio.delta received)");
        }
        break;
      case "response.function_call_arguments.done":
        this.handleFunctionCall(event);
        break;
      case "response.created":
        console.log("[Vivid] Response created:", event.response?.id);
        break;
      case "response.done":
        console.log("[Vivid] Response done:", event.response?.status, event.response?.status_details || "");
        this.isSpeakingRef = false;
        this.setState("ready");
        this.events.onResponseDone();
        break;
      case "input_audio_buffer.speech_started":
        console.log("[Vivid] User started speaking");
        this.setState("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        console.log("[Vivid] User stopped speaking");
        this.setState("processing");
        break;
      case "input_audio_buffer.committed":
        console.log("[Vivid] Audio buffer committed");
        break;
      case "error":
        console.error("[Vivid] API Error:", JSON.stringify(event.error));
        this.events.onError(
          new Error(event.error?.message || "Realtime API error")
        );
        break;
      default:
        console.log("[Vivid] Unhandled event:", event.type, event);
        break;
    }
  }
  handleFunctionCall(event) {
    try {
      const args = JSON.parse(event.arguments || "{}");
      this.events.onFunctionCall(event.name, args, event.call_id);
    } catch (error) {
      console.error("[Vivid] Error parsing function arguments:", error);
      this.sendFunctionResult(event.call_id, {
        error: "Failed to parse function arguments"
      });
    }
  }
};
_RealtimeClient.REALTIME_URL = "https://api.openai.com/v1/realtime";
_RealtimeClient.MODEL = "gpt-4o-realtime-preview-2024-12-17";
var RealtimeClient = _RealtimeClient;

// src/persistence.ts
var STORAGE_KEY = "vivid_conversation";
var STORAGE_VERSION = 1;
var ConversationStore = class {
  constructor(options = {}) {
    this.maxHistory = options.maxHistory ?? 50;
    this.storageKey = options.namespace ? `${STORAGE_KEY}_${options.namespace}` : STORAGE_KEY;
  }
  /**
   * Save conversation to localStorage
   */
  save(turns) {
    if (typeof window === "undefined") return;
    try {
      const trimmedTurns = turns.slice(-this.maxHistory);
      const data = {
        version: STORAGE_VERSION,
        conversation: {
          sessionId: this.getOrCreateSessionId(),
          turns: trimmedTurns,
          lastUpdated: Date.now()
        }
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("[Vivid] Failed to save conversation:", error);
    }
  }
  /**
   * Load conversation from localStorage
   */
  load() {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (data.version !== STORAGE_VERSION) {
        console.log("[Vivid] Clearing outdated conversation storage");
        this.clear();
        return [];
      }
      return data.conversation.turns;
    } catch (error) {
      console.warn("[Vivid] Failed to load conversation:", error);
      return [];
    }
  }
  /**
   * Add a single turn to the conversation
   */
  addTurn(turn) {
    const turns = this.load();
    turns.push(turn);
    this.save(turns);
  }
  /**
   * Clear all stored conversation data
   */
  clear() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(`${this.storageKey}_session`);
    } catch (error) {
      console.warn("[Vivid] Failed to clear conversation:", error);
    }
  }
  /**
   * Get the current session ID or create a new one
   */
  getOrCreateSessionId() {
    const sessionKey = `${this.storageKey}_session`;
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = `vivid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  }
  /**
   * Get time since last conversation update
   */
  getTimeSinceLastUpdate() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Date.now() - data.conversation.lastUpdated;
    } catch {
      return null;
    }
  }
  /**
   * Check if there's an existing conversation
   */
  hasConversation() {
    return this.load().length > 0;
  }
};
function generateTurnId() {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function createUserTurn(content) {
  return {
    id: generateTurnId(),
    role: "user",
    content,
    timestamp: Date.now()
  };
}
function createAssistantTurn(content, functionCalls) {
  return {
    id: generateTurnId(),
    role: "assistant",
    content,
    timestamp: Date.now(),
    functionCalls
  };
}
function formatConversationForContext(turns, maxTurns = 10) {
  const recentTurns = turns.slice(-maxTurns);
  if (recentTurns.length === 0) return "";
  const formatted = recentTurns.map((turn) => {
    const role = turn.role === "user" ? "User" : "Vivid";
    let text = `${role}: ${turn.content}`;
    if (turn.functionCalls && turn.functionCalls.length > 0) {
      const fnSummary = turn.functionCalls.map((fc) => `[Called ${fc.name}]`).join(" ");
      text += ` ${fnSummary}`;
    }
    return text;
  }).join("\n");
  return `

## Recent Conversation History
${formatted}`;
}
var VividContext = react.createContext(null);
function VividProvider({
  children,
  tokenEndpoint = "/api/vivid/token",
  voice = "alloy",
  user = null,
  isSignedIn = true,
  pathname = "/",
  requireAuth = false,
  platformContext,
  functions = [],
  onAuthRequired,
  persistConversation = true,
  maxHistoryLength = 50,
  classNames
}) {
  const [state, setState] = react.useState("idle");
  const [conversation, setConversation] = react.useState([]);
  const [lastTranscript, setLastTranscript] = react.useState(null);
  const [error, setError] = react.useState(null);
  const clientRef = react.useRef(null);
  const functionRegistry = react.useRef(new FunctionRegistry());
  const conversationStore = react.useRef(null);
  const currentTranscript = react.useRef("");
  const pendingFunctionCalls = react.useRef([]);
  react.useEffect(() => {
    if (persistConversation) {
      conversationStore.current = new ConversationStore({ maxHistory: maxHistoryLength });
      const savedConversation = conversationStore.current.load();
      if (savedConversation.length > 0) {
        setConversation(savedConversation);
      }
    }
  }, [persistConversation, maxHistoryLength]);
  react.useEffect(() => {
    functionRegistry.current.clear();
    functionRegistry.current.registerAll(functions);
  }, [functions]);
  const startSession = react.useCallback(async () => {
    if (state === "connecting" || state === "listening" || state === "ready" || state === "speaking" || state === "processing") {
      console.warn("[Vivid] Session already active or connecting, ignoring duplicate startSession call");
      return;
    }
    if (requireAuth && !isSignedIn) {
      onAuthRequired?.();
      setError(new Error("Authentication required"));
      return;
    }
    try {
      setState("connecting");
      setError(null);
      let platformPrompt = "";
      if (platformContext) {
        try {
          const result = await platformContext(user, pathname);
          if (result && result.trim().length > 0) {
            platformPrompt = result.trim();
          }
        } catch (e) {
          console.error("[Vivid] Error evaluating platform context:", e);
        }
      }
      const tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          pathname,
          platformPrompt,
          userName: user?.firstName || void 0,
          userLastName: user?.lastName || void 0,
          userEmail: user?.email || void 0
        })
      });
      if (!tokenResponse.ok) {
        throw new Error(`Failed to get session token: ${tokenResponse.statusText}`);
      }
      const { token, sessionToken, client_secret } = await tokenResponse.json();
      const apiToken = client_secret || token || sessionToken;
      if (!apiToken) {
        throw new Error("No session token received");
      }
      const basePrompt = await buildSystemPrompt(platformContext, user, pathname);
      const functionInstructions = generateFunctionInstructions(
        functionRegistry.current.getAll().map((f) => f.name)
      );
      const conversationContext = formatConversationForContext(conversation);
      const fullInstructions = basePrompt + functionInstructions + conversationContext;
      const clientConfig = {
        sessionToken: apiToken,
        instructions: fullInstructions,
        voice,
        tools: functionRegistry.current.toOpenAITools()
      };
      clientRef.current = new RealtimeClient(clientConfig, {
        onStateChange: (newState) => setState(newState),
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setLastTranscript(text);
          }
          currentTranscript.current += text;
        },
        onAudioData: () => {
        },
        onFunctionCall: handleFunctionCall,
        onError: (err) => setError(err),
        onResponseDone: handleResponseDone
      });
      await clientRef.current.connect();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error("[Vivid] Failed to start session:", err);
    }
  }, [
    state,
    requireAuth,
    isSignedIn,
    onAuthRequired,
    tokenEndpoint,
    user,
    platformContext,
    pathname,
    voice,
    conversation
  ]);
  const endSession = react.useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setState("idle");
    currentTranscript.current = "";
    pendingFunctionCalls.current = [];
  }, []);
  const handleFunctionCall = react.useCallback(
    async (name, args, callId) => {
      console.log(`[Vivid] Function call: ${name}`, args);
      const startTime = performance.now();
      const fnConfig = functionRegistry.current.get(name);
      if (!fnConfig) {
        console.error(`[Vivid] Function not found: ${name}`);
        clientRef.current?.sendFunctionResult(callId, {
          error: `Function "${name}" not found`
        });
        return;
      }
      try {
        let result;
        if (fnConfig.executionContext === "server") {
          const response = await fetch("/api/vivid/function", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, args })
          });
          if (!response.ok) {
            throw new Error(`Server function failed: ${response.statusText}`);
          }
          const data = await response.json();
          result = data.result;
        } else {
          const execResult = await executeFunction(functionRegistry.current, name, args);
          if (!execResult.success) {
            throw new Error(execResult.error);
          }
          result = execResult.result;
        }
        pendingFunctionCalls.current.push({
          name,
          arguments: args,
          result,
          executionTime: performance.now() - startTime
        });
        clientRef.current?.sendFunctionResult(callId, result);
      } catch (err) {
        const error2 = err instanceof Error ? err.message : String(err);
        pendingFunctionCalls.current.push({
          name,
          arguments: args,
          error: error2,
          executionTime: performance.now() - startTime
        });
        clientRef.current?.sendFunctionResult(callId, { error: error2 });
      }
    },
    []
  );
  const handleResponseDone = react.useCallback(() => {
    if (currentTranscript.current) {
      const turn = createAssistantTurn(
        currentTranscript.current,
        pendingFunctionCalls.current.length > 0 ? [...pendingFunctionCalls.current] : void 0
      );
      setConversation((prev) => {
        const updated = [...prev, turn];
        conversationStore.current?.save(updated);
        return updated;
      });
    }
    currentTranscript.current = "";
    pendingFunctionCalls.current = [];
  }, []);
  react.useCallback((content) => {
    const turn = createUserTurn(content);
    setConversation((prev) => {
      const updated = [...prev, turn];
      conversationStore.current?.save(updated);
      return updated;
    });
  }, []);
  const clearHistory = react.useCallback(() => {
    setConversation([]);
    conversationStore.current?.clear();
  }, []);
  const startListening = react.useCallback(() => {
    console.log("[Vivid] startListening - audio captured via WebRTC");
  }, []);
  const stopListening = react.useCallback(() => {
    clientRef.current?.commitAudioBuffer();
  }, []);
  const getAudioLevels = react.useCallback(() => {
    if (clientRef.current) {
      return clientRef.current.getAudioLevels();
    }
    return new Uint8Array(0);
  }, []);
  const registerFunction = react.useCallback((fn) => {
    functionRegistry.current.register(fn);
  }, []);
  const unregisterFunction = react.useCallback((name) => {
    functionRegistry.current.unregister(name);
  }, []);
  react.useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);
  const contextValue = react.useMemo(
    () => ({
      state,
      isConnected: state !== "idle" && state !== "error" && state !== "connecting",
      isListening: state === "listening",
      isSpeaking: state === "speaking",
      conversation,
      lastTranscript,
      error,
      startSession,
      endSession,
      clearHistory,
      startListening,
      stopListening,
      getAudioLevels,
      config: {
        requireAuth,
        platformContext,
        functions,
        onAuthRequired,
        classNames,
        persistConversation,
        maxHistoryLength
      },
      registerFunction,
      unregisterFunction
    }),
    [
      state,
      conversation,
      lastTranscript,
      error,
      startSession,
      endSession,
      clearHistory,
      startListening,
      stopListening,
      getAudioLevels,
      requireAuth,
      platformContext,
      functions,
      onAuthRequired,
      classNames,
      persistConversation,
      maxHistoryLength,
      registerFunction,
      unregisterFunction
    ]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(VividContext.Provider, { value: contextValue, children });
}
function useVivid() {
  const context = react.useContext(VividContext);
  if (!context) {
    throw new Error("useVivid must be used within a VividProvider");
  }
  return context;
}
function useVividOptional() {
  return react.useContext(VividContext);
}
var defaultClassNames = {
  container: "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3",
  button: "rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center",
  buttonActive: "from-red-500 to-rose-600 animate-pulse",
  transcript: "bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 max-w-sm text-sm border border-gray-200 dark:border-gray-700",
  status: "text-xs text-gray-500 dark:text-gray-400 mt-1",
  visualizer: "flex items-center gap-0.5"
};
function OrbVisualizer({ state, onClick, size = "md" }) {
  const canvasRef = react.useRef(null);
  const containerRef = react.useRef(null);
  const { getAudioLevels } = useVivid();
  const requestRef = react.useRef();
  const segmentCount = 60;
  const baseRadius = size === "sm" ? 24 : size === "lg" ? 40 : 32;
  const colors = {
    ring: { r: 60, g: 100, b: 255 },
    // Blue
    active: { r: 255, g: 50, b: 150 },
    // Pink/Purple
    glow: { r: 100, g: 150, b: 255 }
    // Light Blue Glow
  };
  react.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    let time = 0;
    const animate = () => {
      const audioData = getAudioLevels();
      const volume = audioData.length > 0 ? audioData.reduce((a, b) => a + b, 0) / audioData.length / 255 : 0;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const pulse = volume * 10;
      const currentRadius = baseRadius + (state === "listening" ? pulse : 0) + Math.sin(time * 2) * 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      const gradient = ctx.createLinearGradient(centerX - currentRadius, centerY - currentRadius, centerX + currentRadius, centerY + currentRadius);
      gradient.addColorStop(0, `rgba(${colors.ring.r}, ${colors.ring.g}, ${colors.ring.b}, 0.8)`);
      gradient.addColorStop(1, `rgba(${colors.active.r}, ${colors.active.g}, ${colors.active.b}, 0.8)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${colors.glow.r}, ${colors.glow.g}, ${colors.glow.b}, 0.5)`;
      ctx.stroke();
      ctx.shadowBlur = 0;
      const segmentLength = 4;
      const totalArc = Math.PI * 2;
      const segmentAngle = totalArc / segmentCount;
      for (let i = 0; i < segmentCount; i++) {
        const angle = i * segmentAngle + time * 0.2;
        const dataIndex = Math.floor(Math.abs(i - segmentCount / 2) / (segmentCount / 2) * (audioData.length / 2));
        const value = audioData[dataIndex] || 0;
        const intensity = value / 255;
        const isActive = intensity > 0.2;
        const r = isActive ? colors.active.r : colors.ring.r;
        const g = isActive ? colors.active.g : colors.ring.g;
        const b = isActive ? colors.active.b : colors.ring.b;
        const alpha = 0.4 + intensity * 0.6;
        const innerR = currentRadius + 2;
        const outerR = currentRadius + 2 + segmentLength + intensity * 10;
        const x1 = centerX + Math.cos(angle) * innerR;
        const y1 = centerY + Math.sin(angle) * innerR;
        const x2 = centerX + Math.cos(angle) * outerR;
        const y2 = centerY + Math.sin(angle) * outerR;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      const innerGlowParams = {
        radius: currentRadius * 0.8,
        color: `rgba(${colors.ring.r}, ${colors.ring.g}, ${colors.ring.b}, ${0.1 + volume * 0.2})`
      };
      if (state === "processing") {
        innerGlowParams.color = `rgba(255, 255, 255, 0.3)`;
      } else if (state === "error") {
        innerGlowParams.color = `rgba(255, 50, 50, 0.3)`;
      }
      const radGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerGlowParams.radius);
      radGrad.addColorStop(0, innerGlowParams.color);
      radGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerGlowParams.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      time += 0.02;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state, size, getAudioLevels]);
  const dimensions = size === "sm" ? 64 : size === "lg" ? 96 : 80;
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref: containerRef,
      className: `relative cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95`,
      onClick,
      style: { width: dimensions, height: dimensions, pointerEvents: state === "connecting" ? "none" : "auto", opacity: state === "connecting" ? 0.7 : 1 },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        "canvas",
        {
          ref: canvasRef,
          className: "block w-full h-full",
          style: { width: dimensions, height: dimensions }
        }
      )
    }
  );
}
function VividWidget({
  position,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showTranscript = false,
  // Default to false as requested
  classNames: customClassNames,
  size = "md"
}) {
  const {
    state,
    isConnected,
    startSession,
    endSession,
    config
  } = useVivid();
  const [isExpanded, setIsExpanded] = react.useState(false);
  react.useRef(null);
  const cn = {
    ...defaultClassNames,
    ...config.classNames,
    ...customClassNames
  };
  const handleClick = react.useCallback(async () => {
    if (state === "connecting") return;
    if (isConnected) {
      endSession();
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      await startSession();
    }
  }, [state, isConnected, startSession, endSession]);
  const positionStyle = position ? {
    position: "fixed",
    bottom: position.bottom,
    right: position.right,
    left: position.left,
    top: position.top
  } : {};
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: cn.container, style: positionStyle, children: /* @__PURE__ */ jsxRuntime.jsx(
    OrbVisualizer,
    {
      state,
      onClick: handleClick,
      size
    }
  ) });
}
function VividButton({
  className,
  activeClassName,
  children,
  renderIcon
}) {
  const { state, isConnected, startSession, endSession } = useVivid();
  const handleClick = react.useCallback(async () => {
    if (isConnected) {
      endSession();
    } else {
      await startSession();
    }
  }, [isConnected, startSession, endSession]);
  const isActive = state === "listening" || state === "speaking";
  return /* @__PURE__ */ jsxRuntime.jsx(
    "button",
    {
      onClick: handleClick,
      disabled: state === "connecting",
      className: `${className ?? ""} ${isActive ? activeClassName ?? "" : ""}`,
      "aria-label": isConnected ? "Stop Vivid" : "Start Vivid",
      children: renderIcon ? renderIcon(state) : children
    }
  );
}
function VividTranscript({ className, maxTurns = 10 }) {
  const { conversation, state } = useVivid();
  const containerRef = react.useRef(null);
  react.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [conversation]);
  const recentTurns = conversation.slice(-maxTurns);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref: containerRef, className, children: [
    recentTurns.map((turn) => /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: `mb-2 ${turn.role === "user" ? "text-right" : "text-left"}`,
        children: /* @__PURE__ */ jsxRuntime.jsx(
          "span",
          {
            className: `inline-block px-3 py-2 rounded-lg ${turn.role === "user" ? "bg-violet-500 text-white" : "bg-gray-100 dark:bg-gray-800"}`,
            children: turn.content
          }
        )
      },
      turn.id
    )),
    state === "processing" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-left", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "inline-block px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "animate-pulse", children: "Thinking..." }) }) })
  ] });
}

// src/audio.ts
var AudioCapture = class {
  constructor(config) {
    this.stream = null;
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.isCapturing = false;
    this.config = {
      sampleRate: 24e3,
      // OpenAI Realtime expects 24kHz
      channelCount: 1,
      ...config
    };
  }
  /**
   * Start capturing audio from the microphone
   */
  async start() {
    if (this.isCapturing) {
      console.warn("[Vivid Audio] Already capturing");
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        if (!this.isCapturing) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        this.config.onAudioData(base64);
      };
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isCapturing = true;
      console.log("[Vivid Audio] Capture started");
    } catch (error) {
      this.config.onError(
        error instanceof Error ? error : new Error("Failed to start audio capture")
      );
    }
  }
  /**
   * Stop capturing audio
   */
  stop() {
    this.isCapturing = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    console.log("[Vivid Audio] Capture stopped");
  }
  /**
   * Check if currently capturing
   */
  isActive() {
    return this.isCapturing;
  }
  /**
   * Convert float32 audio data to 16-bit PCM
   */
  floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return int16Array;
  }
  /**
   * Convert ArrayBuffer to base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
};
var AudioPlayback = class {
  constructor(config = {}) {
    this.audioContext = null;
    this.isPlaying = false;
    this.audioQueue = [];
    this.currentSource = null;
    this.nextStartTime = 0;
    this.config = {
      sampleRate: 24e3,
      // OpenAI Realtime outputs 24kHz
      ...config
    };
  }
  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async init() {
    if (this.audioContext) return;
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate
    });
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    console.log("[Vivid Audio] Playback initialized, state:", this.audioContext.state, "sampleRate:", this.audioContext.sampleRate);
  }
  /**
   * Add audio data to the playback queue
   */
  async enqueue(pcm16Buffer) {
    if (!this.audioContext) {
      await this.init();
    }
    if (this.audioContext.state === "suspended") {
      console.log("[Vivid Audio] Resuming suspended audio context");
      await this.audioContext.resume();
    }
    try {
      console.log("[Vivid Audio] Enqueue PCM16 buffer, byteLength:", pcm16Buffer.byteLength);
      const float32 = this.pcm16ToFloat32(pcm16Buffer);
      const audioBuffer = this.audioContext.createBuffer(
        1,
        // mono
        float32.length,
        this.config.sampleRate
      );
      audioBuffer.copyToChannel(new Float32Array(float32), 0);
      this.audioQueue.push(audioBuffer);
      this.playNext();
    } catch (error) {
      console.error("[Vivid Audio] Error enqueueing audio:", error);
    }
  }
  /**
   * Play the next audio chunk in the queue
   */
  playNext() {
    if (!this.audioContext || this.audioQueue.length === 0) return;
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextStartTime = this.audioContext.currentTime;
      this.config.onPlaybackStart?.();
    }
    while (this.audioQueue.length > 0) {
      const buffer = this.audioQueue.shift();
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;
      source.onended = () => {
        if (this.audioQueue.length === 0 && this.audioContext) {
          setTimeout(() => {
            if (this.audioQueue.length === 0) {
              this.isPlaying = false;
              this.config.onPlaybackEnd?.();
            }
          }, 100);
        }
      };
      this.currentSource = source;
    }
  }
  /**
   * Stop all playback and clear the queue
   */
  stop() {
    this.audioQueue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.nextStartTime = 0;
  }
  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
  /**
   * Check if currently playing
   */
  isActive() {
    return this.isPlaying;
  }
  /**
   * Convert PCM16 buffer to float32 array
   */
  pcm16ToFloat32(buffer) {
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
    }
    return float32;
  }
};
var AudioLevelAnalyzer = class {
  constructor() {
    this.analyser = null;
    this.dataArray = null;
  }
  /**
   * Connect to an audio context and source
   */
  connect(audioContext, source) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    source.connect(this.analyser);
  }
  /**
   * Get the current audio level (0-1)
   */
  getLevel() {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(new Uint8Array(this.dataArray));
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / (this.dataArray.length * 255);
  }
  /**
   * Disconnect and clean up
   */
  disconnect() {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.dataArray = null;
  }
};
function isAudioCaptureSupported() {
  return !!(typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function" && typeof window !== "undefined" && typeof window.AudioContext !== "undefined");
}
async function requestMicrophonePermission() {
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: "microphone" });
      return result.state;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

exports.AudioCapture = AudioCapture;
exports.AudioLevelAnalyzer = AudioLevelAnalyzer;
exports.AudioPlayback = AudioPlayback;
exports.ConversationStore = ConversationStore;
exports.FunctionRegistry = FunctionRegistry;
exports.VIVID_BASE_PROMPT = VIVID_BASE_PROMPT;
exports.VIVID_TEST_PROMPT = VIVID_TEST_PROMPT;
exports.VividButton = VividButton;
exports.VividProvider = VividProvider;
exports.VividTranscript = VividTranscript;
exports.VividWidget = VividWidget;
exports.booleanParam = booleanParam;
exports.buildParameters = buildParameters;
exports.buildSystemPrompt = buildSystemPrompt;
exports.createAssistantTurn = createAssistantTurn;
exports.createUserTurn = createUserTurn;
exports.createVividFunction = createVividFunction;
exports.enumParam = enumParam;
exports.executeFunction = executeFunction;
exports.formatConversationForContext = formatConversationForContext;
exports.functionToOpenAITool = functionToOpenAITool;
exports.generateFunctionInstructions = generateFunctionInstructions;
exports.generateTurnId = generateTurnId;
exports.isAudioCaptureSupported = isAudioCaptureSupported;
exports.numberParam = numberParam;
exports.requestMicrophonePermission = requestMicrophonePermission;
exports.stringParam = stringParam;
exports.useVivid = useVivid;
exports.useVividOptional = useVividOptional;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map