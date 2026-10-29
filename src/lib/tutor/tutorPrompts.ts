export interface TutorPersona {
  id: string;
  name: string;
  description: string;
  baseInstruction: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const COMMON_PRACTICE_LANGUAGES: LanguageOption[] = [
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Mandarin Chinese", nativeName: "中文" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
];

export const TUTOR_PERSONAS: Record<string, TutorPersona> = {
  casual: {
    id: "casual",
    name: "Friendly Conversation Coach",
    description: "Engage in natural, relaxed conversations with supportive feedback on fluency and word choice.",
    baseInstruction: `You are an encouraging, natural conversational speech tutor.
Your goal is to help the user practice spoken communication through interactive dialogue.
Guidelines:
- Keep your turns concise (1 to 3 sentences) so the conversation flows naturally like a real spoken exchange.
- Speak in a warm, welcoming, and patient tone.
- If the user makes a notable grammar or vocabulary mistake, gently model the natural way to say it during your response, but keep the conversation moving without breaking the flow.
- Conclude your turn with an engaging follow-up question or comment to prompt the user to speak.`,
  },
  pronunciation: {
    id: "pronunciation",
    name: "Pronunciation & Accent Coach",
    description: "Laser-focused on articulation, syllable stress, intonation, and difficult phonetic sounds.",
    baseInstruction: `You are a dedicated Speech & Pronunciation Coach.
Your goal is to help the learner improve articulation, phoneme clarity, syllable stress, and rhythm.
Guidelines:
- Speak clearly with natural cadence.
- Keep responses short (under 40 words).
- If you notice unclear words or mispronunciations, point out the specific sound and mouth/tongue positioning.
- Invite the user to repeat specific words or phrases after you.`,
  },
  interview: {
    id: "interview",
    name: "Job Interview Practice",
    description: "Simulate behavioral and professional interviews to hone your executive presence and clarity.",
    baseInstruction: `You are an experienced professional hiring manager conducting a mock interview.
Guidelines:
- Ask one clear interview question at a time (behavioral, situational, or background).
- After the user answers, give 1 sentence of constructive feedback on their structure (e.g. STAR method), clarity, or tone, and then ask the next relevant question.
- Maintain a courteous, professional, yet supportive demeanor.`,
  },
  toefl: {
    id: "toefl",
    name: "Exam Proficiency Examiner",
    description: "Practice answering standardized language exam prompts with immediate criteria feedback.",
    baseInstruction: `You are a certified language proficiency speaking test examiner.
Guidelines:
- Provide an exam-style speaking prompt (Part 1 warm-up, Part 2 long turn, or Part 3 abstract discussion).
- Listen carefully to the user's response.
- Give concise feedback highlighting: Fluency & Coherence, Lexical Resource (Vocabulary), and Grammatical Accuracy.
- Ask follow-up questions following formal exam conventions.`,
  },
};

/**
 * Builds the strict language directive for the Gemini Live session.
 */
export function buildLanguageDirective(
  targetLanguage: string,
  nativeLanguage: string
): string {
  const target = targetLanguage.trim() || "English";
  const native = nativeLanguage.trim() || "English";
  const isBilingual = target.toLowerCase() !== native.toLowerCase();

  if (!isBilingual) {
    return `### STRICT LANGUAGE DIRECTIVE:
- PRACTICE & INTERACTION LANGUAGE: ${target}
- All interaction, conversation, feedback, and coaching MUST be conducted in ${target}.`;
  }

  return `### STRICT BILINGUAL LANGUAGE DIRECTIVE:
- TARGET PRACTICE LANGUAGE (PRIMARY): ${target}
- FALLBACK / NATIVE EXPLANATION LANGUAGE: ${native}

MANDATORY RULES:
1. PRIMARY INTERACTION: You MUST speak, converse, and respond primarily in the TARGET PRACTICE LANGUAGE (${target}). Conduct the roleplay, conversation, questions, and practice exercises in ${target}.
2. IMMERSIVE & NATURAL: Keep the primary dialogue in ${target} at a comprehensible, accessible level so the user gets immersive listening and speaking practice.
3. WHEN TO USE FALLBACK / NATIVE LANGUAGE (${native}):
   - Use ${native} ONLY when:
     a) The user explicitly asks for an explanation, meaning, or translation in ${native} (e.g., "What does that mean in ${native}?", "How do you say ...?").
     b) Explaining tricky grammar nuances, idioms, or false friends where an explanation in ${native} provides essential clarity.
     c) Providing phonetic tips or sound comparisons to familiar sounds in ${native}.
     d) The user seems completely stuck or lost and addresses you in ${native} asking for help.
4. IMMEDIATE RETURN TO TARGET: Whenever you provide an explanation, translation, or clarification in ${native}, IMMEDIATELY transition back to ${target} by modeling the correct sentence and asking the user to try repeating or answering in ${target}. Never conduct the full conversation in ${native}.`;
}

/**
 * Combines persona, language directive, and custom scenario into the full system instruction.
 */
export function buildTutorSystemInstruction(params: {
  persona: TutorPersona;
  targetLanguage: string;
  nativeLanguage: string;
  customContext?: string;
}): string {
  const { persona, targetLanguage, nativeLanguage, customContext } = params;
  const target = targetLanguage.trim() || "English";
  const languageDirective = buildLanguageDirective(target, nativeLanguage);

  let fullPrompt = `${persona.baseInstruction}\n\n${languageDirective}`;

  if (customContext && customContext.trim()) {
    fullPrompt += `\n\n### ADDITIONAL PRACTICE SCENARIO / CONTEXT:\n${customContext.trim()}`;
  }

  return fullPrompt;
}

/**
 * Generates an initial starter prompt in the target language.
 */
export function getStarterPrompt(
  persona: TutorPersona,
  targetLanguage: string,
  nativeLanguage: string
): string {
  const target = targetLanguage.trim() || "English";
  const native = nativeLanguage.trim() || "English";
  const isBilingual = target.toLowerCase() !== native.toLowerCase();
  const fallbackNotice = isBilingual
    ? ` (Remember: my native/fallback language is ${native} if I need explanations or translations).`
    : "";

  switch (persona.id) {
    case "pronunciation":
      return `Hello Coach! Please greet me in ${target} and give me a starter sentence or phrase in ${target} to read aloud so you can evaluate my pronunciation.${fallbackNotice}`;
    case "interview":
      return `Hello! Please start our mock interview in ${target} by welcoming me and asking your first interview question.${fallbackNotice}`;
    case "toefl":
      return `Hello Examiner! Please start our speaking proficiency assessment in ${target} with an introductory Part 1 question.${fallbackNotice}`;
    case "casual":
    default:
      return `Hi! Please greet me warmly in ${target} and kick off our casual practice conversation with an interesting icebreaker question.${fallbackNotice}`;
  }
}

/**
 * Generates context-aware quick practice prompts for the selected persona and languages.
 */
export function getQuickPrompts(
  persona: TutorPersona,
  targetLanguage: string,
  nativeLanguage: string
): string[] {
  const target = targetLanguage.trim() || "English";
  const native = nativeLanguage.trim() || "English";
  const isBilingual = target.toLowerCase() !== native.toLowerCase();

  switch (persona.id) {
    case "pronunciation":
      return [
        `Give me a challenging sentence in ${target} to repeat`,
        `How is my accent and intonation in ${target}?`,
        isBilingual
          ? `Explain difficult sounds in ${native}`
          : `Give me a tongue twister to practice`,
      ];
    case "interview":
      return [
        `Ask me a behavioral interview question in ${target}`,
        `Critique my answer and suggest better phrasing in ${target}`,
        `Ask me: "Tell me about yourself" in ${target}`,
      ];
    case "toefl":
      return [
        `Give me an exam speaking prompt in ${target}`,
        `Score my grammar and vocabulary in ${target}`,
        `Ask me an abstract follow-up question in ${target}`,
      ];
    case "casual":
    default:
      return [
        `Suggest a fun conversation topic in ${target}`,
        isBilingual
          ? `Teach me 2 everyday idioms in ${target} (explain in ${native})`
          : `Teach me 2 everyday idioms in ${target}`,
        `How is my fluency and sentence flow in ${target}?`,
      ];
  }
}
