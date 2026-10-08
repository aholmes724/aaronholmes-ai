import type { CurriculumPackage } from "./types";

const slugify = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "curriculum";

function downloadText(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function curriculumQuestionsToMarkdown(curriculum: CurriculumPackage): string {
    const lines: string[] = [
        `# ${curriculum.title}`,
        "",
        `${curriculum.questionDrafts.length} generated/reviewable question${curriculum.questionDrafts.length === 1 ? "" : "s"}`,
        "",
    ];

    curriculum.questionDrafts.forEach((draft, index) => {
        lines.push(`## ${index + 1}. ${draft.prompt}`, "");

        const meta = [
            draft.validationStatus,
            draft.authorship,
            draft.learningStage,
            draft.difficulty,
            draft.generation?.harnessVersion ? `Harness ${draft.generation.harnessVersion}` : undefined,
        ].filter(Boolean);
        if (meta.length) lines.push(meta.join(" · "), "");

        draft.answers.forEach((answer) => {
            lines.push(`- ${answer.correct ? "**✓ " : ""}${answer.text}${answer.correct ? "**" : ""}`);
        });
        lines.push("");

        if (draft.explanation) {
            lines.push(`**Explanation:** ${draft.explanation}`, "");
        }

        if (draft.qualityWarnings?.length) {
            lines.push("**Quality warnings:**");
            draft.qualityWarnings.forEach((warning) => lines.push(`- ${warning.message}`));
            lines.push("");
        }

        if (draft.sourceEvidence?.excerpt) {
            lines.push("**Source evidence**", "");
            const reference = draft.sourceEvidence.reference || draft.sourceReference;
            const locator = draft.sourceEvidence.locator ? ` · ${draft.sourceEvidence.locator}` : "";
            lines.push(`${reference}${locator}`, "");
            lines.push(`> ${draft.sourceEvidence.excerpt.replace(/\n+/g, " ")}`, "");
        }
    });

    return lines.join("\n").trimEnd() + "\n";
}

export function exportCurriculum(
    curriculum: CurriculumPackage,
    format: "markdown" | "json",
): void {
    const base = slugify(curriculum.title);
    if (format === "json") {
        downloadText(
            `${base}.json`,
            `${JSON.stringify(curriculum, null, 2)}\n`,
            "application/json;charset=utf-8",
        );
        return;
    }

    downloadText(
        `${base}-questions.md`,
        curriculumQuestionsToMarkdown(curriculum),
        "text/markdown;charset=utf-8",
    );
}
