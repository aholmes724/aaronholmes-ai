import type { CurriculumPackage } from "./types";
import { validateCurriculumPackage } from "./validate";

export interface CurriculumImportResult {
    ok: boolean;
    curriculum?: CurriculumPackage;
    errors: string[];
}

export function parseCurriculumJson(raw: string): CurriculumImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, errors: ["This file is not valid JSON."] };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, errors: ["The curriculum file must contain one curriculum object."] };
    }

    const candidate = parsed as CurriculumPackage;
    const requiredArrays = ["sources", "concepts", "learningObjectives", "questionDrafts"] as const;
    const errors: string[] = [];

    if (typeof candidate.id !== "string" || !candidate.id.trim()) errors.push("A curriculum id is required.");
    if (typeof candidate.title !== "string" || !candidate.title.trim()) errors.push("A curriculum title is required.");
    if (typeof candidate.version !== "string" || !candidate.version.trim()) errors.push("A curriculum version is required.");
    requiredArrays.forEach((field) => {
        if (!Array.isArray(candidate[field])) errors.push(`${field} must be an array.`);
    });
    if (errors.length) return { ok: false, errors };

    const validation = validateCurriculumPackage(candidate);
    if (!validation.valid) {
        return { ok: false, errors: validation.issues.map((issue) => `${issue.path}: ${issue.message}`) };
    }

    return { ok: true, curriculum: candidate, errors: [] };
}

export function summarizeCurriculum(curriculum: CurriculumPackage) {
    const aiValidated = curriculum.questionDrafts.filter(
        (draft) => draft.validationStatus === "ai-validated",
    ).length;
    const humanApproved = curriculum.questionDrafts.filter(
        (draft) => draft.validationStatus === "approved",
    ).length;

    return {
        sources: curriculum.sources.length,
        concepts: curriculum.concepts.length,
        objectives: curriculum.learningObjectives.length,
        drafts: curriculum.questionDrafts.length,
        aiValidated,
        humanApproved,
        practiceReady: aiValidated + humanApproved,
    };
}
