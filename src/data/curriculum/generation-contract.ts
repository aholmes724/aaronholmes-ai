import type { CurriculumPackage, CurriculumQuestionDraft } from "./types";

export interface QuestionGenerationRequest {
    curriculum: CurriculumPackage;
    sourceText: string;
    targetQuestionCount: number;
    qualityGuidance: string[];
}

export interface QuestionGenerationResult {
    drafts: CurriculumQuestionDraft[];
    provider?: string;
    model?: string;
}

export const DEFAULT_QUESTION_QUALITY_GUIDANCE = [
    "Use plausible distractors that could be chosen by a learner with a realistic misconception.",
    "Do not make the correct answer uniquely nuanced while distractors are simplistic or absurd.",
    "Use absolute qualifiers such as always, never, only, every, and guaranteed sparingly and only when technically necessary.",
    "Test understanding and application, not just recognition of memorized wording.",
    "Keep every question grounded in the supplied curriculum source and preserve source provenance.",
];

export function createQuestionGenerationRequest(
    curriculum: CurriculumPackage,
    sourceText: string,
    targetQuestionCount = Math.max(5, curriculum.learningObjectives.length * 3),
): QuestionGenerationRequest {
    return {
        curriculum,
        sourceText,
        targetQuestionCount,
        qualityGuidance: DEFAULT_QUESTION_QUALITY_GUIDANCE,
    };
}
