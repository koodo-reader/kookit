/**
 * 阅读内容上色类别。
 * 只影响前景色，不涉及背景、字体与排版。
 *
 * - quoted / bracketed：成对引号、括号内部的文字
 * - punctuation：标点
 * - symbol：Unicode 符号（货币、数学、装饰、箭头等）
 * - number：数字
 * - latin：拉丁字母
 */
export type TextColorCategory =
  | "quoted"
  | "bracketed"
  | "punctuation"
  | "symbol"
  | "number"
  | "latin";

export type TextColorCategoryOptions = Partial<
  Record<TextColorCategory, { enabled?: boolean; color?: string }>
>;

/** colorIndex -> 词组；同一组内的词共享一个颜色 */
export type TextColorWordGroups = Record<string, string[][]>;

export interface TextColorConfigInput {
  enabled?: boolean;
  categories?: TextColorCategoryOptions;
  /** 自定义高亮词色板，下标与 wordGroups 的 key 对应 */
  highlightColors?: string[];
  wordGroups?: TextColorWordGroups;
  /** 引号/括号是否跨行匹配 */
  crossLine?: boolean;
  /** 跳过 pre/code，避免与代码高亮冲突 */
  skipCode?: boolean;
  /** 单块最大字符数，超过则跳过着色 */
  maxTextLength?: number;
}

export interface TextColorCategoryStyle {
  enabled: boolean;
  color: string;
}

export interface TextColorConfig {
  enabled: boolean;
  categories: Record<TextColorCategory, TextColorCategoryStyle>;
  highlightColors: string[];
  wordGroups: TextColorWordGroups;
  crossLine: boolean;
  skipCode: boolean;
  maxTextLength: number;
}

/** 连续同类字符的区间，end 为开区间 */
export interface TextColorRun {
  start: number;
  end: number;
  category: TextColorCategory;
}

export interface WordMatch {
  start: number;
  end: number;
  colorIndex: number;
}
