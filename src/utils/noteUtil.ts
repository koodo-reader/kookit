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

const TOOLTIP_ID = "kookit-note-tooltip";

type TooltipAnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const getTooltipAnchorRect = (element: Element): TooltipAnchorRect => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const mergeTooltipAnchorRects = (
  elements: HTMLElement[]
): TooltipAnchorRect | null => {
  if (elements.length === 0) return null;
  const rects = elements
    .map((element) => getTooltipAnchorRect(element))
    .filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

const positionTooltipAboveRect = (
  tooltip: HTMLElement,
  rect: TooltipAnchorRect,
  doc: Document,
  offset: number
) => {
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  requestAnimationFrame(() => {
    const vpW = doc.documentElement.clientWidth || window.innerWidth;
    const vpH = doc.documentElement.clientHeight || window.innerHeight;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.top - th - offset;
    if (left < 0) left = 0;
    if (left + tw > vpW) left = Math.max(0, vpW - tw);
    if (top < 0) {
      top = rect.bottom + offset;
      if (top + th > vpH) {
        top = Math.max(0, vpH - th);
      }
    }
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  });
};

const getNoteTooltipAnchorRect = (
  target: HTMLElement,
  doc: Document
): TooltipAnchorRect => {
  const noteKey = target.getAttribute("data-key");
  if (!noteKey) return getTooltipAnchorRect(target);
  const noteElements = Array.from(
    doc.querySelectorAll(".kookit-note[data-key], .kookit-note-icon[data-key]")
  ).filter((element) => {
    return (element as HTMLElement).getAttribute("data-key") === noteKey;
  }) as HTMLElement[];
  return mergeTooltipAnchorRects(noteElements) || getTooltipAnchorRect(target);
};

const showNoteTooltip = (
  content: string,
  target: HTMLElement,
  doc: Document
) => {
  let tooltip = doc.getElementById(TOOLTIP_ID) as HTMLElement | null;
  if (!tooltip) {
    tooltip = doc.createElement("span");
    tooltip.setAttribute("id", TOOLTIP_ID);
    tooltip.setAttribute("class", "kookit-note-tooltip");
    tooltip.setAttribute(
      "style",
      "position: fixed; z-index: 9999; max-width: 280px; padding: 6px 10px;" +
        " background: #383838; color: #fff; font-size: 15px !important;" +
        " border-radius: 6px; pointer-events: none;" +
        " word-break: break-word; white-space: pre-wrap; line-height: 1.5;"
    );
    doc.body.appendChild(tooltip);
  }
  tooltip.textContent = content;
  tooltip.style.display = "block";
  positionTooltipAboveRect(
    tooltip,
    getNoteTooltipAnchorRect(target, doc),
    doc,
    10
  );
};

const hideNoteTooltip = (doc: Document) => {
  const tooltip = doc.getElementById(TOOLTIP_ID) as HTMLElement | null;
  tooltip?.remove();
};

/**
 * Batch version: resolve ALL character ranges on a clean DOM first,
 * then apply all inline highlights. This is used by renderHighlighters
 * after clearHighlight() has been called, so the DOM is already clean.
 *
 * While inline highlight spans don't change the total character count
 * (rangy walks through all text nodes regardless of nesting), the batch
 * approach is still preferred for initial rendering because:
 * 1. It avoids any edge cases with overlapping ranges after splitText()
 * 2. It's more efficient (single pass for resolve, single pass for apply)
 */
export const showNoteHighlightBatch = (
  notes: Array<{
    range: any;
    colorIndex: number;
    noteKey: string;
    isNote: boolean;
    noteContent: string;
  }>,
  handleNoteClick: any,
  doc: Document,
  iframe: any,
  isMobile: boolean
) => {
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let selection = rangy.getSelection(iframe);

  // Phase 1: Resolve all character ranges → native Range objects on clean DOM
  const resolved: Array<{
    nativeRange: Range;
    colorCode: string;
    noteKey: string;
    isNote: boolean;
    noteContent: string;
  }> = [];

  for (let i = 0; i < notes.length; i++) {
    const item = notes[i];
    try {
      selection.restoreCharacterRanges(doc, [item.range]);
      const nativeRange = selection.getRangeAt(0).nativeRange.cloneRange();
      resolved.push({
        nativeRange,
        colorCode: classes[item.colorIndex],
        noteKey: item.noteKey,
        isNote: item.isNote,
        noteContent: item.noteContent,
      });
    } catch (e) {
      console.warn(
        "Failed to restore character range for note:",
        item.noteKey,
        e
      );
    }
    if (iWin?.getSelection()) iWin.getSelection().empty();
  }

  // Phase 2: Apply all inline highlights (order doesn't matter now,
  // since we already have concrete Range objects)
  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    // Wrap in a rangy range so highlightRange can access .nativeRange
    highlightRange(
      { nativeRange: r.nativeRange },
      r.colorCode,
      r.noteKey,
      handleNoteClick,
      doc,
      r.isNote,
      isMobile,
      r.noteContent
    );
  }
};

export const showNoteHighlight = (
  range: any,
  colorIndex: number,
  noteKey: string,
  handleNoteClick: any,
  doc: Document,
  iframe: any,
  isNote: boolean,
  isMobile: boolean,
  noteContent: string = ""
) => {
  let colorCode = classes[colorIndex];
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let temp = range;
  temp = [temp];

  // Inline highlight <span> wrappers don't add or remove characters from the
  // DOM text — they only nest existing text nodes inside a span. splitText()
  // also preserves total character count. So rangy's character-offset-based
  // restoreCharacterRanges works correctly even with existing highlights.
  //
  // The key requirement is that NO extra text nodes are introduced by
  // highlight/icon/tooltip elements. The 📋 icon uses CSS ::before (no text
  // node), and the tooltip uses class "kookit-note-tooltip" (not counted).

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
    isMobile,
    noteContent
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
  isMobile: boolean,
  noteContent: string = ""
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
    if (isNote && noteContent) {
      newNode?.setAttribute("data-note-content", noteContent);
    }
    newNode?.addEventListener("mouseenter", (event: any) => {
      if (!isNote || !noteContent) return;
      showNoteTooltip(noteContent, event.currentTarget as HTMLElement, doc);
    });
    newNode?.addEventListener("mouseleave", () => {
      hideNoteTooltip(doc);
    });
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
        let selectedText = "";
        if (doc && doc.getSelection()) {
          selectedText = doc.getSelection()?.toString().trim() || "";
        }
        if (
          (event.target as any).dataset &&
          (event.target as any).dataset.key &&
          !selectedText
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
  // Remove absolutely-positioned note icon elements (📋) first
  const icons = doc.querySelectorAll(".kookit-note-icon");
  for (let index = 0; index < icons.length; index++) {
    icons[index].parentNode?.removeChild(icons[index]);
  }
  // Handle two cases:
  // 1. Inline highlight spans (from highlightRange) → unwrap to restore text
  // 2. Absolutely-positioned divs (from showPDFHighlight) → just remove
  //
  // Overlapping highlights produce nested .kookit-note spans. We must unwrap
  // from outermost to innermost; querySelectorAll returns them in DOM order
  // (outer first), so each iteration re-queries to pick up newly-exposed
  // inner spans after the outer span is removed.
  let elements = doc.querySelectorAll(".kookit-note");
  while (elements.length > 0) {
    const element = elements[0];
    const parent = element.parentNode;
    if (!parent) {
      elements = doc.querySelectorAll(".kookit-note");
      continue;
    }
    if (element.tagName === "SPAN" && element.childNodes.length > 0) {
      // Inline span wrapping text: unwrap by moving children out
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      parent.normalize();
    } else {
      // Absolutely-positioned overlay (PDF) or empty: just remove
      parent.removeChild(element);
    }
    elements = doc.querySelectorAll(".kookit-note");
  }
};

export const highlightRange = (
  range: any,
  colorCode: string,
  noteKey: string,
  handleNoteClick: any,
  doc: any,
  isNote: boolean = false,
  isMobile: boolean = false,
  noteContent: string = ""
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
          isMobile,
          noteContent
        );
      }
    };
    requestAnimationFrame(waitAndHighlight);
    return;
  }

  // --- Inline wrapping approach ---
  // Instead of creating absolutely-positioned overlay spans that become
  // misaligned when page content changes (e.g. ::after pseudo-elements,
  // translations), we wrap the actual text nodes in the range with inline
  // <span> elements. This way highlights are part of the document flow
  // and always stay aligned with the text they belong to.

  const nativeRange: Range = range.nativeRange;

  // Collect all text nodes within the range
  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(
    nativeRange.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Text) => {
        // Check if this text node is within (or partially within) the range
        const nodeRange = doc.createRange();
        nodeRange.selectNodeContents(node);
        if (
          nativeRange.compareBoundaryPoints(Range.END_TO_START, nodeRange) <
            0 &&
          nativeRange.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    }
  );
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }
  // Handle single text node case (commonAncestorContainer is a text node)
  if (
    textNodes.length === 0 &&
    nativeRange.commonAncestorContainer.nodeType === Node.TEXT_NODE
  ) {
    textNodes.push(nativeRange.commonAncestorContainer as Text);
  }

  // Build the inline style for the highlight
  const isColorHighlight = colorCode.indexOf("color") > -1;
  const colorIdx = colorCode.split("-")[1];
  const highlightStyle = isColorHighlight
    ? "background-color: " + colors[colorIdx]
    : "border-bottom: 2px solid " + lines[colorIdx];

  const wrappedSpans: HTMLElement[] = [];
  // Track existing kookit-note parent spans already promoted to outer wrappers
  // so we don't double-wrap them when multiple text nodes share the same parent.
  const promotedSpans = new Set<HTMLElement>();

  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i];
    // Skip empty or whitespace-only text nodes
    if (!textNode.textContent || !textNode.textContent.trim()) continue;
    // Skip text nodes already inside a kookit-note span for the same key
    if (
      textNode.parentElement &&
      textNode.parentElement.classList.contains("kookit-note") &&
      textNode.parentElement.getAttribute("data-key") === noteKey
    ) {
      wrappedSpans.push(textNode.parentElement);
      continue;
    }

    // If the text node lives inside a *different* kookit-note span, decide
    // whether the new highlight should go OUTSIDE (new is larger) or INSIDE
    // (new is smaller / partial) the existing span.
    //
    // Rule: wrap the existing span from the outside only when the new range
    // FULLY CONTAINS the existing span. In that case the existing (smaller)
    // highlight stays innermost and keeps its own color + click identity.
    // Otherwise (new range is smaller or partially overlapping), fall through
    // to the normal text-node splitting logic so the new highlight becomes
    // innermost for its specific portion of text.
    const existingNoteParent = textNode.parentElement?.closest?.(
      ".kookit-note[data-key]"
    ) as HTMLElement | null;
    if (
      existingNoteParent &&
      existingNoteParent.getAttribute("data-key") !== noteKey
    ) {
      // Check whether the new range fully contains the existing span
      const parentRange = doc.createRange();
      parentRange.selectNodeContents(existingNoteParent);
      const newStartBeforeOrAt =
        nativeRange.compareBoundaryPoints(Range.START_TO_START, parentRange) <=
        0;
      const newEndAfterOrAt =
        nativeRange.compareBoundaryPoints(Range.END_TO_END, parentRange) >= 0;
      const parentFullyContained = newStartBeforeOrAt && newEndAfterOrAt;

      if (parentFullyContained) {
        // New highlight is larger — wrap the existing span from outside so
        // the existing (inner) highlight keeps visual and click priority.
        if (promotedSpans.has(existingNoteParent)) continue;
        promotedSpans.add(existingNoteParent);

        // Check if existingNoteParent is already wrapped by our noteKey
        const alreadyOuter = existingNoteParent.parentElement?.closest?.(
          `.kookit-note[data-key="${noteKey}"]`
        ) as HTMLElement | null;
        if (alreadyOuter) {
          wrappedSpans.push(alreadyOuter);
          continue;
        }

        const span = doc.createElement("span");
        span.setAttribute("style", highlightStyle);
        span.setAttribute("class", "kookit-note");
        span.setAttribute("data-key", noteKey);
        if (isNote && noteContent) {
          span.setAttribute("data-note-content", noteContent);
        }
        existingNoteParent.parentNode!.insertBefore(span, existingNoteParent);
        span.appendChild(existingNoteParent);
        wrappedSpans.push(span);
        continue;
      }
      // else: new range is smaller or partially overlapping — fall through to
      // the normal text-node path below. The new span will be inserted
      // innermost (directly around the text), which ensures the new
      // highlight's color and click handler take priority for its region.
    }

    // Determine the portion of this text node that falls within the range
    let startOffset = 0;
    let endOffset = textNode.textContent.length;
    if (textNode === nativeRange.startContainer) {
      startOffset = nativeRange.startOffset;
    }
    if (textNode === nativeRange.endContainer) {
      endOffset = nativeRange.endOffset;
    }

    // If only a partial text node is highlighted, split it
    let targetNode = textNode;
    if (startOffset > 0) {
      targetNode = textNode.splitText(startOffset);
      endOffset -= startOffset;
    }
    if (endOffset < targetNode.textContent!.length) {
      targetNode.splitText(endOffset);
    }

    // Create the wrapper span
    const span = doc.createElement("span");
    span.setAttribute("style", highlightStyle);
    span.setAttribute("class", "kookit-note");
    span.setAttribute("data-key", noteKey);
    if (isNote && noteContent) {
      span.setAttribute("data-note-content", noteContent);
    }

    // Wrap the text node with the span
    targetNode.parentNode!.insertBefore(span, targetNode);
    span.appendChild(targetNode);
    wrappedSpans.push(span);
  }

  // --- Event delegation ---
  // Use DOM-based event delegation on doc.body (registered once)
  // Since highlights are now inline elements, we can detect them via
  // event.target.closest() instead of coordinate-based hit testing.
  if (!(doc.body as any).__kookitDelegated) {
    (doc.body as any).__kookitDelegated = true;
    let delegateDownX = 0;
    let delegateDownY = 0;
    doc.body.addEventListener(
      "mousemove",
      (e: MouseEvent) => {
        const target = (e.target as HTMLElement)?.closest?.(
          ".kookit-note[data-key]"
        ) as HTMLElement | null;
        if (target) {
          doc.body.style.cursor = "pointer";
          const nc = target.getAttribute("data-note-content") || "";
          if (nc) {
            showNoteTooltip(nc, target, doc);
          } else {
            hideNoteTooltip(doc);
          }
        } else {
          doc.body.style.cursor = "";
          hideNoteTooltip(doc);
        }
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
        const target = (e.target as HTMLElement)?.closest?.(
          ".kookit-note[data-key]"
        ) as HTMLElement | null;
        if (target) {
          handleNoteClick({ target });
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
        // For touch events, use elementFromPoint to find the target
        const el = doc.elementFromPoint(touch.clientX, touch.clientY);
        const target = (el as HTMLElement)?.closest?.(
          ".kookit-note[data-key]"
        ) as HTMLElement | null;
        let selectedText = "";
        if (doc && doc.getSelection()) {
          selectedText = doc.getSelection()?.toString().trim() || "";
        }
        if (target && !selectedText) {
          handleNoteClick({ target });
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  }

  // --- Note icon (📋) ---
  // For notes with content, place a small icon near the first highlight span.
  // The icon is positioned absolutely but anchored relative to a position:relative
  // wrapper, or we compute it from the first span's bounding rect.
  if (isNote && wrappedSpans.length > 0) {
    const firstSpan = wrappedSpans[0];
    const iconNode = doc.createElement("span");
    iconNode.setAttribute("class", "kookit-note-icon");
    iconNode.setAttribute("data-key", noteKey);
    // Use CSS content via ::before to display the icon, so no text node
    // is added to the DOM. This prevents the icon text from interfering
    // with rangy's character-offset calculations.
    iconNode.setAttribute(
      "style",
      "position: relative; z-index: 2; font-size: 14px; line-height: 1; cursor: pointer; pointer-events: auto;"
    );
    // Insert icon right before the first highlight span
    firstSpan.parentNode?.insertBefore(iconNode, firstSpan);
  }
};

const WORD_TOOLTIP_ID = "kookit-word-tooltip";

const showWordTooltip = (
  content: string,
  target: HTMLElement,
  doc: Document
) => {
  let tooltip = doc.getElementById(WORD_TOOLTIP_ID) as HTMLElement | null;
  if (!tooltip) {
    tooltip = doc.createElement("span");
    tooltip.setAttribute("id", WORD_TOOLTIP_ID);
    tooltip.setAttribute("class", WORD_TOOLTIP_ID);
    tooltip.setAttribute(
      "style",
      "position: fixed; z-index: 9999; max-width: 280px; padding: 6px 10px;" +
        " background: #383838; color: #fff; font-size: 15px !important;" +
        " border-radius: 6px; pointer-events: none;" +
        " word-break: break-word; white-space: pre-wrap; line-height: 1.5;"
    );
    doc.body.appendChild(tooltip);
  }
  tooltip.textContent = content;
  tooltip.style.display = "block";
  positionTooltipAboveRect(tooltip, getTooltipAnchorRect(target), doc, 6);
};

const hideWordTooltip = (doc: Document) => {
  const tooltip = doc.getElementById(WORD_TOOLTIP_ID) as HTMLElement | null;
  tooltip?.remove();
};

export const clearWordDefinitions = (doc: Document) => {
  const spans = doc.querySelectorAll(".kookit-word-def");
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parent.normalize();
  }
};

export const applyWordDefinitions = (
  definitionMap: Record<string, any>,
  doc: Document,
  lang: string = "en",
  locale: string = "en",
  rootElement?: Element
) => {
  const words = Object.keys(definitionMap);
  if (words.length === 0) return;

  const isCJK = lang === "zh" || lang === "ja";

  // Sort longest first to prefer longer matches in CJK
  const sortedWords = isCJK
    ? [...words].sort((a, b) => b.length - a.length)
    : words;

  const escapedWords = sortedWords.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  // CJK languages have no word boundaries; English uses \b
  const pattern = isCJK
    ? new RegExp("(" + escapedWords.join("|") + ")", "g")
    : new RegExp("\\b(" + escapedWords.join("|") + ")\\b", "gi");

  // Collect text nodes (skip nodes inside kookit spans or script/style)
  const walker = doc.createTreeWalker(
    rootElement || doc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Node) => {
        let parent = (node as Text).parentElement;
        while (parent) {
          const tag = parent.tagName;
          if (
            tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "RUBY" ||
            parent.classList.contains("kookit-note") ||
            parent.classList.contains("kookit-word-def") ||
            parent.classList.contains("kookit-note-tooltip") ||
            parent.classList.contains("kookit-word-tooltip")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    pattern.lastIndex = 0;
    if (!pattern.test(text)) continue;
    pattern.lastIndex = 0;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) fragment.appendChild(doc.createTextNode(before));

      const word = match[0];
      const defKey = word.toLowerCase();
      const def = definitionMap[defKey] || definitionMap[word];

      const span = doc.createElement("span");
      span.className = "kookit-word-def";
      let meaning = def.meaning || "";
      if (locale === "zhCN" && def.cn_meaning) {
        meaning = def.cn_meaning;
      }
      span.setAttribute("data-meaning", meaning || "");
      let fullDef: string;
      if (lang === "zh") {
        fullDef = [
          "[" + def.pinyin + "]" || "",
          meaning || "",
          def.level ? "[HSK" + def.level + "]" : "",
        ]
          .filter(Boolean)
          .join("  ");
      } else if (lang === "ja") {
        const reading = [
          def.furigana || "",
          def.romaji ? "(" + def.romaji + ")" : "",
        ]
          .filter(Boolean)
          .join("");
        fullDef = [
          reading,
          meaning || "",
          def.level ? "[N" + def.level + "]" : "",
        ]
          .filter(Boolean)
          .join("  ");
      } else {
        fullDef = [
          def.pronunciation || "",
          meaning || "",
          def.level ? "[" + def.level + "]" : "",
        ]
          .filter(Boolean)
          .join("  ");
      }
      span.setAttribute("data-def-full", fullDef);
      // The word text node — no extra text nodes added, so rangy offsets are safe
      span.appendChild(doc.createTextNode(word));
      fragment.appendChild(span);

      lastIndex = match.index + word.length;
    }

    if (lastIndex === 0) continue; // no match found

    const after = text.slice(lastIndex);
    if (after) fragment.appendChild(doc.createTextNode(after));

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  // Register event delegation on doc.body once per document
  if (!(doc.body as any).__kookitWordDefDelegated) {
    (doc.body as any).__kookitWordDefDelegated = true;

    doc.body.addEventListener(
      "mousemove",
      (e: MouseEvent) => {
        const target = (e.target as HTMLElement)?.closest?.(
          ".kookit-word-def"
        ) as HTMLElement | null;
        if (target) {
          const fullDef = target.getAttribute("data-def-full") || "";
          showWordTooltip(fullDef, target, doc);
        } else {
          hideWordTooltip(doc);
        }
      },
      true
    );

    doc.body.addEventListener(
      "mouseleave",
      () => {
        hideWordTooltip(doc);
      },
      true
    );
    doc.body.addEventListener(
      "touchend",
      (e: TouchEvent) => {
        const target = (e.target as HTMLElement)?.closest?.(
          ".kookit-word-def"
        ) as HTMLElement | null;
        if (target) {
          const fullDef = target.getAttribute("data-def-full") || "";
          showWordTooltip(fullDef, target, doc);
          e?.preventDefault();
          e?.stopPropagation();
        } else {
          let tooltip = doc.getElementById(
            WORD_TOOLTIP_ID
          ) as HTMLElement | null;
          if (tooltip) {
            hideWordTooltip(doc);
            e?.preventDefault();
            e?.stopPropagation();
          }
        }
      },
      true
    );
  }
};
