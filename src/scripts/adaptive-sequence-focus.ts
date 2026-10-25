import { readImportedCurriculum } from "../data/curriculum/storage";
import { buildLearnSections } from "../data/curriculum/learn-content";
import { buildLessonGroups, lessonGroupSource } from "../data/curriculum/lesson-groups";
import { generateLesson, isLessonGenerationConfigured, type GeneratedLesson } from "../data/curriculum/lesson-generation-client";

const isSequencePage = () => window.location.pathname.replace(/\/$/, "") === "/learn/sequence";

if (isSequencePage()) {
  const focusId = new URLSearchParams(window.location.search).get("focus");
  const stored = readImportedCurriculum();

  if (focusId && stored) {
    const sourceText = stored.sourceText?.trim()
      || stored.curriculum.concepts.map((concept) => `## ${concept.label}\n${concept.description ?? ""}`).join("\n\n");
    const sections = buildLearnSections(stored.curriculum, sourceText);
    const groups = buildLessonGroups(sections);
    const targetIndex = groups.findIndex((group) => group.id === focusId);
    const cacheKey = (groupId: string) => `aaronholmes.lesson-group.v1.${stored.curriculum.id}.${groupId}`;

    const getCachedLesson = (groupId: string): GeneratedLesson | null => {
      const raw = sessionStorage.getItem(cacheKey(groupId));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as GeneratedLesson;
      } catch {
        return null;
      }
    };

    const generatedCount = () => {
      let count = 0;
      for (const group of groups) {
        if (!getCachedLesson(group.id)) break;
        count += 1;
      }
      return count;
    };

    const visibleLessonNumbers = () => [...document.querySelectorAll<HTMLElement>(".lesson-eyebrow")]
      .map((eyebrow) => Number(eyebrow.textContent?.match(/Lesson\s+(\d+)\s+of/i)?.[1] ?? "0"))
      .filter((value) => value > 0);

    const revealGeneratedTarget = (attempt = 0) => {
      if (targetIndex < 0 || attempt > 12) return;
      const targetNumber = targetIndex + 1;
      const visible = visibleLessonNumbers();
      if (visible.includes(targetNumber)) {
        const card = [...document.querySelectorAll<HTMLElement>(".generated-sequence-card")]
          .find((item) => Number(item.querySelector<HTMLElement>(".lesson-eyebrow")?.textContent?.match(/Lesson\s+(\d+)\s+of/i)?.[1] ?? "0") === targetNumber);
        if (card) {
          card.dataset.recommendedLesson = "true";
          card.querySelector<HTMLDetailsElement>("details")?.setAttribute("open", "");
          requestAnimationFrame(() => card.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
        return;
      }

      if (!visible.length) {
        setTimeout(() => revealGeneratedTarget(attempt + 1), 80);
        return;
      }

      const minVisible = Math.min(...visible);
      const maxVisible = Math.max(...visible);
      const button = targetNumber < minVisible
        ? document.querySelector<HTMLButtonElement>("#previous-generated")
        : targetNumber > maxVisible
          ? document.querySelector<HTMLButtonElement>("#next-generated")
          : null;

      if (button && !button.hidden && !button.disabled) {
        button.click();
        setTimeout(() => revealGeneratedTarget(attempt + 1), 100);
      }
    };

    const showPendingRecommendation = () => {
      if (targetIndex < 0 || targetIndex < generatedCount()) return;
      if (document.querySelector("#recommended-lesson-pending")) return;

      const host = document.createElement("section");
      host.id = "recommended-lesson-pending";
      host.className = "recommended-lesson-pending";
      const heading = document.createElement("h2");
      heading.textContent = `Recommended: Lesson ${targetIndex + 1}`;
      const body = document.createElement("p");
      const needed = targetIndex - generatedCount() + 1;
      body.textContent = `${groups[targetIndex].title} has not been generated yet. ${needed === 1 ? "Generate it" : `Generate the next ${needed} lessons`} to continue with the recommendation.`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "new-session-button";
      button.textContent = needed === 1 ? "Generate recommended lesson" : `Generate through Lesson ${targetIndex + 1}`;
      const status = document.createElement("p");
      status.className = "sequence-status";
      status.setAttribute("aria-live", "polite");
      host.append(heading, body, button, status);

      const list = document.querySelector("#group-list");
      list?.insertAdjacentElement("beforebegin", host);

      button.addEventListener("click", async () => {
        if (!isLessonGenerationConfigured()) {
          status.textContent = "Lesson generation is not configured.";
          return;
        }
        button.disabled = true;
        const start = generatedCount();
        const targets = groups.slice(start, targetIndex + 1);
        try {
          for (let offset = 0; offset < targets.length; offset += 1) {
            const group = targets[offset];
            status.textContent = `Generating lesson ${start + offset + 1} of ${groups.length}: ${group.title}`;
            const lesson = await generateLesson({
              curriculumTitle: stored.curriculum.title,
              sectionTitle: group.title,
              sourceText: lessonGroupSource(group),
              objectivesText: sections.filter((section) => section.role.role === "objectives").map((section) => section.sourceText).join("\n\n"),
              neighboringContext: "",
            });
            sessionStorage.setItem(cacheKey(group.id), JSON.stringify(lesson));
          }
          status.textContent = "Recommended lesson ready.";
          window.location.reload();
        } catch (error) {
          button.disabled = false;
          status.textContent = error instanceof Error ? error.message : "Lesson generation failed.";
        }
      });
    };

    const initialize = () => {
      if (targetIndex < 0) return;
      if (targetIndex < generatedCount()) revealGeneratedTarget();
      else showPendingRecommendation();
    };

    setTimeout(initialize, 0);

    const style = document.createElement("style");
    style.textContent = `
      .recommended-lesson-pending{max-width:var(--reading-width);margin:1rem 0;padding:1rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-alt)}
      .recommended-lesson-pending h2{margin-top:0}.recommended-lesson-pending .new-session-button{margin-top:.25rem}
      .generated-sequence-card[data-recommended-lesson="true"]{scroll-margin-top:1rem;outline:2px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:3px}
    `;
    document.head.append(style);
  }
}
