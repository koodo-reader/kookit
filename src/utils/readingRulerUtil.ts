// 阅读尺管理器：在高亮窗口以外的区域显示遮罩，按 N 行一个窗口逐步推进
class ReadingRulerManager {
  // 配置
  isReadingRuler: string = "no";
  readingRulerLineHeight: number = 3;
  readingRulerBackgroundOpacity: number = 0.6;
  readerMode: string = "single";
  isMobile: string | undefined;

  // 运行时状态
  index: number = 0;
  column: number = 0;
  skipFlip: boolean = false;

  // 由 GeneralRender 注入的回调，与渲染实例解耦
  getDoc: () => Document | null = () => null;
  getElement: () => HTMLElement = () => ({}) as HTMLElement;
  getIframe: () => HTMLIFrameElement | null = () => null;
  getIsVertical: () => boolean = () => false;
  getOverlayBackground: (doc: Document) => string = () => "#ffffff";
  nextPage: () => Promise<void> | void = async () => {};
  prevPage: () => Promise<void> | void = async () => {};

  constructor(config: any = {}) {
    this.isReadingRuler = config.isReadingRuler || "no";
    this.readingRulerLineHeight = config.readingRulerLineHeight || 3;
    this.readingRulerBackgroundOpacity =
      config.readingRulerBackgroundOpacity != null
        ? config.readingRulerBackgroundOpacity
        : 0.6;
    this.readerMode = config.readerMode || "single";
    this.isMobile = config.isMobile;
  }

  applyConfig(config: any = {}) {
    if (config.isReadingRuler != null) {
      this.isReadingRuler = config.isReadingRuler;
    }
    if (config.readingRulerLineHeight != null) {
      this.readingRulerLineHeight = config.readingRulerLineHeight;
    }
    if (config.readingRulerBackgroundOpacity != null) {
      this.readingRulerBackgroundOpacity = config.readingRulerBackgroundOpacity;
    }
  }

  isReadingRulerActive(): boolean {
    return this.isReadingRuler === "yes";
  }

  getStep() {
    return Math.max(1, Math.round(this.readingRulerLineHeight || 3));
  }
  getVisibleBounds(): { top: number; bottom: number } {
    let iframe = this.getIframe();
    let top = 0;
    let bottom = iframe ? iframe.clientHeight : 0;
    if (this.readerMode === "scroll" && this.getElement()) {
      const element = this.getElement();
      top = element.scrollTop;
      bottom = top + element.clientHeight;
    }
    return { top, bottom };
  }
  getColumnBounds(): { left: number; right: number } | null {
    if (this.readerMode !== "double") return null;
    let iframe = this.getIframe();
    if (!iframe) return null;
    const width = iframe.clientWidth;
    if (!width) return null;
    let section = Math.floor(width / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const sectionWidth = Math.max(0, (width - gap) / 2);
    if (this.column === 0) {
      return { left: 0, right: sectionWidth };
    }
    return { left: Math.min(width, sectionWidth + gap), right: width };
  }
  getLines(
    columnBounds?: { left: number; right: number } | null
  ): { top: number; bottom: number; left: number; right: number }[] {
    let doc = this.getDoc();
    let iframe = this.getIframe();
    if (!doc || !doc.body || !iframe) return [];
    if (this.getIsVertical()) return [];
    const view: any = doc.defaultView || window;
    const visible = this.getVisibleBounds();
    const visibleLeft = columnBounds ? columnBounds.left : 0;
    const visibleRight = columnBounds ? columnBounds.right : iframe.clientWidth;
    const allRects: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    }[] = [];
    const parentCache = new Map<Element, boolean>();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.textContent || "";
      if (text.trim()) {
        const parent = currentNode.parentElement;
        if (parent) {
          let parentVisible = parentCache.get(parent);
          if (parentVisible === undefined) {
            const style = view.getComputedStyle(parent);
            parentVisible =
              style.display !== "none" && style.visibility !== "hidden";
            parentCache.set(parent, parentVisible);
          }
          if (parentVisible) {
            const range = doc.createRange();
            range.selectNodeContents(currentNode);
            const rects = range.getClientRects();
            for (let index = 0; index < rects.length; index++) {
              const rect = rects[index];
              if (rect.height <= 0 || rect.width <= 0) continue;
              if (rect.bottom <= visible.top || rect.top >= visible.bottom)
                continue;
              if (rect.right <= visibleLeft || rect.left >= visibleRight)
                continue;
              allRects.push({
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
              });
            }
          }
        }
      }
      currentNode = walker.nextNode();
    }
    allRects.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
    const lines: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    }[] = [];
    for (let index = 0; index < allRects.length; index++) {
      const rect = allRects[index];
      const last = lines[lines.length - 1];
      if (last && rect.top < last.bottom - 2) {
        last.bottom = Math.max(last.bottom, rect.bottom);
        last.left = Math.min(last.left, rect.left);
        last.right = Math.max(last.right, rect.right);
      } else {
        lines.push({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        });
      }
    }
    return lines;
  }
  getMaskColor(doc: Document): string {
    const alpha = Math.min(1, Math.max(0, this.readingRulerBackgroundOpacity));
    const base = this.getOverlayBackground(doc);
    const match = base.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter((item: string) => item !== "")
        .map((item: string) => parseFloat(item));
      if (
        parts.length >= 3 &&
        parts.slice(0, 3).every((item) => !isNaN(item))
      ) {
        return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
      }
    }
    const hex = base.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)) {
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((item: string) => item + item)
              .join("")
          : hex;
      return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(
        full.slice(2, 4),
        16
      )},${parseInt(full.slice(4, 6), 16)},${alpha})`;
    }
    return `rgba(0,0,0,${alpha})`;
  }
  updateOverlay(
    animate?: boolean,
    lines?: { top: number; bottom: number; left: number; right: number }[]
  ) {
    let doc = this.getDoc();
    let iframe = this.getIframe();
    if (!doc || !doc.body || !iframe) return;
    if (!this.isReadingRulerActive()) {
      this.removeOverlay();
      return;
    }
    let windowEl = doc.getElementById("kookit-reading-ruler-window");
    let columnBounds = this.getColumnBounds();
    let lineList = lines || this.getLines(columnBounds);
    if (lineList.length === 0) {
      this.removeOverlay();
      return;
    }
    const step = this.getStep();
    const totalChunks = Math.ceil(lineList.length / step);
    if (this.index >= totalChunks) {
      this.index = totalChunks - 1;
    }
    if (this.index < 0) {
      this.index = 0;
    }
    const startIndex = this.index * step;
    const endIndex = Math.min(startIndex + step, lineList.length);
    const visible = this.getVisibleBounds();
    const top = Math.max(visible.top, lineList[startIndex].top - 4);
    const bottom = Math.min(visible.bottom, lineList[endIndex - 1].bottom + 4);
    const offset = this.isMobile === "yes" ? 0 : 16;
    const bounds = columnBounds || {
      left: 0,
      right: iframe.clientWidth,
    };
    let minLeft = lineList[startIndex].left;
    let maxRight = lineList[startIndex].right;
    for (let index = startIndex + 1; index < endIndex; index++) {
      minLeft = Math.min(minLeft, lineList[index].left);
      maxRight = Math.max(maxRight, lineList[index].right);
    }
    const left = Math.max(bounds.left, minLeft - offset);
    const width = Math.max(0, Math.min(bounds.right, maxRight + offset) - left);
    const position = this.readerMode === "scroll" ? "absolute" : "fixed";
    if (!windowEl) {
      windowEl = doc.createElement("div");
      windowEl.id = "kookit-reading-ruler-window";
      doc.body.appendChild(windowEl);
    }
    windowEl.style.cssText =
      `position:${position};left:${left}px;width:${width}px;top:${top}px;height:${Math.max(
        0,
        bottom - top
      )}px;border-radius:10px;border:1px solid rgba(128,128,128,0.5);` +
      `box-shadow:0 0 0 100000px ${this.getMaskColor(
        doc
      )};box-sizing:border-box;z-index:2147483000;pointer-events:none;` +
      `transition:${
        animate
          ? "top 0.3s ease, height 0.3s ease, left 0.3s ease, width 0.3s ease"
          : "none"
      };margin:0 !important;padding:0 !important;`;
  }
  removeOverlay() {
    let doc = this.getDoc();
    if (doc) {
      let windowEl = doc.getElementById("kookit-reading-ruler-window");
      if (windowEl && windowEl.parentNode) {
        windowEl.parentNode.removeChild(windowEl);
      }
    }
  }
  async handleChange(direction: number): Promise<boolean> {
    const columnBounds = this.getColumnBounds();
    const lines = this.getLines(columnBounds);
    if (lines.length === 0) return false;
    const step = this.getStep();
    const totalChunks = Math.ceil(lines.length / step);
    if (this.index >= totalChunks) {
      this.index = 0;
    }
    if (direction > 0) {
      if (this.index < totalChunks - 1) {
        this.index++;
      } else if (columnBounds && this.column === 0) {
        this.column = 1;
        this.index = 0;
      } else {
        await this.flipPage(1);
        return true;
      }
    } else {
      if (this.index > 0) {
        this.index--;
      } else if (columnBounds && this.column === 1) {
        this.column = 0;
        this.index = Number.MAX_SAFE_INTEGER;
      } else {
        await this.flipPage(-1);
        return true;
      }
    }
    this.updateOverlay(true, undefined);
    return true;
  }
  async flipPage(direction: number) {
    this.skipFlip = true;
    try {
      if (direction > 0) {
        await this.nextPage();
      } else {
        await this.prevPage();
      }
      await new Promise((r) =>
        setTimeout(r, this.readerMode === "scroll" ? 400 : 150)
      );
    } finally {
      this.skipFlip = false;
    }
    this.index = direction > 0 ? 0 : Number.MAX_SAFE_INTEGER;
    this.column = direction > 0 ? 0 : this.readerMode === "double" ? 1 : 0;
    this.updateOverlay();
  }
  // 由 GeneralRender 的 rendered 事件驱动
  handleRendered() {
    if (!this.isReadingRulerActive() || this.skipFlip) return;
    this.index = 0;
    this.column = 0;
    this.updateOverlay();
  }
}

export default ReadingRulerManager;
