import type {
    CurriculumPackage,
    CurriculumValidationResult,
} from "./types";

export function validateCurriculumPackage(
    curriculum: CurriculumPackage,
): CurriculumValidationResult {
    const issues: CurriculumValidationResult["issues"] = [];

    const sourceIds = new Set(curriculum.sources.map((source) => source.id));
    const conceptIds = new Set(curriculum.concepts.map((concept) => concept.id));
    const objectiveIds = new Set(
        curriculum.learningObjectives.map((objective) => objective.id),
    );
    const questionIds = new Set<string>();

    curriculum.learningObjectives.forEach((objective, index) => {
        if (!conceptIds.has(objective.conceptId)) {
            issues.push({
                path: `learningObjectives[${index}].conceptId`,
                message: `Unknown concept: ${objective.conceptId}`,
            });
        }
    });

    curriculum.questionDrafts.forEach((question, index) => {
        const path = `questionDrafts[${index}]`;

        if (questionIds.has(question.id)) {
            issues.push({
                path: `${path}.id`,
                message: `Duplicate question id: ${question.id}`,
            });
        }
        questionIds.add(question.id);

        if (!sourceIds.has(question.sourceId)) {
            issues.push({
                path: `${path}.sourceId`,
                message: `Unknown source: ${question.sourceId}`,
            });
        }

        if (!objectiveIds.has(question.learningObjectiveId)) {
            issues.push({
                path: `${path}.learningObjectiveId`,
                message: `Unknown learning objective: ${question.learningObjectiveId}`,
            });
        }

        if (!conceptIds.has(question.masteryConcept)) {
            issues.push({
                path: `${path}.masteryConcept`,
                message: `Unknown mastery concept: ${question.masteryConcept}`,
            });
        }

        question.conceptIds.forEach((conceptId) => {
            if (!conceptIds.has(conceptId)) {
                issues.push({
                    path: `${path}.conceptIds`,
                    message: `Unknown concept: ${conceptId}`,
                });
            }
        });

        const correctCount = question.answers.filter(
            (answer) => answer.correct,
        ).length;

        if (question.type === "single-select" && correctCount !== 1) {
            issues.push({
                path: `${path}.answers`,
                message: "Single-select questions must have exactly one correct answer.",
            });
        }

        if (question.type === "multi-select" && correctCount < 1) {
            issues.push({
                path: `${path}.answers`,
                message: "Multi-select questions must have at least one correct answer.",
            });
        }

        if (!question.sourceReference.trim()) {
            issues.push({
                path: `${path}.sourceReference`,
                message: "A source reference is required for provenance.",
            });
        }
    });

    return {
        valid: issues.length === 0,
        issues,
    };
}
