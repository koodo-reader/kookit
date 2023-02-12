import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { excuteCode, txtToHtml } from "./utils/htmlUtil";
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
  isSliding: boolean;
  constructor(
    txtBuffer: ArrayBuffer,
    mode: string,
    encoding: string,
    isSliding: boolean
  ) {
    super(mode, isSliding);
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
    this.isSliding = isSliding || false;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }
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
