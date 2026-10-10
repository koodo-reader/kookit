import { PptxRenderer } from "pptx-browser";
import { makeComicBook } from "../libs/comic-book";
import ComicRender from "./ComicRender";

// 幻灯片渲染像素宽度，与 pptx-browser 默认值一致，iframe 内按 CSS 拉伸
const RENDER_WIDTH = 1280;

class PptxRender extends ComicRender {
  pptxRenderer: any = null;
  // pptx-browser 内部状态不支持并发渲染，所有 renderSlide 串行入队
  renderQueue: Promise<any>;
  constructor(pptxBuffer: ArrayBuffer, config: any) {
    super(pptxBuffer, config);
    this.renderQueue = Promise.resolve();
  }
  /**
   * 每张幻灯片经 pptx-browser 渲染为 canvas 后转成 JPEG 图，
   * 构造成假 loader 交给 makeComicBook，从而复用漫画
   * "每页一张图"的懒加载/卸载/封面/目录机制。
   * 实际渲染在 loadBlob 时按页触发，与大文件演示文稿的内存占用兼容。
   */
  async parse() {
    try {
      if (!this.pptxRenderer) {
        this.pptxRenderer = new PptxRenderer();
        await this.pptxRenderer.load(
          this.comicBuffer,
          (progress: number, message: string) => {
            console.info("pptx load " + message + " " + progress);
          }
        );
      }
      const loader = {
        // 条目名 "Slide N.jpg" 使 makeComicBook 的图片扩展名过滤
        // 与数字排序直接按幻灯片顺序命中
        entries: Array.from(
          { length: this.pptxRenderer.slideCount },
          (_: any, index: number) => ({
            filename: "Slide " + (index + 1) + ".jpg",
          })
        ),
        loadBlob: (name: string) => {
          const match = name.match(/\d+/);
          const index = match ? parseInt(match[0], 10) - 1 : 0;
          // 逐个入队串行渲染；每次独立 canvas，避免并发共享冲突
          this.renderQueue = this.renderQueue.then(async () => {
            const canvas = document.createElement("canvas");
            await this.pptxRenderer.renderSlide(index, canvas, RENDER_WIDTH);
            return await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (blob: Blob | null) => {
                  if (blob) {
                    resolve(blob);
                  } else {
                    reject(new Error("pptx slide " + index + " encode failed"));
                  }
                },
                "image/jpeg",
                0.9
              );
            });
          });
          return this.renderQueue;
        },
        getSize: () => 1,
      };
      this.book = makeComicBook(loader as any, {
        name: this.filePath || "presentation.pptx",
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /**
   * PPTX 所有页面共用 presentation.xml 中的统一页面尺寸（EMU 单位），
   * 直接相除得宽高比，无需像漫画那样解码采样。
   */
  async getTemplateAspectRatio() {
    const { cx, cy } = this.pptxRenderer?.slideSize || ({} as any);
    if (cx && cy) {
      return cx / cy;
    }
    return 16 / 9;
  }
}
export default PptxRender;
