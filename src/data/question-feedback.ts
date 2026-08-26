export const QUESTION_FEEDBACK_STORAGE_KEY = "aaronholmes.question-feedback";

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

export interface QuestionFeedback {
    id: string;
    questionId: string;
    reason: QuestionFeedbackReason;
    note?: string;
    createdAt: string;
    // Keep these fields so future generation/review jobs can aggregate feedback
    // without needing to reconstruct the question context from browser history.
    topic?: string;
    masteryConcept?: string;
    learningObjective?: string;
    learningStage?: string;
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
