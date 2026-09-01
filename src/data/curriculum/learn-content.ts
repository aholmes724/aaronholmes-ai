import type { CurriculumPackage, CurriculumSourceKind } from "./types";

export type InstructionalReadiness = "preserve" | "augment" | "transform" | "insufficient";

export interface LearnContentDecision {
    readiness: InstructionalReadiness;
    confidence: "low" | "medium" | "high";
    reason: string;
    signals: string[];
}

export interface LearnSection {
    id: string;
    title: string;
    sourceText: string;
    conceptId?: string;
    decision: LearnContentDecision;
}

const instructionalKinds = new Set<CurriculumSourceKind>(["book", "course"]);
const referenceKinds = new Set<CurriculumSourceKind>(["documentation", "article"]);

const countMatches = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].length;

export function assessInstructionalReadiness(
    text: string,
    sourceKind: CurriculumSourceKind = "other",
): LearnContentDecision {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    const headings = countMatches(trimmed, /^#{1,6}\s+.+$/gm);
    const examples = countMatches(trimmed, /\b(example|for example|for instance|scenario)\b/gi);
    const explanations = countMatches(trimmed, /\b(because|means|refers to|allows|enables|used to|why|how)\b/gi);
    const bullets = countMatches(trimmed, /^\s*[-*+]\s+/gm);
    const objectiveLanguage = countMatches(trimmed, /\b(objective|objectives|describe|identify|explain|compare|define)\b/gi);

    if (words < 45) {
        return {
            readiness: "insufficient",
            confidence: "high",
            reason: "This section is too thin to teach reliably without adding information from another source.",
            signals: [`${words} words`],
        };
    }

    const proseDensity = explanations + examples;
    const looksLikeOutline = bullets >= 4 && proseDensity <= 2;
    const looksInstructional = words >= 180 && proseDensity >= 4 && (headings >= 1 || examples >= 1);

    if (instructionalKinds.has(sourceKind) && looksInstructional) {
        return {
            readiness: "preserve",
            confidence: "medium",
            reason: "The source already has enough explanatory structure to serve as lesson content with presentation cleanup.",
            signals: [`${words} words`, `${headings} headings`, `${examples} example signals`, `${explanations} explanation signals`],
        };
    }

    if (looksInstructional && !looksLikeOutline) {
        return {
            readiness: "preserve",
            confidence: "medium",
            reason: "The section appears instructional already; preserve its teaching voice and add learning affordances rather than rewriting it.",
            signals: [`${words} words`, `${proseDensity} teaching signals`],
        };
    }

    if (referenceKinds.has(sourceKind) && words >= 120 && proseDensity >= 2) {
        return {
            readiness: "augment",
            confidence: "medium",
            reason: "The source is informative but reads more like reference material than a lesson. Keep its substance and add teaching structure selectively.",
            signals: [`source kind: ${sourceKind}`, `${words} words`, `${proseDensity} teaching signals`],
        };
    }

    if (looksLikeOutline || objectiveLanguage >= 4 || proseDensity <= 2) {
        return {
            readiness: "transform",
            confidence: "medium",
            reason: "The source supplies useful coverage/evidence but needs a teaching layer before it is pleasant to learn from.",
            signals: [`${words} words`, `${bullets} bullets`, `${objectiveLanguage} objective signals`, `${proseDensity} teaching signals`],
        };
    }

    return {
        readiness: "augment",
        confidence: "low",
        reason: "The source has usable instructional material, but its teaching readiness is mixed. Preserve the source and add only the missing learning structure.",
        signals: [`${words} words`, `${headings} headings`, `${proseDensity} teaching signals`],
    };
}

export function buildLearnSections(curriculum: CurriculumPackage, sourceText: string): LearnSection[] {
    const sourceKind = curriculum.sources[0]?.kind ?? "other";
    const normalized = sourceText.replace(/\r\n/g, "\n");
    const sections: Array<{ title: string; text: string }> = [];
    let title = curriculum.title;
    let body: string[] = [];

    const flush = () => {
        const text = body.join("\n").trim();
        if (text) sections.push({ title, text });
        body = [];
    };

    normalized.split("\n").forEach((line) => {
        const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
        if (heading) {
            flush();
            title = heading[1].replace(/[*_`]/g, "").trim();
        } else {
            body.push(line);
        }
    });
    flush();

    if (!sections.length) {
        return curriculum.concepts
            .filter((concept) => concept.description?.trim())
            .map((concept, index) => ({
                id: `learn-${index + 1}`,
                title: concept.label,
                sourceText: concept.description ?? "",
                conceptId: concept.id,
                decision: assessInstructionalReadiness(concept.description ?? "", sourceKind),
            }));
    }

    return sections.map((section, index) => {
        const concept = curriculum.concepts.find((item) =>
            section.title.toLowerCase().includes(item.label.toLowerCase()) ||
            item.label.toLowerCase().includes(section.title.toLowerCase()),
        );
        return {
            id: `learn-${index + 1}`,
            title: section.title,
            sourceText: section.text,
            conceptId: concept?.id,
            decision: assessInstructionalReadiness(section.text, sourceKind),
        };
    });
}
