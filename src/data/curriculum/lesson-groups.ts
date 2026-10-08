import type { LearnSection } from "./learn-content";

export interface LessonGroup {
  id: string;
  title: string;
  sections: LearnSection[];
}

const cleanTitle = (title: string) => title.replace(/^\s*\d+[.)]\s*/, "").trim();
const matches = (title: string, terms: RegExp[]) => terms.some((term) => term.test(title.toLowerCase()));

export function buildLessonGroups(sections: LearnSection[]): LessonGroup[] {
  const learner = sections.filter((section) => section.role.role === "learner-content");
  const used = new Set<string>();
  const groups: LessonGroup[] = [];

  const add = (id: string, title: string, patterns: RegExp[]) => {
    const members = learner.filter((section) => !used.has(section.id) && matches(cleanTitle(section.title), patterns));
    if (!members.length) return;
    members.forEach((section) => used.add(section.id));
    groups.push({ id, title, sections: members });
  };

  // Broad pedagogical units for compute curricula. These are intentionally conservative:
  // related source sections are combined, but unrelated material is never pulled in merely
  // to hit a target lesson count.
  add("compute-foundations", "Launching compute with EC2", [/adding compute/, /choosing an ami/, /selecting an ec2 instance type/, /rightsizing/, /compute optimizer/]);
  add("ec2-storage", "Storage choices for EC2", [/instance store/, /amazon ebs/, /ebs volume/, /ebs-optimized/, /amazon efs/, /windows shared file storage/]);
  add("ec2-configuration", "Configuring EC2 instances", [/other ec2 configuration/, /ec2 user data/, /mutable and immutable/]);
  add("ec2-pricing", "Choosing an EC2 pricing model", [/ec2 pricing/, /on-demand/, /savings plans?/, /reserved instances?/, /spot instances?/, /spot-aware/]);
  add("ec2-operations", "Operating EC2 well", [/security/, /monitor/, /well-architected/, /high availability/, /scal/]);

  for (const section of learner) {
    if (used.has(section.id)) continue;
    groups.push({ id: `section-${section.id}`, title: cleanTitle(section.title), sections: [section] });
  }

  return groups;
}

export function lessonGroupSource(group: LessonGroup): string {
  return group.sections
    .map((section) => `## ${cleanTitle(section.title)}\n${section.sourceText.trim()}`)
    .join("\n\n");
}
