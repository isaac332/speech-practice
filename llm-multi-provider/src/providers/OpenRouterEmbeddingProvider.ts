// packages/llm-multi-provider/src/providers/OpenRouterEmbeddingProvider.ts
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";

export class OpenRouterEmbeddingProvider implements IEmbeddingProvider {
  readonly id = "openrouter-embeddings";
  private baseUrl = "https://openrouter.ai/api/v1/embeddings";
  private apiKey: string;
  private model: string;
  private siteUrl: string;
  private siteName: string;

  constructor(
    apiKey: string,
    model: string = "sentence-transformers/all-minilm-l6-v2",
    siteUrl: string = "http://localhost",
    siteName: string = "LLM Multi-Provider Agent System"
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.siteUrl = siteUrl;
    this.siteName = siteName;
  }

  public async embedBatch(inputs: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API Key not provided to Embedding Provider instance.");
    }
    
    if (!inputs || inputs.length === 0) {
      return [];
    }

    const payload = {
      model: this.model,
      input: inputs, 
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenRouter Embedding Error (${response.status}): ${errText}`
      );
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid embedding response format from OpenRouter.");
    }

    const sortedEmbeddings = data.data.sort(
      (a: any, b: any) => a.index - b.index
    );
    
    return sortedEmbeddings.map((item: any) => item.embedding);
  }
}