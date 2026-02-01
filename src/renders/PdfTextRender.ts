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
const fetchText = async (url) => await (await fetch(url)).text();
declare var window: any;
class PdfTextRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  password: string = "";
  isScannedPDF: string;
  worker: any;
  cache: any;
  processingPromises: Map<number, Promise<void>>; // 跟踪正在处理的章节
  ocrLang: string = "chi_sim"; // 默认OCR语言为简体中文
  serverRegion: string;
  paraSpacingValue: number = 1.5; // 段落间距
  titleSizeValue: number = 1.2; // 标题大小倍数
  isFinishOCR: boolean = false;
  ocrEngine: string;
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "PDFTEXT" });
    this.pdfBuffer = pdfBuffer;
    this.password = config.password || "";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.ocrLang = config.ocrLang || "chi_sim"; // 支持配置OCR语言
    this.paraSpacingValue = parseFloat(config.paraSpacingValue) || 1.5; // 支持配置段落间距
    this.titleSizeValue = parseFloat(config.titleSizeValue) || 1.2; // 支持配置标题大小倍数
    this.cache = {};
    this.serverRegion = config.serverRegion || "global";
    this.processingPromises = new Map();
    this.ocrEngine = config.ocrEngine || "tesseract"; // 支持配置OCR引擎
  }

  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();

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
          console.log(this.cache, "this.cache");
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
    const src = await this.getTextByOCR(chapterDoc);
    this.cache[index] = src;
    return src;
  }

  // 同步预处理后续章节
  async preProcessNextChapters(currentIndex: number) {
    const maxIndex = Math.min(currentIndex + 3, this.chapterDocList.length - 1);

    for (let i = currentIndex + 1; i <= maxIndex; i++) {
      // 只处理未缓存且未在处理中的章节
      if (!this.cache[i] && !this.processingPromises.has(i)) {
        console.log("cacheing", i);
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
      console.log("index", index);
      const src = await this.getTextByOCR(chapterDoc);
      console.log("cached", index);
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
        console.log(result, "result");
        return result.parragraphs.map((p) => p.text).join("\n");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      throw error;
    }
  };
  async getTextByOCR(chapterDoc) {
    let page = await chapterDoc.text.getPage();
    let { imageURL } = await convertPageToImage(page);
    const textContent = await this.performOCR(imageURL);
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
      let blob = new Blob([this.pdfBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      if (await isPDF(file)) {
        this.book = await makePDF(file, this.password);
      }
      if (this.isScannedPDF === "yes" && this.ocrEngine === "tesseract") {
        let workerScript = await fetchText(
          `${isElectron() ? "." : ""}/lib/tesseractjs/worker.min.js`
        );
        let workerUrl = URL.createObjectURL(
          new Blob([workerScript], { type: "application/javascript" })
        );
        const worker = await window.Tesseract.createWorker([this.ocrLang], 1, {
          workerPath: workerUrl,
          corePath: `https://${
            this.serverRegion === "china"
              ? "storage.koodoreader.cn"
              : "storage.koodoreader.com"
          }/tesseractjs/tesseract-core`,
          langPath: `https://${
            this.serverRegion === "china"
              ? "storage.koodoreader.cn"
              : "storage.koodoreader.com"
          }/tesseractjs/4.0.0-fast`,
          // langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
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
        let dictStr = await fetchText(
          `https://${
            this.serverRegion === "china"
              ? "storage.koodoreader.cn"
              : "storage.koodoreader.com"
          }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_dict.txt`
        );
        // 设置 WASM 文件路径（必须！）
        window.ort.env.wasm.wasmPaths =
          "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

        // 启用 Proxy Worker（自动 offload 到后台 Worker）
        window.ort.env.wasm.proxy = true;

        // 性能优化：增加线程数和启用SIMD加速
        window.ort.env.wasm.numThreads = Math.min(
          8,
          navigator.hardwareConcurrency || 4
        );
        window.ort.env.wasm.simd = true;

        // 启用图级别优化和执行模式优化
        window.ort.env.wasm.graphOptimizationLevel = "all";
        window.ort.env.wasm.executionMode = "parallel";
        const localOCR = await window["esearch-ocr"].init({
          det: {
            input: `https://${
              this.serverRegion === "china"
                ? "storage.koodoreader.cn"
                : "storage.koodoreader.com"
            }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_det.onnx`, // det指识别模型，如果上面提到的文字包没有，那就用中英混合的det（在ch.zip里）。
          },
          rec: {
            input: `https://${
              this.serverRegion === "china"
                ? "storage.koodoreader.cn"
                : "storage.koodoreader.com"
            }/paddleocr/models/${this.ocrLang}/${this.ocrLang}_rec.onnx`,
            decodeDic: dictStr, // 在模型压缩包中的txt文件，需要传入里面的内容而不是路径
          },
          ort: window.ort, // 传入onnxruntime-web的引用
        });
        this.worker = localOCR;
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
