import type { CurriculumPackage, CurriculumQuestionDraft, VerificationTier } from "./types";

export interface QuestionGenerationRequest {
    curriculum: CurriculumPackage;
    sourceText: string;
    targetQuestionCount: number;
    qualityGuidance: string[];
    verificationTier: VerificationTier;
}

export interface QuestionGenerationResult {
    drafts: CurriculumQuestionDraft[];
    provider?: string;
    model?: string;
}

export const DEFAULT_QUESTION_QUALITY_GUIDANCE = [
    "Use plausible distractors that could be chosen by a learner with partial understanding or a realistic misconception.",
    "Do not use obviously unrelated concepts merely to fill distractor slots.",
    "Before returning a question, ask whether a competent test-taker who does not know the material could infer the answer from wording, grammar, specificity, qualifier words, or answer length; if so, rewrite the answer set.",
    "Do not make the correct answer uniquely nuanced while distractors are categorical, simplistic, or absurd.",
    "Use absolute qualifiers such as always, never, only, every, guaranteed, must, and cannot sparingly and only when technically necessary; do not let qualifier asymmetry reveal the answer.",
    "Keep answer choices reasonably parallel in grammatical form, specificity, and length.",
    "Prefer application, diagnosis, comparison, and transfer over recognition of memorized wording, while retaining a small number of foundational recognition questions where useful.",
    "Avoid several questions that are merely paraphrases of the same distinction; vary the reasoning task across a concept.",
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
    verificationTier: VerificationTier = "classroom",
): QuestionGenerationRequest {
    return {
        curriculum,
        sourceText,
        targetQuestionCount,
        qualityGuidance: DEFAULT_QUESTION_QUALITY_GUIDANCE,
        verificationTier,
    };
}
