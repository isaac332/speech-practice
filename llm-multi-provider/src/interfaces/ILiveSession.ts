import type {
  LiveSessionConfig,
  LiveAudioChunk,
  LiveTextChunk,
  LiveThoughtChunk,
  LiveTranscriptionChunk,
  LiveToolCallEvent,
  LiveToolResponseEvent,
  LiveResumptionUpdateEvent,
  LiveGoAwayEvent,
  LiveTurnCompleteEvent,
  LiveFunctionResponse,
  LiveSessionEvents,
} from "../types/LiveTypes";
import type { LiveServerMessage } from "@google/genai";

/**
 * Standard contract for Realtime / Live bidirectional streaming sessions.
 */
export interface ILiveSession {
  /** Whether the underlying WebSocket connection is open and active */
  readonly isConnected: boolean;
  /** Active session ID assigned by the server */
  readonly sessionId?: string;
  /** Latest resumption handle for reconnecting within 2 hours */
  readonly lastResumptionHandle?: string;
  /** Whether the current session state is resumable */
  readonly isResumable: boolean;

  /**
   * Establishes the live connection with the server.
   */
  connect(): Promise<void>;

  /**
   * Terminates the live connection.
   */
  close(): Promise<void>;

  /**
   * Sends text content into the session.
   *
   * @param text - The text prompt
   * @param turnComplete - Whether to immediately trigger model generation (default: true)
   */
  sendText(text: string, turnComplete?: boolean): void;

  /**
   * Streams a realtime PCM audio chunk (16kHz 16-bit little-endian mono).
   *
   * @param pcmData - Raw PCM bytes (Uint8Array, ArrayBuffer, Int16Array, Buffer) or base64 string
   * @param mimeType - Audio mime type (default: 'audio/pcm;rate=16000')
   */
  sendRealtimeAudio(
    pcmData: Uint8Array | ArrayBuffer | Int16Array | Buffer | string,
    mimeType?: string
  ): void;

  /**
   * Streams a realtime video or image frame.
   *
   * @param frameData - Image bytes or base64 string
   * @param mimeType - Image mime type (default: 'image/jpeg')
   */
  sendRealtimeVideo(
    frameData: Uint8Array | ArrayBuffer | Buffer | string,
    mimeType?: string
  ): void;

  /**
   * Notifies the server that the audio stream has ended (e.g., microphone muted).
   */
  sendAudioStreamEnd(): void;

  /**
   * Explicitly signals the start of user voice activity.
   */
  sendActivityStart(): void;

  /**
   * Explicitly signals the end of user voice activity.
   */
  sendActivityEnd(): void;

  /**
   * Sends tool/function execution responses back to the model.
   *
   * @param functionResponses - Single response or list of responses
   */
  sendToolResponse(
    functionResponses: LiveFunctionResponse | LiveFunctionResponse[]
  ): void;

  /**
   * Reconnects to the session, optionally restoring context via session resumption handle.
   *
   * @param handle - Resumption handle (defaults to the latest handle captured)
   */
  reconnect(handle?: string): Promise<void>;

  /**
   * Attaches an event listener.
   */
  on<K extends keyof LiveSessionEvents>(event: K, listener: LiveSessionEvents[K]): this;

  /**
   * Attaches a one-time event listener.
   */
  once<K extends keyof LiveSessionEvents>(event: K, listener: LiveSessionEvents[K]): this;

  /**
   * Removes an event listener.
   */
  off<K extends keyof LiveSessionEvents>(event: K, listener: LiveSessionEvents[K]): this;
}
