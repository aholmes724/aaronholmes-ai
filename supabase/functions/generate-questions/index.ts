const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const DISTRACTOR_MODEL = "gpt-5.4";
const HARNESS_VERSION = "1.8.4";
const PROMPT_VERSION = "2026-08-28.4";
const MAX_SOURCE_CHARS = 60_000;
const MAX_QUESTIONS = 30;
const PLAUSIBILITY_THRESHOLD = 3;
const PARALLELISM_THRESHOLD = 4;
const TEST_WISE_RESISTANCE_THRESHOLD = 4;

type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

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

async function callStructuredModel(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  schemaName: string,
  options: { model?: string; reasoningEffort?: ReasoningEffort } = {},
) {
  const payload: any = {
    model: options.model ?? DEFAULT_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
  };
  if (options.reasoningEffort) payload.reasoning = { effort: options.reasoningEffort };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI generation failed", response.status, detail);
    throw new Error(`Model generation failed (${response.status}).`);
  }

  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error("The model returned no structured output.");
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error("The model returned invalid structured output.");
  }
}

function baseQuestionSchema(sourceIds: string[], objectiveIds: string[], conceptIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "id", "semanticKey", "prompt", "answers", "topic", "conceptIds", "masteryConcept",
      "learningObjectiveId", "difficulty", "learningStage", "explanation", "sourceId",
      "sourceReference", "sourceEvidence",
    ],
    properties: {
      id: { type: "string" },
      semanticKey: { type: "string" },
      prompt: { type: "string" },
      answers: {
        type: "array", minItems: 4, maxItems: 4,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "text", "correct", "feedback"],
          properties: {
            id: { type: "string" }, text: { type: "string" },
            correct: { type: "boolean" }, feedback: { type: "string" },
          },
        },
      },
      topic: { type: "string" },
      conceptIds: { type: "array", minItems: 1, items: { type: "string", enum: conceptIds } },
      masteryConcept: { type: "string", enum: conceptIds },
      learningObjectiveId: { type: "string", enum: objectiveIds },
      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
      learningStage: { type: "string", enum: ["recognition", "understanding", "application"] },
      explanation: { type: "string" },
      sourceId: { type: "string", enum: sourceIds },
      sourceReference: { type: "string" },
      sourceEvidence: {
        type: "object", additionalProperties: false,
        required: ["sourceId", "reference", "excerpt", "locator"],
        properties: {
          sourceId: { type: "string", enum: sourceIds },
          reference: { type: "string" }, excerpt: { type: "string" }, locator: { type: "string" },
        },
      },
    },
  };
}

function normalizeDrafts(result: any, request: any, verificationTier: "classroom" | "high-assurance") {
  const sourceIds = new Set((request.curriculum?.sources ?? []).map((s: any) => s.id));
  const objectiveIds = new Set((request.curriculum?.learningObjectives ?? []).map((o: any) => o.id));
  const conceptIds = new Set((request.curriculum?.concepts ?? []).map((c: any) => c.id));
  const accepted: any[] = [];
  let rejectedCount = 0;
  const warnings: string[] = [];

  for (const [index, raw] of (result?.drafts ?? []).entries()) {
    const answers = Array.isArray(raw.answers) ? raw.answers : [];
    const evidence = raw.sourceEvidence;
    const valid =
      typeof raw.prompt === "string" && raw.prompt.trim().length >= 12 &&
      answers.length === 4 && answers.filter((a: any) => a?.correct === true).length === 1 &&
      sourceIds.has(raw.sourceId) && objectiveIds.has(raw.learningObjectiveId) &&
      conceptIds.has(raw.masteryConcept) && Array.isArray(raw.conceptIds) && raw.conceptIds.length > 0 &&
      raw.conceptIds.every((id: string) => conceptIds.has(id)) && evidence &&
      evidence.sourceId === raw.sourceId && typeof evidence.excerpt === "string" &&
      evidence.excerpt.trim().length >= 12 && typeof raw.explanation === "string" &&
      raw.explanation.trim().length >= 30;

    if (!valid) {
      rejectedCount++;
      warnings.push(`Draft ${index + 1} failed grounding or shape checks and was rejected.`);
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
        model: DEFAULT_MODEL,
        harnessVersion: HARNESS_VERSION,
        promptVersion: PROMPT_VERSION,
        verificationTier,
      },
    });
  }
  return { accepted, rejectedCount, warnings };
}

function candidatePasses(score: any): boolean {
  return Boolean(
    score &&
    score.plausibility >= PLAUSIBILITY_THRESHOLD &&
    score.parallelism >= PARALLELISM_THRESHOLD &&
    score.testWiseResistance >= TEST_WISE_RESISTANCE_THRESHOLD,
  );
}

function buildDiagnostics(result: any, pools: any, scores: any, targetQuestionCount: number) {
  const poolMap = new Map((pools?.pools ?? []).map((p: any) => [p.questionId, p.candidates ?? []]));
  const scoreMap = new Map((scores?.questions ?? []).map((q: any) => [q.questionId, q.candidates ?? []]));

  const questions = (result?.drafts ?? []).map((draft: any) => {
    const correctAnswer = (draft.answers ?? []).find((a: any) => a.correct === true)?.text ?? "";
    const pool: any[] = poolMap.get(draft.id) ?? [];
    const scored: any[] = scoreMap.get(draft.id) ?? [];
    const candidates = pool.map((candidate: any) => {
      const score = scored.find((item: any) => item.text === candidate.text);
      return {
        text: candidate.text,
        misconception: candidate.misconception,
        whyTempting: candidate.whyTempting,
        plausibility: score?.plausibility ?? null,
        parallelism: score?.parallelism ?? null,
        testWiseResistance: score?.testWiseResistance ?? null,
        reason: score?.reason ?? "No matching judge score returned.",
        passed: candidatePasses(score),
      };
    });
    const passedCandidateCount = candidates.filter((candidate: any) => candidate.passed).length;
    return {
      questionId: draft.id,
      prompt: draft.prompt,
      correctAnswer,
      learningStage: draft.learningStage,
      difficulty: draft.difficulty,
      passedCandidateCount,
      outcome: passedCandidateCount >= 3 ? "passed-distractor-gate" : "rejected-distractor-gate",
      candidates,
    };
  });

  return {
    harnessVersion: HARNESS_VERSION,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    targetQuestionCount,
    threshold: {
      plausibility: PLAUSIBILITY_THRESHOLD,
      parallelism: PARALLELISM_THRESHOLD,
      testWiseResistance: TEST_WISE_RESISTANCE_THRESHOLD,
      minimumPassingDistractors: 3,
    },
    models: {
      stemAndCorrectAnswer: DEFAULT_MODEL,
      distractorCandidates: DISTRACTOR_MODEL,
      distractorJudge: `${DEFAULT_MODEL} (high reasoning)`,
      finalAssembly: DEFAULT_MODEL,
    },
    questions,
    summary: {
      firstPassQuestions: questions.length,
      passedDistractorGate: questions.filter((q: any) => q.outcome === "passed-distractor-gate").length,
      rejectedAtDistractorGate: questions.filter((q: any) => q.outcome === "rejected-distractor-gate").length,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ message: "OPENAI_API_KEY is not configured on the server." }, 500);

  let request: any;
  try { request = await req.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }

  const sourceText = typeof request?.sourceText === "string" ? request.sourceText.trim() : "";
  const curriculum = request?.curriculum;
  const targetQuestionCount = Math.min(Math.max(Number(request?.targetQuestionCount) || 8, 3), MAX_QUESTIONS);
  const verificationTier = request?.verificationTier === "high-assurance" ? "high-assurance" : "classroom";

  if (!curriculum || !sourceText) return json({ message: "Curriculum and source text are required." }, 400);
  if (sourceText.length > MAX_SOURCE_CHARS) return json({ message: `Source is too large for this beta (${MAX_SOURCE_CHARS} character limit).` }, 413);
  if (!Array.isArray(curriculum.sources) || !Array.isArray(curriculum.concepts) || !Array.isArray(curriculum.learningObjectives)) {
    return json({ message: "Curriculum structure is invalid." }, 400);
  }

  const sourceIds = curriculum.sources.map((s: any) => s.id);
  const objectiveIds = curriculum.learningObjectives.map((o: any) => o.id);
  const conceptIds = curriculum.concepts.map((c: any) => c.id);
  const questionSchema = baseQuestionSchema(sourceIds, objectiveIds, conceptIds);

  const generationSchema = {
    type: "object", additionalProperties: false,
    required: ["suitability", "message", "drafts"],
    properties: {
      suitability: { type: "string", enum: ["allowed", "limited", "blocked"] },
      message: { type: "string" },
      drafts: { type: "array", maxItems: targetQuestionCount, items: questionSchema },
    },
  };

  const candidateSchema = {
    type: "object", additionalProperties: false,
    required: ["questionId", "candidates"],
    properties: {
      questionId: { type: "string" },
      candidates: {
        type: "array", minItems: 6, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["text", "misconception", "whyTempting"],
          properties: {
            text: { type: "string" }, misconception: { type: "string" }, whyTempting: { type: "string" },
          },
        },
      },
    },
  };
  const poolSchema = {
    type: "object", additionalProperties: false, required: ["pools"],
    properties: { pools: { type: "array", maxItems: targetQuestionCount, items: candidateSchema } },
  };

  const scoredCandidateSchema = {
    type: "object", additionalProperties: false,
    required: ["text", "plausibility", "parallelism", "testWiseResistance", "reason"],
    properties: {
      text: { type: "string" },
      plausibility: { type: "integer", minimum: 1, maximum: 5 },
      parallelism: { type: "integer", minimum: 1, maximum: 5 },
      testWiseResistance: { type: "integer", minimum: 1, maximum: 5 },
      reason: { type: "string" },
    },
  };
  const scoredQuestionSchema = {
    type: "object", additionalProperties: false, required: ["questionId", "candidates"],
    properties: {
      questionId: { type: "string" },
      candidates: { type: "array", minItems: 6, maxItems: 8, items: scoredCandidateSchema },
    },
  };
  const scoreSchema = {
    type: "object", additionalProperties: false, required: ["questions"],
    properties: { questions: { type: "array", maxItems: targetQuestionCount, items: scoredQuestionSchema } },
  };
  const assemblySchema = {
    type: "object", additionalProperties: false,
    required: ["suitability", "message", "drafts"],
    properties: {
      suitability: { type: "string", enum: ["allowed", "limited", "blocked"] },
      message: { type: "string" },
      drafts: { type: "array", maxItems: targetQuestionCount, items: questionSchema },
    },
  };

  const tierRules = verificationTier === "high-assurance"
    ? "High-assurance: omit any item whose correct answer is not strongly entailed by the supplied source. This is strict grounding, not external fact-checking."
    : "Classroom: treat the supplied curriculum as the instructional authority and ground every answer directly in it.";

  const systemPrompt = `Generate grounded multiple-choice question STEMS and correct answers for a learning app. ${tierRules}\nAssume a bright, test-wise learner. Prefer application, diagnosis, comparison, transfer, and tradeoffs. A few recall items are fine. Keep learner-facing wording independent of curriculum structure. Use only the supplied source for factual claims. Provide four answers for schema compatibility, but this is a provisional first pass: focus on a strong prompt, one defensible correct answer, grounding, and explanation. Do not spend effort polishing distractors; later stages will replace them. Quality beats count.`;

  let result: any;
  try {
    result = await callStructuredModel(
      apiKey,
      systemPrompt,
      JSON.stringify({
        curriculum: {
          id: curriculum.id,
          title: curriculum.title,
          sources: curriculum.sources,
          concepts: curriculum.concepts,
          learningObjectives: curriculum.learningObjectives,
        },
        targetQuestionCount,
        verificationTier,
        sourceText,
      }),
      generationSchema,
      "grounded_question_stems",
    );
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Question generation failed." }, 502);
  }

  if (result.suitability === "blocked") {
    return json({
      ok: false, drafts: [], rejectedCount: 0, warnings: [], suitability: "blocked",
      message: result.message, provider: "openai", model: DEFAULT_MODEL,
    });
  }

  const poolPrompt = `You are a specialist assessment-item distractor writer. For each supplied question, IGNORE its provisional wrong answers. Keep the prompt and correct answer fixed. Generate 6-8 candidate WRONG answers from realistic partial knowledge. Each candidate must represent a specific misconception: nearby-concept confusion, right principle at wrong scope, wrong constraint optimization, partially correct action missing one requirement, default defeated by an exception, or realistic operational shortcut. No jokes, nonsense, reckless behavior, category mismatches, or common-sense wrong answers. Avoid giveaway absolutes. Match the correct answer's grammar, specificity, professionalism, and approximate length. Stay within the supplied source. Prefer distractors that would tempt a learner who understands much of the material but confuses two nearby concepts or applies the correct principle in the wrong context.`;

  let pools: any;
  try {
    pools = await callStructuredModel(
      apiKey,
      poolPrompt,
      JSON.stringify({ sourceText, questions: result.drafts }),
      poolSchema,
      "distractor_candidate_pools",
      { model: DISTRACTOR_MODEL },
    );
  } catch {
    return json({ message: "Distractor candidate generation failed; no first-pass questions were accepted." }, 502);
  }

  const scorePrompt = `You are a skeptical assessment psychometrics reviewer. Score each candidate WITHOUT rewriting it. Plausibility 5 means a substantially-but-incompletely informed learner could sincerely choose it; 1 means absurd, irrelevant, or common-sense wrong. Parallelism 5 means same conceptual level, grammar, specificity, and length as the correct answer. Test-wise resistance 5 means no easy elimination cue. Be harsh and score the actual answer text, not its claimed rationale.`;

  let scores: any;
  try {
    scores = await callStructuredModel(
      apiKey,
      scorePrompt,
      JSON.stringify({ sourceText, questions: result.drafts, pools: pools.pools }),
      scoreSchema,
      "distractor_candidate_scores",
      { reasoningEffort: "high" },
    );
  } catch {
    return json({ message: "Distractor scoring failed; no questions were accepted." }, 502);
  }

  const diagnostics = buildDiagnostics(result, pools, scores, targetQuestionCount);
  const scoreMap = new Map((scores.questions ?? []).map((q: any) => [q.questionId, q.candidates]));
  const poolMap = new Map((pools.pools ?? []).map((p: any) => [p.questionId, p.candidates]));
  const qualified: any[] = [];

  for (const draft of result.drafts ?? []) {
    const scored: any[] = (scoreMap.get(draft.id) ?? []).filter((c: any) => candidatePasses(c));
    const originals: any[] = poolMap.get(draft.id) ?? [];
    const selected = scored.slice(0, 5).map((s: any) => ({
      ...s,
      misconception: originals.find((o: any) => o.text === s.text)?.misconception ?? "",
      whyTempting: originals.find((o: any) => o.text === s.text)?.whyTempting ?? "",
    }));
    if (selected.length >= 3) qualified.push({ draft, qualifiedDistractors: selected });
  }

  if (!qualified.length) {
    return json({
      ok: false,
      drafts: [],
      rejectedCount: (result.drafts ?? []).length,
      warnings: ["No question had three distractors that passed the independent quality thresholds."],
      suitability: result.suitability,
      message: "Generation completed, but distractor quality was below threshold. Export generation diagnostics to inspect candidate scores.",
      provider: "openai",
      model: DEFAULT_MODEL,
      distractorModel: DISTRACTOR_MODEL,
      verificationTier,
      diagnostics,
    });
  }

  const assemblyPrompt = `You are the final assessment editor. Assemble only supplied qualified questions. Preserve id, semanticKey, grounding IDs, source evidence, and correct-answer meaning. Choose exactly THREE supplied qualified distractors; invent none. Keep four choices and exactly one correct. Lightly edit wording only for parallelism without changing meaning. If test-taking cues still reveal the answer, OMIT the question.`;

  let assembled: any;
  try {
    assembled = await callStructuredModel(
      apiKey,
      assemblyPrompt,
      JSON.stringify({ sourceText, qualified }),
      assemblySchema,
      "assembled_quality_questions",
    );
  } catch {
    return json({ message: "Final question assembly failed.", diagnostics }, 502);
  }

  const normalized = normalizeDrafts(assembled, request, verificationTier);
  normalized.rejectedCount += Math.max(0, (result.drafts ?? []).length - qualified.length);
  const assembledIds = new Set((assembled.drafts ?? []).map((draft: any) => draft.id));
  const finalDiagnostics = {
    ...diagnostics,
    finalAssembly: {
      qualifiedQuestionIds: qualified.map((item: any) => item.draft.id),
      assembledQuestionIds: [...assembledIds],
      omittedAfterAssemblyIds: qualified.map((item: any) => item.draft.id).filter((id: string) => !assembledIds.has(id)),
    },
  };

  return json({
    ok: normalized.accepted.length > 0,
    drafts: normalized.accepted,
    rejectedCount: normalized.rejectedCount,
    warnings: normalized.warnings,
    suitability: assembled.suitability || result.suitability,
    message: assembled.message || result.message,
    provider: "openai",
    model: DEFAULT_MODEL,
    distractorModel: DISTRACTOR_MODEL,
    verificationTier,
    diagnostics: finalDiagnostics,
  });
});