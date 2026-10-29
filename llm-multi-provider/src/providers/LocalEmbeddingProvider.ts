import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";

export class LocalEmbeddingProvider implements IEmbeddingProvider {
  readonly id = "local-huggingface-embeddings";
  private modelName: string;
  
  private extractorPromise: Promise<any> | null = null;

  constructor(modelName: string = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2') {
    this.modelName = modelName;
  }

  private async getExtractor() {
    if (!this.extractorPromise) {
      try {
        const dynamicImport = new Function("moduleSpecifier", "return import(moduleSpecifier)");
        const { pipeline } = await dynamicImport("@huggingface/transformers");
        this.extractorPromise = pipeline("feature-extraction", this.modelName);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `LocalEmbeddingProvider requires '@huggingface/transformers'. Install it or switch to Gemini/OpenRouter embedding providers. (${message})`
        );
      }
    }
    return this.extractorPromise;
  }

  public async embedBatch(inputs: string[]): Promise<number[][]> {
    if (!inputs || inputs.length === 0) {
      return [];
    }

    const extractor = await this.getExtractor();
    const embeddings = await extractor(inputs, { pooling: 'mean', normalize: true });
    
    const results: number[][] = [];
    const batchSize = inputs.length;

    if (embeddings.dims && embeddings.dims.length === 2) {
      const embeddingDim = embeddings.dims[1];
      for (let i = 0; i < batchSize; i++) {
        const start = i * embeddingDim;
        const end = start + embeddingDim;
        results.push(Array.from(embeddings.data.slice(start, end)));
      }
    } else if (embeddings[0] && embeddings[0].data) {
      for (let i = 0; i < batchSize; i++) {
        results.push(Array.from(embeddings[i].data));
      }
    } else {
      results.push(Array.from(embeddings.data));
    }

    return results;
  }
}