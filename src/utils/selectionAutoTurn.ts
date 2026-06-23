// Corner-dwell auto page-turn during text selection (#1354 pattern from Readest).
// The selection handle must rest in a screen corner for AUTO_TURN_DWELL_MS before
// the page turns, so merely passing the corner mid-drag does not flip the page.

const AUTO_TURN_DWELL_MS = 500;
// Quarter-ellipse radius around each corner (fraction of width/height). Kept tight
// so normal selections ending in the lower-right of the page do not auto-turn.
const AUTO_TURN_CORNER_FRACTION = 0.15;

type Corner = "br" | "tl";

const cornerOf = (x: number, y: number, w: number, h: number): Corner | null => {
  if (w <= 0 || h <= 0) return null;
  const rx = w * AUTO_TURN_CORNER_FRACTION;
  const ry = h * AUTO_TURN_CORNER_FRACTION;
  const inEllipse = (dx: number, dy: number) =>
    (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
  if (inEllipse(w - x, h - y)) return "br";
  if (inEllipse(x, y)) return "tl";
  return null;
};

// Map a viewport point to a corner zone, if any. Ignore off-screen caret positions
// (e.g. focus jumping into the next column while dragging at the corner).
const cornerAt = (x: number, y: number, w: number, h: number): Corner | null => {
  if (w <= 0 || h <= 0) return null;
  if (x < 0 || x > w || y < 0 || y > h) return null;
  return cornerOf(x, y, w, h);
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
  if (
    rect.width === 0 &&
    rect.height === 0 &&
    rect.left === 0 &&
    rect.top === 0
  ) {
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
  let engagedCorner: Corner | null = null;
  let isAutoTurning = false;
  let pinnedScrollLeft: number | null = null;
  let pinnedScrollTop: number | null = null;
  let pointerPos: { x: number; y: number } | null = null;
  let isTextSelected = false;
  let outerTouchCleanup: (() => void) | null = null;
  // After an auto-turn, ignore caret-based corner signals until selection ends.
  // Otherwise the selection focus/end rect on the new page can immediately
  // trigger a turn in the opposite direction.
  let pointerOnlyUntilClear = false;

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

  const pointerCornerNow = (): Corner | null => {
    const p = pointerPos;
    if (!p) return null;
    const { w, h } = viewportSize();
    return cornerAt(p.x, p.y, w, h);
  };

  const caretCornerNow = (): Corner | null => {
    const sel = doc.getSelection();
    if (!sel || !isValidSelection(sel)) return null;
    const pos = focusCaretPos(doc, sel);
    if (!pos) return null;
    const { w, h } = viewportSize();
    return cornerAt(pos.x, pos.y, w, h);
  };

  const activeCornerNow = (): Corner | null => {
    const pointerCorner = pointerCornerNow();
    if (pointerCorner) return pointerCorner;
    if (pointerOnlyUntilClear) return null;
    return caretCornerNow();
  };

  const inCorner = (c: Corner): boolean => activeCornerNow() === c;

  const cancelAutoTurn = () => {
    engagedCorner = null;
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
      noteCorner(pointerCornerNow());
    };

    const onOuterTouch = (event: TouchEvent) => {
      if (!isTextSelected) return;
      const touch = event.touches[0];
      if (!touch) return;
      const coords = toIframeCoords(touch.clientX, touch.clientY);
      pointerPos = coords;
      noteCorner(pointerCornerNow());
    };

    const onPointer = (event: PointerEvent) => {
      if (!isTextSelected) return;
      const coords =
        event.view === iframeWin
          ? { x: event.clientX, y: event.clientY }
          : toIframeCoords(event.clientX, event.clientY);
      pointerPos = coords;
      noteCorner(pointerCornerNow());
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

  const armDwell = (corner: Corner) => {
    if (autoTurnTimer) return;
    autoTurnTimer = setTimeout(() => {
      autoTurnTimer = null;
      const sel = doc.getSelection();
      if (isAutoTurning || !sel || !isValidSelection(sel) || !inCorner(corner)) {
        return;
      }

      isAutoTurning = true;
      const turning = corner === "br" ? render.next() : render.prev();
      Promise.resolve(turning).finally(() => {
        pinnedScrollLeft = doc.body.scrollLeft;
        pinnedScrollTop = doc.body.scrollTop;
        isAutoTurning = false;
        engagedCorner = corner;
        pointerOnlyUntilClear = true;
      });
    }, AUTO_TURN_DWELL_MS);
  };

  const noteCorner = (corner: Corner | null) => {
    if (isAutoTurning) return;
    if (corner) {
      if (engagedCorner !== corner) {
        engagedCorner = corner;
        armDwell(corner);
      }
    } else if (engagedCorner && !inCorner(engagedCorner)) {
      engagedCorner = null;
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
    pointerOnlyUntilClear = false;
    cancelAutoTurn();
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
      if (!pointerOnlyUntilClear) {
        noteCorner(caretCornerNow());
      }
    } else {
      onSelectionCleared();
    }
  };

  const onTouchMove = (clientX: number, clientY: number) => {
    pointerPos = { x: clientX, y: clientY };
    noteCorner(pointerCornerNow());
  };

  const onSelectionCleared = () => {
    isTextSelected = false;
    pointerOnlyUntilClear = false;
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
