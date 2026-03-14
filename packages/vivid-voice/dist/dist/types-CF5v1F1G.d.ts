/**
 * Vivid Voice Agent SDK - Core Types
 *
 * @packageDocumentation
 */
/**
 * JSON Schema type for function parameters
 */
interface JSONSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    enum?: string[];
    items?: JSONSchemaProperty;
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
}
/**
 * JSON Schema definition for function parameters
 */
interface JSONSchema {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
}
/**
 * Configuration for a single voice-callable function
 */
interface VoiceFunctionConfig<TParams = Record<string, unknown>, TResult = unknown> {
    /** Unique name for the function (used by AI to call it) */
    name: string;
    /** Human-readable description for AI to understand when to use this function */
    description: string;
    /** JSON Schema defining the function's parameters */
    parameters: JSONSchema;
    /**
     * The function handler to execute
     * For server functions, this runs on the server via Server Actions
     */
    handler: (params: TParams) => Promise<TResult> | TResult;
    /**
     * Where the function should execute
     * - 'client': Runs directly in the browser (for UI actions, navigation)
     * - 'server': Runs on the server via Next.js Server Actions (for DB, APIs with secrets)
     * @default 'client'
     */
    executionContext?: 'client' | 'server';
}
/**
 * OpenAI-compatible function definition (generated from VoiceFunctionConfig)
 */
interface OpenAIFunctionDefinition {
    name: string;
    description: string;
    parameters: JSONSchema;
}
/**
 * User information passed to platform context function
 * Compatible with Clerk's User type
 */
interface VividUser {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    imageUrl?: string;
    [key: string]: unknown;
}
/**
 * Platform context generator function type
 */
type PlatformContextGenerator = (user: VividUser | null, pathname: string) => string | Promise<string>;
/**
 * Main Vivid Provider configuration
 */
interface VividConfig {
    /**
     * Require user authentication via Clerk before allowing voice agent access
     * @default false
     */
    requireAuth?: boolean;
    /**
     * Platform-specific context generator
     * Called on each session start to build the platform portion of the system prompt
     */
    platformContext?: PlatformContextGenerator;
    /**
     * Array of functions the voice agent can call
     */
    functions?: VoiceFunctionConfig[];
    /**
     * Callback when unauthenticated user attempts to use the agent
     */
    onAuthRequired?: () => void;
    /**
     * Custom CSS classes for widget styling
     */
    classNames?: VividWidgetClassNames;
    /**
     * Enable conversation persistence in localStorage
     * @default true
     */
    persistConversation?: boolean;
    /**
     * Maximum number of conversation turns to persist
     * @default 50
     */
    maxHistoryLength?: number;
}
/**
 * Custom class names for widget customization
 */
interface VividWidgetClassNames {
    /** Root container */
    container?: string;
    /** Microphone button */
    button?: string;
    /** Active/listening state button */
    buttonActive?: string;
    /** Transcript display area */
    transcript?: string;
    /** Status indicator */
    status?: string;
    /** Audio visualizer */
    visualizer?: string;
}
/**
 * Widget position on screen
 */
interface WidgetPosition {
    bottom?: number | string;
    right?: number | string;
    left?: number | string;
    top?: number | string;
}
/**
 * Widget component props
 */
interface VividWidgetProps {
    /** Custom position override */
    position?: WidgetPosition;
    /** Show transcript of conversation */
    showTranscript?: boolean;
    /** Custom class names */
    classNames?: VividWidgetClassNames;
    /** Size of the main button */
    size?: 'sm' | 'md' | 'lg';
}
/**
 * Current state of the voice agent
 */
type VividAgentState = 'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'speaking' | 'error';
/**
 * A single turn in the conversation
 */
interface ConversationTurn {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    /** Function calls made during this turn */
    functionCalls?: FunctionCallRecord[];
}
/**
 * Record of a function call and its result
 */
interface FunctionCallRecord {
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
    executionTime?: number;
}
/**
 * Persisted conversation data
 */
interface PersistedConversation {
    sessionId: string;
    turns: ConversationTurn[];
    lastUpdated: number;
}
/**
 * Return type for useVivid hook
 */
interface UseVividReturn {
    /** Current agent state */
    state: VividAgentState;
    /** Whether currently connected to OpenAI Realtime */
    isConnected: boolean;
    /** Whether the agent is listening to user speech */
    isListening: boolean;
    /** Whether the agent is currently speaking */
    isSpeaking: boolean;
    /** Conversation history */
    conversation: ConversationTurn[];
    /** Most recent transcript text */
    lastTranscript: string | null;
    /** Current error if any */
    error: Error | null;
    /** Start a new voice session */
    startSession: () => Promise<void>;
    /** End the current session */
    endSession: () => void;
    /** Clear conversation history */
    clearHistory: () => void;
    /** Manually trigger listening (if not using VAD) */
    startListening: () => void;
    /** Stop listening */
    stopListening: () => void;
    /** Get current audio levels for visualization (returns Uint8Array of frequency data) */
    getAudioLevels: () => Uint8Array;
}
/**
 * OpenAI Realtime session configuration (WebRTC / ephemeral sessions)
 * Sent server-side via POST /v1/realtime/sessions
 */
interface RealtimeSessionConfig {
    model: string;
    voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
    instructions?: string;
    input_audio_transcription?: {
        model: string;
    };
    turn_detection?: {
        type: 'server_vad' | 'semantic_vad';
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
    } | null;
    tools?: OpenAIFunctionDefinition[];
    tool_choice?: 'auto' | 'none' | 'required';
    modalities?: ('text' | 'audio')[];
}
/**
 * OpenAI Realtime API event types
 */
type RealtimeEvent = RealtimeSessionCreatedEvent | RealtimeSessionUpdatedEvent | RealtimeInputAudioBufferSpeechStartedEvent | RealtimeInputAudioBufferSpeechStoppedEvent | RealtimeResponseCreatedEvent | RealtimeResponseAudioDeltaEvent | RealtimeResponseAudioDoneEvent | RealtimeResponseTextDeltaEvent | RealtimeResponseOutputAudioDeltaEvent | RealtimeResponseOutputAudioDoneEvent | RealtimeResponseOutputTextDeltaEvent | RealtimeResponseOutputAudioTranscriptDeltaEvent | RealtimeResponseFunctionCallArgumentsDeltaEvent | RealtimeResponseFunctionCallArgumentsDoneEvent | RealtimeResponseDoneEvent | RealtimeErrorEvent;
interface RealtimeSessionCreatedEvent {
    type: 'session.created';
    session: Partial<RealtimeSessionConfig>;
}
interface RealtimeSessionUpdatedEvent {
    type: 'session.updated';
    session: Partial<RealtimeSessionConfig>;
}
interface RealtimeInputAudioBufferSpeechStartedEvent {
    type: 'input_audio_buffer.speech_started';
    audio_start_ms: number;
    item_id: string;
}
interface RealtimeInputAudioBufferSpeechStoppedEvent {
    type: 'input_audio_buffer.speech_stopped';
    audio_end_ms: number;
    item_id: string;
}
interface RealtimeResponseCreatedEvent {
    type: 'response.created';
    response: {
        id: string;
        status: string;
    };
}
interface RealtimeResponseAudioDeltaEvent {
    type: 'response.audio.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
}
interface RealtimeResponseAudioDoneEvent {
    type: 'response.audio.done';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
}
interface RealtimeResponseTextDeltaEvent {
    type: 'response.text.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
}
interface RealtimeResponseOutputAudioDeltaEvent {
    type: 'response.output_audio.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
}
interface RealtimeResponseOutputAudioDoneEvent {
    type: 'response.output_audio.done';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
}
interface RealtimeResponseOutputTextDeltaEvent {
    type: 'response.output_text.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
}
interface RealtimeResponseOutputAudioTranscriptDeltaEvent {
    type: 'response.output_audio_transcript.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
}
interface RealtimeResponseFunctionCallArgumentsDeltaEvent {
    type: 'response.function_call_arguments.delta';
    response_id: string;
    item_id: string;
    output_index: number;
    call_id: string;
    delta: string;
}
interface RealtimeResponseFunctionCallArgumentsDoneEvent {
    type: 'response.function_call_arguments.done';
    response_id: string;
    item_id: string;
    output_index: number;
    call_id: string;
    name: string;
    arguments: string;
}
interface RealtimeResponseDoneEvent {
    type: 'response.done';
    response: {
        id: string;
        status: 'completed' | 'cancelled' | 'failed' | 'incomplete';
        output: Array<{
            type: 'message' | 'function_call';
            content?: Array<{
                type: 'text' | 'audio';
                text?: string;
                transcript?: string;
            }>;
            name?: string;
            arguments?: string;
            call_id?: string;
        }>;
    };
}
interface RealtimeErrorEvent {
    type: 'error';
    error: {
        type: string;
        code: string;
        message: string;
        param?: string;
    };
}
/**
 * Internal context value for VividProvider
 */
interface VividContextValue extends UseVividReturn {
    config: VividConfig;
    registerFunction: (fn: VoiceFunctionConfig) => void;
    unregisterFunction: (name: string) => void;
}

export type { ConversationTurn as C, FunctionCallRecord as F, JSONSchema as J, OpenAIFunctionDefinition as O, PlatformContextGenerator as P, RealtimeEvent as R, UseVividReturn as U, VoiceFunctionConfig as V, WidgetPosition as W, VividUser as a, VividConfig as b, VividContextValue as c, VividAgentState as d, VividWidgetProps as e, JSONSchemaProperty as f, PersistedConversation as g, RealtimeSessionConfig as h, VividWidgetClassNames as i };
