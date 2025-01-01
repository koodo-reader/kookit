import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import { marked } from "marked";
import { getCache } from "../libs/cache.js";
class MdRender extends GeneralRender {
  mdBuffer: ArrayBuffer;
  constructor(mdBuffer: ArrayBuffer, mode: string, animation: string) {
    super({ mode, format: "MD", animation });
    this.mdBuffer = mdBuffer;
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
      handleLayout(element, this.mode, doc);
      resolve();
    });
  }
  async parse() {
    return new Promise<void>((resolve, reject) => {
      try {
        var blob = new Blob([this.mdBuffer], { type: "text/plain" });
        var reader = new FileReader();
        reader.onload = async (evt) => {
          let docStr = await marked(evt.target?.result as any);
          this.book = makeHtmlBook(docStr, false);

          resolve();
        };
        reader.readAsText(blob, "UTF-8");
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
}
export default MdRender;
