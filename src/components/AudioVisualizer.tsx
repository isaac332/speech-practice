"use client";

import React from "react";
import type { TutorState } from "../hooks/useGeminiSpeechTutor";

interface AudioVisualizerProps {
  state: TutorState;
  userVolume: number;
  tutorVolume: number;
}

export function AudioVisualizer({ state, userVolume, tutorVolume }: AudioVisualizerProps) {
  const activeVolume = state === "speaking" ? tutorVolume : userVolume;
  const scale = 1 + Math.min(0.6, activeVolume * 1.5);

  let stateColor = "from-indigo-500 to-purple-600";
  let ringColor = "border-indigo-400/30";
  let statusText = "Ready to connect";

  if (state === "listening") {
    stateColor = "from-emerald-500 to-teal-600 shadow-emerald-500/30";
    ringColor = "border-emerald-400/40";
    statusText = "Listening to you...";
  } else if (state === "thinking") {
    stateColor = "from-amber-500 to-orange-600 animate-pulse shadow-amber-500/30";
    ringColor = "border-amber-400/50";
    statusText = "Gemini is thinking...";
  } else if (state === "speaking") {
    stateColor = "from-blue-600 to-violet-600 shadow-blue-500/40";
    ringColor = "border-blue-400/50";
    statusText = "Tutor is speaking...";
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-8">
      {/* Outer pulsating wave ring */}
      <div
        className={`absolute h-48 w-48 rounded-full border-2 ${ringColor} transition-all duration-300 ease-out`}
        style={{
          transform: `scale(${scale * 1.3})`,
          opacity: state === "idle" ? 0.2 : 0.8,
        }}
      />
      {/* Middle wave ring */}
      <div
        className={`absolute h-40 w-40 rounded-full border border-current opacity-30 ${ringColor} transition-all duration-200 ease-out`}
        style={{
          transform: `scale(${scale * 1.15})`,
        }}
      />

      {/* Main Core Orb */}
      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-tr ${stateColor} text-white shadow-2xl transition-all duration-150 ease-out`}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {/* Dynamic Waveform Bars inside Core */}
        <div className="flex items-center gap-1.5">
          {[0.4, 0.8, 1.2, 0.7, 0.3].map((heightFactor, i) => {
            const barHeight = Math.max(
              6,
              Math.min(36, 10 + activeVolume * 70 * heightFactor)
            );
            return (
              <span
                key={i}
                className="w-1.5 rounded-full bg-white transition-all duration-75"
                style={{
                  height: `${barHeight}px`,
                  opacity: state === "idle" ? 0.5 : 0.95,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Status Label */}
      <span
        aria-live="polite"
        className="mt-6 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-300"
      >
        {statusText}
      </span>
    </div>
  );
}
