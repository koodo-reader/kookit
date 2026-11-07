import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import { loadMobiBook } from "../libs/mobi-loader";
class MobiRender extends GeneralRender {
  mobiBuffer: ArrayBuffer;
  constructor(mobiBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "MOBI" });
    this.mobiBuffer = mobiBuffer;
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
    this.book = await loadMobiBook(this.mobiBuffer);
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
export default MobiRender;
