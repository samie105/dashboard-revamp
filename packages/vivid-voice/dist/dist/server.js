'use strict';

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

// src/server.ts
function createTokenHandler(config = {}) {
  return async function handler(request) {
    try {
      if (config.validateRequest) {
        const isValid = await config.validateRequest(request);
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      const apiKey = config.openAIApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[Vivid Server] OPENAI_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      const body = await request.json().catch(() => ({}));
      let instructions = config.instructions || "You are Vivid, a helpful voice AI assistant.";
      if (config.buildInstructions) {
        instructions = await config.buildInstructions(body);
      }
      const sessionPayload = {
        model: config.model || "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: config.voice || "alloy",
        instructions,
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: config.turnDetection || {
          type: "server_vad",
          threshold: 0.6,
          prefix_padding_ms: 400,
          silence_duration_ms: 600
        }
      };
      if (config.tools && config.tools.length > 0) {
        sessionPayload.tools = config.tools;
      }
      const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(sessionPayload)
      });
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json().catch(() => ({ message: "Unknown error" }));
        console.error("[Vivid Server] OpenAI session creation error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create voice session", details: error }),
          { status: sessionResponse.status, headers: { "Content-Type": "application/json" } }
        );
      }
      const sessionData = await sessionResponse.json();
      const response = {
        client_secret: sessionData.client_secret.value,
        expires_at: sessionData.client_secret.expires_at
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("[Vivid Server] Token generation error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate token" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}
function createFunctionHandler(config = {}) {
  const functionMap = new Map(
    (config.functions ?? []).map((fn) => [fn.name, fn])
  );
  return async function handler(request) {
    try {
      if (config.validateRequest) {
        const isValid = await config.validateRequest(request);
        if (!isValid) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      const body = await request.json();
      const { name, args } = body;
      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "Function name required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const fn = functionMap.get(name);
      if (!fn) {
        return new Response(
          JSON.stringify({ success: false, error: `Function "${name}" not found` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const result = await fn.handler(args);
      const response = {
        success: true,
        result
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("[Vivid Server] Function execution error:", error);
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Function execution failed"
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
}
function createClerkValidator(authFn) {
  return async () => {
    try {
      const { userId } = await authFn();
      return userId !== null;
    } catch {
      return false;
    }
  };
}
async function extractClerkUserId(_request) {
  return null;
}
function createCorsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function handleCorsOptions() {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders()
  });
}

exports.VIVID_BASE_PROMPT = VIVID_BASE_PROMPT;
exports.VIVID_TEST_PROMPT = VIVID_TEST_PROMPT;
exports.buildSystemPrompt = buildSystemPrompt;
exports.createClerkValidator = createClerkValidator;
exports.createCorsHeaders = createCorsHeaders;
exports.createFunctionHandler = createFunctionHandler;
exports.createTokenHandler = createTokenHandler;
exports.extractClerkUserId = extractClerkUserId;
exports.generateFunctionInstructions = generateFunctionInstructions;
exports.handleCorsOptions = handleCorsOptions;
//# sourceMappingURL=server.js.map
//# sourceMappingURL=server.js.map