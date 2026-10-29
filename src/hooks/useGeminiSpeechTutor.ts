"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  GeminiLiveSession,
  type GeminiLiveVoice,
  GEMINI_LIVE_VOICES,
  type LiveAudioChunk,
  type LiveTranscriptionChunk,
  type LiveThoughtChunk,
} from "@llm-multi-provider/core/live";
import { AudioRecorder } from "../lib/audio/AudioRecorder";
import { AudioPlayer } from "../lib/audio/AudioPlayer";
import { TUTOR_PERSONAS } from "../lib/tutor/tutorPrompts";

export type TutorStatus = "disconnected" | "connecting" | "connected" | "error";
export type TutorState = "idle" | "listening" | "thinking" | "speaking";

export interface MessageTurn {
  id: string;
  role: "user" | "tutor";
  text: string;
  timestamp: number;
  interrupted?: boolean;
}

export interface DebugLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ConnectOverrides {
  apiKey?: string;
  model?: string;
  personaId?: string;
  voice?: GeminiLiveVoice;
  enableThinking?: boolean;
  customInstructions?: string;
  forceReconnect?: boolean;
}

export interface UseGeminiSpeechTutorOptions {
  initialPersonaId?: string;
  initialVoice?: GeminiLiveVoice;
  apiKey?: string;
  model?: string;
}

export function useGeminiSpeechTutor(options?: UseGeminiSpeechTutorOptions) {
  const optionApiKey = options?.apiKey;
  const optionModel = options?.model;

  const [status, setStatus] = useState<TutorStatus>("disconnected");
  const [tutorState, setTutorState] = useState<TutorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConnectedModel, setActiveConnectedModel] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>(
    optionModel || process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL || "gemini-3.8-live"
  );
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    options?.initialPersonaId || "casual"
  );
  const [selectedVoice, setSelectedVoice] = useState<GeminiLiveVoice>(
    options?.initialVoice || GEMINI_LIVE_VOICES.AOEDE
  );
  const [enableThinking, setEnableThinking] = useState<boolean>(true);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [userVolume, setUserVolume] = useState<number>(0);
  const [tutorVolume, setTutorVolume] = useState<number>(0);

  const [currentThought, setCurrentThought] = useState<string>("");
  const [currentUserText, setCurrentUserText] = useState<string>("");
  const [currentTutorText, setCurrentTutorText] = useState<string>("");
  const [turns, setTurns] = useState<MessageTurn[]>([]);
  const [resumptionHandle, setResumptionHandle] = useState<string | undefined>();
  const [logs, setLogs] = useState<DebugLog[]>([]);

  // Refs for instances
  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Keep latest text values in ref to avoid stale closures in callbacks
  const currentUserTextRef = useRef<string>("");
  const currentTutorTextRef = useRef<string>("");
  const connectRef = useRef<((overrideOrKey?: string | ConnectOverrides) => Promise<void>) | null>(
    null
  );

  const addLog = useCallback((message: string, level: "info" | "warn" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SpeechTutor ${timestamp}] [${level.toUpperCase()}] ${message}`);
    setLogs((prev) => [
      ...prev.slice(-99),
      { id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, timestamp, level, message },
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const updateTutorState = useCallback((newState: TutorState) => {
    setTutorState(newState);
  }, []);

  const flushUserTurn = useCallback(() => {
    const finalUserText = currentUserTextRef.current.trim();
    if (finalUserText) {
      setTurns((prev) => [
        ...prev,
        {
          id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-user`,
          role: "user",
          text: finalUserText,
          timestamp: Date.now(),
        },
      ]);
      currentUserTextRef.current = "";
      setCurrentUserText("");
    }
  }, []);

  const flushTutorTurn = useCallback((wasInterrupted: boolean = false) => {
    const finalTutorText = currentTutorTextRef.current.trim();
    if (finalTutorText) {
      setTurns((prev) => [
        ...prev,
        {
          id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-tutor`,
          role: "tutor",
          text: finalTutorText,
          timestamp: Date.now(),
          interrupted: wasInterrupted,
        },
      ]);
      currentTutorTextRef.current = "";
      setCurrentTutorText("");
    }
  }, []);

  const disconnect = useCallback(async (preserveError: boolean = false) => {
    try {
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      if (sessionRef.current) {
        await sessionRef.current.close();
        sessionRef.current = null;
      }
    } catch (err) {
      console.warn("[SpeechTutor] Error disconnecting session:", err);
    } finally {
      if (!preserveError) {
        setStatus("disconnected");
        setErrorMessage(null);
      }
      setActiveConnectedModel(null);
      setTutorState("idle");
      setIsMuted(false);
      setUserVolume(0);
      setTutorVolume(0);
    }
  }, []);

  const connect = useCallback(
    async (overrideOrKey?: string | ConnectOverrides) => {
      const overrides: ConnectOverrides =
        typeof overrideOrKey === "string" ? { apiKey: overrideOrKey } : overrideOrKey || {};

      if ((status === "connecting" || status === "connected") && !overrides.forceReconnect) {
        return;
      }

      if (overrides.forceReconnect && (status === "connecting" || status === "connected")) {
        addLog("Switching configuration on the fly — closing previous session...", "info");
        await disconnect(false);
      }

      const resolvedApiKey = (
        overrides.apiKey ||
        optionApiKey ||
        process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
        ""
      ).trim();

      const targetModel = (overrides.model ?? selectedModel).trim() || "gemini-3.8-live";
      const targetPersonaId = overrides.personaId ?? selectedPersonaId;
      const targetVoice = overrides.voice ?? selectedVoice;
      const useThinking = overrides.enableThinking ?? enableThinking;
      const extraInstructions = (overrides.customInstructions ?? customInstructions).trim();

      if (!resolvedApiKey) {
        const msg = "Please enter your Gemini API Key in the settings drawer to connect.";
        addLog(msg, "error");
        setErrorMessage(msg);
        setStatus("error");
        return;
      }

      setErrorMessage(null);
      setStatus("connecting");
      setTutorState("idle");
      setIsMuted(false);
      setCurrentThought("");
      setCurrentUserText("");
      setCurrentTutorText("");
      currentUserTextRef.current = "";
      currentTutorTextRef.current = "";

      addLog(`Connecting session to Gemini Live API with model "${targetModel}"...`, "info");

      try {
        const persona = TUTOR_PERSONAS[targetPersonaId] || TUTOR_PERSONAS.casual;
        const fullSystemInstruction = extraInstructions
          ? `${persona.systemInstruction}\n\nAdditional Practice Scenario / Context:\n${extraInstructions}`
          : persona.systemInstruction;

        // Initialize Audio Player
        addLog("Initializing Web Audio Player (24kHz PCM)...", "info");
        const player = new AudioPlayer({
          sampleRate: 24000,
          onVolumeChange: (vol) => setTutorVolume(vol),
          onPlaybackStateChange: (isPlaying) => {
            if (isPlaying) {
              updateTutorState("speaking");
            } else {
              updateTutorState("listening");
            }
          },
        });
        playerRef.current = player;

        // Prepare live config
        const liveConfig: Record<string, unknown> = {
          model: targetModel,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceName: targetVoice,
          },
          systemInstruction: fullSystemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        };

        if (useThinking) {
          liveConfig.thinkingConfig = {
            thinkingBudget: 1024,
            includeThoughts: true,
          };
        }

        // Only attach sessionResumption handle if resuming the same model
        if (resumptionHandle && activeConnectedModel === targetModel) {
          liveConfig.sessionResumption = { handle: resumptionHandle };
        }

        // Initialize Gemini Live Session
        const session = new GeminiLiveSession(resolvedApiKey, liveConfig);
        sessionRef.current = session;

        // Session events
        session.on("open", () => {
          addLog(`WebSocket opened for "${targetModel}". Handshake in progress...`, "info");
          setStatus("connected");
          setActiveConnectedModel(targetModel);
          updateTutorState("listening");
        });

        session.on("message", (msg) => {
          if (msg.setupComplete) {
            addLog(`Setup complete! Active model: "${targetModel}"`, "info");
          }
        });

        session.on("audio", (chunk: LiveAudioChunk) => {
          flushUserTurn();
          player.playChunk(chunk.data);
        });

        session.on("thought", (chunk: LiveThoughtChunk) => {
          flushUserTurn();
          updateTutorState("thinking");
          setCurrentThought((prev) => prev + chunk.text);
        });

        session.on("interrupted", () => {
          addLog("User interrupted tutor (barge-in detected).", "info");
          player.interrupt();
          flushTutorTurn(true);
          updateTutorState("listening");
        });

        session.on("inputTranscription", (chunk: LiveTranscriptionChunk) => {
          currentUserTextRef.current += chunk.text;
          setCurrentUserText(currentUserTextRef.current);

          if (chunk.finished) {
            flushUserTurn();
          }
        });

        session.on("outputTranscription", (chunk: LiveTranscriptionChunk) => {
          flushUserTurn();
          currentTutorTextRef.current += chunk.text;
          setCurrentTutorText(currentTutorTextRef.current);
        });

        session.on("turnComplete", () => {
          flushUserTurn();
          flushTutorTurn(false);
        });

        session.on("resumptionUpdate", (evt) => {
          if (evt.handle) {
            addLog(`Session resumption handle updated: ${evt.handle.substring(0, 16)}...`, "info");
            setResumptionHandle(evt.handle);
          }
        });

        session.on("error", (err) => {
          const errDetail = err.message || String(err);
          addLog(`Live session error: ${errDetail}`, "error");
          setErrorMessage(errDetail);
          setStatus("error");
        });

        session.on("close", (code?: number, reason?: string) => {
          const reasonStr = reason ? ` - ${reason}` : "";
          const msg = `WebSocket closed (code: ${code ?? "N/A"}${reasonStr})`;
          addLog(msg, code && code !== 1000 ? "warn" : "info");

          if (code && code !== 1000) {
            // Check if the model rejected thinkingConfig and auto-fallback!
            if (
              useThinking &&
              reason &&
              (reason.toLowerCase().includes("thinking") ||
                reason.toLowerCase().includes("thought"))
            ) {
              addLog(
                `Model "${targetModel}" does not support thinkingConfig. Automatically retrying with Thinking disabled...`,
                "warn"
              );
              setEnableThinking(false);
              setTimeout(() => {
                connectRef.current?.({
                  ...overrides,
                  model: targetModel,
                  enableThinking: false,
                  forceReconnect: true,
                });
              }, 150);
              return;
            }

            setErrorMessage(
              reason
                ? `Connection closed by server: ${reason} (Code ${code})`
                : `Connection closed unexpectedly (Code ${code}). Verify that model "${targetModel}" supports the Gemini Live BidiGenerateContent API.`
            );
            setStatus("error");
          } else {
            setStatus("disconnected");
          }
          setActiveConnectedModel(null);
          setTutorState("idle");
        });

        // Connect session socket
        addLog("Establishing WebSocket connection to Google Gemini...", "info");
        await session.connect();

        // Initialize Audio Recorder (Microphone)
        addLog("Requesting microphone permissions...", "info");
        const recorder = new AudioRecorder({
          targetSampleRate: 16000,
          onVolumeChange: (vol) => setUserVolume(vol),
          onAudioData: (pcmBase64) => {
            if (session.isConnected) {
              session.sendRealtimeAudio(pcmBase64);
            }
          },
        });
        recorderRef.current = recorder;
        await recorder.start();
        addLog("Microphone streaming active (16kHz PCM). Ready to speak!", "info");
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[SpeechTutor] Connection failed:", error);
        addLog(`Connection failed: ${error.message}`, "error");
        setErrorMessage(error.message || "Failed to start speech tutor session.");
        setStatus("error");
        await disconnect(true);
      }
    },
    [
      status,
      optionApiKey,
      selectedModel,
      selectedPersonaId,
      selectedVoice,
      enableThinking,
      customInstructions,
      resumptionHandle,
      activeConnectedModel,
      updateTutorState,
      flushUserTurn,
      flushTutorTurn,
      disconnect,
      addLog,
    ]
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const toggleMute = useCallback(() => {
    if (!recorderRef.current) return;
    const nextMuted = !recorderRef.current.muted;
    recorderRef.current.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (nextMuted && sessionRef.current?.isConnected) {
      sessionRef.current.sendAudioStreamEnd();
      addLog("Microphone muted.", "info");
    } else {
      addLog("Microphone unmuted.", "info");
    }
  }, [addLog]);

  const sendText = useCallback(
    (text: string, labelAsUserTurn: boolean = true) => {
      if (sessionRef.current?.isConnected && text.trim()) {
        // Interrupt any ongoing tutor speech when user sends a prompt
        playerRef.current?.interrupt();
        flushTutorTurn(true);

        sessionRef.current.sendText(text.trim(), true);
        addLog(`Sent text prompt: "${text.trim()}"`, "info");

        if (labelAsUserTurn) {
          setTurns((prev) => [
            ...prev,
            {
              id: `turn-${Date.now()}-user`,
              role: "user",
              text: text.trim(),
              timestamp: Date.now(),
            },
          ]);
        }
      }
    },
    [addLog, flushTutorTurn]
  );

  const requestTutorGreeting = useCallback(() => {
    const persona = TUTOR_PERSONAS[selectedPersonaId] || TUTOR_PERSONAS.casual;
    sendText(persona.starterPrompt, false);
  }, [selectedPersonaId, sendText]);

  const clearHistory = useCallback(() => {
    setTurns([]);
    setCurrentThought("");
    setCurrentUserText("");
    setCurrentTutorText("");
    currentUserTextRef.current = "";
    currentTutorTextRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) recorderRef.current.stop();
      if (playerRef.current) playerRef.current.close();
      if (sessionRef.current) sessionRef.current.close();
    };
  }, []);

  return {
    status,
    tutorState,
    errorMessage,
    activeConnectedModel,
    selectedModel,
    setSelectedModel,
    selectedPersonaId,
    setSelectedPersonaId,
    selectedVoice,
    setSelectedVoice,
    enableThinking,
    setEnableThinking,
    customInstructions,
    setCustomInstructions,
    isMuted,
    toggleMute,
    userVolume,
    tutorVolume,
    currentThought,
    currentUserText,
    currentTutorText,
    turns,
    resumptionHandle,
    logs,
    clearLogs,
    connect,
    disconnect,
    sendText,
    requestTutorGreeting,
    clearHistory,
    personas: TUTOR_PERSONAS,
    voices: GEMINI_LIVE_VOICES,
  };
}
