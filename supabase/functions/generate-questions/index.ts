const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const DISTRACTOR_MODEL = "gpt-5.4";
const HARNESS_VERSION = "1.8.8";
const PROMPT_VERSION = "2026-08-28.8";
const MAX_SOURCE_CHARS = 60_000;
const MAX_QUESTIONS = 30;
const BATCH_SIZE = 3;
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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI generation failed", response.status, detail);
    throw new Error(`Model generation failed (${response.status}).`);
  }
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error("The model returned no structured output.");
  try { return JSON.parse(outputText); }
  catch { throw new Error("The model returned invalid structured output."); }
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}

function baseQuestionSchema(sourceIds: string[], objectiveIds: string[], conceptIds: string[]) {
  return {
    type: "object", additionalProperties: false,
    required: ["id", "semanticKey", "prompt", "answers", "topic", "conceptIds", "masteryConcept", "learningObjectiveId", "difficulty", "learningStage", "explanation", "sourceId", "sourceReference", "sourceEvidence"],
    properties: {
      id: { type: "string" }, semanticKey: { type: "string" }, prompt: { type: "string" },
      answers: {
        type: "array", minItems: 4, maxItems: 4,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "text", "correct", "feedback"],
          properties: { id: { type: "string" }, text: { type: "string" }, correct: { type: "boolean" }, feedback: { type: "string" } },
        },
      },
      topic: { type: "string" },
      conceptIds: { type: "array", minItems: 1, items: { type: "string", enum: conceptIds } },
      masteryConcept: { type: "string", enum: conceptIds },
      learningObjectiveId: { type: "string", enum: objectiveIds },
      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
      learningStage: { type: "string", enum: ["recognition", "understanding", "application"] },
      explanation: { type: "string" }, sourceId: { type: "string", enum: sourceIds }, sourceReference: { type: "string" },
      sourceEvidence: {
        type: "object", additionalProperties: false,
        required: ["sourceId", "reference", "excerpt", "locator"],
        properties: { sourceId: { type: "string", enum: sourceIds }, reference: { type: "string" }, excerpt: { type: "string" }, locator: { type: "string" } },
      },
    },
  };
}

function candidateSchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["questionId", "candidates"],
    properties: {
      questionId: { type: "string" },
      candidates: {
        type: "array", minItems: 6, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["text", "misconception", "whyTempting"],
          properties: { text: { type: "string" }, misconception: { type: "string" }, whyTempting: { type: "string" } },
        },
      },
    },
  };
}

function poolSchema(maxItems: number) {
  return {
    type: "object", additionalProperties: false, required: ["pools"],
    properties: { pools: { type: "array", maxItems, items: candidateSchema() } },
  };
}

function scoredCandidateSchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["text", "plausibility", "parallelism", "testWiseResistance", "alternativeCorrectness", "correctnessReason", "reason"],
    properties: {
      text: { type: "string" },
      plausibility: { type: "integer", minimum: 1, maximum: 5 },
      parallelism: { type: "integer", minimum: 1, maximum: 5 },
      testWiseResistance: { type: "integer", minimum: 1, maximum: 5 },
      alternativeCorrectness: { type: "string", enum: ["clearly-wrong", "arguably-correct", "effectively-correct"] },
      correctnessReason: { type: "string" },
      reason: { type: "string" },
    },
  };
}

function scoreSchema(maxItems: number) {
  return {
    type: "object", additionalProperties: false, required: ["questions"],
    properties: {
      questions: {
        type: "array", maxItems,
        items: {
          type: "object", additionalProperties: false, required: ["questionId", "candidates"],
          properties: { questionId: { type: "string" }, candidates: { type: "array", minItems: 6, maxItems: 8, items: scoredCandidateSchema() } },
        },
      },
    },
  };
}

function candidatePasses(score: any): boolean {
  return Boolean(score && score.alternativeCorrectness === "clearly-wrong" && score.plausibility >= PLAUSIBILITY_THRESHOLD && score.parallelism >= PARALLELISM_THRESHOLD && score.testWiseResistance >= TEST_WISE_RESISTANCE_THRESHOLD);
}

function normalizeDrafts(result: any, request: any, verificationTier: "classroom" | "high-assurance") {
  const sourceIds = new Set((request.curriculum?.sources ?? []).map((s: any) => s.id));
  const objectiveIds = new Set((request.curriculum?.learningObjectives ?? []).map((o: any) => o.id));
  const conceptIds = new Set((request.curriculum?.concepts ?? []).map((c: any) => c.id));
  const accepted: any[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const warnings: string[] = [];
  for (const [index, raw] of (result?.drafts ?? []).entries()) {
    const answers = Array.isArray(raw.answers) ? raw.answers : [];
    const evidence = raw.sourceEvidence;
    const valid = typeof raw.prompt === "string" && raw.prompt.trim().length >= 12 && answers.length === 4 && answers.filter((a: any) => a?.correct === true).length === 1 && sourceIds.has(raw.sourceId) && objectiveIds.has(raw.learningObjectiveId) && conceptIds.has(raw.masteryConcept) && Array.isArray(raw.conceptIds) && raw.conceptIds.length > 0 && raw.conceptIds.every((id: string) => conceptIds.has(id)) && evidence && evidence.sourceId === raw.sourceId && typeof evidence.excerpt === "string" && evidence.excerpt.trim().length >= 12 && typeof raw.explanation === "string" && raw.explanation.trim().length >= 30;
    if (!valid) {
      const id = typeof raw?.id === "string" ? raw.id : `draft-${index + 1}`;
      rejected.push({ id, reason: "Failed grounding or final shape checks." });
      warnings.push(`${id} Failed grounding or final shape checks.`);
      continue;
    }
    accepted.push({ ...raw, version: 1, type: "single-select", validationStatus: "ai-validated", authorship: "ai-generated", shuffleAnswers: true, generation: { provider: "openai", model: DEFAULT_MODEL, harnessVersion: HARNESS_VERSION, promptVersion: PROMPT_VERSION, verificationTier } });
  }
  return { accepted, rejected, warnings };
}

function buildDiagnostics(result: any, pools: any, scores: any, targetQuestionCount: number, stageTrace: string[]) {
  const poolMap = new Map((pools?.pools ?? []).map((p: any) => [p.questionId, p.candidates ?? []]));
  const scoreMap = new Map((scores?.questions ?? []).map((q: any) => [q.questionId, q.candidates ?? []]));
  const questions = (result?.drafts ?? []).map((draft: any) => {
    const correctAnswer = (draft.answers ?? []).find((a: any) => a.correct === true)?.text ?? "";
    const pool: any[] = poolMap.get(draft.id) ?? [];
    const scored: any[] = scoreMap.get(draft.id) ?? [];
    const candidates = pool.map((candidate: any) => {
      const score = scored.find((item: any) => item.text === candidate.text);
      return { text: candidate.text, misconception: candidate.misconception, whyTempting: candidate.whyTempting, plausibility: score?.plausibility ?? null, parallelism: score?.parallelism ?? null, testWiseResistance: score?.testWiseResistance ?? null, alternativeCorrectness: score?.alternativeCorrectness ?? null, correctnessReason: score?.correctnessReason ?? "No semantic-correctness judgment returned.", reason: score?.reason ?? "No matching judge score returned.", passed: candidatePasses(score) };
    });
    const passedCandidateCount = candidates.filter((c: any) => c.passed).length;
    return { questionId: draft.id, prompt: draft.prompt, correctAnswer, learningStage: draft.learningStage, difficulty: draft.difficulty, passedCandidateCount, outcome: passedCandidateCount >= 3 ? "passed-distractor-gate" : "rejected-distractor-gate", candidates };
  });
  return {
    harnessVersion: HARNESS_VERSION, promptVersion: PROMPT_VERSION, generatedAt: new Date().toISOString(), targetQuestionCount,
    batching: { batchSize: BATCH_SIZE, poolBatches: Math.ceil((result?.drafts?.length ?? 0) / BATCH_SIZE), judgeBatches: Math.ceil((result?.drafts?.length ?? 0) / BATCH_SIZE), judgeMode: "concurrent" },
    stageTrace,
    threshold: { plausibility: PLAUSIBILITY_THRESHOLD, parallelism: PARALLELISM_THRESHOLD, testWiseResistance: TEST_WISE_RESISTANCE_THRESHOLD, alternativeCorrectness: "clearly-wrong", minimumPassingDistractors: 3 },
    models: { stemAndCorrectAnswer: DEFAULT_MODEL, distractorCandidates: DISTRACTOR_MODEL, distractorJudge: `${DEFAULT_MODEL} (high reasoning)`, finalAssembly: "deterministic code" },
    questions,
    summary: { firstPassQuestions: questions.length, passedDistractorGate: questions.filter((q: any) => q.outcome === "passed-distractor-gate").length, rejectedAtDistractorGate: questions.filter((q: any) => q.outcome === "rejected-distractor-gate").length, alternativeCorrectCandidatesRejected: questions.reduce((n: number, q: any) => n + q.candidates.filter((c: any) => c.alternativeCorrectness !== "clearly-wrong").length, 0) },
  };
}

function assembleDeterministically(result: any, pools: any, scores: any) {
  const scoreMap = new Map((scores?.questions ?? []).map((q: any) => [q.questionId, q.candidates ?? []]));
  const poolMap = new Map((pools?.pools ?? []).map((p: any) => [p.questionId, p.candidates ?? []]));
  const drafts: any[] = [];
  const qualifiedQuestionIds: string[] = [];
  const selectedByQuestion: Record<string, string[]> = {};

  for (const draft of result?.drafts ?? []) {
    const scored: any[] = (scoreMap.get(draft.id) ?? []).filter((c: any) => candidatePasses(c));
    if (scored.length < 3) continue;
    qualifiedQuestionIds.push(draft.id);
    const ranked = [...scored].sort((a, b) => {
      const totalA = a.plausibility + a.parallelism + a.testWiseResistance;
      const totalB = b.plausibility + b.parallelism + b.testWiseResistance;
      return totalB - totalA || b.plausibility - a.plausibility || b.testWiseResistance - a.testWiseResistance;
    });
    const selected = ranked.slice(0, 3);
    selectedByQuestion[draft.id] = selected.map((c: any) => c.text);
    const correct = (draft.answers ?? []).find((a: any) => a.correct === true);
    if (!correct) continue;
    const originals: any[] = poolMap.get(draft.id) ?? [];
    const answers = [
      { ...correct, id: "a", correct: true },
      ...selected.map((candidate: any, index: number) => {
        const original = originals.find((o: any) => o.text === candidate.text);
        return { id: ["b", "c", "d"][index], text: candidate.text, correct: false, feedback: original?.misconception ? `Not quite. ${original.misconception}` : "This option reflects a plausible misconception, but it does not best answer the question." };
      }),
    ];
    drafts.push({ ...draft, answers });
  }
  return { drafts, qualifiedQuestionIds, selectedByQuestion };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ message: "OPENAI_API_KEY is not configured on the server." }, 500);

  const stageTrace: string[] = [];
  const mark = (stage: string) => {
    stageTrace.push(stage);
    console.log(`[${HARNESS_VERSION}] ${stage}`);
  };

  let request: any;
  try { request = await req.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const sourceText = typeof request?.sourceText === "string" ? request.sourceText.trim() : "";
  const curriculum = request?.curriculum;
  const targetQuestionCount = Math.min(Math.max(Number(request?.targetQuestionCount) || 8, 3), MAX_QUESTIONS);
  const verificationTier = request?.verificationTier === "high-assurance" ? "high-assurance" : "classroom";
  if (!curriculum || !sourceText) return json({ message: "Curriculum and source text are required." }, 400);
  if (sourceText.length > MAX_SOURCE_CHARS) return json({ message: `Source is too large for this beta (${MAX_SOURCE_CHARS} character limit).` }, 413);
  if (!Array.isArray(curriculum.sources) || !Array.isArray(curriculum.concepts) || !Array.isArray(curriculum.learningObjectives)) return json({ message: "Curriculum structure is invalid." }, 400);

  const sourceIds = curriculum.sources.map((s: any) => s.id);
  const objectiveIds = curriculum.learningObjectives.map((o: any) => o.id);
  const conceptIds = curriculum.concepts.map((c: any) => c.id);
  const questionSchema = baseQuestionSchema(sourceIds, objectiveIds, conceptIds);
  const generationSchema = { type: "object", additionalProperties: false, required: ["suitability", "message", "drafts"], properties: { suitability: { type: "string", enum: ["allowed", "limited", "blocked"] }, message: { type: "string" }, drafts: { type: "array", maxItems: targetQuestionCount, items: questionSchema } } };

  const tierRules = verificationTier === "high-assurance" ? "High-assurance: omit any item whose correct answer is not strongly entailed by the supplied source. This is strict grounding, not external fact-checking." : "Classroom: treat the supplied curriculum as the instructional authority and ground every answer directly in it.";
  const systemPrompt = `Generate grounded multiple-choice question STEMS and correct answers for a learning app. ${tierRules}\nAssume a bright, test-wise learner. Prefer application, diagnosis, comparison, transfer, and tradeoffs. A few recall items are fine. Keep learner-facing wording independent of curriculum structure. Use only the supplied source for factual claims. Provide four answers for schema compatibility, but this is a provisional first pass: focus on a strong prompt, one defensible correct answer, grounding, and explanation. Do not spend effort polishing distractors; later stages will replace them. Quality beats count.`;

  mark("stems:start");
  let result: any;
  try {
    result = await callStructuredModel(apiKey, systemPrompt, JSON.stringify({ curriculum: { id: curriculum.id, title: curriculum.title, sources: curriculum.sources, concepts: curriculum.concepts, learningObjectives: curriculum.learningObjectives }, targetQuestionCount, verificationTier, sourceText }), generationSchema, "grounded_question_stems");
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Question generation failed.", stageTrace }, 502);
  }
  mark(`stems:complete:${result?.drafts?.length ?? 0}`);
  if (result.suitability === "blocked") return json({ ok: false, drafts: [], rejectedCount: 0, warnings: [], suitability: "blocked", message: result.message, provider: "openai", model: DEFAULT_MODEL, stageTrace });

  const poolPrompt = `You are a specialist assessment-item distractor writer. For each supplied question, IGNORE its provisional wrong answers. Keep the prompt and correct answer fixed. Generate 6-8 candidate WRONG answers from realistic partial knowledge. Each candidate must represent a specific misconception: nearby-concept confusion, right principle at wrong scope, wrong constraint optimization, partially correct action missing one requirement, default defeated by an exception, or realistic operational shortcut. No jokes, nonsense, reckless behavior, category mismatches, or common-sense wrong answers. Avoid giveaway absolutes. Match the correct answer's grammar, specificity, professionalism, and approximate length. Stay within the supplied source. Prefer distractors that would tempt a learner who understands much of the material but confuses two nearby concepts or applies the correct principle in the wrong context. Do not intentionally generate a paraphrase or alternate formulation that could also correctly answer the question.`;

  const questionBatches = chunks<any>(result.drafts ?? [], BATCH_SIZE);
  const pools: any = { pools: [] };
  for (let i = 0; i < questionBatches.length; i++) {
    const batch = questionBatches[i];
    mark(`pool:${i + 1}/${questionBatches.length}:start`);
    try {
      const batchResult = await callStructuredModel(apiKey, poolPrompt, JSON.stringify({ sourceText, questions: batch }), poolSchema(batch.length), `distractor_candidate_pools_${i + 1}`, { model: DISTRACTOR_MODEL });
      pools.pools.push(...(batchResult.pools ?? []));
      mark(`pool:${i + 1}/${questionBatches.length}:complete`);
    } catch (error) {
      return json({ message: `Distractor candidate generation failed in batch ${i + 1}.`, detail: error instanceof Error ? error.message : undefined, stageTrace }, 502);
    }
  }

  const scorePrompt = `You are a skeptical assessment psychometrics reviewer. Score each candidate WITHOUT rewriting it. Plausibility 5 means a substantially-but-incompletely informed learner could sincerely choose it; 1 means absurd, irrelevant, or common-sense wrong. Parallelism 5 means same conceptual level, grammar, specificity, and length as the correct answer. Test-wise resistance 5 means no easy elimination cue. Also classify semantic correctness: clearly-wrong means the option is genuinely incorrect for this exact question; arguably-correct means a reasonable expert could defend it as answering the question; effectively-correct means it is a paraphrase, equivalent answer, or substantively correct alternative. Be especially alert to distractors that are attractive because they are actually correct. A candidate can score highly on plausibility and test-wise resistance and still be disqualified for alternative correctness. Be harsh and score the actual answer text, not its claimed rationale.`;

  const poolMap = new Map((pools.pools ?? []).map((p: any) => [p.questionId, p]));
  const scores: any = { questions: [] };
  mark(`judge:concurrent:start:${questionBatches.length}`);
  try {
    const batchResults = await Promise.all(questionBatches.map(async (batch, i) => {
      const batchPools = batch.map((q: any) => poolMap.get(q.id)).filter(Boolean);
      mark(`judge:${i + 1}/${questionBatches.length}:start`);
      const batchResult = await callStructuredModel(
        apiKey,
        scorePrompt,
        JSON.stringify({ sourceText, questions: batch, pools: batchPools }),
        scoreSchema(batch.length),
        `distractor_candidate_scores_${i + 1}`,
        { reasoningEffort: "high" },
      );
      mark(`judge:${i + 1}/${questionBatches.length}:complete`);
      return batchResult;
    }));
    for (const batchResult of batchResults) scores.questions.push(...(batchResult.questions ?? []));
    mark(`judge:concurrent:complete:${scores.questions.length}`);
  } catch (error) {
    const partialDiagnostics = buildDiagnostics(result, pools, scores, targetQuestionCount, stageTrace);
    return json({ message: "Concurrent distractor scoring failed.", detail: error instanceof Error ? error.message : undefined, diagnostics: partialDiagnostics, stageTrace }, 502);
  }

  mark("assembly:start");
  const diagnostics = buildDiagnostics(result, pools, scores, targetQuestionCount, stageTrace);
  const assembled = assembleDeterministically(result, pools, scores);
  mark(`assembly:complete:${assembled.drafts.length}`);
  if (!assembled.drafts.length) {
    return json({ ok: false, drafts: [], rejectedCount: (result.drafts ?? []).length, warnings: ["No question had three distractors that passed the independent quality and semantic-correctness thresholds."], suitability: result.suitability, message: "Generation completed, but distractor quality was below threshold. Export generation diagnostics to inspect candidate scores.", provider: "openai", model: DEFAULT_MODEL, distractorModel: DISTRACTOR_MODEL, verificationTier, diagnostics: { ...diagnostics, stageTrace, finalAssembly: { mode: "deterministic", qualifiedQuestionIds: [], acceptedQuestionIds: [], selectedDistractors: {} } } });
  }

  const normalized = normalizeDrafts({ drafts: assembled.drafts }, request, verificationTier);
  const acceptedIds = new Set(normalized.accepted.map((draft: any) => draft.id));
  const gateRejectedCount = Math.max(0, (result.drafts ?? []).length - assembled.qualifiedQuestionIds.length);
  const finalRejectedIds = assembled.qualifiedQuestionIds.filter((id: string) => !acceptedIds.has(id));
  mark(`validation:complete:${normalized.accepted.length}`);
  const finalDiagnostics = { ...diagnostics, stageTrace, finalAssembly: { mode: "deterministic", qualifiedQuestionIds: assembled.qualifiedQuestionIds, acceptedQuestionIds: [...acceptedIds], selectedDistractors: assembled.selectedByQuestion, validationRejections: normalized.rejected } };

  return json({ ok: normalized.accepted.length > 0, drafts: normalized.accepted, rejectedCount: gateRejectedCount + finalRejectedIds.length, warnings: normalized.warnings, suitability: result.suitability, message: `${normalized.accepted.length} question${normalized.accepted.length === 1 ? "" : "s"} assembled deterministically after concurrent distractor qualification.`, provider: "openai", model: DEFAULT_MODEL, distractorModel: DISTRACTOR_MODEL, verificationTier, diagnostics: finalDiagnostics, stageTrace });
});
