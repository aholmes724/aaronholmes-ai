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
    explanation?: string;
    sourceId?: string;
    sourceReference?: string;
    shuffleAnswers?: boolean;
}

export const automationBasicsQuestions: Question[] = [
    {
        id: "automation-basics-1",
        type: "single-select",
        prompt: "Which example is automation?",
        topic: "automation",
        concepts: ["automation-definition"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "A person manually copying data between two systems",
                correct: false,
                feedback:
                    "Not quite. A person is still performing the task manually.",
            },
            {
                id: "b",
                text: "A workflow automatically creating a CRM record from a form submission",
                correct: true,
                feedback:
                    "Correct! The workflow performs the task automatically.",
            },
        ],
    },
    {
        id: "automation-basics-2",
        type: "single-select",
        prompt: "What is the main benefit of automation?",
        topic: "automation",
        concepts: ["automation-benefits"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "It guarantees that a process can never fail",
                correct: false,
                feedback:
                    "Not quite. Automated processes can still fail and need monitoring.",
            },
            {
                id: "b",
                text: "It reduces repetitive manual work",
                correct: true,
                feedback:
                    "Correct! Reducing repetitive manual work is one of automation's primary benefits.",
            },
        ],
    },
];

export const apiBasicsQuestions: Question[] = [
	{
		id: "api-basics-1",
		type: "single-select",
		prompt: "What is an API endpoint?",
		topic: "api",
		concepts: ["endpoint"],
		difficulty: "beginner",
		shuffleAnswers: true,
		answers: [
			{
				id: "a",
				text: "A specific location where an API can receive a request",
				correct: true,
				feedback:
					"Correct! An endpoint is a specific location in an API where requests can be sent.",
			},
			{
				id: "b",
				text: "The final response returned by an API",
				correct: false,
				feedback:
					"Not quite. A response is what the API sends back after processing a request.",
			},
			{
				id: "c",
				text: "A password used to authenticate an API request",
				correct: false,
				feedback:
					"Not quite. Authentication credentials can authorize a request, but they are not the endpoint.",
			},
		],
	},
];