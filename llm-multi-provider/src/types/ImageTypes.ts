export type ImageResolution = "512" | "1K" | "2K" | "4K" | string;

export type ImageAspectRatio =
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16"
  | "21:9"
  | "auto"
  | string;

export type ImageQuality = "auto" | "low" | "medium" | "high" | "xhigh" | "max" | string;
export type ImageOutputFormat = "png" | "jpeg" | "webp" | "svg";
export type ImageBackground = "auto" | "opaque" | "transparent";

export interface ImageInputReference {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export interface ImageProviderRouting {
  only?: string[];
  order?: string[];
  ignore?: string[];
  sort?: "price" | "throughput" | "latency" | Record<string, unknown>;
  allow_fallbacks?: boolean;
  options?: Record<string, Record<string, unknown>>;
}

export interface ImageGenerateOptions {
  model?: string;
  prompt: string;
  n?: number;
  resolution?: ImageResolution;
  aspect_ratio?: ImageAspectRatio;
  size?: string;
  quality?: ImageQuality;
  output_format?: ImageOutputFormat;
  background?: ImageBackground;
  output_compression?: number;
  seed?: number;
  stream?: boolean;
  user?: string;
  input_references?: Array<ImageInputReference | string>;
  provider?: ImageProviderRouting;
  headers?: Record<string, string>;
}

export interface ImageEditOptions extends Omit<ImageGenerateOptions, "input_references"> {
  images: Array<ImageInputReference | string>;
}

export interface GeneratedImageData {
  b64_json: string;
  media_type: string;
  dataUrl: string;
}

export interface StandardImageResponse {
  created?: number;
  images: GeneratedImageData[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  rawResponse?: unknown;
}