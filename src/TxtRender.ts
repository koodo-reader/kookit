import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { txtToHtml } from "./utils/htmlUtil";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import StrParser from "./utils/strParser";
import GeneralRender from "./GeneralRender";
class TxtRender extends GeneralRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  bookStr: string;
  mode: string;
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
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
      let bookStr = txtToHtml(text);
      this.bookStr = bookStr;
      this.element = element;
      let parser = new StrParser(this.bookStr);
      this.chapterList = parser.getChapter();
      this.chapterDocList = parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");

      resolve();
    });
  }
}

export default TxtRender;
