import type { TextColorWordGroups, WordMatch } from "./types";

const MAX_TERM_LENGTH = 100;
const MAX_TERMS = 1000;

export interface WordMatcher {
  regex: RegExp;
  colorIndexByTerm: Map<string, number>;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 把 colorIndex -> 词组 编译成一个正则。
 * 词按长度降序排列，保证同一位置优先命中更长的词；同词多色时取较小下标。
 */
export function buildWordMatcher(
  groups?: TextColorWordGroups,
  paletteSize = Number.POSITIVE_INFINITY
): WordMatcher | null {
  if (!groups) return null;
  const colorIndexByTerm = new Map<string, number>();

  for (const [key, groupList] of Object.entries(groups)) {
    const colorIndex = Number.parseInt(key, 10);
    if (!Number.isFinite(colorIndex)) continue;
    if (colorIndex < 0 || colorIndex >= paletteSize) continue;
    if (!Array.isArray(groupList)) continue;
    for (const group of groupList) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (typeof item !== "string") continue;
        const term = item.trim();
        if (!term || term.length > MAX_TERM_LENGTH) continue;
        const normalized = term.toLowerCase();
        const previous = colorIndexByTerm.get(normalized);
        if (previous === undefined || colorIndex < previous) {
          colorIndexByTerm.set(normalized, colorIndex);
        }
      }
    }
  }

  const terms = Array.from(colorIndexByTerm.keys())
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_TERMS);
  if (terms.length === 0) return null;

  return {
    regex: new RegExp(terms.map(escapeRegExp).join("|"), "gi"),
    colorIndexByTerm,
  };
}

export function findWordMatches(
  text: string,
  matcher: WordMatcher | null
): WordMatch[] {
  if (!matcher || !text) return [];
  const matches: WordMatch[] = [];
  const regex = matcher.regex;
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }
    const colorIndex = matcher.colorIndexByTerm.get(
      match[0].toLowerCase()
    );
    if (colorIndex === undefined) continue;
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      colorIndex,
    });
  }
  return matches;
}
