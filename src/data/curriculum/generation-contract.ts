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
    "Every distractor must be a plausible same-domain alternative that a partially informed learner could reasonably choose.",
    "Prefer distractors that encode a near-miss decision, partial truth, omitted constraint, or realistic misconception rather than unrelated vocabulary.",
    "Reject distractor sets containing absurd, reckless, obviously irrelevant, or category-mismatched options.",
    "Keep answer choices structurally parallel: competing designs, diagnoses, actions, explanations, or definitions at similar specificity.",
    "Before returning a question, perform a partial-knowledge attack: each wrong answer should remain tempting to someone who understands some but not all of the material.",
    "Also perform a test-wise attack: try to infer the answer from wording, grammar, specificity, qualifier words, answer length, or one option sounding uniquely professional; if that works, rewrite the answer set.",
    "Do not make the correct answer uniquely nuanced while distractors are categorical, simplistic, unsafe, or absurd.",
    "Use absolute qualifiers such as always, never, only, every, guaranteed, must, and cannot sparingly and only when technically necessary; do not let qualifier asymmetry reveal the answer.",
    "Keep answer choices reasonably parallel in grammatical form, specificity, and length.",
    "Prefer application, diagnosis, comparison, and transfer over recognition of memorized wording, while retaining a small number of foundational recognition questions where useful.",
    "For scenario questions, make the requirements matter. Prefer cases where changing one important constraint could plausibly change the best answer.",
    "Where possible, combine related concepts in realistic scenarios so the learner must reason across concepts rather than match vocabulary.",
    "Use contrast pairs where the source supports them, so the learner must discriminate between nearby concepts rather than identify an isolated term.",
    "Avoid several questions that are merely paraphrases of the same distinction; vary the reasoning task across a concept.",
    "Quality is more important than count. Return fewer questions rather than padding a set with weak distractors.",
    "Ground the correct answer and explanation in the supplied curriculum rather than silently adding model knowledge.",
    "For every draft, return sourceEvidence with sourceId, a human-readable reference, and the smallest excerpt that actually supports the correct answer.",
    "Reject or omit a question when the supplied source does not contain enough evidence to defend one answer over the distractors.",
    "Treat source provenance as inspectable metadata: keep practice uncluttered, but make the evidence available on demand after answering.",
    "Supplemental resources are optional enrichment, never evidence for a curriculum-grounded answer; label them separately from the learner's source material.",
];

export function createQuestionGenerationRequest(
    curriculum: CurriculumPackage,
    sourceText: string,
    targetQuestionCount = Math.min(
        12,
        Math.max(6, curriculum.learningObjectives.length * 2),
    ),
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
