import { Modality } from "@google/genai";
import { GeminiLiveSession } from "./GeminiLiveSession";
import { DEFAULT_GEMINI_TRANSCRIBE_MODEL } from "../config/config";
import type {
  LiveTranscriptionConfig,
  LiveTranscriptionChunk,
} from "../types/LiveTypes";

/**
 * Dedicated, low-latency live speech-to-text transcriber using the Gemini Live API
 * (specifically optimized for `gemini-3.5-transcribe-live`).
 */
export class GeminiLiveTranscriber {
  private session: GeminiLiveSession;
  private transcriptBuffer: string[] = [];

  constructor(apiKey?: string, config?: LiveTranscriptionConfig) {
    const transcriptionConfig = config || {};

    this.session = new GeminiLiveSession(apiKey, {
      model: transcriptionConfig.model || DEFAULT_GEMINI_TRANSCRIBE_MODEL,
      apiKey: transcriptionConfig.apiKey,
      responseModalities: [Modality.TEXT],
      inputAudioTranscription: {
        languageCodes: transcriptionConfig.languageCodes,
      },
      systemInstruction: transcriptionConfig.systemInstruction,
      sessionResumption: transcriptionConfig.sessionResumption,
      contextWindowCompression: transcriptionConfig.contextWindowCompression,
    });

    // Capture input transcriptions
    this.session.on("inputTranscription", (chunk: LiveTranscriptionChunk) => {
      if (chunk.text) {
        this.transcriptBuffer.push(chunk.text);
      }
    });

    // Some models also emit transcription text via standard modelTurn text parts
    this.session.on("text", (chunk) => {
      if (chunk.text) {
        this.transcriptBuffer.push(chunk.text);
      }
    });
  }

  get isConnected(): boolean {
    return this.session.isConnected;
  }

  get liveSession(): GeminiLiveSession {
    return this.session;
  }

  /**
   * Connects to the real-time transcription service.
   */
  public async connect(): Promise<void> {
    await this.session.connect();
  }

  /**
   * Closes the transcription session.
   */
  public async close(): Promise<void> {
    await this.session.close();
  }

  /**
   * Streams a realtime PCM audio chunk (16kHz 16-bit little-endian mono) for live transcription.
   */
  public sendAudioChunk(
    pcmData: Uint8Array | ArrayBuffer | Int16Array | Buffer | string
  ): void {
    this.session.sendRealtimeAudio(pcmData, "audio/pcm;rate=16000");
  }

  /**
   * Signals that the audio stream has ended.
   */
  public sendAudioStreamEnd(): void {
    this.session.sendAudioStreamEnd();
  }

  /**
   * Registers a callback for real-time transcribed text.
   */
  public onTranscript(
    callback: (text: string, isFinished: boolean) => void
  ): this {
    this.session.on("inputTranscription", (chunk) => {
      callback(chunk.text, chunk.finished);
    });
    this.session.on("text", (chunk) => {
      callback(chunk.text, false);
    });
    return this;
  }

  /**
   * Registers an error handler.
   */
  public onError(callback: (err: Error) => void): this {
    this.session.on("error", callback);
    return this;
  }

  /**
   * Registers an interruption handler.
   */
  public onInterrupted(callback: () => void): this {
    this.session.on("interrupted", callback);
    return this;
  }

  /**
   * Returns all accumulated transcribed text to date.
   */
  public getFullTranscript(): string {
    return this.transcriptBuffer.join(" ").trim();
  }

  /**
   * Clears the internal accumulated transcript buffer.
   */
  public clearTranscript(): void {
    this.transcriptBuffer = [];
  }
}
