import _ from "underscore";
import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";
import { handleIframeHeight, handleImageSize } from "./layoutUtil";
import StorageUtil from "./storageUtil";
import Chinese from "chinese-s2t";

let lock = false;
export const handleScrollPage = async (
  element: HTMLElement,
  chapterList: Chapter[],
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
  if (delta > 0 && doc.body.scrollLeft > 0) {
    // doc.body.scrollLeft -= element.offsetWidth + 88;

    doc.body.scrollBy({
      top: 0,
      left: -element.offsetWidth - 88,
      behavior: isSliding ? "smooth" : "auto",
    });
  } else if (delta > 0 && doc.body.scrollLeft === 0) {
    handlePrevChapter(element, chapterList, chapterDocList, mode);
    trigger("rendered");
  } else if (delta < 0) {
    handleTurnChapter(element, chapterList, chapterDocList, mode, trigger);

    doc.body.scrollBy({
      top: 0,
      left: element.offsetWidth + 88,
      behavior: isSliding ? "smooth" : "auto",
    });

    // doc.body.scrollLeft += element.offsetWidth + 88;
  }
};
export const handlePrevChapter = (
  element: HTMLElement,
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  let chapterTitle = StorageUtil.getKookitConfig("chapterTitle");
  let chapterIndex = _.findIndex(chapterList, {
    label: chapterTitle,
  });
  if (chapterIndex === 0 || chapterIndex === -1 || !chapterTitle) {
    return;
  }
  StorageUtil.setKookitConfig(
    "chapterTitle",
    chapterList[chapterIndex - 1].label
  );
  StorageUtil.setKookitConfig("text", "prevChapter");
  handleRenderChatper(
    chapterList[chapterIndex - 1].label,
    chapterDocList,
    element,
    mode
  );
};

export const handleRenderChatper = (
  label: string = "",
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
  let chapterIndex = _.findIndex(chapterDocList, {
    title: label,
  });
  chapterIndex = chapterIndex === -1 ? 0 : chapterIndex;
  doc.body.innerHTML = chapterDocList[chapterIndex].text;

  StorageUtil.setKookitConfig(
    "chapterTitle",
    chapterDocList[chapterIndex].title
  );
  StorageUtil.setKookitConfig(
    "percentage",
    chapterIndex / chapterDocList.length + ""
  );
  handleIframeHeight(element, mode);
  handleImageSize(element, mode);
  handleScrollPosition(element, mode);
};
export const handleScrollPosition = (
  element: HTMLElement,
  mode: string,
  _text: string = "",
  _count: string = "0"
) => {
  let text = _text || StorageUtil.getKookitConfig("text") || "";
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
  if (text) {
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        (((s as HTMLElement).innerText &&
          ((s as HTMLElement).innerText === text ||
            (s as HTMLElement).innerText === Chinese.t2s(text) ||
            (s as HTMLElement).innerText === Chinese.s2t(text))) ||
          ((s as any).getAttribute("recindex") &&
            (s as any).getAttribute("recindex") === text)) &&
        Math.abs(
          index - parseInt(_count || StorageUtil.getKookitConfig("count"))
        ) < 2
      );
    });
    let targetNode = targetNodeList[0];

    if (mode !== "scroll") {
      doc.body.scrollTo(
        text && targetNode
          ? targetNode.getBoundingClientRect().left
          : text === "prevChapter"
          ? doc.body.scrollWidth
          : 0,
        0
      );
    } else {
      element.scrollTo(
        0,
        text && targetNode ? targetNode.getBoundingClientRect().top : 0
      );
    }
  } else {
    if (mode !== "scroll") {
      doc.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
export const handleTurnChapter = (
  element: HTMLElement,
  chapterList: Chapter[],
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
    handleNextChapter(element, chapterList, chapterDocList, mode);

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
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  let chapterTitle = StorageUtil.getKookitConfig("chapterTitle");
  let chapterIndex = _.findIndex(chapterList, {
    label: chapterTitle,
  });
  if (chapterIndex === chapterList.length - 1 || chapterIndex === -1) {
    return;
  }
  StorageUtil.setKookitConfig(
    "chapterTitle",
    chapterList[chapterIndex + 1].label
  );
  StorageUtil.setKookitConfig("text", "");

  handleRenderChatper(
    chapterList[chapterIndex + 1].label,
    chapterDocList,
    element,
    mode
  );
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
