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
    "Build distractors from explicit learner misconceptions or near-miss reasoning, not from generic wrong statements.",
    "For every distractor, be able to state the concrete mistaken rule, omitted constraint, overgeneralization, nearby-concept confusion, or inferior-but-plausible tradeoff that would make a partially informed learner choose it.",
    "If a question cannot support at least two genuinely tempting distractors, reject the question instead of padding the answer set.",
    "Reject distractor sets containing absurd, reckless, obviously irrelevant, category-mismatched, or ordinary-common-sense wrong options.",
    "Keep answer choices structurally parallel: competing designs, diagnoses, actions, explanations, or definitions at similar specificity.",
    "For scenarios, each choice should honor most of the scenario; wrong choices should fail on a subtle but meaningful constraint rather than ignore the scenario.",
    "Prefer near misses such as the correct principle applied to the wrong constraint, the right concept at the wrong scope, a partial solution missing one requirement, or a valid approach optimizing the wrong tradeoff.",
    "Perform a test-wise attack: try to infer the answer from wording, grammar, specificity, qualifier words, answer length, professionalism, or one option being uniquely nuanced; if that works, rewrite or reject the item.",
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
