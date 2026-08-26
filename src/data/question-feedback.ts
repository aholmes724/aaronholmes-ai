export const QUESTION_FEEDBACK_STORAGE_KEY = "aaronholmes.question-feedback";
export const QUESTION_REVIEW_STORAGE_KEY = "aaronholmes.question-review-state";

export const QUESTION_FEEDBACK_REASONS = [
    "wording-gives-away-answer",
    "distractors-unrealistic",
    "answer-too-obvious",
    "possibly-incorrect",
    "explanation-unclear",
    "other",
] as const;

export type QuestionFeedbackReason =
    (typeof QUESTION_FEEDBACK_REASONS)[number];

export type QuestionReviewStatus =
    | "open"
    | "needs-rewrite"
    | "reviewed"
    | "retired";

export interface QuestionFeedback {
    id: string;
    questionId: string;
    reason: QuestionFeedbackReason;
    note?: string;
    createdAt: string;
    topic?: string;
    masteryConcept?: string;
    learningObjective?: string;
    learningStage?: string;
}

export interface QuestionReviewState {
    questionId: string;
    status: QuestionReviewStatus;
    updatedAt: string;
}

export function readQuestionFeedback(): QuestionFeedback[] {
    try {
        const stored = localStorage.getItem(QUESTION_FEEDBACK_STORAGE_KEY);
        if (!stored) return [];
        const parsed: unknown = JSON.parse(stored);
        return Array.isArray(parsed) ? (parsed as QuestionFeedback[]) : [];
    } catch {
        return [];
    }
}

export function saveQuestionFeedback(
    feedback: Omit<QuestionFeedback, "id" | "createdAt">,
): QuestionFeedback {
    const saved: QuestionFeedback = {
        ...feedback,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };

    try {
        const existing = readQuestionFeedback();
        existing.push(saved);
        localStorage.setItem(
            QUESTION_FEEDBACK_STORAGE_KEY,
            JSON.stringify(existing),
        );
    } catch {
        // Feedback UI should not break practice when storage is unavailable.
    }

    return saved;
}

export function readQuestionReviewStates(): QuestionReviewState[] {
    try {
        const stored = localStorage.getItem(QUESTION_REVIEW_STORAGE_KEY);
        if (!stored) return [];
        const parsed: unknown = JSON.parse(stored);
        return Array.isArray(parsed) ? (parsed as QuestionReviewState[]) : [];
    } catch {
        return [];
    }
}

export function getQuestionReviewStatus(
    questionId: string,
): QuestionReviewStatus {
    return (
        readQuestionReviewStates().find(
            (state) => state.questionId === questionId,
        )?.status ?? "open"
    );
}

export function setQuestionReviewStatus(
    questionId: string,
    status: QuestionReviewStatus,
): QuestionReviewState {
    const updated: QuestionReviewState = {
        questionId,
        status,
        updatedAt: new Date().toISOString(),
    };

    try {
        const states = readQuestionReviewStates();
        const existingIndex = states.findIndex(
            (state) => state.questionId === questionId,
        );

        if (existingIndex >= 0) {
            states[existingIndex] = updated;
        } else {
            states.push(updated);
        }

        localStorage.setItem(
            QUESTION_REVIEW_STORAGE_KEY,
            JSON.stringify(states),
        );
    } catch {
        // Review controls should remain non-blocking if storage is unavailable.
    }

    return updated;
}

export function getFeedbackReasonLabel(
    reason: QuestionFeedbackReason,
): string {
    const labels: Record<QuestionFeedbackReason, string> = {
        "wording-gives-away-answer": "Wording gives away the answer",
        "distractors-unrealistic": "Distractors are unrealistic",
        "answer-too-obvious": "Answer is too obvious",
        "possibly-incorrect": "Question or answer may be incorrect",
        "explanation-unclear": "Explanation is unclear",
        other: "Other",
    };

    return labels[reason];
}
