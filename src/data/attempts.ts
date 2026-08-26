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
    masteryScore: number;
    recentCorrectStreak: number;
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

const MASTERY_RECENCY_DECAY = 0.8;

interface ConceptObservation {
    correct: boolean;
    answeredAt: string;
}

function calculateMasteryScore(
    observations: ConceptObservation[],
): number {
    if (!observations.length) return 0;

    const newestFirst = [...observations].sort(
        (first, second) =>
            new Date(second.answeredAt).getTime() -
            new Date(first.answeredAt).getTime(),
    );

    let weight = 1;
    let weightedCorrect = 0;
    let totalWeight = 0;

    newestFirst.forEach((observation) => {
        weightedCorrect += observation.correct ? weight : 0;
        totalWeight += weight;
        weight *= MASTERY_RECENCY_DECAY;
    });

    return totalWeight > 0
        ? weightedCorrect / totalWeight
        : 0;
}

function getRecentCorrectStreak(
    observations: ConceptObservation[],
): number {
    const newestFirst = [...observations].sort(
        (first, second) =>
            new Date(second.answeredAt).getTime() -
            new Date(first.answeredAt).getTime(),
    );

    let streak = 0;

    for (const observation of newestFirst) {
        if (!observation.correct) break;
        streak += 1;
    }

    return streak;
}

function getMasteryStatus(
    attempts: number,
    masteryScore: number,
    recentCorrectStreak: number,
): ConceptMasteryStatus {
    if (attempts < 3) {
        return "learning";
    }

    if (masteryScore < 0.6) {
        return "weak";
    }

    if (
        masteryScore >= 0.8 &&
        recentCorrectStreak >= 3
    ) {
        return "strong";
    }

    return "developing";
}

export function getConceptMastery(
    attempts: PracticeAttempt[] = readPracticeAttempts(),
): ConceptMasterySummary[] {
    const conceptMap = new Map<
        string,
        {
            attempts: number;
            correct: number;
            observations: ConceptObservation[];
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
                observations: [],
                lastAnsweredAt: undefined,
            };

            existing.attempts += 1;

            if (attempt.correct) {
                existing.correct += 1;
            }

            existing.observations.push({
                correct: attempt.correct,
                answeredAt: attempt.answeredAt,
            });

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

            const masteryScore =
                calculateMasteryScore(stats.observations);

            const recentCorrectStreak =
                getRecentCorrectStreak(stats.observations);

            return {
                concept,
                attempts: stats.attempts,
                correct: stats.correct,
                incorrect: stats.attempts - stats.correct,
                accuracy,
                masteryScore,
                recentCorrectStreak,
                lastAnsweredAt: stats.lastAnsweredAt,
                status: getMasteryStatus(
                    stats.attempts,
                    masteryScore,
                    recentCorrectStreak,
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

            if (a.masteryScore !== b.masteryScore) {
                return a.masteryScore - b.masteryScore;
            }

            return b.attempts - a.attempts;
        });
}

export function getConceptFocusScore(
    concept: ConceptMasterySummary,
): number {
    const statusWeight: Record<ConceptMasteryStatus, number> = {
        weak: 4,
        developing: 3,
        learning: 1,
        strong: 0,
    };

    const evidenceWeight =
        Math.min(concept.attempts, 10) / 10;

    const errorWeight =
        1 - concept.masteryScore;

    const lastAnsweredTime = concept.lastAnsweredAt
        ? new Date(concept.lastAnsweredAt).getTime()
        : 0;

    const daysSinceLastAttempt = lastAnsweredTime
        ? Math.max(
            0,
            (Date.now() - lastAnsweredTime) /
            (1000 * 60 * 60 * 24),
        )
        : 30;

    const recencyWeight =
        Math.min(daysSinceLastAttempt, 30) / 30;

    return (
        statusWeight[concept.status] * 10 +
        errorWeight * 5 +
        evidenceWeight +
        recencyWeight
    );
}

export function getTargetConcepts(
    attempts: PracticeAttempt[] = readPracticeAttempts(),
    limit = 5,
): ConceptMasterySummary[] {
    const mastery = getConceptMastery(attempts);

    const priority = mastery
        .filter(
            (concept) =>
                concept.status === "weak" ||
                concept.status === "developing",
        )
        .sort(
            (first, second) =>
                getConceptFocusScore(second) -
                getConceptFocusScore(first),
        );

    if (priority.length >= limit) {
        return priority.slice(0, limit);
    }

    // When too few weak/developing concepts exist to make a varied session,
    // fill the remaining target slots with limited-data concepts. This keeps
    // weak concepts first while preventing a short targeted session from
    // becoming five versions of the same concept.
    const limitedData = mastery
        .filter((concept) => concept.status === "learning")
        .sort((first, second) => {
            if (first.attempts !== second.attempts) {
                return first.attempts - second.attempts;
            }

            return (
                getConceptFocusScore(second) -
                getConceptFocusScore(first)
            );
        });

    return [...priority, ...limitedData].slice(0, limit);
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
