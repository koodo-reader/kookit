import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
declare var window: any;
class TxtRender extends GeneralRender {
  text: string;
  encoding: string;
  bookStr: string;
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(text: string, mode: string, encoding: string) {
    super(mode, "TXT");
    this.text = text;
    this.encoding = encoding;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
    this.book = "";
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
    this.book = makeHtmlBook(this.text, true);
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }

  async getMetadata(txtBuffer) {
    const array = new Uint8Array(txtBuffer);
    let bufferStr = "";
    for (let i = 0; i < array.length; ++i) {
      bufferStr += String.fromCharCode(array[i]);
    }
    let charset = window.jschardet.detect(bufferStr).encoding || "utf-8";
    return { charset: charset || "utf8" };
  }
}

export default TxtRender;
