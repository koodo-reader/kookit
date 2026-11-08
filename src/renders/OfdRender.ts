import ComicRender from "./ComicRender";
import { createPDFIframe } from "../utils/pdfUtil.js";
import {
  LiteOfd,
  OfdRender as OfdPageRenderer,
  OFD_KEY as ofdKeys,
  rendererConfig,
} from "liteofd";
declare var window: any;

const DEFAULT_PAGE_BOX = { width: 210, height: 297 };
// 与 liteofd 内部的 MaxScale 保持一致（超过 5 会被库截断）
const MAX_RENDER_SCALE = 5;
const PAGE_RENDER_TIMEOUT = 6000;
const COVER_WIDTH = 640;

const clampScale = (scale: number): number => {
  if (!isFinite(scale) || scale < 1) {
    return 1;
  }
  return Math.min(scale, MAX_RENDER_SCALE);
};

// OFD XML 里的元素本地名（按 localName 匹配，不依赖前缀）
const OFD_LOCAL = {
  docRoot: "DocRoot",
  page: "Page",
  template: "Template",
  templatePage: "TemplatePage",
  textObject: "TextObject",
  textCode: "TextCode",
};

// 解析模型里的 PhysicalBox（仍走解析模型，尺寸读取已实测可靠）
const OFD_PHYSICAL_BOX = ofdKeys.PhysicalBox || "ofd:PhysicalBox";

interface OfdTextCodeData {
  x: number;
  y: number;
  deltaX: number[];
  deltaY: number[];
  text: string;
}

interface OfdTextObjectData {
  boundary: { x: number; y: number; width: number; height: number };
  size: number;
  ctm: number[] | null;
  codes: OfdTextCodeData[];
}

// 逐层遍历 XmlData 树（仅用于读取 PhysicalBox；children 可能是数组或 Map）
const walkNodes = (node: any, visit: (node: any) => void) => {
  if (!node || typeof node !== "object") return;
  visit(node);
  const children = node.children;
  if (children && typeof children.forEach === "function") {
    children.forEach((child: any) => walkNodes(child, visit));
  }
};

const findNodesByTag = (root: any, tag: string): any[] => {
  const list: any[] = [];
  walkNodes(root, (node: any) => {
    if (node.tagName === tag) {
      list.push(node);
    }
  });
  return list;
};

// 字距列表里的最后一个正值（列表不足时用它补齐，与库的绘制行为一致）
const lastPositive = (list: number[]): number => {
  for (let index = list.length - 1; index >= 0; index--) {
    if (list[index] > 0) return list[index];
  }
  return 0;
};

// "x y w h"（单位 mm）
const parseStBox = (
  value: string
): { x: number; y: number; width: number; height: number } => {
  const values = String(value || "")
    .trim()
    .split(/\s+/)
    .map(Number);
  const [x, y, width, height] = values;
  if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x, y, width, height };
};

// DeltaX/DeltaY 的 "g n v" 语法：g 后跟重复次数与重复值，其余为单值序列
// （与库内文本渲染的解析保持一致，保证文本层坐标与绘制位置对齐）
const parseDeltaList = (value: string): number[] => {
  const list: number[] = [];
  if (!value) return list;
  const tokens = String(value)
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  let repeatCount = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === "g") {
      repeatCount = parseInt(tokens[index + 1], 10) || 0;
      index++;
      continue;
    }
    const num = parseFloat(token);
    if (!isFinite(num)) continue;
    if (repeatCount > 0) {
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        list.push(num);
      }
      repeatCount = 0;
    } else {
      list.push(num);
    }
  }
  return list;
};

// liteofd 的页面内容在 setTimeout 中异步绘制且没有完成回调，
// 用 16×16 缩绘指纹轮询：非空且连续两次一致视为绘制完成（超时兜底放行）
const waitForPageStable = (
  pageEl: HTMLElement,
  timeout: number
): Promise<void> =>
  new Promise((resolve) => {
    const canvas = pageEl.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) {
      resolve();
      return;
    }
    const sample = document.createElement("canvas");
    sample.width = 16;
    sample.height = 16;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      resolve();
      return;
    }
    let lastFingerprint = "";
    let stableCount = 0;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      let fingerprint = "";
      try {
        ctx.clearRect(0, 0, 16, 16);
        ctx.drawImage(canvas, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let hash = 2166136261;
        let visible = 0;
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] > 8) visible++;
          hash = ((hash ^ data[index]) * 16777619) >>> 0;
          hash = ((hash ^ data[index + 3]) * 16777619) >>> 0;
        }
        fingerprint = visible > 0 ? hash.toString(36) : "";
      } catch (error) {
        fingerprint = "";
      }
      stableCount =
        fingerprint && fingerprint === lastFingerprint ? stableCount + 1 : 0;
      lastFingerprint = fingerprint;
      // 连续 3 次采样一致才认为绘制完成，给模板层等异步绘制留出余量
      if (stableCount >= 2 || Date.now() - startedAt > timeout) {
        clearInterval(timer);
        resolve();
      }
    }, 120);
  });

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });

// 解析/渲染期间抑制 liteofd 内部大量的 console.log/info/warn：
// 移动端 kookit 会把 console.* 转发 RN WebView（postMessage），日志风暴会
// 挤占桥消息；计数式切换保证并发调用时还原正确，console.error 不抑制
let consoleSilenceDepth = 0;
let silencedConsole: { log: any; info: any; warn: any } | null = null;
const silenceConsole = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  consoleSilenceDepth++;
  if (consoleSilenceDepth === 1) {
    silencedConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
    };
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
  }
  try {
    return await fn();
  } finally {
    consoleSilenceDepth--;
    if (consoleSilenceDepth === 0 && silencedConsole) {
      console.log = silencedConsole.log;
      console.info = silencedConsole.info;
      console.warn = silencedConsole.warn;
      silencedConsole = null;
    }
  }
};

// OFD 是固定版式文档，逐页由 liteofd 渲染为 canvas 后挂进独立 iframe，
// 分页/懒加载/卸载沿用漫画（ComicRender）的多 iframe 结构。
// 页面先在主文档的游离容器里完成绘制、再挂进 iframe：canvas 文字按绘制时
// 所在文档的字体集解析，这样才能用上主文档里注册的内嵌字体（挂载后绘制会
// 退化为 iframe 内的系统字体）
class OfdRender extends ComicRender {
  liteOfd: any = null;
  ofdDocument: any = null;
  private renderingPages: Map<number, Promise<void>> = new Map();
  // 每页最终展示图片的 blob URL（卸载时释放）
  private pageImageUrls: Map<number, string> = new Map();
  private coverBlob: Blob | null = null;

  async parse() {
    try {
      if (this.ofdDocument) return;
      if (typeof LiteOfd !== "function") {
        throw new Error("liteofd module is not available");
      }
      // 固定 canvas 渲染模式：每页一个 canvas，绘制完成后再挂载
      if (
        rendererConfig &&
        typeof rendererConfig.setRendererType === "function"
      ) {
        rendererConfig.setRendererType("canvas");
      }
      const liteOfd = new LiteOfd();
      await silenceConsole(() => liteOfd.parse(this.comicBuffer));
      if (typeof liteOfd.toggleRenderTextLayer === "function") {
        // 发布版的文本层为空实现；保持关闭，文本层由 addTextLayer 自建
        // （若未来版本真正生效，这里关闭也避免与自建层叠加）
        liteOfd.toggleRenderTextLayer(false);
      }
      this.liteOfd = liteOfd;
      this.ofdDocument = liteOfd.getOfdDocument();
      const pageCount = this.ofdDocument?.pages?.length || 0;
      if (pageCount === 0) {
        throw new Error("Invalid OFD file: no pages found");
      }
      this.book = {
        metadata: { title: this.filePath || "document.ofd" },
        rendition: { layout: "pre-paginated" },
        // 页面渲染由 handleRenderComicChapter 覆写后直接驱动，section 的
        // load/unload 仅保留给 GeneralParser 组装 chapterDocList 使用
        sections: Array.from({ length: pageCount }, (_, index) => ({
          id: "page-" + index,
          label: "Page " + (index + 1),
          href: "page-" + index,
          load: async () => "",
          unload: async () => {},
        })),
        toc: Array.from({ length: pageCount }, (_, index) => ({
          label: "Page " + (index + 1),
          href: "page-" + index,
        })),
        getCover: async () => {
          const cover = await this.getCoverBlob();
          return cover ? cover : new Blob([new ArrayBuffer(0)]);
        },
        resolveHref: (href: string) => ({ index: parsePageHref(href) }),
        resolveHrefIndex: (href: string) => ({ index: parsePageHref(href) }),
        splitTOCHref: (href: string) => [href, null],
        getTOCFragment: (doc: Document) => doc.documentElement,
      } as any;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // 页面尺寸来自页面 PhysicalBox（单位 mm），缺失时回退 document 级配置
  private getPhysicalBox(
    pageIndex: number
  ): { width: number; height: number } | null {
    const ofdDocument = this.ofdDocument;
    if (!ofdDocument) return null;
    const pageData = ofdDocument.pages && ofdDocument.pages[pageIndex];
    // 同样不用库的查找函数，避免取到其他页面的 PhysicalBox
    let boxNode = pageData
      ? findNodesByTag(pageData, OFD_PHYSICAL_BOX)[0]
      : null;
    if (!boxNode && ofdDocument.documentData) {
      boxNode = findNodesByTag(ofdDocument.documentData, OFD_PHYSICAL_BOX)[0];
    }
    const values = String((boxNode && boxNode.value) || "")
      .trim()
      .split(/\s+/)
      .map(Number);
    if (
      values.length < 4 ||
      !isFinite(values[2]) ||
      !isFinite(values[3]) ||
      values[2] <= 0 ||
      values[3] <= 0
    ) {
      return null;
    }
    return { width: values[2], height: values[3] };
  }

  // 在主文档的游离容器里渲染单页并等待绘制完成，返回页面元素（含 canvas）
  private async renderPageElement(
    pageIndex: number,
    scale: number
  ): Promise<HTMLElement> {
    const ofdDocument = this.ofdDocument;
    if (!ofdDocument) {
      throw new Error("OFD document not parsed");
    }
    const container = document.createElement("div");
    let pageEl: HTMLElement | null = null;
    // 绘制在 setTimeout 中异步进行，抑制窗口需要覆盖整个绘制 + 等待稳定阶段
    await silenceConsole(async () => {
      new OfdPageRenderer(ofdDocument).renderOfdWithPageIndexWithScale(
        pageIndex,
        container,
        "background-color: #ffffff;",
        scale
      );
      pageEl = (container.querySelector(".page-container") ||
        container.firstElementChild) as HTMLElement | null;
      if (pageEl) {
        await waitForPageStable(pageEl, PAGE_RENDER_TIMEOUT);
      }
    });
    if (!pageEl) {
      throw new Error("Failed to render OFD page element");
    }
    return pageEl;
  }

  async getCoverBlob(): Promise<Blob | null> {
    if (!this.coverBlob) {
      try {
        if (!this.ofdDocument) {
          await this.parse();
        }
        const box = this.getPhysicalBox(0) || DEFAULT_PAGE_BOX;
        const pageEl = await this.renderPageElement(
          0,
          clampScale(COVER_WIDTH / box.width)
        );
        const canvas = pageEl.querySelector(
          "canvas"
        ) as HTMLCanvasElement | null;
        if (!canvas || !canvas.width || !canvas.height) {
          return null;
        }
        this.coverBlob = await canvasToBlob(canvas);
      } catch (error) {
        console.error(error);
        return null;
      }
    }
    return this.coverBlob;
  }

  async getTemplateAspectRatio() {
    const box = this.getPhysicalBox(0);
    if (box && box.height > 0) {
      return box.width / box.height;
    }
    return 0.75;
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
    if (subDoc.body.innerHTML) {
      return;
    }
    const existing = this.renderingPages.get(chapterDocIndex);
    if (existing) {
      return existing;
    }
    const task = this.renderPage(chapterDocIndex, subIframe, subDoc);
    this.renderingPages.set(chapterDocIndex, task);
    try {
      await task;
    } finally {
      this.renderingPages.delete(chapterDocIndex);
    }
  }

  private async renderPage(
    chapterDocIndex: number,
    subIframe: any,
    subDoc: any
  ) {
    try {
      const box = this.getPhysicalBox(chapterDocIndex) || DEFAULT_PAGE_BOX;
      const viewW = subIframe.clientWidth || window.innerWidth || 800;
      const viewH = subIframe.clientHeight || window.innerHeight || 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = clampScale((viewW * dpr) / box.width);
      const pageEl = await this.renderPageElement(chapterDocIndex, scale);
      if (subDoc.body.innerHTML) return;
      // 库自带的文本/注释层依赖未随包发布的 css，移除后只保留 canvas 内容层
      pageEl
        .querySelectorAll(".annotationEditorLayer,.annotionLayer,.textLayer")
        .forEach((el) => el.remove());
      subDoc.body.style.margin = "0";
      subDoc.body.style.height = "100%";
      subDoc.body.style.overflow = "hidden";
      subDoc.documentElement.style.height = "100%";
      const wrapper = subDoc.createElement("div");
      wrapper.setAttribute("data-ofd-page", "1");
      wrapper.style.cssText =
        "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;background:#ffffff;";
      subDoc.body.appendChild(wrapper);
      // 跨文档 appendChild 自动 adopt；canvas 已在主文档绘制完成，位图保留
      wrapper.appendChild(pageEl);
      // canvas 跨文档挂载后在分栏（single/double）布局下存在不绘制的问题，
      // 统一转成 <img> 展示（与 DjvuRender 一致，浏览器对图片的绘制最稳定）
      await this.swapCanvasToImage(chapterDocIndex, subDoc, pageEl);
      // 页面是栅格图片，叠加自建的透明文本层提供选中/复制/笔记能力
      await this.addTextLayer(subDoc, pageEl, chapterDocIndex, scale);
      // 页面在 iframe 内完成布局后按实际尺寸等比适配（通常宽高比与容器一致）
      const pageW = pageEl.offsetWidth || box.width * scale;
      const pageH = pageEl.offsetHeight || box.height * scale;
      const fit = Math.min(viewW / pageW, viewH / pageH);
      pageEl.setAttribute(
        "style",
        (pageEl.getAttribute("style") || "") +
          `;position:absolute;left:${Math.max(0, (viewW - pageW * fit) / 2)}px;` +
          `top:${Math.max(0, (viewH - pageH * fit) / 2)}px;` +
          `transform-origin:top left;transform:scale(${fit});`
      );
      this.trigger("rendered", [chapterDocIndex] as any);
    } catch (error) {
      console.error(error);
      if (subDoc && subDoc.body && !subDoc.body.innerHTML) {
        subDoc.body.textContent = "Failed to render OFD page";
      }
    }
  }

  // 把绘制完成的页面 canvas 转成 blob 图片展示：canvas 跨文档挂载后在分栏
  // 布局（single/double）下可能不被浏览器绘制，图片则没有这个问题；
  // canvas 转换后即可移除，顺带释放其位图内存
  private async swapCanvasToImage(
    chapterDocIndex: number,
    subDoc: any,
    pageEl: HTMLElement
  ) {
    const canvas = pageEl.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) {
      return;
    }
    let blob: Blob | null = null;
    try {
      blob = await canvasToBlob(canvas);
    } catch (error) {
      console.error(error);
    }
    if (!blob) {
      // 转换失败时保留 canvas 兜底（滚动模式下仍可正常展示）
      return;
    }
    const url = URL.createObjectURL(blob);
    const previous = this.pageImageUrls.get(chapterDocIndex);
    this.pageImageUrls.set(chapterDocIndex, url);
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    const parent = canvas.parentNode;
    if (!parent) return;
    const image = subDoc.createElement("img");
    image.setAttribute("data-ofd-page-image", "1");
    image.src = url;
    image.style.cssText =
      `position:absolute;left:0;top:0;width:${canvas.offsetWidth || canvas.width}px;` +
      `height:${canvas.offsetHeight || canvas.height}px;`;
    parent.insertBefore(image, canvas);
    canvas.remove();
  }

  // 读取 OFD 包内的文件（files 为「路径 → zip 条目」映射，条目提供 async() 读取）
  private findEntry(path: string): any {
    const files: any = this.ofdDocument && this.ofdDocument.files;
    if (!files) return null;
    const normalized = path.replace(/^\.?\//, "");
    if (files[normalized]) return files[normalized];
    const keys = Object.keys(files);
    const hit = keys.find(
      (key) =>
        key.replace(/^\.?\//, "") === normalized ||
        key.endsWith("/" + normalized)
    );
    return hit ? files[hit] : null;
  }

  private async parseEntryXml(path: string): Promise<Document | null> {
    const entry = this.findEntry(path);
    if (!entry || typeof entry.async !== "function") return null;
    try {
      const text = await entry.async("string");
      return new DOMParser().parseFromString(text, "text/xml");
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private pushTextObjectsFromXml(xml: Document, out: OfdTextObjectData[]) {
    const objects = Array.from(
      xml.getElementsByTagNameNS("*", OFD_LOCAL.textObject)
    ) as Element[];
    for (const object of objects) {
      const codes: OfdTextCodeData[] = [];
      const codeElements = Array.from(
        object.getElementsByTagNameNS("*", OFD_LOCAL.textCode)
      ) as Element[];
      for (const code of codeElements) {
        const text = code.textContent || "";
        if (!text) continue;
        codes.push({
          x: parseFloat(code.getAttribute("X") || "") || 0,
          y: parseFloat(code.getAttribute("Y") || "") || 0,
          deltaX: parseDeltaList(code.getAttribute("DeltaX") || ""),
          deltaY: parseDeltaList(code.getAttribute("DeltaY") || ""),
          text,
        });
      }
      if (codes.length === 0) continue;
      const ctmRaw = object.getAttribute("CTM") || "";
      let ctm: number[] | null = null;
      if (ctmRaw) {
        const values = ctmRaw.trim().split(/\s+/).map(Number);
        if (values.length >= 6 && values.every((value) => isFinite(value))) {
          ctm = values;
        }
      }
      out.push({
        boundary: parseStBox(object.getAttribute("Boundary") || ""),
        size: parseFloat(object.getAttribute("Size") || "") || 3.175,
        ctm,
        codes,
      });
    }
  }

  // 收集页面上的全部文本对象：页面自身内容 + 引用模板的内容
  // （发票/公文等页面的静态文字大多放在模板里）。
  // 注意：不用 liteofd 解析出的 XmlData 模型——实测其树结构不可靠（TextObject
  // 嵌套重复、页面树里没有 Template 节点），会导致文本层内容重复与缺失；
  // 这里直接读压缩包内的原始 XML，用 DOMParser 解析（规范结构，稳定可靠）
  private async collectPageTextObjects(
    pageIndex: number
  ): Promise<OfdTextObjectData[]> {
    const result: OfdTextObjectData[] = [];
    if (!this.ofdDocument || !this.ofdDocument.files) return result;
    const ofdXml = await this.parseEntryXml("OFD.xml");
    const docRoot = (
      ofdXml
        ? ofdXml.getElementsByTagNameNS("*", OFD_LOCAL.docRoot)[0]?.textContent
        : ""
    )
      ?.trim()
      .replace(/^\//, "");
    const documentPath = docRoot || "Doc_0/Document.xml";
    const rootDir = documentPath.replace(/[^/]*$/, "").replace(/\/$/, "");
    const documentXml = await this.parseEntryXml(documentPath);
    if (!documentXml) return result;
    const pageNodes = Array.from(
      documentXml.getElementsByTagNameNS("*", OFD_LOCAL.page)
    ) as Element[];
    const pageNode = pageNodes[pageIndex];
    const pageBaseLoc = pageNode ? pageNode.getAttribute("BaseLoc") || "" : "";
    if (!pageBaseLoc) return result;
    const joinPath = (base: string, relative: string) => {
      const clean = relative.replace(/^\//, "");
      return base && !clean.startsWith(base) ? `${base}/${clean}` : clean;
    };
    const pageXml = await this.parseEntryXml(joinPath(rootDir, pageBaseLoc));
    if (pageXml) this.pushTextObjectsFromXml(pageXml, result);
    // 模板层
    const templateRef = pageXml
      ? (pageXml.getElementsByTagNameNS("*", OFD_LOCAL.template)[0] as
          | Element
          | undefined)
      : undefined;
    const templateId = templateRef
      ? templateRef.getAttribute("TemplateID") || ""
      : "";
    if (templateId) {
      const templateNodes = Array.from(
        documentXml.getElementsByTagNameNS("*", OFD_LOCAL.templatePage)
      ) as Element[];
      const matched = templateNodes.find(
        (node) => node.getAttribute("ID") === templateId
      );
      const templateBaseLoc = matched
        ? matched.getAttribute("BaseLoc") || ""
        : "";
      if (templateBaseLoc) {
        const templateXml = await this.parseEntryXml(
          joinPath(rootDir, templateBaseLoc)
        );
        if (templateXml) this.pushTextObjectsFromXml(templateXml, result);
      }
    }
    return result;
  }

  // liteofd 发布版的文本层为空实现，这里按 OFD 原始 XML 的 TextObject/TextCode
  // 坐标自建一层透明文本（与 DjvuRender 的文本层同思路）：文字不可见，但可选中/
  // 复制，供划词、笔记与高亮使用；坐标换算与库内绘制一致（mm × scale）
  private async addTextLayer(
    subDoc: any,
    pageEl: HTMLElement,
    pageIndex: number,
    scale: number
  ) {
    if (!subDoc || typeof subDoc.createElementNS !== "function") return;
    const textObjects = await this.collectPageTextObjects(pageIndex);
    if (textObjects.length === 0) return;
    const SVG_NS = "http://www.w3.org/2000/svg";
    // 先收集"行段"：同一 TextCode 内 Y 变化即换行；带 CTM 的段单独成组
    interface TextRun {
      y: number;
      size: number;
      ctm: number[] | null;
      chars: { char: string; x: number; advance: number }[];
    }
    const runs: TextRun[] = [];
    // 超大页面的文本层元素过多会拖慢渲染，超出上限时只保留前一部分
    const MAX_TEXT_CHARS = 10000;
    let charCount = 0;
    for (const object of textObjects) {
      if (charCount >= MAX_TEXT_CHARS) break;
      const boundary = object.boundary;
      const sizeMm = object.size;
      for (const code of object.codes) {
        const text = code.text;
        if (!text) continue;
        const deltaX = code.deltaX;
        const deltaY = code.deltaY;
        // 部分生成器的字距列表比字符数短（如标题 11 个字只带一个 6.53），
        // 库的绘制会重复最后一个正值，这里保持一致，否则后半段字符会堆叠
        const fallbackX = lastPositive(deltaX);
        const fallbackY = lastPositive(deltaY);
        let x = boundary.x + code.x;
        let y = boundary.y + code.y;
        let run: TextRun | null = null;
        for (let index = 0; index < text.length; index++) {
          if (charCount >= MAX_TEXT_CHARS) break;
          charCount++;
          if (index > 0) {
            const gapIndex = index - 1;
            if (deltaX.length) {
              x += gapIndex < deltaX.length ? deltaX[gapIndex] || 0 : fallbackX;
            }
            if (deltaY.length) {
              y += gapIndex < deltaY.length ? deltaY[gapIndex] || 0 : fallbackY;
            }
          }
          if (!run || Math.abs(run.y - y) > 0.2) {
            run = { y, size: sizeMm, ctm: object.ctm, chars: [] };
            runs.push(run);
          }
          run.chars.push({
            char: text[index],
            x,
            advance: deltaX.length
              ? index < deltaX.length
                ? deltaX[index]
                : fallbackX
              : 0,
          });
        }
      }
    }
    if (runs.length === 0) return;

    // 同一基线（Y 接近）的行段合并为一行：一行一个 <text>、行内逐字 <tspan>，
    // 跨元素复制时不会逐字产生换行（DjvuRender 同款处理）
    const plainRuns = runs.filter((item) => !item.ctm);
    const ctmRuns = runs.filter((item) => item.ctm);
    plainRuns.sort(
      (a, b) => a.y - b.y || (a.chars[0]?.x || 0) - (b.chars[0]?.x || 0)
    );
    const lines: TextRun[][] = [];
    for (const run of plainRuns) {
      const current = lines[lines.length - 1];
      if (current && current.length > 0) {
        const tolerance = Math.max(
          0.35,
          Math.min(current[0].size, run.size) * 0.5
        );
        if (Math.abs(current[0].y - run.y) <= tolerance) {
          current.push(run);
          continue;
        }
      }
      lines.push([run]);
    }

    const createLine = (parent: any, lineRuns: TextRun[]) => {
      const sorted = lineRuns
        .slice()
        .sort((a, b) => (a.chars[0]?.x || 0) - (b.chars[0]?.x || 0));
      const textEl = subDoc.createElementNS(SVG_NS, "text");
      textEl.setAttribute("fill", "transparent");
      textEl.setAttribute("stroke", "none");
      for (const run of sorted) {
        for (const item of run.chars) {
          const tspan = subDoc.createElementNS(SVG_NS, "tspan");
          tspan.setAttribute("x", String(item.x * scale));
          tspan.setAttribute("y", String(run.y * scale));
          tspan.setAttribute(
            "font-size",
            String(Math.max(run.size * scale, 1))
          );
          // 单字宽度对齐原字距，选中高亮的范围才与页面上的文字重合
          if (item.advance > 0) {
            tspan.setAttribute("textLength", String(item.advance * scale));
            tspan.setAttribute("lengthAdjust", "spacingAndGlyphs");
          }
          tspan.setAttribute("fill", "transparent");
          tspan.setAttribute("stroke", "none");
          tspan.setAttribute("style", "user-select:text;cursor:text;");
          tspan.textContent = item.char;
          textEl.appendChild(tspan);
        }
      }
      parent.appendChild(textEl);
    };

    const layer = subDoc.createElementNS(SVG_NS, "svg");
    layer.setAttribute("data-ofd-text-layer", "1");
    layer.setAttribute(
      "style",
      "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;"
    );
    const fragment = subDoc.createDocumentFragment();
    for (const line of lines) {
      createLine(fragment, line);
    }
    for (const run of ctmRuns) {
      const group = subDoc.createElementNS(SVG_NS, "g");
      const matrix = run.ctm || [];
      group.setAttribute(
        "transform",
        `matrix(${matrix[0]} ${matrix[1]} ${matrix[2]} ${matrix[3]} ${
          matrix[4] * scale
        } ${matrix[5] * scale})`
      );
      createLine(group, [run]);
      fragment.appendChild(group);
    }
    if (!fragment.childNodes.length) return;
    layer.appendChild(fragment);
    pageEl.appendChild(layer);
  }

  async handleUnloadComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    const url = this.pageImageUrls.get(chapterDocIndex);
    if (url) {
      URL.revokeObjectURL(url);
      this.pageImageUrls.delete(chapterDocIndex);
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (subDoc && subDoc.body.innerHTML === "") {
      return;
    }
    if (subDoc) {
      subDoc.body.innerHTML = "";
    }
  }

  // scroll 模式下只预取下一页，避免同时保留过多高分辨率 canvas
  async renderComicPage(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
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

  // 页面由解析结果实时渲染，无静态 HTML 可缓存，返回空表示不支持预缓存
  async preCache() {
    return "";
  }

  // 关闭书籍时释放解析结果；再次 renderTo 会重新 parse
  removeContent() {
    super.removeContent();
    this.pageImageUrls.forEach((url) => URL.revokeObjectURL(url));
    this.pageImageUrls.clear();
    this.liteOfd = null;
    this.ofdDocument = null;
    this.coverBlob = null;
    this.renderingPages.clear();
    this.book = "";
  }

  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.ofdDocument) {
          await this.parse();
        }
        const cover = await this.getCoverBlob();
        const name = this.filePath || "document.ofd";
        if (!cover) {
          resolve({ name: name, cover: "" });
          return;
        }
        var reader = new FileReader();
        reader.readAsDataURL(cover);
        reader.onloadend = () => {
          resolve({ name: name, cover: reader.result });
        };
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }

  // 文本索引来自解析模型（TextCode 拼接），未渲染的页也能检索；每页取首个命中
  async doSearch(keyword: string): Promise<any[]> {
    if (!this.ofdDocument || !keyword) return [];
    try {
      const pages = this.ofdDocument.pages || [];
      const results: any[] = [];
      const count = this.chapterDocList.length || pages.length || 1;
      const lowerKeyword = keyword.toLowerCase();
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        let text = "";
        try {
          // getContentText 内部逐节点 console.log，移动端需要一并抑制
          text =
            (await silenceConsole(
              () => this.ofdDocument.getContentText(pageIndex + 1) || ""
            )) || "";
        } catch (error) {
          console.error(error);
          continue;
        }
        const position = text.toLowerCase().indexOf(lowerKeyword);
        if (position === -1) continue;
        const excerpt = text
          .substr(Math.max(0, position - 20), keyword.length + 40)
          .trim();
        results.push({
          excerpt: excerpt,
          cfi: JSON.stringify({
            text: excerpt,
            chapterTitle:
              this.chapterDocList[pageIndex]?.label ||
              "Page " + (pageIndex + 1),
            chapterDocIndex: pageIndex,
            chapterHref: this.chapterDocList[pageIndex]?.href || "",
            count: "search",
            percentage: pageIndex / count,
            keyword: keyword,
          }),
        });
      }
      return results;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // 朗读/文本提取：取当前页解析出的 TextCode 文本
  async getCurrentPageText(): Promise<string[]> {
    const chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    if (isNaN(chapterDocIndex) || chapterDocIndex < 0) return [];
    const pages = this.ofdDocument?.pages;
    if (!pages || chapterDocIndex >= pages.length) return [];
    try {
      const text = await silenceConsole(() =>
        this.ofdDocument.getContentText(chapterDocIndex + 1)
      );
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

  async getImageList(_chapterDocIndex?: number): Promise<string[]> {
    return [];
  }
}

const parsePageHref = (href: string): number => {
  const match = href.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export default OfdRender;
