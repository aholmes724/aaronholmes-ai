const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gpt-5.4-mini";
const MAX_SOURCE_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 8_000;

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

const lessonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "learningGoal", "keyIdea", "blocks", "distinctions", "keyTerms", "memoryHook", "quickCheck", "sourceNote"],
  properties: {
    title: { type: "string" }, learningGoal: { type: "string" }, keyIdea: { type: "string" },
    blocks: { type: "array", minItems: 2, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string" } } } },
    distinctions: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    keyTerms: { type: "array", minItems: 3, maxItems: 8, items: { type: "object", additionalProperties: false, required: ["term", "expansion", "definition", "whyItMatters", "emphasisTerms", "priority"], properties: { term: { type: "string" }, expansion: { type: "string" }, definition: { type: "string" }, whyItMatters: { type: "string" }, emphasisTerms: { type: "array", maxItems: 3, items: { type: "string" } }, priority: { type: "string", enum: ["high", "medium"] } } } },
    memoryHook: { type: "string" },
    quickCheck: { type: "object", additionalProperties: false, required: ["prompt", "options"], properties: { prompt: { type: "string" }, options: { type: "array", minItems: 2, maxItems: 2, items: { type: "object", additionalProperties: false, required: ["id", "text", "correct", "feedback"], properties: { id: { type: "string", enum: ["a", "b"] }, text: { type: "string" }, correct: { type: "boolean" }, feedback: { type: "string" } } } } } },
    sourceNote: { type: "string" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ message: "OPENAI_API_KEY is not configured on the server." }, 500);
  let body: any;
  try { body = await req.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const curriculumTitle = typeof body?.curriculumTitle === "string" ? body.curriculumTitle.trim() : "";
  const sectionTitle = typeof body?.sectionTitle === "string" ? body.sectionTitle.trim() : "";
  const sourceText = typeof body?.sourceText === "string" ? body.sourceText.trim() : "";
  const objectivesText = typeof body?.objectivesText === "string" ? body.objectivesText.trim() : "";
  const neighboringContext = typeof body?.neighboringContext === "string" ? body.neighboringContext.trim() : "";
  if (!curriculumTitle || !sectionTitle || !sourceText) return json({ message: "Curriculum title, section title, and source text are required." }, 400);
  if (sourceText.length > MAX_SOURCE_CHARS || objectivesText.length > MAX_CONTEXT_CHARS || neighboringContext.length > MAX_CONTEXT_CHARS) return json({ message: "Lesson source material is too large for this prototype." }, 413);

  const systemPrompt = `You transform bounded curriculum evidence into one concise learner-facing mini-lesson. You are not writing an assessment and you are not summarizing curriculum-production metadata. Use ONLY the supplied source text, objectives, and neighboring context for factual claims. Never add outside facts, even if you know them. If the evidence is insufficient for a useful explanation, state the limitation in sourceNote and keep the lesson narrow rather than filling gaps.

The lesson should take roughly 3-6 minutes to read. Preserve useful source wording where it is already clear, but reorganize or explain when the source is reference-like or outline-like. Explain WHY distinctions matter, not just definitions. If the source uses clues or constraints such as Linux, shared, persistent, block, file, workload, cost, or performance, explain the relationship only when supported by the supplied evidence.

Choose 3-8 keyTerms for inline hover/tap help. This is a CURATED GLOSSARY, not an extraction of every noun or every capitalized token. Prefer technical terms a learner is likely to misunderstand, initialisms worth knowing, phrases whose technical meaning is narrower than ordinary English, and concepts whose distinction is important in this lesson. Do NOT select broad ordinary words such as storage, compute, service, server, cost, or performance unless that ordinary word itself has a specific technical meaning that must be distinguished here. Those ordinary words may still appear inside definitions or whyItMatters explanations for more specific terms such as EBS, EFS, AMI, or instance type.

When the evidence introduces a long-form name followed by a commonly used abbreviation or initialism, such as “Amazon Elastic Compute Cloud (Amazon EC2)”, make the working abbreviation the glossary term whenever practical: term “EC2”, expansion “Amazon Elastic Compute Cloud”. Do not make the long-form name the primary teaching term merely because it appears first. The UI can give the long-form introduction a lightweight “Also known as: EC2” alias treatment while later EC2 uses carry the richer teaching definition.

For each keyTerm:
- term is the exact learner-facing word or phrase to decorate. Prefer the normal working abbreviation when the source explicitly introduces one.
- expansion is the long-form expansion only when supplied evidence explicitly supports it; otherwise use an empty string. Do not put the abbreviation itself in expansion.
- definition is one concise source-grounded sentence whenever possible.
- whyItMatters explains a useful distinction or relationship in THIS lesson only when it adds value beyond the definition; otherwise use an empty string.
- emphasisTerms contains 0-3 short words/phrases already present in the definition or whyItMatters that deserve visual emphasis because they anchor the concept (for example block storage, shared file storage, boot image). Supporting emphasis does not make those phrases separate hover targets.
- priority is high for terms central to understanding this lesson and medium for useful supporting terms.

Avoid weak hover text such as “EC2 — initialism” or definitions that merely rename the term. If the supplied evidence cannot support a useful definition, omit the term from keyTerms instead of filling it with a weak label. Definitions should distinguish nearby concepts when the evidence supports that distinction. Keep hover definitions compact; put extra nuance in whyItMatters rather than making the definition paragraph-sized. The memoryHook should be a compact conceptual distinction, not a gimmicky mnemonic. Create one easy two-option retrieval check that reinforces the lesson; it does not establish mastery. Exactly one option must be correct.

Do not mention blind tests, question generation, curation rules, provenance procedures, or other curriculum-building mechanics in the learner-facing lesson unless they are themselves the subject matter.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify({ curriculumTitle, sectionTitle, sourceText, objectivesText, neighboringContext }) }], text: { format: { type: "json_schema", name: "generated_lesson", strict: true, schema: lessonSchema } } }),
  });
  if (!response.ok) { console.error("Lesson generation failed", response.status, await response.text()); return json({ message: `Lesson generation failed (${response.status}).` }, 502); }
  const outputText = extractOutputText(await response.json());
  if (!outputText) return json({ message: "The model returned no lesson." }, 502);
  try {
    const lesson = JSON.parse(outputText);
    const correctCount = lesson?.quickCheck?.options?.filter((option: any) => option?.correct === true).length ?? 0;
    if (correctCount !== 1) return json({ message: "The lesson check was not uniquely answerable." }, 502);
    return json({ lesson, model: MODEL });
  } catch { return json({ message: "The model returned invalid lesson output." }, 502); }
});
