import ComicRender from "./ComicRender";
import JSZip from "jszip";
import { createPDFIframe } from "../utils/pdfUtil.js";
import {
  buildPresentation,
  parseZip,
  renderSlide,
  RECOMMENDED_ZIP_LIMITS,
  searchPresentation,
} from "../libs/pptx-renderer/index";
import type {
  PresentationData,
  SlideHandle,
  TextSearchResult,
} from "../libs/pptx-renderer/index";

// PPTX 逐页经 @aiden0z/pptx-renderer（vendor 于 src/libs/pptx-renderer）
// 渲染为 HTML DOM 后直接挂进每页 iframe，中文文本走系统字体 fallback。
// 分页/懒加载/卸载机制沿用漫画的多 iframe 结构。
class PptxRender extends ComicRender {
  presentation: PresentationData | null = null;
  // 已渲染页的资源句柄，卸载时 dispose 回收 blob URL
  slideHandles: Map<number, SlideHandle>;

  constructor(pptxBuffer: ArrayBuffer, config: any) {
    super(pptxBuffer, config);
    this.slideHandles = new Map();
  }
  async parse() {
    try {
      if (this.presentation) return;
      const files = await parseZip(this.comicBuffer, RECOMMENDED_ZIP_LIMITS);
      this.presentation = buildPresentation(files, { lazySlides: true });
      const slideCount = this.presentation.slides.length;
      this.book = {
        metadata: { title: this.filePath || "presentation.pptx" },
        rendition: { layout: "pre-paginated" },
        // 页面渲染由 handleRenderComicChapter 覆写后直接驱动，section 的
        // load/unload 仅保留给 GeneralParser 组装 chapterDocList 使用
        sections: Array.from({ length: slideCount }, (_, index) => ({
          id: "slide-" + index,
          label: "Slide " + (index + 1),
          href: "slide-" + index,
          load: async () => "",
          unload: async () => {},
        })),
        toc: Array.from({ length: slideCount }, (_, index) => ({
          label: "Slide " + (index + 1),
          href: "slide-" + index,
        })),
        getCover: async () => {
          const cover = await this.getCoverBlob();
          return cover ? cover : new Blob([new ArrayBuffer(0)]);
        },
        resolveHref: (href: string) => {
          const match = href.match(/\d+/);
          return { index: match ? parseInt(match[0], 10) : 0 };
        },
        resolveHrefIndex: (href: string) => {
          const match = href.match(/\d+/);
          return { index: match ? parseInt(match[0], 10) : 0 };
        },
        splitTOCHref: (href: string) => [href, null],
        getTOCFragment: (doc: Document) => doc.documentElement,
      } as any;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  // PPTX 保存时若嵌入缩略图（docProps/thumbnail.*），直接作为封面
  async getCoverBlob(): Promise<Blob | null> {
    try {
      const zip = await JSZip.loadAsync(this.comicBuffer);
      for (const name of ["docProps/thumbnail.jpeg", "docProps/thumbnail.png"]) {
        const entry = zip.file(name);
        if (entry) {
          return await entry.async("blob");
        }
      }
    } catch (error) {
      console.error(error);
    }
    return null;
  }
  /**
   * 覆写漫画的页面渲染：把 renderSlide 输出的固定尺寸 DOM 挂进
   * pdf-iframe-N，再按 iframe 宽度 transform 缩放适配。
   */
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
    let subDoc = subIframe?.contentDocument;
    if (!subDoc) return;
    if (subDoc.body.innerHTML) {
      return;
    }
    const presentation = this.presentation!;
    const slide = presentation.slides[chapterDocIndex];
    subDoc.body.style.margin = "0";
    subDoc.body.style.height = "100%";
    subDoc.body.style.overflow = "hidden";
    subDoc.documentElement.style.height = "100%";
    // 幻灯片内部按 presentation.width/height 像素绝对布局，
    // 需按 iframe 实际宽度整体缩放，不能直接拉伸容器
    const host = subDoc.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.overflow = "hidden";
    subDoc.body.appendChild(host);
    let handle: SlideHandle | null = null;
    try {
      handle = renderSlide(presentation, slide, {
        onNodeError: (nodeId: string, error: unknown) => {
          console.warn("pptx node render failed: " + nodeId, error);
        },
      });
      const scale =
        (subDoc.body.clientWidth || subIframe.clientWidth) /
        presentation.width;
      handle.element.style.transformOrigin = "top left";
      if (scale > 0 && scale !== 1) {
        handle.element.style.transform = "scale(" + scale + ")";
      }
      host.appendChild(handle.element);
    } catch (error) {
      console.error(error);
      host.textContent = "Failed to render slide";
    }
    await (handle ? handle.ready : Promise.resolve());
    this.slideHandles.set(chapterDocIndex, handle as SlideHandle);
    this.trigger("rendered", [chapterDocIndex] as any);
  }
  async handleUnloadComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (subDoc && subDoc.body.innerHTML === "") {
      return;
    }
    const handle = this.slideHandles.get(chapterDocIndex);
    if (handle) {
      // standalone 模式下 dispose 会 revoke 本页 blob URL
      handle.dispose();
      this.slideHandles.delete(chapterDocIndex);
    }
    if (subDoc) {
      subDoc.body.innerHTML = "";
    }
  }
  /**
   * PPTX 所有页面共用 presentation.xml 中的统一页面尺寸，
   * width/height 已换算为像素，直接相除得宽高比。
   */
  async getTemplateAspectRatio() {
    const presentation = this.presentation;
    if (presentation && presentation.height > 0) {
      return presentation.width / presentation.height;
    }
    return 16 / 9;
  }
  // 页面 DOM 由渲染器实时生成，无静态 HTML 可缓存，返回空表示不支持预缓存
  async preCache() {
    return "";
  }
  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.presentation) {
          await this.parse();
        }
        const cover = await this.getCoverBlob();
        if (!cover) {
          resolve({ cover: "" });
          return;
        }
        var reader = new FileReader();
        reader.readAsDataURL(cover);
        reader.onloadend = () => {
          resolve({ cover: reader.result });
        };
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }
  async doSearch(keyword: string): Promise<any[]> {
    const presentation = this.presentation;
    if (!presentation || !keyword) return [];
    try {
      const results: TextSearchResult[] = searchPresentation(
        presentation,
        keyword
      );
      const count = presentation.slides.length || 1;
      return results.map((result) => {
        const slideIndex = result.slideIndex;
        return {
          excerpt: result.snippet,
          cfi: JSON.stringify({
            text: result.text,
            chapterTitle:
              this.chapterDocList[slideIndex]?.label ||
              "Slide " + (slideIndex + 1),
            chapterDocIndex: slideIndex,
            chapterHref: this.chapterDocList[slideIndex]?.href || "",
            count: "search",
            percentage: slideIndex / count,
            keyword: keyword,
          }),
        };
      });
    } catch (error) {
      console.error(error);
      return [];
    }
  }
  // 朗读/文本提取：取当前页已渲染 iframe 的文本内容
  async getCurrentSlideText(): Promise<string[]> {
    const chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    if (isNaN(chapterDocIndex) || chapterDocIndex < 0) return [];
    if (chapterDocIndex >= this.chapterDocList.length) return [];
    await this.handleRenderComicChapter(chapterDocIndex);
    const subDoc = this.getSubDocument(chapterDocIndex);
    const text = subDoc?.body?.textContent?.trim();
    return text ? [text] : [];
  }
  async visibleText(): Promise<any[]> {
    return await this.getCurrentSlideText();
  }
  async audioText(): Promise<any[]> {
    return await this.getCurrentSlideText();
  }
  async getRestAudioText(_count: number) {
    return [];
  }
  async chapterText() {
    const texts = await this.getCurrentSlideText();
    return texts.length > 0 ? texts[0] : "";
  }
}
export default PptxRender;
