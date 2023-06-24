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
  mode: string,
  iframe: any,
  format: string
) => {
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  await Promise.all(
    Array.from(doc.images).map((img: any) => {
      if (img.complete) return Promise.resolve(img.naturalHeight !== 0);
      return new Promise((resolve) => {
        img.addEventListener("load", () => resolve(true));
        img.addEventListener("error", () => resolve(false));
      });
    })
  ).then((results) => {
    if (results.every((res) => res))
      console.log("all images loaded successfully!");
    else console.log("some images failed to load, all finished loading");
  });
  handleImageSize(element, mode, format);
  // await new Promise((r) => setTimeout(r, 1000));
  if (mode !== "scroll") {
    iframe.height = element.clientHeight + "px";
    if (mode === "double") {
      let section = Math.floor(element.clientWidth / 12);
      let gap = section % 2 === 0 ? section : section - 1;
      let pageWidth = (element.clientWidth + gap) / 2;
      if (
        ((doc.body.scrollWidth - doc.body.clientWidth) / pageWidth) % 2 ===
        1
      ) {
        let tailElem = document.createElement("div");
        tailElem.setAttribute(
          "style",
          "height: " + doc.body.clientHeight + "px"
        );
        doc.body.appendChild(tailElem);
      }
    }
  } else {
    iframe.height = doc.body.scrollHeight + "px";
  }
};

export const handleOneChapterDoc = async (item) => {
  let chapterText = await (item.load
    ? (await fetch(await item.load()).then((r) => r.blob())).text()
    : "");
  return handleImageMarker(chapterText);
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img, image")) as HTMLElement[];
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
        let pageArea = document.getElementById("page-area");
        if (!pageArea) return;
        (imgDomList[i].parentNode as any).setAttribute(
          "style",
          "max-width: 100%; max-height: " + pageArea.clientHeight + "px"
        );
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
  iframe.style.minHeight = "calc(100% - 2px)";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.scrolling = "no";
  iframe.tabIndex = 0;
  iframe.style.verticalAlign = "baseline";
  element.innerHTML = "";
  element.appendChild(iframe);
};

export const progressInfo = async (mode: string) => {
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
    totalPage:
      mode === "scroll"
        ? 1
        : parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") + 1,
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
  let imgs = doc.querySelectorAll("img, image") as any;
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
