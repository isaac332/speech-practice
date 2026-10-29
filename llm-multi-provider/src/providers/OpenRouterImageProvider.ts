import type { IImageProvider } from "../interfaces/IImageProvider";
import type {
  ImageGenerateOptions,
  ImageEditOptions,
  StandardImageResponse,
  GeneratedImageData,
} from "../types/ImageTypes";

export const DEFAULT_IMAGE_MODEL = "openai/gpt-image-1";

export interface OpenRouterImageConfig {
  apiKey?: string;
  defaultModel?: string;
  siteUrl?: string;
  siteName?: string;
}

function getEnvApiKey(): string {
  try {
    if (typeof globalThis !== "undefined" && (globalThis as any).process?.env) {
      return (globalThis as any).process.env.OPENROUTER_API_KEY || "";
    }
  } catch {
    // Ignore restricted lookup
  }
  return "";
}

export class OpenRouterImageProvider implements IImageProvider {
  readonly id = "openrouter-images";
  readonly providerName = "OpenRouter Image Provider";

  private apiKey: string;
  private defaultModel: string;
  private baseUrl = "https://openrouter.ai/api/v1/images";
  private siteUrl: string;
  private siteName: string;

  constructor(config?: OpenRouterImageConfig | string) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.defaultModel = DEFAULT_IMAGE_MODEL;
      this.siteUrl = "http://localhost:3000";
      this.siteName = "Nutria Image Studio";
    } else {
      this.apiKey = config?.apiKey || getEnvApiKey();
      this.defaultModel = config?.defaultModel || DEFAULT_IMAGE_MODEL;
      this.siteUrl = config?.siteUrl || "http://localhost:3000";
      this.siteName = config?.siteName || "Nutria Image Studio";
    }
  }

  public validateConfig(): boolean {
    return this.apiKey.trim().length > 0;
  }

  public async generate(options: ImageGenerateOptions): Promise<StandardImageResponse> {
    if (!this.validateConfig()) {
      throw new Error("OpenRouterImageProvider: OPENROUTER_API_KEY is not configured.");
    }

    const payload = this.buildPayload(options);

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
        ...(options.headers || {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter Image API error (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return this.normalize(json);
  }

  public async edit(options: ImageEditOptions): Promise<StandardImageResponse> {
    const input_references = options.images.map((img) => {
      if (typeof img === "string") {
        return { type: "image_url" as const, image_url: { url: img } };
      }
      return img;
    });

    return this.generate({
      ...options,
      input_references,
    });
  }

  public async listModels(): Promise<any> {
    const res = await fetch("https://openrouter.ai/api/v1/images/models", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to list image models: ${await res.text()}`);
    return await res.json();
  }

  private buildPayload(options: ImageGenerateOptions): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      prompt: options.prompt,
    };

    if (options.n !== undefined) payload.n = options.n;
    if (options.resolution) payload.resolution = options.resolution;
    if (options.aspect_ratio) payload.aspect_ratio = options.aspect_ratio;
    if (options.size) payload.size = options.size;
    if (options.quality) payload.quality = options.quality;
    if (options.output_format) payload.output_format = options.output_format;
    if (options.background) payload.background = options.background;
    if (options.output_compression !== undefined) payload.output_compression = options.output_compression;
    if (options.seed !== undefined) payload.seed = options.seed;
    if (options.user) payload.user = options.user;
    if (options.provider) payload.provider = options.provider;

    if (options.input_references && options.input_references.length > 0) {
      payload.input_references = options.input_references.map((ref) => {
        if (typeof ref === "string") {
          return { type: "image_url", image_url: { url: ref } };
        }
        return ref;
      });
    }

    return payload;
  }

  private normalize(raw: any): StandardImageResponse {
    const images: GeneratedImageData[] = (raw.data || []).map((item: any) => {
      const mediaType = item.media_type || "image/png";
      const b64 = item.b64_json || "";
      return {
        b64_json: b64,
        media_type: mediaType,
        dataUrl: `data:${mediaType};base64,${b64}`,
      };
    });

    return {
      created: raw.created,
      images,
      usage: raw.usage
        ? {
            promptTokens: raw.usage.prompt_tokens || 0,
            completionTokens: raw.usage.completion_tokens || 0,
            totalTokens: raw.usage.total_tokens || 0,
            cost: raw.usage.cost,
          }
        : undefined,
      rawResponse: raw,
    };
  }
}