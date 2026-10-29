// Config
export {
  AgentConfig,
  type AgentSystemOptions,
  type ModelTier,
  type LLMProvider,
  type LLMProviderId,
  type EmbeddingProvider,
  type EmbeddingProviderId,
  DEFAULT_GEMINI_MAIN,
  DEFAULT_GEMINI_FALLBACK,
  DEFAULT_OPENROUTER_MAIN,
  DEFAULT_OPENROUTER_FALLBACK,
  DEFAULT_GEMINI_EMBEDDING_V1,
  DEFAULT_GEMINI_EMBEDDING_V2,
  DEFAULT_DECISION_MODEL,
  DEFAULT_GEMINI_LIVE_MODEL,
  DEFAULT_GEMINI_TRANSCRIBE_MODEL,
  GEMINI_LIVE_VOICES,
  type GeminiLiveVoice,
  DEFAULT_TEMPERATURE,
  LLM_PROVIDERS,
  EMBEDDING_PROVIDERS,
} from "./config/config";

// Image Generation & Editing
export {
  OpenRouterImageProvider,
  DEFAULT_IMAGE_MODEL,
  type OpenRouterImageConfig,
} from "./providers/OpenRouterImageProvider";
export type { IImageProvider } from "./interfaces/IImageProvider";
export * from "./types/ImageTypes";

// Core Agent
export {
  ChatAgent,
  type GenerateOnceOptions,
  type SendMessageOptions,
} from "./ChatAgent";

// LLM Providers
export { GeminiProvider, type GeminiModels } from "./providers/GeminiProvider";
export { OpenRouterProvider, type OpenRouterModels } from "./providers/OpenRouter";
export { FallbackProvider, type FallbackProviderOptions } from "./providers/FallbackProvider";

// Embedding Providers
export { OpenRouterEmbeddingProvider } from "./providers/OpenRouterEmbeddingProvider";
export { LocalEmbeddingProvider } from "./providers/LocalEmbeddingProvider";
export { GeminiEmbeddingProvider } from "./providers/GeminiEmbeddingProvider";

// Interfaces
export type { ILLMProvider } from "./interfaces/ILLMProvider";
export type { IEmbeddingProvider } from "./interfaces/IEmbeddingProvider";
export type { IDecisionProvider } from "./interfaces/IDecisionProvider";

// Decision Provider & Types
export {
  OpenRouterDecisionProvider,
  type OpenRouterDecisionConfig,
} from "./providers/OpenRouterDecisionProvider";
export * from "./types/DecisionTypes";

// Unified Registry Factory
export {
  buildProvider,
  createLLMProvider,
  createEmbeddingProvider,
  createDecisionProvider,
  createLiveSession,
  createLiveTranscriber,
  resolveEmbeddingSlug,
  type CreateLLMOptions,
} from "./registry";

// Gemini Live API & Realtime Streaming
export { GeminiLiveSession } from "./providers/GeminiLiveSession";
export { GeminiLiveTranscriber } from "./providers/GeminiLiveTranscriber";
export type { ILiveSession } from "./interfaces/ILiveSession";
export * from "./types/LiveTypes";
export { AudioUtils } from "./utils/AudioUtils";
export { TypedEventEmitter, type Listener } from "./utils/TypedEventEmitter";

// Function Declarations & Tools
export { createToolbox, type ToolFunctionsMap } from "./functionDeclaration/functionDeclaration";
export * from "./tools/tools";

// Standardized Types & Utils
export * from "./types/StandardizedTypes";
export * from "./types/GeminiEmbeddingTypes";
export { SchemaMapper } from "./utils/SchemaMapper";
export { ResponseNormalizer } from "./utils/ResponseNormalizer";
export { convertGeminiToolsToOpenAI } from "./utils/toolConverter";
export { ToolMapper, type OpenAITool } from "./utils/ToolMapper";
export { GeminiTaskFormatter } from "./utils/GeminiTaskFormatter";
export * from "./utils/ReasoningMapper";
export { isJsonString, deepParseJson, unwrapArguments } from "./utils";