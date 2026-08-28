import { readImportedCurriculum } from "../data/curriculum/storage";
import { exportCurriculum } from "../data/curriculum/export";

const SUPPORTED_PATHS = new Set(["/import", "/curriculum-review"]);

function addExportControl(container: HTMLElement): void {
    if (container.querySelector("[data-curriculum-export]")) return;

    const stored = readImportedCurriculum();
    if (!stored?.curriculum) return;

    const wrapper = document.createElement("span");
    wrapper.dataset.curriculumExport = "true";
    wrapper.style.display = "inline-flex";
    wrapper.style.gap = "0.5rem";
    wrapper.style.alignItems = "center";

    const format = document.createElement("select");
    format.setAttribute("aria-label", "Export format");

    const markdown = document.createElement("option");
    markdown.value = "markdown";
    markdown.textContent = "Questions (.md)";

    const json = document.createElement("option");
    json.value = "json";
    json.textContent = "Curriculum (.json)";

    format.append(markdown, json);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = "Export";
    button.addEventListener("click", () => {
        const latest = readImportedCurriculum();
        if (!latest?.curriculum) return;
        exportCurriculum(
            latest.curriculum,
            format.value === "json" ? "json" : "markdown",
        );
    });

    wrapper.append(format, button);
    container.append(wrapper);
}

function mountExportControls(): void {
    if (!SUPPORTED_PATHS.has(window.location.pathname)) return;

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
}
