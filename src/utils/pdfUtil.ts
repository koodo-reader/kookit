import ChapterDoc from "../model/chapterDoc";
import { convertStyleNum } from "./layoutUtil";
import _ from "underscore";
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
      `height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action: manipulation; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
        (element.clientWidth - gap) / scale
      }px;`
  );
};
export const createPDFContainer = (
  element: HTMLElement,
  chapterDocList: ChapterDoc[],
  viewport: any,
  readerMode: string
) => {
  for (let index = 0; index < chapterDocList.length; index++) {
    // Create container with aspect ratio
    const iframeContainer = document.createElement("div");
    iframeContainer.style.position = "relative";
    iframeContainer.style.width = "100%";
    iframeContainer.id = "pdf-container-" + index;
    iframeContainer.className = "pdf-container";

    // Set aspect ratio based on PDF page dimensions
    const aspectRatio = viewport?.width / viewport?.height || 0.75; // Default to 3:4 if viewport unknown
    iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100}%`;
    if (readerMode === "double") {
      //break-inside: avoid;
      iframeContainer.style.breakInside = "avoid";
    }

    element.appendChild(iframeContainer);
  }
};
export const createPDFIframe = (chapterDocIndex: number, doc: Document) => {
  const iframeContainer = doc.getElementById(
    "pdf-container-" + chapterDocIndex
  );
  if (!iframeContainer) return;
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
  iframe.id = "pdf-iframe-" + chapterDocIndex;

  // Add style element
  let style = document.createElement("style");
  style.id = "default-style";
  style.textContent =
    "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";

  // Append iframe to container, then container to parent
  iframeContainer.appendChild(iframe);

  // Add style to iframe after it's in the DOM
  iframe.contentDocument?.head.appendChild(style);
  return iframe;
};
export const handleScrollPDFPosition = async (
  chapterDocIndex: number,
  readerMode: string,
  doc: Document
) => {
  let targetNode: any = doc.getElementById("pdf-container-" + chapterDocIndex);
  if (!targetNode) return;

  if (readerMode !== "scroll") {
    let left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    doc.body.scrollTo(left, 0);
  } else {
    targetNode.scrollIntoView();
  }
  targetNode.scrollIntoView();
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
      (elemTop - 10 >= element.scrollTop &&
        elemTop + 10 <= element.scrollTop + element.clientHeight) ||
      (elemBottom - 10 >= element.scrollTop &&
        elemBottom + 10 <= element.scrollTop + element.clientHeight) ||
      (elemTop + 10 <= element.scrollTop &&
        elemBottom - 10 >= element.scrollTop + element.clientHeight);
  }
  return isVisible;
};

export const getPDFVisibleText = async (
  chapterDocIndex: number,
  chapterDocList: ChapterDoc[],
  readerMode: string
) => {
  let textContent = await chapterDocList[chapterDocIndex].text.getTextContent();

  let textList = textContent.items.map((item: any) => {
    return item.str;
  });
  if (readerMode === "double") {
    let nextTextContent = await chapterDocList[
      chapterDocIndex + 1
    ].text.getTextContent();
    let nextTextList = nextTextContent.items.map((item: any) => {
      return item.str;
    });
    textList = textList.concat(nextTextList);
  }
  return textList;
};
export const handleHighlightPDFNode = (
  text: string,
  style: string,
  doc: Document
) => {
  let chapterDocIndex = parseInt(text.split("#").reverse()[0]);
  let str = text.split("#").slice(0, -1).join("#");
  let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
  if (!subIframe) {
    subIframe = createPDFIframe(chapterDocIndex, doc);
  }
  let subDoc = subIframe?.contentDocument;
  if (!subDoc) return;
  let nodeList = subDoc.querySelectorAll("p,span");
  let nodes: any[] = Array.from(nodeList).filter((s: any, index: number) => {
    return (
      ((s as HTMLElement).textContent || "").trim() &&
      (s as HTMLElement).textContent === str
    );
  });
  if (nodes.length > 0) {
    nodes[0].setAttribute("style", nodes[0].getAttribute("style") + style);
  }
};
export const getPDFSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let textContent = await chapterDocList[i].text.getTextContent();

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
          keyword: keyword,
        }),
      });
    }
  }
  return _.uniq(searchResult, "excerpt");
};
export const handleIOSScrollPage = async (
  element: HTMLElement,
  animation: string,
  delta: number,
  doc: Document,
  flipToNextPage: () => void,
  flipToPrevPage: () => void,
  isMobile: string | undefined,
  chapterDocIndex: number,
  readerMode: string
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = element.clientWidth;
  if (animation === "mimical" && isMobile !== "yes") {
    let bookDiv = document.getElementById("book");
    if (bookDiv) {
      bookDiv.style.display = "block";
      if (delta > 0) {
        flipToPrevPage();
      } else if (delta < 0) {
        flipToNextPage();
      }
      setTimeout(() => {
        if (!bookDiv) return {};
        bookDiv.style.display = "none";
      }, 1000);
    }
  }
  if (delta > 0) {
    // previous page
    if (readerMode === "single") {
      let subContainer = doc.querySelector(
        "#pdf-container-" + (chapterDocIndex - 1)
      );
      if (subContainer) {
        subContainer.scrollIntoView();
      }
    } else {
      doc.body.scrollBy(-(width + gap) / 2, 0);
    }
  } else if (delta < 0) {
    // next page
    if (readerMode === "single") {
      let subContainer = doc.querySelector(
        "#pdf-container-" + (chapterDocIndex + 1)
      );
      if (subContainer) {
        subContainer.scrollIntoView();
      }
    } else {
      doc.body.scrollBy((width + gap) / 2, 0);
    }
  }
};
