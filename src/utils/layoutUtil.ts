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
export const handleIframeHeight = () => {
  let iFrame: any = document.getElementsByTagName("iframe")[0];
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
    let lastItemA = itemAs[itemAs.length - 1];
    let lastItemP = itemPs[itemPs.length - 1];

    let lastItem = lastItemP || lastItemA;
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
  chapterDocList: ChapterDoc[]
) => {
  let iframe = document.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) return;
  let isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
  if (isFirefox) {
    doc.addEventListener(
      "DOMMouseScroll",
      () => {
        handleRecord();
        handleTurnChapter(element, chapterList, chapterDocList);
      },
      false
    );
  } else {
    doc.addEventListener(
      "mousewheel",
      (event) => {
        handleRecord();
        handleTurnChapter(element, chapterList, chapterDocList);
      },
      false
    );
  }
};
export const handleTurnChapter = (
  element: HTMLElement,
  chapterList: Chapter[],
  chapterDocList: ChapterDoc[]
) => {
  if (
    Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <
    10
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
    StorageUtil.setReaderConfig(
      "chapterTitle",
      chapterList[
        _.findIndex(chapterList, {
          label: chapterTitle,
        }) + 1
      ].label
    );
    handleRenderChatper(
      chapterList[
        _.findIndex(chapterList, {
          label: chapterTitle,
        }) + 1
      ].label,
      chapterDocList,
      element
    );
    handleIframeHeight();
    handleScrollTop(element);
    handleImageSize();
  }
};
export const handleRecord = () => {
  console.log("test");
  if (lock) return;
  let visibleNode = Array.from(
    window.frames[0].document.getElementsByTagName("*")
  ).filter((s) => isScrolledIntoView(s as any));
  console.log(visibleNode, "visibleNode");
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
export const handleImageSize = () => {
  let iframe = document.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }

  let imgs = doc.getElementsByTagName("img") as any;
  let maxHeight;
  console.log(imgs);
  for (let item of imgs) {
    if (item.width && item.height) {
      let viewer = document.getElementsByClassName(
        "ebook-viewer"
      )[0] as HTMLElement;
      if (!viewer) return;
      maxHeight = (viewer.offsetWidth * item.height) / item.width;
      console.log(maxHeight);
    }

    item.setAttribute("style", `max-width: 100%;max-height:${maxHeight}px`);
  }
};

export const handleRenderChatper = (
  label: string = "",
  chapterDocList: ChapterDoc[],
  element: HTMLElement
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
  handleIframeHeight();
  handleImageSize();
  handleScrollTop(element);
};
export const handleScrollTop = (element: HTMLElement, _text: string = "") => {
  let text = _text || StorageUtil.getReaderConfig("text") || "";
  console.log(text);
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
