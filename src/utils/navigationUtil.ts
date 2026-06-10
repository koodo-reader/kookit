import ChapterDoc from "../model/chapterDoc";
import {
  convertComputedNum,
  convertStyleNum,
  handleIframeHeight,
  handleOneChapterDoc,
  isVerticalLayout,
  progressInfo,
} from "./layoutUtil";
import Chapter from "../model/chapter";
import Chinese from "../libs/zh-convert";
import _ from "underscore";
import { cleanText } from "../libs/textProcessor";
import {
  getBlockElement,
  getPageWidth,
  getStylePxNumber,
  getViewportSize,
  isParentBlock,
  mergeStyleStrings,
} from "./common";

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

  if (animation === "mimical" && isMobile !== "yes") {
    let bookDiv = document.getElementById("book");
    if (bookDiv) {
      bookDiv.style.display = "block";
      if (delta > 0) {
        flipToPrevPage();
      } else if (delta < 0) {
        flipToNextPage();
      }
      setTimeout(() => {
        if (!bookDiv) return {};
        bookDiv.style.display = "none";
      }, 1000);
    }
  }

  if (vertical) {
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const height = element.clientHeight;
    const currentScrollTop = doc.body.scrollTop;
    const scrollDistance = height + gap;

    if (delta > 0) {
      const currentPage = Math.round(currentScrollTop / scrollDistance);
      const targetPage = Math.max(0, currentPage - 1);
      const targetScrollTop = targetPage * scrollDistance;
      doc.body.scrollTo({
        left: 0,
        top: targetScrollTop,
        behavior:
          animation === "sliding" && isMobile !== "yes" ? "smooth" : "auto",
      });
    } else if (delta < 0) {
      const currentPage = Math.round(currentScrollTop / scrollDistance);
      const targetPage = currentPage + 1;
      const targetScrollTop = targetPage * scrollDistance;
      doc.body.scrollTo({
        left: 0,
        top: targetScrollTop,
        behavior:
          animation === "sliding" && isMobile !== "yes" ? "smooth" : "auto",
      });
    }
  } else {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const width = element.clientWidth;
    const currentScrollLeft = doc.body.scrollLeft;
    const scrollDistance = width + gap;

    if (delta > 0) {
      const currentPage = Math.round(currentScrollLeft / scrollDistance);
      const targetPage = Math.max(0, currentPage - 1);
      const targetScrollLeft = targetPage * scrollDistance;
      doc.body.scrollTo({
        top: 0,
        left: targetScrollLeft,
        behavior:
          animation === "sliding" && isMobile !== "yes" ? "smooth" : "auto",
      });
    } else if (delta < 0) {
      const currentPage = Math.round(currentScrollLeft / scrollDistance);
      const targetPage = currentPage + 1;
      const targetScrollLeft = targetPage * scrollDistance;
      doc.body.scrollTo({
        top: 0,
        left: targetScrollLeft,
        behavior:
          animation === "sliding" && isMobile !== "yes" ? "smooth" : "auto",
      });
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
export const isElementFootnote = (element: HTMLElement) => {
  if (!element) return false;
  if (element.tagName === "IMG") {
    return true;
  }
  if (element.textContent) {
    let textContent = element.textContent.trim();
    // Check for patterns like [1], [a], (1), (a), 〔2〕, 【3】, 〈4〉, 《5》, roman numerals, and circled numbers (①-㊿)
    const footnotePattern =
      /^(\[|\(|〔|【|〈|《|〚)([a-zA-Z0-9零一二三四五六七八九十百千万]+)(\]|\)|〕|】|〉|》|〛)$|^\d+$|^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$|^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]$/i;
    if (footnotePattern.test(textContent)) {
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
    (chapterTitle && !chapterDocIndex) ||
    (chapterDocList[chapterDocIndex] &&
      chapterDocList[chapterDocIndex].label &&
      chapterTitle &&
      chapterTitle !== chapterDocList[chapterDocIndex].label &&
      chapterHref.indexOf("#") === -1)
  ) {
    let tempChapterDocIndex = _.findLastIndex(chapterDocList, {
      label: chapterTitle,
    });
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

  const baseStyle = doc.body.getAttribute("style") || "";
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
    if (pageWidth > 0 && availableHeight > 0) {
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
  let styleSheetPromises: any = [];
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    if (!link.href.endsWith("null")) {
      styleSheetPromises.push(
        new Promise((resolve, reject) => {
          link.addEventListener("load", resolve);
        })
      );
    }
  }
  try {
    await Promise.race([
      Promise.all(styleSheetPromises),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          // reject(new Error("Timeout"));
          resolve("css load timeout");
        }, 10);
      }),
    ]);
  } catch (err) {
    console.error(err);
  }
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
      let section = Math.floor(element.clientHeight / 12);
      let gap = section % 2 === 0 ? section : section - 1;
      let pageHeight = element.clientHeight + gap;
      top = pageHeight * (parseInt(page) - 1);
    } else {
      let section = Math.floor(element.clientWidth / 12);
      let gap = section % 2 === 0 ? section : section - 1;
      const width = convertComputedNum(getComputedStyle(element).width);
      let pageWidth = width + gap;
      left = pageWidth * (parseInt(page) - 1);
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
        ? convertStyleNum(targetNode.offsetTop) -
          convertStyleNum(
            targetNode.marginTop ||
              parseFloat(getComputedStyle(targetNode).marginTop)
          )
        : text === "prevChapter"
          ? doc.body.scrollHeight
          : 0;
    } else {
      left = targetNode
        ? convertStyleNum(targetNode.offsetLeft) -
          convertStyleNum(
            targetNode.marginLeft ||
              parseFloat(getComputedStyle(targetNode).marginLeft)
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
        ? convertStyleNum(targetNode.offsetTop) -
          convertStyleNum(
            targetNode.marginTop ||
              parseFloat(getComputedStyle(targetNode).marginTop)
          )
        : 0;
    } else {
      left = targetNode
        ? convertStyleNum(targetNode.offsetLeft) -
          convertStyleNum(
            targetNode.marginLeft ||
              parseFloat(getComputedStyle(targetNode).marginLeft)
          )
        : 0;
    }
  }
  if (readerMode !== "scroll") {
    if (vertical) {
      doc.body.scrollTo(0, top);
    } else {
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
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    let offsetTop =
      convertStyleNum(targetNode.offsetTop) -
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
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    let offsetLeft =
      convertStyleNum(targetNode.offsetLeft) -
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
) => {
  if (lock) return;
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
};
export const isCurrentNodeFarFromParrent = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode
) => {
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (vertical) {
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    if (
      Math.abs(
        targetNode.offsetTop -
          getCloestBlock(targetNode, element, readerMode).offsetTop
      ) >
      (element.clientHeight + gap) / 2
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    if (
      Math.abs(
        targetNode.offsetLeft -
          getCloestBlock(targetNode, element, readerMode).offsetLeft
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
  element: HTMLElement
) => {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < element.clientHeight &&
    rect.right > 0 &&
    rect.left < element.clientWidth
  );
};

const isNodeVisibleInViewport = (element: HTMLElement, el: HTMLElement) => {
  const computedStyle = getComputedStyle(el);
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.opacity === "0"
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return isTextVisibleInViewport(rect, element);
};

const isNodePartiallyVisibleInViewport = (
  element: HTMLElement,
  el: HTMLElement
) => {
  if (!isNodeVisibleInViewport(element, el)) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > element.clientHeight ||
    rect.right > element.clientWidth
  );
};

const getVisibleCharRange = (element: HTMLElement, root: HTMLElement) => {
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
        isTextVisibleInViewport(rect, element)
      );

      if (nodeMayBeVisible) {
        let prevCharVisible = false;
        for (let i = 0; i < content.length; i++) {
          const charRange = document.createRange();
          charRange.setStart(currentNode, i);
          charRange.setEnd(currentNode, i + 1);
          const charRects = Array.from(charRange.getClientRects());
          let visible = charRects.some((rect) =>
            isTextVisibleInViewport(rect, element)
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
const getNodeVisibleText = (element: HTMLElement, item: HTMLElement) => {
  const text = item.textContent || "";
  if (!text.trim()) {
    return text;
  }

  if (!isNodePartiallyVisibleInViewport(element, item)) {
    return text;
  }

  const visibleRange = getVisibleCharRange(element, item);
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
      isNodeVisibleInViewport(element, s as HTMLElement) &&
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
    .map((item) => getNodeVisibleText(element, item as HTMLElement))
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
  let nodeList = Array.from(
    doc.body.querySelectorAll("span, p, div, h1, h2, h3, h4, h5, h6 ")
  );
  let nodes = nodeList.filter((node) => {
    const content = (node as HTMLElement).textContent || "";
    return (
      content.trim() && content.toLowerCase().indexOf(text.toLowerCase()) > -1
    );
  });

  // Process all matching nodes for global replacement
  nodes.forEach((node) => {
    // Function to process text nodes with global case-insensitive replacement
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent || "";
        let lowerContent = content.toLowerCase();
        let lowerText = text.toLowerCase();
        let processedContent = content;
        let offset = 0;
        let matches: Array<{
          start: number;
          end: number;
          originalText: string;
        }> = [];

        // Find all matches in the content
        let index = lowerContent.indexOf(lowerText);
        while (index > -1) {
          matches.push({
            start: index,
            end: index + text.length,
            originalText: content.substring(index, index + text.length),
          });
          index = lowerContent.indexOf(lowerText, index + 1);
        }

        if (matches.length > 0) {
          const fragment = doc.createDocumentFragment();
          let lastEnd = 0;

          // Process each match
          matches.forEach((match) => {
            // Add text before the match
            if (match.start > lastEnd) {
              fragment.appendChild(
                doc.createTextNode(content.substring(lastEnd, match.start))
              );
            }

            // Create highlight span for the match
            const highlightSpan = doc.createElement("span");
            highlightSpan.setAttribute("style", style);
            highlightSpan.setAttribute("data-highlight", "true");
            highlightSpan.setAttribute("class", "kookit-highlight-text");
            highlightSpan.textContent = match.originalText;
            fragment.appendChild(highlightSpan);

            lastEnd = match.end;
          });

          // Add remaining text after the last match
          if (lastEnd < content.length) {
            fragment.appendChild(
              doc.createTextNode(content.substring(lastEnd))
            );
          }

          node.parentNode?.replaceChild(fragment, node);
          return true;
        }
      }
      return false;
    };

    // Process all child nodes recursively
    const walkAndProcess = (node) => {
      let hasReplaced = processNode(node);

      if (!hasReplaced) {
        // Process children if this node didn't contain the text
        const childNodes = Array.from(node.childNodes);
        for (const child of childNodes) {
          walkAndProcess(child);
        }
      }
    };

    walkAndProcess(node);
  });
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
    // Function to process text nodes
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent || "";
        const index = content.indexOf(text);

        if (index > -1) {
          // Split the text node and insert the highlight
          const before = content.substring(0, index);
          const after = content.substring(index + text.length);

          // Create span with the specified style
          const highlightSpan = doc.createElement("span");
          highlightSpan.setAttribute("style", style);
          highlightSpan.setAttribute("data-highlight", "true");
          highlightSpan.textContent = text;
          highlightSpan.setAttribute("class", "kookit-highlight-text");
          // Replace the original text node with three new nodes
          const fragment = doc.createDocumentFragment();
          if (before) fragment.appendChild(doc.createTextNode(before));
          fragment.appendChild(highlightSpan);
          if (after) fragment.appendChild(doc.createTextNode(after));

          node.parentNode?.replaceChild(fragment, node);
          return true; // Text was found and highlighted
        }
      }
      return false; // No match in this node
    };

    // Process all child nodes recursively until we find a match
    const walkAndProcess = (node) => {
      if (processNode(node)) return true;

      // Process children if this node didn't contain the text
      const childNodes = Array.from(node.childNodes);
      for (const child of childNodes) {
        if (walkAndProcess(child)) return true;
      }
      return false;
    };

    walkAndProcess(nodes[0]);
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
