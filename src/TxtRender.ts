import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import { excuteCode, txtToHtml } from "./utils/htmlUtil";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleLayout,
  handleRenderChatper,
  handleScrollPosition,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import txtParser from "./utils/txtParser";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  bookStr: string;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(
    txtBuffer: ArrayBuffer,
    mode: string,
    encoding: string = "utf-8"
  ) {
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
      excuteCode();
      let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
      let bookStr = txtToHtml(text);
      this.bookStr = bookStr;
      this.element = element;
      let parser = new txtParser(this.bookStr);
      this.chapterList = parser.getChapter();
      this.chapterDocList = parser.getChapterDoc();
      let chapterTitle =
        StorageUtil.getKookitConfig("chapterTitle") ||
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
      StorageUtil.setKookitConfig("chapterTitle", chapterTitle);
      handleLayout(element, this.mode);
      handleIframeHeight(element, this.mode);
      handleScrollPosition(element, this.mode);
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
  goToPosition(text: string, chapterTitle: string, count: string) {
    handleRenderChatper(
      chapterTitle,
      this.chapterDocList,
      this.element,
      this.mode
    );
    handleScrollPosition(this.element, this.mode, text, count);
  }
}

export default TxtRender;
