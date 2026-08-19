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
    learningStage?: "foundational" | "applied" | "reasoning";
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
        concepts: ["automation-fundamentals"],
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
        concepts: ["automation-fundamentals"],
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
    {
        id: "automation-basics-3",
        type: "single-select",
        prompt: "What is a trigger in an automation?",
        topic: "automation",
        concepts: ["triggers-actions"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The event that starts a workflow",
                correct: true,
                feedback: "Correct! A trigger is the event that starts an automated workflow.",
            },
            {
                id: "b",
                text: "A record created after a workflow finishes",
                correct: false,
                feedback: "Not quite. That is an output or result, not the event that starts the workflow.",
            },
            {
                id: "c",
                text: "A rule for formatting a workflow step",
                correct: false,
                feedback: "Not quite. Formatting rules can affect a step, but they do not start the workflow.",
            },
        ],
    },
    {
        id: "automation-basics-4",
        type: "single-select",
        prompt: "What is an action in an automation?",
        topic: "automation",
        concepts: ["triggers-actions"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "A step that performs work after a trigger",
                correct: true,
                feedback: "Correct! An action performs work after the workflow is triggered.",
            },
            {
                id: "b",
                text: "The app selected as the workflow owner",
                correct: false,
                feedback: "Not quite. An app can provide a trigger or action, but it is not itself the action step.",
            },
            {
                id: "c",
                text: "A test that checks whether a user is online",
                correct: false,
                feedback: "Not quite. A test may validate a workflow, but it is not the general definition of an action.",
            },
        ],
    },
    {
        id: "automation-basics-5",
        type: "single-select",
        prompt: "Which trigger usually provides the fastest response?",
        topic: "automation",
        concepts: ["polling-webhooks"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "A webhook sent when the event happens",
                correct: true,
                feedback: "Correct! A webhook can notify the workflow immediately when an event occurs.",
            },
            {
                id: "b",
                text: "A daily polling schedule",
                correct: false,
                feedback: "Not quite. Daily polling can wait many hours before finding a new event.",
            },
            {
                id: "c",
                text: "A weekly spreadsheet export",
                correct: false,
                feedback: "Not quite. A weekly export introduces even more delay than frequent polling.",
            },
        ],
    },
    {
        id: "automation-basics-6",
        type: "single-select",
        prompt: "How does polling find new events?",
        topic: "automation",
        concepts: ["polling-webhooks"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The automation checks the source on a schedule",
                correct: true,
                feedback: "Correct! Polling repeatedly checks a source for records or changes.",
            },
            {
                id: "b",
                text: "The source calls the automation once per year",
                correct: false,
                feedback: "Not quite. Polling is initiated by the automation on a recurring schedule.",
            },
            {
                id: "c",
                text: "A user manually approves every event",
                correct: false,
                feedback: "Not quite. Polling is an automated check and does not require manual approval for each event.",
            },
        ],
    },
    {
        id: "automation-basics-7",
        type: "single-select",
        prompt: "What is a useful reason to choose polling?",
        topic: "automation",
        concepts: ["polling-webhooks"],
        difficulty: "intermediate",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The source does not offer event notifications",
                correct: true,
                feedback: "Correct! Polling is useful when an app cannot send webhooks or other instant events.",
            },
            {
                id: "b",
                text: "The workflow must always run without credentials",
                correct: false,
                feedback: "Not quite. Polling often still requires credentials to read the source.",
            },
            {
                id: "c",
                text: "The workflow needs zero network requests",
                correct: false,
                feedback: "Not quite. Polling depends on repeated network requests to check for changes.",
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
        concepts: ["endpoints"],
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
    {
        id: "api-basics-2",
        type: "single-select",
        prompt: "What does an API request usually contain?",
        topic: "api",
        concepts: ["api-fundamentals", "request-response"],
        difficulty: "beginner",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "A method, target URL, and optional headers or body",
                correct: true,
                feedback: "Correct! These parts tell the server what operation to perform and what data to use.",
            },
            {
                id: "b",
                text: "Only the server's final result",
                correct: false,
                feedback: "Not quite. The server's result is the response, not the request.",
            },
            {
                id: "c",
                text: "A list of every endpoint in the API",
                correct: false,
                feedback: "Not quite. A request targets one operation rather than listing the whole API.",
            },
        ],
    },
    {
        id: "api-basics-3",
        type: "single-select",
        prompt: "What is the main difference between a request and response?",
        topic: "api",
        concepts: ["request-response"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The client sends the request; the server returns the response",
                correct: true,
                feedback: "Correct! The request asks for work, and the response reports the result.",
            },
            {
                id: "b",
                text: "The response always arrives before the request",
                correct: false,
                feedback: "Not quite. The request is sent before its response can be returned.",
            },
            {
                id: "c",
                text: "Requests are only used by browsers",
                correct: false,
                feedback: "Not quite. Any API client, including an automation platform, can send requests.",
            },
        ],
    },
    {
        id: "api-basics-4",
        type: "single-select",
        prompt: "Which HTTP method commonly retrieves a resource?",
        topic: "api",
        concepts: ["http-methods"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "GET",
                correct: true,
                feedback: "Correct! GET is commonly used to read or retrieve data.",
            },
            {
                id: "b",
                text: "POST",
                correct: false,
                feedback: "Not quite. POST commonly submits data or creates a resource.",
            },
            {
                id: "c",
                text: "DELETE",
                correct: false,
                feedback: "Not quite. DELETE requests removal of a resource.",
            },
        ],
    },
    {
        id: "api-basics-5",
        type: "single-select",
        prompt: "Which HTTP method commonly creates a resource?",
        topic: "api",
        concepts: ["http-methods"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "POST",
                correct: true,
                feedback: "Correct! POST commonly submits data to create a new resource.",
            },
            {
                id: "b",
                text: "GET",
                correct: false,
                feedback: "Not quite. GET is generally used to retrieve data.",
            },
            {
                id: "c",
                text: "PUT",
                correct: false,
                feedback: "Not quite. PUT commonly replaces or updates a resource.",
            },
        ],
    },
    {
        id: "api-basics-6",
        type: "single-select",
        prompt: "What are PUT and PATCH commonly used for?",
        topic: "api",
        concepts: ["http-methods"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Updating an existing resource",
                correct: true,
                feedback: "Correct! PUT and PATCH are commonly used to update existing data.",
            },
            {
                id: "b",
                text: "Authenticating a user without sending data",
                correct: false,
                feedback: "Not quite. Authentication is handled by credentials or tokens, not these method meanings.",
            },
            {
                id: "c",
                text: "Reading an API's documentation",
                correct: false,
                feedback: "Not quite. Documentation is separate from updating a resource.",
            },
        ],
    },
    {
        id: "api-basics-7",
        type: "single-select",
        prompt: "Which HTTP method commonly removes a resource?",
        topic: "api",
        concepts: ["http-methods"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "DELETE",
                correct: true,
                feedback: "Correct! DELETE communicates that a resource should be removed.",
            },
            {
                id: "b",
                text: "POST",
                correct: false,
                feedback: "Not quite. POST commonly creates or submits data.",
            },
            {
                id: "c",
                text: "GET",
                correct: false,
                feedback: "Not quite. GET commonly retrieves data without requesting deletion.",
            },
        ],
    },
    {
        id: "api-basics-8",
        type: "single-select",
        prompt: "What is JSON commonly used for in an API?",
        topic: "api",
        concepts: ["json"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Representing structured data in a request or response",
                correct: true,
                feedback: "Correct! JSON is a common format for structured API data.",
            },
            {
                id: "b",
                text: "Encrypting a password before it leaves a device",
                correct: false,
                feedback: "Not quite. JSON structures data but does not encrypt it.",
            },
            {
                id: "c",
                text: "Replacing the API's authentication system",
                correct: false,
                feedback: "Not quite. JSON is a data format, not an authentication system.",
            },
        ],
    },
    {
        id: "api-basics-9",
        type: "single-select",
        prompt: "Where is a common JSON object value stored?",
        topic: "api",
        concepts: ["json"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Under a named key",
                correct: true,
                feedback: "Correct! JSON objects store values under named keys, such as {\"name\": \"Sam\"}.",
            },
            {
                id: "b",
                text: "Only in the URL path",
                correct: false,
                feedback: "Not quite. A JSON value is in the request or response body, not necessarily the URL path.",
            },
            {
                id: "c",
                text: "Only in an HTTP status code",
                correct: false,
                feedback: "Not quite. Status codes are separate from JSON object fields.",
            },
        ],
    },
    {
        id: "api-basics-10",
        type: "single-select",
        prompt: "What is a webhook?",
        topic: "api",
        concepts: ["webhooks"],
        difficulty: "beginner",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "An HTTP callback sent when an event occurs",
                correct: true,
                feedback: "Correct! A webhook lets one system notify another by sending an HTTP request.",
            },
            {
                id: "b",
                text: "A report downloaded once per month",
                correct: false,
                feedback: "Not quite. A webhook is an event notification, not a scheduled report.",
            },
            {
                id: "c",
                text: "A private copy of an API database",
                correct: false,
                feedback: "Not quite. A webhook sends an event request and does not copy a database.",
            },
        ],
    },
    {
        id: "api-basics-11",
        type: "single-select",
        prompt: "Where should an API key usually be sent?",
        topic: "api",
        concepts: ["api-keys", "headers"],
        difficulty: "beginner",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "In the location required by the API, often a header",
                correct: true,
                feedback: "Correct! APIs commonly expect keys in a specific header, though some use another documented location.",
            },
            {
                id: "b",
                text: "Inside the HTTP method name",
                correct: false,
                feedback: "Not quite. HTTP methods describe the operation and do not carry the key.",
            },
            {
                id: "c",
                text: "Only in the response status code",
                correct: false,
                feedback: "Not quite. A status code reports the result and is not a credential location.",
            },
        ],
    },
    {
        id: "api-basics-12",
        type: "single-select",
        prompt: "What does a bearer token indicate in a request?",
        topic: "api",
        concepts: ["bearer-tokens", "authentication-authorization"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The caller is presenting the token for access",
                correct: true,
                feedback: "Correct! Whoever bears the token can present it, so it must be protected like a credential.",
            },
            {
                id: "b",
                text: "The response body is always JSON",
                correct: false,
                feedback: "Not quite. Token type does not determine the response format.",
            },
            {
                id: "c",
                text: "The request should never include a URL",
                correct: false,
                feedback: "Not quite. A bearer token is an authorization credential, not a replacement for the request URL.",
            },
        ],
    },
    {
        id: "api-basics-13",
        type: "single-select",
        prompt: "What is the basic purpose of OAuth?",
        topic: "api",
        concepts: ["oauth", "authentication-authorization"],
        difficulty: "intermediate",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Granting limited access without sharing a user's password",
                correct: true,
                feedback: "Correct! OAuth lets a user authorize scoped access through tokens instead of sharing a password.",
            },
            {
                id: "b",
                text: "Compressing every API response",
                correct: false,
                feedback: "Not quite. Compression is separate from delegated authorization.",
            },
            {
                id: "c",
                text: "Replacing all HTTP methods with one method",
                correct: false,
                feedback: "Not quite. OAuth handles authorization and does not change HTTP methods.",
            },
        ],
    },
    {
        id: "api-basics-14",
        type: "single-select",
        prompt: "What is the usual role of a refresh token?",
        topic: "api",
        concepts: ["access-refresh-tokens", "oauth"],
        difficulty: "intermediate",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Getting a new access token without signing in again",
                correct: true,
                feedback: "Correct! A refresh token can be exchanged for a new access token when the old one expires.",
            },
            {
                id: "b",
                text: "Sending the main business data to every endpoint",
                correct: false,
                feedback: "Not quite. Business data belongs in the relevant request, not in a refresh token.",
            },
            {
                id: "c",
                text: "Replacing the API's endpoint path",
                correct: false,
                feedback: "Not quite. A refresh token supports token renewal and does not replace the endpoint.",
            },
        ],
    },
    {
        id: "api-basics-15",
        type: "single-select",
        prompt: "What is a JWT commonly made of?",
        topic: "api",
        concepts: ["jwt"],
        difficulty: "intermediate",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "A header, payload, and signature",
                correct: true,
                feedback: "Correct! A JWT commonly contains encoded header and payload sections plus a signature.",
            },
            {
                id: "b",
                text: "A URL, database table, and password",
                correct: false,
                feedback: "Not quite. Those are not the standard structural parts of a JWT.",
            },
            {
                id: "c",
                text: "Only an encrypted database record",
                correct: false,
                feedback: "Not quite. A JWT is a signed token format and its payload should not be assumed encrypted.",
            },
        ],
    },
    {
        id: "api-basics-16",
        type: "single-select",
        prompt: "What is the difference between authentication and authorization?",
        topic: "api",
        concepts: ["authentication-authorization"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Authentication verifies identity; authorization controls access",
                correct: true,
                feedback: "Correct! Authentication asks who you are, while authorization asks what you may do.",
            },
            {
                id: "b",
                text: "Authentication deletes data; authorization creates it",
                correct: false,
                feedback: "Not quite. Both terms describe security decisions, not CRUD operations.",
            },
            {
                id: "c",
                text: "They are two names for the same HTTP method",
                correct: false,
                feedback: "Not quite. They are related but distinct security concepts.",
            },
        ],
    },
    {
        id: "api-basics-17",
        type: "single-select",
        prompt: "What does a 404 response usually mean?",
        topic: "api",
        concepts: ["status-codes"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The requested resource was not found",
                correct: true,
                feedback: "Correct! A 404 usually means the requested resource or route could not be found.",
            },
            {
                id: "b",
                text: "The request succeeded and created a resource",
                correct: false,
                feedback: "Not quite. A successful creation is commonly represented by 201.",
            },
            {
                id: "c",
                text: "The server is permanently unavailable",
                correct: false,
                feedback: "Not quite. A server-side outage is more commonly represented by a 5xx status.",
            },
        ],
    },
    {
        id: "api-basics-18",
        type: "single-select",
        prompt: "What does a 401 response usually indicate?",
        topic: "api",
        concepts: ["status-codes", "authentication-authorization"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Authentication is missing or invalid",
                correct: true,
                feedback: "Correct! A 401 commonly means the request lacks valid authentication credentials.",
            },
            {
                id: "b",
                text: "The server created a new resource",
                correct: false,
                feedback: "Not quite. Resource creation is commonly reported with 201.",
            },
            {
                id: "c",
                text: "The client sent too many requests",
                correct: false,
                feedback: "Not quite. Too many requests is commonly reported with 429.",
            },
        ],
    },
    {
        id: "api-basics-19",
        type: "single-select",
        prompt: "What does a 429 response usually mean?",
        topic: "api",
        concepts: ["status-codes", "rate-limits"],
        difficulty: "beginner",
        learningStage: "applied",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "The client sent too many requests in a period",
                correct: true,
                feedback: "Correct! 429 signals that a rate limit has been exceeded.",
            },
            {
                id: "b",
                text: "The endpoint returned a valid empty list",
                correct: false,
                feedback: "Not quite. An empty result can still be successful and does not mean rate limiting.",
            },
            {
                id: "c",
                text: "The request used the GET method",
                correct: false,
                feedback: "Not quite. Rate limits can apply regardless of the HTTP method.",
            },
        ],
    },
    {
        id: "api-basics-20",
        type: "single-select",
        prompt: "What are HTTP headers commonly used for?",
        topic: "api",
        concepts: ["headers"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Metadata such as authentication and content type",
                correct: true,
                feedback: "Correct! Headers carry metadata about the request or response, including credentials and format.",
            },
            {
                id: "b",
                text: "Only the server's database rows",
                correct: false,
                feedback: "Not quite. Database rows are usually represented in a body, not as header metadata.",
            },
            {
                id: "c",
                text: "The user's screen resolution only",
                correct: false,
                feedback: "Not quite. Headers can carry many kinds of protocol metadata.",
            },
        ],
    },
    {
        id: "api-basics-21",
        type: "single-select",
        prompt: "What is a query parameter useful for?",
        topic: "api",
        concepts: ["query-parameters"],
        difficulty: "beginner",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Filtering, sorting, or limiting returned data",
                correct: true,
                feedback: "Correct! Query parameters commonly customize a collection request without changing its path.",
            },
            {
                id: "b",
                text: "Signing a response with a private key",
                correct: false,
                feedback: "Not quite. Signing is a security operation, while query parameters modify request options.",
            },
            {
                id: "c",
                text: "Changing the server's HTTP method",
                correct: false,
                feedback: "Not quite. The method is separate from query parameters.",
            },
        ],
    },
    {
        id: "api-basics-22",
        type: "single-select",
        prompt: "What should a client do after receiving a rate-limit response?",
        topic: "api",
        concepts: ["rate-limits"],
        difficulty: "intermediate",
        learningStage: "reasoning",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Wait and retry according to the API's guidance",
                correct: true,
                feedback: "Correct! Waiting, often using a Retry-After value or backoff, avoids repeated rejected requests.",
            },
            {
                id: "b",
                text: "Immediately send the same request repeatedly",
                correct: false,
                feedback: "Not quite. Repeating immediately can extend the limit or increase the failure rate.",
            },
            {
                id: "c",
                text: "Assume the request succeeded without checking",
                correct: false,
                feedback: "Not quite. The client should treat the response as a rejected request unless documented otherwise.",
            },
        ],
    },
    {
        id: "api-basics-23",
        type: "single-select",
        prompt: "What does idempotent mean for an API operation?",
        topic: "api",
        concepts: ["idempotency"],
        difficulty: "intermediate",
        learningStage: "reasoning",
        shuffleAnswers: true,
        answers: [
            {
                id: "a",
                text: "Repeating it has the same intended result as doing it once",
                correct: true,
                feedback: "Correct! Idempotency makes retries safer because repeated requests preserve the intended state.",
            },
            {
                id: "b",
                text: "It always returns the same response text",
                correct: false,
                feedback: "Not quite. Responses can differ in metadata while the intended resource state remains the same.",
            },
            {
                id: "c",
                text: "It cannot ever return an error",
                correct: false,
                feedback: "Not quite. An idempotent operation can still fail; idempotency concerns repeated effects.",
            },
        ],
    },
];