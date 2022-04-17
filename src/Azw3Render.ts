import KindleParser from "./utils/kindleParser";
import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import {
  createIframe,
  getAzw3Style,
  handleLayout,
  progressInfo,
} from "./utils/layoutUtil";
import {
  getSearchResult,
  getVisibleText,
  handleNextChapter,
  handlePrevChapter,
  handleRecord,
  handleRenderChatper,
  handleScrollPage,
  handleScrollPosition,
} from "./utils/navigationUtil";
import StorageUtil from "./utils/storageUtil";
import StrParser from "./utils/strParser";
import { excuteCode } from "./utils/htmlUtil";
import EventEmitter from "./utils/EventEmitter";
class Azw3Render extends EventEmitter {
  azw3Buffer: ArrayBuffer;
  mode: string;
  isSliding: boolean;
  bookStr: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(azw3Buffer: ArrayBuffer, mode: string, isSliding: boolean) {
    super();
    this.azw3Buffer = azw3Buffer;
    this.mode = mode;
    this.isSliding = isSliding || false;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
  }
  async renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }
      let mobiDoc: Element = await new KindleParser(this.azw3Buffer).render();
      let bookStr = mobiDoc.outerHTML;
      this.bookStr = bookStr;
      this.element = element;
      let parser = new StrParser(this.bookStr);
      this.chapterList = parser.getChapter();
      this.chapterDocList = parser.getChapterDoc();

      let chapterTitle =
        StorageUtil.getKookitConfig("chapterTitle") ||
        this.chapterDocList[0].title;
      createIframe(element, getAzw3Style(mobiDoc));

      handleLayout(element, this.mode);
      handleRenderChatper(
        chapterTitle,
        this.chapterDocList,
        this.element,
        this.mode
      );
      this.trigger("rendered");
      resolve();
    });
  }
  getChapter() {
    return this.chapterList;
  }
  getPageSize() {
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
    };
  }
  goToChapter(title: string) {
    handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
    this.trigger("rendered");
  }
  goToPosition(cfi: string) {
    let { text, chapterTitle, count } = JSON.parse(cfi);
    handleRenderChatper(
      chapterTitle,
      this.chapterDocList,
      this.element,
      this.mode
    );
    handleScrollPosition(this.element, this.mode, text, count);
    this.trigger("rendered");
  }
  async prev() {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
      handlePrevChapter(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode
      );
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode,
        1,
        this.isSliding,
        this.trigger
      );
    }
    handleRecord(this.element, this.mode);
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  async next() {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    if (
      Math.abs(
        doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth
      ) < 10 ||
      this.mode === "scroll"
    ) {
      handleNextChapter(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode
      );
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
        this.chapterList,
        this.chapterDocList,
        this.mode,
        -1,
        this.isSliding,
        this.trigger
      );
    }
    handleRecord(this.element, this.mode);
  }
  visibleText() {
    return getVisibleText(this.element, this.mode);
  }
  doSearch(keyword: string) {
    return getSearchResult(keyword, this.chapterDocList);
  }
  flatChapter(chapters: any) {
    return chapters;
  }
  getProgress() {
    return progressInfo();
  }
  record() {
    handleRecord(this.element, this.mode);
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      count: StorageUtil.getKookitConfig("count"),
      percentage: StorageUtil.getKookitConfig("percentage"),
    };
  }
  getMetadata() {
    return new KindleParser(this.azw3Buffer).getMetadata();
  }
  setStyle(css: string) {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
  }
}
export default Azw3Render;
