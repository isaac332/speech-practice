import { HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { LogEntry } from "../types/StandardizedTypes";

export interface AgentSystemOptions {
  logCallback?: (logEntry: LogEntry) => void | Promise<void>;
}

class ConfigStore {
  private options: AgentSystemOptions = {};

  initialize(opts: AgentSystemOptions) {
    this.options = opts;
  }

  get logCallback(): ((logEntry: LogEntry) => void | Promise<void>) | undefined {
    return this.options.logCallback;
  }
}

export const AgentConfig = new ConfigStore();

// --- Default Vision-Capable Models ---
export const DEFAULT_GEMINI_MAIN = "gemini-3.5-flash-lite";
export const DEFAULT_GEMINI_FALLBACK = "gemini-3.5-flash-lite";
export const DEFAULT_OPENROUTER_MAIN = "~deepseek/deepseek-flash-latest";
export const DEFAULT_OPENROUTER_FALLBACK = "~deepseek/deepseek-flash-latest";

// Gemini Embedding Models
export const DEFAULT_GEMINI_EMBEDDING_V2 = "gemini-embedding-2";
export const DEFAULT_GEMINI_EMBEDDING_V1 = "gemini-embedding-001";

// Default Decision Model (OpenRouter System One Probability Classifier)
export const DEFAULT_DECISION_MODEL = "typesafe/jev-1.13";

// Gemini Live & Transcription Models
export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const DEFAULT_GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe-live";

// Gemini Live Prebuilt Voices
export const GEMINI_LIVE_VOICES = {
  PUCK: "Puck",
  CHARON: "Charon",
  AOEDE: "Aoede",
  FENRIR: "Fenrir",
  KORE: "Kore",
} as const;

export type GeminiLiveVoice = (typeof GEMINI_LIVE_VOICES)[keyof typeof GEMINI_LIVE_VOICES];

export type ModelTier = "main" | "fast" | "planner";
export type LLMProviderId = "gemini" | "openrouter";
export type LLMProvider = LLMProviderId;
export type EmbeddingProviderId = "gemini" | "openrouter" | "local";
export type EmbeddingProvider = EmbeddingProviderId;

// Provider registry metadata
export const LLM_PROVIDERS: Record<LLMProviderId, { id: LLMProviderId; name: string; envKey: string }> = {
  gemini: { id: "gemini", name: "Google Gemini", envKey: "GEMINI_API_KEY" },
  openrouter: { id: "openrouter", name: "OpenRouter", envKey: "OPENROUTER_API_KEY" },
};

export const EMBEDDING_PROVIDERS: Record<EmbeddingProviderId, { id: EmbeddingProviderId; name: string; dimensions?: number }> = {
  gemini: { id: "gemini", name: "Gemini Embeddings", dimensions: 768 },
  openrouter: { id: "openrouter", name: "OpenRouter Embeddings" },
  local: { id: "local", name: "Local HuggingFace Embeddings" },
};

// --- Shared Configuration ---
export const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const DEFAULT_TEMPERATURE = 1.0;