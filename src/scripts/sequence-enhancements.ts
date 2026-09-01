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

    if (!usable.length) {
      parent.textContent = text;
      return;
    }

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

  const appendRichLessonContent = (article: HTMLElement, lesson: GeneratedLesson) => {
    const details = article.querySelector<HTMLDetailsElement>("details");
    if (!details || details.dataset.richLesson === "true") return;
    const summary = details.querySelector("summary") ?? document.createElement("summary");
    summary.textContent = "View lesson";
    details.replaceChildren(summary);

    lesson.blocks.forEach((block) => {
      const section = document.createElement("section");
      section.className = "sequence-lesson-block";
      const heading = document.createElement("h3");
      appendGlossaryText(heading, block.heading, lesson.keyTerms);
      const body = document.createElement("p");
      appendGlossaryText(body, block.body, lesson.keyTerms);
      section.append(heading, body);
      details.append(section);
    });

    if (lesson.distinctions.length) {
      const section = document.createElement("section");
      section.className = "sequence-lesson-block";
      const heading = document.createElement("h3");
      heading.textContent = "Distinctions that matter";
      const list = document.createElement("ul");
      lesson.distinctions.forEach((item) => {
        const li = document.createElement("li");
        appendGlossaryText(li, item, lesson.keyTerms);
        list.append(li);
      });
      section.append(heading, list);
      details.append(section);
    }

    if (lesson.keyTerms.length) {
      const section = document.createElement("section");
      section.className = "sequence-lesson-block sequence-key-terms";
      const heading = document.createElement("h3");
      heading.textContent = "Key terms";
      const terms = document.createElement("div");
      terms.className = "sequence-term-list";
      lesson.keyTerms.forEach((term) => terms.append(buildTerm(term.term, term)));
      section.append(heading, terms);
      details.append(section);
    }

    const remember = document.createElement("section");
    remember.className = "sequence-memory-hook";
    const rememberLabel = document.createElement("strong");
    rememberLabel.textContent = "Remember: ";
    const rememberText = document.createElement("span");
    appendGlossaryText(rememberText, lesson.memoryHook, lesson.keyTerms);
    remember.append(rememberLabel, rememberText);
    details.append(remember);

    const check = document.createElement("section");
    check.className = "sequence-quick-check";
    const checkHeading = document.createElement("h3");
    checkHeading.textContent = "Quick check";
    const prompt = document.createElement("p");
    appendGlossaryText(prompt, lesson.quickCheck.prompt, lesson.keyTerms);
    const feedback = document.createElement("p");
    feedback.className = "quick-check-feedback";
    feedback.setAttribute("aria-live", "polite");
    check.append(checkHeading, prompt);

    lesson.quickCheck.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-check-option";
      appendGlossaryText(button, option.text, lesson.keyTerms);
      button.addEventListener("click", () => {
        check.querySelectorAll<HTMLButtonElement>(".quick-check-option").forEach((item) => {
          item.disabled = true;
        });
        button.dataset.result = option.correct ? "correct" : "incorrect";
        feedback.textContent = `${option.correct ? "Correct. " : "Not quite. "}${option.feedback}`;
      }, { once: true });
      check.append(button);
    });
    check.append(feedback);
    details.append(check);
    details.dataset.richLesson = "true";
  };

  const enhanceLessonCard = (article: HTMLElement, lessons: GeneratedLesson[]) => {
    const heading = article.querySelector<HTMLElement>("h2");
    const title = heading?.textContent?.trim();
    if (!title) return;

    const lesson = lessons.find((candidate) => candidate.title.trim() === title);
    if (!lesson) return;

    article.classList.add("generated-lesson");
    appendRichLessonContent(article, lesson);

    if (article.dataset.glossaryEnhanced !== "true" && lesson.keyTerms.length) {
      const targets = article.querySelectorAll<HTMLElement>(
        "h2, .learning-goal, h3, p, li",
      );

      targets.forEach((target) => {
        if (target.closest(".lesson-glossary-popover")) return;
        if (target.querySelector(".lesson-glossary-term")) return;
        if (target.classList.contains("group-source-count")) return;
        if (target.classList.contains("quick-check-feedback")) return;
        const text = target.textContent ?? "";
        if (text) appendGlossaryText(target, text, lesson.keyTerms);
      });

      article.dataset.glossaryEnhanced = "true";
    }
  };

  const ensureRichStyles = () => {
    if (document.querySelector("#sequence-rich-lesson-styles")) return;
    const style = document.createElement("style");
    style.id = "sequence-rich-lesson-styles";
    style.textContent = `
      .sequence-lesson-block{margin:1rem 0}.sequence-lesson-block ul{padding-left:1.25rem}.sequence-lesson-block li{margin:.45rem 0;line-height:1.55}
      .sequence-term-list{display:flex;gap:.5rem;flex-wrap:wrap}.sequence-memory-hook,.sequence-quick-check{margin:1rem 0;padding:1rem;border:1px solid var(--border);border-radius:.7rem;background:var(--surface-alt)}
      .sequence-quick-check .quick-check-option{display:block;width:100%;margin:.55rem 0;text-align:left}.sequence-quick-check .quick-check-feedback{margin-bottom:0;color:var(--text-muted)}
    `;
    document.head.append(style);
  };

  const enhanceSequence = () => {
    ensureRichStyles();
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
