import Chapter from "./model/chapter.js";
import ChapterDoc from "./model/chapterDoc.js";
import { createIframe, handleLayout } from "./utils/layoutUtil.js";
import GeneralParser from "./utils/generalParser.js";
import { isPDF, makePDF } from "./libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
declare var window: any;
class PdfRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  mode: string;
  book: any;
  metadata: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(pdfBuffer: ArrayBuffer, mode: string, animation: string) {
    super(mode, "PDF", animation);
    this.pdfBuffer = pdfBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
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
      resolve();
    });
  }
  async parse() {
    try {
      let blob = new Blob([this.pdfBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      if (await isPDF(file)) {
        this.book = await makePDF(file);
      }
      console.log(this.book);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
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
export default PdfRender;
