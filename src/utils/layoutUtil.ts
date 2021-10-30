import _ from "underscore";
import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";
import StorageUtil from "./storageUtil";
let lock = false;
export const isScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  mode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (mode !== "continuous" && el.innerText.trim()) {
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
export const handleIframeHeight = (element: HTMLElement, mode: string) => {
  let iFrame: any = document.getElementsByTagName("iframe")[0];
  if (mode !== "continuous") {
    iFrame.height = element.offsetHeight;
    return;
  }
  var body = iFrame.contentWindow.document.body,
    html = iFrame.contentWindow.document.documentElement;
  iFrame.height =
    Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    ) * 2;

  setTimeout(() => {
    let iFrame: any = document.getElementsByTagName("iframe")[0];

    let body = iFrame.contentWindow.document.body;
    let lastchild = body.lastElementChild;
    let lastEle = body.lastChild;
    let itemAs = body.querySelectorAll("a");
    let itemPs = body.querySelectorAll("p");
    let itemIs = body.querySelectorAll("img");
    let lastItemA = itemAs[itemAs.length - 1];
    let lastItemP = itemPs[itemPs.length - 1];
    let lastItemI = itemPs[itemIs.length - 1];

    let lastItem = lastItemP || lastItemA || lastItemI;
    if (_.isElement(lastItemA) && _.isElement(lastItemP)) {
      if (
        lastItemA.clientHeight + (lastItemA as any).offsetTop >
        lastItemP.clientHeight + (lastItemP as any).offsetTop
      ) {
        lastItem = lastItemA;
      } else {
        lastItem = lastItemP;
      }
    }
    if (_.isElement(lastItemI)) {
      if (
        lastItemI.clientHeight + (lastItemI as any).offsetTop >
        lastItem.clientHeight + (lastItem as any).offsetTop
      ) {
        lastItem = lastItemI;
      }
    }
    let nodeHeight = 0;

    if (!lastchild && !lastItem && !lastEle) return;
    if (lastEle.nodeType === 3 && !lastchild && !lastItem) return;

    if (lastEle.nodeType === 3) {
      if (document.createRange) {
        let range = document.createRange();
        range.selectNodeContents(lastEle);
        if (range.getBoundingClientRect) {
          let rect = range.getBoundingClientRect();
          if (rect) {
            nodeHeight = rect.bottom - rect.top;
          }
        }
      }
    }

    iFrame.height =
      Math.max(
        _.isElement(lastchild)
          ? lastchild.clientHeight + (lastchild as any).offsetTop
          : 0,
        _.isElement(lastEle)
          ? lastEle.clientHeight + (lastEle as any).offsetTop
          : 0,
        _.isElement(lastItem)
          ? lastItem.clientHeight + (lastItem as any).offsetTop
          : 0
      ) +
      600 +
      (lastEle.nodeType === 3 ? nodeHeight : 0);
  }, 500);
};
export const createIframe = (element: HTMLElement) => {
  var iframe = document.createElement("iframe");
  iframe.style.width = element.offsetWidth + "px";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.style.padding = "0";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.style.verticalAlign = "baseline";
  element.innerHTML = "";
  element.appendChild(iframe);
};
export const bindEvent = (
  element: HTMLElement,
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[],
  mode: string
) => {
  let iframe = document.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) return;
  let isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
  if (isFirefox) {
    doc.addEventListener(
      "DOMMouseScroll",
      (event) => {
        if (mode !== "continuous") {
          handleScrollPage(
            element,
            chapterList,
            chapterDocList,
            mode,
            (event as any).detail
          );
        }
        handleRecord(element, mode);
        handleTurnChapter(element, chapterList, chapterDocList, mode);
      },
      false
    );
  } else {
    doc.addEventListener(
      "mousewheel",
      (event) => {
        if (mode !== "continuous") {
          handleScrollPage(
            element,
            chapterList,
            chapterDocList,
            mode,
            (event as any).wheelDelta
          );
        }
        handleRecord(element, mode);
        handleTurnChapter(element, chapterList, chapterDocList, mode);
      },
      false
    );
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
    handleRenderChatper(
      chapterList[chapterIndex + 1].label,
      chapterDocList,
      element,
      mode
    );
  }
};
export const handleRecord = (element: HTMLElement, mode: string) => {
  if (lock) return;
  let visibleNode = Array.from(
    window.frames[0].document.body.getElementsByTagName("*")
  ).filter(
    (s) =>
      isScrolledIntoView(element, s as any, mode) &&
      (s as HTMLElement).innerText.trim() &&
      s.tagName !== "A" &&
      s.tagName !== "SPAN"
  );

  let firstVisibleNode = visibleNode[0] as HTMLElement;
  let count = 0;
  let nodeList = Array.from(
    window.frames[0].document.body.getElementsByTagName("*")
  ) as HTMLElement[];
  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], mode) &&
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
export const handleImageSize = (element: HTMLElement, mode: string) => {
  let iframe = document.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }

  let imgs = doc.getElementsByTagName("img") as any;
  let maxHeight;
  let maxWidth;
  let scale = mode === "double" ? 2 : 1;
  for (let item of imgs) {
    if (item.width && item.height) {
      let isImageScaleLargerThanElement =
        item.height / item.width >
        element.offsetHeight / ((element.offsetWidth - 88) / scale);
      if (isImageScaleLargerThanElement) {
        maxHeight = element.offsetHeight;
        maxWidth = (maxHeight * item.width) / item.height;
      } else {
        maxWidth = (element.offsetWidth - 88) / scale;
        maxHeight = (maxWidth * item.height) / item.width;
      }
    } else {
      maxWidth = (element.offsetWidth - 88) / scale;
      maxHeight = element.offsetHeight;
    }

    item.setAttribute(
      "style",
      `max-width: ${maxWidth}px;max-height:${maxHeight}px`
    );
  }
};

export const handleRenderChatper = (
  label: string = "",
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  mode: string
) => {
  window.frames[0].document.body.innerHTML = "";

  window.frames[0].document.body.innerHTML =
    chapterDocList[
      _.findIndex(chapterDocList, {
        title: label,
      }) === -1
        ? 0
        : _.findIndex(chapterDocList, {
            title: label,
          })
    ].text;
  StorageUtil.setKookitConfig("chapterTitle", label);
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
  if (text) {
    let nodeList = Array.from(
      window.frames[0].document.body.getElementsByTagName("*")
    ) as HTMLElement[];
    let targetNodeList = nodeList.filter(
      (s) => (s as HTMLElement).innerText === text
    );

    let targetNode = targetNodeList[0];
    if (targetNodeList.length > 1) {
      targetNode =
        nodeList[
          parseInt(_count || StorageUtil.getKookitConfig("count") || "0")
        ];
    }

    if (mode !== "continuous") {
      window.frames[0].document.body.scrollTo(
        text && targetNode ? targetNode.offsetLeft : 0,
        0
      );
    } else {
      element.scrollTo(0, text && targetNode ? targetNode.offsetTop : 0);
    }
  } else {
    if (mode !== "continuous") {
      window.frames[0].document.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
export const handleLayout = (element: HTMLElement, mode: string) => {
  if (mode === "continuous") return;
  let scale = mode === "double" ? 2 : 1;
  window.frames[0].document.body.setAttribute(
    "style",
    `width: auto;
    height: 100%;
    overflow-y: hidden;
    overflow-X: hidden;
    padding-left: 0px;
    padding-right: 0px;
    margin: 0px !important;
    box-sizing: border-box;
    max-width: inherit;
    column-fill: auto;
    column-gap: 88px;
    column-count: 12;
    column-width: ${(element.offsetWidth - 88) / scale}px;`
  );
};
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
  if (chapterIndex === 0 || chapterIndex === -1) {
    return;
  }
  StorageUtil.setKookitConfig(
    "chapterTitle",
    chapterList[chapterIndex - 1].label
  );
  handleRenderChatper(
    chapterList[chapterIndex - 1].label,
    chapterDocList,
    element,
    mode
  );
};
