import type { IDecisionProvider } from "../interfaces/IDecisionProvider";
import {
  type DecisionRequest,
  type DecisionResponse,
  normalizeDecisionQuestions,
} from "../types/DecisionTypes";
import { DEFAULT_DECISION_MODEL } from "../config/config";

export interface OpenRouterDecisionConfig {
  apiKey?: string;
  defaultModel?: string;
  siteUrl?: string;
  siteName?: string;
}

function getEnvApiKey(): string {
  try {
    if (typeof globalThis !== "undefined" && (globalThis as any).process?.env) {
      return (globalThis as any).process.env.OPENROUTER_API_KEY || "";
    }
  } catch {
    // Ignore restricted runtime lookup errors
  }
  return "";
}

export class OpenRouterDecisionProvider implements IDecisionProvider {
  readonly id = "openrouter-decisions";
  readonly providerName = "OpenRouter Decisions";

  private apiKey: string;
  private defaultModel: string;
  private baseUrl = "https://openrouter.ai/api/alpha/decisions";
  private siteUrl: string;
  private siteName: string;

  constructor(config?: OpenRouterDecisionConfig | string) {
    if (typeof config === "string") {
      this.apiKey = (config || "").trim();
      this.defaultModel = DEFAULT_DECISION_MODEL;
      this.siteUrl = "https://localhost:3000";
      this.siteName = "Nutria Decisions Engine";
    } else {
      this.apiKey = (config?.apiKey || getEnvApiKey()).trim();
      this.defaultModel = config?.defaultModel || DEFAULT_DECISION_MODEL;
      this.siteUrl = config?.siteUrl || "https://localhost:3000";
      this.siteName = config?.siteName || "Nutria Decisions Engine";
    }
  }

  public validateConfig(): boolean {
    return this.apiKey.length > 0;
  }

  public async evaluate(request: DecisionRequest): Promise<DecisionResponse> {
    if (!this.validateConfig()) {
      throw new Error(
        "OpenRouter Decisions Provider: OPENROUTER_API_KEY is not configured in .env or environment."
      );
    }

    const normalizedQuestions = normalizeDecisionQuestions(request.questions);

    const payload: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      state: request.state,
      questions: normalizedQuestions,
    };

    if (request.session_id) payload.session_id = request.session_id;
    if (request.user) payload.user = request.user;
    if (request.provider) payload.provider = request.provider;
    if (request.trace) payload.trace = request.trace;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": this.siteUrl,
      "X-Title": this.siteName,
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `OpenRouter Decisions API error (${response.status}): ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.error?.message) {
          errorMsg = `OpenRouter Decisions API: ${errorJson.error.message}`;
        }
      } catch {
        // Fall back to raw error text
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();

    return {
      id: data.id,
      model: data.model || request.model || this.defaultModel,
      provider: data.provider,
      answers: data.answers || {},
      usage: {
        cost: data.usage?.cost ?? 0,
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
      rawResponse: data,
    };
  }
}