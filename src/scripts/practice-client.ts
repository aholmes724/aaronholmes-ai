import {
    savePracticeAttempt,
    readPracticeAttempts,
    saveSessionSummary,
    getTargetConcepts,
} from "../data/attempts";
import {
    matchesMode,
    getModeDescription,
    type QuestionMeta,
} from "../data/practice-modes";
import { readQuestionReviewStates } from "../data/question-feedback";

const sessionId = crypto.randomUUID();
const sessionStartedAt = new Date().toISOString();
let sessionSummarySaved = false;

const practiceScore = document.querySelector<HTMLElement>("#practice-score");
const answeredCount = document.querySelector<HTMLElement>("#answered-count");
const sessionComplete = document.querySelector<HTMLElement>("#session-complete");
const nextQuestion = document.querySelector<HTMLButtonElement>("#next-question");
const nextQuestionContainer =
    document.querySelector<HTMLElement>("#next-question-container");
const currentQuestionNumber =
    document.querySelector<HTMLElement>("#current-question-number");
const finalScore = document.querySelector<HTMLElement>("#final-score");
const finalAnswered = document.querySelector<HTMLElement>("#final-answered");
const finalAccuracy = document.querySelector<HTMLElement>("#final-accuracy");
const sessionLengthSelect =
    document.querySelector<HTMLSelectElement>("#session-length-select");
const newSession = document.querySelector<HTMLAnchorElement>("#new-session");
const practiceDescription = document.getElementById("practice-description");
const practiceEmptyState = document.getElementById("practice-empty-state");
const answeredQuestions = new Set<string>();

const allSessionCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("[data-session-question]"),
);

const getQuiz = (question: HTMLElement) =>
    question.querySelector<HTMLElement>(".quiz-question");

const getQuestionId = (question: HTMLElement) =>
    getQuiz(question)?.dataset.questionId ?? "";

const retiredQuestionIds = new Set(
    readQuestionReviewStates()
        .filter((state) => state.status === "retired")
        .map((state) => state.questionId),
);

const sessionCandidates = allSessionCandidates.filter(
    (question) => !retiredQuestionIds.has(getQuestionId(question)),
);

const searchParams = new URLSearchParams(window.location.search);
const mode = searchParams.get("mode") ?? "all";
const topic = searchParams.get("topic");
const requestedLength = searchParams.get("length");
const validLengths = ["5", "10", "20", "all"];
const selectedLength = validLengths.includes(requestedLength ?? "")
    ? requestedLength!
    : "5";

document
    .querySelectorAll<HTMLButtonElement>(".practice-mode-button")
    .forEach((button) => {
        const buttonMode = button.dataset.mode ?? "";
        button.classList.toggle("active", buttonMode === mode);
        button.addEventListener("click", () => {
            window.location.href = `/practice?mode=${buttonMode}`;
        });
    });

if (practiceDescription) {
    practiceDescription.textContent = getModeDescription(mode);
}

if (sessionLengthSelect) {
    sessionLengthSelect.value = selectedLength;
}

const buildPracticeUrl = (
    nextMode: string | null,
    nextTopic: string | null,
    nextLength: string,
) => {
    const params = new URLSearchParams();
    const modeToUse = nextMode ?? mode;

    if (modeToUse && modeToUse !== "all") params.set("mode", modeToUse);
    if (nextTopic && nextTopic !== "all") params.set("topic", nextTopic);
    if (nextLength !== "5") params.set("length", nextLength);

    const query = params.toString();
    return query ? `/practice?${query}` : "/practice";
};

if (newSession) {
    newSession.href = buildPracticeUrl(mode, topic, selectedLength);
}

const getMasteryConcept = (question: HTMLElement) =>
    getQuiz(question)?.dataset.masteryConcept ?? "";

const getLearningObjective = (question: HTMLElement) =>
    getQuiz(question)?.dataset.learningObjective ?? getQuestionId(question);

const getLearningStage = (question: HTMLElement) =>
    getQuiz(question)?.dataset.learningStage ?? "recognition";

const stageRank = (question: HTMLElement) => {
    const stage = getLearningStage(question);
    if (stage === "application") return 0;
    if (stage === "understanding") return 1;
    return 2;
};

const toQuestionMeta = (quiz: HTMLElement | null): QuestionMeta => ({
    topic: quiz?.dataset.topic,
    concepts: quiz?.dataset.concepts?.split(",").filter(Boolean) ?? [],
    learningStage: quiz?.dataset.learningStage,
});

const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [
            result[swapIndex],
            result[index],
        ];
    }

    return result;
};

let filteredByMode: HTMLElement[] = [];

if (mode === "weak") {
    const attempts = readPracticeAttempts();
    const targetConcepts = getTargetConcepts(attempts, 10);
    const targetRank = new Set(targetConcepts.map((target) => target.concept));

    const recentAttempts = [...attempts]
        .sort(
            (first, second) =>
                new Date(second.answeredAt).getTime() -
                new Date(first.answeredAt).getTime(),
        )
        .slice(0, 10);

    const recentQuestionIds = new Set(
        recentAttempts.map((attempt) => attempt.questionId),
    );

    const questionById = new Map(
        sessionCandidates.map((question) => [getQuestionId(question), question]),
    );

    const recentObjectives = new Set(
        recentAttempts
            .map((attempt) => questionById.get(attempt.questionId))
            .filter((question): question is HTMLElement => Boolean(question))
            .map((question) => getLearningObjective(question)),
    );

    const targetedCandidates = sessionCandidates.filter((question) =>
        targetRank.has(getMasteryConcept(question)),
    );

    const buckets = new Map<string, HTMLElement[]>();

    targetConcepts.forEach((target) => {
        buckets.set(target.concept, []);
    });

    targetedCandidates.forEach((question) => {
        buckets.get(getMasteryConcept(question))?.push(question);
    });

    buckets.forEach((questions, concept) => {
        buckets.set(concept, shuffle(questions));
    });

    const targetConceptNames = targetConcepts
        .map((target) => target.concept)
        .filter((concept) => (buckets.get(concept)?.length ?? 0) > 0);

    const desiredCount =
        selectedLength === "all"
            ? targetedCandidates.length
            : Number(selectedLength);

    const selected: HTMLElement[] = [];
    const usedObjectives = new Set<string>();

    const pickBestCandidate = (candidates: HTMLElement[]) => {
        if (!candidates.length) return undefined;

        let bestIndex = 0;
        let bestScore = Number.POSITIVE_INFINITY;

        candidates.forEach((candidate, index) => {
            const objective = getLearningObjective(candidate);
            const score =
                (usedObjectives.has(objective) ? 100 : 0) +
                stageRank(candidate) * 10 +
                (recentQuestionIds.has(getQuestionId(candidate)) ? 4 : 0) +
                (recentObjectives.has(objective) ? 2 : 0) +
                Math.random() * 0.1;

            if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        return candidates.splice(bestIndex, 1)[0];
    };

    for (const concept of targetConceptNames) {
        if (selected.length >= desiredCount) break;

        const bucket = buckets.get(concept);
        if (!bucket?.length) continue;

        const candidate = pickBestCandidate(bucket);
        if (!candidate) continue;

        selected.push(candidate);
        usedObjectives.add(getLearningObjective(candidate));
    }

    while (selected.length < desiredCount) {
        let addedThisPass = false;

        for (const concept of targetConceptNames) {
            if (selected.length >= desiredCount) break;

            const bucket = buckets.get(concept);
            if (!bucket?.length) continue;

            const candidate = pickBestCandidate(bucket);
            if (!candidate) continue;

            selected.push(candidate);
            usedObjectives.add(getLearningObjective(candidate));
            addedThisPass = true;
        }

        if (!addedThisPass) break;
    }

    filteredByMode = selected;
} else {
    filteredByMode = sessionCandidates.filter((question) => {
        const quiz = getQuiz(question);
        if (!quiz) return false;

        if (mode === "all" && topic && quiz.dataset.topic !== topic) {
            return false;
        }

        return matchesMode(toQuestionMeta(quiz), mode);
    });

    filteredByMode = shuffle(filteredByMode);
}

const sessionQuestions = filteredByMode.slice(
    0,
    selectedLength === "all" ? undefined : Number(selectedLength),
);

if (practiceEmptyState) {
    practiceEmptyState.hidden = sessionQuestions.length !== 0;
}

allSessionCandidates.forEach((question) => {
    question.hidden = sessionQuestions.indexOf(question) !== 0;
});

const sessionLength = sessionQuestions.length;
const sessionLengthElement =
    document.querySelector<HTMLElement>("#session-length");

if (sessionLengthElement) {
    sessionLengthElement.textContent = sessionLength.toString();
}

let correctAnswers = 0;
let totalAnswered = 0;
let currentQuestionIndex = 0;

document.addEventListener("question-answered", (event) => {
    const customEvent = event as CustomEvent<{
        questionId?: string;
        answerId?: string;
        correct: boolean;
    }>;

    const questionId = customEvent.detail.questionId;
    const answerId = customEvent.detail.answerId;

    if (!questionId || !answerId || answeredQuestions.has(questionId)) {
        return;
    }

    answeredQuestions.add(questionId);

    const quiz = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        ".quiz-question",
    );
    const concepts = quiz?.dataset.concepts?.split(",").filter(Boolean);
    const difficulty = quiz?.dataset.difficulty;
    const learningStage = quiz?.dataset.learningStage;
    const masteryConcept = quiz?.dataset.masteryConcept;

    savePracticeAttempt({
        questionId,
        answerId,
        correct: customEvent.detail.correct,
        answeredAt: new Date().toISOString(),
        sessionId,
        ...(quiz?.dataset.topic && { topic: quiz.dataset.topic }),
        ...(concepts?.length && { concepts }),
        ...(masteryConcept && { masteryConcept }),
        ...(difficulty && {
            difficulty: difficulty as
                "beginner" | "intermediate" | "advanced",
        }),
        ...(learningStage && {
            learningStage: learningStage as
                "recognition" | "understanding" | "application",
        }),
    });

    totalAnswered += 1;
    if (customEvent.detail.correct) correctAnswers += 1;

    if (practiceScore) {
        practiceScore.textContent = correctAnswers.toString();
    }

    if (answeredCount) {
        answeredCount.textContent = totalAnswered.toString();
    }

    if (totalAnswered === sessionLength) {
        if (finalScore) finalScore.textContent = correctAnswers.toString();
        if (finalAnswered) finalAnswered.textContent = totalAnswered.toString();
        if (finalAccuracy) {
            finalAccuracy.textContent = `${Math.round(
                (correctAnswers / sessionLength) * 100,
            )}%`;
        }

        if (nextQuestion) {
            nextQuestion.textContent = "Finish session";
            nextQuestion.hidden = false;
        }

        if (nextQuestionContainer) nextQuestionContainer.hidden = false;
        return;
    }

    if (nextQuestion) {
        nextQuestion.textContent = "Next question";
        nextQuestion.hidden = false;
    }

    if (nextQuestionContainer) nextQuestionContainer.hidden = false;
});

sessionLengthSelect?.addEventListener("change", () => {
    window.location.href = buildPracticeUrl(
        mode,
        topic,
        sessionLengthSelect.value,
    );
});

nextQuestion?.addEventListener("click", () => {
    const currentQuestionId =
        sessionQuestions[currentQuestionIndex]
            ?.querySelector<HTMLElement>(".quiz-question")
            ?.dataset.questionId ?? "";

    if (!answeredQuestions.has(currentQuestionId)) return;

    if (currentQuestionIndex === sessionQuestions.length - 1) {
        sessionQuestions[currentQuestionIndex].hidden = true;
        nextQuestion.hidden = true;
        if (nextQuestionContainer) nextQuestionContainer.hidden = true;
        if (sessionComplete) sessionComplete.hidden = false;

        if (!sessionSummarySaved) {
            sessionSummarySaved = true;
            saveSessionSummary({
                id: sessionId,
                mode,
                requestedLength: selectedLength,
                startedAt: sessionStartedAt,
                completedAt: new Date().toISOString(),
                questionCount: sessionLength,
                answeredCount: totalAnswered,
                correctCount: correctAnswers,
            });
        }

        return;
    }

    sessionQuestions[currentQuestionIndex].hidden = true;
    currentQuestionIndex += 1;
    sessionQuestions[currentQuestionIndex].hidden = false;

    if (currentQuestionNumber) {
        currentQuestionNumber.textContent = (
            currentQuestionIndex + 1
        ).toString();
    }

    nextQuestion.hidden = true;
    if (nextQuestionContainer) nextQuestionContainer.hidden = true;
});