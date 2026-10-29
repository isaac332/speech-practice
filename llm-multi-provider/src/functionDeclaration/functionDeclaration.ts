// src/functionDeclaration/functionDeclaration.ts
import { type FunctionDeclaration, type Tool } from "@google/genai";

/**
 * A map of function implementations passed into the agent.
 */
export interface ToolFunctionsMap {
  [key: string]: (args: unknown) => Promise<unknown> | unknown;
}

/**
 * Helper to wrap raw function declarations into the Tool format expected by providers.
 */
export function createToolbox(
  functionDeclarations: FunctionDeclaration[],
): Tool {
  return {
    functionDeclarations: functionDeclarations,
  };
}