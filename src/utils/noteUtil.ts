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
  for (let i = 0; i < selected.coords.length; i++) {
    const rect = selected.coords[i];
    var bounds = viewport.convertToViewportRectangle(rect);
    //过滤出把整页都给高亮的rect，剔除掉
    if (
      Math.abs(Math.abs(bounds[1] - bounds[3]) - viewport.height) < 10 ||
      Math.abs(Math.abs(bounds[0] - bounds[2]) - viewport.width) < 10
    ) {
      continue;
    }
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
        (Math.min(bounds[0], bounds[2]) +
          parseFloat(getComputedStyle(docLayer).marginLeft)) +
        "px; top:" +
        Math.min(bounds[1], bounds[3]) +
        "px;" +
        "width:" +
        Math.abs(bounds[0] - bounds[2]) +
        "px; height:" +
        Math.abs(bounds[1] - bounds[3]) +
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
  const rects = range.nativeRange.getClientRects();
  for (let index = 0; index < rects.length; index++) {
    const rect = rects[index];
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
