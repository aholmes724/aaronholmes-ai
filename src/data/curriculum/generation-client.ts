import type { CurriculumPackage, CurriculumQuestionDraft } from "./types";
import type { QuestionGenerationRequest } from "./generation-contract";

export interface DistractorCandidateDiagnostic {
    text: string;
    misconception: string;
    whyTempting: string;
    plausibility: number | null;
    parallelism: number | null;
    testWiseResistance: number | null;
    alternativeCorrectness?: "clearly-wrong" | "arguably-correct" | "effectively-correct" | null;
    correctnessReason?: string;
    reason: string;
    passed: boolean;
}

export interface QuestionGenerationDiagnostic {
    questionId: string;
    prompt: string;
    correctAnswer: string;
    learningStage: string;
    difficulty: string;
    passedCandidateCount: number;
    outcome: "passed-distractor-gate" | "rejected-distractor-gate";
    candidates: DistractorCandidateDiagnostic[];
}

export interface GenerationDiagnostics {
    harnessVersion: string;
    qualityRecipeVersion?: string;
    promptVersion: string;
    generatedAt: string;
    targetQuestionCount: number;
    batching?: {
        batchSize: number;
        poolBatches: number;
        judgeBatches: number;
        executionMode?: string;
        judgeMode?: string;
    };
    stageTrace?: string[];
    threshold: {
        plausibility: number;
        parallelism: number;
        testWiseResistance: number;
        alternativeCorrectness?: string;
        minimumPassingDistractors: number;
    };
    models: {
        stemAndCorrectAnswer: string;
        distractorCandidates: string;
        distractorJudge: string;
        finalAssembly: string;
    };
    questions: QuestionGenerationDiagnostic[];
    summary: {
        firstPassQuestions: number;
        passedDistractorGate: number;
        rejectedAtDistractorGate: number;
        alternativeCorrectCandidatesRejected?: number;
    };
    finalAssembly?: Record<string, unknown>;
}

export interface GenerationApiResult {
    ok: boolean;
    drafts: CurriculumQuestionDraft[];
    rejectedCount: number;
    warnings: string[];
    suitability?: "allowed" | "limited" | "blocked";
    message?: string;
    provider?: string;
    model?: string;
    distractorModel?: string;
    diagnostics?: GenerationDiagnostics;
    stageTrace?: string[];
}

interface StageResponse {
    ok?: boolean;
    message?: string;
    detail?: string;
    stage?: string;
    result?: any;
    pools?: { pools?: any[] };
    scores?: { questions?: any[] };
    targetQuestionCount?: number;
    verificationTier?: "classroom" | "high-assurance";
    stageTrace?: string[];
    diagnostics?: GenerationDiagnostics;
    drafts?: CurriculumQuestionDraft[];
    rejectedCount?: number;
    warnings?: string[];
    suitability?: "allowed" | "limited" | "blocked";
    provider?: string;
    model?: string;
    distractorModel?: string;
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
const DIAGNOSTICS_KEY = "aaronholmes.generation-diagnostics";
const BATCH_SIZE = 3;

export function isQuestionGenerationConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseKey);
}

export function readGenerationDiagnostics(): GenerationDiagnostics | null {
    try {
        const raw = sessionStorage.getItem(DIAGNOSTICS_KEY);
        return raw ? JSON.parse(raw) as GenerationDiagnostics : null;
    } catch {
        return null;
    }
}

function saveGenerationDiagnostics(diagnostics?: GenerationDiagnostics): void {
    try {
        if (diagnostics) sessionStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(diagnostics));
        else sessionStorage.removeItem(DIAGNOSTICS_KEY);
    } catch {
        // Diagnostics are development-only; generation should not fail if browser storage is unavailable.
    }
}

export function exportGenerationDiagnostics(): void {
    const diagnostics = readGenerationDiagnostics();
    if (!diagnostics) return;
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `generation-diagnostics-harness-${diagnostics.harnessVersion}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function chunk<T>(items: T[], size: number): T[][] {
    const output: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        output.push(items.slice(index, index + size));
    }
    return output;
}

async function callGenerationStage(body: Record<string, unknown>): Promise<StageResponse> {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Question generation is not configured.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null) as StageResponse | null;
    if (!response.ok || !payload) {
        throw new Error(payload?.message || `Generation failed with HTTP ${response.status}.`);
    }
    return payload;
}

function failedResult(message: string, diagnostics?: GenerationDiagnostics): GenerationApiResult {
    return {
        ok: false,
        drafts: [],
        rejectedCount: 0,
        warnings: [],
        message,
        diagnostics,
    };
}

export async function generateQuestionDrafts(
    request: QuestionGenerationRequest,
): Promise<GenerationApiResult> {
    // Keep previous diagnostics until a new run successfully reaches finalization. This makes
    // a platform failure inspectable without falsely presenting stale diagnostics as current.
    if (!supabaseUrl || !supabaseKey) {
        return failedResult("Question generation is not configured.");
    }

    const stageTrace: string[] = [];

    try {
        const stemsResponse = await callGenerationStage({ ...request, stage: "stems" });
        stageTrace.push(...(stemsResponse.stageTrace ?? []).map((entry) => `stems:${entry}`));

        const result = stemsResponse.result;
        if (!result) return failedResult(stemsResponse.message || "Stem generation returned no result.");

        if (result.suitability === "blocked") {
            return {
                ok: false,
                drafts: [],
                rejectedCount: 0,
                warnings: [],
                suitability: "blocked",
                message: result.message,
                stageTrace,
            };
        }

        const questionBatches = chunk<any>(result.drafts ?? [], BATCH_SIZE);
        const allPools: any[] = [];

        for (let index = 0; index < questionBatches.length; index += 1) {
            const poolResponse = await callGenerationStage({
                ...request,
                stage: "pool",
                questions: questionBatches[index],
            });
            stageTrace.push(...(poolResponse.stageTrace ?? []).map((entry) => `pool:${index + 1}/${questionBatches.length}:${entry}`));
            allPools.push(...(poolResponse.pools?.pools ?? []));
        }

        const poolMap = new Map(allPools.map((pool: any) => [pool.questionId, pool]));
        const judgeResponses = await Promise.all(questionBatches.map(async (batch, index) => {
            const pools = batch.map((question: any) => poolMap.get(question.id)).filter(Boolean);
            const response = await callGenerationStage({
                ...request,
                stage: "judge",
                questions: batch,
                pools,
            });
            return { index, response };
        }));

        const allScores: any[] = [];
        for (const { index, response } of judgeResponses.sort((a, b) => a.index - b.index)) {
            stageTrace.push(...(response.stageTrace ?? []).map((entry) => `judge:${index + 1}/${questionBatches.length}:${entry}`));
            allScores.push(...(response.scores?.questions ?? []));
        }

        const finalResponse = await callGenerationStage({
            ...request,
            stage: "finalize",
            result,
            allPools: { pools: allPools },
            allScores: { questions: allScores },
            stageTrace,
        });

        if (finalResponse.diagnostics) saveGenerationDiagnostics(finalResponse.diagnostics);

        return {
            ok: Boolean(finalResponse.ok),
            drafts: finalResponse.drafts ?? [],
            rejectedCount: finalResponse.rejectedCount ?? 0,
            warnings: finalResponse.warnings ?? [],
            suitability: finalResponse.suitability,
            message: finalResponse.message,
            provider: finalResponse.provider,
            model: finalResponse.model,
            distractorModel: finalResponse.distractorModel,
            diagnostics: finalResponse.diagnostics,
            stageTrace: finalResponse.stageTrace,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Question generation failed.";
        return failedResult(message);
    }
}

export function mergeGeneratedDrafts(
    curriculum: CurriculumPackage,
    drafts: CurriculumQuestionDraft[],
): CurriculumPackage {
    return {
        ...curriculum,
        questionDrafts: drafts,
    };
}
