declare var window: any;
export const getStyleNum = (value: string) => {
  if (!value) return 0;
  return parseInt(value.substr(0, value.length - 2));
};
export const convertStyleNum = (value: number) => {
  if (!value) return 0;
  return parseInt(value + "");
};
export const handleIframeHeight = async (
  element: HTMLElement,
  mode: string
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;

  if (mode !== "scroll") {
    iframe.height = element.clientHeight + "px";
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
  iframe.scrolling = "no";
  await new Promise((r) => setTimeout(r, 1000));

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
    window._.isElement(lastItemA) &&
    window._.isElement(lastItemP) &&
    window._.isElement(lastItemD)
  ) {
    if (
      lastItemA.clientHeight + convertStyleNum((lastItemA as any).offsetTop) >
      lastItemP.clientHeight + convertStyleNum((lastItemP as any).offsetTop)
    ) {
      lastItem = lastItemA;
    } else {
      lastItem = lastItemP;
    }
    if (
      lastItemD.clientHeight + convertStyleNum((lastItemD as any).offsetTop) >
      lastItem.clientHeight + convertStyleNum((lastItem as any).offsetTop)
    ) {
      lastItem = lastItemD;
    }
  }
  if (window._.isElement(lastItemI)) {
    if (
      lastItemI.clientHeight + convertStyleNum((lastItemI as any).offsetTop) >
      lastItem.clientHeight + convertStyleNum((lastItem as any).offsetTop)
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
      window._.isElement(lastchild)
        ? lastchild!.clientHeight +
            convertStyleNum((lastchild as any).offsetTop)
        : 0,
      window._.isElement(lastEle)
        ? lastEle.clientHeight + convertStyleNum((lastEle as any).offsetTop)
        : 0,
      window._.isElement(lastItem)
        ? lastItem.clientHeight + convertStyleNum((lastItem as any).offsetTop)
        : 0
    ) +
    400 +
    (lastEle.nodeType === 3 ? nodeHeight : 0);
  iframe.height = targetHeight + "px";
  // let html = doc.documentElement;
  // if (!html) return;
  // html.setAttribute("style", `height: ${targetHeight}px`);
};

export const handleOneChapterDoc = async (item) => {
  let chapterText = await (item.load
    ? (await fetch(await item.load()).then((r) => r.blob())).text()
    : "");
  return handleImageMarker(chapterText);
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img")) as HTMLElement[];
};
export const handleImageMarker = (bookStr) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  let imgDomList = getImageElement(chapterDoc);
  if (imgDomList.length === 0) {
    return bookStr;
  } else {
    for (let i = 0; i < imgDomList.length; i++) {
      var newItem = document.createElement("address");
      var textnode = document.createTextNode("img");
      newItem.appendChild(textnode);
      newItem.setAttribute("style", "visibility: hidden; position: absolute");
      if (imgDomList[i].parentNode) {
        (imgDomList[i].parentNode as any).insertBefore(newItem, imgDomList[i]);
      }
    }
    return chapterDoc.documentElement.innerHTML;
  }
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
};

export const progressInfo = async () => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  if (parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") === 1) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  return {
    totalPage: parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") + 1,
    currentPage:
      parseInt(
        convertStyleNum(doc.body.scrollLeft) / doc.body.clientWidth + ""
      ) + 1,
  };
};
export const handleImageSize = (
  element: HTMLElement,
  mode: string,
  format: string
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
  let imgs = doc.getElementsByTagName("img") as any;
  for (let item of imgs) {
    let parentItem = item.parentElement;
    let maxHeight = 0;
    let maxWidth = 0;
    if (format.startsWith("CB") && mode === "scroll") {
      maxWidth = parentItem.offsetWidth;
    } else if (format.startsWith("CB") && mode === "single") {
      maxHeight = element.clientHeight;
      maxWidth = element.clientWidth;
    } else if (item.width && item.height) {
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
      maxWidth = element.clientWidth;
      maxHeight = element.clientHeight;
    }
    maxWidth = Math.min(
      mode === "scroll" || mode === "single"
        ? element.clientWidth
        : (element.clientWidth - gap) / 2,
      maxWidth
    );
    (maxWidth || maxHeight) &&
      item.setAttribute(
        "style",
        `max-width: ${maxWidth > 0 ? maxWidth + "px" : ""};max-height:${
          maxHeight > 0 ? maxHeight + "px" : ""
        }; ${
          format.startsWith("CB")
            ? "display: block; margin-left: auto; margin-right: auto;"
            : ""
        }`
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
      (element.clientWidth - gap) / scale
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
