import type {
  Tool,
  Modality,
  SafetySetting,
  LiveServerMessage,
} from "@google/genai";
import type { StandardToolCall, ReasoningConfig } from "./StandardizedTypes";
import type { ToolFunctionsMap } from "../functionDeclaration/functionDeclaration";
import type { GeminiLiveVoice } from "../config/config";

export type LiveModality = "AUDIO" | "TEXT" | "IMAGE" | "VIDEO" | "audio" | "text" | "image" | "video";

export type LiveVoiceName =
  | GeminiLiveVoice
  | "Puck"
  | "Charon"
  | "Aoede"
  | "Fenrir"
  | "Kore"
  | string;

export interface LiveSpeechConfig {
  /** Voice name for spoken response generation (e.g., Puck, Charon, Aoede, Fenrir, Kore) */
  voiceName?: LiveVoiceName;
  /** ISO 639-1 language code hint for speech synthesis (e.g., 'en-US', 'es-ES') */
  languageCode?: string;
}

export interface LiveThinkingConfig {
  /**
   * Token budget allocated for background reasoning.
   * 0 = disabled, -1 = automatic, or a positive integer budget (e.g. 1024, 2048).
   */
  thinkingBudget?: number;
  /** Whether to stream internal thoughts/reasoning to the client (default: true if budget > 0) */
  includeThoughts?: boolean;
  /** Optional thinking level */
  thinkingLevel?: "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" | string;
  /** Unified reasoning configuration from llm-multi-provider */
  reasoning?: ReasoningConfig;
}

export interface LiveContextWindowCompressionConfig {
  /**
   * Number of tokens that triggers context window compression.
   * Prevents long-running audio/video sessions from aborting due to context exhaustion.
   */
  triggerTokens?: number | string;
  /**
   * Target number of tokens to keep after sliding window compression reduction.
   */
  slidingWindowTargetTokens?: number | string;
}

export interface LiveSessionResumptionConfig {
  /**
   * Session resumption handle from a previous session to resume conversation context.
   */
  handle?: string;
  /**
   * When true, server sends message indices allowing transparent reconnections without losing stream frames (Vertex AI only; not supported in Gemini Developer API).
   */
  transparent?: boolean;
  /**
   * Whether the client should automatically attempt to reconnect when the socket drops or receives a GoAway.
   * Defaults to true if a resumption handle is available.
   */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;
  /** Initial delay before reconnection in milliseconds (default: 1000) */
  reconnectDelayMs?: number;
}

export interface LiveAudioTranscriptionConfig {
  /**
   * BCP-47 language codes for speech recognition hint (e.g. ['en-US']).
   * If omitted, automatic language detection is used.
   */
  languageCodes?: string[];
}

export interface LiveFunctionResponse {
  /** Unique ID matching the function call */
  id?: string;
  /** Name of the tool function */
  name: string;
  /** Return value / payload of the tool execution */
  response: Record<string, unknown>;
}

export interface LiveSessionConfig {
  /** Gemini Live model (default: 'gemini-2.5-flash') */
  model?: string;
  /** Gemini API key (defaults to GEMINI_API_KEY environment variable) */
  apiKey?: string;
  /** Response modalities (e.g., [Modality.AUDIO] or [Modality.TEXT]) */
  responseModalities?: Array<LiveModality | Modality>;
  /** Speech synthesis configuration (voice and language) */
  speechConfig?: LiveSpeechConfig;
  /** System instruction prompt */
  systemInstruction?: string;
  /** Sampling temperature (0.0 - 2.0) */
  temperature?: number;
  /** Top-P probability sampling */
  topP?: number;
  /** Top-K sampling */
  topK?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Thinking and reasoning configuration for Gemini 2.5/3 Live models */
  thinkingConfig?: LiveThinkingConfig;
  /** Unified reasoning shorthand */
  reasoning?: ReasoningConfig;
  /** Enables affective dialog (model detects user emotions and adapts tone) */
  enableAffectiveDialog?: boolean;
  /** Configures proactivity of the model */
  proactivity?: {
    proactiveAudio?: boolean;
    [key: string]: unknown;
  };
  /** Tool / Function declarations available to the model */
  tools?: Tool[];
  /** Map of function implementations matching the tool declarations */
  toolFunctions?: ToolFunctionsMap;
  /** Automatically execute matching tools and send responses back to the server (default: true if toolFunctions provided) */
  autoExecuteTools?: boolean;
  /** Session resumption configuration */
  sessionResumption?: LiveSessionResumptionConfig;
  /** Context window compression configuration for unlimited session duration */
  contextWindowCompression?: LiveContextWindowCompressionConfig;
  /** Real-time transcription configuration for user's input audio */
  inputAudioTranscription?: LiveAudioTranscriptionConfig;
  /** Real-time transcription configuration for model's spoken output audio */
  outputAudioTranscription?: LiveAudioTranscriptionConfig;
  /** Safety settings */
  safetySettings?: SafetySetting[];
}

export interface LiveAudioChunk {
  /** Raw decoded PCM audio bytes (24kHz 16-bit linear PCM mono) */
  data: Uint8Array;
  /** Base64-encoded PCM audio string */
  base64: string;
  /** MIME type (usually 'audio/pcm;rate=24000') */
  mimeType: string;
}

export interface LiveTextChunk {
  /** Incremental text token delta generated by the model */
  text: string;
}

export interface LiveThoughtChunk {
  /** Reasoning / thought token delta streamed during internal thinking */
  text: string;
  /** Optional cryptographic signature for thought persistence */
  thoughtSignature?: string;
}

export interface LiveTranscriptionChunk {
  /** Transcribed text delta */
  text: string;
  /** Whether this transcription segment is finalized */
  finished: boolean;
  /** Origin of transcription: 'user' (user's speech) or 'model' (model's synthesized voice) */
  source: "user" | "model";
}

export interface LiveToolCallEvent {
  /** List of tool calls requested by the model */
  calls: StandardToolCall[];
  /** Raw server message containing toolCall */
  rawMessage: LiveServerMessage;
}

export interface LiveToolResponseEvent {
  /** List of responses delivered back to the model */
  responses: LiveFunctionResponse[];
}

export interface LiveResumptionUpdateEvent {
  /** New resumption handle valid for reconnecting within 2 hours */
  handle?: string;
  /** Whether the session is currently in a resumable state */
  resumable?: boolean;
  /** Last client message index consumed by the server */
  lastConsumedClientMessageIndex?: string;
}

export interface LiveGoAwayEvent {
  /** Remaining time in seconds before the connection will terminate */
  timeLeft?: string;
}

export interface LiveTurnCompleteEvent {
  /** Indicates whether the turn completed normally or was interrupted */
  interrupted: boolean;
  /** Indicates whether all model generation for the entire multi-step interaction is complete */
  generationComplete: boolean;
}

export interface LiveSessionEvents {
  /** Socket connection opened and handshake completed */
  open: () => void;
  /** Connection closed */
  close: (code?: number, reason?: string) => void;
  /** An error occurred */
  error: (error: Error) => void;
  /** Audio chunk received from model */
  audio: (chunk: LiveAudioChunk) => void;
  /** Text chunk received from model */
  text: (chunk: LiveTextChunk) => void;
  /** Thought/reasoning chunk streamed from model (Thinking in Live API) */
  thought: (chunk: LiveThoughtChunk) => void;
  /** Input audio transcription (transcribing user's voice in real time) */
  inputTranscription: (chunk: LiveTranscriptionChunk) => void;
  /** Output audio transcription (transcribing model's voice in real time) */
  outputTranscription: (chunk: LiveTranscriptionChunk) => void;
  /** User interrupted the model (barge-in): client should immediately stop playing queued audio */
  interrupted: () => void;
  /** Current generation turn finished */
  turnComplete: (event: LiveTurnCompleteEvent) => void;
  /** Full interaction generation cycle finished */
  generationComplete: () => void;
  /** Model requested tool/function execution */
  toolCall: (event: LiveToolCallEvent) => void;
  /** Tool execution response sent back to model */
  toolResponse: (event: LiveToolResponseEvent) => void;
  /** Previously requested tool calls were cancelled by user interruption */
  toolCallCancellation: (ids: string[]) => void;
  /** Session resumption handle update received */
  resumptionUpdate: (event: LiveResumptionUpdateEvent) => void;
  /** Server warning that connection will terminate soon */
  goAway: (event: LiveGoAwayEvent) => void;
  /** Model is pausing to wait for additional user input */
  waitingForInput: () => void;
  /** Raw unparsed server message */
  message: (message: LiveServerMessage) => void;
}

export interface LiveTranscriptionConfig {
  /** Dedicated transcription model (default: 'gemini-3.5-transcribe-live') */
  model?: string;
  /** Gemini API key */
  apiKey?: string;
  /** Language codes for speech recognition bias (e.g. ['en-US']) */
  languageCodes?: string[];
  /** Optional system instruction for formatting or vocabulary biasing */
  systemInstruction?: string;
  /** Session resumption configuration */
  sessionResumption?: LiveSessionResumptionConfig;
  /** Context window compression configuration */
  contextWindowCompression?: LiveContextWindowCompressionConfig;
  /** Whether to auto-reconnect on connection loss */
  autoReconnect?: boolean;
}
