export interface LearningReviewClue {
    clue: string;
    explanation: string;
}

export interface LearningReviewTerm {
    term: string;
    expansion: string;
    definition: string;
}

export interface LearningReviewCheckOption {
    id: "a" | "b";
    text: string;
    correct: boolean;
    feedback: string;
}

export interface LearningReview {
    title: string;
    keyIdea: string;
    clues: LearningReviewClue[];
    memoryHook: string;
    keyTerms: LearningReviewTerm[];
    quickCheck?: {
        prompt: string;
        options: LearningReviewCheckOption[];
    };
}

export interface LearningReviewRequest {
    prompt: string;
    correctAnswer: string;
    selectedAnswer?: string;
    explanation?: string;
    sourceReference: string;
    sourceExcerpt: string;
    conceptLabel?: string;
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isLearningReviewConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseKey);
}

export async function generateLearningReview(
    request: LearningReviewRequest,
): Promise<LearningReview> {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Learning review is not configured.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/learning-review`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => null) as { review?: LearningReview; message?: string } | null;
    if (!response.ok || !payload?.review) {
        throw new Error(payload?.message || `Learning review failed with HTTP ${response.status}.`);
    }

    return payload.review;
}
