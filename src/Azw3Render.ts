import KindleParser from "./utils/kindleParser";
import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleRenderChatper,
  handleScrollTop,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import StrParser from "./utils/strParser";
class Azw3Render {
  azw3Buffer: ArrayBuffer;
  bookStr: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(azw3Buffer: ArrayBuffer) {
    this.azw3Buffer = azw3Buffer;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    let mobiDoc: Element = new KindleParser(this.azw3Buffer).render();
    let bookStr = mobiDoc.outerHTML;
    this.bookStr = bookStr;
    this.element = element;
    let parser = new StrParser(this.bookStr);
    this.chapterList = parser.getChapter();
    this.chapterDocList = parser.getChapterDoc();

    let chapterTitle =
      StorageUtil.getReaderConfig("chapterTitle") ||
      this.chapterDocList[0].title;
    let chapterIndex =
      _.findIndex(this.chapterDocList, {
        title: chapterTitle,
      }) === -1
        ? 0
        : _.findIndex(this.chapterDocList, {
            title: chapterTitle,
          });
    // console.log(chapterTitle, "chapterTitle");

    createIframe(element);
    window.frames[0].document.body.innerHTML = this.chapterDocList[
      chapterIndex
    ].text;
    StorageUtil.setReaderConfig("chapterTitle", chapterTitle);
    handleIframeHeight();
    handleScrollTop(element);
    bindEvent(element, this.chapterList, this.chapterDocList);
  }
  getChapter() {
    console.log(this.chapterDocList, this.chapterList);
    return this.chapterList;
  }

  goToChapter(title: string) {
    handleRenderChatper(title, this.chapterDocList, this.element);
  }
}
export default Azw3Render;
