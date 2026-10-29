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
} from "lucide-react";
import { useGeminiSpeechTutor } from "../hooks/useGeminiSpeechTutor";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { type GeminiLiveVoice } from "@llm-multi-provider/core/live";

function subscribeApiKey(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getApiKeySnapshot() {
  return localStorage.getItem("gemini_api_key") || "";
}

function getApiKeyServerSnapshot() {
  return "";
}

const POPULAR_LIVE_MODELS = [
  { id: "gemini-3.8-live", name: "Gemini 3.8 Live (Recommended)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

export default function Home() {
  const storedApiKey = useSyncExternalStore(
    subscribeApiKey,
    getApiKeySnapshot,
    getApiKeyServerSnapshot
  );
  const [customApiKey, setCustomApiKey] = useState<string | null>(null);
  const apiKey = customApiKey !== null ? customApiKey : storedApiKey;

  const [showSettings, setShowSettings] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const {
    status,
    tutorState,
    errorMessage,
    selectedModel,
    setSelectedModel,
    selectedPersonaId,
    setSelectedPersonaId,
    selectedVoice,
    setSelectedVoice,
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
    clearHistory,
    personas,
    voices,
  } = useGeminiSpeechTutor({
    apiKey: apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  });

  const handleApiKeyChange = (key: string) => {
    setCustomApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", key);
    }
  };

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

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const handleToggleSession = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      connect(apiKey);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Navigation Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Gemini Live Speech Tutor</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live conversational tutor ({selectedModel})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
              ? "Connected"
              : status === "connecting"
              ? "Connecting..."
              : status === "error"
              ? "Connection Error"
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
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-6">
        {/* Left Column: Tutor Orb, Practice Persona, Controls */}
        <section className="flex flex-1 flex-col gap-6 md:max-w-md">
          {/* Visualizer Card */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <AudioVisualizer
              state={tutorState}
              userVolume={userVolume}
              tutorVolume={tutorVolume}
            />

            {/* Main Action Button */}
            <div className="mt-4 flex w-full flex-col items-center gap-3">
              <button
                onClick={handleToggleSession}
                disabled={isConnecting}
                className={`flex w-full items-center justify-center gap-3 rounded-xl py-3.5 px-6 font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                  isConnected
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-indigo-600/30"
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
                    <span>Connecting to Gemini Live...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span>Start Practice Session</span>
                  </>
                )}
              </button>

              {resumptionHandle && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Session Resumption enabled</span>
                </div>
              )}
            </div>
          </div>

          {/* Persona & Coach Selection */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <label className="mb-3 block text-sm font-semibold tracking-tight">
              Practice Coaching Mode
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
              {Object.values(personas).map((persona) => {
                const isSelected = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersonaId(persona.id)}
                    disabled={isConnected}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/20"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    } ${isConnected ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {persona.name}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {persona.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Voice Selection */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span>Tutor Voice</span>
                <Volume2 className="h-3.5 w-3.5" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(voices).map(([key, name]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedVoice(name as GeminiLiveVoice)}
                    disabled={isConnected}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedVoice === name
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    } ${isConnected ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Settings Drawer */}
          {showSettings && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 text-sm font-semibold">Gemini Live Settings</h3>

              {/* Model selection */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Gemini Live Model
                </label>
                <select
                  value={selectedModel}
                  disabled={isConnected}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {POPULAR_LIVE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Stored securely in your browser&apos;s local storage.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Connection Notice</p>
                <p className="mt-0.5 whitespace-pre-wrap">{errorMessage}</p>
                <button
                  onClick={() => setShowLogs(true)}
                  className="mt-2 text-[11px] font-semibold underline hover:opacity-80"
                >
                  Open Diagnostics to view full details →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Live Conversation Transcript & Diagnostics */}
        <section className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-semibold">Real-Time Speech Transcript</span>
            </div>

            <div className="flex items-center gap-2">
              <button
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
                onClick={clearHistory}
                aria-label="Clear Transcript"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Thoughts Drawer */}
          {showThoughts && currentThought && (
            <div className="border-b border-amber-200/50 bg-amber-50/50 p-4 text-xs font-mono text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Brain className="h-3 w-3" />
                <span>Gemini Live Thought Stream</span>
              </div>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                {currentThought}
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
                  onClick={clearLogs}
                  className="text-[11px] text-zinc-400 hover:text-white underline"
                >
                  Clear Logs
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-zinc-500 italic">No logs recorded yet. Press &quot;Start Practice Session&quot; to begin.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
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
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 min-h-[350px] max-h-[600px]"
          >
            {turns.length === 0 && !currentUserText && !currentTutorText && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-400">
                <Mic className="mb-2 h-8 w-8 stroke-1 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm font-medium">No conversation yet</p>
                <p className="text-xs">
                  Press &quot;Start Practice Session&quot; and speak into your microphone.
                </p>
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
                  <span className="mb-1 text-[11px] font-semibold text-zinc-400">
                    {isUser ? "You" : "Tutor"}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
                  Speaking...
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-br-none bg-indigo-500/80 px-4 py-2.5 text-sm text-white italic">
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
        </section>
      </main>
    </div>
  );
}
