export { applyTextColor, clearTextColor } from "./apply";
export {
  DEFAULT_CATEGORY_COLORS_DARK,
  DEFAULT_CATEGORY_COLORS_LIGHT,
  DEFAULT_HIGHLIGHT_COLORS_DARK,
  DEFAULT_HIGHLIGHT_COLORS_LIGHT,
  TEXT_COLOR_CATEGORIES,
  isValidTextColor,
  normalizeTextColorConfig,
} from "./config";
export { tokenizeText, type TokenizeOptions } from "./tokenizer";
export {
  buildWordMatcher,
  findWordMatches,
  type WordMatcher,
} from "./words";
export type {
  TextColorCategory,
  TextColorCategoryOptions,
  TextColorCategoryStyle,
  TextColorConfig,
  TextColorConfigInput,
  TextColorRun,
  TextColorWordGroups,
  WordMatch,
} from "./types";
