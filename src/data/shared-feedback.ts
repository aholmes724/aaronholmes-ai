import type { QuestionFeedback, QuestionFeedbackReason } from "./question-feedback";

const CLIENT_ID_STORAGE_KEY = "aaronholmes.feedback-client-id";
const BARE_REASON = "bare";

export interface SharedFeedbackSummary {
    totalFlags: number;
    uniqueQuestions: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
}

const getConfig = () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) return null;
    return { url, anonKey };
};

export function isSharedFeedbackConfigured(): boolean {
    return Boolean(getConfig());
}

function getClientId(): string {
    try {
        const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
        if (existing) return existing;

        const created = crypto.randomUUID();
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
        return created;
    } catch {
        return crypto.randomUUID();
    }
}

const headersFor = (anonKey: string): HeadersInit => ({
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
});

/**
 * Best-effort remote sync for aggregate question-quality feedback.
 *
 * Free-text notes intentionally stay local for now. The shared table receives
 * only question metadata and an anonymous browser id so aggregate feedback can
 * improve question quality without publishing a learner's note.
 */
export async function syncQuestionFeedback(
    feedback: QuestionFeedback,
): Promise<boolean> {
    const config = getConfig();
    if (!config) return false;

    const reason = feedback.reason ?? BARE_REASON;

    try {
        const response = await fetch(
            `${config.url}/rest/v1/question_feedback?on_conflict=client_id,question_id,reason`,
            {
                method: "POST",
                headers: {
                    ...headersFor(config.anonKey),
                    Prefer: "resolution=merge-duplicates,return=minimal",
                },
                body: JSON.stringify({
                    client_id: getClientId(),
                    question_id: feedback.questionId,
                    reason,
                    topic: feedback.topic ?? null,
                    mastery_concept: feedback.masteryConcept ?? null,
                    learning_objective: feedback.learningObjective ?? null,
                    learning_stage: feedback.learningStage ?? null,
                    first_flagged_at: feedback.createdAt,
                    last_flagged_at: new Date().toISOString(),
                }),
            },
        );

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Reads non-identifying aggregate rows from the shared store. This is intended
 * for product-quality summaries, not for exposing individual learner history.
 */
export async function readSharedFeedbackSummary(): Promise<SharedFeedbackSummary | null> {
    const config = getConfig();
    if (!config) return null;

    try {
        const response = await fetch(
            `${config.url}/rest/v1/question_feedback?select=question_id,reason`,
            {
                headers: headersFor(config.anonKey),
            },
        );

        if (!response.ok) return null;

        const rows = (await response.json()) as Array<{
            question_id?: string;
            reason?: string;
        }>;

        const reasonCounts = new Map<QuestionFeedbackReason | "bare", number>();
        const questionIds = new Set<string>();

        rows.forEach((row) => {
            if (row.question_id) questionIds.add(row.question_id);
            const reason = (row.reason || BARE_REASON) as QuestionFeedbackReason | "bare";
            reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        });

        return {
            totalFlags: rows.length,
            uniqueQuestions: questionIds.size,
            reasonCounts,
        };
    } catch {
        return null;
    }
}
