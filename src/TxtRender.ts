import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import { txtToHtml } from "./utils/htmlUtil";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleRenderChatper,
  handleScrollTop,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import txtParser from "./utils/txtParser";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  bookStr: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(txtBuffer: ArrayBuffer, encoding: string = "utf-8") {
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;
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
      let parser = new txtParser(this.bookStr);
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
      handleIframeHeight();
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
}

export default TxtRender;
