import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
//  QUESTION DEFINITIONS (OpenRouter / TypeSafe JEV Specification)
// ═══════════════════════════════════════════════════════════════════════════

export type DecisionQuestionType = "noul" | "choice" | "score";

export interface DecisionNoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: Record<string, string>;
}

export interface DecisionChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria?: Record<string, string>;
  options?: string[];
}

export interface DecisionScoreQuestion {
  type: "score";
  instructions: string;
  criteria?: string[] | Record<string, string>;
  rubric?: string[];
}

export type DecisionQuestion =
  | DecisionNoulQuestion
  | DecisionChoiceQuestion
  | DecisionScoreQuestion;

export type DecisionQuestionsInput =
  | Record<string, DecisionQuestion | string | Record<string, unknown>>
  | Array<Record<string, unknown> & { id: string }>;

// ═══════════════════════════════════════════════════════════════════════════
//  ANSWER DEFINITIONS (Typed Probability Responses)
// ═══════════════════════════════════════════════════════════════════════════

export interface DecisionNoulAnswer {
  type: "noul";
  noul: number;
}

export interface DecisionChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface DecisionScoreAnswer {
  type: "score";
  score: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  legend?: Record<string, string>;
}

export type DecisionAnswer =
  | DecisionNoulAnswer
  | DecisionChoiceAnswer
  | DecisionScoreAnswer;

// ═══════════════════════════════════════════════════════════════════════════
//  REQUEST & RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const DecisionRequestSchema = z.object({
  model: z.string().optional().default("typesafe/jev-1.13"),
  state: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  questions: z.union([
    z.record(z.string(), z.any()),
    z.array(z.any()),
  ]),
  provider: z.record(z.string(), z.unknown()).optional(),
  session_id: z.string().optional(),
  user: z.string().optional(),
  trace: z.record(z.string(), z.unknown()).optional(),
});

export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

export interface DecisionResponse {
  id?: string;
  model: string;
  provider?: string;
  answers: Record<string, DecisionAnswer>;
  usage: {
    cost: number;
    input_tokens: number;
    output_tokens: number;
  };
  rawResponse?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BENCHMARK VERIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExpectedNoul {
  expectedBoolean: boolean;
  threshold?: number;
}

export interface ExpectedChoice {
  expectedOption: string | string[];
  minProbability?: number;
  maxConfidence?: number;
}

export interface ExpectedScore {
  minScore?: number;
  maxScore?: number;
  expectedIndex?: number;
}

export interface QuestionBenchmark {
  type: DecisionQuestionType;
  expectedNoul?: ExpectedNoul;
  expectedChoice?: ExpectedChoice;
  expectedScore?: ExpectedScore;
  rationale?: string;
}

export interface QuestionDiff {
  key: string;
  type: DecisionQuestionType;
  passed: boolean;
  actualSummary: string;
  expectedSummary: string;
  rationale?: string;
}

export interface BenchmarkReport {
  allPassed: boolean;
  passedCount: number;
  failedCount: number;
  total: number;
  accuracyPercentage: number;
  diffs: Record<string, QuestionDiff>;
}

export interface DecisionPreset {
  id: string;
  name: string;
  tag: string;
  difficulty: "Normal" | "Hard" | "Expert" | string;
  description: string;
  state: string;
  questions: Record<string, DecisionQuestion>;
  benchmark?: Record<string, QuestionBenchmark>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MULTI-RUN & VARIANCE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type StabilityGrade =
  | "rock_solid"
  | "stable"
  | "lucky_pass"
  | "flaky"
  | "consistent_fail";

export interface RunQuestionStats {
  noul?: number;
  choice?: string;
  topProbability?: number;
  score?: number;
  confidence?: number;
}

export interface RunResult {
  runIndex: number;
  model: string;
  answers: Record<string, DecisionAnswer>;
  report: BenchmarkReport | null;
  questionStats: Record<string, RunQuestionStats>;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

export interface VarianceStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface QuestionVariance {
  key: string;
  type: DecisionQuestionType;
  passCount: number;
  totalRuns: number;
  stability: StabilityGrade;
  noul?: VarianceStat;
  score?: VarianceStat;
  topProbability?: VarianceStat;
  confidence?: VarianceStat;
  choiceDistribution?: Record<string, number>;
}

export interface MultiRunReport {
  model: string;
  presetId: string | null;
  runCount: number;
  validRuns: number;
  errorRuns: number;
  allRunsFullyPassed: boolean;
  overallPassRate: number;
  totalCost: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  perQuestion: Record<string, QuestionVariance>;
  runs: RunResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  QUESTION NORMALIZATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

export function normalizeDecisionQuestions(
  questions: DecisionQuestionsInput
): Record<string, Record<string, unknown>> {
  if (Array.isArray(questions)) {
    const record: Record<string, Record<string, unknown>> = {};
    for (const q of questions) {
      const id = q.id || `q_${Math.random().toString(36).slice(2, 9)}`;
      const { id: _, ...rest } = q;
      record[id] = rest;
    }
    return record;
  }

  const normalized: Record<string, Record<string, unknown>> = {};

  for (const [key, val] of Object.entries(questions)) {
    if (typeof val === "string") {
      normalized[key] = {
        type: "noul",
        instructions: val,
        criteria: { true: "Affirmative / Yes", false: "Negative / No" },
      };
      continue;
    }

    if (val && typeof val === "object") {
      const copy: Record<string, unknown> = { ...val };

      if (!copy.type) {
        if ("options" in copy && Array.isArray(copy.options)) {
          copy.type = "choice";
        } else if ("rubric" in copy && Array.isArray(copy.rubric)) {
          copy.type = "score";
        } else {
          copy.type = "noul";
        }
      }

      if (copy.type === "choice" && copy.options && Array.isArray(copy.options) && !copy.criteria) {
        const criteriaObj: Record<string, string> = {};
        for (const opt of copy.options) {
          criteriaObj[String(opt)] = String(opt);
        }
        copy.criteria = criteriaObj;
      }

      if (copy.type === "score" && copy.rubric && Array.isArray(copy.rubric) && !copy.criteria) {
        copy.criteria = copy.rubric;
      }

      if (copy.prompt && !copy.instructions) {
        copy.instructions = copy.prompt;
      }

      normalized[key] = copy;
    }
  }

  return normalized;
}