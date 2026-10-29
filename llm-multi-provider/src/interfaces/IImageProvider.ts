import type {
  ImageGenerateOptions,
  ImageEditOptions,
  StandardImageResponse,
} from "../types/ImageTypes";

export interface IImageProvider {
  readonly id: string;
  readonly providerName: string;
  generate(options: ImageGenerateOptions): Promise<StandardImageResponse>;
  edit(options: ImageEditOptions): Promise<StandardImageResponse>;
  validateConfig(): boolean;
  listModels?(): Promise<any>;
}