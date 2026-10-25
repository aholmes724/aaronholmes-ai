import type { QuestionFeedback, QuestionFeedbackReason } from "./question-feedback";

const CLIENT_ID_STORAGE_KEY = "aaronholmes.feedback-client-id";
const BARE_REASON = "bare";

export interface SharedQuestionFeedbackSummary {
    questionId: string;
    questionVersion: number;
    semanticKey?: string;
    totalFlags: number;
    uniqueClients: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
    priority: "normal" | "watch" | "review";
}

export interface SharedSemanticFeedbackSummary {
    semanticKey: string;
    questionVersions: number;
    totalFlags: number;
    uniqueClients: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
    priority: "normal" | "watch" | "review";
}

export interface SharedFeedbackSummary {
    totalFlags: number;
    uniqueQuestions: number;
    uniqueClients: number;
    uniqueSemanticGroups: number;
    reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
    questions: SharedQuestionFeedbackSummary[];
    semanticGroups: SharedSemanticFeedbackSummary[];
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

const getPriority = (uniqueClients: number): "normal" | "watch" | "review" =>
    uniqueClients >= 3 ? "review" : uniqueClients >= 2 ? "watch" : "normal";

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
                    semantic_key: feedback.semanticKey ?? null,
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

export async function unsyncQuestionFeedback(
    feedback: QuestionFeedback,
): Promise<boolean> {
    const config = getConfig();
    if (!config) return false;

    const clientId = getClientId();
    const reason = encodeURIComponent(feedback.reason ?? BARE_REASON);
    const questionId = encodeURIComponent(feedback.questionId);
    const questionVersion = feedback.questionVersion || 1;

    try {
        const response = await fetch(
            `${config.url}/rest/v1/question_feedback?client_id=eq.${clientId}&question_id=eq.${questionId}&question_version=eq.${questionVersion}&reason=eq.${reason}`,
            {
                method: "DELETE",
                headers: headersFor(config.anonKey),
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
            `${config.url}/rest/v1/question_feedback?select=client_id,question_id,question_version,semantic_key,reason`,
            {
                headers: headersFor(config.anonKey),
            },
        );

        if (!response.ok) return null;

        const rows = (await response.json()) as Array<{
            client_id?: string;
            question_id?: string;
            question_version?: number;
            semantic_key?: string | null;
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
                semanticKey?: string;
                totalFlags: number;
                clientIds: Set<string>;
                reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
            }
        >();
        const semanticGrouped = new Map<
            string,
            {
                questionVersionKeys: Set<string>;
                totalFlags: number;
                clientIds: Set<string>;
                reasonCounts: Map<QuestionFeedbackReason | "bare", number>;
            }
        >();

        rows.forEach((row) => {
            if (!row.question_id) return;

            const questionVersion = row.question_version || 1;
            const questionKey = `${row.question_id}::v${questionVersion}`;
            const semanticKey = row.semantic_key?.trim() || undefined;
            questionVersionKeys.add(questionKey);
            if (row.client_id) clientIds.add(row.client_id);

            const reason = (row.reason || BARE_REASON) as QuestionFeedbackReason | "bare";
            reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);

            const question = grouped.get(questionKey) ?? {
                questionId: row.question_id,
                questionVersion,
                ...(semanticKey ? { semanticKey } : {}),
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

            if (semanticKey) {
                const semantic = semanticGrouped.get(semanticKey) ?? {
                    questionVersionKeys: new Set<string>(),
                    totalFlags: 0,
                    clientIds: new Set<string>(),
                    reasonCounts: new Map<QuestionFeedbackReason | "bare", number>(),
                };
                semantic.questionVersionKeys.add(questionKey);
                semantic.totalFlags += 1;
                if (row.client_id) semantic.clientIds.add(row.client_id);
                semantic.reasonCounts.set(
                    reason,
                    (semantic.reasonCounts.get(reason) ?? 0) + 1,
                );
                semanticGrouped.set(semanticKey, semantic);
            }
        });

        const questions = Array.from(grouped.values())
            .map((stats): SharedQuestionFeedbackSummary => {
                const uniqueClients = stats.clientIds.size;
                return {
                    questionId: stats.questionId,
                    questionVersion: stats.questionVersion,
                    ...(stats.semanticKey ? { semanticKey: stats.semanticKey } : {}),
                    totalFlags: stats.totalFlags,
                    uniqueClients,
                    reasonCounts: stats.reasonCounts,
                    priority: getPriority(uniqueClients),
                };
            })
            .sort((first, second) => {
                if (first.uniqueClients !== second.uniqueClients) {
                    return second.uniqueClients - first.uniqueClients;
                }
                return second.totalFlags - first.totalFlags;
            });

        const semanticGroups = Array.from(semanticGrouped.entries())
            .map(([semanticKey, stats]): SharedSemanticFeedbackSummary => {
                const uniqueClients = stats.clientIds.size;
                return {
                    semanticKey,
                    questionVersions: stats.questionVersionKeys.size,
                    totalFlags: stats.totalFlags,
                    uniqueClients,
                    reasonCounts: stats.reasonCounts,
                    priority: getPriority(uniqueClients),
                };
            })
            .sort((first, second) => {
                if (first.uniqueClients !== second.uniqueClients) {
                    return second.uniqueClients - first.uniqueClients;
                }
                if (first.questionVersions !== second.questionVersions) {
                    return second.questionVersions - first.questionVersions;
                }
                return second.totalFlags - first.totalFlags;
            });

        return {
            totalFlags: rows.length,
            uniqueQuestions: questionVersionKeys.size,
            uniqueClients: clientIds.size,
            uniqueSemanticGroups: semanticGroups.length,
            reasonCounts,
            questions,
            semanticGroups,
        };
    } catch {
        return null;
    }
}
