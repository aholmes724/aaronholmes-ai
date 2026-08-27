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
    "Every distractor should be a plausible choice for a learner with incomplete knowledge, not merely a wrong statement from the same broad topic.",
    "Build distractors from near-miss approaches, partial truths, common misconceptions, missing constraints, or inferior-but-plausible decisions.",
    "Prefer answer sets where all options are structurally parallel: competing designs, diagnoses, actions, explanations, or definitions at similar specificity.",
    "Avoid filler distractors that can be rejected without domain knowledge because they are absurd, reckless, irrelevant, or in the wrong conceptual category.",
    "Before returning a question, perform a test-wise attack: try to infer the answer from wording, grammar, specificity, qualifier words, answer length, professionalism, or one option being uniquely nuanced; if that works, rewrite the answer set.",
    "Use absolute qualifiers such as always, never, only, every, guaranteed, must, and cannot sparingly and only when technically necessary; do not let qualifier asymmetry reveal the answer.",
    "Keep answer choices reasonably parallel in grammatical form, specificity, and length.",
    "Prefer application, diagnosis, comparison, and transfer over isolated vocabulary recognition, while retaining a small number of foundational recall questions.",
    "For scenario questions, make the stated requirements matter: changing an important requirement should be capable of changing the best answer.",
    "Where the source supports it, contrast closely related concepts or decisions so the learner must discriminate between them rather than recognize a keyword.",
    "Where possible, combine related concepts in realistic scenarios so the learner must reason across concepts rather than match vocabulary.",
    "Avoid several questions that are merely paraphrases of the same distinction; vary the reasoning task across a concept.",
    "Quality is more important than quantity. If the source cannot support the requested number of strong questions with plausible distractors, return fewer questions rather than padding the set.",
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
