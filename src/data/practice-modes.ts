import type { Question } from "./questions";
import type { PracticeAttempt } from "./attempts";

export interface PracticeMode {
    id: string;
    label: string;
    description: string;
    icon?: string;
}

export interface ModeFilter {
    topic?: string | string[];
    concepts?: string[];
    learningStages?: string[];
    
}

export const PRACTICE_MODES: Record<string, PracticeMode> = {
    all: {
        id: "all",
        label: "All Practice",
        description: "Review questions across all topics",
        icon: "📚",
    },
    interview: {
        id: "interview",
        label: "Interview Prep",
        description: "Focus on application and understanding",
        icon: "🎯",
    },
    weak: {
        id: "weak",
        label: "Weak Concepts",
        description: "Target concepts where you struggle",
        icon: "💪",
    },
    "api-auth": {
        id: "api-auth",
        label: "API & Auth",
        description: "Deepen your auth and API knowledge",
        icon: "🔐",
    },
    automation: {
        id: "automation",
        label: "Automation",
        description: "Review automation workflows and triggers",
        icon: "⚙️",
    },
};

function getModeFilter(mode: string): ModeFilter {
    switch (mode) {
        case "interview":
            return {
                learningStages: ["application", "understanding"],
            };

        case "api-auth":
            return {
                topic: "api",
                concepts: [
                    "api-keys",
                    "headers",
                    "bearer-tokens",
                    "oauth-2",
                    "access-tokens",
                    "refresh-tokens",
                    "jwt",
                    "authentication",
                    "authorization",
                    "status-codes",
                    "rate-limits",
                    "pagination",
                    "idempotency",
                    "request-response",
                    "http-methods",
                ],
            };

        case "automation":
            return {
                topic: "automation",
            };

        case "weak":
            // Weak concepts mode is handled specially by client-side logic
            // This returns an empty filter to indicate "calculate from attempts"
            return {};

        case "all":
        default:
            return {};
    }
}

export function getWeakConceptsFromAttempts(
    attempts: PracticeAttempt[],
): string[] {
    if (!attempts.length) return [];

    const conceptStats = new Map<
        string,
        { attempts: number; correct: number }
    >();

    attempts.forEach((attempt) => {
        attempt.concepts?.forEach((concept) => {
            const stat = conceptStats.get(concept) ?? {
                attempts: 0,
                correct: 0,
            };
            stat.attempts += 1;
            if (attempt.correct) stat.correct += 1;
            conceptStats.set(concept, stat);
        });
    });

    const weakConcepts: string[] = [];
    conceptStats.forEach((stat, concept) => {
        if (stat.attempts >= 2) {
            const accuracy = stat.correct / stat.attempts;
            if (accuracy < 0.7) {
                weakConcepts.push(concept);
            }
        }
    });

    return weakConcepts;
}

export function filterQuestionsByMode(
    questions: Question[],
    mode: string,
    weakConcepts?: string[],
): Question[] {
    if (mode === "weak") {
        if (!weakConcepts || !weakConcepts.length) {
            return [];
        }
        // Return questions that contain at least one weak concept
        return questions.filter((q) =>
            q.concepts?.some((c) => weakConcepts.includes(c)),
        );
    }

    const filter = getModeFilter(mode);

    const filtered = questions.filter((q) => {
        // Topic filter
        if (filter.topic) {
            if (Array.isArray(filter.topic)) {
                if (!filter.topic.includes(q.topic ?? "")) return false;
            } else {
                if (q.topic !== filter.topic) return false;
            }
        }

        // Concept filter: question must have at least one of the specified concepts
        if (filter.concepts && filter.concepts.length > 0) {
            if (!q.concepts?.some((c) => filter.concepts!.includes(c))) {
                return false;
            }
        }

        // Learning stage filter
        if (filter.learningStages && filter.learningStages.length > 0) {
            if (!filter.learningStages.includes(q.learningStage ?? "")) {
                return false;
            }
        }

        return true;
    });

    

    return filtered;
}

export function getModeLabel(mode: string): string {
    return PRACTICE_MODES[mode]?.label || "Practice";
}

export function getModeDescription(mode: string): string {
    return PRACTICE_MODES[mode]?.description || "";
}

export function getModeIcon(mode: string): string {
    return PRACTICE_MODES[mode]?.icon || "📝";
}
