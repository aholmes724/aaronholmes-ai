import { readImportedCurriculum } from "../data/curriculum/storage";
import { buildLearnSections } from "../data/curriculum/learn-content";
import { buildLessonGroups } from "../data/curriculum/lesson-groups";

const isSequencePage = () => window.location.pathname.replace(/\/$/, "") === "/learn/sequence";

if (isSequencePage()) {
  const stored = readImportedCurriculum();
  if (stored) {
    const sourceText = stored.sourceText?.trim()
      || stored.curriculum.concepts.map((concept) => `## ${concept.label}\n${concept.description ?? ""}`).join("\n\n");
    const groups = buildLessonGroups(buildLearnSections(stored.curriculum, sourceText));

    const addLinks = () => {
      document.querySelectorAll<HTMLElement>(".generated-sequence-card").forEach((card) => {
        if (card.querySelector(".lesson-assessment-link")) return;
        const eyebrow = card.querySelector<HTMLElement>(".lesson-eyebrow")?.textContent ?? "";
        const match = eyebrow.match(/Lesson\s+(\d+)\s+of/i);
        const index = match ? Number(match[1]) - 1 : -1;
        const group = groups[index];
        if (!group) return;

        const footer = document.createElement("div");
        footer.className = "lesson-assessment-link";
        const link = document.createElement("a");
        link.className = "new-session-button";
        link.href = `/practice/lesson-assessment?group=${encodeURIComponent(group.id)}`;
        link.textContent = "Check my understanding";
        footer.append(link);
        card.append(footer);
      });
    };

    addLinks();
    const observer = new MutationObserver(() => addLinks());
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
