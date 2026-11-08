import ComicRender from "./ComicRender";
import JSZip from "jszip";
import { createPDFIframe } from "../utils/pdfUtil.js";
import { parse, renderSlideToSvg, slideText, slideToPng } from "@web-ppt/core";
import type { Presentation } from "@web-ppt/core";

// PPTX/PPT 逐页经 @web-ppt/core 渲染为 SVG DOM 后直接挂进每页 iframe，
// 中文文本走系统字体 fallback；.ppt（CFB）由同一解析器按魔数识别。
// 分页/懒加载/卸载机制沿用漫画的多 iframe 结构。
class PptxRender extends ComicRender {
  presentation: Presentation | null = null;
  password: string = "";

  constructor(pptxBuffer: ArrayBuffer, config: any) {
    super(pptxBuffer, config);
    this.password = config.password || "";
  }

  async parse() {
    try {
      if (this.presentation) return;
      // 加密文件会抛 PasswordRequiredError / WrongPasswordError
      this.presentation = await parse(new Uint8Array(this.comicBuffer), {
        password: this.password || undefined,
      });
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
  // OOXML 保存时若嵌入缩略图（docProps/thumbnail.*），直接作为封面。
  // .ppt 是 CFB 容器，没有该条目，跳过 zip 解析
  async getCoverBlob(): Promise<Blob | null> {
    const bytes = new Uint8Array(this.comicBuffer);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      try {
        const zip = await JSZip.loadAsync(this.comicBuffer);
        for (const name of [
          "docProps/thumbnail.jpeg",
          "docProps/thumbnail.png",
        ]) {
          const entry = zip.file(name);
          if (entry) {
            return await entry.async("blob");
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
    return await this.renderSlideCover();
  }
  // 没有嵌入缩略图（.ppt 全部如此，pptx 也常常不存）时把第 1 页栅格化为封面。
  // scale 0.5 取约 640px 宽的位图，作为封面足够且不让 base64 数据过大
  async renderSlideCover(): Promise<Blob | null> {
    try {
      if (!this.presentation) {
        await this.parse();
      }
      const presentation = this.presentation;
      const slide = presentation?.slides[0];
      if (!presentation || !slide) {
        return null;
      }
      return await slideToPng(presentation, slide, 0.5);
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  /**
   * 覆写漫画的页面渲染：把 renderSlideToSvg 输出的整页 SVG 挂进
   * pdf-iframe-N，SVG 自带 viewBox，按容器等比缩放适配。
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
    const presentation = this.presentation;
    const slide = presentation?.slides[chapterDocIndex];
    if (!presentation || !slide) return;
    subDoc.body.style.margin = "0";
    subDoc.body.style.height = "100%";
    subDoc.body.style.overflow = "hidden";
    subDoc.documentElement.style.height = "100%";
    try {
      subDoc.body.innerHTML = renderSlideToSvg(presentation, slide);
      const svg = subDoc.body.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.display = "block";
      }
    } catch (error) {
      console.error(error);
      subDoc.body.textContent = "Failed to render slide";
    }
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
    if (subDoc) {
      subDoc.body.innerHTML = "";
    }
  }
  /**
   * 演示文稿所有页面共用 presentation.xml 中的统一页面尺寸，
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
  // 关闭书籍时释放解析产生的全部 blob URL；再次 renderTo 会重新 parse
  removeContent() {
    super.removeContent();
    this.presentation?.dispose?.();
    this.presentation = null;
    this.book = "";
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
  // 文本索引来自解析模型，未渲染的页也能检索；结果按行去重
  async doSearch(keyword: string): Promise<any[]> {
    const presentation = this.presentation;
    if (!presentation || !keyword) return [];
    try {
      const results: any[] = [];
      const count = this.chapterDocList.length || presentation.slides.length || 1;
      const lowerKeyword = keyword.toLowerCase();
      presentation.slides.forEach((slide, slideIndex) => {
        const lines = slideText(slide).split("\n");
        for (const line of lines) {
          const text = line.trim();
          if (!text || text.toLowerCase().indexOf(lowerKeyword) === -1) {
            continue;
          }
          results.push({
            excerpt: text,
            cfi: JSON.stringify({
              text: text,
              chapterTitle:
                this.chapterDocList[slideIndex]?.label ||
                "Slide " + (slideIndex + 1),
              chapterDocIndex: slideIndex,
              chapterHref: this.chapterDocList[slideIndex]?.href || "",
              count: "search",
              percentage: slideIndex / count,
              keyword: keyword,
            }),
          });
        }
      });
      return results;
    } catch (error) {
      console.error(error);
      return [];
    }
  }
  // 朗读/文本提取：取当前页已渲染 iframe 的可见文本
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
