import type { QuestionFeedback, QuestionFeedbackReason } from "./question-feedback";

const CLIENT_ID_STORAGE_KEY = "aaronholmes.feedback-client-id";
const BARE_REASON = "bare";

export interface SharedQuestionFeedbackSummary {
    questionId: string;
    questionVersion: number;
    totalFlags: number;
    uniqueClients: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
    priority: "normal" | "watch" | "review";
}

export interface SharedFeedbackSummary {
    totalFlags: number;
    uniqueQuestions: number;
    uniqueClients: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
    questions: SharedQuestionFeedbackSummary[];
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

export async function syncQuestionFeedback(
    feedback: QuestionFeedback,
): Promise<boolean> {
    const config = getConfig();
    if (!config) return false;

    const reason = feedback.reason ?? BARE_REASON;
    const questionVersion = feedback.questionVersion || 1;

    try {
        const response = await fetch(
            `${config.url}/rest/v1/question_feedback?on_conflict=client_id,question_id,question_version,reason`,
            {
                method: "POST",
                headers: {
                    ...headersFor(config.anonKey),
                    Prefer: "resolution=merge-duplicates,return=minimal",
                },
                body: JSON.stringify({
                    client_id: getClientId(),
                    question_id: feedback.questionId,
                    question_version: questionVersion,
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

export async function readSharedFeedbackSummary(): Promise<SharedFeedbackSummary | null> {
    const config = getConfig();
    if (!config) return null;

    try {
        const response = await fetch(
            `${config.url}/rest/v1/question_feedback?select=client_id,question_id,question_version,reason`,
            {
                headers: headersFor(config.anonKey),
            },
        );

        if (!response.ok) return null;

        const rows = (await response.json()) as Array<{
            client_id?: string;
            question_id?: string;
            question_version?: number;
            reason?: string;
        }>;

        const reasonCounts = new Map<QuestionFeedbackReason | "bare", number>();
        const questionVersionKeys = new Set<string>();
        const clientIds = new Set<string>();
        const grouped = new Map<
            string,
            {
                questionId: string;
                questionVersion: number;
                totalFlags: number;
                clientIds: Set<string>;
                reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
            }
        >();

        rows.forEach((row) => {
            if (!row.question_id) return;

            const questionVersion = row.question_version || 1;
            const questionKey = `${row.question_id}::v${questionVersion}`;
            questionVersionKeys.add(questionKey);
            if (row.client_id) clientIds.add(row.client_id);

            const reason = (row.reason || BARE_REASON) as QuestionFeedbackReason | "bare";
            reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);

            const question = grouped.get(questionKey) ?? {
                questionId: row.question_id,
                questionVersion,
                totalFlags: 0,
                clientIds: new Set<string>(),
                reasonCounts: new Map<QuestionFeedbackReason | "bare", number>(),
            };

            question.totalFlags += 1;
            if (row.client_id) question.clientIds.add(row.client_id);
            question.reasonCounts.set(
                reason,
                (question.reasonCounts.get(reason) ?? 0) + 1,
            );
            grouped.set(questionKey, question);
        });

        const questions = Array.from(grouped.values())
            .map((stats): SharedQuestionFeedbackSummary => {
                const uniqueClients = stats.clientIds.size;
                return {
                    questionId: stats.questionId,
                    questionVersion: stats.questionVersion,
                    totalFlags: stats.totalFlags,
                    uniqueClients,
                    reasonCounts: stats.reasonCounts,
                    priority:
                        uniqueClients >= 3
                            ? "review"
                            : uniqueClients >= 2
                              ? "watch"
                              : "normal",
                };
            })
            .sort((first, second) => {
                if (first.uniqueClients !== second.uniqueClients) {
                    return second.uniqueClients - first.uniqueClients;
                }
                return second.totalFlags - first.totalFlags;
            });

        return {
            totalFlags: rows.length,
            uniqueQuestions: questionVersionKeys.size,
            uniqueClients: clientIds.size,
            reasonCounts,
            questions,
        };
    } catch {
        return null;
    }
}
