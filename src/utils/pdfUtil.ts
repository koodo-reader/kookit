import ChapterDoc from "../model/chapterDoc";
import { convertStyleNum } from "./layoutUtil";
import _ from "underscore";
declare var window: any;
export const getPdfScale = async (
  element: HTMLElement,
  readerMode: string,
  chapterDocList: ChapterDoc[],
  chapterDocIndex: number,
  doc: any
) => {
  let { width, height } =
    await chapterDocList[chapterDocIndex].text.getDimension();

  let viewWidth = doc.body.clientWidth;
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
  let section = Math.floor(doc.body.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  doc.body.setAttribute(
    "style",
    element.getAttribute("style") +
      `height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action: manipulation; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
        (doc.body.clientWidth - gap) / scale
      }px;`
  );
};
export const createPDFContainer = async (
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
    if (readerMode === "single") {
      iframeContainer.style.paddingTop = element.clientHeight + "px";
    } else if (readerMode === "double") {
      // Set aspect ratio based on PDF page dimensions
      const aspectRatio = viewport?.width / viewport?.height || 0.75; // Default to 3:4 if viewport unknown
      iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100}%`;
    } else if (readerMode === "scroll") {
      let scrollViewport = await chapterDocList[index].text.getDimension();
      const aspectRatio =
        scrollViewport?.width / scrollViewport?.height || 0.75; // Default to 3:4 if viewport unknown
      iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100 + 5}%`;
    }

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
};

export const isPDFScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string,
  doc: any
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (readerMode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= doc.body.clientWidth;
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
    let nextTextContent =
      await chapterDocList[chapterDocIndex + 1].text.getTextContent();
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
  // First remove any existing highlights
  const existingHighlights = doc.querySelectorAll(
    `span[data-highlight="true"]`
  );
  existingHighlights.forEach((highlight) => {
    // Remove only background style from the element
    const style = highlight.getAttribute("style") || "";
    // Remove background or background-color properties using regex
    const newStyle = style
      .replace(/background(?:-color)?\s*:[^;]+;?/gi, "")
      .trim();
    if (newStyle) {
      highlight.setAttribute("style", newStyle);
    } else {
      highlight.removeAttribute("style");
    }
    highlight.removeAttribute("data-highlight");
  });

  if (!text.trim()) return;
  let nodeList = doc.querySelectorAll("p,span");
  let nodes: any[] = Array.from(nodeList).filter((s: any, index: number) => {
    return (
      ((s as HTMLElement).textContent || "").trim() &&
      (s as HTMLElement).textContent === text
    );
  });
  if (nodes.length > 0) {
    nodes[0].setAttribute(
      "style",
      (nodes[0].getAttribute("style") || "") + style
    );
    nodes[0].setAttribute("data-highlight", "true");
  }
};
export const getPDFSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let textContent = await chapterDocList[i].text.getTextContent();

    // Group items by line based on y-coordinate with tolerance
    const lineMap = new Map<number, any[]>();
    const tolerance = 5; // Y-coordinate tolerance for grouping items in same line

    textContent.items.forEach((item: any, index: number) => {
      const y = item.transform[5]; // y-coordinate
      let foundLineKey: number | null = null;

      // Check if this item belongs to an existing line
      for (const [firstItemIndex, items] of lineMap.entries()) {
        const firstItemY = items[0].transform[5];
        if (Math.abs(y - firstItemY) < tolerance) {
          items.push(item);
          foundLineKey = firstItemIndex;
          break;
        }
      }

      // If no matching line found, create a new line with current item's index as key
      if (foundLineKey === null) {
        lineMap.set(index, [item]);
      }
    });

    // Merge items in the same line and search
    let lineIndex = 0;
    lineMap.forEach((items, itemKey) => {
      // Sort items by x-coordinate
      items.sort((a, b) => a.transform[4] - b.transform[4]);
      // Merge text from same line
      const lineText = items
        .map((item) => item.str)
        .join("")
        .toLowerCase();

      if (lineText.indexOf(keyword.toLowerCase()) > -1) {
        searchResult.push({
          excerpt: lineText,
          cfi: JSON.stringify({
            text: lineText + "#" + i + "#" + itemKey,
            chapterTitle: chapterDocList[i].label,
            chapterDocIndex: i,
            chapterHref: chapterDocList[i].href,
            count: "search",
            percentage: i / chapterDocList.length,
            keyword: keyword,
          }),
        });
      }
      lineIndex++;
    });
  }
  return searchResult;
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
  let section = Math.floor(doc.body.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = doc.body.clientWidth;
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
export const convertPageToImage = async (page) => {
  const desiredWidth = 600;
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = desiredWidth;
  canvas.height = (desiredWidth / viewport.width) * viewport.height;
  const renderContext = {
    canvasContext: context,
    viewport: page.getViewport({ scale: desiredWidth / viewport.width }),
  };
  await page.render(renderContext).promise;
  const imageURL = canvas.toDataURL("image/jpeg", 0.8);
  const size = calculateSize(imageURL);
  return { imageURL, size };
};
function calculateSize(imageURL) {
  const base64Length = imageURL.length - "data:image/jpeg;base64,".length;
  const sizeInBytes = Math.ceil(base64Length * 0.75);
  return sizeInBytes;
}

function formatSize(size) {
  const sizeInKB = (size / 1024).toFixed(2);
  return `${sizeInKB} KB`;
}
export const isElectron = () => {
  // Renderer process
  if (
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process.type === "renderer"
  ) {
    return true;
  }
  // Main process
  if (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    !!process.versions.electron
  ) {
    return true;
  }
  // Detect the user agent when the `nodeIntegration` option is set to true
  if (
    typeof navigator === "object" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.indexOf("Electron") >= 0
  ) {
    return true;
  }

  return false;
};
export const showOCRProgress = (progress: number) => {
  let bar = document.getElementById("ocr-progress-bar") as HTMLProgressElement;
  if (!bar) {
    bar = document.createElement("progress");
    bar.id = "ocr-progress-bar";
    bar.max = 1;
    bar.value = 0;
    bar.style.position = "fixed";
    bar.style.top = "10px";
    bar.style.left = "50%";
    bar.style.transform = "translateX(-50%)";
    bar.style.width = "300px";
    bar.style.zIndex = "9999";
    document.body.appendChild(bar);
  }

  bar.value = progress;
  if (progress >= 1) {
    setTimeout(() => {
      bar.remove();
    }, 1000);
  }
};
