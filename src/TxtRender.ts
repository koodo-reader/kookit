import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
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
      let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
      this.book = makeHtmlBook(text, true);
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");

      resolve();
    });
  }
}

export default TxtRender;
