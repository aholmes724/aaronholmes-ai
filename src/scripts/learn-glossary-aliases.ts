const isAbbreviation = (value: string) => /^[A-Z][A-Z0-9-]{1,9}$/.test(value.trim());

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

const wrapAliasIntroduction = (root: HTMLElement, longForm: string, abbreviation: string) => {
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

const enhanceGlossaryAliases = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>(".generated-lesson").forEach((lesson) => {
    const terms = [...lesson.querySelectorAll<HTMLElement>(".lesson-glossary-term")];
    for (const termNode of terms) {
      if (termNode.dataset.glossaryAlias) continue;
      const abbreviation = (termNode.childNodes[0]?.textContent ?? "").trim();
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

const observer = new MutationObserver(() => enhanceGlossaryAliases());
observer.observe(document.body, { childList: true, subtree: true });
