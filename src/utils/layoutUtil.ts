export const convertStyleNum = (value: number) => {
  if (!value) return 0;
  return parseFloat(value + "");
};
export const convertComputedNum = (value: string) => {
  return parseFloat(value.substring(0, value.length - 2));
};
export const handleIframeHeight = async (
  element: HTMLElement,
  readerMode: string,
  format: string,
  iframe: any,
  doc: Document
) => {
  if (format !== "CACHE") {
    await Promise.all(
      Array.from([...doc.images, ...doc.querySelectorAll("image")]).map(
        (img: any) => {
          if (img.complete) return Promise.resolve(img.naturalHeight !== 0);
          return new Promise((resolve) => {
            img.addEventListener("load", () => resolve(true));
            img.addEventListener("error", () => resolve(false));
          });
        }
      )
    ).then((results) => {
      if (results.every((res) => res))
        console.log("all images loaded successfully!!");
      else console.log("some images failed to load, all finished loading");
    });
  }
  await handleImageSize(element, readerMode, format, doc);
  if (format !== "PDF") {
    handleTextStyle(doc);
  }
  if (readerMode !== "scroll") {
    iframe.height = element.clientHeight + "px";
    if (readerMode === "double") {
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
          "height: " +
            doc.body.clientHeight +
            "px; display: inline-block; width: " +
            (pageWidth - gap) +
            "px"
        );
        doc.body.appendChild(tailElem);
      }
    }
  } else if (format === "PDF") {
    let docLayer = doc.querySelector(".koodoPDFLayer");
    if (!docLayer) return;
    iframe.height = docLayer.getBoundingClientRect().height + 100 + "px";
  } else {
    //fix text blocked issue under scroll readerMode, don't ask me why
    iframe.height = doc.body.scrollHeight + "px";
    iframe.height = doc.body.scrollHeight + 300 + "px";
  }
  // await new Promise((r) => setTimeout(r, 1));
};

export const handleOneChapterDoc = async (item, isSearch: boolean) => {
  let chapterText = "";
  // return;
  if (item.load) {
    let blob = await fetch(await item.load()).then((r) => r.blob());
    chapterText = await blob.text();
  }
  if (isSearch) {
    return chapterText;
  }
  if (item.loadAsset) {
    chapterText = await handlePrecacheAssets(chapterText, item.loadAsset);
  }
  chapterText = handleImageMarker(chapterText);
  return chapterText;
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img, image")) as HTMLElement[];
};
export const handlePrecacheAssets = async (bookStr, loadAsset) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  let imgDomList = getImageElement(chapterDoc) as any;
  for (let subindex = 0; subindex < imgDomList.length; subindex++) {
    if (imgDomList[subindex].getAttribute("src")) {
      imgDomList[subindex].src = await loadAsset(
        imgDomList[subindex].getAttribute("src")
      );
    } else if (imgDomList[subindex].getAttribute("xlink:href")) {
      imgDomList[subindex].setAttribute(
        "xlink:href",
        await loadAsset(imgDomList[subindex].getAttribute("xlink:href"))
      );
    }
  }
  let linkList = Array.from(chapterDoc.getElementsByTagName("link"));
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    if (link.getAttribute("href")) {
      link.href = await loadAsset(link.getAttribute("href"));
    }
  }
  return chapterDoc.documentElement.innerHTML;
};
export const handleImageMarker = (bookStr) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  let imgDomList = getImageElement(chapterDoc);
  if (imgDomList.length === 0) {
    return bookStr;
  } else {
    for (let i = 0; i < imgDomList.length; i++) {
      if (imgDomList[i].tagName === "image") {
        continue;
      }
      var newItem = document.createElement("address");
      var textnode = document.createTextNode("img");
      newItem.appendChild(textnode);
      newItem.setAttribute("style", "visibility: hidden; position: absolute");
      imgDomList[i]?.insertAdjacentElement("afterend", newItem);
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

export const progressInfo = (readerMode: string, doc: Document) => {
  //TODO 是否有必要保留延时
  // if (parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") === 1) {
  //   await new Promise((r) => setTimeout(r, 1000));
  // }
  return {
    totalPage:
      readerMode === "scroll"
        ? 1
        : parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") + 1,
    currentPage:
      parseInt(
        convertStyleNum(doc.body.scrollLeft) / doc.body.clientWidth + ""
      ) + 1,
  };
};
export const handleTextStyle = (doc: Document) => {
  let textNodes = doc.querySelectorAll(
    "a, article, cite, div, li, p, span, pre, table, bold, body"
  ) as any;
  for (let index = 0; index < textNodes.length; index++) {
    const element = textNodes[index];
    if (element.className.indexOf("kookit-text") === -1) {
      element.className = element.className + " kookit-text";
    }
  }
};
export const getImageMeta = async (url) => {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    console.log(error);
  }
  return img;
};
export const handleImageSize = async (
  element: HTMLElement,
  readerMode: string,
  format: string,
  doc: Document
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let imgs = doc.querySelectorAll("img, image") as any;
  for (let item of imgs) {
    let parentItem = item.parentElement;
    let maxHeight = 0;
    let maxWidth = 0;
    let width = item.naturalWidth;
    let height = item.naturalHeight;
    if (item.tagName === "image") {
      let img = await getImageMeta(item.getAttribute("xlink:href"));
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
    if (format.startsWith("CB") && readerMode === "scroll") {
      maxWidth = parentItem.offsetWidth;
    } else if (format.startsWith("CB") && readerMode === "single") {
      maxHeight = element.clientHeight;
      maxWidth = element.clientWidth;
    } else if (parentItem && width && height) {
      let isImageScaleLargerThanElement =
        height / width > parentItem.clientHeight / parentItem.clientWidth;
      if (isImageScaleLargerThanElement) {
        maxHeight = parentItem.clientHeight;
        maxWidth = parseInt((maxHeight * width) / height + "");
      } else {
        maxWidth = parentItem.clientWidth;
        maxHeight = parseInt((maxWidth * height) / width + "");
      }
      if (maxHeight > doc.body.clientHeight) {
        maxWidth = parseInt(
          maxWidth * (doc.body.clientHeight / maxHeight) + ""
        );
        maxHeight = doc.body.clientHeight;
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
    if (maxWidth) {
      maxWidth = Math.min(
        readerMode === "scroll" || readerMode === "single"
          ? element.clientWidth
          : (element.clientWidth - gap) / 2,
        maxWidth
      );
    } else {
      maxWidth =
        readerMode === "scroll" || readerMode === "single"
          ? element.clientWidth
          : (element.clientWidth - gap) / 2;
    }
    if (width && height) {
      if (width > height) {
        maxHeight = maxWidth * (height / width);
      } else {
        if (maxHeight / maxWidth > height / width) {
          maxHeight = maxWidth * (height / width);
        } else {
          maxWidth = maxHeight * (width / height);
        }
      }
    }
    if (maxWidth || maxHeight) {
      item.setAttribute(
        "style",
        (item.getAttribute("style") ? item.getAttribute("style") : "") +
          ";" +
          `max-width: ${maxWidth > 0 ? maxWidth + "px" : ""};max-height:${
            maxHeight > 0 ? maxHeight + "px" : ""
          }; margin: 0 auto;`
      );
    }
  }
};

export const handleLayout = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  let style = doc.createElement("style");
  style.id = "default-style";
  style.textContent =
    "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";
  doc.head.appendChild(style);
  if (readerMode === "scroll") return;
  let scale = readerMode === "double" ? 2 : 1;
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  doc.body.setAttribute(
    "style",
    `width: auto;height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
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
export function getSelectedElement(doc: Document) {
  const selection = doc.getSelection();
  if (!selection) return null;
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const selectedElement = range.startContainer.parentElement;
    return selectedElement;
  }
  return null;
}
