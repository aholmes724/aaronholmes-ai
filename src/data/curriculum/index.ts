export type {
    CurriculumPackage,
    CurriculumQuestionDraft,
    CurriculumSource,
    CurriculumConcept,
    CurriculumLearningObjective,
    CurriculumValidationIssue,
    CurriculumValidationResult,
    DraftValidationStatus,
} from "./types";

export { validateCurriculumPackage } from "./validate";
export { compileCurriculumQuestions } from "./compile";
export { sampleCurriculum } from "./sample";

import { compileCurriculumQuestions } from "./compile";
import { sampleCurriculum } from "./sample";

export const compiledCurriculumQuestions = compileCurriculumQuestions(
    sampleCurriculum,
);
