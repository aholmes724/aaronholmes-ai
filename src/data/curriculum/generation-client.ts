import type { CurriculumPackage, CurriculumQuestionDraft } from "./types";
import type { QuestionGenerationRequest } from "./generation-contract";

export interface DistractorCandidateDiagnostic {
    text: string;
    misconception: string;
    whyTempting: string;
    plausibility: number | null;
    parallelism: number | null;
    testWiseResistance: number | null;
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
    promptVersion: string;
    generatedAt: string;
    targetQuestionCount: number;
    threshold: {
        plausibility: number;
        parallelism: number;
        testWiseResistance: number;
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
    };
    finalAssembly?: {
        qualifiedQuestionIds: string[];
        assembledQuestionIds: string[];
        omittedAfterAssemblyIds: string[];
    };
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
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
const DIAGNOSTICS_KEY = "aaronholmes.generation-diagnostics";

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

export async function generateQuestionDrafts(
    request: QuestionGenerationRequest,
): Promise<GenerationApiResult> {
    saveGenerationDiagnostics();

    if (!supabaseUrl || !supabaseKey) {
        return {
            ok: false,
            drafts: [],
            rejectedCount: 0,
            warnings: [],
            message: "Question generation is not configured.",
        };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(request),
    });

    const payload = (await response.json().catch(() => null)) as GenerationApiResult | null;
    if (payload?.diagnostics) saveGenerationDiagnostics(payload.diagnostics);

    if (!response.ok || !payload) {
        return {
            ok: false,
            drafts: [],
            rejectedCount: 0,
            warnings: [],
            message: payload?.message || `Generation failed with HTTP ${response.status}.`,
            diagnostics: payload?.diagnostics,
        };
    }

    return payload;
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
