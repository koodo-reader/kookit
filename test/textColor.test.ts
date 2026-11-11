import test from "node:test";
import assert from "node:assert/strict";
import { tokenizeText } from "../src/utils/textColor/tokenizer.ts";
import { buildWordMatcher, findWordMatches } from "../src/utils/textColor/words.ts";
import {
  DEFAULT_CATEGORY_COLORS_DARK,
  DEFAULT_CATEGORY_COLORS_LIGHT,
  normalizeTextColorConfig,
} from "../src/utils/textColor/config.ts";

test("引号内文字与标点分段", () => {
  const runs = tokenizeText("他说：“走吧。”");
  assert.deepEqual(runs, [
    { start: 2, end: 4, category: "punctuation" },
    { start: 4, end: 6, category: "quoted" },
    { start: 6, end: 8, category: "punctuation" },
  ]);
});

test("书名号内文字使用 bracketed", () => {
  const runs = tokenizeText("《斗破》");
  assert.deepEqual(runs, [
    { start: 0, end: 1, category: "punctuation" },
    { start: 1, end: 3, category: "bracketed" },
    { start: 3, end: 4, category: "punctuation" },
  ]);
});

test("引号内允许再进一层括号", () => {
  const runs = tokenizeText("“《书》”");
  assert.deepEqual(runs, [
    { start: 0, end: 2, category: "punctuation" },
    { start: 2, end: 3, category: "bracketed" },
    { start: 3, end: 5, category: "punctuation" },
  ]);
});

test("括号可以嵌套括号", () => {
  const runs = tokenizeText("((a))");
  assert.deepEqual(runs, [
    { start: 0, end: 2, category: "punctuation" },
    { start: 2, end: 3, category: "latin" },
    { start: 3, end: 5, category: "punctuation" },
  ]);
});

test("默认不跨行，换行后配对清空", () => {
  const runs = tokenizeText('"a\nb"');
  assert.deepEqual(runs, [
    { start: 0, end: 1, category: "punctuation" },
    { start: 1, end: 2, category: "latin" },
    { start: 3, end: 4, category: "latin" },
    { start: 4, end: 5, category: "punctuation" },
  ]);
});

test("开启跨行后引号可以跨行配对", () => {
  const runs = tokenizeText('"a\nb"', { crossLine: true });
  assert.deepEqual(runs, [
    { start: 0, end: 1, category: "punctuation" },
    { start: 1, end: 2, category: "latin" },
    { start: 3, end: 4, category: "latin" },
    { start: 4, end: 5, category: "punctuation" },
  ]);
});

test("关闭标点类别时，引号与引号内文字合并为 quoted", () => {
  const runs = tokenizeText("他说：“走吧。”", {
    enabled: { punctuation: false },
  });
  assert.deepEqual(runs, [{ start: 3, end: 8, category: "quoted" }]);
});

test("数字与拉丁字母分类", () => {
  const runs = tokenizeText("第3章 abc");
  assert.deepEqual(runs, [
    { start: 1, end: 2, category: "number" },
    { start: 4, end: 7, category: "latin" },
  ]);
});

test("符号与标点使用不同类别", () => {
  const runs = tokenizeText("★$%");
  assert.deepEqual(runs, [
    { start: 0, end: 2, category: "symbol" },
    { start: 2, end: 3, category: "punctuation" },
  ]);
});

test("高亮词最长优先且大小写不敏感", () => {
  const matcher = buildWordMatcher(
    {
      "0": [["唐三"]],
      "1": [["唐"], ["ABC"]],
    },
    10
  );
  assert.ok(matcher);
  assert.deepEqual(findWordMatches("唐三和abc唐", matcher), [
    { start: 0, end: 2, colorIndex: 0 },
    { start: 3, end: 6, colorIndex: 1 },
    { start: 6, end: 7, colorIndex: 1 },
  ]);
});

test("配置归一化：非法颜色回退默认值", () => {
  const config = normalizeTextColorConfig(
    {
      enabled: true,
      categories: { punctuation: { color: "red" } },
      highlightColors: ["#fff"],
    },
    false
  );
  assert.equal(config.enabled, true);
  assert.equal(
    config.categories.punctuation.color,
    DEFAULT_CATEGORY_COLORS_LIGHT.punctuation
  );
  assert.equal(config.categories.punctuation.enabled, true);
  assert.equal(config.highlightColors.length, 10);
});

test("配置归一化：暗色主题使用暗色默认值", () => {
  const config = normalizeTextColorConfig({ enabled: true }, true);
  assert.equal(
    config.categories.quoted.color,
    DEFAULT_CATEGORY_COLORS_DARK.quoted
  );
  assert.equal(
    config.categories.latin.color,
    DEFAULT_CATEGORY_COLORS_DARK.latin
  );
});
