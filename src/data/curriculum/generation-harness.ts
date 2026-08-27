import type { CurriculumPackage, CurriculumQuestionDraft } from "./types";
import { validateCurriculumPackage } from "./validate";

export const GENERATION_HARNESS_VERSION = "1.0.0";
export const GENERATION_PROMPT_VERSION = "2026-08-26.1";

export interface HarnessIssue {
    questionId?: string;
    severity: "error" | "warning";
    code: string;
    message: string;
}

export interface HarnessResult {
    accepted: CurriculumQuestionDraft[];
    rejected: CurriculumQuestionDraft[];
    issues: HarnessIssue[];
}

const giveawayQualifier = /\b(always|never|only|every|guaranteed|obviously|clearly)\b/i;

export function validateGeneratedDrafts(
    curriculum: CurriculumPackage,
    drafts: CurriculumQuestionDraft[],
): HarnessResult {
    const issues: HarnessIssue[] = [];
    const accepted: CurriculumQuestionDraft[] = [];
    const rejected: CurriculumQuestionDraft[] = [];

    for (const draft of drafts) {
        const draftIssues: HarnessIssue[] = [];
        const correctAnswers = draft.answers.filter((answer) => answer.correct);

        if (!draft.sourceEvidence?.excerpt?.trim()) {
            draftIssues.push({
                questionId: draft.id,
                severity: "error",
                code: "missing-source-evidence",
                message: "Generated questions require a supporting source excerpt.",
            });
        }

        if (draft.sourceEvidence && draft.sourceEvidence.sourceId !== draft.sourceId) {
            draftIssues.push({
                questionId: draft.id,
                severity: "error",
                code: "source-mismatch",
                message: "Source evidence must reference the same source as the question.",
            });
        }

        if (draft.answers.length < 3) {
            draftIssues.push({
                questionId: draft.id,
                severity: "error",
                code: "too-few-answers",
                message: "Generated multiple-choice questions need at least three answer choices.",
            });
        }

        if (draft.type === "single-select" && correctAnswers.length !== 1) {
            draftIssues.push({
                questionId: draft.id,
                severity: "error",
                code: "invalid-correct-count",
                message: "Single-select generated questions must have exactly one correct answer.",
            });
        }

        const correctLength = correctAnswers[0]?.text.trim().length ?? 0;
        const averageWrongLength = (() => {
            const wrong = draft.answers.filter((answer) => !answer.correct).map((answer) => answer.text.trim().length);
            return wrong.length ? wrong.reduce((sum, length) => sum + length, 0) / wrong.length : 0;
        })();

        if (averageWrongLength > 0 && correctLength > averageWrongLength * 1.8 && correctLength - averageWrongLength > 28) {
            draftIssues.push({
                questionId: draft.id,
                severity: "warning",
                code: "correct-answer-length-cue",
                message: "The correct answer is substantially more detailed than the distractors.",
            });
        }

        const qualifierWrongAnswers = draft.answers.filter(
            (answer) => !answer.correct && giveawayQualifier.test(answer.text),
        ).length;
        const qualifierCorrectAnswers = draft.answers.filter(
            (answer) => answer.correct && giveawayQualifier.test(answer.text),
        ).length;
        if (qualifierWrongAnswers >= 2 && qualifierCorrectAnswers === 0) {
            draftIssues.push({
                questionId: draft.id,
                severity: "warning",
                code: "giveaway-qualifiers",
                message: "Multiple distractors use giveaway absolute qualifiers while the correct answer does not.",
            });
        }

        if (!draft.explanation?.trim() || draft.explanation.trim().length < 30) {
            draftIssues.push({
                questionId: draft.id,
                severity: "error",
                code: "weak-explanation",
                message: "Generated questions need a meaningful explanation, not just the answer label.",
            });
        }

        issues.push(...draftIssues);
        if (draftIssues.some((issue) => issue.severity === "error")) rejected.push(draft);
        else accepted.push(draft);
    }

    const candidate: CurriculumPackage = {
        ...curriculum,
        questionDrafts: accepted,
    };
    const packageValidation = validateCurriculumPackage(candidate);
    packageValidation.issues.forEach((issue) => {
        issues.push({
            severity: "error",
            code: "curriculum-validation",
            message: `${issue.path}: ${issue.message}`,
        });
    });

    if (!packageValidation.valid) {
        return { accepted: [], rejected: [...rejected, ...accepted], issues };
    }

    return { accepted, rejected, issues };
}
