import KindleParser from "./utils/kindleParser";
import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleImageSize,
  handleRenderChatper,
  handleScrollTop,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import MobiParser from "./utils/mobiParser";
import { excuteCode } from "./utils/htmlUtil";
class MobiRender {
  mobiBuffer: ArrayBuffer;
  bookStr: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mobiBuffer: ArrayBuffer) {
    this.mobiBuffer = mobiBuffer;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      excuteCode();
      let mobiDoc: Element = await new KindleParser(this.mobiBuffer).render();
      console.log(mobiDoc);

      let bookStr = mobiDoc.outerHTML;
      this.bookStr = bookStr;
      this.element = element;
      let parser = new MobiParser(this.bookStr);
      this.chapterDocList = parser.getChapterDoc();
      this.chapterList = parser.getChapter();
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

      createIframe(element);
      window.frames[0].document.body.innerHTML = this.chapterDocList[
        chapterIndex
      ].text;
      StorageUtil.setReaderConfig("chapterTitle", chapterTitle);
      handleIframeHeight();
      handleImageSize();
      handleScrollTop(element);
      bindEvent(element, this.chapterList, this.chapterDocList);
      resolve();
    });
  }
  getChapter() {
    return this.chapterList;
  }
  goToChapter(title: string) {
    handleRenderChatper(title, this.chapterDocList, this.element);
  }
  goToPosition(title: string, text: string) {
    handleRenderChatper(title, this.chapterDocList, this.element);
    handleScrollTop(this.element, text);
  }
}
export default MobiRender;
