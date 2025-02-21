import ChapterDoc from "../model/chapterDoc";
import {
  convertComputedNum,
  convertStyleNum,
  handleIframeHeight,
  handleOneChapterDoc,
  progressInfo,
} from "./layoutUtil";
import Chapter from "../model/chapter";
import { cleanText } from "../libs/html";
import Chinese from "chinese-s2t";
import _ from "underscore";
import rangy from "rangy/lib/rangy-core.js";
declare var window: any;
let lock = false;
export const getBlockElement = (Element) => {
  return Array.from(
    Element.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address"
    )
  ) as HTMLElement[];
};

export const handleScrollPage = async (
  element: HTMLElement,
  animation: string,
  delta: number,
  doc: Document,
  flipToNextPage: () => void,
  flipToPrevPage: () => void
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  const width = element.clientWidth;
  if (animation === "mimical") {
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
    doc.body.scrollBy({
      top: 0,
      left: -width - gap,
      behavior: animation === "sliding" ? "smooth" : "auto",
    });
    // trigger("page-changed");
  } else if (delta < 0) {
    // next page
    doc.body.scrollBy({
      top: 0,
      left: width + gap,
      behavior: animation === "sliding" ? "smooth" : "auto",
    });
  }
};
const findValidChapter = (
  chapterDocIndex: number,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  flag: string
) => {
  let currentChapterIndex = _.findLastIndex(chapterDocList, {
    href: chapterHref,
  });
  if (
    chapterHref &&
    _.findLastIndex(chapterDocList, {
      href: chapterHref,
    }) > -1
  ) {
    //nothing
  } else {
    currentChapterIndex = chapterDocIndex;
  }
  if (flag === "prev") {
    return {
      ...chapterDocList[currentChapterIndex - 1],
      index: currentChapterIndex - 1,
    };
  } else {
    return {
      ...chapterDocList[currentChapterIndex + 1],
      index: currentChapterIndex + 1,
    };
  }
};
export const handlePrevChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  let chapterDocIndex = parseInt(tempLocation.chapterDocIndex || "0");
  let chapterHref = tempLocation.chapterHref || "";
  if (chapterDocIndex === 0) {
    return;
  }
  let prevChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    chapterDocList,
    "prev"
  );
  if (!prevChapter) return;

  tempLocation.text = "prevChapter";
  tempLocation.page = "";
  await handleRenderChapter(
    prevChapter.index,
    prevChapter.label,
    prevChapter.href,
    chapterDocList,
    element,
    readerMode,
    format,
    tempLocation,
    doc,
    iframe
  );
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
export const handleRenderChapter = async (
  chapterDocIndex: number,
  chapterTitle: string,
  chapterHref: string,
  chapterDocList: ChapterDoc[],
  element: HTMLElement,
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  doc.body.innerHTML = "";
  iframe.height = 0 + "px";
  doc.body.scrollTo(0, 0);
  if (
    (chapterTitle && !chapterDocIndex) ||
    (chapterDocList[chapterDocIndex] &&
      chapterDocList[chapterDocIndex].label &&
      chapterTitle &&
      chapterTitle !== chapterDocList[chapterDocIndex].label &&
      chapterHref.indexOf("#") === -1)
  ) {
    let tempChapterDocIndex = _.findLastIndex(chapterDocList, {
      label: chapterTitle,
    });
    if (tempChapterDocIndex !== -1) {
      chapterDocIndex = tempChapterDocIndex;
    }
  }
  if (chapterDocIndex === -1 && chapterHref.indexOf("#") > -1) {
    let href = chapterHref.split("#")[0];
    let tempChapterDocIndex = _.findLastIndex(chapterDocList, {
      href: href,
    });
    if (tempChapterDocIndex !== -1) {
      chapterDocIndex = tempChapterDocIndex;
    }
  }
  if (chapterDocIndex === -1 || chapterDocIndex > chapterDocList.length - 1) {
    chapterDocIndex = 0;
  }

  doc.body.innerHTML = await handleOneChapterDoc(
    chapterDocList[chapterDocIndex].text,
    false
  );
  console.log(doc.body.innerHTML);
  if (format === "PDF") {
    let scale = await getPdfScale(
      element,
      readerMode,
      chapterDocList,
      chapterDocIndex
    );
    await chapterDocList[chapterDocIndex].text.render(doc, scale);
  }
  if (format !== "CACHE") {
    await handleCssLink(doc);
  }

  tempLocation.chapterTitle = chapterTitle;
  tempLocation.chapterHref = chapterHref;
  tempLocation.chapterDocIndex = chapterDocIndex + "";
  tempLocation.percentage = chapterDocIndex / chapterDocList.length + "";
  tempLocation.text = "";
  await handleIframeHeight(element, readerMode, format, iframe, doc);
  handleScrollPosition(element, readerMode, "", "", "", "", doc);
};
export const handleCssLink = async (doc) => {
  let linkList = Array.from(doc.getElementsByTagName("link"));
  if (linkList.length === 0) {
    return;
  }
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    link.onload = () => {
      console.log("finished");
    };
  }
  let styleSheetPromises: any = [];
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    if (!link.href.endsWith("null")) {
      styleSheetPromises.push(
        new Promise((resolve, reject) => {
          link.addEventListener("load", resolve);
        })
      );
    }
  }
  try {
    await Promise.race([
      Promise.all(styleSheetPromises),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log("css load timeout");
          // reject(new Error("Timeout"));
          resolve("css load timeout");
        }, 1000);
      }),
    ]);
  } catch (err) {
    console.log(err);
  }
};
export const handleScrollPosition = async (
  element: HTMLElement,
  readerMode: string,
  text: string,
  count: string,
  href: string,
  page: string,
  doc: Document
) => {
  let top = 0;
  let left = 0;
  let targetNode: any = doc.body;
  if (page && readerMode !== "scroll") {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const width = convertComputedNum(getComputedStyle(element).width);
    let pageWidth = width + gap;
    left = pageWidth * (parseInt(page) - 1);
  } else if (text) {
    let nodeList = getBlockElement(doc.body);
    let targetNodeList = nodeList.filter((s, index) => {
      return (
        cleanText((s as HTMLElement).textContent) &&
        (cleanText((s as HTMLElement).textContent) === cleanText(text) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.t2s(cleanText(text)) ||
          cleanText((s as HTMLElement).textContent) ===
            Chinese.s2t(cleanText(text))) &&
        (Math.abs(index - parseInt(count)) < 2 ||
          count === "search" ||
          count === "ignore" ||
          count === "next")
      );
    });
    if (targetNodeList.length === 0) {
      console.log("failed");
      return;
    }
    targetNode = getCloestBlock(targetNodeList[0], element, readerMode);
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : text === "prevChapter"
      ? doc.body.scrollWidth
      : 0;
    top = targetNode
      ? convertStyleNum(targetNode.offsetTop) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
  } else if (href && href.indexOf("#") > -1) {
    let id = CSS.escape(href.split("#").reverse()[0]);
    if (!doc.body.querySelector("#" + id)) {
      return;
    }
    targetNode = getCloestBlock(
      doc.body.querySelector("#" + id) || doc.body,
      element,
      readerMode
    );
    left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    top = targetNode
      ? convertStyleNum(targetNode.offsetTop) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
  }
  if (readerMode !== "scroll") {
    doc.body.scrollTo(left, 0);
  } else {
    targetNode.scrollIntoView();
  }
};

export const getCloestBlock = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode: string
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let offsetLeft =
    convertStyleNum(targetNode.offsetLeft) -
    convertStyleNum(
      (targetNode as any).marginLeft ||
        parseFloat(getComputedStyle(targetNode).marginLeft)
    );
  if (readerMode === "scroll") {
    return targetNode;
  } else if (
    readerMode !== "scroll" &&
    checkDivisibleInRange(
      parseInt(offsetLeft + ""),
      (element.clientWidth + gap) / 2
    )
  ) {
    return targetNode;
  } else if (targetNode.parentElement) {
    return getCloestBlock(targetNode.parentElement, element, readerMode);
  } else {
    return targetNode;
  }
};
const checkDivisibleInRange = (x: number, y: number): boolean => {
  for (let i = x - 10; i <= x + 10; i++) {
    if (i % y === 0) {
      return true;
    }
  }
  return false;
};
export const handleRecord = async (
  element: HTMLElement,
  readerMode: string,
  flattenChapters: Chapter[],
  tempLocation: any,
  doc: Document,
  targetNode: HTMLElement | null
) => {
  if (lock) return;
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  let firstVisibleNode: any = visibleNode[0] as HTMLElement;
  if (targetNode) {
    firstVisibleNode = targetNode;
  }
  let count = 0;
  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], readerMode) &&
      firstVisibleNode &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML
    ) {
      count = i;
      break;
    }
  }
  handleHashChapter(visibleNode, flattenChapters, tempLocation);
  if (
    firstVisibleNode &&
    !isCurrentNodeFarFromParrent(firstVisibleNode, element, readerMode)
  ) {
    tempLocation.text = firstVisibleNode.textContent || "";
    tempLocation.count = count + "";
    tempLocation.page = "";
  } else {
    tempLocation.page = (await progressInfo(readerMode, doc))?.currentPage + "";
  }

  lock = true;
  setTimeout(() => {
    lock = false;
  }, 100);
};
export const handleRecordByNode = async (
  element: HTMLElement,
  readerMode: string,
  flattenChapters: Chapter[],
  tempLocation: any,
  doc: Document,
  node: HTMLElement
) => {
  if (lock) return;
  let nodeList = getBlockElement(doc.body);
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );
  let firstVisibleNode: any = node;
  let count = 0;

  for (let i = 0; i < nodeList.length; i++) {
    if (
      isScrolledIntoView(element, nodeList[i], readerMode) &&
      firstVisibleNode &&
      nodeList[i].innerHTML === firstVisibleNode.innerHTML
    ) {
      count = i;
      break;
    }
  }
  handleHashChapter(visibleNode, flattenChapters, tempLocation);
  if (
    firstVisibleNode &&
    !isCurrentNodeFarFromParrent(firstVisibleNode, element, readerMode)
  ) {
    tempLocation.text = firstVisibleNode
      ? firstVisibleNode.textContent
        ? firstVisibleNode.textContent
        : ""
      : "";
    tempLocation.count = count + "";
    tempLocation.page = "";
  } else {
    tempLocation.page = (await progressInfo(readerMode, doc))?.currentPage + "";
  }

  lock = true;
  setTimeout(() => {
    lock = false;
  }, 100);
};
export const isCurrentNodeFarFromParrent = (
  targetNode: HTMLElement,
  element: HTMLElement,
  readerMode
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  if (
    Math.abs(
      targetNode.offsetLeft -
        getCloestBlock(targetNode, element, readerMode).offsetLeft
    ) >
    (element.clientWidth + gap) / 2
  ) {
    return true;
  } else {
    return false;
  }
};
export const handleHashChapter = (
  visibleNode,
  flattenChapters,
  tempLocation
) => {
  let chapterHref = tempLocation.chapterHref || "";
  let lastIndexOfHash = chapterHref.lastIndexOf("#");
  let beforeHash = chapterHref.substring(0, lastIndexOfHash);
  let afterHash = chapterHref.substring(lastIndexOfHash + 1);
  for (let index = 0; index < visibleNode.length; index++) {
    const element = visibleNode[index];
    if (afterHash && element.id) {
      let newHref = beforeHash + "#" + element.id;
      let newIndex = _.findLastIndex(flattenChapters, {
        href: newHref,
      });
      if (newIndex > -1) {
        tempLocation.chapterHref = newHref;
        tempLocation.chapterTitle = flattenChapters[newIndex].label;
      }
    }
  }
};
export const handleNextChapter = async (
  element: HTMLElement,
  flattenChapters: Chapter[],
  chapterDocList: ChapterDoc[],
  readerMode: string,
  format: string,
  tempLocation: any,
  doc: Document,
  iframe: any
) => {
  let chapterDocIndex = parseInt(tempLocation.chapterDocIndex || "0");
  let chapterHref = tempLocation.chapterHref || "";
  if (chapterDocIndex >= chapterDocList.length - 1) {
    tempLocation.percentage = "1";
    return;
  }
  let nextChapter = findValidChapter(
    chapterDocIndex,
    chapterHref,
    chapterDocList,
    "next"
  );
  if (!nextChapter) return;
  tempLocation.page = "";
  await handleRenderChapter(
    nextChapter.index,
    nextChapter.label,
    nextChapter.href,
    chapterDocList,
    element,
    readerMode,
    format,
    tempLocation,
    doc,
    iframe
  );
};
export const getAudioText = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );
  let audioNode = nodeList.filter((s) =>
    ((s as HTMLElement).textContent || "").trim()
  );
  let audioText = audioNode
    .filter((item) => item.textContent !== "img")
    .map((item) => item.textContent);
  let firstSliceIndex = 0;
  let visibleText = getVisibleText(element, readerMode, doc);
  if (visibleText && visibleText.length > 0) {
    let firstVisibleText = visibleText[0];
    firstSliceIndex = audioText.indexOf(firstVisibleText);
  }

  return audioText.slice(firstSliceIndex);
};
export const getVisibleText = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  let nodeList = getBlockElement(doc.body).filter(
    (item) => !isParentBlock(item)
  );
  let visibleNode = nodeList.filter(
    (s) =>
      isScrolledIntoView(element, s as HTMLElement, readerMode) &&
      ((s as HTMLElement).textContent || "").trim()
  );

  return visibleNode
    .filter((item) => item.textContent !== "img")
    .map((item) => item.textContent);
};
export const handleHighlightNode = (
  text: string,
  style: string,
  doc: Document
) => {
  let nodeList = getBlockElement(doc.body);
  let nodes = nodeList.filter((s) => {
    if (s.getAttribute("style") === style) {
      s.setAttribute("style", "");
    }

    return (
      ((s as HTMLElement).textContent || "").trim() &&
      (s as HTMLElement).textContent === text
    );
  });
  if (nodes.length > 0) {
    nodes[0].setAttribute("style", style);
  }
};
export const getSearchResult = async (
  keyword: string,
  chapterDocList: ChapterDoc[]
) => {
  let searchResult: { cfi: string; excerpt: string }[] = [];
  for (let i = 0; i < chapterDocList.length; i++) {
    let chapterDoc = new DOMParser().parseFromString(
      await handleOneChapterDoc(chapterDocList[i].text, true),
      "text/html"
    );
    let nodeList = getBlockElement(chapterDoc.body).filter(
      (item) => !isParentBlock(item)
    );
    for (let j = 0; j < nodeList.length; j++) {
      let keyWordIndex = (
        (nodeList[j] as HTMLElement).textContent || ""
      ).indexOf(keyword);
      if (keyWordIndex > -1) {
        searchResult.push({
          excerpt:
            nodeList[j].textContent?.substring(
              keyWordIndex - 100,
              keyWordIndex + 100
            ) || "",
          cfi: JSON.stringify({
            text: nodeList[j].textContent,
            chapterTitle: chapterDocList[i].label,
            chapterDocIndex: i,
            chapterHref: chapterDocList[i].href,
            count: "search",
            percentage: i / chapterDocList.length,
          }),
        });
      }
    }
  }
  return _.uniq(searchResult, "excerpt");
};
export const isParentBlock = (myDiv: Element) => {
  var children = myDiv.children;
  let flag = false;
  var blockRegex =
    /^(address|section|blockquote|body|center|dir|div|dl|fieldset|form|h[1-6]|hr|isindex|menu|noframes|noscript|ol|p|pre|table|ul|dd|dt|frameset|li|tbody|td|tfoot|th|thead|tr|html)$/i;
  let blockElementList = Array.from(children).filter((item) =>
    blockRegex.test(item.nodeName)
  );
  // some elements might contain image and image subtitle
  if (blockElementList.length < 3) {
    return false;
  }
  for (var i = 0; i < children.length; i++) {
    if (blockRegex.test(children[i].nodeName)) {
      flag = true;
      break;
    }
  }
  return flag;
};
export const isScrolledIntoView = (
  element: HTMLElement,
  el: HTMLElement,
  readerMode: string
) => {
  var isVisible = false;
  var rect = el.getBoundingClientRect();
  if (readerMode !== "scroll" && el.textContent && el.textContent.trim()) {
    let elemLeft = rect.left;
    isVisible = elemLeft > -10 && elemLeft <= element.clientWidth;
  } else if (
    readerMode === "scroll" &&
    el.textContent &&
    el.textContent.trim()
  ) {
    let elemTop = rect.top;
    isVisible =
      elemTop >= element.scrollTop &&
      elemTop <= element.scrollTop + element.clientHeight;
  } else if (readerMode !== "scroll") {
    let elemLeft = rect.left;
    isVisible = elemLeft >= 0 && elemLeft <= element.clientWidth;
  }
  return isVisible;
};
export const addAndroidTouchEvent = (
  doc: Document,
  iframe: any,
  element: HTMLElement
) => {
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchEnd = 0;
  const swipeThreshold = 30; // Minimum distance in pixels to be considered a swipe
  const timeThreshold = 500; // Maximum time in milliseconds to be considered a tap

  let onTouchEnd = function (event) {
    console.log("touchend");
    let now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
      return;
    }
    lastTouchEnd = now;
    const touch = event.changedTouches[0];
    const touchEndTime = Date.now();
    const touchEndX = touch.screenX;
    const touchEndY = touch.screenY;
    const timeDiff = touchEndTime - touchStartTime;
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;
    var selectedText = iWin.getSelection().toString();
    if (selectedText) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "select-text", selectedText: selectedText })
      );
      return;
    }
    if (
      timeDiff < timeThreshold &&
      Math.abs(distX) < swipeThreshold &&
      Math.abs(distY) < swipeThreshold
    ) {
      var width = window.screen.width;
      var height = window.screen.height;

      var cellWidth = width / 3;
      var cellHeight = height / 3;

      var col = Math.floor(touchEndX / cellWidth);
      var row = Math.floor(touchEndY / cellHeight);

      var result = "";

      if (
        (row === 0 && (col === 0 || col === 1)) || // Top-left and Top-middle
        (row === 1 && col === 0) || // Middle-left
        (row === 2 && col === 0) || // Bottom-left
        (row === 0 && col === 1) // Middle-top
      ) {
        result = "left";
      } else if (row === 1 && col === 1) {
        result = "center";
      } else if (
        (row === 0 && col === 2) || // Top-right
        (row === 1 && col === 2) || // Middle-right
        (row === 2 && col === 2) || // Bottom-right
        (row === 2 && col === 1) // Middle-bottom
      ) {
        result = "right";
      }
      // if (
      //   col === 0 // Left column (left third of screen)
      // ) {
      //   result = "left";
      // } else if (col === 1) {
      //   // Middle column (middle third of screen)
      //   result = "center";
      // } else if (col === 2) {
      //   // Right column (right third of screen)
      //   result = "right";
      // }
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: result }));
    } else if (
      Math.abs(distX) >= swipeThreshold ||
      Math.abs(distY) >= swipeThreshold
    ) {
      console.log("Swipe detected");
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: "swipe" }));
    }
  };
  let onTouchStart = function (event) {
    const target: any = event.target;
    if (!target) return;
    if (target.tagName === "IMG") {
      const imgSrc = target.src || target.getAttribute("xlink:href");
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "view-image", imgSrc: imgSrc })
      );
    }
    if (event.touches.length > 1) {
      event.preventDefault();
    }
    const touch = event.touches[0];
    touchStartTime = Date.now();
    touchStartX = touch.screenX; // Changed from screenX to clientX
    touchStartY = touch.screenY; // Changed from screenY to clientY
  };
  doc.body.ontouchend = onTouchEnd;
  doc.body.ontouchstart = onTouchStart;
  iWin.ontouchend = onTouchEnd;
  iWin.ontouchstart = onTouchStart;

  doc.body.oncontextmenu = function (event) {
    console.log("contextmenu");
    event.preventDefault();
    event.stopPropagation();
    var selectedText = iWin.getSelection().toString();
    if (selectedText) {
      var range = iWin.getSelection().getRangeAt(0);
      var rect = range.getBoundingClientRect();
      var position = {
        top: rect.top - element.scrollTop,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      };
      rangy.init();

      let charRange = rangy
        .getSelection(iframe)
        .saveCharacterRanges(doc.body)[0];
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "select-text",
          selectedText: selectedText,
          position: position,
          range: charRange,
        })
      );
    }
    return false;
  };
};
export const addAppleTouchEvent = (
  doc: Document,
  iframe: any,
  element: HTMLElement
) => {
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchEnd = 0;
  const swipeThreshold = 30; // Minimum distance in pixels to be considered a swipe
  const timeThreshold = 500; // Maximum time in milliseconds to be considered a tap
  let selectionTimeout: any = null;
  let onTouchEnd = function (event) {
    console.log("touchend");
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    selectionTimeout = setTimeout(() => {
      const selectedText = iWin.getSelection().toString().trim();
      console.log("selecsdfsdtedText", selectedText);
      if (selectedText) {
        var range = iWin.getSelection().getRangeAt(0);
        var rect = range.getBoundingClientRect();
        var position = {
          top: rect.top - element.scrollTop,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        };

        rangy.init();
        let charRange = rangy
          .getSelection(iframe)
          .saveCharacterRanges(doc.body)[0];

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "select-text",
            selectedText: selectedText,
            position: position,
            range: charRange,
          })
        );
      }
    }, 300); // Debounce selection events
    let now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
      return;
    }
    lastTouchEnd = now;
    const touch = event.changedTouches[0];
    const touchEndTime = Date.now();
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const timeDiff = touchEndTime - touchStartTime;
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;

    // var selectedText = iWin.getSelection().toString();
    // if (selectedText) {
    //   window.ReactNativeWebView.postMessage(
    //     JSON.stringify({ event: "select-text", selectedText: selectedText })
    //   );
    //   return;
    // }

    if (
      timeDiff < timeThreshold &&
      Math.abs(distX) < swipeThreshold &&
      Math.abs(distY) < swipeThreshold
    ) {
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const normalizedX = Math.min(Math.max(touchEndX, 0), width);
      const normalizedY = Math.min(Math.max(touchEndY, 0), height);

      let result = "";
      // For pagination mode: keep original 3x3 grid
      const cellWidth = width / 3;
      const cellHeight = height / 3;
      const col = Math.min(Math.floor(normalizedX / cellWidth), 2);
      const row = Math.min(Math.floor(normalizedY / cellHeight), 2);

      if (
        col === 0 // Left column (left third of screen)
      ) {
        result = "left";
      } else if (col === 1) {
        // Middle column (middle third of screen)
        result = "center";
      } else if (col === 2) {
        // Right column (right third of screen)
        result = "right";
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ event: result }));
    } else if (
      Math.abs(distX) >= swipeThreshold ||
      Math.abs(distY) >= swipeThreshold
    ) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: "swipe" }));
    }
  };
  let onTouchStart = function (event) {
    const target: any = event.target;
    if (!target) return;
    if (target.tagName === "IMG") {
      const imgSrc = target.src || target.getAttribute("xlink:href");
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "view-image", imgSrc: imgSrc })
      );
    }
    if (event.touches.length > 1) {
      event.preventDefault();
    }
    const touch = event.touches[0];
    touchStartTime = Date.now();
    touchStartX = touch.clientX; // Changed from screenX to clientX
    touchStartY = touch.clientY; // Changed from screenY to clientY
  };
  doc.body.ontouchend = onTouchEnd;
  doc.body.ontouchstart = onTouchStart;
  iWin.ontouchend = onTouchEnd;
  iWin.ontouchstart = onTouchStart;

  doc.addEventListener("selectionchange", (event) => {}, false);
  doc.addEventListener("touchmove", (event) => {}, false);

  doc.body.oncontextmenu = function (event) {
    console.log("contextmenu");
    event.preventDefault();
    event.stopPropagation();

    return false;
  };
};
