import ChapterDoc from "../model/chapterDoc";
import { convertStyleNum, getActualOffsetLeft } from "./layoutUtil";
import { playMimicalFlip } from "./navigationUtil";
import { detectLocalLanguage } from "./common";
import _ from "underscore";
declare var window: any;

export const getPdfScale = async (
  element: HTMLElement,
  readerMode: string,
  chapterDocList: ChapterDoc[],
  chapterDocIndex: number,
  doc: any
) => {
  let { width, height } =
    await chapterDocList[chapterDocIndex].text.getDimension();

  let viewWidth = doc.body.clientWidth;
  let viewHeight = element.clientHeight;
  let scale = Math.min(viewWidth / width, viewHeight / height);
  if (readerMode === "scroll") {
    scale = viewWidth / width;
  }
  return scale;
};
export const handlePDFLayout = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  if (readerMode === "scroll") return;
  let scale = readerMode === "double" ? 2 : 1;
  let section = Math.floor(doc.body.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  doc.documentElement.setAttribute(
    "style",
    `${readerMode === "double" ? "position: absolute;" : ""}height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action: manipulation; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
      (doc.body.clientWidth - gap) / scale
    }px;`
  );
  doc.body.setAttribute(
    "style",
    `margin: 0px !important; padding: 0px !important;column-fill: auto;column-gap: ${gap}px; column-width: ${
      (doc.body.clientWidth - gap) / scale
    }px;`
  );
};
export const createPDFContainer = async (
  element: HTMLElement,
  chapterDocList: ChapterDoc[],
  viewport: any,
  readerMode: string,
  pdfCrop: { top: number; bottom: number; left: number; right: number }
) => {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < chapterDocList.length; index++) {
    // Create container with aspect ratio
    const iframeContainer = document.createElement("div");
    iframeContainer.style.position = "relative";
    iframeContainer.style.width = "100%";
    iframeContainer.id = "pdf-container-" + index;
    iframeContainer.className = "pdf-container";
    if (readerMode === "single") {
      iframeContainer.style.paddingTop = element.clientHeight + "px";
    } else if (readerMode === "double") {
      // Set aspect ratio based on PDF page dimensions
      const aspectRatio = viewport?.width / viewport?.height || 0.75; // Default to 3:4 if viewport unknown
      iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100}%`;
    } else if (readerMode === "scroll") {
      let scrollViewport = await chapterDocList[index].text.getDimension();
      const aspectRatio =
        scrollViewport?.width / scrollViewport?.height || 0.75; // Default to 3:4 if viewport unknown
      const cropRatio = (100 - pdfCrop.bottom - pdfCrop.top) / 100;

      iframeContainer.style.paddingTop = `${(1 / aspectRatio) * cropRatio * 100}%`;
      iframeContainer.style.marginBottom = `2%`;
      iframeContainer.style.overflow = "hidden";
    }

    if (readerMode === "double") {
      //break-inside: avoid;
      iframeContainer.style.breakInside = "avoid";
    }
    fragment.appendChild(iframeContainer);
  }
  element.appendChild(fragment);
};
export const createPDFIframe = (chapterDocIndex: number, doc: Document) => {
  const iframeContainer = doc.getElementById(
    "pdf-container-" + chapterDocIndex
  );
  if (!iframeContainer) return;
  // Create iframe with absolute positioning
  let iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.style.padding = "0";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.scrolling = "no";
  iframe.tabIndex = 0;
  iframe.id = "pdf-iframe-" + chapterDocIndex;

  // Add style element
  let style = document.createElement("style");
  style.id = "default-style";
  style.textContent = "body{margin: 0px}";

  // Append iframe to container, then container to parent
  iframeContainer.appendChild(iframe);

  // Add style to iframe after it's in the DOM
  iframe.contentDocument?.head.appendChild(style);
  return iframe;
};
export const handleScrollPDFPosition = async (
  chapterDocIndex: number,
  readerMode: string,
  doc: Document
) => {
  let targetNode: any = doc.getElementById("pdf-container-" + chapterDocIndex);
  if (!targetNode) return;

  if (readerMode !== "scroll") {
    let left = targetNode
      ? getActualOffsetLeft(targetNode) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    doc.body.scrollTo(left, 0);
  } else {
    targetNode.scrollIntoView();
  }
};

export const isPDFScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string,
  doc: any
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (readerMode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= doc.body.clientWidth;
  } else {
    let elemTop = rect.top;
    let elemBottom = rect.bottom;
    isVisible =
      (elemTop - 10 >= element.scrollTop &&
        elemTop + 10 <= element.scrollTop + element.clientHeight) ||
      (elemBottom - 10 >= element.scrollTop &&
        elemBottom + 10 <= element.scrollTop + element.clientHeight) ||
      (elemTop + 10 <= element.scrollTop &&
        elemBottom - 10 >= element.scrollTop + element.clientHeight);
  }
  return isVisible;
};

export const getPDFVisibleText = async (
  chapterDocIndex: number,
  chapterDocList: ChapterDoc[],
  readerMode: string
) => {
  let textContent = await chapterDocList[chapterDocIndex].text.getTextContent();
  let textList = textContent.items.map((item: any) => {
    return item.str;
  });
  if (readerMode === "double") {
    let nextTextContent =
      await chapterDocList[chapterDocIndex + 1].text.getTextContent();
    let nextTextList = nextTextContent.items.map((item: any) => {
      return item.str;
    });
    textList = textList.concat(nextTextList);
  }
  return textList;
};
const getCorrectNodeList = (
  nodeList: NodeListOf<Element>,
  text: string
): Element[] => {
  const nodes = Array.from(nodeList);
  if (!text || nodes.length === 0) return [];

  // textLayer 中每个 textContent item 对应一个 span，item 间的空格由单独的
  // 空格 span 保留，同行内直接拼接即与 getTextFromPDFPage 的结果一致；
  // 只有跨行处（<br> 不产生文本）需要像 hasEOL 一样补一个空格。
  // 用 rect.top 差与行高的比例判断是否同行，上标等同行内的垂直偏移不会被误判。
  // 标点后的空格在两侧统一删除，兼容 TTS 等来源会去掉标点后空格的文本
  const normalize = (s: string) =>
    s
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[,.;:!?] (?=\S)/g, (m) => m[0]);
  const normalizedText = normalize(text);
  if (!normalizedText) return [];

  // 检测是否为 CJK 语言，CJK 语言节点间不需要加空格
  const lang = detectLocalLanguage(normalizedText);
  const isCJK = lang === "zh" || lang === "ja" || lang === "ko";

  const isSameLine = (prev: Element, cur: Element) => {
    const prevRect = (prev as HTMLElement).getBoundingClientRect();
    const curRect = (cur as HTMLElement).getBoundingClientRect();
    const minH = Math.min(prevRect.height, curRect.height);
    // 布局不可用时退回旧行为：当作跨行补空格
    if (minH <= 0) return false;
    return Math.abs(curRect.top - prevRect.top) <= minH * 0.6;
  };

  // 拼接节点文本并记录每个节点在总串中的区间；
  // 纯空白节点（空格 span）保留为单个空格，多余空格随后统一折叠。
  let total = "";
  const ranges: { start: number; end: number }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const piece = ((nodes[i] as HTMLElement).textContent || "").replace(
      /\s+/g,
      " "
    );
    if (!piece.trim()) {
      ranges.push({ start: total.length, end: total.length + 1 });
      total += " ";
      continue;
    }
    if (
      i > 0 &&
      !total.endsWith(" ") &&
      !piece.startsWith(" ") &&
      !isSameLine(nodes[i - 1], nodes[i])
    ) {
      if (total.endsWith("-")) {
        // 与 getTextFromPDFPage 的 hasEOL 连字符处理对齐：去掉行尾连字符直接拼接，
        // 使 "com-" + "pile" 与其产出的 "compile" 一致
        total = total.slice(0, -1);
        ranges[ranges.length - 1].end -= 1;
      } else if (!isCJK) {
        total += " ";
      }
    }
    const start = total.length;
    total += piece;
    ranges.push({ start, end: total.length });
  }

  // 折叠连续空格、去除首尾空格并删除标点后的空格（与 normalize 规则一致），
  // 同时记录归一化串位置到原始串位置的映射
  let normalizedTotal = "";
  const posMap: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < total.length; i++) {
    if (total[i] === " ") {
      if (lastWasSpace) continue;
      // 标点后的空格直接删除
      if (",.;:!?".includes(normalizedTotal.slice(-1))) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    normalizedTotal += total[i];
    posMap.push(i);
  }
  if (normalizedTotal.endsWith(" ")) {
    normalizedTotal = normalizedTotal.slice(0, -1);
    posMap.pop();
  }

  const pos = normalizedTotal.indexOf(normalizedText);
  if (pos === -1) return [];

  const endPos = pos + normalizedText.length;
  const rawStart = posMap[pos];
  const rawEnd =
    endPos >= posMap.length ? posMap[posMap.length - 1] + 1 : posMap[endPos];

  // 找出所有与 [rawStart, rawEnd) 有交集的连续 node
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    if (end > rawStart && start < rawEnd) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  }

  if (startIdx === -1) return [];
  return nodes.slice(startIdx, endIdx + 1);
};
export const handleHighlightPDFNode = (
  text: string,
  style: string,
  doc: Document
) => {
  // First remove any existing highlights
  const existingHighlights = doc.querySelectorAll(
    `span[data-highlight="true"]`
  );
  existingHighlights.forEach((highlight) => {
    // Remove all highlight-related properties so any style type (background,
    // underline, strikethrough, wavy) is cleared, not just background.
    const style = highlight.getAttribute("style") || "";
    const newStyle = style
      .replace(
        /background(?:-image|-repeat|-position|-size|-color)?\s*:[^;]+;?/gi,
        ""
      )
      .replace(/mix-blend-mode\s*:[^;]+;?/gi, "")
      .replace(/border-(?:bottom|right)\s*:[^;]+;?/gi, "")
      .replace(
        /text-decoration(?:-line|-style|-color|-thickness|-skip-ink)?\s*:[^;]+;?/gi,
        ""
      )
      .trim();
    if (newStyle) {
      highlight.setAttribute("style", newStyle);
    } else {
      highlight.removeAttribute("style");
    }
    highlight.removeAttribute("data-highlight");
  });

  if (!text.trim()) return;
  let nodeList = doc.querySelectorAll("p,span");
  let nodes: any[] = getCorrectNodeList(nodeList, text);
  console.log("handleHighlightPDFNode nodes", nodeList, nodes, text);
  if (nodes.length > 0) {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute(
        "style",
        (nodes[i].getAttribute("style") || "") + style
      );
      nodes[i].setAttribute("data-highlight", "true");
    }
  }
};
export const getPDFSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let textContent = await chapterDocList[i].text.getTextContent();

    // Group items by line based on y-coordinate with tolerance
    const lineMap = new Map<number, any[]>();
    const tolerance = 5; // Y-coordinate tolerance for grouping items in same line

    textContent.items.forEach((item: any, index: number) => {
      const y = item.transform[5]; // y-coordinate
      let foundLineKey: number | null = null;

      // Check if this item belongs to an existing line
      for (const [firstItemIndex, items] of lineMap.entries()) {
        const firstItemY = items[0].transform[5];
        if (Math.abs(y - firstItemY) < tolerance) {
          items.push(item);
          foundLineKey = firstItemIndex;
          break;
        }
      }

      // If no matching line found, create a new line with current item's index as key
      if (foundLineKey === null) {
        lineMap.set(index, [item]);
      }
    });

    // Merge items in the same line and search
    let lineIndex = 0;
    lineMap.forEach((items, itemKey) => {
      // Sort items by x-coordinate
      items.sort((a, b) => a.transform[4] - b.transform[4]);
      // Merge text from same line
      const lineText = items
        .map((item) => item.str)
        .join("")
        .toLowerCase();

      if (lineText.indexOf(keyword.toLowerCase()) > -1) {
        searchResult.push({
          excerpt: lineText,
          cfi: JSON.stringify({
            text: lineText + "#" + i + "#" + itemKey,
            chapterTitle: chapterDocList[i].label,
            chapterDocIndex: i,
            chapterHref: chapterDocList[i].href,
            count: "search",
            percentage: i / chapterDocList.length,
            keyword: keyword,
          }),
        });
      }
      lineIndex++;
    });
  }
  return searchResult;
};
export const handleIOSScrollPage = async (
  element: HTMLElement,
  animation: string,
  delta: number,
  doc: Document,
  flipToNextPage: () => void,
  flipToPrevPage: () => void,
  isMobile: string | undefined,
  chapterDocIndex: number,
  readerMode: string
) => {
  let section = Math.floor(doc.body.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = doc.body.clientWidth;
  playMimicalFlip(animation, isMobile, delta, flipToNextPage, flipToPrevPage);

  if (delta > 0) {
    // previous page
    if (readerMode === "single") {
      let subContainer = doc.querySelector(
        "#pdf-container-" + (chapterDocIndex - 1)
      );
      if (subContainer) {
        subContainer.scrollIntoView();
      }
    } else {
      doc.body.scrollBy(-(width + gap) / 2, 0);
    }
  } else if (delta < 0) {
    // next page
    if (readerMode === "single") {
      let subContainer = doc.querySelector(
        "#pdf-container-" + (chapterDocIndex + 1)
      );
      if (subContainer) {
        subContainer.scrollIntoView();
      }
    } else {
      doc.body.scrollBy((width + gap) / 2, 0);
    }
  }
};
export const convertPageToImage = async (page) => {
  const desiredWidth = 800;
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = desiredWidth;
  canvas.height = (desiredWidth / viewport.width) * viewport.height;
  const renderContext = {
    canvasContext: context,
    viewport: page.getViewport({ scale: desiredWidth / viewport.width }),
  };
  await page.render(renderContext).promise;
  const imageURL = canvas.toDataURL("image/jpeg", 0.8);
  const size = calculateSize(imageURL);
  return { imageURL, size };
};
function calculateSize(imageURL) {
  const base64Length = imageURL.length - "data:image/jpeg;base64,".length;
  const sizeInBytes = Math.ceil(base64Length * 0.75);
  return sizeInBytes;
}

function formatSize(size) {
  const sizeInKB = (size / 1024).toFixed(2);
  return `${sizeInKB} KB`;
}

export const showOCRProgress = (progress: number) => {
  let bar = document.getElementById("ocr-progress-bar") as HTMLProgressElement;
  if (!bar) {
    bar = document.createElement("progress");
    bar.id = "ocr-progress-bar";
    bar.max = 1;
    bar.value = 0;
    bar.style.position = "fixed";
    bar.style.top = "10px";
    bar.style.left = "50%";
    bar.style.transform = "translateX(-50%)";
    bar.style.width = "300px";
    bar.style.zIndex = "9999";
    document.body.appendChild(bar);
  }

  bar.value = progress;
  if (progress >= 1) {
    setTimeout(() => {
      bar.remove();
    }, 1000);
  }
};
export const getTextFromPDFPage = async (
  chapterDoc: any,
  titleSizeValue: number = 1.2,
  paraSpacingValue: number = 1.5
) => {
  let textContent = await chapterDoc.text.getTextContent();
  let paraList: any[] = [];

  if (typeof textContent === "string") {
    paraList = textContent
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => ({ text: line, isBold: false }));
  } else if (
    textContent &&
    textContent.items &&
    Array.isArray(textContent.items)
  ) {
    // 先收集所有字体大小，确定基础大小和最大大小
    // 先收集所有字体大小，确定基础大小和最大大小
    const fontSizes = textContent.items
      .filter((item: any) => item.str && item.transform)
      .map((item: any) => item.transform[3]);
    let baseFontSize = 10;
    if (fontSizes.length > 0) {
      // 计算字体大小的众数（出现频率最高的值）
      const fontSizeCount = fontSizes.reduce(
        (acc, size) => {
          acc[size] = (acc[size] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>
      );

      baseFontSize = Object.keys(fontSizeCount)
        .map(Number)
        .reduce((a, b) => (fontSizeCount[a] > fontSizeCount[b] ? a : b));
    }

    // const maxFontSize = Math.max(...fontSizes);
    // const fontSizeRange = maxFontSize - Number(baseFontSize);

    let currentPara: any = {
      text: "",
      styles: new Set(),
      y: 0,
      tag: "p",
    };
    let lastY = 0;
    textContent.items.forEach((item: any) => {
      if (item.str) {
        // 检测段落分隔（基于Y坐标变化）
        const yDiff = Math.abs(item.transform[5] - lastY);
        const fontSize = item.transform[3];

        // 根据字体大小确定样式，都用p标签，大字体用bold
        let tag = "p";
        let isBold = fontSize > Number(baseFontSize) * titleSizeValue;

        // 如果Y坐标变化较大，认为是新段落
        if (yDiff > item.height * paraSpacingValue && currentPara.text.trim()) {
          paraList.push(currentPara);
          currentPara = {
            text: "",
            styles: new Set(),
            y: item.transform[5],
            tag: tag,
            isBold: isBold,
          };
        } else if (!currentPara.hasOwnProperty("isBold")) {
          // 如果当前段落还没有确定样式，使用当前item的样式
          currentPara.isBold = isBold;
        }

        // 包装文本
        const wrappedText = item.str;

        // 换行时用空格连接，而不是分段
        if (item.hasEOL) {
          // 如果是用了连接符（如连字符），直接拼接，不加空格
          if (wrappedText.endsWith("-")) {
            currentPara.text += wrappedText.slice(0, -1);
          } else {
            // CJK 语言换行时不加空格，其他语言加空格
            const lang = detectLocalLanguage(wrappedText + currentPara.text);
            if (lang === "zh" || lang === "ja" || lang === "ko") {
              currentPara.text += wrappedText;
            } else {
              currentPara.text += wrappedText + " ";
            }
          }
        } else {
          currentPara.text += wrappedText;
        }

        lastY = item.transform[5];
      }
    });

    // 添加最后一个段落
    if (currentPara.text.trim()) {
      paraList.push(currentPara);
    }
  }

  return paraList;
};
