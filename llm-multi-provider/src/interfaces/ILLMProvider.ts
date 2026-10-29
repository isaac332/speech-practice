// packages/llm-multi-provider/src/interfaces/ILLMProvider.ts
import type { Tool } from "@google/genai";
import type { 
    StandardMessage, 
    StandardResponse, 
    ProviderOptions 
} from "../types/StandardizedTypes";

/**
 * The Contract: Any AI provider (Gemini, OpenRouter, etc.) must implement this.
 * This allows the ResilientAgent to swap providers without changing business logic.
 */
export interface ILLMProvider {
    /**
     * Unique identifier for logging (e.g., 'gemini-primary', 'deepseek-fallback').
     */
    readonly id: string;

    /**
     * Readable name of the provider.
     */
    readonly providerName: string;

    /**
     * The core generation method.
     * 
     * @param messages - The full history of the conversation in Standard format.
     * @param tools - (Optional) Array of tools in Google format (Providers map this internally).
     * @param options - Configuration for this specific turn (temperature, model tier, etc).
     * @returns A standardized response containing text and/or tool calls.
     */
    generate(
        messages: StandardMessage[], 
        tools?: Tool[], 
        options?: ProviderOptions
    ): Promise<StandardResponse>;

    /**
     * Validates if the provider is configured correctly (e.g., has API keys).
     * Used by ResilientAgent to skip providers that aren't set up.
     */
    validateConfig(): boolean;
}