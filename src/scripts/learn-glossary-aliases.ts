const isAbbreviation = (value: string) => /^[A-Z][A-Z0-9-]{1,9}$/.test(value.trim());

const visibleLabel = (node: HTMLElement) =>
  [...node.childNodes]
    .filter((child) => !(child instanceof HTMLElement && child.classList.contains("lesson-glossary-popover")))
    .map((child) => child.textContent ?? "")
    .join("")
    .trim();

const unwrap = (node: HTMLElement) => node.replaceWith(document.createTextNode(visibleLabel(node)));

const findTextNode = (root: Node, phrase: string): Text | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (node.parentElement?.closest(".lesson-glossary-popover")) {
      node = walker.nextNode() as Text | null;
      continue;
    }
    if (node.data.includes(phrase)) return node;
    node = walker.nextNode() as Text | null;
  }
  return null;
};

const introAlreadyExplainsAlias = (lesson: HTMLElement, longForm: string, abbreviation: string) => {
  const text = lesson.textContent ?? "";
  const escapedLong = longForm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAbbr = abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escapedLong}\\s*\\(\\s*(?:Amazon\\s+)?${escapedAbbr}\\s*\\)`, "i").test(text);
};

const wrapAliasIntroduction = (root: HTMLElement, longForm: string, abbreviation: string) => {
  // If the lesson literally introduces “Long Form (ACRONYM)”, the text already
  // teaches the alias. Adding a hover there is redundant and visually noisy.
  if (introAlreadyExplainsAlias(root, longForm, abbreviation)) return;
  if (root.querySelector(`[data-glossary-alias="${CSS.escape(abbreviation)}"]`)) return;

  const textNode = findTextNode(root, longForm);
  if (!textNode) return;
  const index = textNode.data.indexOf(longForm);
  if (index < 0) return;

  const before = textNode.data.slice(0, index);
  const after = textNode.data.slice(index + longForm.length);
  const alias = document.createElement("span");
  alias.className = "learn-initialism lesson-glossary-term glossary-alias";
  alias.tabIndex = 0;
  alias.dataset.glossaryAlias = abbreviation;
  alias.textContent = longForm;
  alias.setAttribute("aria-label", `${longForm}. Also known as ${abbreviation}.`);

  const popover = document.createElement("span");
  popover.className = "lesson-glossary-popover glossary-alias-popover";
  popover.setAttribute("role", "tooltip");
  const label = document.createElement("span");
  label.className = "glossary-popover-body";
  label.append(document.createTextNode("Also known as: "));
  const strong = document.createElement("strong");
  strong.textContent = abbreviation;
  label.append(strong);
  popover.append(label);
  alias.append(popover);

  const fragment = document.createDocumentFragment();
  if (before) fragment.append(document.createTextNode(before));
  fragment.append(alias);
  if (after) fragment.append(document.createTextNode(after));
  textNode.replaceWith(fragment);
};

const parseInlineAcronym = (label: string) => {
  const match = label.match(/^(.+?)\s*\(\s*(?:Amazon\s+)?([A-Z][A-Z0-9-]{1,9})\s*\)$/);
  if (!match) return null;
  return { longForm: match[1].trim(), abbreviation: match[2].trim() };
};

const normalizeGeneratedGlossaryTargets = (lesson: HTMLElement) => {
  const terms = [...lesson.querySelectorAll<HTMLElement>(".lesson-glossary-term:not([data-glossary-alias])")];

  for (const termNode of terms) {
    const label = visibleLabel(termNode);
    const inline = parseInlineAcronym(label);
    if (!inline) continue;

    // A generated glossary entry such as “Amazon Elastic Compute Cloud
    // (Amazon EC2)” should not turn the whole inline introduction into a giant
    // hover target. The introduction already explains the acronym.
    unwrap(termNode);
  }
};

const suppressInlineAcronymHover = (lesson: HTMLElement) => {
  const terms = [...lesson.querySelectorAll<HTMLElement>(".lesson-glossary-term:not([data-glossary-alias])")];
  for (const termNode of terms) {
    const label = visibleLabel(termNode);
    if (!isAbbreviation(label)) continue;

    const parent = termNode.parentElement;
    if (!parent) continue;
    const parentText = parent.textContent ?? "";
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // If this occurrence is the acronym inside an inline introduction, leave it
    // as plain text. Later standalone uses keep the full teaching popover.
    if (new RegExp(`\\(\\s*(?:Amazon\\s+)?${escaped}\\s*\\)`, "i").test(parentText)) {
      const before = termNode.previousSibling?.textContent ?? "";
      const after = termNode.nextSibling?.textContent ?? "";
      if (/\(\s*(?:Amazon\s*)?$/i.test(before) && /^\s*\)/.test(after)) unwrap(termNode);
    }
  }
};

const enhanceGlossaryAliases = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>(".generated-lesson").forEach((lesson) => {
    normalizeGeneratedGlossaryTargets(lesson);
    suppressInlineAcronymHover(lesson);

    const terms = [...lesson.querySelectorAll<HTMLElement>(".lesson-glossary-term:not([data-glossary-alias])")];
    for (const termNode of terms) {
      const abbreviation = visibleLabel(termNode);
      if (!isAbbreviation(abbreviation)) continue;
      const title = termNode.querySelector<HTMLElement>(".glossary-popover-title");
      if (!title) continue;
      const titleText = title.textContent ?? "";
      const separator = titleText.indexOf(" — ");
      if (separator < 0) continue;
      const expansion = titleText.slice(separator + 3).trim();
      if (!expansion || expansion === abbreviation || isAbbreviation(expansion)) continue;
      wrapAliasIntroduction(lesson, expansion, abbreviation);
    }
  });
};

enhanceGlossaryAliases();

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    enhanceGlossaryAliases();
  });
});
observer.observe(document.body, { childList: true, subtree: true });
