import ComicRender from "./ComicRender";
import { createPDFIframe } from "../utils/pdfUtil.js";
import {
  DjvuFile,
  DjvuOutlineNode,
  DjvuPageDecoder,
  DjvuPageImage,
} from "../libs/djvu";

// DjVu 是固定版式文档（MRC：掩码 + 背景 + 前景），逐页解码合成为位图后
// 绘制到页面 iframe 内的 canvas，分页/懒加载/卸载沿用漫画（ComicRender）的
// 多 iframe 结构；解码按 chunk 分片进行并让出主线程，先出低质量预览再精修。
class DjvuRender extends ComicRender {
  djvu: DjvuFile | null = null;
  // 每页的渲染状态：generation 用于取消，painted 标记完成，task 记录在途任务
  private pageState: Map<
    number,
    { generation: number; painted: boolean; task: Promise<void> | null }
  > = new Map();
  private pageGenerations: Map<number, number> = new Map();
  // 每页最终展示图片的 blob URL（卸载时释放）
  private pageImageUrls: Map<number, string> = new Map();
  private coverBlob: Blob | null = null;

  async parse() {
    try {
      if (this.djvu) return;
      const djvu = await DjvuFile.open(this.comicBuffer);
      this.djvu = djvu;
      djvu.applyMetadataFromAnnotations();
      const pageCount = djvu.pageCount;
      const title = djvu.metadata.title || this.filePath || "document.djvu";
      const outline = djvu.getOutline();
      const pageHref = (index: number) => "page-" + index;
      const pageToc = Array.from({ length: pageCount }, (_, index) => ({
        label: "Page " + (index + 1),
        href: pageHref(index),
      }));
      this.book = {
        metadata: {
          title,
          author: djvu.metadata.author,
          description: djvu.metadata.description,
          publisher: djvu.metadata.publisher,
        },
        rendition: { layout: "pre-paginated" },
        // 页面渲染由 handleRenderComicChapter 覆写后直接驱动，section 的
        // load/unload 仅保留给 GeneralParser 组装 chapterDocList 使用
        sections: Array.from({ length: pageCount }, (_, index) => ({
          id: pageHref(index),
          label: "Page " + (index + 1),
          href: pageHref(index),
          load: async () => "",
          unload: async () => {},
        })),
        toc: outline ? this.outlineToToc(outline, pageHref) : pageToc,
        getCover: async () => {
          const cover = await this.getCoverBlob();
          return cover ? cover : new Blob([new ArrayBuffer(0)]);
        },
        resolveHref: (href: string) => ({ index: this.resolvePageIndex(href) }),
        resolveHrefIndex: (href: string) => ({
          index: this.resolvePageIndex(href),
        }),
        splitTOCHref: (href: string) => [href, null],
        getTOCFragment: (doc: Document) => doc.documentElement,
      } as any;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private outlineToToc(
    nodes: DjvuOutlineNode[],
    pageHref: (index: number) => string
  ): any[] {
    return nodes.map((node) => {
      const index = node.pageIndex >= 0 ? node.pageIndex : 0;
      return {
        label: node.label || "Page " + (index + 1),
        href: pageHref(index),
        subitems:
          node.children.length > 0
            ? this.outlineToToc(node.children, pageHref)
            : undefined,
      };
    });
  }

  private resolvePageIndex(href: string): number {
    if (!href) return 0;
    const pageMatch = href.match(/^page-(\d+)$/);
    if (pageMatch) return parseInt(pageMatch[1], 10);
    if (this.djvu) {
      const index = this.djvu.resolvePageIndex(href);
      if (index >= 0) return index;
    }
    const digits = href.match(/(\d+)/);
    return digits ? Math.max(0, parseInt(digits[1], 10) - 1) : 0;
  }

  async getCoverBlob(): Promise<Blob | null> {
    if (!this.djvu) {
      await this.parse();
    }
    if (this.coverBlob) return this.coverBlob;
    const thumb = this.djvu!.getThumbnailPixmap(0);
    let image: DjvuPageImage | null = null;
    if (thumb) {
      const rgba = new Uint8ClampedArray(thumb.width * thumb.height * 4);
      for (let i = 0; i < thumb.width * thumb.height; i++) {
        rgba[i * 4] = thumb.rgb[i * 3];
        rgba[i * 4 + 1] = thumb.rgb[i * 3 + 1];
        rgba[i * 4 + 2] = thumb.rgb[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      image = { width: thumb.width, height: thumb.height, rotation: 0, rgba };
    } else if (this.djvu!.pageCount > 0) {
      // 没有 TH44 缩略图时渲染首页作为封面
      image = await this.renderPageImage(0);
    }
    if (!image) return null;
    this.coverBlob = await this.imageToBlob(image);
    return this.coverBlob;
  }

  private imageToBlob(image: DjvuPageImage): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.putImageData(
        new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
        0,
        0
      );
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  private async renderPageImage(chapterDocIndex: number): Promise<DjvuPageImage | null> {
    const djvu = this.djvu;
    if (!djvu) return null;
    try {
      const page = djvu.getPage(chapterDocIndex);
      const decoder = new DjvuPageDecoder(page, djvu.getData());
      while (!decoder.isDone) {
        await decoder.decodeNext();
      }
      return decoder.composeToRgba();
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async getTemplateAspectRatio() {
    if (!this.djvu) {
      return 0.75;
    }
    try {
      const info = this.djvu.getPageInfo(0);
      const width = info.rotation % 2 === 1 ? info.height : info.width;
      const height = info.rotation % 2 === 1 ? info.width : info.height;
      const ratio = width / height;
      return ratio > 0 ? ratio : 0.75;
    } catch (error) {
      console.error(error);
      return 0.75;
    }
  }

  async handleRenderComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let doc: any = this.getDocument();
    if (!doc) return;
    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      subIframe = createPDFIframe(chapterDocIndex, doc);
    }
    let subDoc: any = subIframe?.contentDocument;
    if (!subDoc) return;
    let state = this.pageState.get(chapterDocIndex);
    if (!state) {
      state = { generation: 0, painted: false, task: null };
      this.pageState.set(chapterDocIndex, state);
    }
    // 已完成且页面 DOM 仍在（未被清空）时无需重复渲染。
    // 只依据渲染状态判断，避免“渲染被取消后 DOM 里残留 canvas 导致永不再渲染”
    if (
      state.painted &&
      this.isGenerationCurrent(chapterDocIndex, state.generation) &&
      subDoc.body.querySelector("[data-djvu-page]")
    ) {
      return;
    }
    // 同一代的在途任务直接复用，避免重复解码
    if (state.task) {
      return state.task;
    }
    const task = this.renderPage(chapterDocIndex, subDoc, state);
    state.task = task;
    try {
      await task;
    } finally {
      if (state.task === task) {
        state.task = null;
      }
    }
  }

  private isGenerationCurrent(chapterDocIndex: number, generation: number) {
    return (this.pageGenerations.get(chapterDocIndex) || 0) === generation;
  }

  private async renderPage(
    chapterDocIndex: number,
    subDoc: any,
    state: { generation: number; painted: boolean; task: Promise<void> | null }
  ) {
    const djvu = this.djvu;
    if (!djvu) return;
    const generation = (this.pageGenerations.get(chapterDocIndex) || 0) + 1;
    this.pageGenerations.set(chapterDocIndex, generation);
    state.generation = generation;
    state.painted = false;
    try {
      const page = djvu.getPage(chapterDocIndex);
      const rotated = page.info.rotation % 2 === 1;
      const displayWidth = rotated ? page.info.height : page.info.width;
      const displayHeight = rotated ? page.info.width : page.info.height;

      // 每次渲染都重建页面 DOM，避免残留上一次的半成品或旧内容
      subDoc.body.style.margin = "0";
      subDoc.body.style.height = "100%";
      subDoc.body.style.overflow = "hidden";
      subDoc.documentElement.style.height = "100%";
      subDoc.body.innerHTML = "";

      // 页面容器：图片用 object-fit:contain 自适应，文本/注释层用同样比例的
      // SVG（preserveAspectRatio=xMidYMid meet），两者缩放完全一致
      const wrapper = subDoc.createElement("div");
      wrapper.setAttribute("data-djvu-page", "1");
      wrapper.style.cssText =
        "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;";
      const canvas = subDoc.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;top:0;left:0;right:0;bottom:0;margin:auto;max-width:100%;max-height:100%;display:block;";
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      const canvasCtx = canvas.getContext("2d");
      if (canvasCtx) {
        // 先铺白底，渲染过程中也不会出现透明空洞
        canvasCtx.fillStyle = "#ffffff";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
      wrapper.appendChild(canvas);
      subDoc.body.appendChild(wrapper);

      const decoder = new DjvuPageDecoder(page, djvu.getData());
      // 存活判定以页面容器为准：图片替换 canvas 之后容器仍然存在
      const isAlive = () =>
        this.isGenerationCurrent(chapterDocIndex, generation) &&
        !!subDoc.body &&
        !!wrapper.parentNode;
      let lastPaint = 0;
      for (;;) {
        const step = await decoder.decodeNext();
        if (step === null) break;
        if (!isAlive()) return;
        const now = Date.now();
        if (step === "mask" || now - lastPaint >= 80) {
          this.paintPage(canvas, decoder.composeToRgba());
          lastPaint = now;
          await yieldToMainThread();
        }
      }
      if (!isAlive()) return;
      this.paintPage(canvas, decoder.composeToRgba());

      // 文本与注释叠加层
      const svg = subDoc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${displayWidth} ${displayHeight}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.cssText =
        "position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;overflow:visible;";
      wrapper.appendChild(svg);
      this.addTextLayer(subDoc, svg, chapterDocIndex);
      this.addAnnotationLayer(subDoc, svg, chapterDocIndex);

      // 页面里没有任何可显示的图像层时给出明确提示，而不是留一张白纸
      const decoded = decoder.decodeState;
      if (
        !decoded.mask &&
        !decoded.background &&
        !decoded.foreground &&
        !decoded.fgbz &&
        !decoded.jpegBackground &&
        !decoded.jpegForeground
      ) {
        const notice = subDoc.createElement("div");
        notice.style.cssText =
          "position:absolute;left:8%;right:8%;top:46%;text-align:center;color:#999;font:13px/1.6 sans-serif;";
        notice.textContent =
          "Unsupported DjVu page content: " +
          page.chunks.map((chunk) => chunk.id).join(",");
        wrapper.appendChild(notice);
      }

      // 最终用 <img> 展示（与漫画渲染一致，浏览器对图片的绘制最稳定），
      // canvas 仅作为渐进预览，转换完成后即可释放
      await this.swapToImage(subDoc, wrapper, canvas, chapterDocIndex, generation);
      if (!isAlive()) return;
      state.painted = true;
      this.trigger("rendered", [chapterDocIndex] as any);
    } catch (error) {
      console.error(error);
      if (subDoc && subDoc.body) {
        const failed = subDoc.createElement("div");
        failed.style.cssText =
          "position:absolute;left:0;right:0;top:46%;text-align:center;color:#999;font:13px sans-serif;";
        failed.textContent = "Failed to render DjVu page";
        subDoc.body.appendChild(failed);
      }
    }
  }

  // 把 canvas 转成 blob URL 并用 <img> 替换，作为页面的最终展示层。
  // 图片加载成功后才移除 canvas（canvas 作为兜底显示层，失败时页面仍可见）
  private async swapToImage(
    subDoc: any,
    wrapper: any,
    canvas: HTMLCanvasElement,
    chapterDocIndex: number,
    generation: number
  ): Promise<void> {
    let blob: Blob | null = null;
    try {
      if (typeof canvas.toBlob === "function") {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((result) => resolve(result), "image/png")
        );
      }
    } catch (error) {
      console.error(error);
    }
    if (!blob) return;
    if (!this.isGenerationCurrent(chapterDocIndex, generation) || !canvas.parentNode) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const previous = this.pageImageUrls.get(chapterDocIndex);
    this.pageImageUrls.set(chapterDocIndex, url);
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    const image = subDoc.createElement("img");
    image.setAttribute("data-djvu-image", "1");
    image.src = url;
    image.style.cssText =
      "position:absolute;top:0;left:0;right:0;bottom:0;margin:auto;max-width:100%;max-height:100%;display:block;";
    image.onload = () => {
      if (canvas.parentNode) {
        canvas.remove();
      }
    };
    image.onerror = () => {
      image.remove();
      if (this.pageImageUrls.get(chapterDocIndex) === url) {
        this.pageImageUrls.delete(chapterDocIndex);
      }
      URL.revokeObjectURL(url);
    };
    wrapper.insertBefore(image, canvas);
  }

  private paintPage(canvas: HTMLCanvasElement, image: DjvuPageImage) {
    if (canvas.width !== image.width || canvas.height !== image.height) {
      canvas.width = image.width;
      canvas.height = image.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
      0,
      0
    );
  }

  // 把未旋转的页面坐标映射到显示坐标（与合成时的旋转保持一致）
  private mapRect(
    x: number,
    y: number,
    width: number,
    height: number,
    pageWidth: number,
    pageHeight: number,
    rotation: number
  ): { x: number; y: number; width: number; height: number } {
    switch ((4 - rotation) & 3) {
      case 1:
        return {
          x: pageHeight - y - height,
          y: x,
          width: height,
          height: width,
        };
      case 2:
        return {
          x: pageWidth - x - width,
          y: pageHeight - y - height,
          width,
          height,
        };
      case 3:
        return {
          x: y,
          y: pageWidth - x - width,
          width: height,
          height: width,
        };
      default:
        return { x, y, width, height };
    }
  }

  // 计算每行的显示矩形与行内各词的矩形。部分 DjVu 文件的 word 级盒子不可用
  // （整行共用一个盒子，宽度合计远超父框），此时按实测文本宽度在父框内重新排布，
  // 使每个词的选区仍落在词宽范围内（否则整行都会被选中）
  private layoutLines(
    zones: any[],
    measure?: (text: string, fontSize: number) => number
  ): {
    key: string;
    words: { zone: any; x: number; y: number; width: number; height: number }[];
  }[] {
    const lines: {
      key: string;
      words: { zone: any; x: number; y: number; width: number; height: number }[];
    }[] = [];
    let counter = 0;
    const visit = (node: any) => {
      const children: any[] = node.children || [];
      if (children.length === 0) return;
      const totalWidth = children.reduce(
        (sum, child) => sum + Math.max(0, child.width),
        0
      );
      // 仅当子节点同处一行、且宽度合计装不进父框时，才认为盒子不可用
      // （段落/区域等跨行的层级宽度合计天然会超出，不能用同一判据）
      let minY = Infinity;
      let maxY = -Infinity;
      for (const child of children) {
        if (child.y < minY) minY = child.y;
        if (child.y > maxY) maxY = child.y;
      }
      const sameRow = maxY - minY <= Math.max(1, node.height) * 0.5;
      const relayout =
        children.length > 1 && sameRow && totalWidth > node.width * 1.5;
      let weights: number[] = [];
      let totalWeight = 0;
      if (relayout) {
        weights = children.map((child) => {
          const text = child.text || "";
          const measured = measure ? measure(text, node.height) : 0;
          const weight = measured > 0 ? measured : Math.max(1, text.length) * 0.5;
          return Math.max(0.5, weight);
        });
        totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      }
      const words: { zone: any; x: number; y: number; width: number; height: number }[] = [];
      let cursor = node.x;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        let x = child.x;
        let y = child.y;
        let width = child.width;
        let height = child.height;
        if (relayout) {
          width = (weights[i] / totalWeight) * node.width;
          x = cursor;
          y = node.y;
          height = node.height;
          cursor += width;
        }
        if (child.children && child.children.length > 0) {
          visit({ ...child, x, y, width, height });
        } else if (width > 0 && height > 0 && child.text && child.text.trim()) {
          words.push({ zone: child, x, y, width, height });
        }
      }
      if (words.length > 0) {
        // 同一视觉行上的相邻行段（部分文件的 line 会被切成多段）合并，
        // 复制文本时不会在行中间插换行
        const prev = lines.length > 0 ? lines[lines.length - 1] : null;
        if (prev) {
          const prevTop = Math.min(...prev.words.map((w) => w.y));
          const top = Math.min(...words.map((w) => w.y));
          const height = Math.max(...words.map((w) => w.height));
          const sameRow = Math.abs(top - prevTop) < Math.max(1, height) * 0.5;
          if (sameRow) {
            // 行内按 x 排序后拼接，保证复制顺序与视觉顺序一致
            prev.words = prev.words.concat(words).sort((a, b) => a.x - b.x);
            return;
          }
        }
        lines.push({ key: "line-" + counter++, words });
      }
    };
    for (const zone of zones) visit(zone);
    return lines;
  }

  // 隐藏文本层：在共用 overlay SVG 中加 <text>，随页面一同缩放，支持选文/复制
  private addTextLayer(subDoc: any, svg: any, chapterDocIndex: number) {
    const djvu = this.djvu;
    if (!djvu || !subDoc.createElementNS) return;
    let zones: any[] = [];
    try {
      zones = djvu.getPageTextZones(chapterDocIndex);
    } catch (error) {
      console.error(error);
      return;
    }
    if (!zones || zones.length === 0) {
      return;
    }
    // 文本宽度实测（用于词块重排的比例分配），失败时退化为按字符数估算
    let measure: ((text: string, fontSize: number) => number) | undefined;
    try {
      const measureCtx = subDoc.createElement("canvas").getContext("2d");
      if (measureCtx) {
        const cache = new Map<string, number>();
        measure = (text: string, fontSize: number) => {
          const key = fontSize + "\u0000" + text;
          const cached = cache.get(key);
          if (cached !== undefined) return cached;
          measureCtx.font = fontSize + "px serif";
          const width = measureCtx.measureText(text).width;
          cache.set(key, width);
          return width;
        };
      }
    } catch (error) {
      console.error(error);
    }
    const lines = this.layoutLines(zones, measure);
    if (lines.length === 0) return;
    const info = djvu.getPageInfo(chapterDocIndex);
    const SVG_NS = "http://www.w3.org/2000/svg";
    for (const line of lines) {
      // 一行一个 <text>，行内各词用 <tspan>：选区复制时不会逐词换行
      const text = subDoc.createElementNS(SVG_NS, "text");
      text.setAttribute("data-djvu-line", line.key);
      const first = this.mapRect(
        line.words[0].x,
        line.words[0].y,
        line.words[0].width,
        line.words[0].height,
        info.width,
        info.height,
        info.rotation
      );
      text.setAttribute("x", String(first.x));
      text.setAttribute("y", String(first.y + first.height * 0.8));
      for (const word of line.words) {
        const rect = this.mapRect(
          word.x,
          word.y,
          word.width,
          word.height,
          info.width,
          info.height,
          info.rotation
        );
        const tspan = subDoc.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(rect.x));
        tspan.setAttribute("y", String(rect.y + rect.height * 0.8));
        tspan.setAttribute("font-size", String(Math.max(1, rect.height)));
        // 词宽精确等于 zone 宽度，选区高亮才与页面图像上的文字对齐
        tspan.setAttribute("textLength", String(Math.max(1, rect.width)));
        tspan.setAttribute("lengthAdjust", "spacingAndGlyphs");
        tspan.setAttribute("fill", "transparent");
        tspan.setAttribute("style", "user-select:text;cursor:text;");
        tspan.textContent = word.zone.text;
        text.appendChild(tspan);
      }
      svg.appendChild(text);
    }
  }

  // 注释层：透明 SVG 热区，带 href 属性以复用 touchUtil 的链接跳转机制
  private addAnnotationLayer(subDoc: any, svg: any, chapterDocIndex: number) {
    const djvu = this.djvu;
    if (!djvu) return;
    let annotations: any[] = [];
    try {
      annotations = djvu.getAnnotations(chapterDocIndex);
    } catch (error) {
      console.error(error);
      return;
    }
    if (!annotations || annotations.length === 0) return;
    const info = djvu.getPageInfo(chapterDocIndex);
    for (const annotation of annotations) {
      if (!annotation.url) continue;
      const shape = annotation.shape;
      const rect = this.mapRect(
        shape.x,
        shape.y,
        Math.max(1, shape.width),
        Math.max(1, shape.height),
        info.width,
        info.height,
        info.rotation
      );
      const link = subDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
      link.setAttribute("x", String(rect.x));
      link.setAttribute("y", String(rect.y));
      link.setAttribute("width", String(Math.max(1, rect.width)));
      link.setAttribute("height", String(Math.max(1, rect.height)));
      link.setAttribute("fill", "transparent");
      link.setAttribute("pointer-events", "all");
      link.setAttribute("href", annotation.url);
      if (annotation.comment) link.setAttribute("title", annotation.comment);
      link.setAttribute("style", "cursor:pointer;");
      svg.appendChild(link);
    }
  }

  async handleUnloadComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    // 递增 generation，终止进行中的解码，并清掉渲染状态（下次访问会重新渲染）
    this.pageGenerations.set(
      chapterDocIndex,
      (this.pageGenerations.get(chapterDocIndex) || 0) + 1
    );
    const state = this.pageState.get(chapterDocIndex);
    if (state) {
      state.painted = false;
    }
    const url = this.pageImageUrls.get(chapterDocIndex);
    if (url) {
      URL.revokeObjectURL(url);
      this.pageImageUrls.delete(chapterDocIndex);
    }
    const subDoc = this.getSubDocument(chapterDocIndex);
    if (subDoc && subDoc.body.innerHTML) {
      subDoc.body.innerHTML = "";
    }
  }

  // scroll 模式下只预取下一页，避免同时解码过多大页面
  async renderComicPage(chapterDocIndex: number) {
    if (
      chapterDocIndex >= this.chapterDocList.length ||
      chapterDocIndex < 0
    ) {
      return;
    }
    if (chapterDocIndex > 2) {
      await this.handleUnloadComicChapter(chapterDocIndex - 3);
    }
    await this.handleRenderComicChapter(chapterDocIndex);
    if (this.platform === "ios") {
      return;
    }
    this.handleRenderComicChapter(chapterDocIndex + 1);
  }

  // 页面由解析结果实时渲染，无静态 HTML 可缓存
  async preCache() {
    return "";
  }

  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.djvu) {
          await this.parse();
        }
        const metadata = this.djvu!.metadata;
        const cover = await this.getCoverBlob();
        if (!cover) {
          resolve({
            name: metadata.title,
            author: metadata.author,
            description: metadata.description,
            publisher: metadata.publisher,
            cover: "",
          });
          return;
        }
        var reader = new FileReader();
        reader.readAsDataURL(cover);
        reader.onloadend = () => {
          resolve({
            name: metadata.title,
            author: metadata.author,
            description: metadata.description,
            publisher: metadata.publisher,
            cover: reader.result,
          });
        };
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }

  async doSearch(keyword: string): Promise<any[]> {
    if (!this.djvu || !keyword) return [];
    try {
      const results = this.djvu.search(keyword);
      const count = this.chapterDocList.length || this.djvu.pageCount || 1;
      return results.map((result) => {
        const pageIndex = result.pageIndex;
        return {
          excerpt: result.excerpt,
          cfi: JSON.stringify({
            text: result.excerpt,
            chapterTitle:
              this.chapterDocList[pageIndex]?.label || "Page " + (pageIndex + 1),
            chapterDocIndex: pageIndex,
            chapterHref: this.chapterDocList[pageIndex]?.href || "",
            count: "search",
            percentage: pageIndex / count,
            keyword: keyword,
          }),
        };
      });
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // 朗读/文本提取：取当前页的隐藏文本
  async getCurrentPageText(): Promise<string[]> {
    const chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    if (isNaN(chapterDocIndex) || chapterDocIndex < 0) return [];
    if (!this.djvu || chapterDocIndex >= this.djvu.pageCount) return [];
    try {
      const text = this.djvu.getPageText(chapterDocIndex);
      return text ? [text] : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async visibleText(): Promise<any[]> {
    return await this.getCurrentPageText();
  }

  async audioText(): Promise<any[]> {
    return await this.getCurrentPageText();
  }

  async getRestAudioText(_count: number) {
    return [];
  }

  async chapterText() {
    const texts = await this.getCurrentPageText();
    return texts.length > 0 ? texts[0] : "";
  }

  async getImageList(chapterDocIndex?: number): Promise<string[]> {
    const index =
      chapterDocIndex === undefined || chapterDocIndex === null
        ? parseInt(this.tempLocation.chapterDocIndex || "0")
        : chapterDocIndex;
    if (isNaN(index) || index < 0 || index > this.chapterDocList.length - 1) {
      return [];
    }
    const indices =
      this.readerMode === "double" && index % 2 === 0 ? [index, index + 1] : [index];
    const urls: string[] = [];
    for (const pageIndex of indices) {
      if (pageIndex > this.chapterDocList.length - 1) continue;
      try {
        // 已渲染过的页面直接复用其图片 URL，避免再次编码
        const cached = this.pageImageUrls.get(pageIndex);
        if (cached) {
          urls.push(cached);
          continue;
        }
        const image = await this.renderPageImage(pageIndex);
        if (!image) continue;
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
          0,
          0
        );
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((result) => resolve(result), "image/png")
        );
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        const previous = this.pageImageUrls.get(pageIndex);
        this.pageImageUrls.set(pageIndex, url);
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        urls.push(url);
      } catch (error) {
        console.error(error);
      }
    }
    return urls;
  }
}

// 分片解码之间让出主线程，避免大页面解码时界面卡顿
const yieldToMainThread = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export default DjvuRender;
