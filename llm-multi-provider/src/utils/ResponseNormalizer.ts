import type { GenerateContentResponse } from "@google/genai";
import type { StandardResponse, StandardToolCall, ServiceTier } from "../types/StandardizedTypes";

interface OpenRouterResponsePayload {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
      reasoning_details?: unknown[];
      service_tier?: ServiceTier;
      tool_calls?: Array<{
        id?: string;
        function: {
          name: string;
          arguments: string | Record<string, unknown>;
        };
      }>;
    };
  }>;
  model?: string;
  service_tier?: ServiceTier;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
    service_tier?: ServiceTier;
  };
}

function extractThinkTags(content: string): { cleanContent: string; extractedReasoning?: string } {
  if (!content) return { cleanContent: "" };

  const thinkRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/i;
  const match = content.match(thinkRegex);

  if (match) {
    const extractedReasoning = match[1].trim();
    const cleanContent = content.replace(thinkRegex, "").trim();
    return { cleanContent, extractedReasoning };
  }

  return { cleanContent: content };
}

export class ResponseNormalizer {
    static normalizeGemini(response: GenerateContentResponse): StandardResponse {
        const candidate = response.candidates?.[0];
        
        if (!candidate || !candidate.content) {
            return { text: "", finishReason: "error", rawResponse: response };
        }

        let reasoningText = "";
        let mainText = "";
        const parts = candidate.content.parts || [];

        for (const part of parts) {
            if ((part as any).thought) {
                reasoningText += (reasoningText ? "\n" : "") + (part.text || "");
            } else if (part.text) {
                mainText += part.text;
            }
        }

        let finalText = mainText || response.text || "";

        if (!reasoningText && finalText) {
            const extracted = extractThinkTags(finalText);
            if (extracted.extractedReasoning) {
                reasoningText = extracted.extractedReasoning;
                finalText = extracted.cleanContent;
            }
        }

        const validFunctionCalls = (response.functionCalls || []).filter(fc => fc.name);
        const standardToolCalls: StandardToolCall[] | undefined = validFunctionCalls.length > 0 
            ? validFunctionCalls.map(fc => ({
                name: fc.name as string,
                args: fc.args || {},
                id: undefined 
            }))
            : undefined;

        const usageMeta = response.usageMetadata as Record<string, any> | undefined;
        let reasoningTokens: number | undefined = undefined;

        if (usageMeta) {
            if (typeof usageMeta.thoughtsTokenCount === "number") {
                reasoningTokens = usageMeta.thoughtsTokenCount;
            } else if (typeof usageMeta.totalThoughtTokens === "number") {
                reasoningTokens = usageMeta.totalThoughtTokens;
            } else if (typeof usageMeta.total_thought_tokens === "number") {
                reasoningTokens = usageMeta.total_thought_tokens;
            } else if (Array.isArray(usageMeta.candidatesTokensDetails)) {
                const thoughtDetail = usageMeta.candidatesTokensDetails.find(
                    (d: any) => d.modality === "THOUGHT" || d.modality === "THINKING"
                );
                if (thoughtDetail && typeof thoughtDetail.tokenCount === "number") {
                    reasoningTokens = thoughtDetail.tokenCount;
                }
            }
        }

        return {
            text: finalText,
            reasoning: reasoningText || undefined,
            toolCalls: standardToolCalls,
            finishReason: candidate.finishReason,
            serviceTier: undefined,
            service_tier: undefined,
            usage: response.usageMetadata ? {
                promptTokens: response.usageMetadata.promptTokenCount || 0,
                completionTokens: response.usageMetadata.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata.totalTokenCount || 0,
                reasoningTokens: reasoningTokens,
            } : undefined,
            rawResponse: response
        };
    }

    static normalizeOpenRouter(response: unknown): StandardResponse {
        const res = response as OpenRouterResponsePayload;
        const choice = res.choices?.[0];
        const message = choice?.message;

        if (!message) {
             return {
                text: "",
                finishReason: "error",
                rawResponse: response
            };
        }

        let content = message.content || "";
        const toolCallsRaw = message.tool_calls;
        
        let reasoning = message.reasoning || message.reasoning_content;
        const reasoningDetails = message.reasoning_details;

        if (!reasoning && content) {
            const extracted = extractThinkTags(content);
            if (extracted.extractedReasoning) {
                reasoning = extracted.extractedReasoning;
                content = extracted.cleanContent;
            }
        }

        const serviceTier: ServiceTier | undefined =
          res.service_tier ||
          res.usage?.service_tier ||
          message.service_tier;

        let standardToolCalls: StandardToolCall[] | undefined;

        if (toolCallsRaw && Array.isArray(toolCallsRaw)) {
            standardToolCalls = toolCallsRaw.map((tc) => {
                let parsedArgs: unknown = {};
                try {
                    if (typeof tc.function.arguments === "string") {
                        parsedArgs = JSON.parse(tc.function.arguments);
                    } else {
                        parsedArgs = tc.function.arguments;
                    }
                } catch {
                    console.error("Failed to parse tool arguments from OpenRouter:", tc.function.arguments);
                    parsedArgs = { error: "Failed to parse JSON arguments" };
                }

                return {
                    id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`, 
                    name: tc.function.name,
                    args: parsedArgs
                };
            });
        }

        const usageMeta = res.usage;
        let reasoningTokens: number | undefined = undefined;

        if (usageMeta) {
            if (typeof usageMeta.completion_tokens_details?.reasoning_tokens === "number") {
                reasoningTokens = usageMeta.completion_tokens_details.reasoning_tokens;
            } else if (typeof usageMeta.reasoning_tokens === "number") {
                reasoningTokens = usageMeta.reasoning_tokens;
            }
        }

        return {
            text: content,
            reasoning: reasoning,
            reasoningDetails: reasoningDetails,
            toolCalls: standardToolCalls,
            finishReason: choice.finish_reason,
            model: res.model,
            serviceTier: serviceTier,
            service_tier: serviceTier,
            usage: res.usage ? {
                promptTokens: res.usage.prompt_tokens || 0,
                completionTokens: res.usage.completion_tokens || 0,
                totalTokens: res.usage.total_tokens || 0,
                reasoningTokens: reasoningTokens,
            } : undefined,
            rawResponse: response
        };
    }
}