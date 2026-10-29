// packages/llm-multi-provider/src/types.ts
import type {
    CoreMemorySaveParams,
    SaveCodeToFileParams,
    SaveThoughtsParams,
    SendMessageParams
} from "./tools/tools";

export interface ToolFunctions {
    coreMemorySave: (args: CoreMemorySaveParams) => Promise<void>;
    saveCodeToFile: (args: SaveCodeToFileParams) => Promise<string[]>;
    saveThoughts: (args: SaveThoughtsParams) => Promise<void>;
    sendMessage: (args: SendMessageParams) => string;
}

export interface LogEntry {
    turn_id: string;
    action: string;
    content: any;
    timestamp: string;
}

export type ToolFunctionArgs<T extends keyof ToolFunctions> = Parameters<ToolFunctions[T]>[0];