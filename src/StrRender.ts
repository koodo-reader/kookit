import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import { excuteCode } from "./utils/htmlUtil";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleImageSize,
  handleRenderChatper,
  handleScrollTop,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import StrParser from "./utils/strParser";
class StrRender {
  bookStr: string;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(bookStr: string, mode: string) {
    this.bookStr = bookStr;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      excuteCode();
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

      createIframe(element);
      window.frames[0].document.body.innerHTML = this.chapterDocList[
        chapterIndex
      ].text;
      StorageUtil.setReaderConfig("chapterTitle", chapterTitle);
      handleIframeHeight(element, this.mode);
      handleImageSize(this.mode);
      handleScrollTop(element);
      bindEvent(element, this.chapterList, this.chapterDocList, this.mode);
      resolve();
    });
  }
  getChapter() {
    return this.chapterList;
  }

  goToChapter(title: string) {
    handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
  }
}
export default StrRender;
