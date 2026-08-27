import type { Question } from "../questions";
import { compileCurriculumQuestions } from "./compile";
import type { CurriculumPackage } from "./types";
import { validateCurriculumPackage } from "./validate";

const IMPORTED_CURRICULUM_KEY = "aaronholmes.imported-curriculum";

export interface StoredCurriculum {
    curriculum: CurriculumPackage;
    savedAt: string;
}

export function saveImportedCurriculum(curriculum: CurriculumPackage): StoredCurriculum {
    const validation = validateCurriculumPackage(curriculum);
    if (!validation.valid) {
        throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }

    const stored: StoredCurriculum = {
        curriculum,
        savedAt: new Date().toISOString(),
    };
    localStorage.setItem(IMPORTED_CURRICULUM_KEY, JSON.stringify(stored));
    return stored;
}

export function readImportedCurriculum(): StoredCurriculum | null {
    try {
        const raw = localStorage.getItem(IMPORTED_CURRICULUM_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredCurriculum;
        if (!parsed?.curriculum) return null;
        const validation = validateCurriculumPackage(parsed.curriculum);
        return validation.valid ? parsed : null;
    } catch {
        return null;
    }
}

export function readImportedQuestions(): Question[] {
    const stored = readImportedCurriculum();
    return stored ? compileCurriculumQuestions(stored.curriculum) : [];
}

export function clearImportedCurriculum(): void {
    localStorage.removeItem(IMPORTED_CURRICULUM_KEY);
}
