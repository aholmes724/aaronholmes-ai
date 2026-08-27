import type { CurriculumPackage, CurriculumQuestionDraft, QuestionQualityWarning } from "./types";
import { validateCurriculumPackage } from "./validate";

export const GENERATION_HARNESS_VERSION = "1.3.0";
export const GENERATION_PROMPT_VERSION = "2026-08-27.1";

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

const giveawayQualifier = /\b(always|never|only|every|guaranteed|obviously|clearly|must|cannot)\b/i;

function warning(code: string, message: string): QuestionQualityWarning {
    return { code, message };
}

export function validateGeneratedDrafts(
    curriculum: CurriculumPackage,
    drafts: CurriculumQuestionDraft[],
): HarnessResult {
    const issues: HarnessIssue[] = [];
    const accepted: CurriculumQuestionDraft[] = [];
    const rejected: CurriculumQuestionDraft[] = [];

    for (const draft of drafts) {
        const draftIssues: HarnessIssue[] = [];
        const qualityWarnings: QuestionQualityWarning[] = [];
        const correctAnswers = draft.answers.filter((answer) => answer.correct);
        const wrongAnswers = draft.answers.filter((answer) => !answer.correct);

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
        const averageWrongLength = wrongAnswers.length
            ? wrongAnswers.reduce((sum, answer) => sum + answer.text.trim().length, 0) / wrongAnswers.length
            : 0;

        if (averageWrongLength > 0 && correctLength > averageWrongLength * 1.65 && correctLength - averageWrongLength > 22) {
            const item = warning(
                "correct-answer-length-cue",
                "The correct answer is substantially more detailed than the distractors and may be guessable by answer length.",
            );
            qualityWarnings.push(item);
            draftIssues.push({ questionId: draft.id, severity: "warning", ...item });
        }

        const qualifierWrongAnswers = wrongAnswers.filter((answer) => giveawayQualifier.test(answer.text)).length;
        const qualifierCorrectAnswers = correctAnswers.filter((answer) => giveawayQualifier.test(answer.text)).length;
        if (qualifierWrongAnswers >= 2 && qualifierCorrectAnswers === 0) {
            const item = warning(
                "qualifier-asymmetry",
                "Multiple distractors use absolute or categorical qualifiers while the correct answer is more nuanced; a test-wise learner may infer the answer without knowing the material.",
            );
            qualityWarnings.push(item);
            draftIssues.push({ questionId: draft.id, severity: "warning", ...item });
        } else if (qualifierWrongAnswers === wrongAnswers.length && wrongAnswers.length >= 3 && qualifierCorrectAnswers === 0) {
            const item = warning(
                "all-distractors-categorical",
                "Every distractor is categorically worded while the correct answer is qualified, creating a strong test-taking cue.",
            );
            qualityWarnings.push(item);
            draftIssues.push({ questionId: draft.id, severity: "warning", ...item });
        }

        const answerWordCounts = draft.answers.map((answer) => answer.text.trim().split(/\s+/).filter(Boolean).length);
        const minWords = Math.min(...answerWordCounts);
        const maxWords = Math.max(...answerWordCounts);
        if (maxWords >= Math.max(8, minWords * 3) && correctLength === Math.max(...draft.answers.map((answer) => answer.text.trim().length))) {
            const item = warning(
                "answer-shape-asymmetry",
                "The correct option has a noticeably different shape or level of detail from the alternatives.",
            );
            qualityWarnings.push(item);
            draftIssues.push({ questionId: draft.id, severity: "warning", ...item });
        }

        if (draft.learningStage === "recognition" && draft.difficulty !== "beginner") {
            const item = warning(
                "recognition-difficulty-mismatch",
                "This question is labeled above beginner difficulty but still tests recognition; consider a scenario, diagnosis, or transfer task instead.",
            );
            qualityWarnings.push(item);
            draftIssues.push({ questionId: draft.id, severity: "warning", ...item });
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
        if (draftIssues.some((issue) => issue.severity === "error")) {
            rejected.push(draft);
        } else {
            accepted.push({
                ...draft,
                qualityWarnings: qualityWarnings.length ? qualityWarnings : undefined,
            });
        }
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
