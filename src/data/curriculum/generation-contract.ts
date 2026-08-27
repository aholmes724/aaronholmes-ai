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
    "Questions must stand alone as subject-matter questions; never ask what the curriculum, lesson, source, module, heading, or learning objective says unless that structure is itself the subject being taught.",
    "Keep source provenance in metadata and evidence, not in learner-facing question wording.",
    "Use plausible distractors that could be chosen by a learner with partial understanding or a realistic misconception.",
    "Prefer distractors that differ from the correct answer in one meaningful technical distinction rather than unrelated vocabulary categories.",
    "Before returning a question, perform a test-wise attack: try to infer the answer from wording, grammar, specificity, qualifier words, answer length, or one option sounding uniquely professional; if that works, rewrite the answer set.",
    "Do not make the correct answer uniquely nuanced while distractors are categorical, simplistic, or absurd.",
    "Use absolute qualifiers such as always, never, only, every, guaranteed, must, and cannot sparingly and only when technically necessary; do not let qualifier asymmetry reveal the answer.",
    "Keep answer choices reasonably parallel in grammatical form, specificity, and length.",
    "Prefer application, diagnosis, comparison, and transfer over recognition of memorized wording, while retaining a small number of foundational recognition questions where useful.",
    "Where possible, combine related concepts in realistic scenarios so the learner must reason across concepts rather than match vocabulary.",
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
