import type { GeneratedLesson, LessonKeyTerm } from "../data/curriculum/lesson-generation-client";

const isSequencePage = () => window.location.pathname.replace(/\/$/, "") === "/learn/sequence";

if (isSequencePage()) {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const buildTerm = (label: string, term: LessonKeyTerm) => {
    const wrapper = document.createElement("span");
    wrapper.className = `learn-initialism lesson-glossary-term glossary-${term.priority}`;
    wrapper.tabIndex = 0;
    wrapper.textContent = label;

    const popover = document.createElement("span");
    popover.className = "lesson-glossary-popover";
    popover.setAttribute("role", "tooltip");

    const title = document.createElement("span");
    title.className = "glossary-popover-title";
    const strong = document.createElement("strong");
    strong.textContent = term.term;
    title.append(strong);
    if (term.expansion) title.append(document.createTextNode(` — ${term.expansion}`));
    popover.append(title);

    const body = document.createElement("span");
    body.className = "glossary-popover-body";
    body.textContent = term.definition;
    popover.append(body);

    if (term.whyItMatters) {
      const why = document.createElement("span");
      why.className = "glossary-popover-why";
      why.textContent = `Why it matters: ${term.whyItMatters}`;
      popover.append(why);
    }

    wrapper.append(popover);
    return wrapper;
  };

  const appendGlossaryText = (parent: HTMLElement, text: string, terms: LessonKeyTerm[]) => {
    const usable = terms
      .filter((term) => text.includes(term.term))
      .sort((a, b) => b.term.length - a.term.length);

    if (!usable.length) return;

    const pattern = new RegExp(`\\b(${usable.map((term) => escapeRegex(term.term)).join("|")})\\b`, "g");
    const lookup = new Map(usable.map((term) => [term.term, term]));
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > cursor) fragment.append(document.createTextNode(text.slice(cursor, index)));
      const term = lookup.get(match[0]);
      if (term) fragment.append(buildTerm(match[0], term));
      cursor = index + match[0].length;
    }

    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    parent.replaceChildren(fragment);
  };

  const cachedLessons = () => {
    const lessons: GeneratedLesson[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith("aaronholmes.lesson-group.v1.")) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const lesson = JSON.parse(raw) as GeneratedLesson;
        if (lesson?.title && Array.isArray(lesson.keyTerms)) lessons.push(lesson);
      } catch {
        // Ignore malformed/stale cache entries.
      }
    }
    return lessons;
  };

  const enhanceLessonCard = (article: HTMLElement, lessons: GeneratedLesson[]) => {
    if (article.dataset.glossaryEnhanced === "true") return;

    const heading = article.querySelector<HTMLElement>("h2");
    const title = heading?.textContent?.trim();
    if (!title) return;

    const lesson = lessons.find((candidate) => candidate.title.trim() === title);
    if (!lesson || !lesson.keyTerms.length) return;

    article.classList.add("generated-lesson");

    const targets = article.querySelectorAll<HTMLElement>(
      "h2, .learning-goal, h3, details p",
    );

    targets.forEach((target) => {
      if (target.closest(".lesson-glossary-popover")) return;
      if (target.querySelector(".lesson-glossary-term")) return;
      const text = target.textContent ?? "";
      if (text) appendGlossaryText(target, text, lesson.keyTerms);
    });

    article.dataset.glossaryEnhanced = "true";
  };

  const enhanceSequence = () => {
    document.querySelectorAll<HTMLButtonElement>(
      "#generate-sequence, #generate-next, #generate-next-three",
    ).forEach((button) => {
      button.classList.remove("secondary-button");
      button.classList.add("new-session-button");
    });

    const lessons = cachedLessons();
    document.querySelectorAll<HTMLElement>(".generated-sequence-card").forEach((article) => {
      enhanceLessonCard(article, lessons);
    });
  };

  enhanceSequence();

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhanceSequence();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
