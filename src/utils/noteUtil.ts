import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";
declare var window: any;
export const classes = [
  "color-0",
  "color-1",
  "color-2",
  "color-3",
  "line-0",
  "line-1",
  "line-2",
  "line-3",
];
export const colors = ["#FEF3CD", "#FBFACC", "#CEFACD", "#CDE9FA"];
export const lines = ["#FF0000", "#000080", "#0000FF", "#2EFF2E"];
export const pdfColors = ["#fac106", "#ebe702", "#0be603", "#0493e6"];

export const showNoteHighlight = (
  range: any,
  colorIndex: number,
  noteKey: string,
  handleNoteClick: any,
  doc: Document,
  iframe: any
) => {
  let colorCode = classes[colorIndex];
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let temp = range;
  temp = [temp];
  // sleep(500);
  let selection = rangy.getSelection(iframe);

  selection.restoreCharacterRanges(doc, temp);
  let newRange = selection.getRangeAt(0);
  highlightRange(newRange, colorCode, noteKey, handleNoteClick, doc);
  if (!iWin || !iWin.getSelection()) return;
  iWin.getSelection()?.empty();
};
export const showPDFHighlight = (
  selected: any,
  colorIndex: number,
  noteKey: string,
  handleNoteClick: any,
  page: any,
  scale: number,
  doc: Document
) => {
  let colorCode = classes[colorIndex];
  let pageElement: any = doc.querySelector(".noteLayer");
  let docLayer = doc.querySelector("#koodoPDFLayer");
  var viewport = page.getViewport({ scale: scale });
  let rects: any[] = [];
  //convertToViewportRectangle
  for (let i = 0; i < selected.coords.length; i++) {
    const rect = selected.coords[i];
    var bounds = viewport.convertToViewportRectangle(rect);
    let width = Math.abs(bounds[0] - bounds[2]);
    let height = Math.abs(bounds[1] - bounds[3]);
    let top = Math.min(bounds[1], bounds[3]);
    let left = Math.min(bounds[0], bounds[2]);
    let bottom = top + height;
    let right = left + width;
    if (
      Math.abs(height - viewport.height) < 10 ||
      Math.abs(width - viewport.width) < 10 ||
      width === 0 ||
      height === 0
    ) {
      continue;
    }
    rects.push({ width, height, top, left, bottom, right });
  }
  //获取最小的高度
  let minHeight = 10000;
  rects.forEach((rect) => {
    if (rect.height < minHeight) {
      minHeight = rect.height;
    }
  });
  // 按宽度从小到大排序
  const sortedRects = rects.sort((a, b) => a.width - b.width);
  // 去除bottom相差小于5且宽度更小的rect，保留宽度最大的rect
  const filteredRects: any[] = [];

  for (let i = 0; i < sortedRects.length; i++) {
    const currentRect = sortedRects[i];
    const currentBottom = currentRect.bottom;

    // 检查是否有bottom相差小于5且宽度更大的rect
    const hasSimilarBottomWithLargerWidth = sortedRects.some(
      (otherRect, otherIndex) => {
        if (otherIndex === i) return false;
        const otherBottom = otherRect.bottom;
        return (
          Math.abs(currentBottom - otherBottom) < minHeight &&
          ((otherRect.left <= currentRect.left &&
            otherRect.right >= currentRect.right) ||
            (otherRect.left <= currentRect.left &&
              Math.abs(otherRect.right - currentRect.right) < 5) ||
            (Math.abs(otherRect.left - currentRect.left) < 5 &&
              otherRect.right >= currentRect.right))
        );
      }
    );

    // 如果没有找到bottom相差小于5且宽度更大的rect，则保留当前rect
    if (!hasSimilarBottomWithLargerWidth) {
      filteredRects.push(currentRect);
    }
  }
  for (let i = 0; i < filteredRects.length; i++) {
    const rect = filteredRects[i];
    var newNode = document.createElement("div");
    if (!docLayer) {
      continue;
    }
    newNode?.setAttribute(
      "style",
      "position: absolute;" +
        (colorCode.indexOf("color") > -1
          ? "background-color: "
          : "border-bottom: ") +
        (colorCode.indexOf("color") > -1
          ? pdfColors[colorCode.split("-")[1]]
          : `2px solid ${lines[colorCode.split("-")[1]]}`) +
        "; left:" +
        (rect.left + parseFloat(getComputedStyle(docLayer).marginLeft)) +
        "px; top:" +
        rect.top +
        "px;" +
        "width:" +
        rect.width +
        "px; height:" +
        rect.height +
        "px; z-index: 1; cursor: pointer; opacity: " +
        (colorCode.indexOf("color") > -1 ? 0.3 : 1) +
        ";"
    );
    newNode?.setAttribute("data-key", noteKey);
    newNode?.setAttribute("class", "kookit-note");
    newNode?.addEventListener("click", (event: any) => {
      if (event && event.target) {
        if (
          (event.target as any).dataset &&
          (event.target as any).dataset.key
        ) {
          handleNoteClick(event);
        }
      }
    });
    newNode.ontouchend = (event) => {
      if (window.isSwiping) {
        return;
      }
      if (event && event.target) {
        if (
          (event.target as any).dataset &&
          (event.target as any).dataset.key
        ) {
          handleNoteClick(event);
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };
    pageElement.appendChild(newNode);
  }
};

export const clearHighlight = (doc: Document) => {
  const elements = doc.querySelectorAll(".kookit-note");
  for (let index = 0; index < elements.length; index++) {
    const element: any = elements[index];
    element.parentNode.removeChild(element);
  }
};

export const highlightRange = (
  range: any,
  colorCode: string,
  noteKey: string,
  handleNoteClick: any,
  doc: any
) => {
  const rects: any[] = range.nativeRange.getClientRects();
  const validRects: DOMRect[] = [];

  // 将rects转换为数组并按宽度从小到大排序
  const sortedRects = Array.from(rects).sort((a, b) => a.width - b.width);
  // 获取所有rects中的最大宽度
  const maxWidth = sortedRects.length
    ? Math.max(...Array.from(rects).map((rect) => rect.width))
    : 0;

  // 过滤重复和无效的矩形
  for (let index = 0; index < sortedRects.length; index++) {
    const rect = sortedRects[index];

    // 过滤掉宽度或高度为0的矩形
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    // 检查是否与已有矩形重叠
    const isOverlapping = validRects.some((validRect) => {
      return (
        Math.abs(rect.bottom - validRect.bottom) < 5 && rect.width === maxWidth
      );
    });

    if (!isOverlapping) {
      validRects.push(rect);
    }
  }
  for (let index = 0; index < validRects.length; index++) {
    const rect = validRects[index];
    var newNode = document.createElement("span");
    newNode?.setAttribute(
      "style",
      "position: absolute;" +
        (colorCode.indexOf("color") > -1
          ? "background-color: "
          : "border-bottom: ") +
        (colorCode.indexOf("color") > -1
          ? colors[colorCode.split("-")[1]] + ";opacity: 1"
          : `2px solid ${lines[colorCode.split("-")[1]]}`) +
        ";left:" +
        (Math.min(rect.left, rect.x) + doc.body.scrollLeft) +
        "px; top:" +
        (Math.min(rect.top, rect.y) + doc.body.scrollTop) +
        "px;" +
        "width:" +
        rect.width +
        "px; height:" +
        rect.height +
        "px; z-index:-1;opacity: " +
        (colorCode.indexOf("color") > -1 ? 0.8 : 1) +
        "; cursor: pointer;"
    );
    newNode.setAttribute("class", " kookit-note");
    newNode.setAttribute("data-key", noteKey);
    // newNode.setAttribute("onclick", `window.handleNoteClick()`);

    doc.body.appendChild(newNode);
    var clickNode = document.createElement("span");
    clickNode?.setAttribute(
      "style",
      "position: absolute;" +
        "left:" +
        (Math.min(rect.left, rect.x) + doc.body.scrollLeft) +
        "px; top:" +
        (Math.min(rect.top, rect.y) + doc.body.scrollTop) +
        "px;" +
        "width:" +
        rect.width +
        "px; height:" +
        rect.height +
        "px; z-index:1;"
    );
    clickNode.setAttribute("class", " kookit-note");
    clickNode.setAttribute("data-key", noteKey);
    clickNode.addEventListener("click", (event) => {
      if (event && event.target) {
        if (
          (event.target as any).dataset &&
          (event.target as any).dataset.key
        ) {
          handleNoteClick(event);
        }
      }
    });
    clickNode.ontouchend = (event) => {
      if (window.isSwiping) {
        return;
      }
      if (event && event.target) {
        if (
          (event.target as any).dataset &&
          (event.target as any).dataset.key
        ) {
          handleNoteClick(event);
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };
    doc.body.appendChild(clickNode);
  }
};
