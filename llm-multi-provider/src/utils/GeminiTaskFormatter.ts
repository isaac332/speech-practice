// src/utils/GeminiTaskFormatter.ts

/**
 * Utility to format strings correctly for `gemini-embedding-2`.
 * Gemini Embedding 2 no longer uses the API config for task types. 
 * Instead, tasks must be explicitly prepended to the content.
 */
export class GeminiTaskFormatter {
  /**
   * Asymmetric Retrieval: Formats a query looking for a document.
   * @param query The user's search query.
   * @param task Default: 'search result'. Others: 'question answering', 'fact checking', 'code retrieval'.
   */
  static formatQuery(query: string, task: string = "search result"): string {
    return `task: ${task} | query: ${query}`;
  }

  /**
   * Asymmetric Retrieval: Formats the target document being retrieved.
   * @param content The body of the document.
   * @param title The document title. If none exists, pass undefined and it will use 'none'.
   */
  static formatDocument(content: string, title?: string): string {
    const safeTitle = title && title.trim() !== "" ? title : "none";
    return `title: ${safeTitle} | text: ${content}`;
  }

  /**
   * Symmetric Formats: For classification, clustering, or semantic similarity.
   * Query and Document should use the exact same formatting task.
   * @param content The text to embed.
   * @param task e.g., 'classification', 'clustering', 'sentence similarity'.
   */
  static formatSymmetric(content: string, task: string = "classification"): string {
    return `task: ${task} | query: ${content}`;
  }
}