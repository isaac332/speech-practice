import {
  GoogleGenAI,
  type Content,
  type Part,
  type Tool as GenAITool,
  type GenerateContentConfig,
  type CreateAuthTokenConfig,
  type AuthToken,
} from "@google/genai";
import type { ILLMProvider } from "../interfaces/ILLMProvider";
import type { StandardMessage, StandardResponse, ProviderOptions } from "../types/StandardizedTypes";
import { ResponseNormalizer } from "../utils/ResponseNormalizer";
import { resolveUnifiedReasoning } from "../utils/ReasoningMapper";
import { DEFAULT_GEMINI_MAIN, DEFAULT_GEMINI_FALLBACK, safetySettings } from "../config/config";
import { GeminiLiveSession } from "./GeminiLiveSession";
import { GeminiLiveTranscriber } from "./GeminiLiveTranscriber";
import type { LiveSessionConfig, LiveTranscriptionConfig } from "../types/LiveTypes";

export interface GeminiModels {
    mainModel?: string;
    fastModel?: string;
}

export class GeminiProvider implements ILLMProvider {
    readonly id = "gemini-google";
    readonly providerName = "Google Gemini";

    private ai: GoogleGenAI;
    private apiKey: string;
    private mainModelName: string;
    private fastModelName: string;
    private hasValidKey: boolean = false;

    constructor(apiKey: string, customModels?: GeminiModels) {
        this.apiKey = apiKey || "";
        if (!apiKey || apiKey.trim() === "") {
            console.warn("GeminiProvider initialized without a valid API key.");
        } else {
            this.hasValidKey = true;
        }

        this.ai = new GoogleGenAI({ apiKey: apiKey || "" });

        this.mainModelName = customModels?.mainModel || DEFAULT_GEMINI_MAIN;
        this.fastModelName = customModels?.fastModel || DEFAULT_GEMINI_FALLBACK;
    }

    validateConfig(): boolean {
        return this.hasValidKey;
    }

    /**
     * Creates a new bidirectional Gemini Live streaming session.
     */
    createLiveSession(config?: LiveSessionConfig): GeminiLiveSession {
        return new GeminiLiveSession(this.apiKey, config, this.ai);
    }

    /**
     * Creates a dedicated real-time speech-to-text live transcriber.
     */
    createLiveTranscriber(config?: LiveTranscriptionConfig): GeminiLiveTranscriber {
        return new GeminiLiveTranscriber(this.apiKey, config);
    }

    /**
     * Creates a short-lived ephemeral auth token for client-side Live API connections.
     */
    async createEphemeralToken(config?: CreateAuthTokenConfig): Promise<AuthToken> {
        return await (this.ai as any).authTokens.create({ config });
    }

    async generate(messages: StandardMessage[], tools?: GenAITool[], options?: ProviderOptions): Promise<StandardResponse> {
        const systemMsg = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const history: Content[] = await Promise.all(conversationMessages.map(async (msg): Promise<Content> => {
            if (msg.role === 'model') {
                const textStr = Array.isArray(msg.content) 
                  ? msg.content.filter(p => p.type === 'text').map(p => p.type === 'text' ? p.text : '').join(' ') 
                  : (msg.content || "");

                const parts: Part[] = [];
                if (textStr) {
                    parts.push({ text: textStr });
                }

                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    for (const tc of msg.toolCalls) {
                        const safeArgs = (tc.args && typeof tc.args === 'object')
                            ? (tc.args as Record<string, unknown>)
                            : {};
                        parts.push({
                            functionCall: {
                                name: tc.name,
                                args: safeArgs
                            }
                        });
                    }
                }

                return {
                    role: 'model',
                    parts
                };
            }

            if (msg.role === 'function' || msg.role === 'tool') {
                const rawResp = msg.functionResponse?.response;
                let formattedResponse: Record<string, unknown>;

                if (typeof rawResp === 'object' && rawResp !== null) {
                    formattedResponse = rawResp as Record<string, unknown>;
                } else {
                    formattedResponse = { content: rawResp };
                }

                return {
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: msg.functionResponse?.name || 'unknown_tool',
                            response: formattedResponse
                        }
                    }]
                };
            }

            const parts: Part[] = [];
            if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'text') {
                        parts.push({ text: part.text });
                    } else if (part.type === 'image_url') {
                        const url = part.imageUrl;
                        if (url.startsWith('data:')) {
                            const match = url.match(/^data:(image\/\w+);base64,(.*)$/);
                            if (match) {
                                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                            }
                        } else if (url.startsWith('http')) {
                            try {
                                const response = await fetch(url);
                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                const arrayBuffer = await response.arrayBuffer();
                                const base64 = typeof Buffer !== 'undefined' 
                                    ? Buffer.from(arrayBuffer).toString('base64') 
                                    : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                                const mimeType = response.headers.get('content-type') || 'image/jpeg';
                                parts.push({ inlineData: { mimeType, data: base64 } });
                            } catch (err: unknown) {
                                const errMsg = err instanceof Error ? err.message : String(err);
                                throw new Error(`GeminiProvider failed to process image URL: ${url}. Error: ${errMsg}`);
                            }
                        }
                    }
                }
            } else {
                parts.push({ text: msg.content || "" });
            }

            return { role: 'user', parts };
        }));

        let modelName = this.mainModelName;
        if (options?.model && options.model.trim() !== "") {
            modelName = options.model;
        } else if (options?.modelTier === 'fast') {
            modelName = this.fastModelName;
        }

        const config: GenerateContentConfig = {
            temperature: options?.temperature ?? 1.0,
            maxOutputTokens: options?.maxOutputTokens,
            safetySettings: safetySettings,
        };

        if (tools && tools.length > 0) {
            config.tools = tools;
        }

        // Unified reasoning configuration for Gemini
        const resolved = resolveUnifiedReasoning(options?.reasoning);

        if (resolved.effort === "none" || resolved.budgetTokens === 0 || !resolved.enabled) {
            config.thinkingConfig = {
                thinkingBudget: 0,
            };
        } else {
            const thinkingConfig: Record<string, unknown> = {};

            // Google GenAI allows ONLY ONE of thinkingBudget OR thinkingLevel
            if (options?.reasoning?.maxTokens !== undefined && options?.reasoning?.effort === undefined) {
                thinkingConfig.thinkingBudget = resolved.budgetTokens;
            } else if (resolved.geminiThinkingLevel) {
                thinkingConfig.thinkingLevel = resolved.geminiThinkingLevel.toUpperCase();
            } else {
                thinkingConfig.thinkingBudget = resolved.budgetTokens;
            }

            config.thinkingConfig = thinkingConfig as any;

            if (resolved.exclude) {
                (config as any).thinkingSummaries = "none";
                (config as any).thinking_summaries = "none";
            }
        }

        if (systemMsg && systemMsg.content) {
            const sysText = Array.isArray(systemMsg.content) 
                ? systemMsg.content.filter(p => p.type === 'text').map(p => p.type === 'text' ? p.text : '').join(' ') 
                : systemMsg.content;
            config.systemInstruction = sysText;
        } else if (options?.systemInstruction) {
            config.systemInstruction = options.systemInstruction;
        }

        if (options?.responseSchema) {
            config.responseMimeType = "application/json";
            config.responseJsonSchema = options.responseSchema;
        }

        try {
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: history,
                config: config
            });
            return ResponseNormalizer.normalizeGemini(response);
        } catch (error: unknown) {
            console.error("Gemini Generation Error:", error);
            throw error;
        }
    }
}