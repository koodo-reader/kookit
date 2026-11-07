import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import { EMFJS, RTFJS, WMFJS } from "../libs/rtf";
import { getCache } from "../libs/cache.js";
class RtfRender extends GeneralRender {
  rtfBuffer: ArrayBuffer;
  constructor(rtfBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "RTF" });
    this.rtfBuffer = rtfBuffer;
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
      RTFJS.loggingEnabled(false);
      WMFJS.loggingEnabled(false);
      EMFJS.loggingEnabled(false);
      const rtfDoc = new RTFJS.Document(this.rtfBuffer, {});
      const elements = await rtfDoc.render();
      const container = document.createElement("div");
      container.append(...elements);
      this.book = makeHtmlBook(container.innerHTML, false);
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
}
export default RtfRender;
