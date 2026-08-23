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
    `margin: 0px !important; padding: 0px !important;`
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

  // PDF 渲染时相邻 <p>/<span> 节点的 textContent 直接拼接会丢失空格，
  // 需要在节点之间补充空格以匹配 getTextFromPDFPage 返回的正常文本。
  // 对两侧都做归一化（\s+ → 空格）后搜索，并用归一化后的 ranges 定位节点。
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const normalizedText = normalize(text);

  // 先逐节点归一化
  const normalizedNodes = nodes.map((n) =>
    normalize((n as HTMLElement).textContent || "")
  );

  // 再拼接并记录区间（相邻节点无空格时补一个）
  let total = "";
  const ranges: { start: number; end: number }[] = [];

  // 检测是否为 CJK 语言，CJK 语言节点间不需要加空格
  const lang = detectLocalLanguage(normalizedText);
  const isCJK = lang === "zh" || lang === "ja" || lang === "ko";

  for (let i = 0; i < normalizedNodes.length; i++) {
    const t = normalizedNodes[i];
    if (!t) {
      ranges.push({ start: total.length, end: total.length });
      continue;
    }
    // CJK 语言不加空格，其他语言在节点间补空格
    if (!isCJK && total.length > 0 && total[total.length - 1] !== " " && t[0] !== " ") {
      total += " ";
    }
    const start = total.length;
    total += t;
    ranges.push({ start, end: total.length });
  }

  const pos = total.indexOf(normalizedText);
  if (pos === -1) return [];

  const endPos = pos + normalizedText.length;

  // 找出所有与 [pos, endPos) 有交集的连续 node
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    if (end > pos && start < endPos) {
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
