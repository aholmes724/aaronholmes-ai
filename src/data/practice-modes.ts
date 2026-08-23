import type { PracticeAttempt } from "./attempts";

export interface PracticeMode {
    id: string;
    label: string;
    description: string;
    icon?: string;
}

// Minimal shape needed for mode matching; satisfied by both Question objects
// and dataset-derived metadata read from rendered quiz elements in the browser.
export interface QuestionMeta {
    topic?: string;
    concepts?: string[];
    learningStage?: string;
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
    "code-data": {
        id: "code-data",
        label: "Code & Data",
        description: "Practice coding and data-handling concepts",
        icon: "🧮",
    },
    "ai-industry": {
        id: "ai-industry",
        label: "AI & Industry",
        description: "Practice AI concepts and industry context",
        icon: "🤖",
    },
};

// Single source of truth for mode selection rules. Both server-side filtering
// (filterQuestionsByMode) and client-side filtering (matchesMode) read from
// this same config so mode logic never has to be duplicated or drift apart.
const MODE_FILTERS: Record<string, ModeFilter> = {
    all: {},
    interview: {
        learningStages: ["understanding", "application"],
    },
    "api-auth": {
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
    },
    automation: {
        topic: "automation",
    },
    "code-data": {
        topic: "code-data",
    },
    "ai-industry": {
        topic: "ai-industry",
    },
};

/** Weak mode is handled separately via matchesWeakConcepts; every other mode is matched here. */
export function matchesMode(question: QuestionMeta, mode: string): boolean {
    const filter = MODE_FILTERS[mode];
    if (!filter) return true;

    if (filter.topic) {
        const topics = Array.isArray(filter.topic) ? filter.topic : [filter.topic];
        if (!topics.includes(question.topic ?? "")) return false;
    }

    if (filter.concepts && filter.concepts.length > 0) {
        if (!question.concepts?.some((c) => filter.concepts!.includes(c))) {
            return false;
        }
    }

    if (filter.learningStages && filter.learningStages.length > 0) {
        if (!filter.learningStages.includes(question.learningStage ?? "")) {
            return false;
        }
    }

    return true;
}

export function matchesWeakConcepts(
    question: QuestionMeta,
    weakConcepts: string[],
): boolean {
    if (!weakConcepts.length) return false;
    return question.concepts?.some((c) => weakConcepts.includes(c)) ?? false;
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

/** Server-side/testing convenience wrapper around matchesMode / matchesWeakConcepts. */
export function filterQuestionsByMode<T extends QuestionMeta>(
    questions: T[],
    mode: string,
    weakConcepts?: string[],
): T[] {
    if (mode === "weak") {
        return questions.filter((q) => matchesWeakConcepts(q, weakConcepts ?? []));
    }

    return questions.filter((q) => matchesMode(q, mode));
}

export function getModeDescription(mode: string): string {
    return PRACTICE_MODES[mode]?.description || "";
}
