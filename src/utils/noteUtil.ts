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
  iframe: any,
  isNote: boolean,
  isMobile: boolean
) => {
  let colorCode = classes[colorIndex];
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let temp = range;
  temp = [temp];
  // sleep(500);
  let selection = rangy.getSelection(iframe);

  selection.restoreCharacterRanges(doc, temp);
  let newRange = selection.getRangeAt(0);
  highlightRange(
    newRange,
    colorCode,
    noteKey,
    handleNoteClick,
    doc,
    isNote,
    isMobile
  );
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
  doc: Document,
  isNote: boolean,
  isMobile: boolean
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
    const hasSimilarBottomWithLargerWidth = filteredRects.some(
      (otherRect, otherIndex) => {
        if (otherIndex === i) return false;
        const otherBottom = otherRect.bottom;
        return (
          Math.abs(currentBottom - otherBottom) < minHeight / 2 &&
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
  const topRightPdfRect = filteredRects.reduce<any>((best, r) => {
    if (!best) return r;
    if (r.top < best.top || (r.top === best.top && r.right < best.right))
      return r;
    return best;
  }, null);
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
        "; "
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
    if (isNote && rect === topRightPdfRect) {
      const iconNode = document.createElement("div");
      iconNode.setAttribute(
        "style",
        "position: absolute;" +
          "left:" +
          (rect.left +
            parseFloat(getComputedStyle(docLayer as Element).marginLeft) +
            rect.width -
            15) +
          "px; top:" +
          (rect.top - 15) +
          "px;" +
          "width: 16px; height: 16px; z-index: 2; cursor: pointer; font-size: 14px; line-height: 1;"
      );
      iconNode.setAttribute("class", "kookit-note");
      iconNode.setAttribute("data-key", noteKey);
      iconNode.textContent = "📋";
      iconNode.addEventListener("click", (event) => {
        if (event && event.target) {
          if (
            (event.target as any).dataset &&
            (event.target as any).dataset.key
          ) {
            handleNoteClick(event);
          }
        }
      });
      iconNode.ontouchend = (event) => {
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
      pageElement.appendChild(iconNode);
    }
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
  doc: any,
  isNote: boolean = false,
  isMobile: boolean = false
) => {
  if (isMobile && window.isSwiping) {
    const waitAndHighlight = () => {
      if (window.isSwiping) {
        requestAnimationFrame(waitAndHighlight);
      } else {
        highlightRange(
          range,
          colorCode,
          noteKey,
          handleNoteClick,
          doc,
          isNote,
          isMobile
        );
      }
    };
    requestAnimationFrame(waitAndHighlight);
    return;
  }
  const rects: any[] = range.nativeRange.getClientRects();
  const validRects: DOMRect[] = [];
  let scrollTop = doc.body.scrollTop || doc.documentElement.scrollTop;
  let scrollLeft = doc.body.scrollLeft || doc.documentElement.scrollLeft;

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
        Math.abs(rect.bottom - validRect.bottom) < 5 &&
        rect.width === maxWidth &&
        Math.abs(rect.left - validRect.left) < maxWidth &&
        Math.abs(rect.right - validRect.right) < maxWidth
      );
    });

    if (!isOverlapping) {
      validRects.push(rect);
    }
  }
  const topRightRect = validRects.reduce<DOMRect | null>((best, r) => {
    if (!best) return r;
    if (r.top < best.top || (r.top === best.top && r.right < best.right))
      return r;
    return best;
  }, null);
  // 事件委托：在 doc.body 上监听点击，通过坐标命中 kookit-note 来触发 handleNoteClick
  // 仅在第一次循环前注册一次（用自定义标记避免重复注册）
  if (!(doc.body as any).__kookitDelegated) {
    (doc.body as any).__kookitDelegated = true;
    let delegateDownX = 0;
    let delegateDownY = 0;
    doc.body.addEventListener(
      "mousemove",
      (e: MouseEvent) => {
        const bodyScrollTop =
          doc.body.scrollTop || doc.documentElement.scrollTop;
        const bodyScrollLeft =
          doc.body.scrollLeft || doc.documentElement.scrollLeft;
        const absX = e.clientX + bodyScrollLeft;
        const absY = e.clientY + bodyScrollTop;
        const notes = doc.body.querySelectorAll(
          ".kookit-note[data-key]"
        ) as NodeListOf<HTMLElement>;
        let overHighlight = false;
        for (let n = 0; n < notes.length; n++) {
          const el = notes[n];
          const s = el.style;
          const left = parseFloat(s.left);
          const top = parseFloat(s.top);
          const w = parseFloat(s.width);
          const h = parseFloat(s.height);
          if (
            absX >= left &&
            absX <= left + w &&
            absY >= top &&
            absY <= top + h
          ) {
            overHighlight = true;
            break;
          }
        }
        doc.body.style.cursor = overHighlight ? "pointer" : "";
      },
      true
    );
    doc.body.addEventListener(
      "mousedown",
      (e: MouseEvent) => {
        delegateDownX = e.clientX;
        delegateDownY = e.clientY;
      },
      true
    );
    doc.body.addEventListener(
      "click",
      (e: MouseEvent) => {
        if (
          Math.abs(e.clientX - delegateDownX) > 5 ||
          Math.abs(e.clientY - delegateDownY) > 5
        )
          return;
        const bodyScrollTop =
          doc.body.scrollTop || doc.documentElement.scrollTop;
        const bodyScrollLeft =
          doc.body.scrollLeft || doc.documentElement.scrollLeft;
        const absX = e.clientX + bodyScrollLeft;
        const absY = e.clientY + bodyScrollTop;
        const notes = doc.body.querySelectorAll(
          ".kookit-note[data-key]"
        ) as NodeListOf<HTMLElement>;
        for (let n = 0; n < notes.length; n++) {
          const el = notes[n];
          const s = el.style;
          const left = parseFloat(s.left);
          const top = parseFloat(s.top);
          const w = parseFloat(s.width);
          const h = parseFloat(s.height);
          if (
            absX >= left &&
            absX <= left + w &&
            absY >= top &&
            absY <= top + h
          ) {
            handleNoteClick({ target: el });
            break;
          }
        }
      },
      true
    );
    doc.body.addEventListener(
      "touchend",
      (e: TouchEvent) => {
        if (window.isSwiping) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const bodyScrollTop =
          doc.body.scrollTop || doc.documentElement.scrollTop;
        const bodyScrollLeft =
          doc.body.scrollLeft || doc.documentElement.scrollLeft;
        const absX = touch.clientX + bodyScrollLeft;
        const absY = touch.clientY + bodyScrollTop;
        const notes = doc.body.querySelectorAll(
          ".kookit-note[data-key]"
        ) as NodeListOf<HTMLElement>;
        for (let n = 0; n < notes.length; n++) {
          const el = notes[n];
          const s = el.style;
          const left = parseFloat(s.left);
          const top = parseFloat(s.top);
          const w = parseFloat(s.width);
          const h = parseFloat(s.height);
          if (
            absX >= left &&
            absX <= left + w &&
            absY >= top &&
            absY <= top + h
          ) {
            handleNoteClick({ target: el });
            e.preventDefault();
            e.stopPropagation();
            break;
          }
        }
      },
      true
    );
  }
  for (let index = 0; index < validRects.length; index++) {
    const rect = validRects[index];
    var newNode = document.createElement("span");
    // 高亮层置于文字下方（z-index: -1），pointer-events: none 完全不阻断文字选择与点击穿透
    // 点击事件由上方注册在 doc.body 上的事件委托处理，通过坐标命中高亮区域来触发
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
        (Math.min(rect.left, rect.x) + scrollLeft) +
        "px; top:" +
        (Math.min(rect.top, rect.y) + scrollTop) +
        "px;" +
        "width:" +
        rect.width +
        "px; height:" +
        rect.height +
        "px; z-index: -1; "
    );
    newNode.setAttribute("class", " kookit-note");
    newNode.setAttribute("data-key", noteKey);
    doc.body.appendChild(newNode);
    if (isNote && rect === topRightRect) {
      const iconNode = document.createElement("span");
      iconNode.setAttribute(
        "style",
        "position: absolute;" +
          "left:" +
          (Math.min(rect.left, rect.x) + scrollLeft + rect.width - 15) +
          "px; top:" +
          (Math.min(rect.top, rect.y) + scrollTop - 15) +
          "px;" +
          "width: 16px; height: 16px; z-index: 2; font-size: 14px; line-height: 1; "
      );
      iconNode.setAttribute("class", "kookit-note");
      iconNode.setAttribute("data-key", noteKey);
      iconNode.textContent = "📋";
      doc.body.appendChild(iconNode);
    }
  }
};
