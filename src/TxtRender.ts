import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
declare var window: any;
class TxtRender extends GeneralRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  bookStr: string;
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(txtBuffer: ArrayBuffer, mode: string, encoding: string) {
    super(mode, "TXT");
    this.txtBuffer = txtBuffer;
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
    let text = new TextDecoder(this.encoding || "utf8").decode(this.txtBuffer);
    this.book = makeHtmlBook(text, true);
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }

  async getMetadata() {
    const array = new Uint8Array(this.txtBuffer);
    let bufferStr = "";
    for (let i = 0; i < 100; ++i) {
      bufferStr += String.fromCharCode(array[i]);
    }
    let charset = window.jschardet.detect(bufferStr).encoding || "utf-8";
    return { charset: charset || "utf8" };
  }
}

export default TxtRender;
