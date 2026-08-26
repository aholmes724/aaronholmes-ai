export type { Answer, Question } from "./types";

export { automationBasicsQuestions } from "./automation";
export { apiBasicsQuestions } from "./api-auth";
export { codeDataQuestions } from "./code-data";
export { aiIndustryQuestions } from "./ai-industry";
export { interviewApplicationQuestions } from "./interview-application";

import { automationBasicsQuestions } from "./automation";
import { apiBasicsQuestions } from "./api-auth";
import { codeDataQuestions } from "./code-data";
import { aiIndustryQuestions } from "./ai-industry";
import { interviewApplicationQuestions } from "./interview-application";

export const allQuestions = [
    ...automationBasicsQuestions,
    ...apiBasicsQuestions,
    ...codeDataQuestions,
    ...aiIndustryQuestions,
    ...interviewApplicationQuestions,
];
