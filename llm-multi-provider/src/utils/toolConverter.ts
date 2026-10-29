// src/utils/toolConverter.ts
import { type FunctionDeclaration, Type } from "@google/genai";

export function convertGeminiToolsToOpenAI(geminiTools: any[]): any[] {
    const functions = geminiTools.flatMap(t => t.functionDeclarations || []);

    return functions.map((fn: FunctionDeclaration) => ({
        type: 'function',
        function: {
            name: fn.name || 'unnamed_function',
            description: fn.description || '',
            parameters: cleanSchema(fn.parameters)
        }
    }));
}

function cleanSchema(schema: any): any {
    if (!schema) return undefined;

    const newSchema: any = { ...schema };

    if (newSchema.type) {
        newSchema.type = mapGoogleTypeToJsonType(newSchema.type);
    }

    if (newSchema.properties) {
        const props: any = {};
        for (const [key, val] of Object.entries(newSchema.properties)) {
            props[key] = cleanSchema(val);
        }
        newSchema.properties = props;
    }

    if (newSchema.items) {
        newSchema.items = cleanSchema(newSchema.items);
    }

    return newSchema;
}

function mapGoogleTypeToJsonType(type: any): string {
    if (type === Type.STRING || type === "STRING") return "string";
    if (type === Type.NUMBER || type === "NUMBER" || type === "INTEGER") return "number"; 
    if (type === Type.BOOLEAN || type === "BOOLEAN") return "boolean";
    if (type === Type.ARRAY || type === "ARRAY") return "array";
    if (type === Type.OBJECT || type === "OBJECT") return "object";
    return "string";
}