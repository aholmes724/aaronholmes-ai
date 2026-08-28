import { readImportedCurriculum } from "../data/curriculum/storage";
import { exportCurriculum } from "../data/curriculum/export";

const SUPPORTED_PATHS = new Set(["/import", "/curriculum-review"]);

function hasExportableQuestions(): boolean {
    const stored = readImportedCurriculum();
    const drafts = stored?.curriculum?.questionDrafts ?? [];
    return drafts.some((draft) =>
        draft.validationStatus === "ai-validated" || draft.validationStatus === "approved",
    );
}

function makeFormatMenu(wrapper: HTMLElement, button: HTMLButtonElement): HTMLElement {
    const menu = document.createElement("span");
    menu.dataset.exportFormatMenu = "true";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.style.display = "none";
    menu.style.position = "absolute";
    menu.style.zIndex = "20";
    menu.style.top = "calc(100% + 0.4rem)";
    menu.style.right = "0";
    menu.style.minWidth = "12rem";
    menu.style.padding = "0.4rem";
    menu.style.border = "1px solid var(--border-color, #4a5157)";
    menu.style.borderRadius = "0.5rem";
    menu.style.background = "var(--surface-color, #22272a)";
    menu.style.boxShadow = "0 0.5rem 1.5rem rgba(0, 0, 0, 0.2)";

    const addChoice = (label: string, format: "markdown" | "json") => {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "secondary-button";
        choice.textContent = label;
        choice.setAttribute("role", "menuitem");
        choice.style.display = "block";
        choice.style.width = "100%";
        choice.style.textAlign = "left";
        choice.style.margin = "0";
        choice.addEventListener("click", () => {
            const latest = readImportedCurriculum();
            if (!latest?.curriculum) return;
            exportCurriculum(latest.curriculum, format);
            menu.hidden = true;
            menu.style.display = "none";
            button.setAttribute("aria-expanded", "false");
        });
        menu.append(choice);
    };

    addChoice("Questions (Markdown .md)", "markdown");
    addChoice("Curriculum package (.json)", "json");
    wrapper.append(menu);
    return menu;
}

function addExportControl(container: HTMLElement): void {
    if (container.querySelector("[data-curriculum-export]")) return;

    const wrapper = document.createElement("span");
    wrapper.dataset.curriculumExport = "true";
    wrapper.style.display = "inline-block";
    wrapper.style.position = "relative";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = "Export";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.disabled = !hasExportableQuestions();
    if (button.disabled) button.title = "Generate practice-ready questions before exporting.";

    wrapper.append(button);
    const menu = makeFormatMenu(wrapper, button);

    button.addEventListener("click", () => {
        if (button.disabled) return;
        const opening = menu.hidden;
        menu.hidden = !opening;
        menu.style.display = opening ? "block" : "none";
        button.setAttribute("aria-expanded", opening ? "true" : "false");
    });

    container.append(wrapper);
}

function cleanImportDemoUi(): void {
    if (window.location.pathname !== "/import") return;
    const sampleButton = document.querySelector<HTMLButtonElement>("#load-sample");
    const sampleActions = sampleButton?.closest<HTMLElement>(".progress-actions");
    sampleButton?.remove();
    if (sampleActions && sampleActions.children.length === 0) sampleActions.remove();
}

function mountExportControls(): void {
    if (!SUPPORTED_PATHS.has(window.location.pathname)) return;
    cleanImportDemoUi();

    const selectors = window.location.pathname === "/import"
        ? ["#import-result .progress-actions"]
        : ["#review-summary .progress-actions"];

    selectors.forEach((selector) => {
        const container = document.querySelector<HTMLElement>(selector);
        if (container) addExportControl(container);
    });
}

if (SUPPORTED_PATHS.has(window.location.pathname)) {
    mountExportControls();
    const observer = new MutationObserver(mountExportControls);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", (event) => {
        const target = event.target as Node;
        document.querySelectorAll<HTMLElement>("[data-curriculum-export]").forEach((wrapper) => {
            if (wrapper.contains(target)) return;
            const menu = wrapper.querySelector<HTMLElement>("[data-export-format-menu]");
            const button = wrapper.querySelector<HTMLButtonElement>("button[aria-haspopup='menu']");
            if (menu) {
                menu.hidden = true;
                menu.style.display = "none";
            }
            button?.setAttribute("aria-expanded", "false");
        });
    });
}
