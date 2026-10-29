// src/interfaces/IEmbeddingProvider.ts

/**
 * The Contract: Any text embedding provider must implement this interface.
 * This guarantees that consuming applications can swap out embedding models 
 * (e.g., local, OpenAI, OpenRouter) seamlessly.
 */
export interface IEmbeddingProvider {
  /**
   * Unique identifier for logging (e.g., 'openrouter-embeddings').
   */
  readonly id: string;

  /**
   * Generates embeddings for an array of text inputs.
   * * @param inputs - Array of strings to embed.
   * @returns A promise that resolves to an array of numerical vectors matching the input order.
   */
  embedBatch(inputs: string[]): Promise<number[][]>;
}