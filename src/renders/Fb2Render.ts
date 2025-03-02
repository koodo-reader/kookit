import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { makeFB2 } from "../libs/fb2";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
class Fb2Render extends GeneralRender {
  fb2Buffer: ArrayBuffer;
  constructor(fb2Buffer: ArrayBuffer, config: any) {
    super({ format: "FB2", ...config });
    this.fb2Buffer = fb2Buffer;
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
      createIframe(element);

      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    try {
      let blob = new Blob([this.fb2Buffer]);
      this.book = await makeFB2(blob);
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
      console.log(error);
      throw error;
    }
  }
}
export default Fb2Render;
