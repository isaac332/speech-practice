"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  Settings,
  Brain,
  MessageSquare,
  Volume2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Send,
  Copy,
  Check,
  Download,
  Cpu,
  Play,
  Sliders,
  Clock,
} from "lucide-react";
import { useGeminiSpeechTutor } from "../hooks/useGeminiSpeechTutor";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { type GeminiLiveVoice } from "@llm-multi-provider/core/live";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getApiKeySnapshot() {
  return localStorage.getItem("gemini_api_key") || "";
}

function getApiKeyServerSnapshot() {
  return "";
}

function getSavedModelSnapshot() {
  return localStorage.getItem("gemini_live_model") || "gemini-3.8-live";
}

function getSavedModelServerSnapshot() {
  return "gemini-3.8-live";
}

const SUGGESTED_LIVE_MODELS = [
  {
    id: "gemini-3.8-live",
    label: "gemini-3.8-live",
    badge: "Default",
  },
  {
    id: "gemini-2.5-flash-native-audio-preview-12-2025",
    label: "gemini-2.5-flash-native-audio",
    badge: "Native Audio",
  },
  {
    id: "gemini-2.0-flash-live-001",
    label: "gemini-2.0-flash-live-001",
    badge: "Live 2.0",
  },
  {
    id: "gemini-2.0-flash-exp",
    label: "gemini-2.0-flash-exp",
    badge: "Experimental",
  },
];

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function Home() {
  const storedApiKey = useSyncExternalStore(
    subscribeStorage,
    getApiKeySnapshot,
    getApiKeyServerSnapshot
  );
  const storedModel = useSyncExternalStore(
    subscribeStorage,
    getSavedModelSnapshot,
    getSavedModelServerSnapshot
  );

  const [customApiKey, setCustomApiKey] = useState<string | null>(null);
  const apiKey = customApiKey !== null ? customApiKey : storedApiKey;

  const [showSettings, setShowSettings] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const {
    status,
    tutorState,
    errorMessage,
    selectedModel,
    setSelectedModel,
    activeConnectedModel,
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
    requestTutorGreeting,
    sendText,
    clearHistory,
    personas,
    voices,
  } = useGeminiSpeechTutor({
    apiKey: apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    model: storedModel,
  });

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const activePersona = personas[selectedPersonaId] || personas.casual;
  const trimmedModel = selectedModel.trim();
  const hasPendingModelSwitch =
    isConnected &&
    Boolean(trimmedModel) &&
    Boolean(activeConnectedModel) &&
    trimmedModel !== activeConnectedModel;

  const handleApiKeyChange = (key: string) => {
    setCustomApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", key);
    }
  };

  const handleModelChange = (modelValue: string) => {
    setSelectedModel(modelValue);
    if (typeof window !== "undefined" && modelValue.trim()) {
      localStorage.setItem("gemini_live_model", modelValue.trim());
    }
  };

  const handleApplyModelLive = (modelOverride?: string) => {
    const targetModel = (modelOverride ?? selectedModel).trim();
    if (!targetModel) return;
    handleModelChange(targetModel);
    if (isConnected || isConnecting) {
      connect({
        apiKey,
        model: targetModel,
        forceReconnect: true,
      });
    }
  };

  const handlePersonaSelect = (personaId: string) => {
    setSelectedPersonaId(personaId);
    if (isConnected) {
      connect({
        apiKey,
        personaId,
        forceReconnect: true,
      });
    }
  };

  const handleVoiceSelect = (voice: GeminiLiveVoice) => {
    setSelectedVoice(voice);
    if (isConnected) {
      connect({
        apiKey,
        voice,
        forceReconnect: true,
      });
    }
  };

  const handleToggleThinking = () => {
    const nextThinking = !enableThinking;
    setEnableThinking(nextThinking);
    if (isConnected) {
      connect({
        apiKey,
        enableThinking: nextThinking,
        forceReconnect: true,
      });
    }
  };

  // Live session timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setSessionSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, currentUserText, currentTutorText]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogs]);

  const handleToggleSession = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      setSessionSeconds(0);
      connect({ apiKey, model: trimmedModel || "gemini-3.8-live" });
    }
  };

  const handleSendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !isConnected) return;
    sendText(text, true);
    setChatInput("");
  };

  const handleCopyTranscript = async () => {
    if (turns.length === 0) return;
    const formatted = turns
      .map(
        (t) =>
          `[${new Date(t.timestamp).toLocaleTimeString()}] ${
            t.role === "user" ? "You" : "Tutor"
          }${t.interrupted ? " (interrupted)" : ""}: ${t.text}`
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadTranscript = () => {
    if (turns.length === 0) return;
    const header = `Gemini Live Speech Tutor Transcript\nModel: ${
      activeConnectedModel || selectedModel
    }\nMode: ${activePersona.name}\nDate: ${new Date().toLocaleString()}\n${"=".repeat(
      48
    )}\n\n`;
    const body = turns
      .map(
        (t) =>
          `[${new Date(t.timestamp).toLocaleTimeString()}] ${
            t.role === "user" ? "You" : "Tutor"
          }${t.interrupted ? " (interrupted)" : ""}:\n${t.text}`
      )
      .join("\n\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speech-practice-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Navigation Header */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white/85 px-4 py-3.5 backdrop-blur-md sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight sm:text-lg">
              Gemini Live Speech Tutor
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                {activeConnectedModel || selectedModel || "gemini-3.8-live"}
              </span>
              <span>•</span>
              <span>{activePersona.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Session Duration Pill */}
          {isConnected && (
            <div className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 font-mono text-xs font-medium text-zinc-700 sm:flex dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
              <Clock className="h-3 w-3 text-indigo-500" />
              <span>{formatDuration(sessionSeconds)}</span>
            </div>
          )}

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : isConnecting
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 animate-pulse"
                : status === "error"
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected
                  ? "bg-emerald-500"
                  : isConnecting
                  ? "bg-amber-500"
                  : status === "error"
                  ? "bg-rose-500"
                  : "bg-zinc-400"
              }`}
            />
            {status === "connected"
              ? "Live"
              : status === "connecting"
              ? "Connecting..."
              : status === "error"
              ? "Error"
              : "Disconnected"}
          </div>

          {/* Diagnostics toggle */}
          <button
            onClick={() => setShowLogs((prev) => !prev)}
            aria-label="Toggle Diagnostics"
            title="Toggle Live Connection Logs"
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
              showLogs
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>

          <button
            onClick={() => setShowSettings((prev) => !prev)}
            aria-label="API Key & Advanced Settings"
            title="API Key & Advanced Settings"
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
              showSettings
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">API Key</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        {/* Left Column: Model Bar, Visualizer, Controls, Persona */}
        <section className="flex flex-1 flex-col gap-5 lg:max-w-md">
          {/* On-the-Fly Model Input Card (Always accessible!) */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="model-id-input"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
              >
                <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                <span>Gemini Live Model (Type Any Model ID)</span>
              </label>
              {isConnected && activeConnectedModel && (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Active: {activeConnectedModel}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="model-id-input"
                  type="text"
                  list="gemini-live-models"
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.nativeEvent.isComposing &&
                      hasPendingModelSwitch
                    ) {
                      e.preventDefault();
                      handleApplyModelLive();
                    }
                  }}
                  placeholder="e.g. gemini-3.8-live or gemini-2.0-flash-live-001"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 dark:focus:border-indigo-400"
                />
                <datalist id="gemini-live-models">
                  {SUGGESTED_LIVE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.badge}
                    </option>
                  ))}
                </datalist>
              </div>

              {hasPendingModelSwitch && (
                <button
                  type="button"
                  onClick={() => handleApplyModelLive()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Switch Live</span>
                </button>
              )}
            </div>

            {/* Quick Model Presets */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-zinc-400">Presets:</span>
              {SUGGESTED_LIVE_MODELS.map((preset) => {
                const isCurrent = selectedModel.trim() === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyModelLive(preset.id)}
                    className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] transition-all ${
                      isCurrent
                        ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-500/80 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key & Advanced Settings Drawer */}
          {showSettings && (
            <div className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">API Key & Connection Options</h3>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  Close
                </button>
              </div>

              {/* API Key */}
              <div className="mb-4">
                <label
                  htmlFor="gemini-api-key-input"
                  className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Gemini API Key (Overrides server default if set)
                </label>
                <input
                  id="gemini-api-key-input"
                  type="password"
                  placeholder="AIzaSy... (leave blank to use server key)"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Saved locally in your browser&apos;s storage.
                </p>
              </div>

              {/* Thinking Mode Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Enable Thinking Stream
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Request model thoughts (auto-disables if unsupported by model)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableThinking}
                  onClick={handleToggleThinking}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    enableThinking
                      ? "bg-indigo-600"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                      enableThinking ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Visualizer & Session Controls Card */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <AudioVisualizer
              state={tutorState}
              userVolume={userVolume}
              tutorVolume={tutorVolume}
              isMuted={isMuted}
            />

            {/* Main Action Buttons */}
            <div className="mt-4 flex w-full flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleSession}
                disabled={isConnecting}
                className={`flex w-full items-center justify-center gap-3 rounded-xl py-3.5 px-6 font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                  isConnected
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-indigo-600/25"
                } ${isConnecting ? "opacity-75 cursor-wait" : ""}`}
              >
                {isConnected ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    <span>End Practice Session</span>
                  </>
                ) : isConnecting ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Connecting to {trimmedModel || "Gemini"}...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span>Start Practice Session</span>
                  </>
                )}
              </button>

              {/* Secondary Live Controls: Mute Mic & Have Tutor Speak First */}
              {isConnected && (
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      isMuted
                        ? "border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500/70 dark:bg-amber-950/50 dark:text-amber-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-4 w-4 text-amber-500" />
                        <span>Unmute Mic</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 text-emerald-500" />
                        <span>Mute Mic</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={requestTutorGreeting}
                    className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Tutor Speak First</span>
                  </button>
                </div>
              )}

              {resumptionHandle && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Session Resumption active</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Connection Notice</p>
                <p className="mt-0.5 whitespace-pre-wrap">{errorMessage}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLogs(true)}
                    className="text-[11px] font-semibold underline hover:opacity-80"
                  >
                    View Diagnostics →
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      connect({
                        apiKey,
                        model: trimmedModel || "gemini-3.8-live",
                        forceReconnect: true,
                      })
                    }
                    className="rounded-lg bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-800"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Persona, Custom Scenario & Voice Selection */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight">
                Practice Coaching Mode
              </span>
              {isConnected && (
                <span className="text-[11px] text-zinc-400">
                  Click any mode to switch live
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {Object.values(personas).map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => handlePersonaSelect(persona.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/25"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {persona.name}
                      </span>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      )}
                    </div>
                    <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {persona.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Practice Topic / Instructions */}
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <label
                htmlFor="custom-scenario-input"
                className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                <span>Custom Topic or Scenario (Optional)</span>
                <Sliders className="h-3.5 w-3.5" />
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-scenario-input"
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.nativeEvent.isComposing &&
                      isConnected
                    ) {
                      e.preventDefault();
                      connect({
                        apiKey,
                        customInstructions: e.currentTarget.value,
                        forceReconnect: true,
                      });
                    }
                  }}
                  placeholder="e.g. Ordering at a Tokyo cafe, salary negotiation..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {isConnected && customInstructions.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      connect({
                        apiKey,
                        customInstructions,
                        forceReconnect: true,
                      })
                    }
                    className="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>

            {/* Voice Selection */}
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span>Tutor Voice</span>
                <Volume2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(voices).map(([key, name]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleVoiceSelect(name as GeminiLiveVoice)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedVoice === name
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Live Conversation Transcript, Quick Prompts & Chat Input */}
        <section className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-semibold">Real-Time Speech Transcript</span>
              {turns.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {turns.length} {turns.length === 1 ? "turn" : "turns"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowThoughts((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  showThoughts
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Thinking</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTranscript}
                disabled={turns.length === 0}
                title="Copy Transcript"
                aria-label="Copy Transcript"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {copiedTranscript ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadTranscript}
                disabled={turns.length === 0}
                title="Download Transcript (.txt)"
                aria-label="Download Transcript"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={clearHistory}
                disabled={turns.length === 0 && !currentUserText && !currentTutorText}
                title="Clear Transcript"
                aria-label="Clear Transcript"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Thoughts Drawer */}
          {showThoughts && (
            <div className="border-b border-amber-200/50 bg-amber-50/50 p-4 text-xs font-mono text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <Brain className="h-3 w-3" />
                  <span>Gemini Live Thought Stream</span>
                </div>
                <span className="text-[10px] text-amber-600/80 dark:text-amber-400/70">
                  {enableThinking ? "Thinking Enabled" : "Thinking Disabled"}
                </span>
              </div>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                {currentThought ||
                  "Waiting for model thoughts... (Speak or send a prompt to see internal reasoning)"}
              </p>
            </div>
          )}

          {/* Diagnostics Log Drawer */}
          {showLogs && (
            <div className="border-b border-zinc-200 bg-zinc-900 p-4 font-mono text-xs text-zinc-200 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Terminal className="h-3.5 w-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[11px]">
                    Live Connection Diagnostics
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearLogs}
                  className="text-[11px] text-zinc-400 hover:text-white underline"
                >
                  Clear Logs
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-zinc-500 italic">
                    No logs recorded yet. Press &quot;Start Practice Session&quot; to begin.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 text-[11px] leading-relaxed"
                    >
                      <span className="text-zinc-500 shrink-0">[{log.timestamp}]</span>
                      <span
                        className={`font-semibold shrink-0 ${
                          log.level === "error"
                            ? "text-rose-400"
                            : log.level === "warn"
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Transcript Scroll Area */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 min-h-[360px] max-h-[580px]"
          >
            {turns.length === 0 && !currentUserText && !currentTutorText && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-400">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-500">
                  <Mic className="h-6 w-6 stroke-1.5" />
                </div>
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  Ready for {activePersona.name}
                </p>
                <p className="mt-1 max-w-xs text-xs text-zinc-400">
                  {isConnected
                    ? "Start speaking into your microphone, click 'Tutor Speak First', or pick a starter prompt below."
                    : "Start a practice session and speak naturally, or type any Gemini model ID on the left to test different models."}
                </p>

                {isConnected && (
                  <button
                    type="button"
                    onClick={requestTutorGreeting}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Have Tutor Start the Conversation</span>
                  </button>
                )}
              </div>
            )}

            {turns.map((turn) => {
              const isUser = turn.role === "user";
              return (
                <div
                  key={turn.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                    <span>{isUser ? "You" : "Tutor"}</span>
                    <span>•</span>
                    <span className="font-normal">
                      {new Date(turn.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {turn.interrupted && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        interrupted
                      </span>
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-none"
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming User Speech */}
            {currentUserText && (
              <div className="flex flex-col items-end">
                <span className="mb-1 text-[11px] font-semibold text-indigo-500 animate-pulse">
                  Listening to you...
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-br-none bg-indigo-500/85 px-4 py-2.5 text-sm text-white italic">
                  {currentUserText}
                </div>
              </div>
            )}

            {/* Live Streaming Tutor Speech */}
            {currentTutorText && (
              <div className="flex flex-col items-start">
                <span className="mb-1 text-[11px] font-semibold text-purple-500 animate-pulse">
                  Tutor speaking...
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-zinc-100 px-4 py-2.5 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                  {currentTutorText}
                </div>
              </div>
            )}
          </div>

          {/* Quick Practice Prompts & Hybrid Text Input Footer */}
          <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
            {/* Quick Starter Chips */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-zinc-400 mr-1">
                Quick prompts:
              </span>
              {activePersona.quickPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!isConnected}
                  onClick={() => sendText(promptText, true)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 transition-all hover:border-indigo-400 hover:bg-indigo-50/60 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Text Chat Input Bar */}
            <div className="flex items-center gap-2">
              <label htmlFor="chat-message-input" className="sr-only">
                Send a text message to the speech tutor
              </label>
              <input
                id="chat-message-input"
                type="text"
                disabled={!isConnected}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder={
                  isConnected
                    ? "Type a message, phrase, or topic to send to the live tutor..."
                    : "Start a practice session to speak or send text messages..."
                }
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-800/90 dark:text-zinc-100"
              />
              <button
                type="button"
                disabled={!isConnected || !chatInput.trim()}
                onClick={handleSendChatMessage}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
