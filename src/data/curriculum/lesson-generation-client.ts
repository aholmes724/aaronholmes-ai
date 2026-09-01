export interface LessonKeyTerm {
    term: string;
    expansion: string;
    definition: string;
}

export interface LessonBlock {
    heading: string;
    body: string;
}

export interface LessonCheckOption {
    id: "a" | "b";
    text: string;
    correct: boolean;
    feedback: string;
}

export interface GeneratedLesson {
    title: string;
    learningGoal: string;
    keyIdea: string;
    blocks: LessonBlock[];
    distinctions: string[];
    keyTerms: LessonKeyTerm[];
    memoryHook: string;
    quickCheck: {
        prompt: string;
        options: LessonCheckOption[];
    };
    sourceNote: string;
}

export interface GenerateLessonRequest {
    curriculumTitle: string;
    sectionTitle: string;
    sourceText: string;
    objectivesText?: string;
    neighboringContext?: string;
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isLessonGenerationConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseKey);
}

export async function generateLesson(request: GenerateLessonRequest): Promise<GeneratedLesson> {
    if (!supabaseUrl || !supabaseKey) throw new Error("Lesson generation is not configured.");

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-lesson`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => null) as { lesson?: GeneratedLesson; message?: string } | null;
    if (!response.ok || !payload?.lesson) {
        throw new Error(payload?.message || `Lesson generation failed with HTTP ${response.status}.`);
    }
    return payload.lesson;
}
