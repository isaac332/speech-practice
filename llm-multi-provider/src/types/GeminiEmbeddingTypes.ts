// src/types/GeminiEmbeddingTypes.ts

export type GeminiEmbeddingModel = "gemini-embedding-2" | "gemini-embedding-001" | string;

export interface GeminiEmbeddingOptions {
  /**
   * The model to use. Defaults to 'gemini-embedding-2'.
   */
  model?: GeminiEmbeddingModel;

  /**
   * Reduces the size of the embedding vector. Recommended: 768, 1536, or 3072.
   */
  outputDimensionality?: number;

  /**
   * Specifies the task type for embeddings.
   * - For `gemini-embedding-001`: Passed directly to the API config (e.g., 'SEMANTIC_SIMILARITY').
   * - For `gemini-embedding-2`: Used to automatically prepend query formatting if `autoFormatV2Tasks` is true.
   */
  taskType?: string;

  /**
   * If true and using `gemini-embedding-2`, the provider will automatically format 
   * the input string based on the `taskType` (e.g., `task: {taskType} | query: {input}`).
   * Default is false (assumes you pre-formatted the strings).
   */
  autoFormatV2Tasks?: boolean;

  /**
   * Controls the max concurrency of requests for `gemini-embedding-2` to prevent API rate limit issues
   * when processing large batches, as v2 requires discrete calls for non-aggregated embeddings.
   * Default: 10
   */
  batchConcurrency?: number;
}