import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import chardet from "chardet";
import { getCache } from "../libs/cache.js";
import Chinese from "../libs/zh-convert";
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
      createIframe(element);
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
    await this.parse({ refresh: true });
    let parser = new GeneralParser(this.book);
    this.chapterList = await parser.getChapter(this.book.toc);
    this.chapterDocList = await parser.getChapterDoc();
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
