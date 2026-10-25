export interface Answer {
    id: string;
    text: string;
    correct: boolean;
    feedback: string;
}

export interface Question {
    id: string;
    type: "single-select" | "multi-select";
    prompt: string;
    answers: Answer[];

    topic?: string;
    concepts?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
    learningStage?: "recognition" | "understanding" | "application";
    explanation?: string;
    sourceId?: string;
    sourceReference?: string;
    shuffleAnswers?: boolean;
    masteryConcept?: string;
    learningObjective?: string;
    version?: number;

    /**
     * Optional stable semantic grouping key for related question variants.
     *
     * Exact feedback identity remains id + version. This key is deliberately
     * separate so future curriculum-generated questions can share quality
     * signals without pretending that semantically related questions are the
     * same concrete item. A later embedding/vector layer can augment or replace
     * how these groups are discovered without changing question identity.
     */
    semanticKey?: string;
}
