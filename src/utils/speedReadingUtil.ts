// 中日韩等表意文字、泰/老/高棉/缅文等无空格连写文字
const NO_SPACE_SCRIPT_REGEX =
  /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uff9f\u0e00-\u0e7f\u0e80-\u0eff\u1000-\u109f\u1780-\u17ff]/;

const segmenterCache: Record<string, any> = {};

const getWordSegmenter = (lang?: string) => {
  if (typeof (Intl as any).Segmenter === "undefined") return null;
  const key = lang || "default";
  if (!segmenterCache[key]) {
    segmenterCache[key] = new (Intl as any).Segmenter(lang || undefined, {
      granularity: "word",
    });
  }
  return segmenterCache[key];
};

export const isNoSpaceScript = (text: string): boolean => {
  if (!text) return false;
  return NO_SPACE_SCRIPT_REGEX.test(text);
};

// 英文等空格连写语言按空白切分；中日韩、泰语等非印欧语系语言使用 Intl.Segmenter 分词
export const segmentSpeedReadingWords = (text: string): string[] => {
  if (!text || !text.trim()) return [];
  if (isNoSpaceScript(text)) {
    const segmenter = getWordSegmenter();
    if (segmenter) {
      return Array.from(segmenter.segment(text))
        .map((segment: any) => segment.segment as string)
        .filter((segment: string) => segment.trim().length > 0);
    }
    return Array.from(text).filter((char) => char.trim().length > 0);
  }
  return text.split(/\s+/).filter((word) => word.length > 0);
};

// ORP（Optimal Recognition Point）最佳识别点：
// 短词（1–3 字母）高亮第 1 个字母，中等长度词高亮第 2 或第 3 个字母，
// 长词高亮更靠左的固定位置，保证注视点始终锁定同一位置
export const getSpeedReadingORPIndex = (word: string): number => {
  const length = Array.from(word).length;
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
};

// 单词展示时长基础值 = 60000 / WPM，长词和句读标点附加停顿
export const getSpeedReadingWordDelay = (word: string, wpm: number): number => {
  const base = 60000 / Math.max(1, wpm);
  const token = word.trim();
  const length = Array.from(token).length;
  let factor = 1;
  if (length >= 13) {
    factor = 1.8;
  } else if (length >= 9) {
    factor = 1.5;
  } else if (length >= 6) {
    factor = 1.2;
  }
  if (token && /^[.!?。！？；：…，,、()]$/.test(token)) {
    factor = 2.5;
  } else if (/[.!?。！？…]["'」』）)]?$/.test(token)) {
    factor = Math.max(factor, 2);
  } else if (/[,，、;；:]["'」』）)]?$/.test(token)) {
    factor = Math.max(factor, 1.5);
  }
  return Math.round(base * factor);
};
