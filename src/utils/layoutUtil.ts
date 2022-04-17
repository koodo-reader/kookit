import _ from "underscore";

export const handleIframeHeight = (element: HTMLElement, mode: string) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;

  if (mode !== "scroll") {
    iframe.height = element.offsetHeight + "px";
    return;
  }
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  var body = doc.body,
    html = doc.documentElement;
  iframe.height =
    Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    ) *
      2 +
    "px";

  setTimeout(() => {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc: any = iframe.contentDocument;
    if (!doc) {
      return;
    }
    let body = doc.body;

    let lastchild = body.lastElementChild;
    let lastEle: any = body.lastChild;
    let itemAs = body.getElementsByTagName("a");
    let itemPs = body.getElementsByTagName("p");
    let itemIs = body.getElementsByTagName("img");
    let itemDs = body.getElementsByTagName("div");
    let lastItemA = itemAs[itemAs.length - 1];
    let lastItemP = itemPs[itemPs.length - 1];
    let lastItemI = itemPs[itemIs.length - 1];
    let lastItemD = itemDs[itemDs.length - 1];

    let lastItem: any = lastItemP || lastItemA || lastItemI || lastItemD;
    if (
      _.isElement(lastItemA) &&
      _.isElement(lastItemP) &&
      _.isElement(lastItemD)
    ) {
      if (
        lastItemA.clientHeight + (lastItemA as any).offsetTop >
        lastItemP.clientHeight + (lastItemP as any).offsetTop
      ) {
        lastItem = lastItemA;
      } else {
        lastItem = lastItemP;
      }
      if (
        lastItemD.clientHeight + (lastItemD as any).offsetTop >
        lastItem.clientHeight + (lastItem as any).offsetTop
      ) {
        lastItem = lastItemD;
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
    let targetHeight =
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
      400 +
      (lastEle.nodeType === 3 ? nodeHeight : 0);
    iframe.height = targetHeight + "px";
    // let html = doc.documentElement;
    // if (!html) return;
    // html.setAttribute("style", `height: ${targetHeight}px`);
  }, 500);
};
export const getAzw3Style = (doc: Element) => {
  let style = "";
  if (
    doc.lastChild &&
    doc.lastChild?.lastChild &&
    !isElement(doc.lastChild?.lastChild)
  ) {
    style = doc.lastChild?.lastChild.textContent || "";
  }
  return style;
};

export const createIframe = (element: HTMLElement, styleStr: string = "") => {
  var iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.style.padding = "0";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.style.verticalAlign = "baseline";
  element.innerHTML = "";
  element.appendChild(iframe);
  if (styleStr && iframe.contentDocument) {
    let style = iframe.contentDocument.createElement("style");
    style.id = "azw3-style";
    style.textContent = styleStr;
    iframe.contentDocument.head.appendChild(style);
  }
};

export const progressInfo = () => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  return {
    totalPage: parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") + 1,
    currentPage: parseInt(doc.body.scrollLeft / doc.body.clientWidth + "") + 1,
  };
};
export const handleImageSize = (element: HTMLElement, mode: string) => {
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
  let imgs = doc.getElementsByTagName("img") as any;
  let maxHeight;
  let maxWidth;
  for (let item of imgs) {
    let parentItem = item.parentElement;
    maxHeight = 0;
    maxWidth = 0;
    if (item.width && item.height) {
      let isImageScaleLargerThanElement =
        item.height / item.width >
        parentItem.clientHeight / parentItem.clientWidth;
      if (isImageScaleLargerThanElement) {
        maxHeight = parentItem.clientHeight;
        maxWidth = (maxHeight * item.width) / item.height;
      } else {
        maxWidth = parentItem.clientWidth;
        maxHeight = (maxWidth * item.height) / item.width;
      }
    } else if (
      parentItem &&
      parentItem.clientWidth &&
      parentItem.clientWidth > 0
    ) {
      maxWidth = parentItem.clientWidth;
      maxHeight = parentItem.clientHeight;
    } else {
      maxWidth = element.offsetWidth;
      maxHeight = element.offsetHeight;
    }
    maxWidth = Math.min(
      mode === "scroll" || mode === "single"
        ? element.offsetWidth
        : (element.offsetWidth - gap) / 2,
      maxWidth
    );
    (maxWidth || maxHeight) &&
      item.setAttribute(
        "style",
        `max-width: ${maxWidth > 0 ? maxWidth : ""}px;max-height:${
          maxHeight > 0 ? maxHeight : ""
        }px`
      );
  }
};

export const handleLayout = (element: HTMLElement, mode: string) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let style = doc.createElement("style");
  style.id = "default-style";
  style.textContent =
    "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";
  doc.head.appendChild(style);
  if (mode === "scroll") return;
  let scale = mode === "double" ? 2 : 1;
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  doc.body.setAttribute(
    "style",
    `width: auto;height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;max-width: inherit;column-fill: auto;column-gap: ${gap}px;column-count: 12;column-width: ${
      (element.offsetWidth - gap) / scale
    }px;`
  );
};
export const isElement = (obj) => {
  try {
    //Using W3 DOM2 (works for FF, Opera and Chrome)
    return obj instanceof HTMLElement;
  } catch (e) {
    //Browsers not supporting W3 DOM2 don't have HTMLElement and
    //an exception is thrown and we end up here. Testing some
    //properties that all elements have (works on IE7)
    return (
      typeof obj === "object" &&
      obj.nodeType === 1 &&
      typeof obj.style === "object" &&
      typeof obj.ownerDocument === "object"
    );
  }
};
