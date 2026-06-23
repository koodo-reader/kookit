// Corner/edge-dwell auto page-turn during text selection (#1354 pattern from Readest).
// When the user drags a selection handle to the screen edge and holds for
// AUTO_TURN_DWELL_MS, turn one page so native Selection can extend across columns.

const AUTO_TURN_DWELL_MS = 500;
const AUTO_TURN_EDGE_FRACTION = 0.15;

type Edge = "br" | "tl";

// Right/left edge strips (full height). Maps to next/prev page turns.
const edgeAt = (x: number, _y: number, w: number, h: number): Edge | null => {
  if (w <= 0 || h <= 0) return null;
  const strip = w * AUTO_TURN_EDGE_FRACTION;
  if (x >= w - strip) return "br";
  if (x <= strip) return "tl";
  return null;
};

// Caret can jump into the next off-screen column while dragging at the edge.
const caretEdgeAt = (x: number, y: number, w: number, h: number): Edge | null => {
  if (w <= 0 || h <= 0) return null;
  if (y < -h * 0.1 || y > h * 1.1) return null;
  const strip = w * AUTO_TURN_EDGE_FRACTION;
  if (x >= w - strip || x > w) return "br";
  if (x <= strip || x < 0) return "tl";
  return null;
};

const focusCaretPos = (
  doc: Document,
  sel: Selection
): { x: number; y: number } | null => {
  const focusNode = sel.focusNode;
  if (!focusNode) return null;
  let rect: DOMRect;
  try {
    const range = doc.createRange();
    const offset =
      focusNode.nodeType === Node.TEXT_NODE
        ? Math.min(sel.focusOffset, (focusNode.textContent ?? "").length)
        : sel.focusOffset;
    range.setStart(focusNode, offset);
    range.collapse(true);
    rect = range.getBoundingClientRect();
  } catch {
    return null;
  }
  if (rect.width === 0 && rect.height === 0 && rect.left === 0 && rect.top === 0) {
    return null;
  }
  return {
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  };
};

export const isValidSelection = (sel: Selection | null): boolean =>
  !!(sel && sel.toString().trim().length > 0 && sel.rangeCount > 0);

export interface SelectionAutoTurnOptions {
  element: HTMLElement;
  iframe: HTMLIFrameElement;
  doc: Document;
  render: any;
  readerMode: string;
  format: string;
  enableScrollPin?: boolean;
}

export interface SelectionAutoTurn {
  onSelectStart: () => void;
  onSelectionChange: () => void;
  onTouchMove: (clientX: number, clientY: number) => void;
  onSelectionCleared: () => void;
  cancelAutoTurn: () => void;
  applyScrollPin: () => void;
  hasActiveSelection: () => boolean;
}

export const createSelectionAutoTurn = (
  options: SelectionAutoTurnOptions
): SelectionAutoTurn | null => {
  const {
    iframe,
    doc,
    render,
    readerMode,
    format,
    enableScrollPin = false,
  } = options;

  if (readerMode === "scroll" || format === "PDF") {
    return null;
  }

  let autoTurnTimer: ReturnType<typeof setTimeout> | null = null;
  let engagedEdge: Edge | null = null;
  let isAutoTurning = false;
  let pinnedScrollLeft: number | null = null;
  let pinnedScrollTop: number | null = null;
  let pointerPos: { x: number; y: number } | null = null;
  let isTextSelected = false;
  let outerTouchCleanup: (() => void) | null = null;

  const viewportSize = (): { w: number; h: number } => {
    const w =
      doc.documentElement.clientWidth ||
      doc.body.clientWidth ||
      iframe.clientWidth;
    const h =
      doc.documentElement.clientHeight ||
      doc.body.clientHeight ||
      iframe.clientHeight;
    return { w, h };
  };

  const toIframeCoords = (clientX: number, clientY: number) => {
    const iframeRect = iframe.getBoundingClientRect();
    return {
      x: clientX - iframeRect.left,
      y: clientY - iframeRect.top,
    };
  };

  const pointerEdgeNow = (): Edge | null => {
    const p = pointerPos;
    if (!p) return null;
    const { w, h } = viewportSize();
    return edgeAt(p.x, p.y, w, h);
  };

  const selectionEndEdgeNow = (): Edge | null => {
    const sel = doc.getSelection();
    if (!sel || !isValidSelection(sel)) return null;
    const { w, h } = viewportSize();
    try {
      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const last = rects[rects.length - 1];
        return caretEdgeAt(last.right, (last.top + last.bottom) / 2, w, h);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const caretEdgeNow = (): Edge | null => {
    const sel = doc.getSelection();
    if (!sel || !isValidSelection(sel)) return null;
    const pos = focusCaretPos(doc, sel);
    const { w, h } = viewportSize();
    if (pos) {
      const edge = caretEdgeAt(pos.x, pos.y, w, h);
      if (edge) return edge;
    }
    return selectionEndEdgeNow();
  };

  const inEdge = (e: Edge): boolean =>
    pointerEdgeNow() === e || caretEdgeNow() === e;

  const cancelAutoTurn = () => {
    engagedEdge = null;
    if (autoTurnTimer) {
      clearTimeout(autoTurnTimer);
      autoTurnTimer = null;
    }
  };

  const detachOuterTouch = () => {
    outerTouchCleanup?.();
    outerTouchCleanup = null;
  };

  const attachOuterTouch = () => {
    detachOuterTouch();
    const parentWin = iframe.ownerDocument?.defaultView;
    const iframeWin = doc.defaultView;
    if (!parentWin && !iframeWin) return;

    const onIframeTouch = (event: TouchEvent) => {
      if (!isTextSelected) return;
      const touch = event.touches[0];
      if (!touch) return;
      pointerPos = { x: touch.clientX, y: touch.clientY };
      noteEdge(pointerEdgeNow());
    };

    const onOuterTouch = (event: TouchEvent) => {
      if (!isTextSelected) return;
      const touch = event.touches[0];
      if (!touch) return;
      const coords = toIframeCoords(touch.clientX, touch.clientY);
      pointerPos = coords;
      noteEdge(pointerEdgeNow());
    };

    const onPointer = (event: PointerEvent) => {
      if (!isTextSelected) return;
      const coords =
        event.view === iframeWin
          ? { x: event.clientX, y: event.clientY }
          : toIframeCoords(event.clientX, event.clientY);
      pointerPos = coords;
      noteEdge(pointerEdgeNow());
    };

    iframeWin?.addEventListener("touchmove", onIframeTouch, {
      capture: true,
      passive: true,
    });
    iframeWin?.addEventListener("pointermove", onPointer, {
      capture: true,
      passive: true,
    });
    parentWin?.addEventListener("touchmove", onOuterTouch, {
      capture: true,
      passive: true,
    });
    if (parentWin && parentWin !== iframeWin) {
      parentWin.addEventListener("pointermove", onPointer, {
        capture: true,
        passive: true,
      });
    }
    outerTouchCleanup = () => {
      iframeWin?.removeEventListener("touchmove", onIframeTouch, {
        capture: true,
      });
      iframeWin?.removeEventListener("pointermove", onPointer, {
        capture: true,
      });
      parentWin?.removeEventListener("touchmove", onOuterTouch, {
        capture: true,
      });
      if (parentWin && parentWin !== iframeWin) {
        parentWin.removeEventListener("pointermove", onPointer, {
          capture: true,
        });
      }
    };
  };

  const armDwell = (edge: Edge) => {
    if (autoTurnTimer) return;
    autoTurnTimer = setTimeout(() => {
      autoTurnTimer = null;
      const sel = doc.getSelection();
      if (
        isAutoTurning ||
        !sel ||
        !isValidSelection(sel) ||
        !inEdge(edge)
      ) {
        return;
      }

      isAutoTurning = true;
      const turning = edge === "br" ? render.next() : render.prev();
      Promise.resolve(turning).finally(() => {
        pinnedScrollLeft = doc.body.scrollLeft;
        pinnedScrollTop = doc.body.scrollTop;
        isAutoTurning = false;
      });
    }, AUTO_TURN_DWELL_MS);
  };

  const noteEdge = (edge: Edge | null) => {
    if (isAutoTurning) return;
    if (edge) {
      if (engagedEdge !== edge) {
        engagedEdge = edge;
        armDwell(edge);
      }
    } else if (engagedEdge && !inEdge(engagedEdge)) {
      engagedEdge = null;
      if (autoTurnTimer) {
        clearTimeout(autoTurnTimer);
        autoTurnTimer = null;
      }
    }
  };

  const onSelectStart = () => {
    pinnedScrollLeft = doc.body.scrollLeft;
    pinnedScrollTop = doc.body.scrollTop;
    pointerPos = null;
    isTextSelected = false;
    attachOuterTouch();
  };

  const onSelectionChange = () => {
    const sel = doc.getSelection();
    if (isValidSelection(sel)) {
      isTextSelected = true;
      if (pinnedScrollLeft === null) {
        pinnedScrollLeft = doc.body.scrollLeft;
        pinnedScrollTop = doc.body.scrollTop;
      }
      if (!outerTouchCleanup) {
        attachOuterTouch();
      }
      noteEdge(caretEdgeNow());
    } else {
      onSelectionCleared();
    }
  };

  const onTouchMove = (clientX: number, clientY: number) => {
    pointerPos = { x: clientX, y: clientY };
    noteEdge(pointerEdgeNow());
  };

  const onSelectionCleared = () => {
    isTextSelected = false;
    cancelAutoTurn();
    detachOuterTouch();
    pinnedScrollLeft = null;
    pinnedScrollTop = null;
    pointerPos = null;
  };

  const applyScrollPin = () => {
    if (
      !enableScrollPin ||
      !isTextSelected ||
      isAutoTurning ||
      pinnedScrollLeft === null
    ) {
      return;
    }
    if (doc.body.scrollLeft !== pinnedScrollLeft) {
      doc.body.scrollLeft = pinnedScrollLeft;
    }
    if (pinnedScrollTop !== null && pinnedScrollTop > 0) {
      if (doc.body.scrollTop !== pinnedScrollTop) {
        doc.body.scrollTop = pinnedScrollTop;
      }
    }
  };

  return {
    onSelectStart,
    onSelectionChange,
    onTouchMove,
    onSelectionCleared,
    cancelAutoTurn,
    applyScrollPin,
    hasActiveSelection: () => isTextSelected,
  };
};
