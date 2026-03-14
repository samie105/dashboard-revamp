import { V as VoiceFunctionConfig, O as OpenAIFunctionDefinition, f as JSONSchemaProperty, J as JSONSchema } from './types-CF5v1F1G.mjs';

/**
 * Function Registration System
 *
 * Utilities for creating and managing voice-callable functions
 */

/**
 * Create a type-safe voice function configuration
 *
 * @example
 * ```ts
 * const searchProducts = createVividFunction({
 *   name: 'searchProducts',
 *   description: 'Search for products in the catalog',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' },
 *       limit: { type: 'number', description: 'Max results' },
 *     },
 *     required: ['query'],
 *   },
 *   handler: async ({ query, limit }) => {
 *     // Your implementation
 *     return results
 *   },
 * })
 * ```
 */
declare function createVividFunction<TParams extends Record<string, unknown> = Record<string, unknown>, TResult = unknown>(config: VoiceFunctionConfig<TParams, TResult>): VoiceFunctionConfig<TParams, TResult>;
/**
 * Function registry for managing registered functions
 */
declare class FunctionRegistry {
    private functions;
    /**
     * Register a function
     */
    register(config: VoiceFunctionConfig): void;
    /**
     * Register multiple functions at once
     */
    registerAll(configs: VoiceFunctionConfig[]): void;
    /**
     * Unregister a function by name
     */
    unregister(name: string): boolean;
    /**
     * Get a function by name
     */
    get(name: string): VoiceFunctionConfig | undefined;
    /**
     * Check if a function is registered
     */
    has(name: string): boolean;
    /**
     * Get all registered functions
     */
    getAll(): VoiceFunctionConfig[];
    /**
     * Get all client-side functions
     */
    getClientFunctions(): VoiceFunctionConfig[];
    /**
     * Get all server-side functions
     */
    getServerFunctions(): VoiceFunctionConfig[];
    /**
     * Convert all registered functions to OpenAI tool definitions
     */
    toOpenAITools(): OpenAIFunctionDefinition[];
    /**
     * Clear all registered functions
     */
    clear(): void;
    /**
     * Get the count of registered functions
     */
    get size(): number;
}
/**
 * Convert a VoiceFunctionConfig to OpenAI function definition
 */
declare function functionToOpenAITool(config: VoiceFunctionConfig): OpenAIFunctionDefinition;
/**
 * Execute a function from the registry
 * Handles both sync and async functions
 */
declare function executeFunction(registry: FunctionRegistry, name: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    executionTime: number;
}>;
/**
 * Helper to create a simple string parameter
 */
declare function stringParam(description: string, required?: boolean): JSONSchemaProperty & {
    _required?: boolean;
};
/**
 * Helper to create a number parameter
 */
declare function numberParam(description: string, required?: boolean): JSONSchemaProperty & {
    _required?: boolean;
};
/**
 * Helper to create a boolean parameter
 */
declare function booleanParam(description: string, required?: boolean): JSONSchemaProperty & {
    _required?: boolean;
};
/**
 * Helper to create an enum parameter
 */
declare function enumParam(description: string, options: string[], required?: boolean): JSONSchemaProperty & {
    _required?: boolean;
};
/**
 * Helper to build parameters schema from param helpers
 */
declare function buildParameters(params: Record<string, JSONSchemaProperty & {
    _required?: boolean;
}>): JSONSchema;

export { FunctionRegistry, JSONSchema, JSONSchemaProperty, OpenAIFunctionDefinition, VoiceFunctionConfig, booleanParam, buildParameters, createVividFunction, enumParam, executeFunction, functionToOpenAITool, numberParam, stringParam };
