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
}

// Summary of one completed practice session; separate from the cumulative
// attempt stream so per-session history can be shown without affecting
// concept/topic analytics, which continue to read the full attempt array.
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

export const ATTEMPTS_STORAGE_KEY = "aaronholmes.practice.attempts";
export const SESSIONS_STORAGE_KEY = "aaronholmes.practice.sessions";

export function readPracticeAttempts(): PracticeAttempt[] {
    try {
        const storedAttempts = localStorage.getItem(ATTEMPTS_STORAGE_KEY);

        if (!storedAttempts) return [];

        const attempts: unknown = JSON.parse(storedAttempts);

        return Array.isArray(attempts) ? (attempts as PracticeAttempt[]) : [];
    } catch {
        return [];
    }
}

export function savePracticeAttempt(attempt: PracticeAttempt): void {
    try {
        const attempts = readPracticeAttempts();
        attempts.push(attempt);
        localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
    } catch {
        // Local storage can be unavailable or full; scoring should still work.
    }
}

export function readSessionSummaries(): PracticeSessionSummary[] {
    try {
        const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);

        if (!storedSessions) return [];

        const sessions: unknown = JSON.parse(storedSessions);

        return Array.isArray(sessions) ? (sessions as PracticeSessionSummary[]) : [];
    } catch {
        return [];
    }
}

export function saveSessionSummary(summary: PracticeSessionSummary): void {
    try {
        const sessions = readSessionSummaries();
        // Idempotent by id: a re-fired completion updates the existing entry
        // instead of appending a duplicate.
        const existingIndex = sessions.findIndex((s) => s.id === summary.id);

        if (existingIndex !== -1) {
            sessions[existingIndex] = summary;
        } else {
            sessions.push(summary);
        }

        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
        // Local storage can be unavailable or full; scoring should still work.
    }
}

export function clearPracticeAttempts(): void {
    try {
        localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
        localStorage.removeItem(SESSIONS_STORAGE_KEY);
    } catch {
        // Local storage can be unavailable; the existing history remains untouched.
    }
}