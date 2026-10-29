import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenRouterProvider } from "./providers/OpenRouter";
import { FallbackProvider } from "./providers/FallbackProvider";
import { GeminiEmbeddingProvider } from "./providers/GeminiEmbeddingProvider";
import { OpenRouterEmbeddingProvider } from "./providers/OpenRouterEmbeddingProvider";
import { LocalEmbeddingProvider } from "./providers/LocalEmbeddingProvider";
import { OpenRouterDecisionProvider, type OpenRouterDecisionConfig } from "./providers/OpenRouterDecisionProvider";
import type { ILLMProvider } from "./interfaces/ILLMProvider";
import type { IEmbeddingProvider } from "./interfaces/IEmbeddingProvider";
import type { IDecisionProvider } from "./interfaces/IDecisionProvider";
import {
  LLM_PROVIDERS,
  EMBEDDING_PROVIDERS,
  type LLMProviderId,
  type EmbeddingProviderId,
} from "./config/config";

function readEnv(key: string): string {
  try {
    return (globalThis as any).process?.env?.[key] || "";
  } catch {
    return "";
  }
}

export interface CreateLLMOptions {
  model?: string;
  apiKey?: string;
  fallback?: LLMProviderId | null;
}

export function buildProvider(
  id: LLMProviderId,
  model?: string,
  apiKey?: string,
): ILLMProvider {
  const key = apiKey || readEnv(LLM_PROVIDERS[id].envKey);
  const models = model
    ? { mainModel: model, fastModel: model, plannerModel: model }
    : undefined;
  return id === "gemini"
    ? new GeminiProvider(key, models)
    : new OpenRouterProvider(key, models);
}

export function createLLMProvider(
  id: LLMProviderId,
  opts: CreateLLMOptions = {},
): ILLMProvider {
  const primary = buildProvider(id, opts.model, opts.apiKey);
  const fallbackId = opts.fallback && opts.fallback !== id ? opts.fallback : null;
  if (!fallbackId) return primary;
  if (!readEnv(LLM_PROVIDERS[fallbackId].envKey)) return primary;
  return new FallbackProvider(primary, buildProvider(fallbackId));
}

export function createEmbeddingProvider(
  id: EmbeddingProviderId,
  apiKey?: string,
): IEmbeddingProvider {
  switch (id) {
    case "openrouter":
      return new OpenRouterEmbeddingProvider(apiKey || readEnv("OPENROUTER_API_KEY"));
    case "local":
      return new LocalEmbeddingProvider();
    case "gemini":
    default:
      return new GeminiEmbeddingProvider(apiKey || readEnv("GEMINI_API_KEY"), {
        model: "gemini-embedding-2",
        outputDimensionality: EMBEDDING_PROVIDERS.gemini.dimensions || 768,
      });
  }
}

export function resolveEmbeddingSlug(): EmbeddingProviderId {
  const raw = readEnv("EMBEDDING_PROVIDER") as EmbeddingProviderId;
  return EMBEDDING_PROVIDERS[raw] ? raw : "gemini";
}

import { GeminiLiveSession } from "./providers/GeminiLiveSession";
import { GeminiLiveTranscriber } from "./providers/GeminiLiveTranscriber";
import type { LiveSessionConfig, LiveTranscriptionConfig } from "./types/LiveTypes";

export function createDecisionProvider(
  id: "openrouter" = "openrouter",
  opts?: OpenRouterDecisionConfig | string,
): IDecisionProvider {
  if (typeof opts === "string") {
    return new OpenRouterDecisionProvider(opts);
  }
  const key = opts?.apiKey || readEnv("OPENROUTER_API_KEY");
  return new OpenRouterDecisionProvider({ ...opts, apiKey: key });
}

export function createLiveSession(
  apiKey?: string,
  options?: LiveSessionConfig,
): GeminiLiveSession {
  const key = apiKey || readEnv("GEMINI_API_KEY");
  return new GeminiLiveSession(key, options);
}

export function createLiveTranscriber(
  apiKey?: string,
  options?: LiveTranscriptionConfig,
): GeminiLiveTranscriber {
  const key = apiKey || readEnv("GEMINI_API_KEY");
  return new GeminiLiveTranscriber(key, options);
}