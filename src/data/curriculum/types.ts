import type { Question } from "../questions";

export type CurriculumSourceKind =
    | "book"
    | "documentation"
    | "article"
    | "notes"
    | "course"
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

export type DraftValidationStatus =
    | "draft"
    | "reviewed"
    | "approved"
    | "rejected";

export interface CurriculumQuestionDraft {
    id: string;
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
