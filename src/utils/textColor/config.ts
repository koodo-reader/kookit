import type {
  TextColorCategory,
  TextColorCategoryOptions,
  TextColorCategoryStyle,
  TextColorConfig,
  TextColorConfigInput,
  TextColorWordGroups,
} from "./types";

export const TEXT_COLOR_CATEGORIES: TextColorCategory[] = [
  "quoted",
  "bracketed",
  "punctuation",
  "symbol",
  "number",
  "latin",
];

/**
 * 默认配色：亮色用于浅色纸张，暗色用于深色背景。
 * 六个类别按色相拉开，同时保证在各自背景上可读。
 */
export const DEFAULT_CATEGORY_COLORS_LIGHT: Record<TextColorCategory, string> =
  {
    quoted: "#7b2d8e",
    bracketed: "#5b6472",
    punctuation: "#0e7490",
    symbol: "#b45309",
    number: "#1d4ed8",
    latin: "#be185d",
  };

export const DEFAULT_CATEGORY_COLORS_DARK: Record<TextColorCategory, string> = {
  quoted: "#d8b4fe",
  bracketed: "#94a3b8",
  punctuation: "#67e8f9",
  symbol: "#fcd34d",
  number: "#93c5fd",
  latin: "#f9a8d4",
};

/** 自定义高亮词默认色板：亮色 */
export const DEFAULT_HIGHLIGHT_COLORS_LIGHT = [
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#4d7c0f",
  "#15803d",
  "#0f766e",
  "#0369a1",
  "#4338ca",
  "#7e22ce",
  "#be185d",
];

/** 自定义高亮词默认色板：暗色 */
export const DEFAULT_HIGHLIGHT_COLORS_DARK = [
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#bef264",
  "#86efac",
  "#5eead4",
  "#7dd3fc",
  "#a5b4fc",
  "#d8b4fe",
  "#f9a8d4",
];

const MIN_HIGHLIGHT_COLORS = 3;
const MAX_HIGHLIGHT_COLORS = 32;
const MAX_WORD_LENGTH = 100;

const DEFAULT_MAX_TEXT_LENGTH = 200000;

const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#[0-9a-fA-F]{3}$/;

export const isValidTextColor = (value: unknown): value is string => {
  return typeof value === "string" && (HEX_6.test(value) || HEX_3.test(value));
};

const normalizeHex = (value: unknown, fallback: string): string => {
  if (!isValidTextColor(value)) return fallback;
  const raw = value.startsWith("#") ? value : `#${value}`;
  if (HEX_6.test(raw)) return raw.toLowerCase();
  const [r, g, b] = [raw[1], raw[2], raw[3]];
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
};

const normalizePalette = (
  value: unknown,
  fallback: string[]
): string[] => {
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isValidTextColor(item)) continue;
      out.push(normalizeHex(item, "#000000"));
      if (out.length >= MAX_HIGHLIGHT_COLORS) break;
    }
  }
  return out.length >= MIN_HIGHLIGHT_COLORS ? out : [...fallback];
};

const normalizeWordGroups = (
  value: unknown,
  paletteSize: number
): TextColorWordGroups => {
  const out: TextColorWordGroups = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, groups] of Object.entries(
    value as Record<string, unknown>
  )) {
    const colorIndex = Number.parseInt(key, 10);
    if (!Number.isFinite(colorIndex)) continue;
    if (colorIndex < 0 || colorIndex >= paletteSize) continue;
    if (!Array.isArray(groups)) continue;
    const normalizedGroups: string[][] = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      const terms: string[] = [];
      for (const item of group) {
        if (typeof item !== "string") continue;
        const term = item.trim().slice(0, MAX_WORD_LENGTH);
        if (term) terms.push(term);
      }
      if (terms.length > 0) normalizedGroups.push(terms);
    }
    if (normalizedGroups.length > 0) out[String(colorIndex)] = normalizedGroups;
  }
  return out;
};

const normalizeMaxTextLength = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_TEXT_LENGTH;
  return Math.min(1000000, Math.max(10000, Math.floor(parsed)));
};

export function normalizeTextColorConfig(
  raw?: TextColorConfigInput | null,
  dark = false
): TextColorConfig {
  const input: TextColorConfigInput =
    raw && typeof raw === "object" ? raw : {};
  const palette = dark
    ? DEFAULT_CATEGORY_COLORS_DARK
    : DEFAULT_CATEGORY_COLORS_LIGHT;

  const inputCategories: TextColorCategoryOptions = input.categories || {};
  const categories = {} as Record<TextColorCategory, TextColorCategoryStyle>;
  for (const category of TEXT_COLOR_CATEGORIES) {
    const option = inputCategories[category];
    categories[category] = {
      enabled: option?.enabled !== false,
      color: normalizeHex(option?.color, palette[category]),
    };
  }

  const highlightColors = normalizePalette(
    input.highlightColors,
    dark ? DEFAULT_HIGHLIGHT_COLORS_DARK : DEFAULT_HIGHLIGHT_COLORS_LIGHT
  );

  return {
    enabled: input.enabled === true,
    categories,
    highlightColors,
    wordGroups: normalizeWordGroups(input.wordGroups, highlightColors.length),
    crossLine: input.crossLine === true,
    skipCode: input.skipCode !== false,
    maxTextLength: normalizeMaxTextLength(input.maxTextLength),
  };
}
