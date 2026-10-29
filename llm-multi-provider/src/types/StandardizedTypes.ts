import type { Schema } from "@google/genai";
import type { ModelTier } from "../config/config";

export type StandardRole = "user" | "model" | "system" | "function" | "tool";

export interface StandardTextPart {
  type: "text";
  text: string;
}

export interface StandardImagePart {
  type: "image_url";
  imageUrl: string; 
}

export type StandardContentPart = StandardTextPart | StandardImagePart;

export interface StandardToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown> | unknown; 
}

export type ReasoningEffort = "max" | "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

export interface ReasoningConfig {
  effort?: ReasoningEffort;
  maxTokens?: number;
  exclude?: boolean;
  enabled?: boolean;
}

export type ServiceTier = "flex" | "priority" | "fast" | "default" | string;

export type QuantizationLevel =
  | "int4"
  | "int8"
  | "fp4"
  | "mxfp4"
  | "nvfp4"
  | "fp6"
  | "fp8"
  | "mxfp8"
  | "fp16"
  | "bf16"
  | "fp32"
  | "unknown"
  | string;

export interface PerformanceThresholdPercentiles {
  p50?: number;
  p75?: number;
  p90?: number;
  p99?: number;
  [key: string]: number | undefined;
}

export type ProviderSortType = "price" | "throughput" | "latency";
export type ProviderSortPartition = "model" | "none";

export type ProviderSortConfig =
  | ProviderSortType
  | {
      by: ProviderSortType;
      partition?: ProviderSortPartition;
    };

export interface ProviderMaxPrice {
  prompt?: number;
  completion?: number;
  request?: number;
  image?: number;
  [key: string]: number | undefined;
}

export interface ProviderRoutingConfig {
  order?: string[];
  allowFallbacks?: boolean;
  allow_fallbacks?: boolean;
  requireParameters?: boolean;
  require_parameters?: boolean;
  dataCollection?: "allow" | "deny";
  data_collection?: "allow" | "deny";
  zdr?: boolean;
  enforceDistillableText?: boolean;
  enforce_distillable_text?: boolean;
  only?: string[];
  ignore?: string[];
  quantizations?: QuantizationLevel[];
  sort?: ProviderSortConfig;
  preferredMinThroughput?: number | PerformanceThresholdPercentiles;
  preferred_min_throughput?: number | PerformanceThresholdPercentiles;
  preferredMaxLatency?: number | PerformanceThresholdPercentiles;
  preferred_max_latency?: number | PerformanceThresholdPercentiles;
  maxPrice?: ProviderMaxPrice;
  max_price?: ProviderMaxPrice;
  [key: string]: unknown;
}

export interface StandardUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface StandardResponse {
  text?: string;
  reasoning?: string;
  reasoningDetails?: unknown[];
  toolCalls?: StandardToolCall[];
  finishReason?: string;
  model?: string;
  serviceTier?: ServiceTier;
  service_tier?: ServiceTier;
  usage?: StandardUsage;
  rawResponse?: unknown;
}

export interface StandardMessage {
  role: StandardRole;
  content?: string | StandardContentPart[];
  reasoning?: string;
  reasoningDetails?: unknown[];
  reasoningTokens?: number;
  model?: string;
  toolCalls?: StandardToolCall[];
  functionResponse?: {
    name: string;
    id?: string;
    response: unknown;
  };
}

export interface ProviderOptions {
  modelTier?: ModelTier;
  model?: string;
  temperature?: number;
  systemInstruction?: string;
  responseSchema?: Schema;
  schemaName?: string;
  maxOutputTokens?: number;
  reasoning?: ReasoningConfig;
  serviceTier?: ServiceTier;
  service_tier?: ServiceTier;
  provider?: ProviderRoutingConfig;
  providerRouting?: ProviderRoutingConfig;
  headers?: Record<string, string>;
  anthropicBeta?: string | string[];
}

export interface LogEntry {
  turn_id: string;
  action: string;
  content: unknown;
  timestamp: string;
}

export interface StandardEmbeddingRequest {
  inputs: string[];
  model?: string;
}

export interface StandardEmbeddingResponse {
  embeddings: number[][];
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}