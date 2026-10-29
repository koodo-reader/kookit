import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import { loadEpubBook } from "../libs/epub-loader";
class EpubRender extends GeneralRender {
  epubBuffer: ArrayBuffer;
  constructor(epubBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "EPUB" });
    this.epubBuffer = epubBuffer;
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
      console.log("chapterDocList", this.chapterDocList);
      console.log("chapterList", this.chapterList);
      createIframe(element, this.isAllowScript);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    this.book = await loadEpubBook(this.epubBuffer);
  }
  async preCache() {
    try {
      if (!this.book) {
        await this.parse();
      }
      return await getCache(this.book);
    } catch (error) {
      return "";
    }
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error, "error");
      throw error;
    }
  }
}
export default EpubRender;
