import {
  GoogleGenAI,
  Modality,
  type Session,
  type LiveServerMessage,
  type Content,
  type Part,
  type Tool,
} from "@google/genai";
import { TypedEventEmitter } from "../utils/TypedEventEmitter";
import { AudioUtils } from "../utils/AudioUtils";
import { resolveUnifiedReasoning } from "../utils/ReasoningMapper";
import {
  DEFAULT_GEMINI_LIVE_MODEL,
  safetySettings as defaultSafetySettings,
} from "../config/config";
import type { ILiveSession } from "../interfaces/ILiveSession";
import type {
  LiveSessionConfig,
  LiveSessionEvents,
  LiveFunctionResponse,
  LiveAudioChunk,
  LiveTextChunk,
  LiveThoughtChunk,
  LiveTranscriptionChunk,
  LiveToolCallEvent,
  LiveResumptionUpdateEvent,
  LiveGoAwayEvent,
  LiveTurnCompleteEvent,
} from "../types/LiveTypes";
import type { ToolFunctionsMap } from "../functionDeclaration/functionDeclaration";
import type { StandardToolCall } from "../types/StandardizedTypes";

export class GeminiLiveSession
  extends TypedEventEmitter<LiveSessionEvents>
  implements ILiveSession
{
  private ai: GoogleGenAI;
  private session?: Session;
  private config: LiveSessionConfig;
  private _isConnected: boolean = false;
  private _sessionId?: string;
  private _lastResumptionHandle?: string;
  private _lastConsumedIndex?: string;
  private _isResumable: boolean = false;
  private isIntentionalClose: boolean = false;
  private reconnectAttempts: number = 0;
  private toolFunctions: ToolFunctionsMap;
  private autoExecuteTools: boolean;

  constructor(apiKey?: string, config?: LiveSessionConfig, existingAi?: GoogleGenAI) {
    super();
    this.config = config || {};

    const resolvedApiKey =
      this.config.apiKey ||
      apiKey ||
      (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") ||
      "";

    this.ai = existingAi || new GoogleGenAI({ apiKey: resolvedApiKey });
    this.toolFunctions = this.config.toolFunctions || {};
    this.autoExecuteTools =
      this.config.autoExecuteTools ?? (Object.keys(this.toolFunctions).length > 0);

    if (this.config.sessionResumption?.handle) {
      this._lastResumptionHandle = this.config.sessionResumption.handle;
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get lastResumptionHandle(): string | undefined {
    return this._lastResumptionHandle;
  }

  get isResumable(): boolean {
    return this._isResumable;
  }

  /**
   * Sets or updates the tool functions map for automated execution.
   */
  public setToolFunctions(toolFunctions: ToolFunctionsMap): void {
    this.toolFunctions = toolFunctions;
    this.autoExecuteTools = Object.keys(toolFunctions).length > 0;
  }

  /**
   * Connects to the Gemini Live WebSocket service.
   */
  public async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    this.isIntentionalClose = false;
    const modelName = this.config.model || DEFAULT_GEMINI_LIVE_MODEL;

    // Resolve modalities
    const modalities: Modality[] = (this.config.responseModalities || ["AUDIO"]).map((m) => {
      if (typeof m === "string") {
        const upper = m.toUpperCase();
        if (upper === "TEXT") return Modality.TEXT;
        if (upper === "AUDIO") return Modality.AUDIO;
        if (upper === "IMAGE") return Modality.IMAGE;
        if (upper === "VIDEO") return Modality.VIDEO;
      }
      return m as Modality;
    });

    // Resolve speech config
    let speechConfig: Record<string, unknown> | undefined = undefined;
    if (this.config.speechConfig?.voiceName || this.config.speechConfig?.languageCode) {
      speechConfig = {};
      if (this.config.speechConfig?.voiceName) {
        speechConfig.voiceConfig = {
          prebuiltVoiceConfig: {
            voiceName: this.config.speechConfig.voiceName,
          },
        };
      }
      if (this.config.speechConfig?.languageCode) {
        speechConfig.languageCode = this.config.speechConfig.languageCode;
      }
    }

    // Resolve thinking config
    let thinkingConfig: Record<string, unknown> | undefined = undefined;
    if (this.config.reasoning) {
      const resolved = resolveUnifiedReasoning(this.config.reasoning);
      if (resolved.effort === "none" || resolved.budgetTokens === 0 || !resolved.enabled) {
        thinkingConfig = { thinkingBudget: 0 };
      } else {
        thinkingConfig = {
          thinkingBudget: resolved.budgetTokens,
          includeThoughts: true,
        };
      }
    } else if (this.config.thinkingConfig) {
      thinkingConfig = {
        thinkingBudget: this.config.thinkingConfig.thinkingBudget,
        includeThoughts: this.config.thinkingConfig.includeThoughts ?? true,
      };
      if (this.config.thinkingConfig.thinkingLevel) {
        thinkingConfig.thinkingLevel = this.config.thinkingConfig.thinkingLevel;
      }
    }

    // Resolve session resumption
    let sessionResumption: Record<string, unknown> | undefined = undefined;
    if (this.config.sessionResumption || this._lastResumptionHandle) {
      const resumptionObj: Record<string, unknown> = {};
      const handle = this._lastResumptionHandle || this.config.sessionResumption?.handle;
      if (handle) {
        resumptionObj.handle = handle;
      }
      // Note: "transparent" is rejected by the Gemini API (Google AI Studio).
      // Only pass if explicitly requested (e.g. Vertex AI).
      if (this.config.sessionResumption?.transparent === true) {
        resumptionObj.transparent = true;
      }
      sessionResumption = resumptionObj;
    }

    // Resolve context window compression
    let contextWindowCompression: Record<string, unknown> | undefined = undefined;
    if (this.config.contextWindowCompression) {
      contextWindowCompression = {};
      if (this.config.contextWindowCompression.triggerTokens !== undefined) {
        contextWindowCompression.triggerTokens = String(
          this.config.contextWindowCompression.triggerTokens
        );
      }
      if (this.config.contextWindowCompression.slidingWindowTargetTokens !== undefined) {
        contextWindowCompression.slidingWindow = {
          targetTokens: String(
            this.config.contextWindowCompression.slidingWindowTargetTokens
          ),
        };
      }
    }

    // Resolve audio transcriptions
    let inputAudioTranscription: Record<string, unknown> | undefined = undefined;
    if (this.config.inputAudioTranscription) {
      inputAudioTranscription = {};
      if (
        this.config.inputAudioTranscription.languageCodes &&
        this.config.inputAudioTranscription.languageCodes.length > 0
      ) {
        inputAudioTranscription.languageCodes =
          this.config.inputAudioTranscription.languageCodes;
      }
    }

    let outputAudioTranscription: Record<string, unknown> | undefined = undefined;
    if (this.config.outputAudioTranscription) {
      outputAudioTranscription = {};
      if (
        this.config.outputAudioTranscription.languageCodes &&
        this.config.outputAudioTranscription.languageCodes.length > 0
      ) {
        outputAudioTranscription.languageCodes =
          this.config.outputAudioTranscription.languageCodes;
      }
    }

    // Build LiveConnectConfig
    const liveConnectConfig: Record<string, unknown> = {
      responseModalities: modalities,
    };

    // Note: Do not pass default safetySettings to Gemini Live API; the server rejects
    // 'safetySettings' in the setup payload with "Unknown name 'safetySettings' at 'setup'".
    if (this.config.safetySettings && this.config.safetySettings.length > 0) {
      liveConnectConfig.safetySettings = this.config.safetySettings;
    }

    if (speechConfig) liveConnectConfig.speechConfig = speechConfig;
    if (thinkingConfig) liveConnectConfig.thinkingConfig = thinkingConfig;
    if (sessionResumption) liveConnectConfig.sessionResumption = sessionResumption;
    if (contextWindowCompression)
      liveConnectConfig.contextWindowCompression = contextWindowCompression;
    if (inputAudioTranscription)
      liveConnectConfig.inputAudioTranscription = inputAudioTranscription;
    if (outputAudioTranscription)
      liveConnectConfig.outputAudioTranscription = outputAudioTranscription;
    if (this.config.temperature !== undefined)
      liveConnectConfig.temperature = this.config.temperature;
    if (this.config.topP !== undefined) liveConnectConfig.topP = this.config.topP;
    if (this.config.topK !== undefined) liveConnectConfig.topK = this.config.topK;
    if (this.config.maxOutputTokens !== undefined)
      liveConnectConfig.maxOutputTokens = this.config.maxOutputTokens;
    if (this.config.enableAffectiveDialog !== undefined)
      liveConnectConfig.enableAffectiveDialog = this.config.enableAffectiveDialog;
    if (this.config.proactivity) liveConnectConfig.proactivity = this.config.proactivity;
    if (this.config.systemInstruction) {
      liveConnectConfig.systemInstruction = this.config.systemInstruction;
    }
    if (this.config.tools && this.config.tools.length > 0) {
      liveConnectConfig.tools = this.config.tools;
    }

    try {
      this.session = await this.ai.live.connect({
        model: modelName,
        config: liveConnectConfig as any,
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLiveSession] WebSocket connected for model "${modelName}".`);
            this._isConnected = true;
            this.reconnectAttempts = 0;
            this.emit("open");
          },
          onmessage: (e: LiveServerMessage) => {
            console.log("[GeminiLiveSession] Server message:", e);
            this.handleServerMessage(e);
          },
          onerror: (err: any) => {
            console.error("[GeminiLiveSession] WebSocket error event:", err);
            const errorObj = err instanceof Error ? err : new Error(String(err?.message || err));
            this.emit("error", errorObj);
          },
          onclose: (e: any) => {
            console.warn(`[GeminiLiveSession] WebSocket closed. Code: ${e?.code}, Reason: "${e?.reason || "none"}"`);
            this._isConnected = false;
            const code = e?.code;
            const reason = e?.reason;
            this.emit("close", code, reason);

            if (!this.isIntentionalClose) {
              this.handleUnexpectedClose();
            }
          },
        },
      });

      this._isConnected = true;
    } catch (err: unknown) {
      this._isConnected = false;
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.emit("error", errorObj);
      throw errorObj;
    }
  }

  /**
   * Closes the live connection.
   */
  public async close(): Promise<void> {
    this.isIntentionalClose = true;
    if (this.session) {
      try {
        this.session.close();
      } catch (err) {
        console.warn("Error while closing Live session:", err);
      }
      this.session = undefined;
    }
    this._isConnected = false;
  }

  /**
   * Alias for close().
   */
  public async disconnect(): Promise<void> {
    return this.close();
  }

  /**
   * Sends text content into the session.
   */
  public sendText(text: string, turnComplete: boolean = true): void {
    this.ensureConnected();
    this.session!.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      turnComplete,
    });
  }

  /**
   * Streams a realtime PCM audio chunk into the session.
   */
  public sendRealtimeAudio(
    pcmData: Uint8Array | ArrayBuffer | Int16Array | Buffer | string,
    mimeType: string = "audio/pcm;rate=16000"
  ): void {
    this.ensureConnected();
    const base64Data =
      typeof pcmData === "string" ? pcmData : AudioUtils.pcm16ToBase64(pcmData);

    this.session!.sendRealtimeInput({
      audio: {
        mimeType,
        data: base64Data,
      },
    });
  }

  /**
   * Streams a realtime video frame into the session.
   */
  public sendRealtimeVideo(
    frameData: Uint8Array | ArrayBuffer | Buffer | string,
    mimeType: string = "image/jpeg"
  ): void {
    this.ensureConnected();
    const base64Data =
      typeof frameData === "string" ? frameData : AudioUtils.pcm16ToBase64(frameData);

    this.session!.sendRealtimeInput({
      media: {
        mimeType,
        data: base64Data,
      },
    });
  }

  /**
   * Signals that the audio stream has ended (e.g. microphone muted).
   */
  public sendAudioStreamEnd(): void {
    this.ensureConnected();
    this.session!.sendRealtimeInput({ audioStreamEnd: true });
  }

  /**
   * Signals the start of user voice activity (Manual VAD).
   */
  public sendActivityStart(): void {
    this.ensureConnected();
    this.session!.sendRealtimeInput({ activityStart: {} });
  }

  /**
   * Signals the end of user voice activity (Manual VAD).
   */
  public sendActivityEnd(): void {
    this.ensureConnected();
    this.session!.sendRealtimeInput({ activityEnd: {} });
  }

  /**
   * Sends tool/function execution responses back to the model.
   */
  public sendToolResponse(
    functionResponses: LiveFunctionResponse | LiveFunctionResponse[]
  ): void {
    this.ensureConnected();
    const list = Array.isArray(functionResponses) ? functionResponses : [functionResponses];
    const formatted = list.map((item) => ({
      id: item.id,
      name: item.name,
      response:
        typeof item.response === "object" && item.response !== null
          ? item.response
          : { result: item.response },
    }));

    this.session!.sendToolResponse({ functionResponses: formatted });
    this.emit("toolResponse", { responses: list });
  }

  /**
   * Reconnects to the session, optionally restoring context via session resumption handle.
   */
  public async reconnect(handle?: string): Promise<void> {
    if (handle) {
      this._lastResumptionHandle = handle;
    }
    await this.close();
    await this.connect();
  }

  private handleServerMessage(msg: LiveServerMessage): void {
    this.emit("message", msg);

    // Setup Complete
    if (msg.setupComplete) {
      this._sessionId = msg.setupComplete.sessionId;
    }

    // Session Resumption Updates
    if (msg.sessionResumptionUpdate) {
      const update = msg.sessionResumptionUpdate;
      if (update.newHandle) {
        this._lastResumptionHandle = update.newHandle;
      }
      if (update.lastConsumedClientMessageIndex) {
        this._lastConsumedIndex = update.lastConsumedClientMessageIndex;
      }
      this._isResumable = !!update.resumable;

      const event: LiveResumptionUpdateEvent = {
        handle: update.newHandle,
        resumable: update.resumable,
        lastConsumedClientMessageIndex: update.lastConsumedClientMessageIndex,
      };
      this.emit("resumptionUpdate", event);
    }

    // GoAway Warning (Connection terminating soon)
    if (msg.goAway) {
      const event: LiveGoAwayEvent = {
        timeLeft: msg.goAway.timeLeft,
      };
      this.emit("goAway", event);
    }

    // Server Content
    if (msg.serverContent) {
      const content = msg.serverContent;

      // Interruption signal (barge-in): Client must discard buffered audio!
      if (content.interrupted) {
        this.emit("interrupted");
      }

      // Input audio transcription (transcribing user's voice)
      if (content.inputTranscription && content.inputTranscription.text) {
        const transChunk: LiveTranscriptionChunk = {
          text: content.inputTranscription.text,
          finished: !!content.inputTranscription.finished,
          source: "user",
        };
        this.emit("inputTranscription", transChunk);
      }

      // Output audio transcription (transcribing model's speech)
      if (content.outputTranscription && content.outputTranscription.text) {
        const transChunk: LiveTranscriptionChunk = {
          text: content.outputTranscription.text,
          finished: !!content.outputTranscription.finished,
          source: "model",
        };
        this.emit("outputTranscription", transChunk);
      }

      // Model Content Parts (Audio, Text, Thoughts)
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          // Thinking in Live API
          if (part.thought) {
            const thoughtChunk: LiveThoughtChunk = {
              text: part.text || "",
              thoughtSignature: part.thoughtSignature,
            };
            this.emit("thought", thoughtChunk);
          } else if (part.text) {
            // Standard text token
            const textChunk: LiveTextChunk = {
              text: part.text,
            };
            this.emit("text", textChunk);
          }

          // Realtime synthesized audio
          if (part.inlineData && part.inlineData.data) {
            const audioData = AudioUtils.base64ToUint8Array(part.inlineData.data);
            const audioChunk: LiveAudioChunk = {
              data: audioData,
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
            };
            this.emit("audio", audioChunk);
          }
        }
      }

      // Waiting for input signal
      if (content.waitingForInput) {
        this.emit("waitingForInput");
      }

      // Turn Complete
      if (content.turnComplete) {
        const turnEvent: LiveTurnCompleteEvent = {
          interrupted: !!content.interrupted,
          generationComplete: !!content.generationComplete,
        };
        this.emit("turnComplete", turnEvent);
      }

      // Generation Complete
      if (content.generationComplete) {
        this.emit("generationComplete");
      }
    }

    // Tool Calls
    if (msg.toolCall && msg.toolCall.functionCalls) {
      const calls: StandardToolCall[] = msg.toolCall.functionCalls.map((fc) => ({
        id: fc.id,
        name: fc.name || "unknown_tool",
        args: fc.args || {},
      }));

      const toolEvent: LiveToolCallEvent = {
        calls,
        rawMessage: msg,
      };
      this.emit("toolCall", toolEvent);

      if (this.autoExecuteTools && Object.keys(this.toolFunctions).length > 0) {
        void this.executeToolCalls(calls);
      }
    }

    // Tool Call Cancellations
    if (msg.toolCallCancellation && msg.toolCallCancellation.ids) {
      this.emit("toolCallCancellation", msg.toolCallCancellation.ids);
    }
  }

  private async executeToolCalls(calls: StandardToolCall[]): Promise<void> {
    const responses: LiveFunctionResponse[] = [];

    for (const call of calls) {
      const fn = this.toolFunctions[call.name];
      if (fn) {
        try {
          const result = await fn((call.args as Record<string, unknown>) || {});
          const formatted =
            typeof result === "object" && result !== null
              ? (result as Record<string, unknown>)
              : { result };

          responses.push({
            id: call.id,
            name: call.name,
            response: formatted,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          responses.push({
            id: call.id,
            name: call.name,
            response: { error: errMsg },
          });
        }
      } else {
        console.warn(`[GeminiLiveSession] No implementation found for tool "${call.name}".`);
        responses.push({
          id: call.id,
          name: call.name,
          response: { error: `Tool ${call.name} not implemented on client.` },
        });
      }
    }

    if (responses.length > 0 && this._isConnected) {
      try {
        this.sendToolResponse(responses);
      } catch (err) {
        console.error("[GeminiLiveSession] Error sending automated tool responses:", err);
      }
    }
  }

  private handleUnexpectedClose(): void {
    const autoReconnect =
      this.config.sessionResumption?.autoReconnect ?? (!!this._lastResumptionHandle);
    const maxAttempts = this.config.sessionResumption?.maxReconnectAttempts ?? 3;
    const delay = this.config.sessionResumption?.reconnectDelayMs ?? 1000;

    if (autoReconnect && this.reconnectAttempts < maxAttempts) {
      this.reconnectAttempts++;
      console.log(
        `[GeminiLiveSession] Connection lost. Attempting auto-resumption (${this.reconnectAttempts}/${maxAttempts}) in ${delay}ms...`
      );

      setTimeout(() => {
        if (!this.isIntentionalClose && !this._isConnected) {
          this.reconnect(this._lastResumptionHandle).catch((err) => {
            console.error("[GeminiLiveSession] Auto-reconnection failed:", err);
          });
        }
      }, delay);
    }
  }

  private ensureConnected(): void {
    if (!this._isConnected || !this.session) {
      throw new Error(
        "GeminiLiveSession is not connected. Call await session.connect() first."
      );
    }
  }
}
