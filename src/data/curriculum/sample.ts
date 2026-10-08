import type { CurriculumPackage } from "./types";

export const sampleCurriculum: CurriculumPackage = {
    id: "sample-api-reliability",
    title: "Sample API Reliability Curriculum",
    version: "1.0.0",
    sources: [
        {
            id: "sample-api-notes",
            title: "Sample API reliability notes",
            kind: "notes",
            notes: "Demonstration source used to exercise the curriculum pipeline.",
        },
    ],
    concepts: [
        {
            id: "retries",
            label: "Retries",
            description: "Safe retry behavior for transient API failures.",
        },
        {
            id: "status-codes",
            label: "Status codes",
            description: "HTTP status interpretation for client behavior.",
        },
    ],
    learningObjectives: [
        {
            id: "retry-after-handling",
            conceptId: "retries",
            description: "Choose appropriate client behavior when Retry-After is present.",
            learningStage: "application",
        },
    ],
    questionDrafts: [
        {
            id: "curriculum-sample-retry-after-1",
            type: "single-select",
            prompt:
                "A service returns 429 with Retry-After: 30. What should a robust client do next?",
            answers: [
                {
                    id: "a",
                    text: "Wait at least 30 seconds before retrying, then continue with bounded retry logic",
                    correct: true,
                    feedback:
                        "Correct. Retry-After is a server-directed cooldown signal and should be honored.",
                },
                {
                    id: "b",
                    text: "Retry immediately because 429 means the request was not processed",
                    correct: false,
                    feedback:
                        "A 429 indicates rate limiting; an immediate retry can worsen the condition.",
                },
                {
                    id: "c",
                    text: "Treat the response as a permanent authentication failure",
                    correct: false,
                    feedback:
                        "Authentication failures are typically represented by 401 or 403, not 429.",
                },
            ],
            topic: "api",
            conceptIds: ["retries", "status-codes"],
            masteryConcept: "retries",
            learningObjectiveId: "retry-after-handling",
            difficulty: "intermediate",
            learningStage: "application",
            explanation:
                "Retry-After tells the client how long to pause before making another attempt. A resilient client honors that interval and uses bounded retry behavior rather than retrying in a tight loop.",
            sourceId: "sample-api-notes",
            sourceReference: "Retry guidance, sample section 1",
            shuffleAnswers: true,
            validationStatus: "approved",
        },
    ],
};
