import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import { isPDF, makePDF } from "../libs/pdf";
import {
  convertPageToImage,
  getTextFromPDFPage,
  showOCRProgress,
} from "../utils/pdfUtil";
import { detectLocalLanguage } from "../utils/common";
declare var window: any;
class PdfTextRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  password: string = "";
  isScannedPDF: string;
  worker: any;
  cache: any;
  processingPromises: Map<number, Promise<void>>; // 跟踪正在处理的章节
  ocrLang: string = "standard_v5_mobile"; // 默认OCR语言为简体中文
  paraSpacingValue: number = 1.5; // 段落间距
  titleSizeValue: number = 1.2; // 标题大小倍数
  isFinishOCR: boolean = false;
  // 支持的引擎：tesseract / paddle / system-ocr / external-engine / official-ai-ocr / plugin-ocr
  // 所有引擎均通过 config.externalWorker 注入识别能力，kookit 不再内置任何 OCR 库与模型
  ocrEngine: string;
  shouldShowProgress: boolean = false; // 控制是否显示进度
  externalWorker: any;
  pdfPageCount: number = 0;
  pdfDoc: any;
  bookKey: string = ""; // 用于标识当前PDF的唯一键值，便于缓存管理
  getOcrCache: (bookKey: string, chapterDocIndex: number) => { text: string };
  saveOcrCache: (
    bookKey: string,
    chapterDocIndex: number,
    cacheData: { text: string }
  ) => void;
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "PDFTEXT" });
    this.pdfBuffer = pdfBuffer;
    this.password = config.password || "";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.ocrLang = config.ocrLang || "standard_v5_mobile"; // 支持配置OCR语言
    this.paraSpacingValue = parseFloat(config.paraSpacingValue) || 1.5; // 支持配置段落间距
    this.titleSizeValue = parseFloat(config.titleSizeValue) || 1.2; // 支持配置标题大小倍数
    this.cache = {};
    this.processingPromises = new Map();
    this.ocrEngine = config.ocrEngine || "paddle"; // 支持配置OCR引擎
    // 识别能力由宿主注入：externalWorker.recognize(input) => Promise<string>
    // 通用 OCR 传入 image URL，official-ai-ocr accurate 模式传入 PDF File
    this.externalWorker = config.externalWorker || null;
    this.pdfPageCount = config.pdfPageCount || 0;
    this.getOcrCache =
      config.getOcrCache ||
      ((_bookKey: string, _chapterDocIndex: number) => null);
    this.saveOcrCache =
      config.saveOcrCache ||
      (() => {
        /* 默认不做任何操作 */
      });
    this.bookKey = config.bookKey || ""; // 用于标识当前PDF的唯一键值，便于缓存管理
  }

  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (this.isScannedPDF === "yes" && this.ocrEngine === "external-engine") {
        this.chapterDocList = Array.from(
          { length: this.pdfPageCount },
          (_, i) => ({
            label: i + "",
            text: {
              load: async () => "",
              render: async () => {},
              unload: async () => {},
              getPage: async () => null,
              getDimension: async () => ({ width: 0, height: 0 }),
              getScale: async () => 1,
              getPageCount: async () => 0,
            },
            href: "title" + i,
          })
        );
        this.chapterList = Array.from(
          { length: this.pdfPageCount },
          (_, i) => ({
            label: i + "",
            href: "title" + i,
            index: i,
            subitems: [],
          })
        );
        this.worker = this.externalWorker;
      } else {
        if (!this.book) {
          await this.parse();
        }
        let parser = new GeneralParser(this.book);
        this.chapterList = await parser.getChapter(this.book.toc);
        this.chapterDocList = await parser.getChapterDoc();
      }

      for (let index = 0; index < this.chapterDocList.length; index++) {
        let chapterDoc = this.chapterDocList[index];
        chapterDoc.text.load = async () => {
          if (this.cache[index]) {
            // 即使缓存存在，也要检查后续章节
            this.preProcessNextChapters(index);
            return this.cache[index];
          }

          let src = "";
          // 优先处理当前章节
          src = await this.processCurrentChapter(index);
          // 异步处理后续章节
          this.preProcessNextChapters(index);
          return src;
        };
      }
      createIframe(element, this.isAllowScript);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      if (this.ocrEngine === "official-ai-ocr" && this.ocrLang === "accurate") {
        const srcDoc = await window.PDFLib.PDFDocument.load(this.pdfBuffer);
        this.pdfDoc = srcDoc;
      }
      resolve();
    });
  }

  // 优先处理当前章节
  async processCurrentChapter(index: number): Promise<string> {
    if (this.cache[index]) {
      return this.cache[index];
    }

    // 如果当前章节正在处理，等待完成并返回缓存结果
    if (this.processingPromises.has(index)) {
      await this.processingPromises.get(index);
      return this.cache[index];
    }

    // 主动触发当前章节的 OCR，结果统一由 getTextByOCR 写入 this.cache
    this.isFinishOCR = false; // 重置完成标志
    this.shouldShowProgress = true; // 当前章节显示进度
    try {
      const promise = this.processChapterOCR(index).finally(() => {
        this.processingPromises.delete(index);
      });
      this.processingPromises.set(index, promise);
      await promise;
      return this.cache[index];
    } finally {
      this.shouldShowProgress = false;
    }
  }

  // 同步预处理后续章节
  async preProcessNextChapters(currentIndex: number) {
    const maxIndex = Math.min(currentIndex + 5, this.chapterDocList.length - 1);

    for (let i = currentIndex + 1; i <= maxIndex; i++) {
      // 只处理未缓存且未在处理中的章节
      if (!this.cache[i] && !this.processingPromises.has(i)) {
        const promise = this.processChapterOCR(i).finally(() => {
          this.processingPromises.delete(i);
        });
        this.processingPromises.set(i, promise);
        // externalWorker 底层实现通常一次只能识别一页（如 paddle 的单个 ort wasm
        // session 不支持并发 run），宿主自行负责并发适配前不可放开；云端
        // official-ai-ocr 与移动端 external-engine 桥接支持并行，保持异步分发
        if (
          this.ocrEngine !== "official-ai-ocr" &&
          this.ocrEngine !== "external-engine"
        ) {
          await promise;
        }
      }
    }
  }

  // 处理单个章节的OCR（结果写入 this.cache 的唯一入口在 getTextByOCR）
  async processChapterOCR(index: number): Promise<void> {
    try {
      const chapterDoc = this.chapterDocList[index];
      await this.getTextByOCR(chapterDoc, index);
    } catch (error) {
      console.error(`Failed to process OCR for chapter ${index}:`, error);
    }
  }
  /**
   * 统一处理 externalWorker 的返回结果：
   * 兼容纯文本字符串、tesseract 格式（result.data.text）与 paddle 格式（result.parragraphs），
   * 并对 CJK 文本做多余空格清理（OCR 常见问题）。
   */
  normalizeOcrText = (result: any): string => {
    let textContent = "";
    if (typeof result === "string") {
      textContent = result;
    } else if (result && result.data && typeof result.data.text === "string") {
      textContent = result.data.text || "";
    } else if (result && result.parragraphs) {
      textContent = result.parragraphs
        .map((p: any) => p.text)
        .filter(Boolean)
        .join("\n");
    }
    let locale = detectLocalLanguage(textContent);
    if (locale !== "en") {
      // 去除中文文字间多余的空格（OCR 常见问题）
      textContent = textContent
        .split("\n")
        .map((line) => {
          const tokens = line.split(" ").filter((t) => t !== "");
          let out = "";
          for (let i = 0; i < tokens.length; i++) {
            if (i === 0) {
              out = tokens[i];
              continue;
            }
            const prev = tokens[i - 1];
            const curr = tokens[i];
            const prevEndsCJK =
              /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]$/.test(
                prev
              );
            const currStartsCJK =
              /^[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(
                curr
              );
            out += prevEndsCJK || currStartsCJK ? curr : " " + curr;
          }
          return out;
        })
        .join("\n");
    }
    return textContent;
  };
  extractPages = async (pages) => {
    // 1. 加载原始 PDF
    const srcDoc = this.pdfDoc;

    // 2. 创建新的 PDF 文档
    const newDoc = await window.PDFLib.PDFDocument.create();

    // 统一转为数组（支持单个页码或数组）
    const pageNumbers = Array.isArray(pages) ? pages : [pages];

    // pdf-lib 使用 0-based index，所以要 -1
    const pageIndices = pageNumbers
      .map((p) => p - 1) // 转为 0-based
      .filter((i) => i >= 0 && i < srcDoc.getPageCount()); // 过滤无效页码

    if (pageIndices.length === 0) {
      throw new Error("没有找到有效的页码");
    }

    // 3. 复制指定页面
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);

    // 4. 将复制的页面添加到新文档
    copiedPages.forEach((page) => {
      newDoc.addPage(page);
    });

    // 5. 保存为 Uint8Array
    const newPdfBytes = await newDoc.save();
    const blob = new Blob([newPdfBytes], { type: "application/pdf" });
    return blob;
  };
  async getTextByOCR(chapterDoc, chapterDocIndex: number) {
    // 所有 OCR 结果统一在此写入 this.cache，保证被 OCR 过的页面总有缓存
    if (this.cache[chapterDocIndex]) {
      return this.cache[chapterDocIndex];
    }
    let ocrCacheData = this.getOcrCache(this.bookKey, chapterDocIndex);
    if (ocrCacheData) {
      let url = URL.createObjectURL(
        new Blob([ocrCacheData.text], { type: "text/html" })
      );
      this.cache[chapterDocIndex] = url;
      return url;
    }
    const textContent = await this.doTextByOCR(chapterDoc, chapterDocIndex);
    const url = URL.createObjectURL(
      new Blob([textContent], { type: "text/html" })
    );

    this.cache[chapterDocIndex] = url;
    if (this.ocrEngine === "system-ocr" && this.isScannedPDF !== "yes") {
      return url;
    } else {
      this.saveOcrCache(this.bookKey, chapterDocIndex, { text: textContent });
      return url;
    }
  }

  private async doTextByOCR(chapterDoc, chapterDocIndex: number) {
    let textContent = "";
    if (this.ocrEngine === "system-ocr" && this.isScannedPDF !== "yes") {
      return await this.getTextFromDoc(chapterDoc);
    }
    // 模拟进度条变化
    let progressInterval: any = null;
    if (this.shouldShowProgress) {
      let progress = 0;
      const duration = 5000; // 5秒
      const intervalTime = 100; // 每100ms更新一次
      const increment = 0.9 / (duration / intervalTime); // 最多到0.9

      progressInterval = setInterval(() => {
        progress += increment;
        if (progress >= 0.9) {
          progress = 0.9;
          clearInterval(progressInterval);
        }
        showOCRProgress(progress);
      }, intervalTime);
    }

    try {
      let result: any;
      if (this.ocrEngine === "external-engine") {
        textContent = await this.worker.recognize(chapterDocIndex, "");
      } else {
        // 其余引擎（tesseract / paddle / system-ocr / plugin-ocr / official-ai-ocr）
        // 统一由 externalWorker 识别
        if (
          this.ocrEngine === "official-ai-ocr" &&
          this.ocrLang === "accurate"
        ) {
          let fileBlob = await this.extractPages(chapterDocIndex + 1); // 页码从1开始
          let file = new File([fileBlob], chapterDocIndex + ".pdf", {
            type: "application/pdf",
          });
          result = await this.worker.recognize(file);
        } else {
          let page = await chapterDoc.text.getPage();
          let { imageURL } = await convertPageToImage(page);
          result = await this.worker.recognize(imageURL);
        }
        textContent = this.normalizeOcrText(result);
      }
      // 完成后立即将进度设为1
      if (this.shouldShowProgress) {
        if (progressInterval) clearInterval(progressInterval);
        showOCRProgress(1);
        this.isFinishOCR = true;
      }
      if (
        this.ocrEngine === "official-ai-ocr" &&
        this.ocrLang === "accurate"
      ) {
        return textContent;
      }
    } finally {
      if (this.shouldShowProgress && progressInterval) {
        clearInterval(progressInterval);
      }
    }

    let paraList = textContent.split("\n").filter((para) => para.trim() !== "");
    return `
            <!DOCTYPE html>
            <html lang="en">
            <meta charset="utf-8">
            <style>
            html, body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            p {
                margin: 0.8em 0;
                text-align: justify;
            }
            .bold {
                font-weight: bold;
            }
            .paragraph {
                margin-bottom: 1em;
            }
            </style>
            <div>${paraList.map((para) => `<p>${para}</p>`).join("")}</div>
          `;
  }
  async getTextFromDoc(chapterDoc) {
    let paraList: any[] = await getTextFromPDFPage(
      chapterDoc,
      this.titleSizeValue,
      this.paraSpacingValue
    );

    return `
        <!DOCTYPE html>
        <html lang="en">
        <meta charset="utf-8">
        <style>
        html, body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        p {
            margin: 0.8em 0;
            text-align: justify;
        }
        .bold {
            font-weight: bold;
        }
        .paragraph {
            margin-bottom: 1em;
        }
        </style>
        <div>${
          paraList.length > 0
            ? paraList
                .map(
                  (para) =>
                    `<p class="paragraph${
                      para.isBold ? " bold" : ""
                    }">${para.text.trim()}</p>`
                )
                .join("")
            : "Empty"
        }</div>
      `;
  }
  async parse() {
    try {
      let blob = new Blob([this.pdfBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });

      this.book = await makePDF(file, this.password);

      // 所有 OCR 引擎均由宿主通过 externalWorker 注入并自行管理库加载与模型缓存
      this.worker = this.externalWorker;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
export default PdfTextRender;
