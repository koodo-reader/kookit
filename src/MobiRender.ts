import KindleParser from "./utils/kindleParser";
import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
  handleImageSize,
  handleLayout,
  handlePrevChapter,
  handleRenderChatper,
  handleScrollPage,
  handleScrollPosition,
  handleTurnChapter,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import MobiParser from "./utils/mobiParser";
import { excuteCode } from "./utils/htmlUtil";
class MobiRender {
  mobiBuffer: ArrayBuffer;
  mode: string;
  bookStr: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mobiBuffer: ArrayBuffer, mode: string) {
    this.mobiBuffer = mobiBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      excuteCode();
      let mobiDoc: Element = await new KindleParser(this.mobiBuffer).render();

      let bookStr = mobiDoc.outerHTML;
      this.bookStr = bookStr;
      this.element = element;
      let parser = new MobiParser(this.bookStr);
      this.chapterDocList = parser.getChapterDoc();
      this.chapterList = parser.getChapter();
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
      StorageUtil.setKookitConfig(
        "chapterTitle",
        this.chapterDocList[chapterIndex].title
      );
      handleLayout(element, this.mode);
      handleIframeHeight(element, this.mode);

      handleImageSize(this.element, this.mode);
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
  prevPage() {
    if (window.frames[0].document.body.scrollLeft === 0) {
      handlePrevChapter(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode
      );
    } else {
      handleScrollPage(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode,
        1
      );
    }
  }
  nextPage() {
    if (
      Math.abs(
        window.frames[0].document.body.scrollWidth -
          window.frames[0].document.body.scrollLeft -
          window.frames[0].document.body.clientWidth
      ) < 10
    ) {
      handleTurnChapter(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode
      );
    } else {
      handleScrollPage(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode,
        -1
      );
    }
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      count: StorageUtil.getKookitConfig("count"),
    };
  }
  setStyle(css: string) {
    window.frames[0].document.body.setAttribute(
      "style",
      css + window.frames[0].document.body.getAttribute("style")
    );
  }
}
export default MobiRender;
