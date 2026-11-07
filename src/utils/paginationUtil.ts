import { getSectionGap } from "./common";

declare var window: any;

// 分页滚动轴：把“当前滚动容器 + 逻辑偏移 + 每页步长”收敛到一处，
// 避免各调用方直接读写 doc.body.scrollLeft / scrollWidth。
export interface ScrollAxis {
  scroller: HTMLElement;
  // 水平从右往左翻页（竖排布局不走这个开关）
  rtl: boolean;
  // 竖排布局：滚动轴为 scrollTop
  vertical: boolean;
  // 一屏在滚动轴上的步长（单页宽度/高度 + 页间距）
  stride: number;
  maxScroll: number;
  // 以 stride 为单位的屏数（双页模式下是“对页”数量）
  pageCount: number;
}

export interface PaginationContext extends ScrollAxis {
  doc: Document;
  pageSize: number;
  gap: number;
}

export const isVerticalPagination = (): boolean => {
  return window.textOrientation === "vertical";
};

export const isRtlPagination = (): boolean => {
  return window.revertDirection === "yes" && !isVerticalPagination();
};

const hasOverflow = (
  element: HTMLElement | null | undefined,
  vertical: boolean
): boolean => {
  if (!element) return false;
  return vertical
    ? element.scrollHeight - element.clientHeight > 1
    : element.scrollWidth - element.clientWidth > 1;
};

// 识别真正产生分页滚动的元素：
// - Electron/Chromium 的 about:blank iframe 常处于 quirks mode，body 是滚动元素；
// - standards mode 下 document.scrollingElement 是 html；
// - PDF/漫画的 body 自身设置了 overflow:hidden + column-*，是显式滚动容器。
export const getPageScroller = (
  doc: Document,
  vertical: boolean = isVerticalPagination()
): HTMLElement => {
  const scrolling = (doc.scrollingElement ||
    doc.documentElement) as HTMLElement;
  const body = (doc.body || null) as HTMLElement | null;
  const bodyStyle = body ? doc.defaultView?.getComputedStyle(body) : null;
  const bodyIsScrollContainer =
    !!bodyStyle &&
    (bodyStyle.overflowX !== "visible" ||
      bodyStyle.overflowY !== "visible");
  // body 自身设置了 overflow:hidden + column-*（PDF/漫画）时优先使用 body；
  // quirks mode 下 scrollingElement 本身就是 body。
  if (
    body &&
    (scrolling === body || bodyIsScrollContainer) &&
    hasOverflow(body, vertical)
  ) {
    return body;
  }
  if (hasOverflow(scrolling, vertical)) return scrolling;
  if (body && hasOverflow(body, vertical)) return body;
  return scrolling || (body as HTMLElement) || doc.documentElement;
};

export const getMaxScroll = (
  scroller: HTMLElement,
  vertical: boolean
): number => {
  return Math.max(
    0,
    vertical
      ? scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollWidth - scroller.clientWidth
  );
};

export const createScrollAxis = (
  scroller: HTMLElement,
  rtl: boolean,
  vertical: boolean,
  stride: number
): ScrollAxis => {
  const safeStride = Math.max(1, stride);
  const maxScroll = getMaxScroll(scroller, vertical);
  return {
    scroller,
    rtl: rtl && !vertical,
    vertical,
    stride: safeStride,
    maxScroll,
    pageCount: Math.max(1, Math.round(maxScroll / safeStride) + 1),
  };
};

export const getPaginationContext = (
  element: HTMLElement,
  doc: Document,
  readerMode: string
): PaginationContext => {
  const vertical = isVerticalPagination() && readerMode !== "scroll";
  const scroller = getPageScroller(doc, vertical);
  const pageSize = vertical ? element.clientHeight : element.clientWidth;
  const gap = getSectionGap(pageSize);
  return {
    ...createScrollAxis(
      scroller,
      isRtlPagination(),
      vertical,
      pageSize + gap
    ),
    doc,
    pageSize,
    gap,
  };
};

// 逻辑偏移：统一从“第一页”开始计，RTL 下 scrollLeft 为负值。
export const getLogicalScroll = (axis: ScrollAxis): number => {
  const value = axis.vertical
    ? axis.scroller.scrollTop
    : axis.scroller.scrollLeft;
  return axis.rtl ? -value : value;
};

export const getScrollPosition = (
  axis: ScrollAxis,
  logicalOffset: number
): { left: number; top: number } => {
  const target = Math.max(
    0,
    Math.min(logicalOffset, axis.maxScroll)
  );
  if (axis.vertical) {
    return { left: 0, top: target };
  }
  return { left: axis.rtl ? -target : target, top: 0 };
};

export const scrollToLogical = (
  axis: ScrollAxis,
  logicalOffset: number,
  behavior: ScrollBehavior = "auto"
): void => {
  const { left, top } = getScrollPosition(axis, logicalOffset);
  try {
    axis.scroller.scrollTo({ left, top, behavior });
  } catch {
    if (axis.vertical) {
      axis.scroller.scrollTop = top;
    } else {
      axis.scroller.scrollLeft = left;
    }
  }
};

export const scrollToPage = (
  axis: ScrollAxis,
  page: number,
  behavior: ScrollBehavior = "auto"
): void => {
  const targetPage = Math.max(0, Math.min(page, axis.pageCount - 1));
  scrollToLogical(axis, targetPage * axis.stride, behavior);
};

export const getCurrentPage = (axis: ScrollAxis): number => {
  const page = Math.round(getLogicalScroll(axis) / axis.stride);
  return Math.max(0, Math.min(page, axis.pageCount - 1));
};

export const isAtStart = (axis: ScrollAxis): boolean => {
  return getLogicalScroll(axis) <= 0.5;
};

export const isAtEnd = (axis: ScrollAxis): boolean => {
  const logical = getLogicalScroll(axis);
  return (
    axis.maxScroll - logical < 50 ||
    getCurrentPage(axis) >= axis.pageCount - 1
  );
};

// 把节点/选区在视口中的矩形换算为“从章节第一页开始的阅读偏移”。
// LTR: rect.left + scrollLeft；RTL: -(rect.left + scrollLeft)。
// 这个换算对当前不可见的节点同样成立，可直接用于跳转定位。
export const getReadingOffset = (
  axis: ScrollAxis,
  rect: { left: number; top: number }
): number => {
  if (axis.vertical) {
    return rect.top + axis.scroller.scrollTop;
  }
  return axis.rtl
    ? -(rect.left + axis.scroller.scrollLeft)
    : rect.left + axis.scroller.scrollLeft;
};

export const getPageForReadingOffset = (
  axis: ScrollAxis,
  offset: number
): number => {
  const page = Math.floor(offset / axis.stride + 0.01);
  return Math.max(0, Math.min(page, axis.pageCount - 1));
};

export const scrollToReadingOffset = (
  axis: ScrollAxis,
  offset: number,
  behavior: ScrollBehavior = "auto"
): void => {
  scrollToLogical(axis, offset, behavior);
};

export const nextAnimationFrame = (): Promise<void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

// 旧版 WebKit（iOS <= 16）在 CSSFontFaceSet::purge 期间同步解析
// document.fonts.ready 会崩溃，检测到旧引擎时改为轮询 status。
const fontsReady = (doc: Document): Promise<void> => {
  const fonts: any = (doc as any).fonts;
  const win: any = doc.defaultView;
  if (!fonts || !win) return Promise.resolve();
  const buggyWebKit =
    win.navigator?.userAgent?.includes("AppleWebKit/605") &&
    typeof win.URL?.canParse !== "function";
  if (!buggyWebKit) return fonts.ready;
  return new Promise((resolve) => {
    const poll = () => {
      if (fonts.status === "loaded") {
        resolve();
      } else {
        win.setTimeout(poll, 100);
      }
    };
    poll();
  });
};

// 章节内容注入后，等字体和两帧再测量分页尺寸，避免移动端在列布局完成前
// 读到 scrollWidth === clientWidth 而误判为“只有一页/章节已结束”。
export const waitForStablePagination = async (
  doc?: Document
): Promise<void> => {
  if (doc) {
    await Promise.race([
      fontsReady(doc),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);
  }
  await nextAnimationFrame();
  await nextAnimationFrame();
};
