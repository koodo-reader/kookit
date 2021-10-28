import _ from "underscore";
import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";
import StorageUtil from "./storageUtil";
let lock = false;
export const isScrolledIntoView = (el: HTMLElement) => {
  var rect = el.getBoundingClientRect();
  var elemTop = rect.top;
  var viewer = document.getElementsByClassName("ebook-viewer")[0];
  var isVisible =
    elemTop >= viewer.scrollTop &&
    elemTop <= viewer.scrollTop + (viewer as any).offsetHeight;

  return isVisible;
};
export const handleIframeHeight = (element: HTMLElement, mode: string) => {
  let iFrame: any = document.getElementsByTagName("iframe")[0];
  console.log(mode, "mode");
  if (mode === "double") {
    console.log(element.offsetHeight);
    iFrame.height = element.offsetHeight - 30;
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
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.style.padding = "0";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.style.verticalAlign = "baseline";
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
        if (mode !== "scroll") {
          handleScrollPage(element, (event as any).detail);
        }
        handleRecord();
        handleTurnChapter(element, chapterList, chapterDocList, mode);
      },
      false
    );
  } else {
    doc.addEventListener(
      "mousewheel",
      (event) => {
        console.log("testsa");
        if (mode !== "scroll") {
          handleScrollPage(element, (event as any).wheelDelta);
        }
        handleRecord();
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
    mode === "scroll"
  ) {
    let chapterTitle = StorageUtil.getReaderConfig("chapterTitle");
    if (
      _.findIndex(chapterList, {
        label: chapterTitle,
      }) ===
      chapterList.length - 1
    ) {
      return;
    }
    let chapterIndex =
      _.findIndex(chapterList, {
        label: chapterTitle,
      }) === -1
        ? 0
        : _.findIndex(chapterList, {
            label: chapterTitle,
          });
    StorageUtil.setReaderConfig(
      "chapterTitle",
      chapterList[chapterIndex + 1].label
    );
    handleRenderChatper(
      chapterList[chapterIndex + 1].label,
      chapterDocList,
      element,
      mode
    );
    handleIframeHeight(element, mode);
    handleScrollTop(element);
    handleImageSize(mode);
  }
};
export const handleRecord = () => {
  if (lock) return;
  let visibleNode = Array.from(
    window.frames[0].document.getElementsByTagName("*")
  ).filter((s) => isScrolledIntoView(s as any));
  let firstVisibleNode = visibleNode[0] as HTMLElement;
  let count = 0;
  let nodeList = Array.from(
    window.frames[0].document.getElementsByTagName("*")
  ) as HTMLElement[];
  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(nodeList[i]) &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML
    ) {
      count = i;
      break;
    }
  }
  StorageUtil.setReaderConfig(
    "text",
    firstVisibleNode ? firstVisibleNode.innerText : ""
  );
  StorageUtil.setReaderConfig("count", count + "");
  lock = true;
  setTimeout(() => {
    lock = false;
  }, 200);
};
export const handleImageSize = (mode: string) => {
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
  let viewer = document.getElementsByClassName(
    "ebook-viewer"
  )[0] as HTMLElement;
  if (!viewer) return;
  for (let item of imgs) {
    if (item.width && item.height) {
      maxWidth = (viewer.offsetWidth - 17) / scale;
      maxHeight =
        (((viewer.offsetWidth - 17) / scale) * item.height) / item.width;
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
  handleIframeHeight(element, mode);
  handleImageSize(mode);
  handleScrollTop(element);
};
export const handleScrollTop = (element: HTMLElement, _text: string = "") => {
  let text = _text || StorageUtil.getReaderConfig("text") || "";
  if (text) {
    let nodeList = Array.from(
      window.frames[0].document.getElementsByTagName("*")
    ) as HTMLElement[];
    let targetNodeList = nodeList.filter(
      (s) => (s as HTMLElement).innerText === text
    );
    let targetNode = targetNodeList[0];
    if (targetNodeList.length > 1) {
      targetNode =
        nodeList[parseInt(StorageUtil.getReaderConfig("count") || "0")];
    }

    document
      .getElementsByClassName("ebook-viewer")[0]
      .scrollTo(0, text && targetNode ? targetNode.offsetTop : 0);
  } else {
    element.scrollTo(0, 0);
  }
};
export const handleLayout = (element: HTMLElement, mode: string) => {
  if (mode === "scroll") return;
  window.frames[0].document.body.setAttribute(
    "style",
    `width: auto;
    height: ${element.offsetHeight - 48}px;
    overflow-y: hide;
    margin: 0px !important;
    padding-left: 44px;
    padding-left: 44px;
    box-sizing: border-box;
    max-width: inherit;
    column-fill: auto;
    column-gap: 88px;
    column-width: ${element.offsetHeight / 2 - 88}px;`
  );

  // window.frames[0].document.querySelectorAll("p").forEach((item) => {
  //   console.log(item);
  //   item.style.display = "inline-block";
  //   item.style.width = "200px !important";
  // });
};
export const handleScrollPage = (element: HTMLElement, delta: number) => {
  console.log(element.scrollLeft, delta);
  if (delta > 0) {
    window.frames[0].document.body.scrollLeft += element.offsetWidth;
  } else if (delta < 0 && window.frames[0].document.body.scrollLeft > 0) {
    window.frames[0].document.body.scrollLeft -= element.offsetWidth;
  }
};
