import ChapterDoc from "../model/chapterDoc";
import {
  convertComputedNum,
  convertStyleNum,
  handleIframeHeight,
  handleOneChapterDoc,
  progressInfo,
} from "./layoutUtil";
import StorageUtil from "./storageUtil";
import Chapter from "../model/chapter";
declare var window: any;

let lock = false;
export const getBlockElement = (Element) => {
  return Array.from(
    Element.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address"
    )
  ) as HTMLElement[];
};

export const cleanText = (str) => {
  return str
    .trim()
    .replace(/(\r\n|\n|\r|\t)/gm, "")
    .substring(0, 100);
};
export const handleScrollPage = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  format: string,
  delta: number,
  trigger: (status: string) => void
) => {
  let isSliding =
    StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = element.clientWidth;
  console.log(-width - gap, "-width - gap");
  if (delta > 0) {
    doc.body.scrollBy({
      top: 0,
      left: -width - gap,
      behavior: isSliding ? "smooth" : "auto",
    });
    // trigger("page-changed");
  } else if (delta < 0) {
    await handleTurnChapter(
      element,
      flattenChapters,
      chapterDocList,
      mode,
      format,
      trigger
    );

    doc.body.scrollBy({
      top: 0,
      left: width + gap,
      behavior: isSliding ? "smooth" : "auto",
    });
  }
};
const findValidChapter = (
  chapterDocIndex: number,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  flag: string
) => {
  let validChapters = chapterDocList;
  let currentChapterIndex = window._.findLastIndex(validChapters, {
    href: chapterHref,
  });
  if (
    chapterHref &&
    window._.findLastIndex(validChapters, {
      href: chapterHref,
    }) > -1
  ) {
    currentChapterIndex = window._.findLastIndex(validChapters, {
      href: chapterHref,
    });
  } else {
    currentChapterIndex = chapterDocIndex;
  }
  if (flag === "prev") {
    return {
      ...validChapters[currentChapterIndex - 1],
      index: currentChapterIndex - 1,
    };
  } else {
    return {
      ...validChapters[currentChapterIndex + 1],
      index: currentChapterIndex + 1,
    };
  }
};
export const handlePrevChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  format: string
) => {
  let chapterDocIndex = parseInt(
    StorageUtil.getKookitConfig("chapterDocIndex") || "0"
  );
  let chapterHref = StorageUtil.getKookitConfig("chapterHref") || "";
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

  StorageUtil.setKookitConfig("text", "prevChapter");
  StorageUtil.setKookitConfig("page", "");
  await handleRenderChatper(
    prevChapter.index,
    prevChapter.label,
    prevChapter.href,
    chapterDocList,
    element,
    mode,
    format
  );
};

export const handleRenderChatper = async (
  chapterDocIndex: number,
  chapterTitle: string,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  mode: string,
  format: string
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
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
    chapterDocIndex = window._.findLastIndex(chapterDocList, {
      label: chapterTitle,
    });
  }
  if (chapterDocIndex === -1 || chapterDocIndex > chapterDocList.length - 1) {
    chapterDocIndex = 0;
  }
  doc.body.innerHTML = await handleOneChapterDoc(
    chapterDocList[chapterDocIndex].text
  );
  await handleCssLink(doc);
  StorageUtil.setKookitConfig("chapterTitle", chapterTitle);
  StorageUtil.setKookitConfig("chapterHref", chapterHref);
  StorageUtil.setKookitConfig("chapterDocIndex", chapterDocIndex + "");
  StorageUtil.setKookitConfig(
    "percentage",
    chapterDocIndex / chapterDocList.length + ""
  );
  StorageUtil.setKookitConfig("text", "");
  await handleIframeHeight(element, mode, iframe, format);
  handleScrollPosition(element, mode, "", "", "", "");
};
export const handleCssLink = async (doc) => {
  let linkList = Array.from(doc.getElementsByTagName("link"));
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    link.onload = () => {
      console.log("finished");
    };
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
          reject(new Error("Timeout"));
        }, 1000);
      }),
    ]);
  } catch (err) {
    console.log(err);
  }
};
export const handleScrollPosition = async (
  element: HTMLElement,
  mode: string,
  text: string,
  count: string,
  href: string,
  page: string
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc: any = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let top = 0;
  let left = 0;
  let targetNode = doc.body;
  if (page && mode !== "scroll") {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const width = convertComputedNum(getComputedStyle(element).width);
    let pageWidth = width + gap;
    left = pageWidth * (parseInt(page) - 1);
  } else if (text) {
    let nodeList = getBlockElement(doc.body);
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        cleanText((s as HTMLElement).textContent).slim() &&
        (cleanText((s as HTMLElement).textContent).slim() ===
          cleanText(text).slim() ||
          cleanText((s as HTMLElement).textContent).slim() ===
            window.ChineseS2T.t2s(cleanText(text).slim()) ||
          cleanText((s as HTMLElement).textContent).slim() ===
            window.ChineseS2T.s2t(cleanText(text)).slim()) &&
        (Math.abs(index - parseInt(count)) < 2 ||
          count === "search" ||
          count === "ignore" ||
          count === "next")
      );
    });
    if (targetNodeList.length === 0) {
      console.log("failed");
      return;
    }
    targetNode = getCloestBlock(targetNodeList[0], element, mode);
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : text === "prevChapter"
      ? doc.body.scrollWidth
      : 0;
    top = targetNode
      ? convertStyleNum(targetNode.offsetTop) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
  } else if (href && href.indexOf("#") > -1) {
    let id = CSS.escape(href.split("#").reverse()[0]);
    if (!doc.body.querySelector("#" + id)) {
      return;
    }
    targetNode = getCloestBlock(
      doc.body.querySelector("#" + id) || doc.body,
      element,
      mode
    );
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    top = targetNode
      ? convertStyleNum(targetNode.offsetTop) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
  }
  if (mode !== "scroll") {
    doc.body.scrollTo(left, 0);
  } else {
    element.scrollTo(0, top);
  }
};

export const getCloestBlock = (
  targetNode: HTMLElement,
  element: HTMLElement,
  mode: string
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  if (mode === "scroll") {
    return targetNode;
  } else if (
    mode !== "scroll" &&
    parseInt(
      convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          (targetNode as any).marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        ) +
        ""
    ) %
      ((element.clientWidth + gap) / 2) ===
      0
  ) {
    return targetNode;
  } else if (targetNode.parentElement) {
    return getCloestBlock(targetNode.parentElement, element, mode);
  } else {
    return targetNode;
  }
};
export const handleTurnChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  format: string,
  trigger: (status: string) => void
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }

  if (
    Math.abs(
      element.scrollHeight -
        convertStyleNum(element.scrollTop) -
        element.clientHeight
    ) < 10 &&
    Math.abs(
      doc.body.scrollWidth -
        convertStyleNum(doc.body.scrollLeft) -
        doc.body.clientWidth
    ) < 10
  ) {
    await handleNextChapter(
      element,
      flattenChapters,
      chapterDocList,
      mode,
      format
    );
    trigger("rendered");
  }
};
export const handleRecord = async (
  element: HTMLElement,
  mode: string,
  flattenChapters: Chapter[]
) => {
  if (lock) return;
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, mode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  let firstVisibleNode: any = visibleNode[0] as HTMLElement;
  let count = 0;

  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], mode) &&
      firstVisibleNode &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML
    ) {
      count = i;
      break;
    }
  }
  handleHashChapter(visibleNode, flattenChapters);
  if (
    firstVisibleNode &&
    !isCurrentNodeFarFromParrent(firstVisibleNode, element, mode)
  ) {
    StorageUtil.setKookitConfig(
      "text",
      firstVisibleNode
        ? firstVisibleNode.textContent
          ? firstVisibleNode.textContent
          : ""
        : ""
    );
    StorageUtil.setKookitConfig("count", count + "");
    StorageUtil.setKookitConfig("page", "");
  } else {
    StorageUtil.setKookitConfig(
      "page",
      (await progressInfo(mode))?.currentPage + ""
    );
  }

  lock = true;
  setTimeout(() => {
    lock = false;
  }, 100);
};
export const isCurrentNodeFarFromParrent = (
  targetNode: HTMLElement,
  element: HTMLElement,
  mode
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  if (
    Math.abs(
      targetNode.offsetLeft -
        getCloestBlock(targetNode, element, mode).offsetLeft
    ) >
    (element.clientWidth + gap) / 2
  ) {
    return true;
  } else {
    return false;
  }
};
export const handleHashChapter = (visibleNode, flattenChapters) => {
  let chapterHref = StorageUtil.getKookitConfig("chapterHref") || "";
  let lastIndexOfHash = chapterHref.lastIndexOf("#");
  let beforeHash = chapterHref.substring(0, lastIndexOfHash);
  let afterHash = chapterHref.substring(lastIndexOfHash + 1);
  for (let index = 0; index < visibleNode.length; index++) {
    const element = visibleNode[index];
    if (afterHash && element.id) {
      let newHref = beforeHash + "#" + element.id;
      let newIndex = window._.findLastIndex(flattenChapters, {
        href: newHref,
      });
      if (newIndex > -1) {
        StorageUtil.setKookitConfig("chapterHref", newHref);
      }
    }
  }
};
export const handleNextChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  format: string
) => {
  let chapterDocIndex = parseInt(
    StorageUtil.getKookitConfig("chapterDocIndex") || "0"
  );
  let chapterHref = StorageUtil.getKookitConfig("chapterHref") || "";
  if (chapterDocIndex >= chapterDocList.length - 1) {
    StorageUtil.setKookitConfig("percentage", "1");
    return;
  }
  let nextChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    chapterDocList,
    "next"
  );
  if (!nextChapter) return;
  StorageUtil.setKookitConfig("page", "");
  await handleRenderChatper(
    nextChapter.index,
    nextChapter.label,
    nextChapter.href,
    chapterDocList,
    element,
    mode,
    format
  );
};
export const getAudioText = (element: HTMLElement, mode: string) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );
  let audioNode = nodeList.filter((s) =>
    ((s as HTMLElement).textContent || "").trim()
  );
  let audioText = audioNode
    .filter((item) => item.textContent !== "img")
    .map((item) => item.textContent);
  let firstSliceIndex = 0;
  if (
    getVisibleText(element, mode) &&
    (getVisibleText(element, mode) as any).length > 0
  ) {
    let firstVisibleText = (getVisibleText(element, mode) as any)[0];
    firstSliceIndex = audioText.indexOf(firstVisibleText);
  }

  return audioText.slice(firstSliceIndex);
};
export const getVisibleText = (element: HTMLElement, mode: string) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, mode) &&
      ((s as HTMLElement).textContent || "").trim()
  );

  return visibleNode
    .filter((item) => item.textContent !== "img")
    .map((item) => item.textContent);
};
export const handleHighlightNode = (
  element: HTMLElement,
  mode: string,
  text: string,
  style: string
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let nodeList = getBlockElement(doc.body);
  let nodes = nodeList.filter((s) => {
    if (s.getAttribute("style") === style) {
      s.setAttribute("style", "");
    }

    return (
      ((s as HTMLElement).textContent || "").trim() &&
      (s as HTMLElement).textContent === text
    );
  });
  if (nodes.length > 0) {
    nodes[0].setAttribute("style", style);
  }
};
export const getSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let chapterDoc = new DOMParser().parseFromString(
      await handleOneChapterDoc(chapterDocList[i].text),
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
          }),
        });
      }
    }
  }
  for (let i = 0; i < chapterDocList.length; i++) {
    if (chapterDocList[i].text && chapterDocList[i].text.unload) {
      chapterDocList[i].text.unload();
    }
  }
  return window._.uniq(searchResult, "excerpt");
};
export const isParentBlock = (myDiv: Element) => {
  var children = myDiv.children;
  let flag = false;
  var blockRegex =
    /^(address|section|blockquote|body|center|dir|div|dl|fieldset|form|h[1-6]|hr|isindex|menu|noframes|noscript|ol|p|pre|table|ul|dd|dt|frameset|li|tbody|td|tfoot|th|thead|tr|html)$/i;
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
  mode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (mode !== "scroll" && el.textContent && el.textContent.trim()) {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.clientWidth;
  } else if (mode === "scroll" && el.textContent && el.textContent.trim()) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.clientHeight;
  } else if (mode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.clientWidth;
  }
  return isVisible;
};
