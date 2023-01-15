import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { excuteCode, txtToHtml } from "./utils/htmlUtil";
import { createIframe, handleLayout, progressInfo } from "./utils/layoutUtil";
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
import EventEmitter from "./utils/EventEmitter";

class StrRender extends EventEmitter {
  bookStr: string;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  isSliding: boolean;
  constructor(bookStr: string, mode: string, isSliding: boolean) {
    super();
    this.bookStr = bookStr;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.element = "";
    this.isSliding = isSliding || false;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }
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

      let chapterDocIndex = parseInt(
        StorageUtil.getKookitConfig("chapterDocIndex") || "0"
      );
      createIframe(element);
      handleRenderChatper(
        chapterDocIndex,
        this.chapterDocList,
        this.element,
        this.mode
      );
      handleLayout(element, this.mode);
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
  goToChapter(index: string) {
    handleRenderChatper(
      parseInt(index),
      this.chapterDocList,
      this.element,
      this.mode
    );
    this.trigger("rendered");
  }
  goToPosition(cfi: string) {
    let { text, chapterDocIndex, count } = JSON.parse(cfi);
    handleRenderChatper(
      chapterDocIndex,
      this.chapterDocList,
      this.element,
      this.mode
    );
    handleScrollPosition(this.element, this.mode, text, count);
    this.record();
    this.trigger("rendered");
  }
  record() {
    handleRecord(this.element, this.mode);
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  flatChapter(chapters: any) {
    return chapters;
  }
  async prev() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
      handlePrevChapter(this.element, this.chapterDocList, this.mode);
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
        this.chapterDocList,
        this.mode,
        1,
        this.isSliding,
        this.trigger
      );
    }

    handleRecord(this.element, this.mode);
  }
  async next() {
    this.trigger("page-changed");
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
      handleNextChapter(this.element, this.chapterDocList, this.mode);
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
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
  getProgress() {
    return progressInfo();
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      chapterDocIndex: StorageUtil.getKookitConfig("chapterDocIndex"),
      count: StorageUtil.getKookitConfig("count"),
      percentage: StorageUtil.getKookitConfig("percentage"),
    };
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
export default StrRender;
