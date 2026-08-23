export type { Answer, Question } from "./types";

export { automationBasicsQuestions } from "./automation";
export { apiBasicsQuestions } from "./api-auth";
export { codeDataQuestions } from "./code-data";
export { aiIndustryQuestions } from "./ai-industry";

import { automationBasicsQuestions } from "./automation";
import { apiBasicsQuestions } from "./api-auth";
import { codeDataQuestions } from "./code-data";
import { aiIndustryQuestions } from "./ai-industry";

export const allQuestions = [
    ...automationBasicsQuestions,
    ...apiBasicsQuestions,
    ...codeDataQuestions,
    ...aiIndustryQuestions,
];
