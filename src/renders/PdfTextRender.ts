import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import { isPDF, makePDF } from "../libs/pdf";
import {
  convertPageToImage,
  isElectron,
  showOCRProgress,
} from "../utils/pdfUtil";
import { ocrCache } from "../utils/ocrCacheUtil";
const fetchText = async (url) => await (await fetch(url)).text();
declare var window: any;
class PdfTextRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  password: string = "";
  isScannedPDF: string;
  worker: any;
  cache: any;
  processingPromises: Map<number, Promise<void>>; // 跟踪正在处理的章节
  ocrLang: string = "standard_v5_mobile"; // 默认OCR语言为简体中文
  serverRegion: string;
  paraSpacingValue: number = 1.5; // 段落间距
  titleSizeValue: number = 1.2; // 标题大小倍数
  isFinishOCR: boolean = false;
  ocrEngine: string;
  shouldShowProgress: boolean = false; // 控制是否显示进度
  externalWorker: any;
  pdfPageCount: number = 0;
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "PDFTEXT" });
    this.pdfBuffer = pdfBuffer;
    this.password = config.password || "";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.ocrLang = config.ocrLang || "standard_v5_mobile"; // 支持配置OCR语言
    this.paraSpacingValue = parseFloat(config.paraSpacingValue) || 1.5; // 支持配置段落间距
    this.titleSizeValue = parseFloat(config.titleSizeValue) || 1.2; // 支持配置标题大小倍数
    this.cache = {};
    this.serverRegion = config.serverRegion || "global";
    this.processingPromises = new Map();
    this.ocrEngine = config.ocrEngine || "paddle"; // 支持配置OCR引擎
    this.externalWorker = config.externalWorker || null;
    this.pdfPageCount = config.pdfPageCount || 0;
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
            if (this.isScannedPDF === "yes") {
              this.preProcessNextChapters(index);
            }
            return this.cache[index];
          }

          let src = "";
          if (this.isScannedPDF === "yes") {
            // 优先处理当前章节
            src = await this.processCurrentChapter(index);
            // 异步处理后续章节
            this.preProcessNextChapters(index);
          } else {
            src = await this.getTextFromDoc(chapterDoc);
            this.cache[index] = src;
          }
          return src;
        };
      }
      createIframe(element);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }

  // 优先处理当前章节
  async processCurrentChapter(index: number): Promise<string> {
    if (this.cache[index]) {
      return this.cache[index];
    }

    // 如果当前章节正在处理，等待完成
    if (this.processingPromises.has(index)) {
      await this.processingPromises.get(index);
      return this.cache[index];
    }

    const chapterDoc = this.chapterDocList[index];
    this.isFinishOCR = false; // 重置完成标志
    this.shouldShowProgress = true; // 当前章节显示进度
    const src = await this.getTextByOCR(chapterDoc, index);
    this.shouldShowProgress = false;
    this.cache[index] = src;
    return src;
  }

  // 同步预处理后续章节
  async preProcessNextChapters(currentIndex: number) {
    const maxIndex = Math.min(currentIndex + 3, this.chapterDocList.length - 1);

    for (let i = currentIndex + 1; i <= maxIndex; i++) {
      // 只处理未缓存且未在处理中的章节
      if (!this.cache[i] && !this.processingPromises.has(i)) {
        const promise = this.processChapterOCR(i);
        this.processingPromises.set(i, promise);

        // 等待当前章节处理完成后再处理下一个
        await promise;
        this.processingPromises.delete(i);
      }
    }
  }

  // 处理单个章节的OCR
  async processChapterOCR(index: number): Promise<void> {
    try {
      const chapterDoc = this.chapterDocList[index];
      const src = await this.getTextByOCR(chapterDoc, index);
      this.cache[index] = src;
    } catch (error) {
      console.error(`Failed to process OCR for chapter ${index}:`, error);
    }
  }
  performOCR = async (imageUrl) => {
    try {
      if (this.ocrEngine === "tesseract") {
        const result = await this.worker.recognize(imageUrl);
        // await this.worker.terminate();
        return result.data.text;
      } else if (this.ocrEngine === "paddle") {
        const result = await this.worker.ocr(imageUrl);
        return result.parragraphs.map((p) => p.text).join("\n");
      } else if (this.ocrEngine === "official-ai-ocr") {
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
          const result = await this.worker.recognize(imageUrl, "auto");
          // 完成后立即将进度设为1
          if (this.shouldShowProgress) {
            showOCRProgress(1);
            this.isFinishOCR = true;
          }
          if (result && result.data && result.data.text) {
            return result.data.text;
          } else {
            return "";
          }
        } finally {
          if (this.shouldShowProgress && progressInterval) {
            clearInterval(progressInterval);
          }
        }
      } else {
        throw new Error(`Unsupported OCR engine: ${this.ocrEngine}`);
      }
    } catch (error) {
      console.error("OCR Error:", error);
      throw error;
    }
  };
  async getTextByOCR(chapterDoc, chapterDocIndex: number) {
    let textContent = "";
    if (this.ocrEngine === "external-engine") {
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
        textContent = await this.worker.recognize(chapterDocIndex);

        // 完成后立即将进度设为1
        if (this.shouldShowProgress) {
          if (progressInterval) clearInterval(progressInterval);
          showOCRProgress(1);
          this.isFinishOCR = true;
        }
      } finally {
        if (this.shouldShowProgress && progressInterval) {
          clearInterval(progressInterval);
        }
      }
    } else {
      let page = await chapterDoc.text.getPage();
      let { imageURL } = await convertPageToImage(page);
      textContent = await this.performOCR(imageURL);
    }

    let paraList = textContent.split("\n").filter((para) => para.trim() !== "");

    const src = URL.createObjectURL(
      new Blob(
        [
          `
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
          `,
        ],
        { type: "text/html" }
      )
    );
    return src;
  }
  async getTextFromDoc(chapterDoc) {
    let textContent = await chapterDoc.text.getTextContent();
    let paraList: any[] = [];

    if (textContent && textContent.items && Array.isArray(textContent.items)) {
      // 先收集所有字体大小，确定基础大小和最大大小
      // 先收集所有字体大小，确定基础大小和最大大小
      const fontSizes = textContent.items
        .filter((item: any) => item.str && item.transform)
        .map((item: any) => item.transform[3]);
      let baseFontSize = 10;
      if (fontSizes.length > 0) {
        // 计算字体大小的众数（出现频率最高的值）
        const fontSizeCount = fontSizes.reduce(
          (acc, size) => {
            acc[size] = (acc[size] || 0) + 1;
            return acc;
          },
          {} as Record<number, number>
        );

        baseFontSize = Object.keys(fontSizeCount)
          .map(Number)
          .reduce((a, b) => (fontSizeCount[a] > fontSizeCount[b] ? a : b));
      }

      // const maxFontSize = Math.max(...fontSizes);
      // const fontSizeRange = maxFontSize - Number(baseFontSize);

      let currentPara: any = {
        text: "",
        styles: new Set(),
        y: 0,
        tag: "p",
      };
      let lastY = 0;
      textContent.items.forEach((item: any) => {
        if (item.str) {
          // 检测段落分隔（基于Y坐标变化）
          const yDiff = Math.abs(item.transform[5] - lastY);
          const fontSize = item.transform[3];

          // 根据字体大小确定样式，都用p标签，大字体用bold
          let tag = "p";
          let isBold = fontSize > Number(baseFontSize) * this.titleSizeValue;

          // 如果Y坐标变化较大，认为是新段落
          if (
            yDiff > item.height * this.paraSpacingValue &&
            currentPara.text.trim()
          ) {
            paraList.push(currentPara);
            currentPara = {
              text: "",
              styles: new Set(),
              y: item.transform[5],
              tag: tag,
              isBold: isBold,
            };
          } else if (!currentPara.hasOwnProperty("isBold")) {
            // 如果当前段落还没有确定样式，使用当前item的样式
            currentPara.isBold = isBold;
          }

          // 包装文本
          const wrappedText = item.str;

          // 换行时用空格连接，而不是分段
          if (item.hasEOL) {
            // 如果是用了连接符（如连字符），直接拼接，不加空格
            if (wrappedText.endsWith("-")) {
              currentPara.text += wrappedText.slice(0, -1);
            } else {
              currentPara.text += wrappedText + " ";
            }
          } else {
            currentPara.text += wrappedText;
          }

          lastY = item.transform[5];
        }
      });

      // 添加最后一个段落
      if (currentPara.text.trim()) {
        paraList.push(currentPara);
      }
    }

    const src = URL.createObjectURL(
      new Blob(
        [
          `
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
      `,
        ],
        { type: "text/html" }
      )
    );
    return src;
  }
  async parse() {
    try {
      // 安装 fetch 拦截器以自动缓存所有 OCR 相关资源
      if (this.isScannedPDF === "yes") {
        ocrCache.installGlobalFetchInterceptor();
      }

      let blob = new Blob([this.pdfBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      if (await isPDF(file)) {
        this.book = await makePDF(file, this.password);
      }
      if (this.isScannedPDF === "yes" && this.ocrEngine === "tesseract") {
        // 获取 worker 脚本
        let workerScript = await fetchText(
          `${isElectron() ? "." : ""}/lib/tesseractjs/worker.min.js`
        );
        let workerUrl = URL.createObjectURL(
          new Blob([workerScript], { type: "application/javascript" })
        );

        // 所有资源会在加载时通过 fetch 拦截器自动缓存
        const worker = await window.Tesseract.createWorker([this.ocrLang], 1, {
          workerPath: workerUrl,
          corePath: "https://unpkg.com/tesseract.js-core@6.1.2",
          langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
          logger: (m) => {
            if (
              m.status === "recognizing text" &&
              typeof m.progress === "number" &&
              !this.isFinishOCR
            ) {
              showOCRProgress(m.progress);
              if (m.progress === 1) {
                this.isFinishOCR = true;
              }
            }
          },
        });
        await worker.load();
        this.worker = worker;
      }
      if (this.isScannedPDF === "yes" && this.ocrEngine === "paddle") {
        // 所有资源都会通过 fetch 拦截器自动缓存
        const dictUrl = `https://${
          this.serverRegion === "china"
            ? "storage.koodoreader.cn"
            : "storage.koodoreader.com"
        }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_dict.txt`;
        const response = await fetch(dictUrl);
        let dictStr = await response.text();
        // 设置 WASM 文件路径（必须！）
        window.ort.env.wasm.wasmPaths =
          "https://unpkg.com/onnxruntime-web@1.23.2/dist/";

        // 启用 Proxy Worker（自动 offload 到后台 Worker）
        window.ort.env.wasm.proxy = true;

        const localOCR = await window["esearch-ocr"].init({
          det: {
            input: `https://${
              this.serverRegion === "china"
                ? "storage.koodoreader.cn"
                : "storage.koodoreader.com"
            }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_det.onnx`, // det指识别模型，如果上面提到的文字包没有，那就用中英混合的det（在ch.zip里）。
            ratio: 0.75,
          },
          rec: {
            input: `https://${
              this.serverRegion === "china"
                ? "storage.koodoreader.cn"
                : "storage.koodoreader.com"
            }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_rec.onnx`,
            decodeDic: dictStr, // 在模型压缩包中的txt文件，需要传入里面的内容而不是路径
            // 监听识别进度
            on: (
              index: number,
              result: { text: string; mean: number },
              total: number
            ) => {
              // 只在处理当前页面时显示进度
              if (this.shouldShowProgress && total > 0) {
                const progress = (index + 1) / total; // index 从 0 开始，所以需要 +1
                showOCRProgress(progress);
                if (progress >= 1) {
                  this.isFinishOCR = true;
                }
              }
            },
          },
          ort: window.ort, // 传入onnxruntime-web的引用
          ortOption: {
            executionProviders: [{ name: "webgpu" }, { name: "wasm" }],
          },
        });
        this.worker = localOCR;
      }
      if (this.isScannedPDF === "yes" && this.ocrEngine === "official-ai-ocr") {
        this.worker = this.externalWorker;
      }
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
