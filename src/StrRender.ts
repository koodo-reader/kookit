import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { txtToHtml } from "./utils/htmlUtil";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import StrParser from "./utils/strParser";
import GeneralRender from "./GeneralRender";

class StrRender extends GeneralRender {
  bookStr: string;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(bookStr: string, mode: string) {
    super(mode, "STR");
    this.bookStr = bookStr;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      let parser = new StrParser(this.bookStr);
      if (parser.isContainChapter()) {
        this.chapterList = parser.getChapter();
      } else {
        this.bookStr = txtToHtml(parser.getDocText());
        parser = new StrParser(this.bookStr);
        this.chapterList = parser.getChapter();
      }
      this.chapterDocList = parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
}
export default StrRender;
