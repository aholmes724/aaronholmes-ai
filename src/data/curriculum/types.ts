import type { Question } from "../questions";

export type CurriculumSourceKind =
    | "book"
    | "documentation"
    | "article"
    | "notes"
    | "course"
    | "video"
    | "other";

export interface CurriculumSource {
    id: string;
    title: string;
    kind: CurriculumSourceKind;
    author?: string;
    url?: string;
    edition?: string;
    notes?: string;
}

export interface CurriculumConcept {
    id: string;
    label: string;
    description?: string;
}

export interface CurriculumLearningObjective {
    id: string;
    conceptId: string;
    description: string;
    learningStage: NonNullable<Question["learningStage"]>;
}

export interface SourceEvidence {
    sourceId: string;
    reference: string;
    excerpt: string;
    locator?: string;
}

export interface SupplementalLearningResource {
    title: string;
    url: string;
    kind: "article" | "book" | "course" | "video" | "documentation" | "other";
    provider?: string;
    note?: string;
}

export interface QuestionGenerationMetadata {
    provider: string;
    model: string;
    harnessVersion: string;
    promptVersion: string;
}

export type DraftValidationStatus =
    | "draft"
    | "reviewed"
    | "approved"
    | "rejected";

export interface CurriculumQuestionDraft {
    id: string;
    version?: number;
    semanticKey?: string;
    type: Question["type"];
    prompt: string;
    answers: Question["answers"];
    topic: string;
    conceptIds: string[];
    masteryConcept: string;
    learningObjectiveId: string;
    difficulty: NonNullable<Question["difficulty"]>;
    learningStage: NonNullable<Question["learningStage"]>;
    explanation: string;
    sourceId: string;
    sourceReference: string;
    sourceEvidence?: SourceEvidence;
    supplementalResources?: SupplementalLearningResource[];
    generation?: QuestionGenerationMetadata;
    shuffleAnswers?: boolean;
    validationStatus: DraftValidationStatus;
}

export interface CurriculumPackage {
    id: string;
    title: string;
    version: string;
    sources: CurriculumSource[];
    concepts: CurriculumConcept[];
    learningObjectives: CurriculumLearningObjective[];
    questionDrafts: CurriculumQuestionDraft[];
}

export interface CurriculumValidationIssue {
    path: string;
    message: string;
}

export interface CurriculumValidationResult {
    valid: boolean;
    issues: CurriculumValidationIssue[];
}
