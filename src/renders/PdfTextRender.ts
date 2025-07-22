import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import { isPDF, makePDF } from "../libs/pdf";
class PdfTextRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  password: string = "";
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ format: "PDFTEXT", ...config });
    this.pdfBuffer = pdfBuffer;
    this.password = config.password || "";
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

      for (let chapterDoc of this.chapterDocList) {
        chapterDoc.text.load = async () => {
          let textContent = await chapterDoc.text.getTextContent();
          console.log("textContent", textContent);
          let paraList: any[] = [];

          if (
            textContent &&
            textContent.items &&
            Array.isArray(textContent.items)
          ) {
            // 先收集所有字体大小，确定基础大小和最大大小
            // 先收集所有字体大小，确定基础大小和最大大小
            const fontSizes = textContent.items
              .filter((item: any) => item.str && item.transform)
              .map((item: any) => item.transform[3]);

            // 计算字体大小的众数（出现频率最高的值）
            const fontSizeCount = fontSizes.reduce((acc, size) => {
              acc[size] = (acc[size] || 0) + 1;
              return acc;
            }, {} as Record<number, number>);

            const baseFontSize = Object.keys(fontSizeCount).reduce((a, b) =>
              fontSizeCount[Number(a)] > fontSizeCount[Number(b)] ? a : b
            );

            const maxFontSize = Math.max(...fontSizes);
            const fontSizeRange = maxFontSize - Number(baseFontSize);

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
                let isBold = fontSize > Number(baseFontSize) * 1.2;

                // 如果Y坐标变化较大，认为是新段落
                if (yDiff > item.height * 1.5 && currentPara.text.trim()) {
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

            // 添加最后一个段落
            if (currentPara.text.trim()) {
              paraList.push(currentPara);
            }
          }

          console.log(paraList);
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
        <div>${paraList
          .map(
            (para) =>
              `<p class="paragraph${
                para.isBold ? " bold" : ""
              }">${para.text.trim()}</p>`
          )
          .join("")}</div>
      `,
              ],
              { type: "text/html" }
            )
          );
          return src;
        };
      }
      console.log("chapterList", this.chapterList);
      console.log("chapterDocList", this.chapterDocList);
      createIframe(element);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
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
