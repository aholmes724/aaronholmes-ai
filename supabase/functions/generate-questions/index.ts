const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gpt-5.4-mini";
const HARNESS_VERSION = "1.7.0";
const PROMPT_VERSION = "2026-08-28.1";
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

async function callStructuredModel(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  schemaName: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI generation failed", response.status, detail);
    throw new Error(`Model generation failed (${response.status}).`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
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
      "id",
      "semanticKey",
      "prompt",
      "answers",
      "topic",
      "conceptIds",
      "masteryConcept",
      "learningObjectiveId",
      "difficulty",
      "learningStage",
      "explanation",
      "sourceId",
      "sourceReference",
      "sourceEvidence",
    ],
    properties: {
      id: { type: "string" },
      semanticKey: { type: "string" },
      prompt: { type: "string" },
      answers: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text", "correct", "feedback"],
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            correct: { type: "boolean" },
            feedback: { type: "string" },
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
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "reference", "excerpt", "locator"],
        properties: {
          sourceId: { type: "string", enum: sourceIds },
          reference: { type: "string" },
          excerpt: { type: "string" },
          locator: { type: "string" },
        },
      },
    },
  };
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
    const audit = Array.isArray(raw.distractorAudit) ? raw.distractorAudit : [];
    const wrongAnswerIds = new Set(
      answers.filter((answer: any) => answer?.correct !== true).map((answer: any) => answer?.id),
    );
    const auditedWrongAnswers = new Set(
      audit
        .filter(
          (entry: any) =>
            wrongAnswerIds.has(entry?.answerId) &&
            typeof entry?.misconception === "string" &&
            entry.misconception.trim().length >= 12 &&
            typeof entry?.whyTempting === "string" &&
            entry.whyTempting.trim().length >= 12,
        )
        .map((entry: any) => entry.answerId),
    );

    const valid =
      typeof raw.prompt === "string" && raw.prompt.trim().length >= 12 &&
      answers.length === 4 &&
      correctCount === 1 &&
      auditedWrongAnswers.size >= 2 &&
      sourceIds.has(raw.sourceId) &&
      objectiveIds.has(raw.learningObjectiveId) &&
      conceptIds.has(raw.masteryConcept) &&
      Array.isArray(raw.conceptIds) && raw.conceptIds.length > 0 && raw.conceptIds.every((id: string) => conceptIds.has(id)) &&
      evidence && evidence.sourceId === raw.sourceId && typeof evidence.excerpt === "string" && evidence.excerpt.trim().length >= 12 &&
      typeof raw.explanation === "string" && raw.explanation.trim().length >= 30;

    if (!valid) {
      rejectedCount += 1;
      warnings.push(`Draft ${index + 1} failed grounding, shape, or distractor-plausibility checks and was rejected.`);
      continue;
    }

    const { distractorAudit: _distractorAudit, ...cleanRaw } = raw;
    accepted.push({
      ...cleanRaw,
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
  if (sourceText.length > MAX_SOURCE_CHARS) {
    return json({ message: `Source is too large for this beta (${MAX_SOURCE_CHARS} character limit).` }, 413);
  }
  if (!Array.isArray(curriculum.sources) || !Array.isArray(curriculum.concepts) || !Array.isArray(curriculum.learningObjectives)) {
    return json({ message: "Curriculum structure is invalid." }, 400);
  }

  const sourceIds = curriculum.sources.map((source: any) => source.id);
  const objectiveIds = curriculum.learningObjectives.map((objective: any) => objective.id);
  const conceptIds = curriculum.concepts.map((concept: any) => concept.id);
  const questionSchema = baseQuestionSchema(sourceIds, objectiveIds, conceptIds);

  const generationSchema = {
    type: "object",
    additionalProperties: false,
    required: ["suitability", "message", "drafts"],
    properties: {
      suitability: { type: "string", enum: ["allowed", "limited", "blocked"] },
      message: { type: "string" },
      drafts: {
        type: "array",
        maxItems: targetQuestionCount,
        items: questionSchema,
      },
    },
  };

  const auditedQuestionSchema = {
    ...questionSchema,
    required: [...questionSchema.required, "distractorAudit"],
    properties: {
      ...questionSchema.properties,
      distractorAudit: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["answerId", "misconception", "whyTempting"],
          properties: {
            answerId: { type: "string" },
            misconception: { type: "string" },
            whyTempting: { type: "string" },
          },
        },
      },
    },
  };

  const reviewSchema = {
    type: "object",
    additionalProperties: false,
    required: ["suitability", "message", "drafts"],
    properties: {
      suitability: { type: "string", enum: ["allowed", "limited", "blocked"] },
      message: { type: "string" },
      drafts: {
        type: "array",
        maxItems: targetQuestionCount,
        items: auditedQuestionSchema,
      },
    },
  };

  const tierRules = verificationTier === "high-assurance"
    ? `High-assurance verification mode:\n- Be more conservative than normal classroom generation.\n- Generate a question only when the supplied source states or strongly entails the correct answer without relying on outside knowledge.\n- Prefer narrowly supported claims over broad generalizations.\n- Source evidence must directly support the precise distinction tested.\n- If wording in the source is ambiguous, incomplete, outdated, or insufficient, omit that question rather than resolve it yourself.\n- This is stricter source-grounding, not independent external corroboration.`
    : `Classroom verification mode:\n- Treat the supplied curriculum as the instructional authority.\n- Ground each answer and explanation directly in that curriculum.\n- This tier is appropriate for normal educational use and optional educator review.`;

  const systemPrompt = `You generate grounded multiple-choice questions for a learning app.\n\nPrimary goal: produce questions that measure genuine understanding rather than elimination skill. Assume a bright, test-wise learner.\n\n${tierRules}\n\nGrounding:\n- Use only the supplied curriculum source for factual claims.\n- Every correct answer and explanation must be directly supported by sourceEvidence.\n- If the source does not support a defensible question, omit it.\n- Use exact supplied source, concept, and objective IDs.\n\nLearner-facing language:\n- Questions must stand alone as subject-matter questions.\n- Never ask what the curriculum, lesson, source, module, heading, author, or learning objective says unless that structure is itself the subject.\n- Keep provenance in metadata, not in the prompt.\n\nQuestion design:\n- Prefer application, diagnosis, comparison, transfer, and tradeoff questions over pure recall.\n- Across sets of 8 or more, aim roughly for 10-20% recognition, 30-40% understanding, and 45-60% application when supported by the source.\n- A few straightforward recall questions are fine.\n- For scenarios, make constraints matter.\n- Prefer nearby concepts and realistic alternatives over unrelated vocabulary.\n- Keep answer choices parallel in grammar, specificity, and length.\n- Do not make one answer uniquely nuanced, professional, safe, or detailed.\n- Avoid obvious qualifier cues such as always, never, only, every, guaranteed, must, cannot, obviously, or clearly unless technically necessary.\n- Quality is more important than count; return fewer questions rather than pad.\n\nExplanations:\n- Explain why the correct answer works and, when useful, the key distinction from a tempting near miss.\n- Do not merely restate the answer.\n\nSafety:\n- Do not convert source material into procedural training that meaningfully facilitates serious wrongdoing or harm.\n- If the source is primarily unsuitable, return suitability=blocked and no drafts.`;

  const userPrompt = JSON.stringify({
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
      sources: curriculum.sources,
      concepts: curriculum.concepts,
      learningObjectives: curriculum.learningObjectives,
    },
    targetQuestionCount,
    verificationTier,
    qualityGuidance: request.qualityGuidance ?? [],
    sourceText,
  });

  let result: any;
  try {
    result = await callStructuredModel(
      apiKey,
      systemPrompt,
      userPrompt,
      generationSchema,
      "grounded_question_generation",
    );
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Question generation failed." }, 502);
  }

  if (result.suitability === "blocked") {
    return json({
      ok: false,
      drafts: [],
      rejectedCount: 0,
      warnings: [],
      suitability: "blocked",
      message: result.message || "This material is not suitable for generated practice.",
      provider: "openai",
      model: MODEL,
    });
  }

  const reviewerPrompt = `You are the adversarial distractor designer and assessment editor for a learning app.\n\nThe first pass has already created candidate questions. Your task is to rebuild weak answer sets from explicit misconception models. You are not required to preserve question count.\n\nFor EACH retained question, follow this process internally before writing the final choices:\n1. Identify the exact knowledge or reasoning step required for the correct answer.\n2. Invent at least three distinct partial-knowledge models a learner could hold. Each model must be a concrete mistaken rule, omitted constraint, overgeneralization, nearby-concept confusion, or inferior-but-plausible decision.\n3. Turn those models into three distractors.\n4. For each distractor, return a distractorAudit entry that states the misconception and why a partially informed learner might choose it.\n5. If you cannot produce at least TWO genuinely plausible misconceptions without leaving the supplied source's conceptual scope, DELETE THE QUESTION.\n\nHard rejection rules:\n- Reject distractors that are jokes, absurd, reckless, obviously irrelevant, category-mismatched, or wrong by ordinary common sense.\n- Reject distractors whose only rationale is that the learner 'does not know the definition,' 'might guess it,' or that the option merely 'sounds plausible.' The misconception must be specific.\n- Reject answer sets where the correct option is uniquely longer, more nuanced, safer, more professional, or more carefully qualified.\n- Reject qualifier asymmetry where several wrong answers contain words like always, never, only, every, guaranteed, must, cannot, obviously, or clearly while the correct answer does not.\n- Reject scenarios where one option obviously follows the stated requirement and the others ignore the scenario entirely. Competing options should each honor most of the scenario while failing on a subtle but meaningful dimension.\n\nPreferred distractor patterns:\n- correct principle applied to the wrong constraint;\n- correct concept confused with a nearby concept;\n- partially correct action that omits one necessary requirement;\n- valid approach that optimizes the wrong tradeoff;\n- reasonable default applied where an exception changes the answer;\n- right service or design pattern used at the wrong scope.\n\nBenchmark:\nA learner with partial knowledge should have to compare at least two plausible wrong choices with the correct answer. If ordinary test-taking technique can remove most of the options, rewrite or delete the item.\n\nPreserve grounding and exact IDs. You may rewrite prompts, answer text, feedback, explanations, difficulty, and learningStage. Preserve id and semanticKey for retained questions. Return fewer questions if needed.`;

  const reviewerUserPrompt = JSON.stringify({
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
      sources: curriculum.sources,
      concepts: curriculum.concepts,
      learningObjectives: curriculum.learningObjectives,
    },
    verificationTier,
    sourceText,
    draftsToAudit: result.drafts ?? [],
  });

  try {
    const reviewed = await callStructuredModel(
      apiKey,
      reviewerPrompt,
      reviewerUserPrompt,
      reviewSchema,
      "misconception_audited_questions",
    );
    result = {
      ...reviewed,
      suitability: reviewed.suitability || result.suitability,
      message: reviewed.message || result.message,
    };
  } catch (error) {
    console.error("Misconception audit failed; rejecting first-pass drafts instead of silently falling back.", error);
    return json({
      ok: false,
      drafts: [],
      rejectedCount: Array.isArray(result?.drafts) ? result.drafts.length : 0,
      warnings: ["The distractor-quality audit failed, so first-pass questions were not accepted."],
      suitability: result.suitability,
      message: "Question generation completed, but the distractor-quality audit failed. Please try again.",
      provider: "openai",
      model: MODEL,
      verificationTier,
    }, 502);
  }

  const normalized = normalizeDrafts(result, request, verificationTier);
  return json({
    ok: normalized.accepted.length > 0,
    drafts: normalized.accepted,
    rejectedCount: normalized.rejectedCount,
    warnings: normalized.warnings,
    suitability: result.suitability,
    message: result.message,
    provider: "openai",
    model: MODEL,
    verificationTier,
  });
});