import { V as VoiceFunctionConfig } from './types-CF5v1F1G.mjs';
export { V as VIVID_BASE_PROMPT, a as VIVID_TEST_PROMPT, b as buildSystemPrompt, g as generateFunctionInstructions } from './prompt-CJywHGoJ.mjs';

/**
 * Vivid Voice Agent - Server Utilities
 *
 * Helpers for creating API routes in Next.js applications
 * Import from '@worldstreet/vivid-voice/server'
 */

interface TokenRequestBody {
    userId?: string;
    /** Current page pathname (e.g. '/about') */
    pathname?: string;
    /** Pre-evaluated platform context string from platformContext callback */
    platformPrompt?: string;
    /** User's first name for personalization */
    userName?: string;
    /** User's last name */
    userLastName?: string;
    /** User's email */
    userEmail?: string;
}
interface TokenResponse {
    client_secret: string;
    expires_at: number;
}
interface FunctionRequestBody {
    name: string;
    args: Record<string, unknown>;
}
interface FunctionResponse {
    success: boolean;
    result?: unknown;
    error?: string;
}
interface VividServerConfig {
    /**
     * OpenAI API key - read from environment by default
     */
    openAIApiKey?: string;
    /**
     * Voice to use for responses
     * @default 'alloy'
     */
    voice?: string;
    /**
     * System instructions for the session
     */
    instructions?: string;
    /**
     * OpenAI Realtime model to use
     * @default 'gpt-4o-realtime-preview-2024-12-17'
     */
    model?: string;
    /**
     * Tool definitions for the session
     */
    tools?: Array<{
        type: 'function';
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }>;
    /**
     * Turn detection configuration
     */
    turnDetection?: {
        type?: 'server_vad';
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
    };
    /**
     * Validate request before generating token
     * Return false to reject the request
     */
    validateRequest?: (request: Request) => Promise<boolean> | boolean;
    /**
     * Build instructions dynamically per request
     * Receives the parsed request body
     */
    buildInstructions?: (body: TokenRequestBody) => string | Promise<string>;
    /**
     * Server-side functions that can be called via the bridge
     */
    functions?: VoiceFunctionConfig[];
}
/**
 * Create a token endpoint handler for Next.js App Router
 *
 * @example
 * ```ts
 * // app/api/vivid/token/route.ts
 * import { createTokenHandler } from '@worldstreet/vivid-voice/server'
 *
 * export const POST = createTokenHandler({
 *   openAIApiKey: process.env.OPENAI_API_KEY,
 * })
 * ```
 */
declare function createTokenHandler(config?: VividServerConfig): (request: Request) => Promise<Response>;
/**
 * Create a function execution endpoint handler for Next.js App Router
 *
 * @example
 * ```ts
 * // app/api/vivid/function/route.ts
 * import { createFunctionHandler } from '@worldstreet/vivid-voice/server'
 * import { serverFunctions } from '@/lib/vivid-functions'
 *
 * export const POST = createFunctionHandler({
 *   functions: serverFunctions,
 * })
 * ```
 */
declare function createFunctionHandler(config?: VividServerConfig): (request: Request) => Promise<Response>;
/**
 * Create a request validator that checks Clerk authentication
 *
 * @example
 * ```ts
 * import { createClerkValidator } from '@worldstreet/vivid-voice/server'
 * import { auth } from '@clerk/nextjs/server'
 *
 * export const POST = createTokenHandler({
 *   validateRequest: createClerkValidator(auth),
 * })
 * ```
 */
declare function createClerkValidator(authFn: () => Promise<{
    userId: string | null;
}> | {
    userId: string | null;
}): () => Promise<boolean>;
/**
 * Extract user ID from Clerk JWT in request headers
 */
declare function extractClerkUserId(_request: Request): Promise<string | null>;
/**
 * Create headers for CORS
 */
declare function createCorsHeaders(origin?: string): HeadersInit;
/**
 * Handle CORS preflight requests
 */
declare function handleCorsOptions(): Response;

export { type FunctionRequestBody, type FunctionResponse, type TokenRequestBody, type TokenResponse, type VividServerConfig, createClerkValidator, createCorsHeaders, createFunctionHandler, createTokenHandler, extractClerkUserId, handleCorsOptions };
