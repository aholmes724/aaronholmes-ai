const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gpt-5.4-mini";
const HARNESS_VERSION = "1.3.0";
const PROMPT_VERSION = "2026-08-27.1";
const MAX_SOURCE_CHARS = 60_000;
const MAX_QUESTIONS = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string") return response.output_text;
  const pieces: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") pieces.push(content.text);
    }
  }
  return pieces.join("");
}

function normalizeDrafts(result: any, request: any, verificationTier: "classroom" | "high-assurance") {
  const sourceIds = new Set((request.curriculum?.sources ?? []).map((source: any) => source.id));
  const objectiveIds = new Set((request.curriculum?.learningObjectives ?? []).map((objective: any) => objective.id));
  const conceptIds = new Set((request.curriculum?.concepts ?? []).map((concept: any) => concept.id));
  const accepted: any[] = [];
  let rejectedCount = 0;
  const warnings: string[] = [];

  for (const [index, raw] of (result?.drafts ?? []).entries()) {
    const answers = Array.isArray(raw.answers) ? raw.answers : [];
    const correctCount = answers.filter((answer: any) => answer?.correct === true).length;
    const evidence = raw.sourceEvidence;
    const valid =
      typeof raw.prompt === "string" && raw.prompt.trim().length >= 12 &&
      answers.length >= 3 && answers.length <= 5 &&
      correctCount === 1 &&
      sourceIds.has(raw.sourceId) &&
      objectiveIds.has(raw.learningObjectiveId) &&
      conceptIds.has(raw.masteryConcept) &&
      Array.isArray(raw.conceptIds) && raw.conceptIds.length > 0 && raw.conceptIds.every((id: string) => conceptIds.has(id)) &&
      evidence && evidence.sourceId === raw.sourceId && typeof evidence.excerpt === "string" && evidence.excerpt.trim().length >= 12 &&
      typeof raw.explanation === "string" && raw.explanation.trim().length >= 30;

    if (!valid) {
      rejectedCount += 1;
      warnings.push(`Draft ${index + 1} failed deterministic grounding/shape checks and was rejected.`);
      continue;
    }

    accepted.push({
      ...raw,
      version: 1,
      type: "single-select",
      validationStatus: "ai-validated",
      authorship: "ai-generated",
      shuffleAnswers: true,
      generation: {
        provider: "openai",
        model: MODEL,
        harnessVersion: HARNESS_VERSION,
        promptVersion: PROMPT_VERSION,
        verificationTier,
      },
    });
  }

  return { accepted, rejectedCount, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ message: "OPENAI_API_KEY is not configured on the server." }, 500);

  let request: any;
  try {
    request = await req.json();
  } catch {
    return json({ message: "Invalid JSON request." }, 400);
  }

  const sourceText = typeof request?.sourceText === "string" ? request.sourceText.trim() : "";
  const curriculum = request?.curriculum;
  const targetQuestionCount = Math.min(Math.max(Number(request?.targetQuestionCount) || 8, 3), MAX_QUESTIONS);
  const verificationTier = request?.verificationTier === "high-assurance" ? "high-assurance" : "classroom";

  if (!curriculum || !sourceText) return json({ message: "Curriculum and source text are required." }, 400);
  if (sourceText.length > MAX_SOURCE_CHARS) return json({ message: `Source is too large for this beta (${MAX_SOURCE_CHARS} character limit).` }, 413);
  if (!Array.isArray(curriculum.sources) || !Array.isArray(curriculum.concepts) || !Array.isArray(curriculum.learningObjectives)) {
    return json({ message: "Curriculum structure is invalid." }, 400);
  }

  const sourceIds = curriculum.sources.map((source: any) => source.id);
  const objectiveIds = curriculum.learningObjectives.map((objective: any) => objective.id);
  const conceptIds = curriculum.concepts.map((concept: any) => concept.id);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["suitability", "message", "drafts"],
    properties: {
      suitability: { type: "string", enum: ["allowed", "limited", "blocked"] },
      message: { type: "string" },
      drafts: {
        type: "array",
        maxItems: targetQuestionCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "semanticKey", "prompt", "answers", "topic", "conceptIds", "masteryConcept", "learningObjectiveId", "difficulty", "learningStage", "explanation", "sourceId", "sourceReference", "sourceEvidence"],
          properties: {
            id: { type: "string" }, semanticKey: { type: "string" }, prompt: { type: "string" },
            answers: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["id", "text", "correct", "feedback"], properties: { id: { type: "string" }, text: { type: "string" }, correct: { type: "boolean" }, feedback: { type: "string" } } } },
            topic: { type: "string" },
            conceptIds: { type: "array", minItems: 1, items: { type: "string", enum: conceptIds } },
            masteryConcept: { type: "string", enum: conceptIds },
            learningObjectiveId: { type: "string", enum: objectiveIds },
            difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            learningStage: { type: "string", enum: ["recognition", "understanding", "application"] },
            explanation: { type: "string" }, sourceId: { type: "string", enum: sourceIds }, sourceReference: { type: "string" },
            sourceEvidence: { type: "object", additionalProperties: false, required: ["sourceId", "reference", "excerpt", "locator"], properties: { sourceId: { type: "string", enum: sourceIds }, reference: { type: "string" }, excerpt: { type: "string" }, locator: { type: "string" } } },
          },
        },
      },
    },
  };

  const tierRules = verificationTier === "high-assurance"
    ? `High-assurance verification mode:\n- Be more conservative than normal classroom generation.\n- Generate a question only when the supplied source states or strongly entails the correct answer without relying on outside knowledge.\n- Prefer narrowly supported claims over broad generalizations.\n- Source evidence must directly support the precise distinction tested.\n- If wording in the source is ambiguous, incomplete, outdated, or insufficient, omit that question rather than resolve it yourself.\n- This is a stricter source-grounding tier, not independent external corroboration.`
    : `Classroom verification mode:\n- Treat the supplied curriculum as the instructional authority.\n- Ground each answer and explanation directly in that curriculum.\n- This tier is appropriate for normal public educational use and optional educator review.`;

  const systemPrompt = `You are the question-generation engine for a privacy-minimizing learning app.\n\nPrimary goal: measure and strengthen genuine understanding, not test-taking acumen. Assume a bright, test-wise learner will actively look for shortcuts and answer-pattern loopholes.\n\n${tierRules}\n\nGrounding rules:\n- Use ONLY the supplied curriculum source for factual claims.\n- Every correct answer and explanation must be directly supported by a small source excerpt returned as sourceEvidence.\n- If the source does not support a defensible question, do not invent one.\n- Use exact supplied source, concept, and learning-objective IDs.\n\nAdversarial answer-set rules:\n- Every distractor must be something a learner with partial understanding could reasonably believe. Prefer nearby concepts, common misconceptions, incomplete reasoning, or plausible troubleshooting mistakes.\n- Do not use obviously unrelated concepts merely to fill answer slots.\n- Before returning each question, ask: could a competent test-taker who does NOT know the material identify the answer from tone, grammar, specificity, qualifier words, answer length, or one option sounding uniquely professional? If yes, rewrite the answer set.\n- Do not surround one nuanced answer with categorical distractors using words such as always, never, only, every, guaranteed, must, cannot, obviously, or clearly. Such words are allowed when technically meaningful, but qualifier distribution must not reveal the answer.\n- Keep answer choices reasonably parallel in grammatical form, specificity, and length.\n- The correct answer must not systematically be the longest or most carefully qualified option.\n\nCognitive-diversity rules:\n- Prefer application, diagnosis, comparison, and transfer over pure definition recall.\n- Across a set of 8 or more questions, aim for roughly 10-20% recognition, 30-40% understanding, and 45-60% application when the source supports it.\n- Do not ask several questions that are merely paraphrases of the same distinction. Vary the reasoning task even when concepts repeat.\n- Where possible, combine related concepts in realistic scenarios so the learner must choose between plausible approaches rather than match vocabulary.\n- Recognition questions are acceptable for foundational facts, but should not dominate the set.\n\nExplanation rules:\n- Explanations should teach why the correct answer works.\n- When a distractor represents a tempting misconception, briefly explain the distinction.\n- Do not merely restate the correct option.\n\nSafety/suitability:\n- Do not convert material into procedural training that meaningfully facilitates serious physical harm, weapon construction/use, self-harm, illicit drug production, credential theft, malware deployment, sexual exploitation, or comparable wrongdoing.\n- Historical, literary, safety, defensive, scientific, and high-level educational treatment of sensitive subjects may still be suitable when the questions do not operationalize harm.\n- If the source is primarily unsuitable for question generation, return suitability=blocked and no drafts. If only portions are unsuitable, return suitability=limited and generate only safe educational questions from appropriate portions.\n\nQuestions that pass the generation harness may be used immediately by learners and remain optionally reviewable/editable by educators or authors. Human approval is not required for normal practice. Return up to the requested number of strong questions; quality is more important than hitting the count.`;

  const userPrompt = JSON.stringify({ curriculum: { id: curriculum.id, title: curriculum.title, sources: curriculum.sources, concepts: curriculum.concepts, learningObjectives: curriculum.learningObjectives }, targetQuestionCount, verificationTier, qualityGuidance: request.qualityGuidance ?? [], sourceText });

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, input: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], text: { format: { type: "json_schema", name: "grounded_question_generation", strict: true, schema } } }) });

  if (!openAiResponse.ok) { const detail = await openAiResponse.text(); console.error("OpenAI generation failed", openAiResponse.status, detail); return json({ message: `Model generation failed (${openAiResponse.status}).` }, 502); }
  const modelResponse = await openAiResponse.json();
  const outputText = extractOutputText(modelResponse);
  if (!outputText) return json({ message: "The model returned no structured output." }, 502);

  let result: any;
  try { result = JSON.parse(outputText); } catch { return json({ message: "The model returned invalid structured output." }, 502); }

  if (result.suitability === "blocked") return json({ ok: false, drafts: [], rejectedCount: 0, warnings: [], suitability: "blocked", message: result.message || "This material is not suitable for generated practice.", provider: "openai", model: MODEL });

  const normalized = normalizeDrafts(result, request, verificationTier);
  return json({ ok: normalized.accepted.length > 0, drafts: normalized.accepted, rejectedCount: normalized.rejectedCount, warnings: normalized.warnings, suitability: result.suitability, message: result.message, provider: "openai", model: MODEL, verificationTier });
});
