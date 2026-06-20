export interface TextRule {
  id: string;
  type: "replace" | "delete";
  pattern: string;
  replacement?: string;
  matchType: "regex" | "plain";
  scope: "all" | "book";
  bookKey?: string;
  bookName?: string;
}

const BLOCK_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,li,dt,dd,blockquote,address,kookitmarker";

const REJECTED_CLASSES = [
  "kookit-note",
  "kookit-note-icon",
  "kookit-word-def",
  "kookit-note-tooltip",
  "kookit-word-tooltip",
  "kookit-text-rule-replace",
  "kookit-text-rule-delete",
  "kookit-translation-host",
];

const isRejectedTextNode = (node: Node): boolean => {
  let parent = (node as Text).parentElement;
  while (parent) {
    const tag = parent.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "RUBY") {
      return true;
    }
    for (let i = 0; i < REJECTED_CLASSES.length; i++) {
      if (parent.classList.contains(REJECTED_CLASSES[i])) {
        return true;
      }
    }
    parent = parent.parentElement;
  }
  return false;
};

const expandReplacement = (
  replacement: string,
  match: RegExpExecArray
): string => {
  return replacement.replace(/\$(\$|\d+)/g, (_m, group: string) => {
    if (group === "$") return "$";
    const index = parseInt(group, 10);
    return match[index] ?? "";
  });
};

export const clearTextRules = (doc: Document) => {
  const spans = doc.querySelectorAll(
    ".kookit-text-rule-replace, .kookit-text-rule-delete"
  );
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parent.normalize();
  }
};

const collectTextNodes = (doc: Document, root: Element): Text[] => {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      return isRejectedTextNode(node)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }
  return textNodes;
};

const wrapMatchesInTextNode = (
  doc: Document,
  textNode: Text,
  regex: RegExp,
  rule: TextRule
) => {
  const text = textNode.textContent || "";
  regex.lastIndex = 0;
  if (!regex.test(text)) return;
  regex.lastIndex = 0;

  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) fragment.appendChild(doc.createTextNode(before));

    const matchedText = match[0];
    const span = doc.createElement("span");
    if (rule.type === "replace") {
      span.className = "kookit-text-rule-replace";
      const replacement =
        rule.matchType === "regex"
          ? expandReplacement(rule.replacement || "", match)
          : rule.replacement || "";
      span.setAttribute("data-kookit-replacement", replacement);
    } else {
      span.className = "kookit-text-rule-delete";
    }
    // Keep original text as the only text node so rangy offsets stay stable
    span.appendChild(doc.createTextNode(matchedText));
    fragment.appendChild(span);

    lastIndex = match.index + matchedText.length;
    if (matchedText.length === 0) {
      regex.lastIndex++;
    }
  }

  if (lastIndex === 0) return;

  const after = text.slice(lastIndex);
  if (after) fragment.appendChild(doc.createTextNode(after));

  textNode.parentNode?.replaceChild(fragment, textNode);
};

const applyRule = (doc: Document, rule: TextRule) => {
  const elements = doc.querySelectorAll(BLOCK_SELECTOR);
  const regex =
    rule.matchType === "regex"
      ? new RegExp(rule.pattern, "g")
      : new RegExp(
          rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        );

  for (let i = 0; i < elements.length; i++) {
    const textNodes = collectTextNodes(doc, elements[i] as Element);
    for (let j = 0; j < textNodes.length; j++) {
      wrapMatchesInTextNode(doc, textNodes[j], regex, rule);
    }
  }
};

export const applyTextRules = (doc: Document, rules: TextRule[]) => {
  clearTextRules(doc);
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule.scope === "all" || rule.scope === "book") {
      applyRule(doc, rule);
    }
  }
};
