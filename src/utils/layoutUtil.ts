import _ from "underscore";
import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";
import StorageUtil from "./storageUtil";
let lock = false;
export const isScrolledIntoView = (el: HTMLElement) => {
  var rect = el.getBoundingClientRect();
  var elemTop = rect.top;
  var viewer = document.getElementsByClassName("ebook-viewer")[0];
  var screen = document.getElementsByClassName("viewer")[0];
  var isVisible =
    elemTop >= viewer.scrollTop &&
    elemTop <= viewer.scrollTop + (screen as HTMLElement).offsetHeight;

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
export const bindEvent = (element: HTMLElement, chapterList: Chapter[]) => {
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
        handleTurnChapter(element, chapterList);
      },
      false
    );
  } else {
    doc.addEventListener(
      "mousewheel",
      (event) => {
        handleRecord();
        handleTurnChapter(element, chapterList);
      },
      false
    );
  }
};
export const handleTurnChapter = (
  element: HTMLElement,
  chapterList: Chapter[]
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
  }
};
export const handleRecord = () => {
  if (lock) return;
  StorageUtil.setReaderConfig(
    "text",
    (Array.from(
      window.frames[0].document.getElementsByTagName("p")
    ).filter((s) => isScrolledIntoView(s as any))[0] as HTMLElement)
      ? (Array.from(
          window.frames[0].document.getElementsByTagName("p")
        ).filter((s) => isScrolledIntoView(s as any))[0] as HTMLElement)
          .innerText
      : ""
  );

  lock = true;
  setTimeout(() => {
    lock = false;
  }, 200);
};
export const handleImageSize = (element: HTMLElement) => {
  let iframe = document.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }

  let imgs = doc.getElementsByTagName("img") as any;
  let maxHeight;
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
  chapterDocList: ChapterDoc[]
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
};
