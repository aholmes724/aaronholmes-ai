import type { CurriculumPackage, CurriculumQuestionDraft } from "./types";
import type { QuestionGenerationRequest } from "./generation-contract";

export interface GenerationApiResult {
    ok: boolean;
    drafts: CurriculumQuestionDraft[];
    rejectedCount: number;
    warnings: string[];
    suitability?: "allowed" | "limited" | "blocked";
    message?: string;
    provider?: string;
    model?: string;
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isQuestionGenerationConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseKey);
}

export async function generateQuestionDrafts(
    request: QuestionGenerationRequest,
): Promise<GenerationApiResult> {
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
    if (!response.ok || !payload) {
        return {
            ok: false,
            drafts: [],
            rejectedCount: 0,
            warnings: [],
            message: payload?.message || `Generation failed with HTTP ${response.status}.`,
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
