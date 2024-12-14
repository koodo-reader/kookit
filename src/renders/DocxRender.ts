import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import mammoth from "mammoth";
import { getCache } from "../libs/cache.js";
class DocxRender extends GeneralRender {
  docxBuffer: ArrayBuffer;
  constructor(docxBuffer: ArrayBuffer, mode: string, animation: string) {
    super(mode, "DOCX", animation);
    this.docxBuffer = docxBuffer;
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
        mammoth
          .convertToHtml({ arrayBuffer: this.docxBuffer })
          .then(async (res: any) => {
            this.book = makeHtmlBook(res.value, false);

            resolve();
          });
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
export default DocxRender;
