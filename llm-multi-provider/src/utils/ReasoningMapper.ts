import type { ReasoningConfig, ReasoningEffort } from "../types/StandardizedTypes";

export const EFFORT_TO_BUDGET_MAP: Record<ReasoningEffort, number> = {
  max: 32768,
  xhigh: 24576,
  high: 16384,
  medium: 8192,
  low: 2048,
  minimal: 1024,
  none: 0,
};

export function effortToBudget(effort?: ReasoningEffort | string): number {
  if (!effort) return 32768;
  const key = effort.toLowerCase() as ReasoningEffort;
  return EFFORT_TO_BUDGET_MAP[key] ?? 32768;
}

export function budgetToEffort(budget: number): ReasoningEffort {
  if (budget <= 0) return "none";
  if (budget <= 1500) return "minimal";
  if (budget <= 3500) return "low";
  if (budget <= 12000) return "medium";
  if (budget <= 20000) return "high";
  if (budget <= 28000) return "xhigh";
  return "max";
}

export function effortToGeminiThinkingLevel(
  effort: ReasoningEffort | string
): "minimal" | "low" | "medium" | "high" | undefined {
  const key = (effort || "").toLowerCase();
  switch (key) {
    case "max":
    case "xhigh":
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "minimal":
      return "minimal";
    case "none":
    default:
      return undefined;
  }
}

export interface ResolvedReasoning {
  effort: ReasoningEffort;
  budgetTokens: number;
  geminiThinkingLevel?: "minimal" | "low" | "medium" | "high";
  exclude: boolean;
  enabled: boolean;
}

export function resolveUnifiedReasoning(config?: ReasoningConfig): ResolvedReasoning {
  if (!config) {
    return {
      effort: "max",
      budgetTokens: 32768,
      geminiThinkingLevel: "high",
      exclude: false,
      enabled: true,
    };
  }

  const exclude = config.exclude ?? false;

  if (
    config.effort === "none" ||
    (config.maxTokens !== undefined && config.maxTokens <= 0) ||
    config.enabled === false
  ) {
    return {
      effort: "none",
      budgetTokens: 0,
      geminiThinkingLevel: undefined,
      exclude,
      enabled: false,
    };
  }

  if (config.effort) {
    const effort = config.effort;
    const budgetTokens =
      config.maxTokens !== undefined && config.maxTokens > 0
        ? config.maxTokens
        : effortToBudget(effort);
    const geminiThinkingLevel = effortToGeminiThinkingLevel(effort);

    return {
      effort,
      budgetTokens,
      geminiThinkingLevel,
      exclude,
      enabled: true,
    };
  }

  if (config.maxTokens !== undefined && config.maxTokens > 0) {
    const budgetTokens = config.maxTokens;
    const effort = budgetToEffort(budgetTokens);
    const geminiThinkingLevel = effortToGeminiThinkingLevel(effort);

    return {
      effort,
      budgetTokens,
      geminiThinkingLevel,
      exclude,
      enabled: true,
    };
  }

  return {
    effort: "max",
    budgetTokens: 32768,
    geminiThinkingLevel: "high",
    exclude,
    enabled: true,
  };
}