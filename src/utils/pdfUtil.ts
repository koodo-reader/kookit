import ChapterDoc from "../model/chapterDoc";
import { convertStyleNum } from "./layoutUtil";
import _ from "underscore";
import { getBlockElement } from "./navigationUtil";
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
  let subDoc = subIframe?.contentDocument;
  if (!subDoc) return;
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
  readerMode: string,
  doc: Document
) => {
  let targetNode: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  if (!targetNode) return;
  targetNode = targetNode.parentElement;

  if (readerMode !== "scroll") {
    let left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    console.log(left, "left");
    doc.body.scrollTo(left, 0);
  } else {
    targetNode.scrollIntoView();
  }
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
export const renderPdfPage = async (
  chapterDocIndex: number,
  chapterTitle: string,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  readerMode: string,
  tempLocation: any,
  doc: Document
) => {
  await handleRenderPDFChapter(
    chapterDocIndex,
    chapterTitle,
    chapterHref,
    chapterDocList,
    element,
    readerMode,
    tempLocation,
    doc
  );
  if (readerMode === "double") {
    await handleRenderPDFChapter(
      chapterDocIndex + 1,
      chapterTitle,
      chapterHref,
      chapterDocList,
      element,
      readerMode,
      tempLocation,
      doc
    );
  }
};
export const handlePDFRecord = async (
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
      tempLocation.chapterDocIndex = index + "";
      tempLocation.percentage = index / subIframes.length + "";
      break;
    }
  }
};
export const getPDFVisibleText = (
  chapterDocIndex: number,
  readerMode: string,
  doc: Document
) => {
  let text: any = "";
  let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  let subDoc = subIframe?.contentDocument;
  if (!subDoc) return;
  text = subDoc.body.innerText;
  if (readerMode === "double") {
    let subIframe2: any = doc.getElementById(
      "pdf-iframe-" + (chapterDocIndex + 1)
    );
    let subDoc2 = subIframe2?.contentDocument;
    if (subDoc2) {
      text += subDoc2.body.innerText;
    }
  }
  return text;
};
export const handleHighlightPDFNode = (
  text: string,
  style: string,
  doc: Document
) => {
  let chapterDocIndex = parseInt(text.split("#").reverse()[0]);
  let str = text.split("#").slice(0, -1).join("#");
  let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  let subDoc = subIframe?.contentDocument;
  if (!subDoc) return;
  let nodeList = subDoc.querySelectorAll("p,span");
  console.log(nodeList, "nodeList");
  let nodes: any[] = Array.from(nodeList).filter((s: any) => {
    if (s.getAttribute("style") === style) {
      s.setAttribute("style", "");
    }

    return (
      ((s as HTMLElement).textContent || "").trim() &&
      (s as HTMLElement).textContent === str
    );
  });
  console.log(nodes, "nodes");
  if (nodes.length > 0) {
    nodes[0].setAttribute("style", style);
  }
};
export const getPDFSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let textContent = await chapterDocList[i].text.getTextContent();
    console.log(textContent, "textContent");

    let keyWordIndex = textContent.items.findIndex((item: any) => {
      return item.str.indexOf(keyword) > -1;
    });
    if (keyWordIndex > -1) {
      searchResult.push({
        excerpt: textContent.items[keyWordIndex].str,
        cfi: JSON.stringify({
          text: textContent.items[keyWordIndex].str + "#" + i,
          chapterTitle: chapterDocList[i].label,
          chapterDocIndex: i,
          chapterHref: chapterDocList[i].href,
          count: "search",
          percentage: i / chapterDocList.length,
        }),
      });
    }
  }
  return _.uniq(searchResult, "excerpt");
};
