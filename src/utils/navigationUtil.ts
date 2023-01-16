import _ from "underscore";
import ChapterDoc from "../model/chapterDoc";
import { handleIframeHeight, handleImageSize } from "./layoutUtil";
import StorageUtil from "./storageUtil";
import Chinese from "chinese-s2t";
import Chapter from "../model/chapter";

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
  let currentChapterIndex = _.findLastIndex(flattenChapters, {
    index: chapterDocIndex,
    href: chapterHref,
  });
  StorageUtil.setKookitConfig(
    "chapterTitle",
    flattenChapters[currentChapterIndex - 1].title
  );
  StorageUtil.setKookitConfig(
    "chapterHref",
    flattenChapters[currentChapterIndex - 1].href
  );
  StorageUtil.setKookitConfig(
    "chapterDocIndex",
    flattenChapters[currentChapterIndex - 1].index.toString()
  );
  StorageUtil.setKookitConfig("text", "prevChapter");
  handleRenderChatper(
    flattenChapters[currentChapterIndex - 1].index,
    flattenChapters[currentChapterIndex - 1].title,
    chapterDocList,
    element,
    mode
  );
  if (
    flattenChapters[currentChapterIndex - 1].href &&
    flattenChapters[currentChapterIndex - 1].href.indexOf("#") > -1
  ) {
    handleScrollPosition(
      element,
      mode,
      "",
      "",
      flattenChapters[currentChapterIndex - 1].href
    );
  }
};

export const handleRenderChatper = (
  chapterDocIndex: number = 0,
  chapterTitle: string = "",
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
  doc.body.innerHTML = chapterDocList[chapterDocIndex].text;

  StorageUtil.setKookitConfig("chapterTitle", chapterTitle);
  StorageUtil.setKookitConfig("chapterDocIndex", chapterDocIndex.toString());
  StorageUtil.setKookitConfig(
    "percentage",
    chapterDocIndex / chapterDocList.length + ""
  );
  handleIframeHeight(element, mode);
  handleImageSize(element, mode);
  handleScrollPosition(element, mode, "", "", "");
};
export const handleScrollPosition = (
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
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let top = 0;
  let left = 0;
  let targetNode = doc.body;
  if (text) {
    let nodeList = Array.from(
      doc.body.querySelectorAll("h1,h2,h3,h4,p,img")
    ) as HTMLElement[];
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        (((s as HTMLElement).innerText.trim() &&
          ((s as HTMLElement).innerText.trim() === text.trim() ||
            (s as HTMLElement).innerText.trim() === Chinese.t2s(text.trim()) ||
            (s as HTMLElement).innerText.trim() ===
              Chinese.s2t(text.trim()))) ||
          ((s as any).getAttribute("recindex") &&
            (s as any).getAttribute("recindex").trim() === text.trim())) &&
        Math.abs(index - parseInt(count)) < 2
      );
    });
    targetNode = targetNodeList[0];
  } else if (href && href.indexOf("#") > -1) {
    let id = href.split("#").reverse()[0];
    console.log(id);
    targetNode = doc.body.querySelector("#" + id) || doc.body;
    console.log(targetNode);
  }
  left = targetNode
    ? targetNode.getBoundingClientRect().left
    : text === "prevChapter"
    ? doc.body.scrollWidth
    : 0;
  top = targetNode ? targetNode.getBoundingClientRect().top : 0;
  if (mode !== "scroll") {
    doc.body.scrollTo(left, 0);
  } else {
    element.scrollTo(0, top);
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
  let nodeList = Array.from(
    doc.body.querySelectorAll("h1,h2,h3,h4,p,img")
  ) as HTMLElement[];
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as any, mode) &&
      ((s as HTMLElement).innerText.trim() || s.getAttribute("recindex"))
  );
  let firstVisibleNode: any = visibleNode[0] as HTMLElement;
  let count = 0;

  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], mode) &&
      nodeList[i].tagName === "IMG"
    ) {
      count = i;
      break;
    }
    if (
      isScrolledIntoView(element, nodeList[i], mode) &&
      firstVisibleNode &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML &&
      nodeList[i].tagName !== "IMG"
    ) {
      count = i;
      break;
    }
  }

  StorageUtil.setKookitConfig(
    "text",
    firstVisibleNode
      ? firstVisibleNode.innerText
        ? firstVisibleNode.innerText
        : firstVisibleNode.getAttribute("recindex")
        ? firstVisibleNode.getAttribute("recindex")
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
  let currentChapterIndex = _.findLastIndex(flattenChapters, {
    index: chapterDocIndex,
    href: chapterHref,
  });
  StorageUtil.setKookitConfig(
    "chapterTitle",
    flattenChapters[currentChapterIndex + 1].title
  );
  StorageUtil.setKookitConfig(
    "chapterHref",
    flattenChapters[currentChapterIndex + 1].href
  );
  StorageUtil.setKookitConfig(
    "chapterDocIndex",
    flattenChapters[currentChapterIndex + 1].index.toString()
  );
  StorageUtil.setKookitConfig("text", "");
  handleRenderChatper(
    flattenChapters[currentChapterIndex + 1].index,
    flattenChapters[currentChapterIndex + 1].title,
    chapterDocList,
    element,
    mode
  );
  if (
    flattenChapters[currentChapterIndex + 1].href &&
    flattenChapters[currentChapterIndex + 1].href.indexOf("#") > -1
  ) {
    handleScrollPosition(
      element,
      mode,
      "",
      "",
      flattenChapters[currentChapterIndex + 1].href
    );
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
  let nodeList = Array.from(
    doc.body.querySelectorAll("h1,h2,h3,h4,p,img")
  ) as HTMLElement[];
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as any, mode) &&
      ((s as HTMLElement).innerText.trim() || s.getAttribute("recindex"))
  );
  return (mode !== "scroll" ? visibleNode : nodeList)
    .map((item) => item.innerText)
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
    let nodeList = Array.from(
      chapterDoc.body.querySelectorAll("h1,h2,h3,h4,p,img")
    ) as HTMLElement[];

    for (let j = 0; j < nodeList.length; j++) {
      if (nodeList[j].innerText.indexOf(keyword) > -1) {
        searchResult.push({
          excerpt: nodeList[j].innerText,
          cfi: JSON.stringify({
            text: nodeList[j].innerText,
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
  if (mode !== "scroll" && el.innerText.trim()) {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.offsetWidth;
  } else if (el.innerText.trim()) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.offsetHeight;
  } else if (
    mode !== "scroll" &&
    (el.id || el.onerror) &&
    el.tagName === "IMG"
  ) {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.offsetWidth;
  } else if ((el.id || el.onerror) && el.tagName === "IMG") {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop - element.clientHeight / 2 &&
      elemTop <=
        element.scrollTop + element.offsetHeight + element.clientHeight / 2;
  }
  return isVisible;
};
