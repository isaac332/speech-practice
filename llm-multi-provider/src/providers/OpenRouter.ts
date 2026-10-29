import type { ILLMProvider } from "../interfaces/ILLMProvider";
import type {
  StandardMessage,
  StandardResponse,
  ProviderOptions,
  ServiceTier,
  ProviderRoutingConfig
} from "../types/StandardizedTypes";
import { DEFAULT_OPENROUTER_FALLBACK, DEFAULT_OPENROUTER_MAIN } from "../config/config";
import { type Tool, type FunctionDeclaration, Type } from "@google/genai";
import { SchemaMapper } from "../utils/SchemaMapper";
import { ResponseNormalizer } from "../utils/ResponseNormalizer";
import { resolveUnifiedReasoning } from "../utils/ReasoningMapper";

export interface OpenRouterModels {
  mainModel?: string;
  fastModel?: string;
  plannerModel?: string;
  fallbackModel?: string;
  defaultServiceTier?: ServiceTier;
  defaultProviderRouting?: ProviderRoutingConfig;
  defaultHeaders?: Record<string, string>;
}

interface OpenAIFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

interface OpenAITool {
  type: "function";
  function: OpenAIFunction;
}

interface OpenAIResponseFormat {
  type: "json_schema" | "json_object";
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> | null;
  tool_call_id?: string;
  name?: string;
  reasoning?: string;
  reasoning_details?: unknown[];
  tool_calls?: Array<{
    id?: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenRouterPayload {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  service_tier?: string;
  provider?: Record<string, unknown>;
  reasoning?: {
    effort?: string;
    max_tokens?: number;
    exclude?: boolean;
    enabled?: boolean;
  };
  response_format?: OpenAIResponseFormat;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required";
}

export class OpenRouterProvider implements ILLMProvider {
  readonly id = "openrouter";
  readonly providerName = "OpenRouter";

  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private mainModelName: string;
  private fastModelName: string;
  private plannerModelName: string;
  private defaultServiceTier?: ServiceTier;
  private defaultProviderRouting?: ProviderRoutingConfig;
  private defaultHeaders?: Record<string, string>;

  constructor(apiKey: string, customModels?: OpenRouterModels) {
    this.apiKey = (apiKey || "").trim();
    this.mainModelName = customModels?.mainModel || DEFAULT_OPENROUTER_MAIN;
    this.fastModelName = customModels?.fastModel || customModels?.fallbackModel || DEFAULT_OPENROUTER_FALLBACK;
    this.plannerModelName = customModels?.plannerModel || DEFAULT_OPENROUTER_MAIN;
    this.defaultServiceTier = customModels?.defaultServiceTier;
    this.defaultProviderRouting = customModels?.defaultProviderRouting;
    this.defaultHeaders = customModels?.defaultHeaders;
  }

  public validateConfig(): boolean {
    return this.apiKey.length > 0;
  }

  public async generate(messages: StandardMessage[], tools?: Tool[], options?: ProviderOptions): Promise<StandardResponse> {
    if (!this.validateConfig()) {
      throw new Error(
        "OpenRouter API key is missing. Ensure OPENROUTER_API_KEY is configured."
      );
    }

    let openAIMessages = messages.map((msg) => this.mapToOpenAIMessage(msg));

    const existingSystem = openAIMessages.find((m) => m.role === "system");
    if (!existingSystem && options?.systemInstruction) {
      openAIMessages = [
        { role: "system", content: options.systemInstruction },
        ...openAIMessages,
      ];
    } else if (existingSystem && openAIMessages.indexOf(existingSystem) !== 0) {
      openAIMessages = openAIMessages.filter((m) => m !== existingSystem);
      openAIMessages.unshift(existingSystem);
    }

    let selectedModel = this.mainModelName;
    
    if (options?.model && options.model.trim() !== "") {
      selectedModel = options.model;
    } else if (options?.modelTier === "planner") {
      selectedModel = this.plannerModelName;
    } else if (options?.modelTier === "fast") {
      selectedModel = this.fastModelName;
    } else if (options?.modelTier === "main") {
      selectedModel = this.mainModelName;
    }

    let responseFormat: OpenAIResponseFormat | undefined = undefined;
    let finalTools: OpenAITool[] | undefined = undefined;

    if (options?.responseSchema) {
      try {
        const strictJsonSchema = SchemaMapper.mapToOpenAI(options.responseSchema);
        const schemaName = options.schemaName || "structured_response";

        responseFormat = {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: strictJsonSchema,
          },
        };
      } catch (e) {
        console.warn("Warning: Failed to map Google Schema to OpenAI JSON Schema. Proceeding without strict format.", e);
      }
    } else {
      if (tools && tools.length > 0) {
        finalTools = this.mapToolsToOpenAI(tools);
      }
    }

    const payload: OpenRouterPayload = {
      model: selectedModel,
      messages: openAIMessages,
      temperature: responseFormat ? 0.3 : options?.temperature ?? 1.0,
      max_tokens: options?.maxOutputTokens ?? 20000,
    };

    const chosenServiceTier = options?.serviceTier || options?.service_tier || this.defaultServiceTier;
    if (chosenServiceTier && chosenServiceTier !== "default") {
      payload.service_tier = chosenServiceTier;
    }

    const rawRouting = options?.providerRouting || options?.provider || this.defaultProviderRouting;
    const normalizedRouting = this.mapProviderRouting(rawRouting);
    if (normalizedRouting) {
      payload.provider = normalizedRouting;
    }

    const resolved = resolveUnifiedReasoning(options?.reasoning);
    payload.reasoning = {};

    if (resolved.exclude !== undefined) {
      payload.reasoning.exclude = resolved.exclude;
    }
    if (resolved.enabled !== undefined) {
      payload.reasoning.enabled = resolved.enabled;
    }

    if (resolved.effort === "none" || !resolved.enabled) {
      payload.reasoning.effort = "none";
    } else if (options?.reasoning?.maxTokens !== undefined && options?.reasoning?.effort === undefined) {
      payload.reasoning.max_tokens = resolved.budgetTokens;
    } else {
      payload.reasoning.effort = resolved.effort;
    }

    if (resolved.budgetTokens > 0) {
      payload.max_tokens = Math.max(payload.max_tokens || 20000, resolved.budgetTokens + 4096);
    }

    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    if (finalTools && !responseFormat) {
      payload.tools = finalTools;
      payload.tool_choice = "auto";
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost:3000",
      "X-Title": "Nutria Engine",
      ...(this.defaultHeaders || {}),
      ...(options?.headers || {}),
    };

    if (options?.anthropicBeta) {
      headers["x-anthropic-beta"] = Array.isArray(options.anthropicBeta)
        ? options.anthropicBeta.join(",")
        : options.anthropicBeta;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API Error (${response.status}): ${errorBody}`);
      }

      const data: unknown = await response.json();
      return ResponseNormalizer.normalizeOpenRouter(data);
    } catch (error: unknown) {
      console.error("OpenRouter Generation Failed:", error);
      throw error;
    }
  }

  private mapProviderRouting(config?: ProviderRoutingConfig): Record<string, unknown> | undefined {
    if (!config) return undefined;
    const result: Record<string, unknown> = {};

    if (config.order && config.order.length > 0) {
      result.order = config.order;
    }

    if (config.allowFallbacks !== undefined) {
      result.allow_fallbacks = config.allowFallbacks;
    } else if (config.allow_fallbacks !== undefined) {
      result.allow_fallbacks = config.allow_fallbacks;
    }

    if (config.requireParameters !== undefined) {
      result.require_parameters = config.requireParameters;
    } else if (config.require_parameters !== undefined) {
      result.require_parameters = config.require_parameters;
    }

    if (config.dataCollection !== undefined) {
      result.data_collection = config.dataCollection;
    } else if (config.data_collection !== undefined) {
      result.data_collection = config.dataCollection;
    }

    if (config.zdr !== undefined) {
      result.zdr = config.zdr;
    }

    if (config.enforceDistillableText !== undefined) {
      result.enforce_distillable_text = config.enforceDistillableText;
    } else if (config.enforce_distillable_text !== undefined) {
      result.enforce_distillable_text = config.enforceDistillableText;
    }

    if (config.only && config.only.length > 0) result.only = config.only;
    if (config.ignore && config.ignore.length > 0) result.ignore = config.ignore;
    if (config.quantizations && config.quantizations.length > 0) result.quantizations = config.quantizations;
    if (config.sort) result.sort = config.sort;

    if (config.preferredMinThroughput !== undefined) {
      result.preferred_min_throughput = config.preferredMinThroughput;
    } else if (config.preferred_min_throughput !== undefined) {
      result.preferred_min_throughput = config.preferredMinThroughput;
    }

    if (config.preferredMaxLatency !== undefined) {
      result.preferred_max_latency = config.preferredMaxLatency;
    } else if (config.preferred_max_latency !== undefined) {
      result.preferred_max_latency = config.preferredMaxLatency;
    }

    if (config.maxPrice !== undefined) {
      result.max_price = config.maxPrice;
    } else if (config.max_price !== undefined) {
      result.max_price = config.maxPrice;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private mapToOpenAIMessage(msg: StandardMessage): OpenAIMessage {
    if (msg.role === "function" || msg.role === "tool") {
      if (!msg.functionResponse) return { role: "tool", tool_call_id: "unknown", content: "" };
      return {
        role: "tool",
        tool_call_id: msg.functionResponse.id || `call_${Math.random().toString(36).slice(2, 9)}`,
        name: msg.functionResponse.name,
        content: typeof msg.functionResponse.response === "string" ? msg.functionResponse.response : JSON.stringify(msg.functionResponse.response),
      };
    }

    if (msg.role === "model") {
      const assistantMsg: OpenAIMessage = {
        role: "assistant",
        content: typeof msg.content === "string" ? msg.content : (Array.isArray(msg.content) ? msg.content.map(p => p.type === 'text' ? p.text : '').join('\n') : null),
      };

      if (msg.reasoning) assistantMsg.reasoning = msg.reasoning;
      if (msg.reasoningDetails) assistantMsg.reasoning_details = msg.reasoningDetails;

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        }));
      }
      return assistantMsg;
    }

    let content: OpenAIMessage["content"] = typeof msg.content === "string" ? msg.content : "";
    if (Array.isArray(msg.content)) {
      content = msg.content.map((part) => {
        if (part.type === "text") return { type: "text" as const, text: part.text };
        return { type: "image_url" as const, image_url: { url: part.imageUrl } };
      });
    }

    return {
      role: msg.role === "system" ? "system" : "user",
      content,
    };
  }

  private mapToolsToOpenAI(googleTools: Tool[]): OpenAITool[] {
    const allFunctions = googleTools.flatMap((t) => ("functionDeclarations" in t && t.functionDeclarations) ? t.functionDeclarations : []);
    return allFunctions.map((fn: FunctionDeclaration) => ({
      type: "function",
      function: {
        name: fn.name || "unnamed_tool",
        description: fn.description,
        parameters: this.cleanSchema(fn.parameters),
      },
    }));
  }

  private cleanSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
    const newSchema: Record<string, unknown> = { ...(schema as Record<string, unknown>) };
    if (newSchema.type) newSchema.type = this.mapGoogleTypeToJsonType(newSchema.type);
    if (newSchema.properties && typeof newSchema.properties === "object") {
      const props: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(newSchema.properties as Record<string, unknown>)) {
        props[key] = this.cleanSchema(val);
      }
      newSchema.properties = props;
    }
    if (newSchema.items) newSchema.items = this.cleanSchema(newSchema.items);
    delete newSchema.nullable;
    delete newSchema.optional;
    if (newSchema.type === "object" && !newSchema.properties) newSchema.properties = {};
    return newSchema;
  }

  private mapGoogleTypeToJsonType(type: unknown): string {
    const t = String(type).toUpperCase();
    if (t === "STRING" || type === Type.STRING) return "string";
    if (t === "NUMBER" || t === "INTEGER" || type === Type.NUMBER || type === Type.INTEGER) return "number";
    if (t === "BOOLEAN" || type === Type.BOOLEAN) return "boolean";
    if (t === "ARRAY" || type === Type.ARRAY) return "array";
    if (t === "OBJECT" || type === Type.OBJECT) return "object";
    return "string";
  }
}