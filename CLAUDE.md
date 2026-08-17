# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # 开发模式，Rollup 监听文件变化
yarn build        # 生产构建（同时输出桌面版和移动版）
yarn clean        # 清理 build/dist/docs 目录
```

**构建输出目标**（在 `rollup.config.js` 中硬编码为本地路径）：
- 桌面版 ES 模块 → `D:\Project\koodo-reader\src\assets\lib\kookit.min.js`
- 移动版 UMD → `D:\Project\koodo-reader-expo\assets\lib\kookit.min.txt`
- 移动版 ES 模块 → `D:\Project\koodo-reader-expo\assets\lib\kookit-mobile.min.js`

无测试框架，无 CI/CD。

## 重要规则

**禁止主动提交代码**：任何情况下不得使用 `git commit`、`git push` 等命令提交或推送代码。用户必须自行执行 git 操作。

## 架构概览

**kookit** 是 [Koodo Reader](https://github.com/koodo-reader/koodo-reader) 的电子书渲染引擎库，同时支持 Electron 桌面端（`src/index.ts`）和 React Native 移动端（`src/mobile.ts`）。

### 渲染类层次

```
GeneralRender (src/renders/GeneralRender.ts)  ← 1400+ 行基类
    ├── EpubRender / MobiRender / HtmlRender / Fb2Render
    ├── TxtRender / MdRender / DocxRender
    ├── PdfRender / PdfTextRender
    ├── ComicRender
    └── CacheRender
```

`BookHelper`（`src/helpers/bookHelper.ts`）是渲染工厂，根据文件格式选择对应的 Render 类。

### 渲染生命周期

1. `BookHelper.getRendition(fileBuffer, config, Kookit)` → 实例化对应 Render
2. `rendition.renderTo(element)` → 在 DOM 元素内创建 iframe，注入内容
3. `GeneralRender.addTouchEvent(isAndroid, touchControlRule)` → 为所有 iframe 注册触摸事件

### PDF 页面结构（关键）

PDF 使用 CSS 多列布局，`outerDoc`（外层 WebView 文档）的 `body` 设置了 `column-width`，每列对应一个 PDF 页面：

```
outerDoc.body (CSS columns, overflow-x: hidden)
  └── #pdf-container-0 (div, position: relative, paddingTop = pageHeight)
        └── #pdf-iframe-0 (iframe, position: absolute, scrolling="no")
  └── #pdf-container-1
        └── #pdf-iframe-1
  ...
```

- 翻页 = 修改 `outerDoc.body.scrollLeft`（`handleScrollPDFPosition` in pdfUtil）
- 每页内容渲染在独立 iframe 的 `contentDocument` 中
- `GeneralRender.getAllDocuments()` 返回 `[outerDoc, iframe0.contentDocument, iframe1.contentDocument, ...]`
- `addAndroidTouchEvent` / `addAppleTouchEvent` 针对每个 iframe 的 contentDocument 分别调用

### 触摸事件系统（`src/utils/touchUtil.ts`）

- `addAndroidTouchEvent(doc, iframe, element, readerMode, animation, format, rule, render)` — 安卓
- `addAppleTouchEvent(...)` — iOS

`doc` 是当前 iframe 的 `contentDocument`，`render.getDocument()` 返回 `outerDoc`（外层文档）。

`readerMode` 枚举：`"single"` | `"double"` | `"scroll"`

`animation` 枚举：`"sliding"` | `"mimical"` | `"none"`

### 双端构建差异

| 特性 | 桌面（`src/index.ts`）| 移动（`src/mobile.ts`）|
|------|-----------------------|------------------------|
| 构建格式 | ES module（external 依赖）| UMD（全量打包）+ Babel 转译 |
| 缓存 | `src/libs/cache.ts` | `src/libs/cache-mobile.ts` |
| ZIP 库 | JSZip / fflate / @zip.js（三重容错）| 同左 |

### 主要工具文件

| 文件 | 职责 |
|------|------|
| `src/utils/layoutUtil.ts` | iframe 创建、字体注入、列布局计算 |
| `src/utils/navigationUtil.ts` | 章节导航、CFI 定位、滚动处理 |
| `src/utils/pdfUtil.ts` | PDF 容器/iframe 创建、搜索、高亮、位置管理 |
| `src/utils/touchUtil.ts` | Android/iOS 触摸/滑动/选文事件 |
| `src/utils/noteUtil.ts` | 高亮笔记的渲染与清除 |
| `src/utils/animationUtil.ts` | 仿真翻书（mimical）动画 |
| `src/libs/cfi.ts` | EPUB CFI 解析与生成 |
| `src/libs/zh-convert.ts` | 中文繁简转换（120KB+，勿随意修改） |
