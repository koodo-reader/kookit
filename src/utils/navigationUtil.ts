import _ from "underscore";
import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";
import { handleIframeHeight, handleImageSize } from "./layoutUtil";
import StorageUtil from "./storageUtil";
let lock = false;
export const handleScrollPage = (
  element: HTMLElement,
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string,
  delta: number
) => {
  if (delta > 0 && window.frames[0].document.body.scrollLeft > 0) {
    window.frames[0].document.body.scrollLeft -= element.offsetWidth + 88;
  } else if (delta > 0 && window.frames[0].document.body.scrollLeft === 0) {
    handlePrevChapter(element, chapterList, chapterDocList, mode);
  } else if (delta < 0) {
    handleTurnChapter(element, chapterList, chapterDocList, mode);
    window.frames[0].document.body.scrollLeft += element.offsetWidth + 88;
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
  window.frames[0].document.body.innerHTML = "";
  let chapterIndex = _.findIndex(chapterDocList, {
    title: label,
  });
  chapterIndex = chapterIndex === -1 ? 0 : chapterIndex;
  window.frames[0].document.body.innerHTML = chapterDocList[chapterIndex].text;
  StorageUtil.setKookitConfig(
    "chapterTitle",
    chapterDocList[chapterIndex].title
  );
  handleIframeHeight(element, mode);
  handleImageSize();
  handleScrollPosition(element, mode);
};
export const handleScrollPosition = (
  element: HTMLElement,
  mode: string,
  _text: string = "",
  _count: string = "0"
) => {
  let text = _text || StorageUtil.getKookitConfig("text") || "";
  if (text) {
    let nodeList = Array.from(
      window.frames[0].document.body.querySelectorAll("h1,h2,h3,h4,p")
    ) as HTMLElement[];
    let targetNodeList = nodeList.filter(
      (s, index) =>
        (s as HTMLElement).innerText === text &&
        index === parseInt(StorageUtil.getKookitConfig("count") || _count)
    );

    let targetNode = targetNodeList[0];
    if (mode !== "scroll") {
      window.frames[0].document.body.scrollTo(
        text && targetNode
          ? targetNode.offsetLeft
          : text === "prevChapter"
          ? window.frames[0].document.body.scrollWidth
          : 0,
        0
      );
    } else {
      element.scrollTo(0, text && targetNode ? targetNode.offsetTop : 0);
    }
  } else {
    if (mode !== "scroll") {
      window.frames[0].document.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
export const handleTurnChapter = (
  element: HTMLElement,
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  if (
    Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <
      10 &&
    Math.abs(
      window.frames[0].document.body.scrollWidth -
        window.frames[0].document.body.scrollLeft -
        window.frames[0].document.body.clientWidth
    ) < 10
  ) {
    handleNextChapter(element, chapterList, chapterDocList, mode);
  }
};
export const handleRecord = (element: HTMLElement, mode: string) => {
  if (lock) return;
  let visibleNode = Array.from(
    window.frames[0].document.body.querySelectorAll("h1,h2,h3,h4,p")
  ).filter(
    (s) =>
      isScrolledIntoView(element, s as any, mode) &&
      (s as HTMLElement).innerText.trim()
  );
  let nodeIndex = mode === "scroll" ? Math.floor(visibleNode.length / 2) : 0;
  let firstVisibleNode = visibleNode[nodeIndex] as HTMLElement;
  let count = 0;
  let nodeList = Array.from(
    window.frames[0].document.body.querySelectorAll("h1,h2,h3,h4,p")
  ) as HTMLElement[];
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
    firstVisibleNode ? firstVisibleNode.innerText : ""
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
export const isScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  mode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (mode !== "scroll" && el.innerText.trim()) {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.offsetWidth;
  } else if (el.innerText.trim()) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.offsetHeight;
  }
  return isVisible;
};
