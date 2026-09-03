import { readImportedCurriculum } from "../data/curriculum/storage";
import { buildLearnSections } from "../data/curriculum/learn-content";
import { generateLesson, isLessonGenerationConfigured, type GeneratedLesson, type LessonKeyTerm } from "../data/curriculum/lesson-generation-client";

const isLearnPage = () => window.location.pathname.replace(/\/$/, "") === "/learn";
if (!isLearnPage()) {
  // Global script, intentionally idle outside Learn.
} else {
  const stored = readImportedCurriculum();
  const prototypeHost = document.querySelector<HTMLElement>("#prototype-host");
  const picker = document.querySelector<HTMLSelectElement>("#topic-picker");
  const readinessSummary = document.querySelector<HTMLElement>("#readiness-summary");

  const clearLessonCaches = () => {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("aaronholmes.lesson-")) sessionStorage.removeItem(key);
    }
  };

  const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "lesson";

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
    const usable = terms.filter((term) => text.includes(term.term)).sort((a, b) => b.term.length - a.term.length);
    if (!usable.length) {
      parent.textContent = text;
      return;
    }
    const pattern = new RegExp(`\\b(${usable.map((term) => escapeRegex(term.term)).join("|")})\\b`, "g");
    const lookup = new Map(usable.map((term) => [term.term, term]));
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));
      const term = lookup.get(match[0]);
      if (term) parent.append(buildTerm(match[0], term));
      cursor = index + match[0].length;
    }
    if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  };

  const lessonMarkdown = (lesson: GeneratedLesson, sourceText: string, curriculumTitle: string) => {
    const lines = [
      `# ${lesson.title}`,
      "",
      `**Curriculum:** ${curriculumTitle}`,
      "",
      `**Learning goal:** ${lesson.learningGoal}`,
      "",
      "## Key idea",
      "",
      lesson.keyIdea,
      "",
    ];
    lesson.blocks.forEach((block) => lines.push(`## ${block.heading}`, "", block.body, ""));
    lines.push("## Distinctions that matter", "", ...lesson.distinctions.map((item) => `- ${item}`), "");
    if (lesson.keyTerms.length) {
      lines.push("## Key terms", "");
      lesson.keyTerms.forEach((term) => lines.push(`- **${term.term}${term.expansion ? ` — ${term.expansion}` : ""}:** ${term.definition}`));
      lines.push("");
    }
    lines.push("## Remember", "", lesson.memoryHook, "", "## Quick check", "", lesson.quickCheck.prompt, "");
    lesson.quickCheck.options.forEach((option) => lines.push(`- ${option.text}${option.correct ? " *(correct)*" : ""} — ${option.feedback}`));
    lines.push("", "## Source evidence", "", sourceText.trim());
    if (lesson.sourceNote) lines.push("", `*${lesson.sourceNote}*`);
    return lines.join("\n");
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const renderSelectedLesson = (lesson: GeneratedLesson, sourceText: string, curriculumTitle: string, cacheKey: string) => {
    if (!prototypeHost) return;
    prototypeHost.hidden = false;
    prototypeHost.replaceChildren();

    const article = document.createElement("article");
    article.className = "generated-lesson";
    const eyebrow = document.createElement("p");
    eyebrow.className = "lesson-eyebrow";
    eyebrow.textContent = "Generated lesson";

    const header = document.createElement("div");
    header.className = "generated-heading";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    appendGlossaryText(title, lesson.title, lesson.keyTerms);
    const goal = document.createElement("p");
    goal.className = "learning-goal";
    goal.textContent = lesson.learningGoal;
    titleWrap.append(title, goal);

    const controls = document.createElement("div");
    controls.className = "lesson-controls";
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.className = "secondary-button";
    regenerate.textContent = "Regenerate";
    regenerate.addEventListener("click", () => {
      sessionStorage.removeItem(cacheKey);
      sessionStorage.setItem("aaronholmes.learn.regenerate-selected", picker?.value ?? "");
      window.location.reload();
    });
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "secondary-button";
    exportButton.textContent = "Export lesson";
    exportButton.addEventListener("click", () => downloadText(`${slugify(lesson.title)}.md`, lessonMarkdown(lesson, sourceText, curriculumTitle)));
    controls.append(regenerate, exportButton);
    header.append(titleWrap, controls);
    article.append(eyebrow, header);

    const keyIdea = document.createElement("section");
    keyIdea.className = "lesson-key-idea";
    const keyHeading = document.createElement("h3");
    keyHeading.textContent = "Key idea";
    const keyBody = document.createElement("p");
    appendGlossaryText(keyBody, lesson.keyIdea, lesson.keyTerms);
    keyIdea.append(keyHeading, keyBody);
    article.append(keyIdea);

    lesson.blocks.forEach((block) => {
      const section = document.createElement("section");
      section.className = "lesson-block";
      const heading = document.createElement("h3");
      heading.textContent = block.heading;
      const body = document.createElement("p");
      appendGlossaryText(body, block.body, lesson.keyTerms);
      section.append(heading, body);
      article.append(section);
    });

    const distinctions = document.createElement("section");
    distinctions.className = "lesson-block";
    const distinctionsHeading = document.createElement("h3");
    distinctionsHeading.textContent = "Distinctions that matter";
    const list = document.createElement("ul");
    lesson.distinctions.forEach((item) => {
      const li = document.createElement("li");
      appendGlossaryText(li, item, lesson.keyTerms);
      list.append(li);
    });
    distinctions.append(distinctionsHeading, list);
    article.append(distinctions);

    const remember = document.createElement("section");
    remember.className = "memory-hook";
    remember.innerHTML = `<strong>Remember:</strong> ${lesson.memoryHook}`;
    article.append(remember);

    const check = document.createElement("section");
    check.className = "quick-check";
    const checkHeading = document.createElement("h3");
    checkHeading.textContent = "Quick check";
    const prompt = document.createElement("p");
    prompt.textContent = lesson.quickCheck.prompt;
    check.append(checkHeading, prompt);
    lesson.quickCheck.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-check-option";
      button.textContent = option.text;
      button.addEventListener("click", () => {
        check.querySelectorAll(".quick-check-feedback").forEach((node) => node.remove());
        const feedback = document.createElement("p");
        feedback.className = "quick-check-feedback";
        feedback.textContent = `${option.correct ? "Correct. " : "Not quite. "}${option.feedback}`;
        check.append(feedback);
      });
      check.append(button);
    });
    article.append(check);

    const evidence = document.createElement("details");
    evidence.className = "source-detail";
    const summary = document.createElement("summary");
    summary.textContent = "View source evidence";
    const body = document.createElement("p");
    body.textContent = sourceText;
    evidence.append(summary, body);
    article.append(evidence);

    prototypeHost.append(article);
  };

  if (stored && prototypeHost && picker) {
    const sourceText = stored.sourceText?.trim() ?? "";
    const fallbackSource = stored.curriculum.concepts.map((concept) => `## ${concept.label}\n${concept.description ?? ""}`).join("\n\n");
    const sections = buildLearnSections(stored.curriculum, sourceText || fallbackSource);
    const learnerSections = sections.filter((section) => section.role.role === "learner-content");
    const objectives = sections.filter((section) => section.role.role === "objectives");

    const panel = document.createElement("section");
    panel.className = "learn-workflow-actions";
    const heading = document.createElement("strong");
    heading.textContent = "Learn actions";
    const fresh = document.createElement("a");
    fresh.className = "secondary-button";
    fresh.href = "/import";
    fresh.textContent = "New curriculum";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "secondary-button";
    reset.textContent = "Clear generated lesson";
    reset.addEventListener("click", () => {
      clearLessonCaches();
      window.location.reload();
    });
    const generateSelected = document.createElement("button");
    generateSelected.type = "button";
    generateSelected.className = "new-session-button";
    generateSelected.textContent = "Generate selected section";
    const status = document.createElement("span");
    status.className = "prototype-status";
    panel.append(heading, fresh, reset, generateSelected, status);
    (readinessSummary ?? prototypeHost).insertAdjacentElement("beforebegin", panel);

    const generateCurrentSelection = async () => {
      const selected = learnerSections.find((section) => section.id === picker.value) ?? learnerSections[0];
      if (!selected) return;
      if (!isLessonGenerationConfigured()) {
        status.textContent = "Lesson generation is not configured.";
        return;
      }
      generateSelected.disabled = true;
      generateSelected.textContent = "Generating…";
      status.textContent = `Building “${selected.title}”…`;
      const cacheKey = `aaronholmes.lesson-section.v1.${stored.curriculum.id}.${selected.id}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        const lesson = cached ? JSON.parse(cached) as GeneratedLesson : await generateLesson({
          curriculumTitle: stored.curriculum.title,
          sectionTitle: selected.title,
          sourceText: selected.sourceText,
          objectivesText: objectives.map((section) => `${section.title}\n${section.sourceText}`).join("\n\n"),
          neighboringContext: learnerSections.filter((section) => section.id !== selected.id).slice(0, 2).map((section) => `${section.title}\n${section.sourceText}`).join("\n\n"),
        });
        if (!cached) sessionStorage.setItem(cacheKey, JSON.stringify(lesson));
        renderSelectedLesson(lesson, selected.sourceText, stored.curriculum.title, cacheKey);
        status.textContent = "";
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Lesson generation failed.";
      } finally {
        generateSelected.disabled = false;
        generateSelected.textContent = "Generate selected section";
      }
    };

    generateSelected.addEventListener("click", generateCurrentSelection);

    const regenerateSelected = sessionStorage.getItem("aaronholmes.learn.regenerate-selected");
    if (regenerateSelected) {
      sessionStorage.removeItem("aaronholmes.learn.regenerate-selected");
      const optionExists = [...picker.options].some((option) => option.value === regenerateSelected);
      if (optionExists) picker.value = regenerateSelected;
      queueMicrotask(() => generateCurrentSelection());
    }
  }
}
