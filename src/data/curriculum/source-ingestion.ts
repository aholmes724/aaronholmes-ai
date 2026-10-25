import type {
    CurriculumConcept,
    CurriculumLearningObjective,
    CurriculumPackage,
    CurriculumSource,
} from "./types";

export interface SourceIngestionInput {
    fileName: string;
    text: string;
    mimeType?: string;
}

export interface SourceIngestionResult {
    curriculum: CurriculumPackage;
    sections: Array<{ heading: string; text: string }>;
    wordCount: number;
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "curriculum";

const titleFromFileName = (fileName: string) =>
    fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Imported curriculum";

function splitSections(text: string, fallbackTitle: string) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const sections: Array<{ heading: string; text: string }> = [];
    let heading = fallbackTitle;
    let body: string[] = [];

    const flush = () => {
        const sectionText = body.join("\n").trim();
        if (sectionText) sections.push({ heading, text: sectionText });
        body = [];
    };

    lines.forEach((line) => {
        const markdownHeading = line.match(/^#{1,6}\s+(.+?)\s*$/);
        if (markdownHeading) {
            flush();
            heading = markdownHeading[1].trim();
            return;
        }
        body.push(line);
    });
    flush();

    if (!sections.length && text.trim()) {
        sections.push({ heading: fallbackTitle, text: text.trim() });
    }

    return sections;
}

export function ingestTextSource(input: SourceIngestionInput): SourceIngestionResult {
    const title = titleFromFileName(input.fileName);
    const curriculumId = `imported-${slugify(title)}`;
    const sourceId = `${curriculumId}-source-1`;
    const sections = splitSections(input.text, title);

    const source: CurriculumSource = {
        id: sourceId,
        title,
        kind: "notes",
        notes: `Imported from ${input.fileName}`,
    };

    const concepts: CurriculumConcept[] = sections.map((section, index) => ({
        id: `${curriculumId}-concept-${index + 1}`,
        label: section.heading,
        description: section.text.slice(0, 360),
    }));

    const learningObjectives: CurriculumLearningObjective[] = concepts.map((concept, index) => ({
        id: `${curriculumId}-objective-${index + 1}`,
        conceptId: concept.id,
        description: `Explain the key ideas and apply the important details from ${concept.label}.`,
        learningStage: "understanding",
    }));

    const curriculum: CurriculumPackage = {
        id: curriculumId,
        title,
        version: "1.0.0",
        sources: [source],
        concepts,
        learningObjectives,
        questionDrafts: [],
    };

    const wordCount = input.text.trim() ? input.text.trim().split(/\s+/).length : 0;
    return { curriculum, sections, wordCount };
}
