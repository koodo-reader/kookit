import ChapterDoc from "../model/chapterDoc";
import { handleIframeHeight, handleImageSize } from "./layoutUtil";
import StorageUtil from "./storageUtil";
import Chinese from "chinese-s2t";
import Chapter from "../model/chapter";
import { cleanText, getBlockElement } from "./titleUtil";
declare var window: any;

let lock = false;
export const handleScrollPage = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  delta: number,
  isSliding: boolean,
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
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  if (delta > 0 && doc.body.scrollLeft > 0) {
    doc.body.scrollBy({
      top: 0,
      left: -element.offsetWidth - gap,
      behavior: isSliding ? "smooth" : "auto",
    });
    // trigger("page-changed");
  } else if (delta > 0 && doc.body.scrollLeft === 0) {
    handlePrevChapter(element, flattenChapters, chapterDocList, mode);
    trigger("rendered");
  } else if (delta < 0) {
    handleTurnChapter(element, flattenChapters, chapterDocList, mode, trigger);

    doc.body.scrollBy({
      top: 0,
      left: element.offsetWidth + gap,
      behavior: isSliding ? "smooth" : "auto",
    });
  }
};
const findValidChapter = (
  chapterDocIndex,
  chapterHref,
  flattenChapters,
  flag
) => {
  let validChapters = flattenChapters.filter((item) => item.href);
  let currentChapterIndex = window._.findLastIndex(validChapters, {
    index: chapterDocIndex,
    href: chapterHref,
  });
  if (flag === "prev") {
    return validChapters[currentChapterIndex - 1];
  } else {
    return validChapters[currentChapterIndex + 1];
  }
};
export const handlePrevChapter = (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  let chapterTitle = StorageUtil.getKookitConfig("chapterTitle");
  let chapterDocIndex = parseInt(
    StorageUtil.getKookitConfig("chapterDocIndex") || "0"
  );
  let chapterHref = StorageUtil.getKookitConfig("chapterHref") || "";
  if (chapterDocIndex === 0 || !chapterTitle) {
    return;
  }
  let prevChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    flattenChapters,
    "prev"
  );
  StorageUtil.setKookitConfig("chapterTitle", prevChapter.title);
  StorageUtil.setKookitConfig("chapterHref", prevChapter.href);
  StorageUtil.setKookitConfig("chapterDocIndex", prevChapter.index.toString());
  StorageUtil.setKookitConfig("text", "prevChapter");
  handleRenderChatper(
    prevChapter.index,
    prevChapter.title,
    prevChapter.href,
    chapterDocList,
    element,
    mode
  );
  if (prevChapter.href && prevChapter.href.indexOf("#") > -1) {
    handleScrollPosition(element, mode, "", "", prevChapter.href);
  }
};

export const handleRenderChatper = async (
  chapterDocIndex: number = 0,
  chapterTitle: string = "",
  chapterHref: string = "",
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  mode: string
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
  doc.body.scrollTo(0, 0);
  doc.body.innerHTML = chapterDocList[chapterDocIndex].text;
  let linkList = Array.from(doc.getElementsByTagName("link"));
  linkList.forEach((element: any) => {
    element.onload = () => {
      console.log("finished");
    };
  });
  let styleSheetPromises: any = [];
  linkList.forEach((link: any) => {
    styleSheetPromises.push(
      new Promise((resolve, reject) => {
        link.addEventListener("load", resolve);
      })
    );
  });
  let results = await Promise.all(styleSheetPromises);
  console.log(results);
  StorageUtil.setKookitConfig("chapterTitle", chapterTitle);
  StorageUtil.setKookitConfig("chapterHref", chapterHref);
  StorageUtil.setKookitConfig("chapterDocIndex", chapterDocIndex.toString());
  StorageUtil.setKookitConfig(
    "percentage",
    chapterDocIndex / chapterDocList.length + ""
  );
  handleIframeHeight(element, mode);
  handleImageSize(element, mode);
  // handleScrollPosition(element, mode, "", "", "");
};
export const handleScrollPosition = async (
  element: HTMLElement,
  mode: string,
  text: string,
  count: string,
  href: string
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
  if (text) {
    let nodeList = getBlockElement(doc.body);
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        cleanText((s as HTMLElement).textContent) &&
        (cleanText((s as HTMLElement).textContent) === cleanText(text) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.t2s(cleanText(text)) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.s2t(cleanText(text))) &&
        Math.abs(index - parseInt(count)) < 2
      );
    });
    targetNode = targetNodeList[0];
  } else if (href && href.indexOf("#") > -1) {
    let id = href.split("#").reverse()[0];
    targetNode = getCloestBlock(
      doc.body.querySelector("#" + id) || doc.body,
      element
    );
  }
  console.log(targetNode);
  left = targetNode
    ? targetNode.getBoundingClientRect().left
    : text === "prevChapter"
    ? doc.body.scrollWidth
    : 0;
  console.log(targetNode);
  top = targetNode ? targetNode.getBoundingClientRect().top : 0;
  if (mode !== "scroll") {
    console.log(left);
    doc.body.scrollTo(left, 0);
  } else {
    element.scrollTo(0, top);
  }
};
export const getCloestBlock = (targetNode, element) => {
  console.log(
    targetNode,
    targetNode.getBoundingClientRect(),
    element.clientWidth
  );
  if (targetNode.getBoundingClientRect().left % element.clientWidth === 0) {
    return targetNode;
  } else {
    console.log(targetNode.parentElement);
    return targetNode.parentElement;
  }
};
export const handleTurnChapter = (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
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
    Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <
      10 &&
    Math.abs(
      doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth
    ) < 10
  ) {
    handleNextChapter(element, flattenChapters, chapterDocList, mode);
    trigger("rendered");
  }
};
export const handleRecord = async (element: HTMLElement, mode: string) => {
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

  StorageUtil.setKookitConfig(
    "text",
    firstVisibleNode
      ? firstVisibleNode.textContent
        ? firstVisibleNode.textContent
        : ""
      : ""
  );
  StorageUtil.setKookitConfig("count", count + "");
  lock = true;
  setTimeout(() => {
    lock = false;
  }, 100);
};
export const handleNextChapter = (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  let chapterDocIndex = parseInt(
    StorageUtil.getKookitConfig("chapterDocIndex") || "0"
  );
  let chapterHref = StorageUtil.getKookitConfig("chapterHref") || "";
  let nextChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    flattenChapters,
    "next"
  );
  console.log(nextChapter, "nextChapter");
  StorageUtil.setKookitConfig("chapterTitle", nextChapter.title);
  StorageUtil.setKookitConfig("chapterHref", nextChapter.href);
  StorageUtil.setKookitConfig("chapterDocIndex", nextChapter.index.toString());
  StorageUtil.setKookitConfig("text", "");
  handleRenderChatper(
    nextChapter.index,
    nextChapter.title,
    nextChapter.href,
    chapterDocList,
    element,
    mode
  );
  if (nextChapter.href && nextChapter.href.indexOf("#") > -1) {
    handleScrollPosition(element, mode, "", "", nextChapter.href);
  }
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
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, mode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  return (mode !== "scroll" ? visibleNode : nodeList)
    .map((item) => item.textContent)
    .join(" ");
};

export const getSearchResult = (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let chapterDoc = new DOMParser().parseFromString(
      chapterDocList[i].text,
      "text/html"
    );
    let nodeList = getBlockElement(chapterDoc.body);
    for (let j = 0; j < nodeList.length; j++) {
      if (
        ((nodeList[j] as HTMLElement).textContent || "").indexOf(keyword) > -1
      ) {
        searchResult.push({
          excerpt: nodeList[j].textContent || "",
          cfi: JSON.stringify({
            text: nodeList[j].textContent,
            chapterTitle: chapterDocList[i].title,
            chapterDocIndex: i,
            chapterHref: chapterDocList[i].href,
            count: j,
            percentage: i / chapterDocList.length,
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
  mode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (mode !== "scroll" && el.textContent && el.textContent.trim()) {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.offsetWidth;
  } else if (el.textContent && el.textContent.trim()) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.offsetHeight;
  } else if (mode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.offsetWidth;
  }
  return isVisible;
};
