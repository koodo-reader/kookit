import ChapterDoc from "../model/chapterDoc";
import {
  convertComputedNum,
  convertStyleNum,
  getActualOffsetLeft,
  getActualOffsetTop,
  getContentOffsetLeft,
  getContentOffsetTop,
  getLogicalHorizontalScroll,
  getScrollLeftForContentOffset,
  getScrollLeftForLogical,
  handleIframeHeight,
  handleOneChapterDoc,
  isVerticalLayout,
  waitForFontsReady,
  progressInfo,
  snapScrollOffsetToSpreadStart,
} from "./layoutUtil";
import Chapter from "../model/chapter";
import Chinese from "../libs/zh-convert";
import _ from "underscore";
import { cleanText } from "../libs/textProcessor";
import {
  getBlockElement,
  getPageWidth,
  getSectionGap,
  getStylePxNumber,
  getViewportSize,
  isParentBlock,
  mergeStyleStrings,
  PAGE_TURN_DURATION,
} from "./common";
import { MIMICAL_FLIP_END_EVENT } from "./animationUtil";

declare var window: any;

let lock = false;

export const getXPathForNode = (node: Node, doc: Document): string => {
  if (!node || !doc || !doc.body) return "";
  const parts: string[] = [];
  let current: Node | null = node;
  while (current && current !== doc.body && current !== doc) {
    const parent = current.parentNode;
    if (!parent) break;
    if (current.nodeType === Node.TEXT_NODE) {
      current = parent;
      continue;
    }
    const el = current as Element;
    const tag = el.tagName.toLowerCase();
    const siblings = (Array.from(parent.childNodes) as ChildNode[]).filter(
      (n) =>
        n.nodeType === Node.ELEMENT_NODE &&
        (n as Element).tagName.toLowerCase() === tag
    );
    const index = siblings.indexOf(el as ChildNode) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}[${index}]` : tag);
    current = parent;
  }
  return "/body/" + parts.join("/");
};

export const resolveXPath = (xpath: string, doc: Document): Element | null => {
  if (!xpath || !doc || !doc.body) return null;
  try {
    // Strip leading /body/ prefix and resolve from body
    let path = xpath;
    if (path.startsWith("/body/")) {
      path = path.slice("/body/".length);
    } else if (path.startsWith("/body")) {
      return doc.body;
    }
    const segments = path.split("/").filter(Boolean);
    let current: Element = doc.body;
    for (const seg of segments) {
      const match = seg.match(/^([a-zA-Z0-9]+)(?:\[(\d+)\])?$/);
      if (!match) return null;
      const tag = match[1].toLowerCase();
      const idx = match[2] ? parseInt(match[2]) - 1 : 0;
      const children = Array.from(current.children).filter(
        (c) => c.tagName.toLowerCase() === tag
      );
      if (!children[idx]) return null;
      current = children[idx];
    }
    return current;
  } catch {
    return null;
  }
};

let mimicalFlipEndListener: (() => void) | null = null;
let mimicalFlipEndTimer: number | null = null;

const hideMimicalMask = () => {
  const bookDiv = document.getElementById("book");
  if (bookDiv) bookDiv.style.display = "none";
};

export const playMimicalFlip = (
  animation: string,
  isMobile: string | undefined,
  delta: number,
  flipToNextPage: () => void,
  flipToPrevPage: () => void
) => {
  if (animation !== "mimical" || isMobile === "yes") return false;
  const bookDiv = document.getElementById("book");
  if (!bookDiv) return false;
  bookDiv.style.display = "block";
  if (delta > 0) flipToPrevPage();
  else if (delta < 0) flipToNextPage();
  // 翻页动画收敛（flipend 事件）后立即隐藏遮罩恢复交互；
  // 1000ms 定时器兜底，防止边界页等未触发动画时遮罩常驻
  if (mimicalFlipEndListener) {
    window.removeEventListener(MIMICAL_FLIP_END_EVENT, mimicalFlipEndListener);
  }
  if (mimicalFlipEndTimer) {
    clearTimeout(mimicalFlipEndTimer);
    mimicalFlipEndTimer = null;
  }
  mimicalFlipEndListener = () => {
    if (mimicalFlipEndListener) {
      window.removeEventListener(
        MIMICAL_FLIP_END_EVENT,
        mimicalFlipEndListener
      );
      mimicalFlipEndListener = null;
    }
    if (mimicalFlipEndTimer) {
      clearTimeout(mimicalFlipEndTimer);
      mimicalFlipEndTimer = null;
    }
    hideMimicalMask();
  };
  window.addEventListener(MIMICAL_FLIP_END_EVENT, mimicalFlipEndListener);
  mimicalFlipEndTimer = window.setTimeout(() => {
    mimicalFlipEndTimer = null;
    if (mimicalFlipEndListener) {
      window.removeEventListener(
        MIMICAL_FLIP_END_EVENT,
        mimicalFlipEndListener
      );
      mimicalFlipEndListener = null;
    }
    hideMimicalMask();
  }, 1000);
  return true;
};

let pageTurnAnimationId: number | null = null;
let pageTurnAnimationResolve: (() => void) | null = null;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const finishPageTurnAnimation = () => {
  pageTurnAnimationId = null;
  if (pageTurnAnimationResolve) {
    pageTurnAnimationResolve();
    pageTurnAnimationResolve = null;
  }
};

// 原生 smooth 滚动的时长由浏览器决定且偏慢，改用固定时长动画
export const animateScrollTo = (
  element: HTMLElement,
  left: number,
  top: number
) => {
  if (pageTurnAnimationId !== null) {
    cancelAnimationFrame(pageTurnAnimationId);
  }
  if (pageTurnAnimationResolve) {
    pageTurnAnimationResolve();
    pageTurnAnimationResolve = null;
  }
  pageTurnAnimationId = null;

  const startLeft = element.scrollLeft;
  const startTop = element.scrollTop;
  const distanceLeft = left - startLeft;
  const distanceTop = top - startTop;
  if (Math.abs(distanceLeft) < 0.5 && Math.abs(distanceTop) < 0.5) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    pageTurnAnimationResolve = resolve;
    let startTime: number | null = null;
    const step = (now: number) => {
      if (!element.isConnected) {
        finishPageTurnAnimation();
        return;
      }
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / PAGE_TURN_DURATION);
      const eased = easeOutCubic(progress);
      element.scrollLeft = startLeft + distanceLeft * eased;
      element.scrollTop = startTop + distanceTop * eased;
      if (progress < 1) {
        pageTurnAnimationId = requestAnimationFrame(step);
      } else {
        element.scrollLeft = left;
        element.scrollTop = top;
        finishPageTurnAnimation();
      }
    };
    pageTurnAnimationId = requestAnimationFrame(step);
  });
};

export const handleScrollPage = async (
  element: HTMLElement,
  animation: string,
  delta: number,
  doc: Document,
  flipToNextPage: () => void,
  flipToPrevPage: () => void,
  isMobile: string | undefined
) => {
  const vertical = isVerticalLayout();
  const sliding = animation === "sliding" && isMobile !== "yes";
  const scrollToPage = async (left: number, top: number) => {
    if (sliding) {
      await animateScrollTo(doc.body, left, top);
    } else {
      doc.body.scrollTo({ left, top, behavior: "auto" });
    }
  };
  playMimicalFlip(animation, isMobile, delta, flipToNextPage, flipToPrevPage);
  if (vertical) {
    let gap = getSectionGap(element.clientHeight);
    const height = element.clientHeight;
    const currentScrollTop = doc.body.scrollTop;
    const scrollDistance = height + gap;

    if (delta > 0) {
      const currentPage = Math.round(currentScrollTop / scrollDistance);
      const targetPage = Math.max(0, currentPage - 1);
      const targetScrollTop = targetPage * scrollDistance;
      await scrollToPage(0, targetScrollTop);
    } else if (delta < 0) {
      const currentPage = Math.round(currentScrollTop / scrollDistance);
      const targetPage = currentPage + 1;
      const targetScrollTop = targetPage * scrollDistance;
      await scrollToPage(0, targetScrollTop);
    }
  } else {
    let gap = getSectionGap(element.clientWidth);
    const width = element.clientWidth;
    const currentScrollLeft = getLogicalHorizontalScroll(doc.body);
    const scrollDistance = width + gap;

    if (delta > 0) {
      const currentPage = Math.round(currentScrollLeft / scrollDistance);
      const targetPage = Math.max(0, currentPage - 1);
      const targetScrollLeft = getScrollLeftForLogical(
        doc.body,
        targetPage * scrollDistance
      );
      await scrollToPage(targetScrollLeft, 0);
    } else if (delta < 0) {
      const currentPage = Math.round(currentScrollLeft / scrollDistance);
      const targetPage = currentPage + 1;
      const targetScrollLeft = getScrollLeftForLogical(
        doc.body,
        targetPage * scrollDistance
      );
      await scrollToPage(targetScrollLeft, 0);
    }
  }
};
const findValidChapter = (
  chapterDocIndex: number,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  flag: string
) => {
  let currentChapterIndex = _.findLastIndex(chapterDocList, (chapter) => {
    return (
      chapter.href === chapterHref ||
      (chapter.href &&
        chapter.href.includes("#") &&
        chapter.href.includes(chapterHref))
    );
  });
  if (
    chapterHref &&
    _.findLastIndex(chapterDocList, (chapter) => {
      return (
        chapter.href === chapterHref ||
        (chapter.href &&
          chapter.href.includes("#") &&
          chapter.href.includes(chapterHref))
      );
    }) > -1
  ) {
    //nothing
  } else {
    currentChapterIndex = chapterDocIndex;
  }
  if (flag === "prev") {
    return {
      ...chapterDocList[currentChapterIndex - 1],
      index: currentChapterIndex - 1,
    };
  } else {
    return {
      ...chapterDocList[currentChapterIndex + 1],
      index: currentChapterIndex + 1,
    };
  }
};
export const handlePrevChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  let chapterDocIndex = parseInt(tempLocation.chapterDocIndex || "0");
  let chapterHref = tempLocation.chapterHref || "";
  if (chapterDocIndex === 0) {
    return;
  }
  let prevChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    chapterDocList,
    "prev"
  );
  if (!prevChapter) return;

  tempLocation.text = "prevChapter";
  tempLocation.page = "";
  await handleRenderChapter(
    prevChapter.index,
    prevChapter.label,
    prevChapter.href,
    chapterDocList,
    element,
    readerMode,
    format,
    tempLocation,
    doc,
    iframe
  );
};
export const isFootnoteReference = (element: HTMLElement) => {
  if (!element || !element.getAttribute) return false;
  const typeToken = (
    (element.getAttribute("epub:type") || "") +
    " " +
    (element.getAttribute("role") || "")
  ).toLowerCase();
  return typeToken
    .split(/[\s;]+/)
    .some((token) => token === "noteref" || token === "doc-noteref");
};
const isFootnoteBacklink = (element: HTMLElement) => {
  if (!element || element.tagName !== "A" || !element.getAttribute) {
    return false;
  }
  const href = element.getAttribute("href") || "";
  const index = href.lastIndexOf("#");
  if (index === -1) return false;
  const id = href.substring(index + 1);
  if (!id) return false;
  const doc = element.ownerDocument;
  const target = doc && doc.getElementById ? doc.getElementById(id) : null;
  if (!target || target === element || target.contains(element)) {
    return false;
  }
  // 返回链接指向的是正文中的脚注标记（noteref），不是注释内容
  if (isFootnoteReference(target)) return true;
  const next = (target as HTMLElement).nextElementSibling;
  if (next && isFootnoteReference(next as HTMLElement)) return true;
  if (!target.querySelectorAll) return false;
  const references = target.querySelectorAll("a");
  for (let index = 0; index < references.length; index++) {
    if (isFootnoteReference(references[index] as HTMLElement)) {
      return true;
    }
  }
  return false;
};
export const isElementFootnote = (element: HTMLElement) => {
  if (!element) return false;
  if (element.tagName === "IMG") {
    return true;
  }
  if (isFootnoteReference(element)) {
    return true;
  }
  if (isFootnoteBacklink(element)) {
    return false;
  }
  if (element.textContent) {
    let textContent = element.textContent.trim();
    return isContentFootnote(textContent);
  }

  return false;
};
export const isContentFootnote = (content: string) => {
  if (!content) return false;
  if (content.trim().length > 10) return false;
  let textContent = content.trim();
  // Check for patterns like [1], [a], (1), (a), 〔2〕, 【3】, 〈4〉, 《5》, roman numerals, and circled numbers (①-㊿)
  const footnotePattern =
    /^(\[|\(|〔|【|〈|《|〚)([a-zA-Z0-9零一二三四五六七八九十百千万]+)(\]|\)|〕|】|〉|》|〛)$|^\d+$|^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$|^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]$/i;
  if (footnotePattern.test(textContent)) {
    return true;
  }
  // Check for markers like {1}, {a} and [[n]] used by some books
  if (
    /^(\{|\[\[)[a-zA-Z0-9零一二三四五六七八九十百千万]+(\}|\]\])$/.test(
      textContent
    )
  ) {
    return true;
  }
  if (
    textContent.toLowerCase().indexOf("footnote") > -1 ||
    textContent.toLowerCase().indexOf("脚注") > -1 ||
    textContent.toLowerCase().indexOf("注释") > -1 ||
    textContent.toLowerCase().indexOf("注") > -1 ||
    textContent.toLowerCase().indexOf("fn") > -1
  ) {
    return true;
  }
  if (
    textContent === "*" ||
    textContent === "†" ||
    textContent === "‡" ||
    textContent === "※" ||
    textContent === "§"
  ) {
    return true;
  }
  return false;
};
export const processHtml = async (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images: any[] = Array.from(doc.getElementsByTagName("img"));
  for (const img of images) {
    if (img.src && img.src.startsWith("blob:")) {
      try {
        const dataUrl = await convertBlobToDataURL(img.src);
        img.src = dataUrl;
        img.style.maxWidth = "100%"; // 确保图片不会超出容器宽度
      } catch (error) {
        console.error("Error converting blob to data URL:", error);
      }
    }
  }
  return doc.body.innerHTML;
};
const convertBlobToDataURL = async (blobUrl) => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
// 目录里的章节名和正文标题可能只差空白（例如「第 八 章　　往事不可追」
// 和「第八章　往事不可追」），匹配章节时忽略空白差异
const isSameChapterLabel = (label: string, title: string) => {
  if (!label || !title) return false;
  return (
    label.trim() === title.trim() ||
    label.replace(/\s/g, "") === title.replace(/\s/g, "")
  );
};
export const handleRenderChapter = async (
  chapterDocIndex: number,
  chapterTitle: string,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  doc.body.innerHTML = "";
  iframe.height = 0 + "px";
  doc.body.scrollTo(0, 0);
  if (
    // 序号为 0 时只有标题和首章对不上才按标题重找，避免同名章节
    // （例如不同分卷都叫“第一章”）被重定向到最后一处
    (chapterTitle &&
      !chapterDocIndex &&
      (!chapterDocList[chapterDocIndex] ||
        !chapterDocList[chapterDocIndex].label ||
        !isSameChapterLabel(
          chapterDocList[chapterDocIndex].label,
          chapterTitle
        ))) ||
    (chapterTitle &&
      (!chapterDocList[chapterDocIndex] ||
        (chapterDocList[chapterDocIndex].label &&
          !isSameChapterLabel(
            chapterDocList[chapterDocIndex].label,
            chapterTitle
          ) &&
          chapterHref.indexOf("#") === -1)))
  ) {
    let tempChapterDocIndex = _.findLastIndex(chapterDocList, (chapter) =>
      isSameChapterLabel(chapter.label, chapterTitle)
    );
    if (tempChapterDocIndex !== -1) {
      chapterDocIndex = tempChapterDocIndex;
    }
  }
  if (chapterDocIndex === -1 && chapterHref.indexOf("#") > -1) {
    let href = chapterHref.split("#")[0];
    let tempChapterDocIndex = _.findLastIndex(chapterDocList, (chapter) => {
      return (
        chapter.href === href ||
        (chapter.href &&
          chapter.href.includes("#") &&
          chapter.href.includes(href))
      );
    });
    if (tempChapterDocIndex !== -1) {
      chapterDocIndex = tempChapterDocIndex;
    }
  }
  if (chapterDocIndex === -1 || chapterDocIndex > chapterDocList.length - 1) {
    chapterDocIndex = 0;
  }
  let chapterText = await handleOneChapterDoc(
    chapterDocList[chapterDocIndex].text,
    false
  );
  let bodyAttrs = getBodyAttributes(chapterText);
  const viewport = getViewportSize(chapterText);
  doc.body.innerHTML = chapterText;
  // Apply body attrs without duplicating style on re-render
  if (bodyAttrs["class"]) {
    doc.body.setAttribute("class", bodyAttrs["class"]);
  } else {
    doc.body.removeAttribute("class");
  }
  if (bodyAttrs["id"]) {
    doc.body.setAttribute("id", bodyAttrs["id"]);
  } else {
    doc.body.removeAttribute("id");
  }

  let baseStyle = doc.body.getAttribute("style") || "";
  // Remove transform and transform-origin from baseStyle to avoid stale values
  if (baseStyle) {
    baseStyle = baseStyle
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !/^transform(-origin)?\s*:/i.test(s))
      .join("; ");
    if (baseStyle) baseStyle += ";";
  }
  const incomingStyle = (bodyAttrs as any)["style"] || "";
  const mergedStyle = mergeStyleStrings(baseStyle, incomingStyle);

  // If chapter specifies a fixed viewport size, scale down to fit both page width
  // and iframe height so the whole page is visible (e.g. pdf2html fixed layout).
  const chapterFixedWidth =
    viewport?.width || getStylePxNumber(incomingStyle, "width");
  const chapterFixedHeight =
    viewport?.height || getStylePxNumber(incomingStyle, "height");
  if (chapterFixedWidth && chapterFixedHeight) {
    const pageWidth = getPageWidth(element, readerMode);
    const iframeHeight = iframe?.getBoundingClientRect().height;
    const availableHeight =
      iframeHeight > 0 ? iframeHeight : element.clientHeight;
    if (
      pageWidth > 0 &&
      availableHeight > 0 &&
      getStylePxNumber(mergedStyle, "width") &&
      getStylePxNumber(mergedStyle, "width") !== element.clientWidth
    ) {
      const widthRatio = pageWidth / chapterFixedWidth;
      const heightRatio = availableHeight / chapterFixedHeight;
      const scaleValue = Math.min(1, widthRatio, heightRatio);
      const scaledStyle = mergeStyleStrings(
        mergedStyle,
        `transform: scale(${scaleValue}); transform-origin: left top;`
      );
      doc.body.setAttribute("style", scaledStyle);
      doc.body.setAttribute("data-kookit-fixed-scale", "true");
    } else {
      doc.body.setAttribute("style", mergedStyle);
      doc.body.removeAttribute("data-kookit-fixed-scale");
    }
  } else if (mergedStyle) {
    doc.body.setAttribute("style", mergedStyle);
    doc.body.removeAttribute("data-kookit-fixed-scale");
  } else {
    doc.body.removeAttribute("style");
    doc.body.removeAttribute("data-kookit-fixed-scale");
  }
  await handleCssLink(doc);
  await handlePlainText(doc);
  await waitForFontsReady(doc);
  if (!chapterTitle) {
    //取前面最近的章节，且存在的标题
    let tempChapterDocIndex = chapterDocIndex;
    while (tempChapterDocIndex >= 0) {
      if (chapterDocList[tempChapterDocIndex].label) {
        chapterTitle = chapterDocList[tempChapterDocIndex].label;
        break;
      }
      tempChapterDocIndex--;
    }
  }
  tempLocation.chapterTitle = chapterTitle;
  tempLocation.chapterHref = chapterHref;
  tempLocation.chapterDocIndex = chapterDocIndex + "";
  tempLocation.percentage =
    chapterDocList
      .slice(0, chapterDocIndex)
      .map((item) => (item.text ? item.text.size || 1 : 1))
      .reduce((a, b) => a + b, 0) /
      chapterDocList
        .map((item) => (item.text ? item.text.size || 1 : 1))
        .reduce((a, b) => a + b, 0) +
    "";
  tempLocation.text = "";
  tempLocation.xpath = `/body/DocFragment[${chapterDocIndex + 1}]`;
  tempLocation.timestamp = parseInt(new Date().getTime() / 1000 + "");
  await handleIframeHeight(element, readerMode, format, iframe, doc);
  await handleScrollPosition(element, readerMode, "", "", "", "", doc);
};

export function getBodyAttributes(htmlStr: string) {
  // 匹配 <body> 开始标签（忽略大小写）
  const bodyTagMatch = htmlStr.match(/<body\b([^>]*)>/i);
  if (!bodyTagMatch) return {};

  // 提取属性字符串（如 'id="main" class=dark'）
  const attrStr = bodyTagMatch[1];
  const attributes = {};

  // 匹配属性键值对
  const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/g;
  let match;

  while ((match = attrRegex.exec(attrStr)) !== null) {
    const value = match[2] || match[3] || match[4] || "";
    attributes[match[1]] = value;
  }

  return attributes;
}

export const handleCssLink = async (doc) => {
  let linkList = Array.from(doc.getElementsByTagName("link"));
  if (linkList.length === 0) {
    return;
  }
  // 样式表未加载完就测量段落偏移，会按旧列布局定位，导致进度偏出一页，
  // 因此这里等 load/error 事件（已加载过的通过 link.sheet 直接跳过），
  // 异常样式表最多等待 500ms，不阻塞章节渲染。
  await Promise.all(
    linkList.map((link: any) => {
      if (!link.href || link.href.endsWith("null") || link.sheet) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const done = () => resolve("");
        link.addEventListener("load", done, { once: true });
        link.addEventListener("error", done, { once: true });
        setTimeout(done, 500);
      });
    })
  );
};
export const handlePlainText = async (doc) => {
  //给body中不被任何标签包裹的文本加上p标签
  let childNodes = Array.from(doc.body.childNodes);
  for (let i = 0; i < childNodes.length; i++) {
    let node: any = childNodes[i];
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      let p = doc.createElement("p");
      p.textContent = node.textContent;
      p.style.display = "inline";
      doc.body.replaceChild(p, node);
    }
  }
};
export const handleScrollPosition = async (
  element: HTMLElement,
  readerMode: string,
  text: string,
  count: string,
  href: string,
  page: string,
  doc: Document
) => {
  let left = 0;
  let top = 0;
  let targetNode: any = doc.body;
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (page && readerMode !== "scroll") {
    if (vertical) {
      let gap = getSectionGap(element.clientHeight);
      let pageHeight = element.clientHeight + gap;
      top = pageHeight * (parseInt(page) - 1);
    } else {
      let gap = getSectionGap(element.clientWidth);
      const width = convertComputedNum(getComputedStyle(element).width);
      let pageWidth = width + gap;
      left = getScrollLeftForLogical(
        doc.body,
        pageWidth * (parseInt(page) - 1)
      );
    }
  } else if (text) {
    let nodeList = getBlockElement(doc.body);
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        cleanText((s as HTMLElement).textContent) &&
        (cleanText((s as HTMLElement).textContent).includes(cleanText(text)) ||
          cleanText((s as HTMLElement).textContent).includes(
            Chinese.t2s(cleanText(text))
          ) ||
          cleanText((s as HTMLElement).textContent).includes(
            Chinese.s2t(cleanText(text))
          )) &&
        (Math.abs(index - parseInt(count)) <
          (window.fullTranslationMode === "both" ||
          window.fullTranslationMode === "target"
            ? 1
            : 2) ||
          count === "search" ||
          count === "ignore" ||
          count === "next")
      );
    });
    if (targetNodeList.length === 0) {
      return;
    }
    targetNode = getCloestBlock(targetNodeList[0], element, readerMode);
    if (vertical) {
      top = targetNode
        ? getContentOffsetTop(targetNode) -
          convertStyleNum(
            targetNode.marginTop ||
              parseFloat(getComputedStyle(targetNode).marginTop)
          )
        : text === "prevChapter"
          ? doc.body.scrollHeight
          : 0;
    } else {
      left = targetNode
        ? getScrollLeftForContentOffset(
            doc.body,
            getContentOffsetLeft(targetNode) -
              convertStyleNum(
                targetNode.marginLeft ||
                  parseFloat(getComputedStyle(targetNode).marginLeft)
              )
          )
        : text === "prevChapter"
          ? doc.body.scrollWidth
          : 0;
    }
  } else if (href && href.indexOf("#") > -1) {
    let id = CSS.escape(href.split("#").reverse()[0]);
    if (!doc.body.querySelector("#" + CSS.escape(id))) {
      return;
    }
    targetNode = getCloestBlock(
      doc.body.querySelector("#" + CSS.escape(id)) || doc.body,
      element,
      readerMode
    );
    if (vertical) {
      top = targetNode
        ? getContentOffsetTop(targetNode) -
          convertStyleNum(
            targetNode.marginTop ||
              parseFloat(getComputedStyle(targetNode).marginTop)
          )
        : 0;
    } else {
      left = targetNode
        ? getScrollLeftForContentOffset(
            doc.body,
            getContentOffsetLeft(targetNode) -
              convertStyleNum(
                targetNode.marginLeft ||
                  parseFloat(getComputedStyle(targetNode).marginLeft)
              )
          )
        : 0;
    }
  }
  if (readerMode !== "scroll") {
    if (vertical) {
      top = snapScrollOffsetToSpreadStart(element, readerMode, top);
      doc.body.scrollTo(0, top);
    } else {
      left = snapScrollOffsetToSpreadStart(element, readerMode, left);
      doc.body.scrollTo(left, 0);
    }
  } else {
    targetNode.scrollIntoView();
  }
};

export const getCloestBlock = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode: string
) => {
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (readerMode === "scroll") {
    return targetNode;
  }
  if (vertical) {
    let gap = getSectionGap(element.clientHeight);
    let offsetTop =
      getContentOffsetTop(targetNode) -
      convertStyleNum(
        (targetNode as any).marginTop ||
          parseFloat(getComputedStyle(targetNode).marginTop)
      );
    if (
      checkDivisibleInRange(
        parseInt(offsetTop + ""),
        (element.clientHeight + gap) / 2
      )
    ) {
      return targetNode;
    } else if (targetNode.parentElement) {
      return getCloestBlock(targetNode.parentElement, element, readerMode);
    } else {
      return targetNode;
    }
  } else {
    let gap = getSectionGap(element.clientWidth);
    let offsetLeft =
      getContentOffsetLeft(targetNode) -
      convertStyleNum(
        (targetNode as any).marginLeft ||
          parseFloat(getComputedStyle(targetNode).marginLeft)
      );
    if (
      checkDivisibleInRange(
        parseInt(offsetLeft + ""),
        (element.clientWidth + gap) / 2
      )
    ) {
      return targetNode;
    } else if (targetNode.parentElement) {
      return getCloestBlock(targetNode.parentElement, element, readerMode);
    } else {
      return targetNode;
    }
  }
};
const checkDivisibleInRange = (x: number, y: number): boolean => {
  for (let i = x - 10; i <= x + 10; i++) {
    if (i % y === 0) {
      return true;
    }
  }
  return false;
};
export const handleRecord = async (
  element: HTMLElement,
  readerMode: string,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  tempLocation: any,
  doc: Document,
  targetNode: HTMLElement | null
): Promise<boolean> => {
  if (lock) return false;
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  let firstVisibleNode: any = visibleNode[0] as HTMLElement;
  if (targetNode) {
    firstVisibleNode = targetNode;
  }
  let count = 0;
  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], readerMode) &&
      firstVisibleNode &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML
    ) {
      count = i;
      break;
    }
  }
  handleHashChapter(visibleNode, flattenChapters, tempLocation);
  if (
    firstVisibleNode &&
    !isCurrentNodeFarFromParrent(firstVisibleNode, element, readerMode)
  ) {
    tempLocation.text = firstVisibleNode.textContent.substring(0, 200) || "";
    tempLocation.count = count + "";
    tempLocation.page = "";
    tempLocation.xpath =
      `/body/DocFragment[${parseInt(tempLocation.chapterDocIndex) + 1}]` +
      getXPathForNode(firstVisibleNode, doc);
    tempLocation.timestamp = parseInt(new Date().getTime() / 1000 + "");
    let totalSize = chapterDocList
      .map((item) => (item.text ? item.text.size || 1 : 1))
      .reduce((a, b) => a + b, 0);
    tempLocation.percentage =
      chapterDocList
        .slice(0, parseInt(tempLocation.chapterDocIndex))
        .map((item) => (item.text ? item.text.size || 1 : 1))
        .reduce((a, b) => a + b, 0) /
        totalSize +
      ((chapterDocList.find(
        (_item, index) => index === parseInt(tempLocation.chapterDocIndex)
      )?.text.size || 0) /
        totalSize) *
        (count / nodeList.length) +
      "";
  } else {
    tempLocation.page =
      (await progressInfo(readerMode, doc, element))?.currentPage + "";
  }

  lock = true;
  setTimeout(() => {
    lock = false;
  }, 100);
  return true;
};
export const isCurrentNodeFarFromParrent = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode
) => {
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (vertical) {
    let gap = getSectionGap(element.clientHeight);
    if (
      Math.abs(
        getActualOffsetTop(targetNode) -
          getActualOffsetTop(getCloestBlock(targetNode, element, readerMode))
      ) >
      (element.clientHeight + gap) / 2
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    let gap = getSectionGap(element.clientWidth);
    if (
      Math.abs(
        getActualOffsetLeft(targetNode) -
          getActualOffsetLeft(getCloestBlock(targetNode, element, readerMode))
      ) >
      (element.clientWidth + gap) / 2
    ) {
      return true;
    } else {
      return false;
    }
  }
};
export const handleHashChapter = (
  visibleNode,
  flattenChapters,
  tempLocation
) => {
  let chapterHref = tempLocation.chapterHref || "";
  let lastIndexOfHash = chapterHref.lastIndexOf("#");
  let beforeHash = "";
  if (lastIndexOfHash === -1) {
    beforeHash = chapterHref;
  } else {
    beforeHash = chapterHref.substring(0, lastIndexOfHash);
  }
  for (let index = 0; index < visibleNode.length; index++) {
    const element = visibleNode[index];
    if (element.id) {
      let newHref = beforeHash + "#" + element.id;
      let newIndex = _.findLastIndex(flattenChapters, {
        href: newHref,
      });
      if (newIndex > -1) {
        tempLocation.chapterHref = newHref;
        tempLocation.chapterTitle = flattenChapters[newIndex].label;
      }
    }
  }
};
export const handleNextChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  let chapterDocIndex = parseInt(tempLocation.chapterDocIndex || "0");
  let chapterHref = tempLocation.chapterHref || "";
  if (chapterDocIndex >= chapterDocList.length - 1) {
    tempLocation.percentage = "1";
    return;
  }
  let nextChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    chapterDocList,
    "next"
  );
  if (!nextChapter) return;
  tempLocation.page = "";
  await handleRenderChapter(
    nextChapter.index,
    nextChapter.label,
    nextChapter.href,
    chapterDocList,
    element,
    readerMode,
    format,
    tempLocation,
    doc,
    iframe
  );
};
export const getAudioText = (
  element: HTMLElement,
  readerMode: string,
  doc: Document,
  isBackground: boolean
) => {
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );
  let audioNode = nodeList.filter((s) => {
    // 检查文本内容是否存在且不为空
    if (!((s as HTMLElement).textContent || "").trim()) {
      return false;
    }

    // 检查是否有父级块元素（排除body）
    let parent = s.parentElement;
    while (parent && parent !== doc.body) {
      // 如果父级元素也在nodeList中，说明当前元素是嵌套的
      if (nodeList.includes(parent)) {
        return false;
      }
      parent = parent.parentElement;
    }

    return true;
  });
  let audioText = audioNode
    .filter(
      (item) =>
        item.textContent !== "img" && !item.textContent?.startsWith("img")
    )
    .map((item) => item.textContent);
  if (isBackground) {
    return audioText.filter((s) => s);
  }
  let firstSliceIndex = 0;
  let visibleText = getVisibleText(element, readerMode, doc);
  if (visibleText && visibleText.length > 0) {
    let trimmedVisibleText = visibleText.map((s) => s.trim());
    firstSliceIndex = audioText.findIndex((item) => {
      return item && trimmedVisibleText.includes(item.trim());
    });
  }
  if (firstSliceIndex === -1) {
    firstSliceIndex = 0;
  }

  return audioText.slice(firstSliceIndex).filter((s) => s);
};
// Android WebView may return empty getClientRects() for quotes; treat as visible when adjacent char is visible
const ZERO_WIDTH_QUOTE_CHARS = /["'\u201d\u2019」』]/;

const getTextSentences = (text: string, lang?: string) => {
  if (typeof (Intl as any).Segmenter === "undefined") {
    return [{ start: 0, end: text.length }];
  }
  const segmenter = new (Intl as any).Segmenter(lang, {
    granularity: "sentence",
  });
  const segments = segmenter.segment(text);
  return Array.from(segments)
    .map((s: any) => ({
      start: s.index as number,
      end: (s.index as number) + (s.segment as string).length,
    }))
    .filter(
      (sentence) => text.slice(sentence.start, sentence.end).trim() !== ""
    );
};

const snapRangeToSentences = (text: string, start: number, end: number) => {
  const lang = detectLocalLanguage(text);
  const sentences = getTextSentences(text, lang);
  if (sentences.length === 0) {
    return { start, end };
  }
  const overlapping = sentences.filter((s) => s.end > start && s.start < end);
  if (overlapping.length === 0) {
    return { start, end };
  }
  return {
    start: overlapping[0].start,
    end: overlapping[overlapping.length - 1].end,
  };
};

const isTextVisibleInViewport = (
  rect: DOMRect | ClientRect,
  element: HTMLElement,
  readerMode?: string
) => {
  // scroll 模式下，实际滚动的是外层容器（element.scrollTop），iframe 被拉伸到
  // 整篇内容高度且自身不滚动，因此 getBoundingClientRect() 返回的坐标是相对于
  // iframe 静态坐标系的，需要用 element.scrollTop 做偏移补偿，
  // 与 isScrolledIntoView 的 scroll 分支保持一致
  if (readerMode === "scroll") {
    const scrollTop = element.scrollTop;
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > scrollTop &&
      rect.top < scrollTop + element.clientHeight &&
      rect.right > 0 &&
      rect.left < element.clientWidth
    );
  }
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < element.clientHeight &&
    rect.right > 0 &&
    rect.left < element.clientWidth
  );
};

const isNodeVisibleInViewport = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode?: string
) => {
  const computedStyle = getComputedStyle(el);
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.opacity === "0"
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return isTextVisibleInViewport(rect, element, readerMode);
};

const isNodePartiallyVisibleInViewport = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode?: string
) => {
  if (!isNodeVisibleInViewport(element, el, readerMode)) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (readerMode === "scroll") {
    const scrollTop = element.scrollTop;
    return (
      rect.top < scrollTop ||
      rect.left < 0 ||
      rect.bottom > scrollTop + element.clientHeight ||
      rect.right > element.clientWidth
    );
  }
  return (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > element.clientHeight ||
    rect.right > element.clientWidth
  );
};

const getVisibleCharRange = (
  element: HTMLElement,
  root: HTMLElement,
  readerMode?: string
) => {
  const text = root.textContent || "";
  if (!text.trim()) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let offset = 0;
  let start = -1;
  let end = -1;

  while (currentNode) {
    const content = currentNode.textContent || "";
    if (content.length > 0) {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(currentNode);
      const nodeRects = Array.from(nodeRange.getClientRects());
      const nodeMayBeVisible = nodeRects.some((rect) =>
        isTextVisibleInViewport(rect, element, readerMode)
      );

      if (nodeMayBeVisible) {
        let prevCharVisible = false;
        for (let i = 0; i < content.length; i++) {
          const charRange = document.createRange();
          charRange.setStart(currentNode, i);
          charRange.setEnd(currentNode, i + 1);
          const charRects = Array.from(charRange.getClientRects());
          let visible = charRects.some((rect) =>
            isTextVisibleInViewport(rect, element, readerMode)
          );
          if (
            !visible &&
            prevCharVisible &&
            ZERO_WIDTH_QUOTE_CHARS.test(content[i])
          ) {
            visible = true;
          }

          if (visible) {
            if (start === -1) {
              start = offset + i;
            }
            end = offset + i + 1;
          }
          prevCharVisible = visible;
        }
      }
    }

    offset += content.length;
    currentNode = walker.nextNode();
  }

  if (start === -1 || end === -1) {
    return null;
  }

  return { start, end, text };
};
export const detectLocalLanguage = (text: string): string => {
  const chinesePattern = /[\u4e00-\u9fff\u3000-\u303f\uf900-\ufaff]/g;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/g;
  const koreanPattern = /[\uac00-\ud7af\u1100-\u11ff]/g;

  const chineseCount = (text.match(chinesePattern) || []).length;
  const japaneseCount = (text.match(japanesePattern) || []).length;
  const koreanCount = (text.match(koreanPattern) || []).length;

  const cjkTotal = chineseCount + japaneseCount + koreanCount;
  if (cjkTotal / text.length <= 0.3) return "en";

  if (chineseCount >= japaneseCount && chineseCount >= koreanCount) return "zh";
  if (japaneseCount >= chineseCount && japaneseCount >= koreanCount)
    return "ja";
  return "ko";
};
const getNodeVisibleText = (
  element: HTMLElement,
  item: HTMLElement,
  readerMode?: string
) => {
  const text = item.textContent || "";
  if (!text.trim()) {
    return text;
  }

  if (!isNodePartiallyVisibleInViewport(element, item, readerMode)) {
    return text;
  }

  const visibleRange = getVisibleCharRange(element, item, readerMode);
  if (!visibleRange) {
    return text;
  }

  const { start, end } = snapRangeToSentences(
    text,
    visibleRange.start,
    visibleRange.end
  );

  if (end <= start) {
    return text.substring(visibleRange.start, visibleRange.end);
  }

  return text.substring(start, end);
};

export const getVisibleText = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );

  let visibleNode = nodeList.filter(
    (s) =>
      isNodeVisibleInViewport(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  visibleNode = visibleNode.filter((s) => {
    // 检查文本内容是否存在且不为空
    if (!((s as HTMLElement).textContent || "").trim()) {
      return false;
    }

    // 检查是否有父级块元素（排除body）
    let parent = s.parentElement;
    while (parent && parent !== doc.body) {
      // 如果父级元素也在nodeList中，说明当前元素是嵌套的
      if (nodeList.includes(parent)) {
        return false;
      }
      parent = parent.parentElement;
    }

    return true;
  });
  return visibleNode
    .filter(
      (item) =>
        item.textContent !== "img" && !item.textContent?.startsWith("img")
    )
    .map((item) => getNodeVisibleText(element, item as HTMLElement, readerMode))
    .filter((s) => s);
};
export const handleHighlightSearchNode = (
  text: string,
  style: string,
  doc: Document
) => {
  // First remove any existing highlights
  const existingHighlights = doc.querySelectorAll(
    `span[data-highlight="true"]`
  );
  existingHighlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    if (parent) {
      parent.replaceChild(
        doc.createTextNode(highlight.textContent || ""),
        highlight
      );
    }
  });

  if (!text.trim()) return;

  // Get block elements and find those containing the target text (case insensitive)
  // 搜索端 getSearchResult 按 getBlockElement（含 pre/blockquote/li 等）匹配块级元素，
  // 高亮端必须使用同一套元素集合；此前硬编码 span/p/div/h1-h6 会漏掉 <pre> 等块，
  // 导致诗歌类内容能搜到却无法高亮
  let nodes = getBlockElement(doc.body).filter((node) => {
    const content = (node as HTMLElement).textContent || "";
    return (
      content.trim() && content.toLowerCase().indexOf(text.toLowerCase()) > -1
    );
  });

  // Process all matching nodes for global replacement
  nodes.forEach((node) => {
    wrapHighlightRangesAll(node, text, style, doc);
  });
};

// 搜索高亮：关键词可能被行内元素（斜体、换行、文本规则等）拆散到多个文本节点，
// 搜索端 getSearchResult 按块级 textContent 命中，高亮端必须同样按整块文本
// 定位全部命中区间，再逐节点拆分包裹，否则跨节点的关键词会搜得到却高亮不了
const wrapHighlightRangesAll = (
  root: Node,
  text: string,
  style: string,
  doc: Document
) => {
  const textNodes: Text[] = [];
  const offsets: number[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let content = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    offsets.push(content.length);
    textNodes.push(node);
    content += node.textContent || "";
  }

  // 与搜索端一致：大小写不敏感，收集整块文本中的全部命中区间
  const lowerContent = content.toLowerCase();
  const lowerText = text.toLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let index = lowerContent.indexOf(lowerText);
  while (index > -1) {
    matches.push({ start: index, end: index + text.length });
    index = lowerContent.indexOf(lowerText, index + Math.max(1, text.length));
  }
  if (matches.length === 0) return;

  // 每个文本节点只拆分一次，按落在自己区间内的命中片段依次包裹，
  // 避免先替换的节点让后续偏移失效
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const nodeContent = node.textContent || "";
    const nodeStart = offsets[i];
    const nodeEnd = nodeStart + nodeContent.length;
    const nodeMatches = matches.filter(
      (match) => match.start < nodeEnd && match.end > nodeStart
    );
    if (nodeMatches.length === 0) continue;

    const fragment = doc.createDocumentFragment();
    let cursor = nodeStart;
    nodeMatches.forEach((match) => {
      const from = Math.max(match.start, nodeStart);
      const to = Math.min(match.end, nodeEnd);
      if (from > cursor) {
        fragment.appendChild(
          doc.createTextNode(
            nodeContent.substring(cursor - nodeStart, from - nodeStart)
          )
        );
      }
      const highlightSpan = doc.createElement("span");
      highlightSpan.setAttribute("style", style);
      highlightSpan.setAttribute("data-highlight", "true");
      highlightSpan.setAttribute("class", "kookit-highlight-text");
      highlightSpan.textContent = nodeContent.substring(
        from - nodeStart,
        to - nodeStart
      );
      fragment.appendChild(highlightSpan);
      cursor = to;
    });
    if (cursor < nodeEnd) {
      fragment.appendChild(
        doc.createTextNode(nodeContent.substring(cursor - nodeStart))
      );
    }
    node.parentNode?.replaceChild(fragment, node);
  }
};
// 文本规则（替换/删除/高亮）、连字符标记等会把一个段落拆成多个文本节点，
// 因此按整块文本定位目标区间，再逐节点包裹，避免跨节点时找不到内容
const wrapHighlightRange = (
  root: Node,
  text: string,
  style: string,
  doc: Document
) => {
  const textNodes: Text[] = [];
  const offsets: number[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let content = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    offsets.push(content.length);
    textNodes.push(node);
    content += node.textContent || "";
  }

  const start = content.indexOf(text);
  if (start < 0) return;
  const end = start + text.length;

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const nodeContent = node.textContent || "";
    const nodeStart = offsets[i];
    const from = Math.max(start, nodeStart);
    const to = Math.min(end, nodeStart + nodeContent.length);
    if (from >= to) continue;

    const before = nodeContent.substring(0, from - nodeStart);
    const matched = nodeContent.substring(from - nodeStart, to - nodeStart);
    const after = nodeContent.substring(to - nodeStart);

    const highlightSpan = doc.createElement("span");
    highlightSpan.setAttribute("style", style);
    highlightSpan.setAttribute("data-highlight", "true");
    highlightSpan.setAttribute("class", "kookit-highlight-text");
    highlightSpan.textContent = matched;

    const fragment = doc.createDocumentFragment();
    if (before) fragment.appendChild(doc.createTextNode(before));
    fragment.appendChild(highlightSpan);
    if (after) fragment.appendChild(doc.createTextNode(after));

    node.parentNode?.replaceChild(fragment, node);
  }
};
export const handleHighlightAudioNode = (
  text: string,
  style: string,
  doc: Document,
  element: HTMLElement,
  readerMode: string
) => {
  // First remove any existing highlights
  const existingHighlights = doc.querySelectorAll(
    `span[data-highlight="true"]`
  );
  existingHighlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    if (parent) {
      parent.replaceChild(
        doc.createTextNode(highlight.textContent || ""),
        highlight
      );
    }
  });

  if (!text.trim()) return;

  // Get block elements and find those containing the target text
  let nodeList = getBlockElement(doc.body);
  let nodes = nodeList.filter((node) => {
    const content = (node as HTMLElement).textContent || "";
    return content.trim() && content.indexOf(text) > -1;
  });

  // For the first matching node, highlight the text
  if (nodes.length > 0) {
    wrapHighlightRange(nodes[0], text, style, doc);
  }
};
export const getSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let chapterDoc = new DOMParser().parseFromString(
      await handleOneChapterDoc(chapterDocList[i].text, true),
      "text/html"
    );
    let nodeList = getBlockElement(chapterDoc.body).filter(
      (item) => !isParentBlock(item)
    );
    for (let j = 0; j < nodeList.length; j++) {
      let keyWordIndex = (
        (nodeList[j] as HTMLElement).textContent?.toLowerCase() || ""
      ).indexOf(keyword.toLowerCase());
      if (keyWordIndex > -1) {
        searchResult.push({
          excerpt:
            nodeList[j].textContent?.substring(
              keyWordIndex - 100,
              keyWordIndex + 100
            ) || "",
          cfi: JSON.stringify({
            text: nodeList[j].textContent,
            chapterTitle: chapterDocList[i].label,
            chapterDocIndex: i,
            chapterHref: chapterDocList[i].href,
            count: "search",
            percentage: i / chapterDocList.length,
            keyword: keyword,
          }),
        });
      }
    }
  }
  return searchResult;
};

export const isScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string
) => {
  var isVisible = false;
  const computedStyle = getComputedStyle(el);
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.opacity === "0"
  ) {
    return false;
  }
  var rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (vertical && el.textContent && el.textContent.trim()) {
    let elemTop = rect.top;
    isVisible = elemTop > -10 && elemTop <= element.clientHeight;
  } else if (
    readerMode !== "scroll" &&
    !vertical &&
    el.textContent &&
    el.textContent.trim()
  ) {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.clientWidth;
  } else if (
    readerMode === "scroll" &&
    el.textContent &&
    el.textContent.trim()
  ) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.clientHeight;
  } else if (readerMode !== "scroll" && !vertical) {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.clientWidth;
  } else if (vertical) {
    let elemTop = rect.top;
    isVisible = elemTop >= 0 && elemTop <= element.clientHeight;
  }
  return isVisible;
};
