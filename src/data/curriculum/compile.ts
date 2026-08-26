import type { Question } from "../questions";
import type { CurriculumPackage } from "./types";
import { validateCurriculumPackage } from "./validate";

export function compileCurriculumQuestions(
    curriculum: CurriculumPackage,
): Question[] {
    const validation = validateCurriculumPackage(curriculum);

    if (!validation.valid) {
        const details = validation.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join("\n");

        throw new Error(
            `Curriculum package ${curriculum.id} failed validation:\n${details}`,
        );
    }

    return curriculum.questionDrafts
        .filter((draft) => draft.validationStatus === "approved")
        .map((draft) => ({
            id: draft.id,
            type: draft.type,
            prompt: draft.prompt,
            answers: draft.answers,
            topic: draft.topic,
            concepts: draft.conceptIds,
            difficulty: draft.difficulty,
            learningStage: draft.learningStage,
            explanation: draft.explanation,
            sourceId: draft.sourceId,
            sourceReference: draft.sourceReference,
            shuffleAnswers: draft.shuffleAnswers,
            masteryConcept: draft.masteryConcept,
            learningObjective: draft.learningObjectiveId,
        }));
}
