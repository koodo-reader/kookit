import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { progressInfo } from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
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
import EventEmitter from "./utils/EventEmitter";

class GeneralRender extends EventEmitter {
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  isSliding: boolean;
  constructor(mode: string, isSliding: boolean) {
    super();
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
    this.isSliding = isSliding || false;
  }
  getPageSize() {
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
    };
  }
  flatChapter(chapters: any) {
    let newChapter: any = [];
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].subitems && chapters[i].subitems.length > 0) {
        newChapter.push(chapters[i]);
        newChapter = newChapter.concat(this.flatChapter(chapters[i].subitems));
      } else {
        newChapter.push(chapters[i]);
      }
    }
    return newChapter;
  }
  getChapter() {
    return this.chapterList;
  }
  goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      this.chapterDocList,
      this.element,
      this.mode
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      handleScrollPosition(this.element, this.mode, "", "", chapterHref);
    }
    this.record();
    this.trigger("rendered");
  }
  goToPosition(cfi: string) {
    let { text, chapterDocIndex, chapterTitle, count } = JSON.parse(cfi);
    handleRenderChatper(
      chapterDocIndex,
      chapterTitle,
      this.chapterDocList,
      this.element,
      this.mode
    );
    handleScrollPosition(this.element, this.mode, text, count, "");
    this.record();
    this.trigger("rendered");
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  prev() {
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
      handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode
      );
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        1,
        this.isSliding,
        this.trigger
      );
    }

    handleRecord(this.element, this.mode);
  }
  next() {
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
      handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode
      );
      this.trigger("rendered");
    } else {
      handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        -1,
        this.isSliding,
        this.trigger
      );
    }

    handleRecord(this.element, this.mode);
  }
  prevChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    handlePrevChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode
    );
    this.record();
    this.trigger("rendered");
  }
  nextChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    handleNextChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode
    );
    this.record();
    this.trigger("rendered");
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
  record() {
    handleRecord(this.element, this.mode);
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      chapterDocIndex: StorageUtil.getKookitConfig("chapterDocIndex"),
      chapterHref: StorageUtil.getKookitConfig("chapterHref"),
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
export default GeneralRender;
