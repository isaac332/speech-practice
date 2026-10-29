// src/utils/ToolMapper.ts

import { type Tool, type FunctionDeclaration, type Schema, Type } from "@google/genai";

export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters: Record<string, any>;
        strict?: boolean;
    };
}

export class ToolMapper {
    static mapToOpenAI(googleTools: Tool[]): OpenAITool[] {
        const openAITools: OpenAITool[] = [];

        for (const tool of googleTools) {
            if ('functionDeclarations' in tool && tool.functionDeclarations) {
                for (const decl of tool.functionDeclarations) {
                    openAITools.push(this.convertDeclaration(decl));
                }
            }
        }

        return openAITools;
    }

    private static convertDeclaration(decl: FunctionDeclaration): OpenAITool {
        return {
            type: 'function',
            function: {
                name: decl.name || 'unnamed_function', 
                description: decl.description || '',
                parameters: decl.parameters ? this.convertSchema(decl.parameters as Schema) : { type: 'object', properties: {} },
            }
        };
    }

    private static convertSchema(schema: Schema): Record<string, any> {
        const jsonSchema: Record<string, any> = {};
        const s = schema as any;

        if (s.type) {
            jsonSchema.type = this.mapTypeToString(s.type);
        }

        if (s.properties) {
            jsonSchema.properties = {};
            for (const [key, propSchema] of Object.entries(s.properties)) {
                jsonSchema.properties[key] = this.convertSchema(propSchema as Schema);
            }
        }

        if (s.items) {
            jsonSchema.items = this.convertSchema(s.items as Schema);
        }

        if (s.description) jsonSchema.description = s.description;
        if (s.required) jsonSchema.required = s.required;
        if (s.enum) jsonSchema.enum = s.enum;
        
        return jsonSchema;
    }

    private static mapTypeToString(type: Type | string): string {
        const t = String(type).toUpperCase();
        switch (t) {
            case 'STRING': return 'string';
            case 'NUMBER': return 'number';
            case 'INTEGER': return 'integer';
            case 'BOOLEAN': return 'boolean';
            case 'ARRAY': return 'array';
            case 'OBJECT': return 'object';
            default: return 'string';
        }
    }
}