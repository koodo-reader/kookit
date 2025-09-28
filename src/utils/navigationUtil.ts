import ChapterDoc from "../model/chapterDoc";
import {
  convertComputedNum,
  convertStyleNum,
  handleIframeHeight,
  handleOneChapterDoc,
  progressInfo,
} from "./layoutUtil";
import Chapter from "../model/chapter";
import Chinese from "../libs/zh-convert";
import _ from "underscore";
import { cleanText } from "../libs/textProcessor";

let lock = false;
export const getBlockElement = (Element) => {
  return Array.from(
    Element.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,li,dt,dd,pre,blockquote,address,kookitmarker"
    )
  ) as HTMLElement[];
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
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = element.clientWidth;

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

  const currentScrollLeft = doc.body.scrollLeft;
  const scrollDistance = width + gap;

  if (delta > 0) {
    // previous page - 计算当前页数并减1
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
    // next page - 计算当前页数并加1
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
  //get viewport width from chapterText

  doc.body.innerHTML = chapterText;

  if (bodyAttrs["style"]) {
    doc.body.setAttribute("style", doc.body.getAttribute("style") || "");
  } else if (bodyAttrs["class"]) {
    doc.body.setAttribute("class", bodyAttrs["class"]);
  } else if (bodyAttrs["id"]) {
    doc.body.setAttribute("id", bodyAttrs["id"]);
  } else if (!bodyAttrs["class"]) {
    doc.body.removeAttribute("class");
  } else if (!bodyAttrs["id"]) {
    doc.body.removeAttribute("id");
  }
  await handleCssLink(doc);
  await handlePlainText(doc);
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
  let targetNode: any = doc.body;
  if (page && readerMode !== "scroll") {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const width = convertComputedNum(getComputedStyle(element).width);
    let pageWidth = width + gap;
    left = pageWidth * (parseInt(page) - 1);
  } else if (text) {
    let nodeList = getBlockElement(doc.body);
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        cleanText((s as HTMLElement).textContent) &&
        (cleanText((s as HTMLElement).textContent) === cleanText(text) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.t2s(cleanText(text)) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.s2t(cleanText(text))) &&
        (Math.abs(index - parseInt(count)) < 2 ||
          count === "search" ||
          count === "ignore" ||
          count === "next")
      );
    });
    if (targetNodeList.length === 0) {
      return;
    }
    targetNode = getCloestBlock(targetNodeList[0], element, readerMode);
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : text === "prevChapter"
      ? doc.body.scrollWidth
      : 0;
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
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
  }
  if (readerMode !== "scroll") {
    doc.body.scrollTo(left, 0);
  } else {
    targetNode.scrollIntoView();
  }
};

export const getCloestBlock = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode: string
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let offsetLeft =
    convertStyleNum(targetNode.offsetLeft) -
    convertStyleNum(
      (targetNode as any).marginLeft ||
        parseFloat(getComputedStyle(targetNode).marginLeft)
    );
  if (readerMode === "scroll") {
    return targetNode;
  } else if (
    readerMode !== "scroll" &&
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
    tempLocation.text = firstVisibleNode.textContent || "";
    tempLocation.count = count + "";
    tempLocation.page = "";
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
export const handleRecordByNode = async (
  element: HTMLElement,
  readerMode: string,
  flattenChapters: Chapter[],
  tempLocation: any,
  doc: Document,
  node: HTMLElement
) => {
  if (lock) return;
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  let firstVisibleNode: any = node;
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
    tempLocation.text = firstVisibleNode
      ? firstVisibleNode.textContent
        ? firstVisibleNode.textContent
        : ""
      : "";
    tempLocation.count = count + "";
    tempLocation.page = "";
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
  doc: Document
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
  let firstSliceIndex = 0;
  let visibleText = getVisibleText(element, readerMode, doc);
  if (visibleText && visibleText.length > 0) {
    let firstVisibleText = visibleText[0];
    firstSliceIndex = audioText.indexOf(firstVisibleText);
  }

  return audioText.slice(firstSliceIndex);
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
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
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
    .map((item) => item.textContent);
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

  // Get block elements and find those containing the target text
  let nodeList = Array.from(
    doc.body.querySelectorAll("span, p, div, h1, h2, h3, h4, h5, h6 ")
  );
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

    for (let i = 0; i < nodes.length; i++) {
      walkAndProcess(nodes[i]);
    }
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
  let nodeList = getBlockElement(doc.body).filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
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
        (nodeList[j] as HTMLElement).textContent || ""
      ).indexOf(keyword);
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

export const isParentBlock = (myDiv: Element) => {
  var children = myDiv.children;
  let flag = false;
  var blockRegex =
    /^(address|kookitmarker|section|blockquote|body|center|dir|div|dl|fieldset|form|h[1-6]|hr|isindex|menu|noframes|noscript|ol|p|pre|table|ul|dd|dt|frameset|li|tbody|td|tfoot|th|thead|tr|html)$/i;
  let blockElementList = Array.from(children).filter((item) =>
    blockRegex.test(item.nodeName)
  );
  // some elements might contain image and image subtitle
  if (blockElementList.length < 3) {
    return false;
  }
  for (var i = 0; i < children.length; i++) {
    if (blockRegex.test(children[i].nodeName)) {
      flag = true;
      break;
    }
  }
  return flag;
};
export const isScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (readerMode !== "scroll" && el.textContent && el.textContent.trim()) {
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
  } else if (readerMode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.clientWidth;
  }
  return isVisible;
};
