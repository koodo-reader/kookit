import type {
  TextColorCategory,
  TextColorConfig,
} from "./types";
import { tokenizeText } from "./tokenizer";
import {
  buildWordMatcher,
  findWordMatches,
  type WordMatcher,
} from "./words";

const COLOR_CLASS = "kookit-text-color";

const BLOCK_SELECTOR =
  "p,div,li,dd,dt,td,th,blockquote,h1,h2,h3,h4,h5,h6,pre,section,article,figcaption";

const REJECTED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "RUBY",
  "TEXTAREA",
  "NOSCRIPT",
  "TITLE",
]);

const REJECTED_CLASSES = [
  "kookit-note-icon",
  "kookit-note-tooltip",
  "kookit-word-tooltip",
  "kookit-translation-host",
];

const isRejectedTextNode = (node: Node, skipCode: boolean): boolean => {
  let parent = (node as Text).parentElement;
  while (parent) {
    if (REJECTED_TAGS.has(parent.tagName)) return true;
    if (skipCode && (parent.tagName === "CODE" || parent.tagName === "PRE")) {
      return true;
    }
    for (let i = 0; i < REJECTED_CLASSES.length; i++) {
      if (parent.classList.contains(REJECTED_CLASSES[i])) return true;
    }
    parent = parent.parentElement;
  }
  return false;
};

const collectBlocks = (doc: Document): Element[] => {
  const all = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR));
  const leaves = all.filter((element) => !element.querySelector(BLOCK_SELECTOR));
  return leaves.length > 0 ? leaves : [doc.body];
};

const collectTextNodes = (block: Element, skipCode: boolean): Text[] => {
  if (skipCode && (block.tagName === "PRE" || block.tagName === "CODE")) {
    return [];
  }
  const walker = (block.ownerDocument || document).createTreeWalker(
    block,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Node) =>
        isRejectedTextNode(node, skipCode)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    }
  );
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
};

interface LocalSegment {
  start: number;
  end: number;
  color: string;
}

/** 倒序切分文本节点，避免前面的区间被后续 splitText 打乱 */
const wrapSegments = (
  doc: Document,
  node: Text,
  segments: LocalSegment[]
): void => {
  for (let i = segments.length - 1; i >= 0; i--) {
    const { start, end, color } = segments[i];
    // 始终以原始节点为基准切分：原始节点始终是「剩余前段」，倒序处理不会被污染
    const target = start > 0 ? node.splitText(start) : node;
    const length = end - start;
    if (length <= 0) continue;
    if (target.length > length) {
      target.splitText(length);
    }
    const span = doc.createElement("span");
    span.className = COLOR_CLASS;
    // 夜间模式与「覆盖文字颜色」会给 p/span 等注入 color !important，
    // 行内样式必须同样 important 才能生效
    span.style.setProperty("color", color, "important");
    const parent = target.parentNode;
    if (!parent) continue;
    parent.insertBefore(span, target);
    span.appendChild(target);
  }
};

const colorBlock = (
  doc: Document,
  block: Element,
  config: TextColorConfig,
  matcher: WordMatcher | null,
  categoryEnabled: Partial<Record<TextColorCategory, boolean>>
): void => {
  const nodes = collectTextNodes(block, config.skipCode);
  if (nodes.length === 0) return;

  const starts: number[] = [];
  let text = "";
  for (let i = 0; i < nodes.length; i++) {
    starts.push(text.length);
    text += nodes[i].nodeValue || "";
  }
  if (!text.trim() || text.length > config.maxTextLength) return;

  const runs = tokenizeText(text, {
    enabled: categoryEnabled,
    crossLine: config.crossLine,
  });
  const wordMatches = findWordMatches(text, matcher);

  const colors: (string | null)[] = new Array(text.length).fill(null);
  for (const run of runs) {
    const color = config.categories[run.category].color;
    for (let i = run.start; i < run.end; i++) {
      colors[i] = color;
    }
  }
  for (const match of wordMatches) {
    const color = config.highlightColors[match.colorIndex];
    if (!color) continue;
    for (let i = match.start; i < match.end; i++) {
      colors[i] = color;
    }
  }

  for (let n = 0; n < nodes.length; n++) {
    const node = nodes[n];
    const base = starts[n];
    const length = node.nodeValue ? node.nodeValue.length : 0;
    const segments: LocalSegment[] = [];
    let i = 0;
    while (i < length) {
      const color = colors[base + i];
      if (!color) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < length && colors[base + j] === color) j++;
      segments.push({ start: i, end: j, color });
      i = j;
    }
    if (segments.length > 0) wrapSegments(doc, node, segments);
  }
};

/** 移除上一次着色产生的 span，保留纯文本节点 */
export const clearTextColor = (doc: Document): void => {
  const spans = doc.querySelectorAll(`span.${COLOR_CLASS}`);
  const parents = new Set<Node>();
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parents.add(parent);
  }
  // 合并被切碎的文本节点，避免多次着色后节点数量增长
  parents.forEach((parent) => {
    parent.normalize();
  });
};

export const applyTextColor = (
  doc: Document,
  config: TextColorConfig
): void => {
  if (!doc || !doc.body) return;
  clearTextColor(doc);
  if (!config || !config.enabled) return;

  const matcher = buildWordMatcher(
    config.wordGroups,
    config.highlightColors.length
  );
  const categoryEnabled: Partial<Record<TextColorCategory, boolean>> = {};
  for (const category of Object.keys(config.categories) as TextColorCategory[]) {
    categoryEnabled[category] = config.categories[category].enabled;
  }

  const blocks = collectBlocks(doc);
  for (let i = 0; i < blocks.length; i++) {
    colorBlock(doc, blocks[i], config, matcher, categoryEnabled);
  }
};
