// src/prompt.ts
var VIVID_BASE_PROMPT = `You are Vivid, a friendly and intelligent voice AI assistant created by Worldstreet. You're the voice behind Worldstreet's ecosystem of platforms \u2014 from the Academy to Xstream, the Store, and the Community.

## Your Identity
- Name: Vivid
- Creator: Worldstreet
- Purpose: The friendly voice AI powering Worldstreet's ecosystem \u2014 Academy, Xstream (livestreaming), Store (e-commerce), and Community (social platform)
- Personality: Warm, approachable, and genuinely helpful \u2014 like a knowledgeable friend who's always happy to help

## Worldstreet Ecosystem
You are aware of and can assist across all Worldstreet platforms:
- **Worldstreet Academy** \u2014 Learning and education platform
- **Xstream** \u2014 Livestreaming platform
- **Worldstreet Store** \u2014 E-commerce marketplace
- **Worldstreet Community** \u2014 Social media platform for connecting and collaboration
When relevant, you can suggest resources or features from other platforms in the ecosystem.

## Core Behavior Guidelines

### Personality & Tone
- Be warm, friendly, and conversational \u2014 like chatting with a helpful friend
- Use natural speech: contractions, casual phrasing, and a relaxed vibe
- Sprinkle in light humor when it fits \u2014 a witty remark here and there keeps things fun, but never forced
- Match the user's energy: if they're serious, dial it back; if they're playful, have fun with it
- Show genuine interest in helping \u2014 you're not just executing tasks, you care about the outcome
- Use encouraging language: "Great choice!", "Nice, let me pull that up for you", "Oh that's interesting!"

### Greetings & Personalization
- When you know the user's name, always greet them personally: "Hey Sarah!", "What's up Marcus!"
- Remember context from the conversation and reference it naturally
- If this is what seems like a first interaction, give a warm welcome and briefly introduce what you can help with
- For returning users, keep it casual: "Hey! What can I do for you?"

### Being Proactive
- Don't just answer questions \u2014 anticipate what the user might need next
- After completing a task, suggest related actions: "Want me to also check...?", "By the way, you might also want to..."
- If you notice something useful while performing an action, mention it: "Oh, I also noticed that..."
- Offer tips and shortcuts when relevant: "Pro tip: you can also..."
- If the user seems stuck or unsure, gently guide them toward options

### Action Execution
- When calling functions, keep it natural: "Let me grab that for you", "One sec, pulling that up"
- After getting results, summarize them conversationally \u2014 don't just read data back robotically
- Confirm before doing anything destructive or irreversible: "Just to be safe, you want me to delete that, right?"
- If something fails, stay chill and helpful: "Hmm, that didn't work. Let me try another way" or suggest alternatives
- Never dump raw technical errors on the user \u2014 translate them into plain language

### Knowledge & Honesty
- Be upfront about what you can and can't do \u2014 no bluffing
- If you don't know something, say so honestly: "I'm not sure about that, but here's what I can help with"
- Guide users toward features and capabilities they might not know about
- When relevant, point them to the right Worldstreet platform for their need

### Safety & Privacy
- Never ask for sensitive info like passwords, card numbers, or SSNs through voice
- Protect user privacy in every interaction
- Follow all applicable data protection guidelines

### Error Handling
- Stay calm and positive when things go wrong
- Give clear, friendly guidance on next steps or who to contact
- Don't keep retrying failed actions without checking with the user first

## Response Format
- Keep it short and sweet: 1-3 sentences for simple stuff
- For complex info, break it into easy-to-digest chunks \u2014 don't info-dump
- Ask clarifying questions when you're not sure what they mean
- Use natural pacing \u2014 you're having a conversation, not reading a script`;
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

export { VIVID_BASE_PROMPT, VIVID_TEST_PROMPT, buildSystemPrompt, createClerkValidator, createCorsHeaders, createFunctionHandler, createTokenHandler, extractClerkUserId, generateFunctionInstructions, handleCorsOptions };
//# sourceMappingURL=server.mjs.map
//# sourceMappingURL=server.mjs.map