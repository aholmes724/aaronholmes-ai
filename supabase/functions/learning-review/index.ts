const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gpt-5.4-mini";
const MAX_EXCERPT_CHARS = 8_000;

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

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "keyIdea", "clues", "memoryHook", "keyTerms", "quickCheck"],
  properties: {
    title: { type: "string" },
    keyIdea: { type: "string" },
    clues: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clue", "explanation"],
        properties: {
          clue: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    memoryHook: { type: "string" },
    keyTerms: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "expansion", "definition"],
        properties: {
          term: { type: "string" },
          expansion: { type: "string" },
          definition: { type: "string" },
        },
      },
    },
    quickCheck: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "options"],
      properties: {
        prompt: { type: "string" },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "text", "correct", "feedback"],
            properties: {
              id: { type: "string", enum: ["a", "b"] },
              text: { type: "string" },
              correct: { type: "boolean" },
              feedback: { type: "string" },
            },
          },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ message: "OPENAI_API_KEY is not configured on the server." }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ message: "Invalid JSON request." }, 400);
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const correctAnswer = typeof body?.correctAnswer === "string" ? body.correctAnswer.trim() : "";
  const sourceExcerpt = typeof body?.sourceExcerpt === "string" ? body.sourceExcerpt.trim() : "";
  const sourceReference = typeof body?.sourceReference === "string" ? body.sourceReference.trim() : "";

  if (!prompt || !correctAnswer || !sourceExcerpt || !sourceReference) {
    return json({ message: "Question, correct answer, source reference, and source excerpt are required." }, 400);
  }
  if (sourceExcerpt.length > MAX_EXCERPT_CHARS) {
    return json({ message: "Source excerpt is too large for a learning review." }, 413);
  }

  const systemPrompt = `You create a short, source-grounded teaching review after a learner answers a multiple-choice question. Your job is to TEACH, not merely restate the answer. Use only the supplied source excerpt and question context for factual claims. Explain why the decisive words or constraints in the QUESTION matter. If a word in the stem is not actually supported by the supplied source, do not invent an explanation for it; omit it from clues. Make the key idea concise and useful. The memory hook should be a compact distinction, not a gimmicky mnemonic. For initialisms or abbreviations, provide an expansion only when the supplied source or supplied explanation supports the expansion; otherwise omit that term. Create one easy two-option reinforcement check that tests the same concept in a slightly different scenario. It is for retrieval practice, not high-stakes assessment, so clarity is more important than tricky distractors. Exactly one quick-check option must be correct.`;

  const userPayload = {
    question: prompt,
    correctAnswer,
    selectedAnswer: typeof body?.selectedAnswer === "string" ? body.selectedAnswer : undefined,
    existingExplanation: typeof body?.explanation === "string" ? body.explanation : undefined,
    conceptLabel: typeof body?.conceptLabel === "string" ? body.conceptLabel : undefined,
    sourceReference,
    sourceExcerpt,
  };

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
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "learning_review",
          strict: true,
          schema: reviewSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("Learning review generation failed", response.status, await response.text());
    return json({ message: `Learning review generation failed (${response.status}).` }, 502);
  }

  const outputText = extractOutputText(await response.json());
  if (!outputText) return json({ message: "The model returned no learning review." }, 502);

  try {
    const review = JSON.parse(outputText);
    const correctCount = review?.quickCheck?.options?.filter((option: any) => option?.correct === true).length ?? 0;
    if (correctCount !== 1) return json({ message: "The reinforcement check was not uniquely answerable." }, 502);
    return json({ review, model: MODEL });
  } catch {
    return json({ message: "The model returned invalid learning-review output." }, 502);
  }
});
