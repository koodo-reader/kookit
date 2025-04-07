import ChapterDoc from "../model/chapterDoc";

export const handleRenderPDFChapter = async (
  chapterDocIndex: number,
  chapterTitle: string,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  readerMode: string,
  tempLocation: any,
  doc: Document
) => {
  let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  console.log(subIframe, "subiframe");
  let subDoc = subIframe?.contentDocument;
  console.log(subDoc, "subdoc");
  if (!subDoc) return;
  console.log(subDoc.body.innerHTML, "subdocbody");
  if (subDoc.body.innerHTML) {
    return;
  }
  subDoc.body.innerHTML = "";
  let blob = await fetch(
    await chapterDocList[chapterDocIndex].text.load()
  ).then((r) => r.blob());
  let chapterText = await blob.text();
  subDoc.body.innerHTML = chapterText;
  let scale = await getPdfScale(
    element,
    readerMode,
    chapterDocList,
    chapterDocIndex
  );
  await chapterDocList[chapterDocIndex].text.render(subDoc, scale, readerMode);

  tempLocation.chapterTitle = chapterTitle;
  tempLocation.chapterHref = chapterHref;
  tempLocation.chapterDocIndex = chapterDocIndex + "";
  tempLocation.percentage = chapterDocIndex / chapterDocList.length + "";
  tempLocation.text = "";
};
export const getPdfScale = async (
  element: HTMLElement,
  readerMode: string,
  chapterDocList: ChapterDoc[],
  chapterDocIndex: number
) => {
  let { width, height } = await chapterDocList[
    chapterDocIndex
  ].text.getDimension();
  let columnNum = readerMode === "double" ? 2 : 1;
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let viewWidth = (element.clientWidth - gap) / columnNum;
  if (readerMode === "single") {
    viewWidth = element.clientWidth;
  }
  let viewHeight = element.clientHeight;
  let scale = Math.min(viewWidth / width, viewHeight / height);
  if (readerMode === "scroll") {
    scale = viewWidth / width;
  }
  return scale;
};
export const handlePDFLayout = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  if (readerMode === "scroll") return;
  let scale = readerMode === "double" ? 2 : 1;
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  doc.body.setAttribute(
    "style",
    element.getAttribute("style") +
      `height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action: pan-y; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
        (element.clientWidth - gap) / scale
      }px;`
  );
};
export const createPDFIframe = (
  element: HTMLElement,
  chapterDocList: ChapterDoc[],
  viewport: any
) => {
  for (let index = 0; index < chapterDocList.length; index++) {
    // Create container with aspect ratio
    const iframeContainer = document.createElement("div");
    iframeContainer.style.position = "relative";
    iframeContainer.style.width = "100%";

    // Set aspect ratio based on PDF page dimensions
    const aspectRatio = viewport?.width / viewport?.height || 0.75; // Default to 3:4 if viewport unknown
    iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100}%`;

    // Create iframe with absolute positioning
    let iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.fontSize = "100%";
    iframe.style.font = "inherit";
    iframe.scrolling = "no";
    iframe.tabIndex = 0;
    iframe.id = "pdf-iframe-" + index;

    // Add style element
    let style = document.createElement("style");
    style.id = "default-style";
    style.textContent =
      "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";

    // Append iframe to container, then container to parent
    iframeContainer.appendChild(iframe);
    element.appendChild(iframeContainer);

    // Add style to iframe after it's in the DOM
    iframe.contentDocument?.head.appendChild(style);
  }
};
export const handleScrollPDFPosition = async (
  chapterDocIndex: number,
  doc: Document
) => {
  let targetNode = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  if (!targetNode) return;

  targetNode.scrollIntoView();
};
export const handlePDFScrollEvent = (
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  readerMode: string,
  tempLocation: any,
  doc: Document
) => {
  let subIframes = doc.querySelectorAll("iframe");
  console.log(subIframes, "subiframes");
  for (let index = 0; index < subIframes.length; index++) {
    let subIframe = subIframes[index];
    if (isPDFScrolledIntoView(element, subIframe, readerMode)) {
      handleRenderPDFChapter(
        index,
        "",
        "",
        chapterDocList,
        element,
        readerMode,
        tempLocation,
        doc
      );
    }
  }
};
export const isPDFScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  console.log(rect, "rect");
  if (readerMode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.clientWidth;
  } else {
    let elemTop = rect.top;
    let elemBottom = rect.bottom;
    isVisible =
      (elemTop >= element.scrollTop &&
        elemTop <= element.scrollTop + element.clientHeight) ||
      (elemBottom >= element.scrollTop &&
        elemBottom <= element.scrollTop + element.clientHeight);
  }
  return isVisible;
};
