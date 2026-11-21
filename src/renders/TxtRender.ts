import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import chardet from "chardet";
import { getCache } from "../libs/cache.js";

class TxtRender extends GeneralRender {
  txtBuffer: ArrayBuffer;
  charset: string;
  parserRegex: string;
  constructor(txtBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "TXT" });
    this.txtBuffer = txtBuffer;
    this.charset = config.charset;
    this.parserRegex = config.parserRegex;
  }
  renderTo(element: HTMLElement, bookLocation?: any): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse(bookLocation);
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element, this.isAllowScript);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse(bookLocation?: any) {
    try {
      const textDecoder = new TextDecoder(this.charset);
      const bytes = new Uint8Array(this.txtBuffer);
      let text = textDecoder.decode(bytes);
      this.book = makeHtmlBook(text, true, this.parserRegex, bookLocation);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async refreshContent() {
    // 大文件分段解析出来的章节序号可能和整篇解析不一致，重建目录后要按标题
    // 把当前位置映射回新目录，否则旧序号会指向别的章节，甚至超出目录范围，
    // 表现为翻到章节末尾后无法进入下一章
    const chapterDocIndex = parseInt(
      this.tempLocation.chapterDocIndex || "",
      10
    );
    const chapterTitle = (this.tempLocation.chapterTitle || "").trim();
    await this.parse({ refresh: true });
    let parser = new GeneralParser(this.book);
    this.chapterList = await parser.getChapter(this.book.toc);
    this.chapterDocList = await parser.getChapterDoc();
    const findChapterIndex = (title: string) => {
      let index = -1;
      for (let i = 0; i < this.chapterDocList.length; i++) {
        if ((this.chapterDocList[i].label || "").trim() === title) {
          index = i;
        }
      }
      return index;
    };
    const currentChapter = this.chapterDocList[chapterDocIndex];
    if (
      chapterTitle &&
      (!currentChapter || (currentChapter.label || "").trim() !== chapterTitle)
    ) {
      let mappedIndex = findChapterIndex(chapterTitle);
      if (mappedIndex === -1) {
        // 旧版本可能把目录条目当成过章节标题，新目录里找不到时用
        // 当前已渲染章节的标题兜底
        const renderedTitle = (
          this.getDocument()?.body.querySelector("h1")?.textContent || ""
        ).trim();
        if (renderedTitle) {
          mappedIndex = findChapterIndex(renderedTitle);
        }
      }
      if (mappedIndex > -1) {
        this.tempLocation.chapterDocIndex = mappedIndex + "";
        this.tempLocation.chapterHref = this.chapterDocList[mappedIndex].href;
        this.tempLocation.chapterTitle = this.chapterDocList[mappedIndex].label;
      }
    }
    await this.record();
    // 目录在 refreshContent 后会重建，按旧目录算出的页码映射必须一并失效
    this.chapterSizeCache = null;
    this.chapterPageMapCache = null;
    this.chapterPageMapPromise = null;
    return this.chapterList;
  }
  async preCache() {
    if (!this.book) {
      await this.parse({ refresh: true });
    }
    return await getCache(this.book);
  }

  async getMetadata(txtBuffer: ArrayBuffer) {
    try {
      // Define the size of the chunk to read for detection (e.g., 4KB)
      const CHUNK_SIZE = 4096;
      const bufferLength = txtBuffer.byteLength;

      // Determine the actual size to read (up to CHUNK_SIZE or the file size if smaller)
      const sizeToRead = Math.min(bufferLength, CHUNK_SIZE);

      // Create a Uint8Array from the beginning chunk of the buffer
      const chunkArray = new Uint8Array(txtBuffer, 0, sizeToRead);

      // Detect the charset using only the chunk
      let detectedCharset = chardet.detect(chunkArray);

      // Fallback to utf8 if detection fails or returns null/undefined
      const charset = detectedCharset || "utf8";
      this.charset = charset;

      return { charset: charset };
    } catch (error) {
      console.error("Error detecting charset:", error);
      // Fallback to utf8 in case of error during detection
      this.charset = "utf8";
      return { charset: "utf8" };
    }
  }
}

export default TxtRender;
