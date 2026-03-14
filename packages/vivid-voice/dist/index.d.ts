import * as react_jsx_runtime from 'react/jsx-runtime';
import React, { ReactNode } from 'react';
import { b as VividConfig, a as VividUser, c as VividContextValue, d as VividAgentState, e as VividWidgetProps, C as ConversationTurn } from './types-CF5v1F1G.js';
export { F as FunctionCallRecord, J as JSONSchema, f as JSONSchemaProperty, O as OpenAIFunctionDefinition, g as PersistedConversation, P as PlatformContextGenerator, R as RealtimeEvent, h as RealtimeSessionConfig, U as UseVividReturn, i as VividWidgetClassNames, V as VoiceFunctionConfig, W as WidgetPosition } from './types-CF5v1F1G.js';
export { FunctionRegistry, booleanParam, buildParameters, createVividFunction, enumParam, executeFunction, functionToOpenAITool, numberParam, stringParam } from './functions.js';
export { V as VIVID_BASE_PROMPT, a as VIVID_TEST_PROMPT, b as buildSystemPrompt, g as generateFunctionInstructions } from './prompt-7vnD6xNa.js';

interface VividProviderProps extends VividConfig {
    children: ReactNode;
    /**
     * Token endpoint URL - defaults to /api/vivid/token
     * The endpoint should return { token: string } or { sessionToken: string }
     */
    tokenEndpoint?: string;
    /**
     * Voice to use for Vivid's responses
     * @default 'alloy'
     */
    voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';
    /**
     * Clerk user object (if using Clerk)
     * Pass from useUser() hook in your app
     */
    user?: VividUser | null;
    /**
     * Whether user is signed in (if using Clerk)
     * Pass from useAuth() hook in your app
     */
    isSignedIn?: boolean;
    /**
     * Current pathname for context
     * Pass from usePathname() hook in your app
     */
    pathname?: string;
}
declare function VividProvider({ children, tokenEndpoint, voice, user, isSignedIn, pathname, requireAuth, platformContext, functions, onAuthRequired, persistConversation, maxHistoryLength, classNames, }: VividProviderProps): react_jsx_runtime.JSX.Element;
/**
 * Access the Vivid voice agent context
 */
declare function useVivid(): VividContextValue;
/**
 * Check if Vivid provider is available
 */
declare function useVividOptional(): VividContextValue | null;

declare function VividWidget({ position, showTranscript, // Default to false as requested
classNames: customClassNames, size, }: VividWidgetProps): react_jsx_runtime.JSX.Element;
interface VividButtonProps {
    className?: string;
    activeClassName?: string;
    children?: React.ReactNode;
    renderIcon?: (state: VividAgentState) => React.ReactNode;
}
/**
 * Minimal button component for custom UI implementations
 */
declare function VividButton({ className, activeClassName, children, renderIcon, }: VividButtonProps): react_jsx_runtime.JSX.Element;
interface VividTranscriptProps {
    className?: string;
    maxTurns?: number;
}
/**
 * Standalone transcript display component
 */
declare function VividTranscript({ className, maxTurns }: VividTranscriptProps): react_jsx_runtime.JSX.Element;

/**
 * Audio Handling Utilities
 *
 * Manages microphone input capture and audio playback for voice conversations
 */
interface AudioCaptureConfig {
    sampleRate?: number;
    channelCount?: number;
    onAudioData: (base64Audio: string) => void;
    onError: (error: Error) => void;
}
interface AudioPlaybackConfig {
    sampleRate?: number;
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
}
/**
 * Captures audio from the microphone and converts to PCM16 base64
 */
declare class AudioCapture {
    private stream;
    private audioContext;
    private processor;
    private source;
    private config;
    private isCapturing;
    constructor(config: AudioCaptureConfig);
    /**
     * Start capturing audio from the microphone
     */
    start(): Promise<void>;
    /**
     * Stop capturing audio
     */
    stop(): void;
    /**
     * Check if currently capturing
     */
    isActive(): boolean;
    /**
     * Convert float32 audio data to 16-bit PCM
     */
    private floatTo16BitPCM;
    /**
     * Convert ArrayBuffer to base64 string
     */
    private arrayBufferToBase64;
}
/**
 * Plays PCM16 audio data received from the API
 */
declare class AudioPlayback {
    private audioContext;
    private config;
    private isPlaying;
    private audioQueue;
    private currentSource;
    private nextStartTime;
    constructor(config?: AudioPlaybackConfig);
    /**
     * Initialize the audio context (must be called after user interaction)
     */
    init(): Promise<void>;
    /**
     * Add audio data to the playback queue
     */
    enqueue(pcm16Buffer: ArrayBuffer): Promise<void>;
    /**
     * Play the next audio chunk in the queue
     */
    private playNext;
    /**
     * Stop all playback and clear the queue
     */
    stop(): void;
    /**
     * Clean up resources
     */
    dispose(): void;
    /**
     * Check if currently playing
     */
    isActive(): boolean;
    /**
     * Convert PCM16 buffer to float32 array
     */
    private pcm16ToFloat32;
}
/**
 * Analyzes audio levels for visualization
 */
declare class AudioLevelAnalyzer {
    private analyser;
    private dataArray;
    /**
     * Connect to an audio context and source
     */
    connect(audioContext: AudioContext, source: AudioNode): void;
    /**
     * Get the current audio level (0-1)
     */
    getLevel(): number;
    /**
     * Disconnect and clean up
     */
    disconnect(): void;
}
/**
 * Check if the browser supports audio capture
 */
declare function isAudioCaptureSupported(): boolean;
/**
 * Request microphone permission
 */
declare function requestMicrophonePermission(): Promise<PermissionState>;

/**
 * Conversation Persistence
 *
 * Handles storing and retrieving conversation history from localStorage
 */

/**
 * Conversation persistence manager
 */
declare class ConversationStore {
    private maxHistory;
    private storageKey;
    constructor(options?: {
        maxHistory?: number;
        namespace?: string;
    });
    /**
     * Save conversation to localStorage
     */
    save(turns: ConversationTurn[]): void;
    /**
     * Load conversation from localStorage
     */
    load(): ConversationTurn[];
    /**
     * Add a single turn to the conversation
     */
    addTurn(turn: ConversationTurn): void;
    /**
     * Clear all stored conversation data
     */
    clear(): void;
    /**
     * Get the current session ID or create a new one
     */
    private getOrCreateSessionId;
    /**
     * Get time since last conversation update
     */
    getTimeSinceLastUpdate(): number | null;
    /**
     * Check if there's an existing conversation
     */
    hasConversation(): boolean;
}
/**
 * Generate a unique ID for conversation turns
 */
declare function generateTurnId(): string;
/**
 * Create a user turn
 */
declare function createUserTurn(content: string): ConversationTurn;
/**
 * Create an assistant turn
 */
declare function createAssistantTurn(content: string, functionCalls?: ConversationTurn['functionCalls']): ConversationTurn;
/**
 * Format conversation history for context window
 * Converts turns to a format suitable for the system prompt
 */
declare function formatConversationForContext(turns: ConversationTurn[], maxTurns?: number): string;

export { AudioCapture, AudioLevelAnalyzer, AudioPlayback, ConversationStore, ConversationTurn, VividAgentState, VividButton, type VividButtonProps, VividConfig, VividContextValue, VividProvider, type VividProviderProps, VividTranscript, type VividTranscriptProps, VividUser, VividWidget, VividWidgetProps, createAssistantTurn, createUserTurn, formatConversationForContext, generateTurnId, isAudioCaptureSupported, requestMicrophonePermission, useVivid, useVividOptional };
