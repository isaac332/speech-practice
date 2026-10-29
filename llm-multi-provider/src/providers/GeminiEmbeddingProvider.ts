// packages/llm-multi-provider/src/providers/GeminiEmbeddingProvider.ts
import { GoogleGenAI } from "@google/genai";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";
import type { GeminiEmbeddingOptions } from "../types/GeminiEmbeddingTypes";
import { GeminiTaskFormatter } from "../utils/GeminiTaskFormatter";
import { DEFAULT_GEMINI_EMBEDDING_V2 } from "../config/config";

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  readonly id = "gemini-embeddings";
  
  private ai: GoogleGenAI;
  private options: GeminiEmbeddingOptions;
  private modelName: string;

  constructor(apiKey: string, options?: GeminiEmbeddingOptions) {
    if (!apiKey) console.warn("GeminiEmbeddingProvider initialized without a valid API key.");
    
    this.ai = new GoogleGenAI({ apiKey: apiKey || "" });
    this.options = options || {};
    this.modelName = this.options.model || DEFAULT_GEMINI_EMBEDDING_V2;
  }

  public async embedBatch(inputs: string[]): Promise<number[][]> {
    if (!inputs || inputs.length === 0) return [];

    const isV2 = this.modelName.includes("embedding-2");

    if (isV2) {
      return this.processV2Batch(inputs);
    } else {
      return this.processV1Batch(inputs);
    }
  }

  private async processV2Batch(inputs: string[]): Promise<number[][]> {
    const concurrencyLimit = this.options.batchConcurrency || 10;
    const results: number[][] = [];

    for (let i = 0; i < inputs.length; i += concurrencyLimit) {
      const chunk = inputs.slice(i, i + concurrencyLimit);
      
      const chunkPromises = chunk.map(async (input) => {
        let formattedInput = input;

        if (this.options.autoFormatV2Tasks && this.options.taskType) {
          formattedInput = GeminiTaskFormatter.formatQuery(input, this.options.taskType);
        }

        const config: any = {};
        if (this.options.outputDimensionality) {
          config.outputDimensionality = this.options.outputDimensionality;
        }

        const response = await this.ai.models.embedContent({
          model: this.modelName,
          contents: formattedInput,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        if (!response.embeddings || response.embeddings.length === 0) {
          throw new Error("Gemini API returned no embeddings for the provided input.");
        }

        const values = response.embeddings[0].values;
        if (!values) {
          throw new Error("Gemini API returned an embedding, but the values array was undefined.");
        }

        return values;
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  private async processV1Batch(inputs: string[]): Promise<number[][]> {
    const config: any = {};
    
    if (this.options.taskType) {
      config.taskType = this.options.taskType;
    }
    
    if (this.options.outputDimensionality) {
      config.outputDimensionality = this.options.outputDimensionality;
    }

    const response = await this.ai.models.embedContent({
      model: this.modelName,
      contents: inputs,
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    if (!response.embeddings) {
      throw new Error("Gemini API returned no embeddings for the V1 batch request.");
    }

    let embeddings: number[][] = response.embeddings.map((e) => {
      if (!e.values) {
         throw new Error("Gemini API returned an embedding with undefined values in V1 batch.");
      }
      return e.values;
    });

    if (this.options.outputDimensionality && this.options.outputDimensionality < 3072) {
      embeddings = embeddings.map((vec) => this.normalizeVector(vec));
    }

    return embeddings;
  }

  private normalizeVector(vec: number[]): number[] {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sum);
    if (norm === 0) return vec;
    return vec.map((val) => val / norm);
  }
}