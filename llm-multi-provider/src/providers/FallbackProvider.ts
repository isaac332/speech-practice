// packages/llm-multi-provider/src/providers/FallbackProvider.ts
import type { Tool } from "@google/genai";
import type { ILLMProvider } from "../interfaces/ILLMProvider";
import type { StandardMessage, StandardResponse, ProviderOptions } from "../types/StandardizedTypes";

export interface FallbackProviderOptions {
  onFallback?: (error: unknown, primary: ILLMProvider, fallback: ILLMProvider) => void;
}

export class FallbackProvider implements ILLMProvider {
  readonly id: string;
  readonly providerName: string;

  constructor(
    public readonly primary: ILLMProvider,
    public readonly fallback: ILLMProvider,
    private readonly options?: FallbackProviderOptions
  ) {
    this.id = `${primary.id}-resilient`;
    this.providerName = `${primary.providerName} (with ${fallback.providerName} fallback)`;
  }

  public validateConfig(): boolean {
    return this.primary.validateConfig() || this.fallback.validateConfig();
  }

  public async generate(
    messages: StandardMessage[],
    tools?: Tool[],
    options?: ProviderOptions
  ): Promise<StandardResponse> {
    // 1. Attempt Primary Provider if configured
    if (this.primary.validateConfig()) {
      try {
        return await this.primary.generate(messages, tools, options);
      } catch (primaryError: unknown) {
        const errorMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        console.warn(
          `[FallbackProvider] Primary provider "${this.primary.providerName}" (${this.primary.id}) failed: ${errorMsg}`
        );

        // Check if fallback is configured
        if (!this.fallback.validateConfig()) {
          console.error(
            `[FallbackProvider] Fallback provider "${this.fallback.providerName}" is not configured. Re-throwing primary error.`
          );
          throw primaryError;
        }

        console.warn(
          `[FallbackProvider] Automatically falling back to "${this.fallback.providerName}" (${this.fallback.id}) using its default set model...`
        );

        if (this.options?.onFallback) {
          try {
            this.options.onFallback(primaryError, this.primary, this.fallback);
          } catch (callbackErr) {
            console.error("[FallbackProvider] onFallback callback error:", callbackErr);
          }
        }

        // Strip primary-specific model string so fallback provider automatically uses its own configured default model for that tier
        const fallbackOptions: ProviderOptions = {
          ...options,
          model: undefined,
        };

        try {
          return await this.fallback.generate(messages, tools, fallbackOptions);
        } catch (fallbackError: unknown) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.error(
            `[FallbackProvider] Fallback provider "${this.fallback.providerName}" also failed: ${fallbackMsg}`
          );
          throw new Error(
            `[FallbackProvider] Both primary (${this.primary.providerName}: ${errorMsg}) and fallback (${this.fallback.providerName}: ${fallbackMsg}) failed.`
          );
        }
      }
    }

    // 2. If primary is unconfigured, seamlessly route to fallback
    if (this.fallback.validateConfig()) {
      console.warn(
        `[FallbackProvider] Primary provider "${this.primary.providerName}" is not configured. Routing directly to fallback "${this.fallback.providerName}" using its default set model...`
      );
      const fallbackOptions: ProviderOptions = {
        ...options,
        model: undefined,
      };
      return await this.fallback.generate(messages, tools, fallbackOptions);
    }

    throw new Error(
      `[FallbackProvider] Neither primary provider (${this.primary.providerName}) nor fallback provider (${this.fallback.providerName}) has a valid configuration.`
    );
  }
}