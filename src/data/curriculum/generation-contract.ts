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
    "Ground the correct answer and explanation in the supplied curriculum rather than silently adding model knowledge.",
    "For every draft, return sourceEvidence with sourceId, a human-readable reference, and the smallest excerpt that actually supports the correct answer.",
    "Reject or omit a question when the supplied source does not contain enough evidence to defend one answer over the distractors.",
    "Treat source provenance as inspectable metadata: keep practice uncluttered, but make the evidence available on demand after answering.",
    "Supplemental resources are optional enrichment, never evidence for a curriculum-grounded answer; label them separately from the learner's source material.",
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
