import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
declare var window: any;
class DocxRender extends GeneralRender {
  docxBuffer: ArrayBuffer;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(docxBuffer: ArrayBuffer, mode: string) {
    super(mode, "MD");
    this.docxBuffer = docxBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.element = "";
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
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
  async parse() {
    return new Promise<void>((resolve, reject) => {
      window.mammoth
        .convertToHtml({ arrayBuffer: this.docxBuffer })
        .then(async (res: any) => {
          this.book = makeHtmlBook(res.value, true);

          resolve();
        });
    });
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }
}
export default DocxRender;
