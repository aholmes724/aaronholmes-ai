const LESSON_PREFIX = "aaronholmes.lesson-";
const IMPORTED_CURRICULUM_KEY = "aaronholmes.imported-curriculum";

const isLessonKey = (key: string | null): key is string => Boolean(key?.startsWith(LESSON_PREFIX));

const currentCurriculumId = () => {
  try {
    const raw = localStorage.getItem(IMPORTED_CURRICULUM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { curriculum?: { id?: string } };
    return parsed.curriculum?.id ?? null;
  } catch {
    return null;
  }
};

const persistSessionLessons = () => {
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!isLessonKey(key)) continue;
      const value = sessionStorage.getItem(key);
      if (value) localStorage.setItem(key, value);
    }
  } catch {
    // Storage can be unavailable or full. The in-session lesson still works.
  }
};

const removePersistentKeys = (predicate: (key: string) => boolean) => {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isLessonKey(key) && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage failures; the UI action can still clear session state.
  }
};

const clearSequencePersistence = () => {
  const curriculumId = currentCurriculumId();
  if (!curriculumId) return;
  removePersistentKeys((key) => key.startsWith(`aaronholmes.lesson-group.v1.${curriculumId}.`));
};

const clearSelectedSectionPersistence = () => {
  const curriculumId = currentCurriculumId();
  const picker = document.querySelector<HTMLSelectElement>("#topic-picker");
  const sectionId = picker?.value;
  if (!curriculumId || !sectionId) return;
  localStorage.removeItem(`aaronholmes.lesson-section.v1.${curriculumId}.${sectionId}`);
};

const clearAllLessonPersistence = () => removePersistentKeys(() => true);

persistSessionLessons();

// Generated lesson DOM changes happen immediately after the page writes its
// session cache. Mirror those entries into localStorage so reloads and browser
// restarts do not require another model call.
let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    persistSessionLessons();
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Keep explicit destructive actions honest: if the user clears/regenerates a
// lesson, remove the durable copy too so the next page load cannot resurrect it.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a") : null;
  if (!target) return;

  if (target.id === "clear-sequence") {
    clearSequencePersistence();
    return;
  }

  const label = target.textContent?.trim().toLowerCase() ?? "";
  if (label === "regenerate") {
    clearSelectedSectionPersistence();
    return;
  }

  if (label === "clear generated lesson") {
    // This control historically clears every generated lesson cache, not just
    // the selected one, so keep durable storage behavior consistent with it.
    clearAllLessonPersistence();
  }
}, true);

window.addEventListener("pagehide", persistSessionLessons);
