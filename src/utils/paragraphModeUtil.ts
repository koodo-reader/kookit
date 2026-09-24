import { getBlockElement, isParentBlock } from "./common";

// 段落模式管理器：整页遮罩居中展示当前段落，逐段推进
// 段落列表按章节维度维护，段落切换与翻页解耦：
// 页面位置由 locateParagraph 静默同步，不再依赖翻页，
// 仅在章节段落耗尽时才通过 next()/prev() 真实切换章节
class ParagraphModeManager {
  // 配置
  isParagraphMode: string = "no";
  readerMode: string = "single";
  isMobile: string | undefined;

  // 运行时状态
  // 当前段落在章节段落列表中的索引
  index: number = 0;
  // 超长段落经 CSS 多列分屏后的屏索引/总屏数/单屏位移步长
  sliceIndex: number = 0;
  sliceCount: number = 1;
  sliceStep: number = 0;
  skipFlip: boolean = false;
  // 当前展示的原始段落节点，用于章节渲染后判断章节是否发生变化
  currentParagraph: HTMLElement | null = null;

  // 由 GeneralRender 注入的回调，与渲染实例解耦
  getDoc: () => Document | null = () => null;
  getElement: () => HTMLElement = () => ({}) as HTMLElement;
  getIframe: () => HTMLIFrameElement | null = () => null;
  getOverlayBackground: (doc: Document) => string = () => "#ffffff";
  getIsVertical: () => boolean = () => false;
  // 静默同步底层页面到指定段落所在页，用于阅读进度记录
  locateParagraph: (el: HTMLElement) => void = () => {};
  // 获取当前章节索引，用于判断章节切换是否真实发生
  getChapterDocIndex: () => string = () => "";
  nextPage: () => Promise<void> | void = async () => {};
  prevPage: () => Promise<void> | void = async () => {};

  constructor(config: any = {}) {
    this.isParagraphMode = config.isParagraphMode || "no";
    this.readerMode = config.readerMode || "single";
    this.isMobile = config.isMobile;
  }

  applyConfig(config: any = {}) {
    if (config.isParagraphMode != null) {
      this.isParagraphMode = config.isParagraphMode;
    }
  }

  isParagraphModeActive(): boolean {
    return this.isParagraphMode === "yes";
  }

  // 章级段落列表：整个章节文档的块级叶子节点，按文档顺序排列。
  // 不做视口过滤，每个段落只出现一次，
  // 避免跨页段落在相邻两页的列表中重复出现导致需要两次 next 才能切换段落
  getParagraphNodes(): HTMLElement[] {
    let doc = this.getDoc();
    let element = this.getElement();
    if (!doc || !doc.body || !element) return [];
    // 排除段落模式遮罩层本身，避免其中克隆展示的段落被当作真实段落
    let overlay = doc.getElementById("kookit-paragraph-overlay");
    let nodeList = getBlockElement(doc.body).filter(
      (item) => !isParentBlock(item)
    );
    return nodeList.filter(
      (el) =>
        (!overlay || !overlay.contains(el)) &&
        (el.textContent || "").trim() &&
        this.isParagraphVisible(el)
    );
  }
  // 仅过滤不可见元素（display:none 等），不做视口判断，
  // 分页列布局中未滚入视口的段落同样是有效段落
  isParagraphVisible(el: HTMLElement): boolean {
    const view: any = el.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  isParagraphInViewport(doc: Document, el: HTMLElement): boolean {
    const view: any = doc.defaultView || window;
    const style = view.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    if (this.readerMode === "scroll") {
      let element = this.getElement();
      return (
        rect.bottom > element.scrollTop &&
        rect.top < element.scrollTop + element.clientHeight
      );
    }
    let iframe = this.getIframe();
    if (!iframe) return false;
    return (
      rect.bottom > 0 &&
      rect.top < iframe.clientHeight &&
      rect.right > 0 &&
      rect.left < iframe.clientWidth
    );
  }
  // 定位当前视口内的第一个段落，用于章节渲染/跳转后的初始定位
  findFirstViewportParagraph(list: HTMLElement[]): number {
    let doc = this.getDoc();
    if (!doc) return 0;
    for (let i = 0; i < list.length; i++) {
      if (this.isParagraphInViewport(doc, list[i])) {
        return i;
      }
    }
    return 0;
  }
  updateOverlay(paragraphs?: HTMLElement[]) {
    let doc = this.getDoc();
    if (!doc || !doc.body) return;
    let overlay = doc.getElementById("kookit-paragraph-overlay");
    if (!this.isParagraphModeActive()) {
      if (overlay) {
        overlay.parentNode?.removeChild(overlay);
      }
      return;
    }
    let list = paragraphs || this.getParagraphNodes();
    if (list.length === 0) {
      this.currentParagraph = null;
      if (overlay) {
        overlay.parentNode?.removeChild(overlay);
      }
      return;
    }
    if (this.index >= list.length) {
      this.index = list.length - 1;
      this.sliceIndex = Number.MAX_SAFE_INTEGER;
    }
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.id = "kookit-paragraph-overlay";
      overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:2147483000;pointer-events:none;text-align:center;transition:background-color 0.3s ease;margin:0 !important;padding:0 !important;`;
      let content = doc.createElement("div");
      content.id = "kookit-paragraph-overlay-content";
      content.style.cssText =
        "width:calc(100% - 40px);max-width:600px;max-height:calc(100% - 150px);overflow:hidden;text-align:center;transition:background-color 0.3s ease;";
      overlay.appendChild(content);
      overlay.appendChild(this.createControls(doc));
      doc.body.appendChild(overlay);
    }
    overlay.style.backgroundColor = this.getOverlayBackground(doc);
    let content = doc.getElementById("kookit-paragraph-overlay-content");
    if (!content) return;
    content.innerHTML = "";
    content.style.height = "";
    // 列容器：段落在定高下溢出时以多列横向流动，由 transform 逐屏展示
    let inner = doc.createElement("div");
    inner.id = "kookit-paragraph-overlay-inner";
    inner.style.cssText =
      "width:100%;column-gap:40px;column-fill:auto;transition:transform 0.3s ease;";
    inner.appendChild(list[this.index].cloneNode(true));
    content.appendChild(inner);
    this.currentParagraph = list[this.index] || null;
    this.measureSlice(content, inner);
    this.sliceIndex = Math.min(this.sliceIndex, this.sliceCount - 1);
    this.showSlice();
    // 段内图片异步加载会改变实际高度，加载完成后重新测量分屏
    inner.querySelectorAll("img").forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", () => this.remeasureSlice(), {
          once: true,
        });
      }
    });
    this.refreshControls(doc);
  }
  // 图片加载完成后基于当前 DOM 重新测量分屏
  remeasureSlice() {
    let doc = this.getDoc();
    if (!doc) return;
    let content = doc.getElementById("kookit-paragraph-overlay-content");
    let inner = doc.getElementById("kookit-paragraph-overlay-inner");
    if (!content || !inner || !inner.isConnected) return;
    this.measureSlice(content, inner);
    this.sliceIndex = Math.min(this.sliceIndex, this.sliceCount - 1);
    this.showSlice();
  }
  // 段落自然高度超出遮罩容量时，切换为定高 + 多列布局并计算总屏数
  measureSlice(content: HTMLElement, inner: HTMLElement) {
    this.sliceCount = 1;
    this.sliceStep = 0;
    if (content.scrollHeight <= content.clientHeight + 1) return;
    content.style.height = "calc(100% - 150px)";
    inner.style.height = "100%";
    inner.style.columnWidth = content.clientWidth + "px";
    let gap = 40;
    // 临时让 inner 成为滚动容器，确保 scrollWidth 包含溢出列的总宽度
    inner.style.overflow = "hidden";
    let extent = Math.max(content.scrollWidth, inner.scrollWidth);
    inner.style.overflow = "";
    let step = content.clientWidth + gap;
    this.sliceCount = Math.max(1, Math.round((extent + gap) / step));
    this.sliceStep = (extent + gap) / this.sliceCount;
  }
  showSlice() {
    let doc = this.getDoc();
    if (!doc) return;
    let content = doc.getElementById("kookit-paragraph-overlay-content");
    let inner = doc.getElementById("kookit-paragraph-overlay-inner");
    if (!content || !inner) return;
    let step = this.sliceStep || content.clientWidth + 40;
    inner.style.transform = `translateX(${-this.sliceIndex * step}px)`;
  }
  createControls(doc: Document): HTMLElement {
    let controls = doc.createElement("div");
    controls.id = "kookit-paragraph-overlay-controls";
    let css =
      "position:fixed;left:0;right:0;bottom:" +
      (this.isMobile === "yes" ? 32 : 20) +
      "px;display:flex;justify-content:center;gap:48px;z-index:2147483001;pointer-events:none;";
    if (this.readerMode === "scroll") {
      let element = this.getElement();
      css =
        "position:absolute;left:0;width:100%;top:" +
        (element ? element.scrollTop + element.clientHeight - 80 : 0) +
        "px;display:flex;justify-content:center;gap:48px;z-index:2147483001;pointer-events:none;";
    }
    controls.style.cssText = css;
    const btnCss =
      "pointer-events:auto;width:44px;height:44px;padding:0;margin:0;background:transparent;border-radius:50%;border:1px solid rgba(128,128,128,1);color:rgba(128,128,128,1);display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;";
    const bindButton = (btn: HTMLElement, direction: number) => {
      const handler = (event: any) => {
        event.preventDefault();
        event.stopPropagation();
        this.handleChange(direction).catch(() => {});
      };
      btn.addEventListener("touchend", handler, { passive: false });
      btn.addEventListener("mousedown", handler);
      btn.addEventListener("click", (event: any) => {
        event.preventDefault();
        event.stopPropagation();
      });
      btn.addEventListener("dblclick", (event: any) => event.stopPropagation());
      btn.addEventListener(
        "touchstart",
        (event: any) => event.stopPropagation(),
        { passive: false }
      );
      btn.addEventListener(
        "touchmove",
        (event: any) => event.stopPropagation(),
        { passive: false }
      );
    };
    let prevBtn = doc.createElement("button");
    prevBtn.id = "kookit-paragraph-overlay-prev";
    prevBtn.style.cssText = btnCss;
    prevBtn.appendChild(this.createArrowIcon(doc, -1));
    let nextBtn = doc.createElement("button");
    nextBtn.id = "kookit-paragraph-overlay-next";
    nextBtn.style.cssText = btnCss;
    nextBtn.appendChild(this.createArrowIcon(doc, 1));
    bindButton(prevBtn, -1);
    bindButton(nextBtn, 1);
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    return controls;
  }
  createArrowIcon(doc: Document, direction: number) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.style.cssText =
      "display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;";
    const line = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", direction < 0 ? "M19 12H5" : "M5 12h14");
    const head = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    head.setAttribute("d", direction < 0 ? "M12 19l-7-7 7-7" : "M12 5l7 7-7 7");
    svg.appendChild(line);
    svg.appendChild(head);
    return svg;
  }
  refreshControls(doc: Document) {
    let controls = doc.getElementById("kookit-paragraph-overlay-controls");
    if (!controls) return;
    let color = "rgba(128,128,128,1)";
    let prevBtn = doc.getElementById("kookit-paragraph-overlay-prev");
    let nextBtn = doc.getElementById("kookit-paragraph-overlay-next");
    if (prevBtn) prevBtn.style.color = color;
    if (nextBtn) nextBtn.style.color = color;
    if (this.readerMode === "scroll") {
      let element = this.getElement();
      if (element) {
        controls.style.top =
          element.scrollTop + element.clientHeight - 80 + "px";
      }
    }
  }
  removeOverlay() {
    let doc = this.getDoc();
    if (!doc) return;
    let overlay = doc.getElementById("kookit-paragraph-overlay");
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  async handleChange(direction: number): Promise<boolean> {
    let list = this.getParagraphNodes();
    if (list.length === 0) return false;
    if (direction > 0) {
      if (this.sliceIndex < this.sliceCount - 1) {
        // 当前段还有未展示的屏，先在段内推进
        this.sliceIndex++;
        this.showSlice();
        return true;
      } else if (this.index < list.length - 1) {
        this.index++;
        this.sliceIndex = 0;
      } else {
        // 章节段落耗尽，切换到下一章
        await this.flipChapter(1);
        return true;
      }
    } else {
      if (this.sliceIndex > 0) {
        this.sliceIndex--;
        this.showSlice();
        return true;
      } else if (this.index > 0) {
        this.index--;
        // 回退到上一段时直接定位到其末屏，交由 updateOverlay 收敛
        this.sliceIndex = Number.MAX_SAFE_INTEGER;
      } else {
        // 已是本章首段，切换到上一章
        await this.flipChapter(-1);
        return true;
      }
    }
    this.updateOverlay(list);
    this.locateParagraph(list[this.index]);
    return true;
  }
  // 仅在章节段落耗尽时触发真实翻页，此时 next()/prev() 会因
  // 底层页面已位于章节边界而走章节切换逻辑
  async flipChapter(direction: number) {
    let previousChapterDocIndex = this.getChapterDocIndex();
    let previousIndex = this.index;
    let previousSliceIndex = this.sliceIndex;
    this.skipFlip = true;
    try {
      let doc = this.getDoc();
      // 先把底层页面滚到章节边界，确保 next()/prev() 走章节切换而不是普通翻页
      if (doc && doc.body && this.readerMode !== "scroll") {
        if (this.getIsVertical()) {
          doc.body.scrollTo(0, direction > 0 ? doc.body.scrollHeight : 0);
        } else {
          doc.body.scrollTo(direction > 0 ? doc.body.scrollWidth : 0, 0);
        }
      }
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
    let list = this.getParagraphNodes();
    // 书首/书尾时章节未发生变化，保持当前位置不变
    if (this.getChapterDocIndex() === previousChapterDocIndex) {
      this.index = previousIndex;
      this.sliceIndex = previousSliceIndex;
      this.updateOverlay(list);
      return;
    }
    this.index = direction > 0 ? 0 : Math.max(0, list.length - 1);
    this.sliceIndex = direction > 0 ? 0 : Number.MAX_SAFE_INTEGER;
    this.updateOverlay(list);
    if (list.length > 0) {
      this.locateParagraph(list[this.index]);
    }
  }
  // 由 GeneralRender 的 rendered 事件驱动
  handleRendered() {
    if (!this.isParagraphModeActive() || this.skipFlip) return;
    let list = this.getParagraphNodes();
    if (list.length === 0) {
      this.index = 0;
      this.sliceIndex = 0;
      this.currentParagraph = null;
      this.updateOverlay(list);
      return;
    }
    // 当前段落节点仍存在于文档中且位于视口内，说明章节与页面位置未变，
    // 保持阅读位置仅重绘遮罩（如字体、主题等引起的重渲染）
    if (this.currentParagraph && this.currentParagraph.isConnected) {
      let newIndex = list.indexOf(this.currentParagraph);
      let doc = this.getDoc();
      if (
        newIndex > -1 &&
        doc &&
        this.isParagraphInViewport(doc, this.currentParagraph)
      ) {
        this.index = newIndex;
        this.sliceIndex = Math.min(this.sliceIndex, this.sliceCount - 1);
        this.updateOverlay(list);
        return;
      }
    }
    // 章节已切换或发生跳转，定位到当前视口的第一个段落
    this.index = this.findFirstViewportParagraph(list);
    this.sliceIndex = 0;
    this.updateOverlay(list);
  }
}

export default ParagraphModeManager;
