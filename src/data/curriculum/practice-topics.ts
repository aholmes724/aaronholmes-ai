import type { Question } from "../questions";
import type { CurriculumPackage } from "./types";
import type { LessonGroup } from "./lesson-groups";
import { lessonGroupSource } from "./lesson-groups";

export interface PracticeTopic {
  id: string;
  title: string;
  group: LessonGroup;
  conceptIds: string[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const meaningfulTokens = (value: string) => normalize(value)
  .split(/\s+/)
  .filter((token) => token.length > 2 && !["amazon", "with", "from", "using", "your", "into", "about", "other"].includes(token));

export function buildPracticeTopics(curriculum: CurriculumPackage, groups: LessonGroup[]): PracticeTopic[] {
  return groups.map((group) => {
    const groupText = normalize(`${group.title}\n${lessonGroupSource(group)}`);
    const conceptIds = new Set(
      group.sections.map((section) => section.conceptId).filter((value): value is string => Boolean(value)),
    );

    curriculum.concepts.forEach((concept) => {
      const tokens = meaningfulTokens(concept.label);
      if (tokens.length && tokens.every((token) => groupText.includes(token))) conceptIds.add(concept.id);
    });

    return { id: group.id, title: group.title, group, conceptIds: [...conceptIds] };
  });
}

export function questionMatchesPracticeTopic(question: Question, topic: PracticeTopic): boolean {
  const ids = new Set(topic.conceptIds);
  if (question.masteryConcept && ids.has(question.masteryConcept)) return true;
  if (question.concepts?.some((concept) => ids.has(concept))) return true;

  const sourceText = normalize(`${topic.title}\n${lessonGroupSource(topic.group)}`);
  const topicTokens = meaningfulTokens(question.topic ?? "");
  return topicTokens.length >= 2 && topicTokens.every((token) => sourceText.includes(token));
}

export function topicQuestionCount(questions: Question[], topic: PracticeTopic): number {
  return questions.filter((question) => questionMatchesPracticeTopic(question, topic)).length;
}
