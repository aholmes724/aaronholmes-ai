export const QUESTION_LEARNING_OBJECTIVES: Record<string, string> = {
    "automation-basics-1": "automation-vs-manual-work",
    "automation-basics-2": "automation-value",
    "automation-basics-6": "polling-mechanism",
    "automation-basics-7": "polling-use-case",
    "automation-basics-8": "zap-structure",
    "api-basics-19": "rate-limit-signal",
    "api-basics-32": "retry-after-meaning",
    "api-basics-41": "rate-limit-recovery",
    "ai-industry-34": "rate-limit-recovery",
};

export function getLearningObjective(
    questionId: string,
    explicitObjective?: string,
): string {
    return explicitObjective ?? QUESTION_LEARNING_OBJECTIVES[questionId] ?? questionId;
}
