// packages/llm-multi-provider/src/ChatAgent.ts
import type { Tool, Schema } from "@google/genai";

import {
  AgentConfig,
  DEFAULT_TEMPERATURE,
  type ModelTier,
} from "./config/config";

import type { ToolFunctionsMap } from "./functionDeclaration/functionDeclaration";
import type { ILLMProvider } from "./interfaces/ILLMProvider";
import type {
  StandardMessage,
  StandardToolCall,
  LogEntry,
  StandardContentPart,
  ReasoningConfig,
  ServiceTier,
  ProviderRoutingConfig
} from "./types/StandardizedTypes";

export interface SendMessageOptions {
  temperature?: number;
  modelTier?: ModelTier;
  model?: string;
  serviceTier?: ServiceTier;
  service_tier?: ServiceTier;
  providerRouting?: ProviderRoutingConfig;
  provider?: ProviderRoutingConfig;
  reasoning?: ReasoningConfig;
  headers?: Record<string, string>;
  anthropicBeta?: string | string[];
  responseSchema?: Schema; // <-- ADD THIS
  schemaName?: string;     // <-- ADD THIS
}

export interface GenerateOnceOptions extends SendMessageOptions {
  systemInstruction?: string;
  enableTools?: boolean;
  responseSchema?: Schema;
  schemaName?: string;
}

export class ChatAgent {
  private provider: ILLMProvider;
  private history: StandardMessage[] = [];
  private messageCounter: number = 0;
  private activityLog: LogEntry[] = [];
  private agentTools?: Tool[];
  private availableFunctions: ToolFunctionsMap;
  private defaultTemperature: number;
  private defaultSystemInstruction?: string;
  private toolsEnabled: boolean = false;
  private defaultServiceTier?: ServiceTier;
  private defaultProviderRouting?: ProviderRoutingConfig;

  constructor(
    provider: ILLMProvider,
    availableFunctionsInput?: ToolFunctionsMap,
    temperature: number = DEFAULT_TEMPERATURE,
    agentTools?: Tool[],
    systemInstructionInput?: string,
  ) {
    this.provider = provider;
    this.defaultTemperature = temperature;
    this.agentTools = agentTools;
    this.availableFunctions = availableFunctionsInput || {};
    this.defaultSystemInstruction = systemInstructionInput;

    if (this.defaultSystemInstruction) {
      this.history.push({
        role: "system",
        content: this.defaultSystemInstruction,
      });
    }

    if (
      agentTools &&
      agentTools.length > 0 &&
      Object.keys(this.availableFunctions).length === 0
    ) {
      console.warn("Agent initialized with tool declarations but no function implementations were provided.");
    }

    console.log(`ChatAgent initialized.`);
    console.log(`- Provider: ${this.provider.providerName} (${this.provider.id})`);
    console.log(`- Default Temperature: ${this.defaultTemperature}`);

    if (this.agentTools && this.agentTools.length > 0) {
      console.log(`Agent Tools Loaded (Count: ${this.agentTools.length}). Status: DISABLED by default.`);
    }
  }

  public setToolsEnabled(enabled: boolean): void {
    this.toolsEnabled = enabled;
    console.log(`Agent tools have been ${enabled ? "ENABLED" : "DISABLED"}.`);
  }

  /**
   * One-line agent-level configuration of Service Tier (e.g. 'flex', 'priority', 'fast')
   */
  public setServiceTier(tier?: ServiceTier): void {
    this.defaultServiceTier = tier;
    console.log(`Agent default Service Tier set to: ${tier || "default"}`);
  }

  public getServiceTier(): ServiceTier | undefined {
    return this.defaultServiceTier;
  }

  /**
   * One-line agent-level configuration of OpenRouter Provider Routing
   */
  public setProviderRouting(routing?: ProviderRoutingConfig): void {
    this.defaultProviderRouting = routing;
    console.log(`Agent default Provider Routing updated.`);
  }

  public getProviderRouting(): ProviderRoutingConfig | undefined {
    return this.defaultProviderRouting;
  }

  public async sendMessage(
    userMessage: string | StandardContentPart[],
    options?: SendMessageOptions,
  ): Promise<string> {
    const turnId = crypto.randomUUID();
    this.messageCounter++;

    this.history.push({ role: "user", content: userMessage });
    await this.logActivity(turnId, "user_message_chat", { message: userMessage, options });
    
    // Friendly logging for arrays
    const loggableMessage = Array.isArray(userMessage) 
        ? userMessage.map((p: StandardContentPart) => p.type === 'text' ? p.text : '[Image]').join(' ') 
        : userMessage;

    console.log(`\n--- Chat Turn ${this.messageCounter} (ID: ${turnId}) ---`);
    console.log(`User: ${loggableMessage}`);

    const toolsToUse = this.toolsEnabled ? this.agentTools : undefined;

    const requestOptions = {
      temperature: options?.temperature ?? this.defaultTemperature,
      modelTier: options?.modelTier || "main",
      model: options?.model,
      serviceTier: options?.serviceTier || options?.service_tier || this.defaultServiceTier,
      providerRouting: options?.providerRouting || options?.provider || this.defaultProviderRouting,
      reasoning: options?.reasoning,
      headers: options?.headers,
      anthropicBeta: options?.anthropicBeta,
      responseSchema: options?.responseSchema,
      schemaName: options?.schemaName,
    };

    try {
      const response = await this.provider.generate(this.history, toolsToUse, requestOptions);

      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`Model requested tool calls: ${response.toolCalls.map((t: StandardToolCall) => t.name).join(", ")}`);

        this.history.push({
          role: "model",
          content: response.text || "",
          reasoning: response.reasoning,               
          reasoningDetails: response.reasoningDetails,
          toolCalls: response.toolCalls,
        });

        const executionResults = await this.executeFunctions(turnId, response.toolCalls, "chat");

        for (const exec of executionResults) {
          this.history.push({
            role: "function",
            functionResponse: {
              name: exec.functionName,
              id: exec.callId,
              response: { content: exec.result },
            },
          });
        }

        console.log(`Sending function results back to model...`);

        const followUpResponse = await this.provider.generate(this.history, toolsToUse, requestOptions);

        const finalContent = followUpResponse.text || "";
        this.history.push({
          role: "model",
          content: finalContent,
          reasoning: followUpResponse.reasoning,               
          reasoningDetails: followUpResponse.reasoningDetails, 
        });

        await this.logActivity(turnId, "final_agent_response_chat", finalContent);
        console.log(`Agent: ${finalContent}`);
        return finalContent;
      }

      const content = response.text || "";
      this.history.push({
        role: "model",
        content: content,
        reasoning: response.reasoning,
        reasoningDetails: response.reasoningDetails,
      });

      await this.logActivity(turnId, "final_agent_response_chat", content);
      console.log(`Agent: ${content}`);
      return content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error during chat sendMessage:", error);
      await this.logActivity(turnId, "error_chat", { message });
      return `Error processing chat message: ${message}`;
    }
  }

  public async generateContentOnce(
    userPrompt: string | StandardContentPart[],
    options?: GenerateOnceOptions,
  ): Promise<string> {
    const requestId = crypto.randomUUID();
    const MAX_TOOL_TURNS = 5;
    let toolTurnCounter = 0;

    await this.logActivity(requestId, "user_prompt_generate_once", {
      prompt: userPrompt,
      options,
    });
    console.log(`\n--- Generate Once Request (ID: ${requestId}) ---`);

    const toolsToUse = options?.enableTools ? this.agentTools : undefined;

    try {
      const tempHistory: StandardMessage[] = [];

      const sysInstruction = options?.systemInstruction || this.defaultSystemInstruction;
      if (sysInstruction) {
        tempHistory.push({ role: "system", content: sysInstruction });
      }

      tempHistory.push({ role: "user", content: userPrompt });

      while (toolTurnCounter < MAX_TOOL_TURNS) {
        toolTurnCounter++;
        console.log(`Generation turn ${toolTurnCounter}`);

        const response = await this.provider.generate(tempHistory, toolsToUse, {
          temperature: options?.temperature ?? this.defaultTemperature,
          modelTier: options?.modelTier || "main",
          model: options?.model,
          responseSchema: options?.responseSchema,
          schemaName: options?.schemaName,
          reasoning: options?.reasoning,
          serviceTier: options?.serviceTier || options?.service_tier || this.defaultServiceTier,
          providerRouting: options?.providerRouting || options?.provider || this.defaultProviderRouting,
          headers: options?.headers,
          anthropicBeta: options?.anthropicBeta,
        });

        if (response.toolCalls && response.toolCalls.length > 0) {
          tempHistory.push({
            role: "model",
            content: response.text || "",
            toolCalls: response.toolCalls,
          });

          const executionResults = await this.executeFunctions(requestId, response.toolCalls, "generate");

          for (const exec of executionResults) {
            tempHistory.push({
              role: "function",
              functionResponse: {
                name: exec.functionName,
                id: exec.callId,
                response: { content: exec.result },
              },
            });
          }
          continue;
        }

        const finalText = response.text || "";
        await this.logActivity(requestId, "final_response_generate_once", finalText);
        console.log(`Agent (Generate Once): ${finalText}`);
        return finalText;
      }

      return "Error: Max tool turns exceeded.";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error during generateContentOnce:", error);
      return `Error: ${message}`;
    }
  }

  private async executeFunctions(
    turnOrRequestId: string,
    toolCalls: StandardToolCall[],
    context: "chat" | "generate",
  ): Promise<{ functionName: string; result: unknown; callId?: string }[]> {
    const results: { functionName: string; result: unknown; callId?: string }[] = [];
    const logActionPrefix = `execute_function_${context}`;

    for (const toolCall of toolCalls) {
      const functionName = toolCall.name;
      const rawArgs = toolCall.args;
      const callId = toolCall.id;

      console.log(`Executing function: ${functionName} (ID: ${callId || "N/A"})`);
      await this.logActivity(turnOrRequestId, `${logActionPrefix}_start`, {
        function_name: functionName,
        raw_args: rawArgs,
      });

      const func = this.availableFunctions[functionName];

      if (typeof func === "function") {
        let finalArgs: unknown;
        try {
          let potentialArgs = rawArgs;
          if (typeof potentialArgs === "object" && potentialArgs !== null) {
            const potentialObj = potentialArgs as Record<string, unknown>;
            if ("params" in potentialObj && Object.keys(potentialObj).length === 1) {
              potentialArgs = potentialObj.params;
            }
          }

          if (typeof potentialArgs === "string") {
            try {
              finalArgs = JSON.parse(potentialArgs);
            } catch {
              const argsString = potentialArgs;
              const correctedJsonString = argsString
                .replace(/'/g, '"')
                .replace(
                  /(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                  '$1"$3":',
                );
              finalArgs = JSON.parse(correctedJsonString);
            }
          } else {
            finalArgs = potentialArgs;
          }

          const executionResult = await func(finalArgs);
          const serializableResult = executionResult !== undefined ? structuredClone(executionResult) : null;

          results.push({
            functionName,
            result: serializableResult,
            callId,
          });

          await this.logActivity(
            turnOrRequestId,
            `${logActionPrefix}_success`,
            { function_name: functionName, result: serializableResult },
          );
        } catch (executionError: unknown) {
          const errorMessage = `Error executing '${functionName}': ${
            executionError instanceof Error ? executionError.message : String(executionError)
          }`;
          results.push({ functionName, result: { error: errorMessage }, callId });
          await this.logActivity(turnOrRequestId, `${logActionPrefix}_error`, { error: errorMessage });
        }
      } else {
        const errorMessage = `Function '${functionName}' not found.`;
        results.push({ functionName, result: { error: errorMessage }, callId });
      }
    }
    return results;
  }

  private async logActivity(turnOrRequestId: string, action: string, content: unknown): Promise<void> {
    const logEntry: LogEntry = {
      turn_id: turnOrRequestId,
      action: action,
      content: content !== undefined ? structuredClone(content) : null,
      timestamp: new Date().toISOString(),
    };
    this.activityLog.push(logEntry);

    if (AgentConfig.logCallback) {
      try {
        await AgentConfig.logCallback(logEntry);
      } catch (error: unknown) {
        console.error("AgentConfig.logCallback failed:", error);
      }
    }
  }

  public getMessageCount(): number { return this.messageCounter; }
  public getActivityLog(): LogEntry[] { return [...this.activityLog]; }
  public async getChatHistory(): Promise<StandardMessage[]> { return this.history; }

  public loadHistory(messages: StandardMessage[]): void {
    const systemMsg = this.history.find((m) => m.role === 'system');
    const valid = messages.filter((m) => m.role !== 'system');
    this.history = systemMsg ? [systemMsg, ...valid] : [...valid];
  }
}