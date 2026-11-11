import type {
  TextColorCategory,
  TextColorRun,
} from "./types";

export interface TokenizeOptions {
  /** 类别开关；未提供的类别默认开启 */
  enabled?: Partial<Record<TextColorCategory, boolean>>;
  /** 引号/括号是否允许跨行配对，默认 false */
  crossLine?: boolean;
  /** 允许的最大嵌套深度，默认 4 */
  maxDepth?: number;
}

type Delimited = Extract<TextColorCategory, "quoted" | "bracketed">;

interface DelimiterPair {
  close: string;
  kind: Delimited;
}

/**
 * 成对定界符表。只收录语义明确、日常排版常见的 ASCII / 中文引号与括号。
 * 单引号（' 与 ’）不参与配对：英文撇号出现频率高，误判代价远大于收益。
 */
const DELIMITER_BY_OPEN = new Map<string, DelimiterPair>([
  ['"', { close: '"', kind: "quoted" }],
  ["\u201C", { close: "\u201D", kind: "quoted" }],
  ["\u300C", { close: "\u300D", kind: "quoted" }],
  ["\u300E", { close: "\u300F", kind: "quoted" }],
  ["(", { close: ")", kind: "bracketed" }],
  ["\uFF08", { close: "\uFF09", kind: "bracketed" }],
  ["[", { close: "]", kind: "bracketed" }],
  ["\uFF3B", { close: "\uFF3D", kind: "bracketed" }],
  ["{", { close: "}", kind: "bracketed" }],
  ["\uFF5B", { close: "\uFF5D", kind: "bracketed" }],
  ["\u3010", { close: "\u3011", kind: "bracketed" }],
  ["\u300A", { close: "\u300B", kind: "bracketed" }],
  ["\u3008", { close: "\u3009", kind: "bracketed" }],
]);

type Classified = TextColorCategory | "mark" | null;

/** 用字符串构造正则：旧引擎不支持 Unicode 属性时不会在解析阶段抛错 */
const propertyMatcher = (pattern: string): ((char: string) => boolean) | null => {
  try {
    const regex = new RegExp(pattern, "u");
    return (char: string) => regex.test(char);
  } catch {
    return null;
  }
};

const NUMBER = propertyMatcher("^\\p{N}$");
const LATIN = propertyMatcher("^\\p{Script=Latin}$");
const SYMBOL = propertyMatcher("^\\p{S}$");
const PUNCTUATION = propertyMatcher("^\\p{P}$");
const MARK = propertyMatcher("^\\p{M}$");

const supportsUnicodeProperties = Boolean(
  NUMBER && LATIN && SYMBOL && PUNCTUATION && MARK
);

/** 极简 ASCII 兜底：运行环境不支持 Unicode 属性时使用 */
const classifyAscii = (code: number): Classified => {
  if (code >= 0x30 && code <= 0x39) return "number";
  if (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  ) {
    return "latin";
  }
  if (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e)
  ) {
    return "punctuation";
  }
  return null;
};

const classifyCache = new Map<string, Classified>();

/**
 * 单字符分类。结果按字符缓存，正文里字符重复率很高，
 * 首次命中后都是 Map 查找，避免每个字符重复跑正则。
 */
const classify = (char: string): Classified => {
  const cached = classifyCache.get(char);
  if (cached !== undefined) return cached;

  let result: Classified = null;
  if (supportsUnicodeProperties) {
    if (NUMBER!(char)) result = "number";
    else if (LATIN!(char)) result = "latin";
    else if (SYMBOL!(char)) result = "symbol";
    else if (PUNCTUATION!(char)) result = "punctuation";
    else if (MARK!(char)) result = "mark";
  } else {
    result = classifyAscii(char.charCodeAt(0));
  }

  classifyCache.set(char, result);
  return result;
};

/**
 * 把一段纯文本切分成类别区间。
 *
 * 调用方以「段落」为单位传入，这样引号/括号可以跨过段内的内联标签。
 * 默认在换行处清空配对栈；`crossLine` 为 true 时保留。
 */
export function tokenizeText(
  text: string,
  options: TokenizeOptions = {}
): TextColorRun[] {
  const enabled: Record<TextColorCategory, boolean> = {
    quoted: true,
    bracketed: true,
    punctuation: true,
    symbol: true,
    number: true,
    latin: true,
    ...options.enabled,
  };
  const crossLine = options.crossLine === true;
  const maxDepth = Math.max(1, options.maxDepth ?? 4);
  const stack: DelimiterPair[] = [];
  const runs: TextColorRun[] = [];

  const emit = (index: number, category: TextColorCategory) => {
    const last = runs[runs.length - 1];
    if (last && last.end === index && last.category === category) {
      last.end = index + 1;
      return;
    }
    runs.push({ start: index, end: index + 1, category });
  };

  /** 最内层「已开启」的成对类别；逐层外退，全部关闭时返回 null */
  const innerCategory = (): TextColorCategory | null => {
    for (let depth = stack.length - 1; depth >= 0; depth--) {
      const kind = stack[depth].kind;
      if (enabled[kind]) return kind;
    }
    return null;
  };

  /** 类别被关闭时，退回到当前所在的引号/括号类别 */
  const resolve = (category: TextColorCategory): TextColorCategory | null => {
    if (enabled[category]) return category;
    return innerCategory();
  };

  const emitDelimiter = (
    index: number,
    kind: Delimited,
    entering: boolean
  ) => {
    if (enabled.punctuation) {
      emit(index, "punctuation");
      return;
    }
    const category = entering && enabled[kind] ? kind : innerCategory();
    if (category) emit(index, category);
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\n" || char === "\r") {
      if (!crossLine) stack.length = 0;
      continue;
    }

    const top = stack[stack.length - 1];
    if (top && char === top.close) {
      emitDelimiter(index, top.kind, false);
      stack.pop();
      continue;
    }

    const pair = DELIMITER_BY_OPEN.get(char);
    if (pair && stack.length < maxDepth) {
      emitDelimiter(index, pair.kind, true);
      stack.push(pair);
      continue;
    }

    const kind = classify(char);
    if (kind === "mark") {
      // 组合用变音符号跟随前一个字符，避免 a + U+0301 被拆成两段
      const last = runs[runs.length - 1];
      if (last && last.end === index) last.end = index + 1;
      continue;
    }
    if (kind) {
      const category = resolve(kind);
      if (category) emit(index, category);
      continue;
    }
    if (top) {
      const category = innerCategory();
      if (category) emit(index, category);
    }
  }

  return runs;
}
