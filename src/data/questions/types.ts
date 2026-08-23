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
