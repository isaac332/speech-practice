# `@llm-multi-provider/core`

A production-ready, resilient, and fully decoupled multi-provider LLM abstraction layer built in TypeScript. Designed as a **portable, drop-in engine** for any Node.js, Next.js, or web application, it allows seamless swapping between **Google Gemini**, **OpenRouter**, **Embeddings**, and real-time **Gemini Live API** streaming with **zero application code changes**.

---

## Highlights

- 🔄 **Unified Provider Swapping:** Switch between Google Gemini, OpenRouter, and automatic Fallback providers on the fly using a single standardized interface (`ILLMProvider`).
- ⚡ **Gemini Live API:** Real-time bidirectional streaming over WebSockets (16kHz PCM audio input, 24kHz synthesized audio output, video frames, barge-in / interruption handling, and live thinking).
- 🎙️ **Live Speech Transcription:** Dedicated low-latency STT powered by `gemini-3.5-transcribe-live` or dual input/output transcriptions on live sessions.
- 🛠️ **Unified Tool Calling (Function Calling):** Define schemas once with `@google/genai` `Type` enum; the engine auto-translates them to OpenAI Strict JSON Schema for OpenRouter and handles automated execution loops.
- 🧠 **Deep Reasoning & Thinking:** Universal `ReasoningConfig` controlling thinking budgets and thought streaming across Gemini 2.5/3 and OpenRouter models (DeepSeek R1, Claude 3.7 Thinking).
- 🏷️ **Service Tiers & Precision Routing:** Effortless toggling between flex capacity (50% cost reduction), priority speed, throughput-based endpoint sorting, rolling SLA percentile filters (p50/p90), and Zero Data Retention (ZDR).
- 📐 **Strict Structured Outputs:** Guaranteed JSON Schema compliance across all models via native response schemas.
- 🧬 **Embeddings Tri-Provider:** Swap between Gemini Embedding V1/V2 (with task-specific formatting and dimension truncation), OpenRouter, and local in-process HuggingFace Transformers (zero API keys).
- 🎯 **Fast Decision / Classification Layer:** High-speed System 1 probability scoring and classification.
- 🎨 **Image Generation & Editing:** Multi-model image generation via OpenRouter.
- 📦 **Zero-Lockin Drop-In Architecture:** 100% self-contained with no project-specific coupling. Copy and drop into any project.

---

## Capability Matrix

| Feature | Google Gemini | OpenRouter | Local / Offline |
| :--- | :---: | :---: | :---: |
| **Chat & Text Generation** | ✅ (Gemini 2.5/3 Flash & Pro) | ✅ (Claude 3.7, DeepSeek R1/V3, GPT-4o/5, Llama 3.3) | — |
| **Bidirectional Live API (WebSockets)** | ✅ (Audio/Video/Text) | — | — |
| **Real-time Live Transcription** | ✅ (`gemini-3.5-transcribe-live`) | — | — |
| **Tool / Function Calling** | ✅ (Native Gemini Schema) | ✅ (Auto-mapped OpenAI Strict Schema) | — |
| **Reasoning / Chain-of-Thought** | ✅ (Thinking budget & thoughts) | ✅ (DeepSeek R1, Claude Thinking) | — |
| **Structured Output (JSON Schema)** | ✅ (`responseJsonSchema`) | ✅ (OpenAI Structured Outputs) | — |
| **Service Tiers (`flex` / `priority`)** | — | ✅ (One-line tier selection) | — |
| **Provider Routing & SLAs** | — | ✅ (Sort by price/speed, ZDR, p90 latency) | — |
| **Vector Embeddings** | ✅ (Embedding 2 & 001) | ✅ (OpenAI, Voyage, etc.) | ✅ (`@huggingface/transformers`) |
| **Decision / Probability Classifier** | — | ✅ (System 1 probability classification) | — |
| **Image Generation** | — | ✅ (DALL-E 3, Imagen 3, Flux, Midjourney) | — |

---

## Installation

```bash
npm install @llm-multi-provider/core @google/genai @huggingface/transformers
```

Set up your environment variables (in `.env` or your cloud secrets manager):

```env
# Gemini API Key (Google AI Studio)
GEMINI_API_KEY=AIzaSy...

# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-...

# (Optional) Default Embedding Provider: "gemini" | "openrouter" | "local"
EMBEDDING_PROVIDER=gemini
```

---

## 1. Quickstart & Provider Swapping

Both providers implement `ILLMProvider` and accept identical message structures, tools, and options.

```typescript
import { 
  GeminiProvider, 
  OpenRouterProvider, 
  FallbackProvider, 
  ChatAgent 
} from "@llm-multi-provider/core";

// 1. Initialize Gemini
const gemini = new GeminiProvider(process.env.GEMINI_API_KEY!, {
  mainModel: "gemini-2.5-pro",
  fastModel: "gemini-2.5-flash",
});

// 2. Initialize OpenRouter
const openRouter = new OpenRouterProvider(process.env.OPENROUTER_API_KEY!, {
  mainModel: "anthropic/claude-3.7-sonnet",
  fastModel: "meta-llama/llama-3.3-70b-instruct",
});

// 3. Or create an automatic Fallback Provider (switches on error)
const resilientProvider = new FallbackProvider(gemini, openRouter);

// 4. Mount into ChatAgent
const agent = new ChatAgent(
  resilientProvider,
  {},      // Tool implementations map
  0.0,     // Default temperature
  [],      // Tool declarations
  "You are an expert AI assistant."
);

const reply = await agent.sendMessage("Analyze the latest market indicators.");
console.log(reply);
```

---

## 2. Gemini Live API & Real-time Bidirectional Streaming

The package provides first-class, production-grade integration with the **Gemini Live API** over bidirectional WebSockets via `@google/genai`.

### 2.1 Establishing a Live Session
```typescript
import { GeminiProvider, GEMINI_LIVE_VOICES } from "@llm-multi-provider/core";

const gemini = new GeminiProvider(process.env.GEMINI_API_KEY!);

const liveSession = gemini.createLiveSession({
  model: "gemini-2.5-flash",
  responseModalities: ["AUDIO"], // "AUDIO" | "TEXT"
  speechConfig: {
    voiceName: GEMINI_LIVE_VOICES.AOEDE, // Puck, Charon, Aoede, Fenrir, Kore
    languageCode: "en-US",
  },
  systemInstruction: "You are a real-time conversational co-pilot.",
  // Real-time Chain-of-Thought reasoning
  thinkingConfig: { thinkingBudget: 1024, includeThoughts: true },
});

// Streaming event listeners
liveSession.on("open", () => console.log("Connected to Gemini Live!"));
liveSession.on("audio", (chunk) => {
  // chunk.data: Uint8Array (PCM 24kHz 16-bit mono)
  // chunk.base64: base64 audio string
  playAudioStream(chunk.data);
});
liveSession.on("text", (chunk) => {
  process.stdout.write(chunk.text);
});
liveSession.on("thought", (chunk) => {
  console.log("[Thinking]:", chunk.text);
});
liveSession.on("interrupted", () => {
  // Barge-in: user spoke while model was speaking. Discard audio buffer immediately!
  stopAudioPlayback();
});

await liveSession.connect();
liveSession.sendText("Hello! What are you capable of in real time?");
```

### 2.2 Streaming Microphone Audio & Video Frames
```typescript
import { AudioUtils } from "@llm-multi-provider/core";

// Stream raw 16kHz linear PCM audio chunks (microphone)
liveSession.sendRealtimeAudio(pcmBuffer);

// Stream video or camera frames (JPEG/WebP)
liveSession.sendRealtimeVideo(frameBase64, "image/jpeg");

// Web Audio API Helper: Convert Float32Array mic input into 16-bit PCM for Gemini
const pcm16 = AudioUtils.float32ToPcm16(audioInputEvent.inputBuffer.getChannelData(0));
liveSession.sendRealtimeAudio(pcm16);

// Signal end of audio stream
liveSession.sendAudioStreamEnd();
```

### 2.3 Dedicated Speech-to-Text Transcription (`gemini-3.5-transcribe-live`)
For pure real-time speech recognition without conversational synthesis:

```typescript
import { GeminiLiveTranscriber } from "@llm-multi-provider/core";

const transcriber = new GeminiLiveTranscriber(process.env.GEMINI_API_KEY!, {
  model: "gemini-3.5-transcribe-live",
  languageCodes: ["en-US"],
});

transcriber.onTranscript((text, isFinal) => {
  console.log(`[Transcript ${isFinal ? "FINAL" : "INTERIM"}]: ${text}`);
});

await transcriber.connect();
transcriber.sendAudioChunk(pcmMicrophoneChunk);
```

You can also enable dual transcription on any standard `GeminiLiveSession`:
```typescript
const liveSession = gemini.createLiveSession({
  inputAudioTranscription: { languageCodes: ["en-US"] },  // Transcribes user speech
  outputAudioTranscription: { languageCodes: ["en-US"] }, // Transcribes model speech
});

liveSession.on("inputTranscription", (chunk) => console.log("User said:", chunk.text));
liveSession.on("outputTranscription", (chunk) => console.log("Model said:", chunk.text));
```

### 2.4 Live Tool / Function Calling & Cancellations
Declare tools and attach implementation functions. The session will automatically execute them and send results back to the model:

```typescript
import { Type } from "@google/genai";
import { createToolbox } from "@llm-multi-provider/core";

const lookupUserTool = {
  name: "lookup_user",
  description: "Look up user profile by account ID",
  parameters: {
    type: Type.OBJECT,
    properties: {
      accountId: { type: Type.STRING },
    },
    required: ["accountId"],
  },
};

const liveSession = gemini.createLiveSession({
  tools: createToolbox([lookupUserTool]),
  toolFunctions: {
    lookup_user: async ({ accountId }) => {
      return { id: accountId, name: "Alice", tier: "Enterprise" };
    },
  },
  autoExecuteTools: true, // Auto executes & replies via session.sendToolResponse
});

liveSession.on("toolCall", ({ calls }) => {
  console.log("Model requested tool execution:", calls);
});
liveSession.on("toolCallCancellation", (ids) => {
  console.warn("Tool call was cancelled due to user interruption:", ids);
});
```

### 2.5 Session Management (Infinite Sessions & Resumption)
```typescript
const liveSession = gemini.createLiveSession({
  // 1. Context window compression to prevent token exhaustion on long sessions:
  contextWindowCompression: {
    triggerTokens: 100000,           // Trigger sliding window at 100k tokens
    slidingWindowTargetTokens: 50000 // Retain 50k tokens, preserving prompt history
  },
  // 2. Transparent session resumption:
  sessionResumption: {
    transparent: true,
    autoReconnect: true,
    maxReconnectAttempts: 5,
  }
});

// Capture latest resumption handle (valid for up to 2 hours)
liveSession.on("resumptionUpdate", (evt) => {
  console.log("Resumption handle:", evt.handle);
});

// Server warns ~60s before socket reset
liveSession.on("goAway", (evt) => {
  console.warn(`Connection closing in ${evt.timeLeft}s. Auto-resuming...`);
});
```

### 2.6 Ephemeral Auth Tokens for Client-Side Security
To prevent leaking root API keys on mobile or browser apps, generate scoped ephemeral tokens on your backend:

```typescript
const token = await gemini.createEphemeralToken({
  liveConnectConstraints: {
    model: "gemini-2.5-flash",
  },
});

// Return token.name to your frontend client
console.log("Safe ephemeral token:", token.name);
```

### 2.7 Audio Utilities & Browser Helpers
```typescript
import { AudioUtils } from "@llm-multi-provider/core";

// 1. Microphone Float32Array to 16-bit PCM
const pcm16 = AudioUtils.float32ToPcm16(float32MicBuffer);

// 2. Convert Gemini's 24kHz PCM chunks into a playable WAV Data URL
const wavDataUrl = AudioUtils.pcmToWavDataUrl(audioChunk.data, 24000);
audioElement.src = wavDataUrl;

// 3. Prepend standard 44-byte RIFF header to PCM bytes
const wavFileBytes = AudioUtils.pcmToWav(audioChunk.data, 24000);
```

---

## 3. Service Tiers & Precision Routing (OpenRouter)

Take full advantage of OpenRouter's advanced infrastructure features without changing your application code.

### 3.1 Service Tiers (`flex`, `priority`, `fast`)
```typescript
// Per-request service tier
const reply = await agent.generateContentOnce("Perform deep document review", {
  model: "openai/gpt-5",
  serviceTier: "flex" // 50% discount flex capacity
});

// Agent-level default tier
agent.setServiceTier("priority"); // All subsequent turns use priority capacity

// Model slug shortcut variants
const fastReply = await agent.generateContentOnce("Calculate totals", {
  model: "meta-llama/llama-3.3-70b-instruct:nitro" // :nitro = throughput sort + priority tier
});
```

### 3.2 Endpoint Sorting & SLA Percentiles
```typescript
const response = await agent.generateContentOnce("Real-time voice query", {
  model: "deepseek/deepseek-v3.2",
  providerRouting: {
    sort: "throughput", // "throughput" | "price" | "latency"
    preferredMinThroughput: { p90: 50 }, // >50 tokens/sec for 90% of requests
    preferredMaxLatency: { p90: 1.5 },   // <1.5s latency for 90% of requests
  }
});
```

### 3.3 Zero Data Retention (ZDR) & Distillation Enforcement
```typescript
const confidentialResponse = await agent.generateContentOnce("Process confidential patient record", {
  model: "openai/gpt-5-mini",
  providerRouting: {
    zdr: true,                    // Enforce Zero Data Retention
    dataCollection: "deny",       // Deny providers that retain training data
    enforceDistillableText: true  // Restrict to models allowing data distillation
  }
});
```

---

## 4. Unified Tool Calling (Function Calling)

Define tool schemas once using `@google/genai` `Type` enum. The package automatically converts your schemas to **OpenAI Strict JSON Schema** when calling OpenRouter, and passes them natively to Google Gemini.

```typescript
import { Type } from "@google/genai";
import { createToolbox, ChatAgent } from "@llm-multi-provider/core";

// 1. Tool Declaration
const getStockPrice = {
  name: "get_stock_price",
  description: "Fetch the latest stock price for a given ticker symbol.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticker: { type: Type.STRING, description: "Stock ticker symbol (e.g. AAPL)" },
      currency: { type: Type.STRING, description: "Currency (e.g. USD)" },
    },
    required: ["ticker"],
  },
};

// 2. Implementation Map
const toolFunctions = {
  get_stock_price: async (args: { ticker: string; currency?: string }) => {
    return { ticker: args.ticker.toUpperCase(), price: 228.50, currency: args.currency || "USD" };
  },
};

// 3. Mount in Agent
const agent = new ChatAgent(
  gemini, // Swap to openRouter seamlessly!
  toolFunctions,
  0.0,
  [createToolbox([getStockPrice])]
);

agent.setToolsEnabled(true);
const result = await agent.sendMessage("What is the current stock price of AAPL in USD?");
console.log(result);
```

---

## 5. Unified Reasoning & Thinking Engine

Control Chain-of-Thought (CoT) reasoning for Gemini 2.5/3 and OpenRouter thinking models (DeepSeek R1, Claude 3.7 Thinking) using a unified `ReasoningConfig`:

```typescript
const result = await agent.generateContentOnce("Prove the Riemann Hypothesis or provide a counter-argument", {
  reasoning: {
    effort: "high", // "max" | "xhigh" | "high" | "medium" | "low" | "minimal" | "none"
    maxTokens: 4096 // Thinking token budget
  }
});

// Retrieve reasoning tokens from conversation history
const history = await agent.getChatHistory();
const lastTurn = history[history.length - 1];
console.log("Internal Thoughts:", lastTurn.reasoning);
console.log("Final Answer:", lastTurn.content);
```

---

## 6. Strict Structured Outputs (JSON Schema)

Force guaranteed schema compliance across Gemini and OpenAI/OpenRouter structured outputs:

```typescript
import { Type } from "@google/genai";

const reportSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    riskScore: { type: Type.NUMBER },
    actionItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["summary", "riskScore", "actionItems"],
};

const jsonStr = await agent.generateContentOnce("Analyze this investment memo...", {
  responseSchema: reportSchema,
  schemaName: "investment_analysis",
});

const report = JSON.parse(jsonStr);
console.log(report.summary, report.riskScore, report.actionItems);
```

---

## 7. Embeddings Multi-Provider

Easily swap between Gemini V1/V2, OpenRouter, or Local HuggingFace embeddings using the identical `IEmbeddingProvider` interface:

```typescript
import { 
  GeminiEmbeddingProvider, 
  OpenRouterEmbeddingProvider, 
  LocalEmbeddingProvider 
} from "@llm-multi-provider/core";

// 1. Google Gemini Embedding 2 (with auto-task formatting & dimension truncation)
const geminiEmbedder = new GeminiEmbeddingProvider(process.env.GEMINI_API_KEY!, {
  model: "gemini-embedding-2",
  outputDimensionality: 768,
  autoFormatV2Tasks: true,
  taskType: "search query",
});

// 2. OpenRouter Remote Embeddings
const openRouterEmbedder = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY!, {
  model: "openai/text-embedding-3-small",
});

// 3. Local In-Process Embeddings (Zero API Keys needed)
const localEmbedder = new LocalEmbeddingProvider("Xenova/all-MiniLM-L6-v2");

// Unified Batch Embedding API
const vectors = await geminiEmbedder.embedBatch([
  "Semantic retrieval in RAG systems",
  "Vector embeddings high-dimensional search"
]);

console.log(`Generated ${vectors.length} vectors of dimension ${vectors[0].length}`);
```

---

## 8. High-Speed Decision / Classification Layer

Fast, low-latency System 1 probability classification powered by `OpenRouterDecisionProvider`:

```typescript
import { createDecisionProvider } from "@llm-multi-provider/core";

const decisionEngine = createDecisionProvider("openrouter", {
  model: "typesafe/jev-1.13",
});

const decision = await decisionEngine.classifyDecision({
  instruction: "Classify user intent: 'I want to cancel my subscription'",
  candidateLabels: ["support", "billing_cancellation", "sales"],
});

console.log("Selected label:", decision.selectedLabel);
console.log("Confidence:", decision.confidence);
console.log("Probabilities:", decision.probabilities);
```

---

## 9. Image Generation & Editing

Multi-model image generation via OpenRouter:

```typescript
import { OpenRouterImageProvider } from "@llm-multi-provider/core";

const imageProvider = new OpenRouterImageProvider(process.env.OPENROUTER_API_KEY!);

const result = await imageProvider.generateImage({
  prompt: "A modern architectural villa in the redwood forest, photorealistic 8k",
  model: "black-forest-labs/flux-1-schnell",
  aspectRatio: "16:9",
});

console.log("Image URL:", result.url);
```

---

## 10. Unified Factory Registry API

Use the built-in registry factories to instantiate any component dynamically from environment variables:

```typescript
import { 
  createLLMProvider, 
  createEmbeddingProvider, 
  createLiveSession, 
  createLiveTranscriber,
  createDecisionProvider 
} from "@llm-multi-provider/core";

// 1. LLM Provider with optional fallback
const llm = createLLMProvider("gemini", {
  fallback: "openrouter",
  model: "gemini-2.5-flash",
});

// 2. Embeddings Provider (auto-resolves from EMBEDDING_PROVIDER env or defaults to gemini)
const embedder = createEmbeddingProvider("gemini");

// 3. Live WebSocket Session
const liveSession = createLiveSession(process.env.GEMINI_API_KEY, {
  model: "gemini-2.5-flash",
});

// 4. Live Speech Transcriber
const transcriber = createLiveTranscriber(process.env.GEMINI_API_KEY);

// 5. Decision Classifier
const classifier = createDecisionProvider("openrouter");
```

---

## Drop-in Portability Guide

To drop this package into a new project:

1. Copy the `llm-multi-provider` folder into your new repository.
2. In your `package.json`, install `@google/genai` (and optionally `@huggingface/transformers` if using local offline embeddings):
   ```bash
   npm install @google/genai
   ```
3. Import directly from the folder or reference it via npm / pnpm / yarn workspaces:
   ```typescript
   import { GeminiProvider, OpenRouterProvider, ChatAgent } from "./llm-multi-provider/src";
   ```
4. Everything is self-contained. No external runtime servers, proxies, or framework-specific bindings are required.

---

## License

MIT © 2026. Built for modular, zero-lockin AI engineering.
