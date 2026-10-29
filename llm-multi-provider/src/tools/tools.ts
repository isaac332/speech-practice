// packages/core/src/Agents/tools/tools.ts

async function getNodeModules() {
  if (typeof window !== "undefined") {
    throw new Error("File system operations are not supported in the browser.");
  }
  const dynamicImport = new Function("m", "return import(m)");
  const fs = await dynamicImport("node:fs/promises");
  const path = await dynamicImport("node:path");
  return { fs, path };
}

export interface CoreMemorySaveParams {
    memoryName: string;
    memoryUpdates: {
        section: 'human' | 'agent';
        key: string;
        memoryText: string;
    }[];
}

export interface SaveCodeToFileParams {
    filenames: string[];
    codes: string[];
}

export interface SaveThoughtsParams {
    thoughts: string;
}

export interface SendMessageParams {
    text: string;
}

interface ToolResult {
    success: boolean;
    message: string;
    details?: any;
}

interface SaveCodeResult {
    results: Array<{
        filename: string;
        success: boolean;
        message: string;
    }>;
}

// Stub for saveThoughts since it was in interface but not implemented in Deno snapshot
export async function saveThoughts(params: SaveThoughtsParams): Promise<void> {
    console.log("Thoughts saved:", params.thoughts);
}

export async function coreMemorySave(params: CoreMemorySaveParams): Promise<ToolResult> {
    if (!params || typeof params.memoryName !== 'string' || !Array.isArray(params.memoryUpdates)) {
        const errorMsg = "Internal Error: Invalid parameters structure received by coreMemorySave function.";
        console.error(errorMsg, params);
        return { success: false, message: errorMsg, details: { receivedParams: params } };
    }

    const { memoryName, memoryUpdates } = params;
    const { fs, path } = await getNodeModules();

    const baseDir = path.join(process.cwd(), 'agentOutput', 'memoryFiles');
    const memoryFile = path.join(baseDir, `${memoryName}.json`);
    console.log(`Attempting to save memory to: ${memoryFile}`);

    try {
        await fs.mkdir(baseDir, { recursive: true });

        let agentMemory: { human: { [key: string]: string }; agent: { [key: string]: string } } = { human: {}, agent: {} };

        try {
            const data = await fs.readFile(memoryFile, 'utf8');
            agentMemory = JSON.parse(data);
            console.log(`Loaded existing memory from ${memoryFile}`);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.log(`Creating new memory file: ${memoryFile}`);
                agentMemory = { human: {}, agent: {} };
            } else {
                 console.error(`Error reading memory file ${memoryFile}:`, err);
                return { success: false, message: `Error reading memory file: ${err.message}`, details: err };
            }
        }

        for (const update of memoryUpdates) {
            const { section, key, memoryText } = update;

            if (typeof section !== 'string' || (section !== 'human' && section !== 'agent')) {
                console.warn(`Warning: Invalid or missing 'section' ('${section}') in coreMemorySave update for key '${key}'. Skipping. Input must match interface.`);
                continue;
            }
            if (typeof key !== 'string' || !key) {
                 console.warn(`Warning: Invalid or missing 'key' ('${key}') in coreMemorySave update. Skipping. Input must match interface.`);
                 continue;
            }
             if (typeof memoryText !== 'string') {
                console.warn(`Warning: Invalid or missing 'memoryText' (type: ${typeof memoryText}) in coreMemorySave update for key '${key}'. Skipping. Input must match interface.`);
                continue;
            }

            if (!agentMemory[section]) {
                console.log(`Initializing section '${section}' in memory.`);
                agentMemory[section] = {};
            }
            console.log(`Updating memory section '${section}', key '${key}'`);
            agentMemory[section][key] = memoryText;
        }

        await fs.writeFile(memoryFile, JSON.stringify(agentMemory, null, 4), 'utf8');
        const successMsg = `Memory saved successfully to ${memoryFile}`;
        console.log(successMsg);
        return { success: true, message: successMsg };

    } catch (err: any) {
        const errorMsg = `Error during memory save operation for ${memoryFile}`;
        console.error(errorMsg, err);
        return { success: false, message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`, details: err };
    }
}

export async function saveCodeToFile(params: SaveCodeToFileParams): Promise<SaveCodeResult> {
     if (!params || !Array.isArray(params.filenames) || !Array.isArray(params.codes) || params.filenames.length !== params.codes.length) {
        const errorMsg = "Internal Error: Invalid parameters structure received by saveCodeToFile function (check keys 'filenames', 'codes', and array lengths).";
        console.error(errorMsg, params);
        return { results: [{ filename: 'parameter_validation', success: false, message: errorMsg }] };
    }

    const { filenames, codes } = params;
    const { fs, path } = await getNodeModules();
    const baseDir = path.join(process.cwd(), 'agentOutput', 'generatedCodeFiles');
    const results: SaveCodeResult["results"] = [];

    for (let i = 0; i < filenames.length; i++) {
        const originalFilename = filenames[i];
        const code = codes[i];

        if (originalFilename === undefined || code === undefined) {
            continue; // Should be caught by validation above, but strict mode safety
        }

        let sanitizedFilename = 'invalid_filename';

        if (typeof originalFilename !== 'string' || !originalFilename || typeof code !== 'string') {
             const errorMsg = `Invalid entry at index ${i}: Filename must be a non-empty string, code must be a string.`;
             console.warn(errorMsg, { filename: originalFilename, code });
             results.push({ filename: originalFilename || `index_${i}_invalid`, success: false, message: errorMsg });
             continue;
        }

        sanitizedFilename = path.basename(originalFilename);
        if (sanitizedFilename !== originalFilename) {
             console.warn(`Original filename "${originalFilename}" sanitized to "${sanitizedFilename}" to prevent path traversal.`);
        }
        if (!sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename === '..') {
             const errorMsg = `Invalid filename after sanitization at index ${i}: "${originalFilename}" resulted in an empty or unsafe name.`;
             console.warn(errorMsg);
             results.push({ filename: originalFilename, success: false, message: errorMsg });
             continue;
        }

        const filepath = path.join(baseDir, sanitizedFilename);
        console.log(`Attempting to save code to: ${filepath} (Original: ${originalFilename})`);

        try {
            await fs.mkdir(path.dirname(filepath), { recursive: true });
            await fs.writeFile(filepath, code, 'utf8');
            const successMsg = `Code saved successfully to ${filepath}`;
            console.log(successMsg);
            results.push({ filename: originalFilename, success: true, message: successMsg });
        } catch (err: any) {
            const errorMsg = `Error saving code to ${filepath}`;
            console.error(errorMsg, err);
            results.push({ filename: originalFilename, success: false, message: `${errorMsg}: ${err.message}` });
        }
    }
    return { results };
}

export function sendMessage(params: SendMessageParams): string {
    if (!params || typeof params !== 'object' || !params.hasOwnProperty('text') || typeof params.text !== 'string') {
        const errorMsg = `Internal Error: Invalid parameters received by sendMessage. Expected { text: string }. Received: ${JSON.stringify(params)}`;
        console.warn(errorMsg);
        return `(System Error: Invalid input to sendMessage tool. ${errorMsg})`;
    }
    const { text } = params;
    console.log(`sendMessage called with text: "${text}"`);
    return text;
}
