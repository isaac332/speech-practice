# Gemini Live Speech Tutor 🎙️✨

A real-time, bidirectional conversational speech and pronunciation coach built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and Google's **Gemini Live API** via `@llm-multi-provider/core`.

---

## Features

- **Bidirectional Live Audio Streaming**: Low-latency PCM 16-bit 16kHz microphone capture streaming directly to Gemini Live API with seamless 24kHz PCM audio playback.
- **Natural Turn-Taking & Interruption (Barge-in)**: Instant barge-in support that silences the tutor immediately whenever you start speaking.
- **Speech Tutor Coaching Personas**:
  - **Friendly Conversation Coach**: Relaxed conversation with supportive feedback on fluency and word choice.
  - **Pronunciation & Accent Coach**: Focuses on phonetic clarity, syllable stress, and intonation.
  - **Job Interview Practice**: Simulates professional behavioral and technical interviews.
  - **IELTS / TOEFL Speaking Examiner**: Structured exam-style prompts with scoring criteria feedback.
- **Prebuilt Voice Selection**: Choose between Gemini voices including `Aoede`, `Puck`, `Charon`, `Fenrir`, and `Kore`.
- **Live Dual-Transcription**: Real-time streaming transcription of both the user's speech and the tutor's spoken responses.
- **Gemini Live Thinking / Reasoning**: Stream internal thoughts/deliberations to observe how the model plans its pedagogical feedback.
- **Session Resumption & Token Compression**: Automatic session continuity using resumption handles and sliding context window compression.
- **Audio Visualizer**: Dynamic pulsating waveform orb reflecting user voice input, thinking states, and tutor speech volume.

---

## Project Structure

```
├── llm-multi-provider/          # Local core LLM provider package (@llm-multi-provider/core)
│   ├── src/
│   │   ├── live.ts              # Direct Live API export module
│   │   ├── providers/
│   │   │   ├── GeminiLiveSession.ts     # Bidirectional WebSocket Gemini Live session
│   │   │   └── GeminiLiveTranscriber.ts # Dedicated streaming transcriber
│   │   └── utils/
│   │       ├── AudioUtils.ts            # PCM 16-bit, base64, and WAV utilities
│   │       └── TypedEventEmitter.ts     # Zero-dependency event emitter
├── src/
│   ├── app/
│   │   ├── layout.tsx           # App layout
│   │   └── page.tsx             # Speech Tutor Dashboard UI
│   ├── components/
│   │   └── AudioVisualizer.tsx  # Dynamic audio waveform & state visualizer
│   ├── hooks/
│   │   └── useGeminiSpeechTutor.ts # Custom React hook orchestrating live audio & session
│   └── lib/
│       ├── audio/
│       │   ├── AudioRecorder.ts # Web Audio API mic capture & 16kHz resampling
│       │   └── AudioPlayer.ts   # 24kHz seamless PCM streaming playback & barge-in
│       └── tutor/
│           └── tutorPrompts.ts  # Coaching personas and system instructions
├── .env.example                 # Environment variables template
├── .env.local                   # Local environment overrides
├── next.config.ts               # Next.js configuration (Turbopack + workspace transpilation)
├── package.json                 # Monorepo workspace configuration
└── tsconfig.json                # TypeScript aliases for app and @llm-multi-provider/core
```

---

## Getting Started

### 1. Configure your Gemini API Key

Obtain an API key from [Google AI Studio](https://aistudio.google.com/).

You can set it in `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_GEMINI_LIVE_MODEL=gemini-2.5-flash
```

*Alternatively, you can enter the API key directly into the settings drawer in the browser UI.*

### 2. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Start Practicing

1. Select your coaching persona and preferred voice.
2. Click **Start Practice Session**.
3. Allow microphone access when prompted.
4. Speak naturally to your tutor!
