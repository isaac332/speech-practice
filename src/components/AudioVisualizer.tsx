"use client";

import React from "react";
import type { TutorState } from "../hooks/useGeminiSpeechTutor";

interface AudioVisualizerProps {
  state: TutorState;
  userVolume: number;
  tutorVolume: number;
  isMuted?: boolean;
}

export function AudioVisualizer({
  state,
  userVolume,
  tutorVolume,
  isMuted = false,
}: AudioVisualizerProps) {
  const activeVolume = state === "speaking" ? tutorVolume : isMuted ? 0 : userVolume;
  const scale = 1 + Math.min(0.55, activeVolume * 1.4);

  let stateColor = "from-indigo-500 to-purple-600";
  let ringColor = "border-indigo-400/30";
  let statusText = "Ready to connect";
  let subText = "Choose a model & press Start Practice Session";

  if (state === "listening") {
    if (isMuted) {
      stateColor = "from-zinc-500 to-zinc-600 shadow-zinc-500/20";
      ringColor = "border-zinc-400/30";
      statusText = "Microphone Muted";
      subText = "Unmute your mic or type a message below";
    } else {
      stateColor = "from-emerald-500 to-teal-600 shadow-emerald-500/30";
      ringColor = "border-emerald-400/40";
      statusText = "Listening to you...";
      subText = "Speak naturally — interrupt anytime";
    }
  } else if (state === "thinking") {
    stateColor = "from-amber-500 to-orange-600 animate-pulse shadow-amber-500/30";
    ringColor = "border-amber-400/50";
    statusText = "Gemini is thinking...";
    subText = "Formulating coaching response";
  } else if (state === "speaking") {
    stateColor = "from-blue-600 to-violet-600 shadow-blue-500/40";
    ringColor = "border-blue-400/50";
    statusText = "Tutor is speaking...";
    subText = "Start speaking anytime to interrupt (barge-in)";
  }

  return (
    <div className="relative flex flex-col items-center justify-center py-6 px-4">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {/* Outer pulsating wave ring */}
        <div
          className={`absolute h-44 w-44 rounded-full border-2 ${ringColor} transition-all duration-300 ease-out`}
          style={{
            transform: `scale(${scale * 1.25})`,
            opacity: state === "idle" ? 0.2 : 0.75,
          }}
        />
        {/* Middle wave ring */}
        <div
          className={`absolute h-36 w-36 rounded-full border border-current opacity-30 ${ringColor} transition-all duration-200 ease-out`}
          style={{
            transform: `scale(${scale * 1.12})`,
          }}
        />

        {/* Main Core Orb */}
        <div
          className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr ${stateColor} text-white shadow-2xl transition-all duration-150 ease-out`}
          style={{
            transform: `scale(${scale})`,
          }}
        >
          {/* Dynamic Waveform Bars inside Core */}
          <div className="flex items-center gap-1.5">
            {[0.35, 0.75, 1.15, 0.9, 1.2, 0.7, 0.35].map((heightFactor, i) => {
              const barHeight = Math.max(
                6,
                Math.min(38, 8 + activeVolume * 68 * heightFactor)
              );
              return (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-white transition-all duration-75"
                  style={{
                    height: `${barHeight}px`,
                    opacity: state === "idle" ? 0.45 : 0.95,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Label */}
      <div className="mt-3 flex flex-col items-center text-center" aria-live="polite">
        <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
          {statusText}
        </span>
        <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {subText}
        </span>
      </div>

      {/* Dual Audio Level Meter Bars */}
      {state !== "idle" && (
        <div className="mt-4 flex w-full max-w-[220px] items-center gap-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex justify-between">
              <span>Mic Input</span>
              <span>{isMuted ? "Muted" : `${Math.round(userVolume * 100)}%`}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${isMuted ? 0 : Math.min(100, userVolume * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex justify-between">
              <span>Tutor Audio</span>
              <span>{Math.round(tutorVolume * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-75"
                style={{ width: `${Math.min(100, tutorVolume * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
