import _ from "underscore";

export const handleIframeHeight = (element: HTMLElement, mode: string) => {
  let iFrame: any = document.getElementsByTagName("iframe")[0];
  if (mode !== "scroll") {
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
    let itemAs = body.getElementsByTagName("a");
    let itemPs = body.getElementsByTagName("p");
    let itemIs = body.getElementsByTagName("img");
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
      400 +
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
  element.innerHTML = "";
  element.appendChild(iframe);
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
  let maxWidth;
  for (let item of imgs) {
    let parentItem = item.parentElement;
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
    } else {
      maxWidth = parentItem.clientWidth;
    }
    item.setAttribute(
      "style",
      `max-width: ${maxWidth}px;max-height:${maxHeight}px`
    );
  }
};

export const handleLayout = (element: HTMLElement, mode: string) => {
  if (mode === "scroll") return;
  let scale = mode === "double" ? 2 : 1;
  window.frames[0].document.body.setAttribute(
    "style",
    `width: auto;
    height: 100%;
    overflow-y: hidden;
    overflow-X: scroll;
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
