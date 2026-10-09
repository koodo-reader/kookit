import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { ChmFile, chmReaderFromBuffer } from "../libs/chmlib";
import { makeChmBook } from "../libs/book-chm";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
class ChmRender extends GeneralRender {
  chmBuffer: ArrayBuffer;
  constructor(chmBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "CHM" });
    this.chmBuffer = chmBuffer;
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
      createIframe(element, this.isAllowScript);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    try {
      let chmFile = await ChmFile.open(
        chmReaderFromBuffer(new Uint8Array(this.chmBuffer))
      );
      this.book = await makeChmBook(chmFile);
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
export default ChmRender;
