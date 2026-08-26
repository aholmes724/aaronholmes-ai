import type { Question } from "./questions";

export interface PracticeAttempt {
    questionId: string;
    answerId: string;
    correct: boolean;
    answeredAt: string;
    topic?: string;
    concepts?: string[];
    difficulty?: Question["difficulty"];
    learningStage?: Question["learningStage"];
    sessionId?: string;
    masteryConcept?: string;
}

export interface PracticeSessionSummary {
    id: string;
    mode: string;
    requestedLength: string;
    startedAt: string;
    completedAt: string;
    questionCount: number;
    answeredCount: number;
    correctCount: number;
}

export type ConceptMasteryStatus =
    | "learning"
    | "weak"
    | "developing"
    | "strong";

export interface ConceptMasterySummary {
    concept: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    lastAnsweredAt?: string;
    status: ConceptMasteryStatus;
}

export const ATTEMPTS_STORAGE_KEY = "aaronholmes.practice.attempts";
export const SESSIONS_STORAGE_KEY = "aaronholmes.practice.sessions";

export function readPracticeAttempts(): PracticeAttempt[] {
    try {
        const storedAttempts = localStorage.getItem(ATTEMPTS_STORAGE_KEY);

        if (!storedAttempts) return [];

        const attempts: unknown = JSON.parse(storedAttempts);

        return Array.isArray(attempts)
            ? (attempts as PracticeAttempt[])
            : [];
    } catch {
        return [];
    }
}

export function savePracticeAttempt(attempt: PracticeAttempt): void {
    try {
        const attempts = readPracticeAttempts();

        attempts.push(attempt);

        localStorage.setItem(
            ATTEMPTS_STORAGE_KEY,
            JSON.stringify(attempts),
        );
    } catch {
        // Local storage can be unavailable or full.
        // Scoring should still work.
    }
}

export function readSessionSummaries(): PracticeSessionSummary[] {
    try {
        const storedSessions = localStorage.getItem(
            SESSIONS_STORAGE_KEY,
        );

        if (!storedSessions) return [];

        const sessions: unknown = JSON.parse(storedSessions);

        return Array.isArray(sessions)
            ? (sessions as PracticeSessionSummary[])
            : [];
    } catch {
        return [];
    }
}

export function saveSessionSummary(
    summary: PracticeSessionSummary,
): void {
    try {
        const sessions = readSessionSummaries();

        const existingIndex = sessions.findIndex(
            (session) => session.id === summary.id,
        );

        if (existingIndex !== -1) {
            sessions[existingIndex] = summary;
        } else {
            sessions.push(summary);
        }

        localStorage.setItem(
            SESSIONS_STORAGE_KEY,
            JSON.stringify(sessions),
        );
    } catch {
        // Local storage can be unavailable or full.
        // Scoring should still work.
    }
}

function getMasteryStatus(
    attempts: number,
    accuracy: number,
): ConceptMasteryStatus {
    if (attempts < 3) {
        return "learning";
    }

    if (accuracy < 0.6) {
        return "weak";
    }

    if (accuracy < 0.8) {
        return "developing";
    }

    return "strong";
}


export function getConceptMastery(
    attempts: PracticeAttempt[] = readPracticeAttempts(),
): ConceptMasterySummary[] {
    const conceptMap = new Map<
        string,
        {
            attempts: number;
            correct: number;
            lastAnsweredAt?: string;
        }
    >();

    attempts.forEach((attempt) => {
        const concepts = attempt.masteryConcept
            ? [attempt.masteryConcept]
            : attempt.concepts ?? [];

        concepts.forEach((concept) => {
            const existing = conceptMap.get(concept) ?? {
                attempts: 0,
                correct: 0,
                lastAnsweredAt: undefined,
            };

            existing.attempts += 1;

            if (attempt.correct) {
                existing.correct += 1;
            }

            if (
                !existing.lastAnsweredAt ||
                attempt.answeredAt > existing.lastAnsweredAt
            ) {
                existing.lastAnsweredAt = attempt.answeredAt;
            }

            conceptMap.set(concept, existing);
        });
    });

    return Array.from(conceptMap.entries())
        .map(([concept, stats]) => {
            const accuracy =
                stats.attempts > 0
                    ? stats.correct / stats.attempts
                    : 0;

            return {
                concept,
                attempts: stats.attempts,
                correct: stats.correct,
                incorrect: stats.attempts - stats.correct,
                accuracy,
                lastAnsweredAt: stats.lastAnsweredAt,
                status: getMasteryStatus(
                    stats.attempts,
                    accuracy,
                ),
            };
        })
        .sort((a, b) => {
            if (a.status === "weak" && b.status !== "weak") {
                return -1;
            }

            if (b.status === "weak" && a.status !== "weak") {
                return 1;
            }

            if (a.accuracy !== b.accuracy) {
                return a.accuracy - b.accuracy;
            }

            return b.attempts - a.attempts;
        });
}

export function getWeakConcepts(
    attempts: PracticeAttempt[] = readPracticeAttempts(),
): ConceptMasterySummary[] {
    return getConceptMastery(attempts).filter(
        (concept) => concept.status === "weak",
    );
}

export function clearPracticeAttempts(): void {
    try {
        localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
        localStorage.removeItem(SESSIONS_STORAGE_KEY);
    } catch {
        // Local storage can be unavailable.
        // Existing history remains untouched.
    }
}