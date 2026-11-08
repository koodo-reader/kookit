import ComicRender from "./ComicRender";
import { createPDFIframe } from "../utils/pdfUtil.js";
import {
  renderXpsPage,
  XpsFile,
  XpsPageRenderResult,
  XpsRenderImage,
} from "../libs/xps";

// XPS 是固定版式文档，每个 FixedPage 解析后渲染为 SVG 挂进独立 iframe，
// 分页/懒加载/卸载沿用漫画（ComicRender）的多 iframe 结构
class XpsRender extends ComicRender {
  xps: XpsFile | null = null;
  private renderingPages: Map<number, Promise<void>> = new Map();
  private loadedFonts: Set<string> = new Set();
  private imageResources: Map<string, XpsRenderImage> = new Map();
  private imagePromises: Map<string, Promise<XpsRenderImage | null>> = new Map();
  private imageRefCounts: Map<string, number> = new Map();
  private pageResourceUris: Map<
    number,
    { images: string[]; fonts: string[] }
  > = new Map();

  async parse() {
    try {
      if (this.xps) return;
      this.xps = await XpsFile.open(this.comicBuffer);
      const pageCount = this.xps.pageCount;
      this.book = {
        metadata: { title: this.filePath || "document.xps" },
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

  async getCoverBlob(): Promise<Blob | null> {
    if (!this.xps) {
      await this.parse();
    }
    return await this.xps!.getThumbnail();
  }

  async getTemplateAspectRatio() {
    if (!this.xps) {
      return 0.75;
    }
    try {
      const { width, height } = await this.xps.getPageSize(0);
      return height > 0 ? width / height : 0.75;
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
    const xps = this.xps;
    if (!xps) return;
    try {
      const page = await xps.getPage(chapterDocIndex);
      const result = await renderXpsPage(page, {
        getImage: (uri: string) => this.getImageResource(uri),
        getFontFamily: (uri: string) => fontFamilyFor(uri),
      });
      if (subDoc.body.innerHTML) return;
      this.registerPageResources(chapterDocIndex, result);
      subDoc.body.style.margin = "0";
      subDoc.body.style.height = "100%";
      subDoc.body.style.overflow = "hidden";
      subDoc.documentElement.style.height = "100%";
      subDoc.body.innerHTML = result.svg;
      // 字体异步加载，加载完成后浏览器自动重排 SVG 文本
      await this.loadFonts(subIframe, subDoc, result.fonts);
      this.trigger("rendered", [chapterDocIndex] as any);
    } catch (error) {
      console.error(error);
      if (subDoc && subDoc.body && !subDoc.body.innerHTML) {
        subDoc.body.textContent = "Failed to render XPS page";
      }
    }
  }

  private registerPageResources(
    chapterDocIndex: number,
    result: XpsPageRenderResult
  ) {
    this.pageResourceUris.set(chapterDocIndex, {
      images: result.images,
      fonts: result.fonts,
    });
    for (const uri of result.images) {
      this.imageRefCounts.set(uri, (this.imageRefCounts.get(uri) || 0) + 1);
    }
  }

  async handleUnloadComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (subDoc && subDoc.body.innerHTML === "") {
      return;
    }
    const resources = this.pageResourceUris.get(chapterDocIndex);
    if (resources) {
      // 图片可能被多页共享，引用计数归零才释放 blob URL
      for (const uri of resources.images) {
        const count = (this.imageRefCounts.get(uri) || 1) - 1;
        if (count <= 0) {
          this.imageRefCounts.delete(uri);
          const resource = this.imageResources.get(uri);
          if (resource) {
            URL.revokeObjectURL(resource.url);
            this.imageResources.delete(uri);
          }
        } else {
          this.imageRefCounts.set(uri, count);
        }
      }
      this.pageResourceUris.delete(chapterDocIndex);
    }
    if (subDoc) {
      subDoc.body.innerHTML = "";
    }
  }

  private async getImageResource(uri: string): Promise<XpsRenderImage | null> {
    const cached = this.imageResources.get(uri);
    if (cached) return cached;
    const pending = this.imagePromises.get(uri);
    if (pending) return pending;
    const promise = (async () => {
      try {
        if (!this.xps) return null;
        const image = await this.xps.getImage(uri);
        if (!image) return null;
        const blob = new Blob([image.data], { type: image.mime });
        const url = URL.createObjectURL(blob);
        const meta = await this.getImageMeta(blob);
        const resource = {
          url,
          width: meta.width || 0,
          height: meta.height || 0,
        };
        this.imageResources.set(uri, resource);
        return resource;
      } catch (error) {
        console.error(error);
        return null;
      } finally {
        this.imagePromises.delete(uri);
      }
    })();
    this.imagePromises.set(uri, promise);
    return promise;
  }

  private async loadFonts(
    subIframe: any,
    subDoc: any,
    fontUris: string[]
  ) {
    if (!this.xps) return;
    const win: any = subIframe.contentWindow || subDoc.defaultView;
    for (const uri of fontUris) {
      if (this.loadedFonts.has(uri)) continue;
      this.loadedFonts.add(uri);
      let data: ArrayBuffer | null = null;
      try {
        data = await this.xps.getFont(uri);
      } catch (error) {
        console.error(error);
      }
      if (!data) continue;
      const family = fontFamilyFor(uri);
      try {
        if (win && typeof win.FontFace === "function" && subDoc.fonts) {
          const fontFace = new win.FontFace(family, data);
          await fontFace.load();
          subDoc.fonts.add(fontFace);
          continue;
        }
      } catch (error) {
        console.error(error);
      }
      // FontFace 不可用或加载失败时退回 @font-face 样式注入
      try {
        const blobUrl = URL.createObjectURL(
          new Blob([data], { type: "font/ttf" })
        );
        const style = subDoc.createElement("style");
        style.textContent =
          "@font-face{font-family:'" +
          family +
          "';src:url('" +
          blobUrl +
          "') format('truetype');}";
        subDoc.head.appendChild(style);
      } catch (error) {
        console.error(error);
      }
    }
  }

  // XPS 页面由解析结果实时渲染，无静态 HTML 可缓存，返回空表示不支持预缓存
  async preCache() {
    return "";
  }

  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.xps) {
          await this.parse();
        }
        const metadata = this.xps!.metadata;
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
    if (!this.xps || !keyword) return [];
    try {
      const results = await this.xps.search(keyword);
      const count = this.chapterDocList.length || this.xps.pageCount || 1;
      return results.map((result) => {
        const pageIndex = result.pageIndex;
        return {
          excerpt: result.excerpt,
          cfi: JSON.stringify({
            text: result.excerpt,
            chapterTitle:
              this.chapterDocList[pageIndex]?.label ||
              "Page " + (pageIndex + 1),
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

  // 朗读/文本提取：取当前页解析出的 Glyphs 文本
  async getCurrentPageText(): Promise<string[]> {
    const chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    if (isNaN(chapterDocIndex) || chapterDocIndex < 0) return [];
    if (!this.xps || chapterDocIndex >= this.xps.pageCount) return [];
    try {
      const text = await this.xps.getPageText(chapterDocIndex);
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

const fontFamilyFor = (uri: string): string => {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    hash = (hash * 31 + uri.charCodeAt(i)) >>> 0;
  }
  return "xps-font-" + hash.toString(36);
};

export default XpsRender;
