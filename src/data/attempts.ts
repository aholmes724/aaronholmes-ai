export interface PracticeAttempt {
    questionId: string;
    answerId: string;
    correct: boolean;
    answeredAt: string;
    topic?: string;
    concepts?: string[];
}

export const ATTEMPTS_STORAGE_KEY = "aaronholmes.practice.attempts";

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