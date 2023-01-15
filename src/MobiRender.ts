import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout, progressInfo } from "./utils/layoutUtil";
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
import MobiParser from "./utils/mobiParser";
import { excuteCode } from "./utils/htmlUtil";
import EventEmitter from "./utils/EventEmitter";
import { isMOBI, MOBI } from "./libs/mobi.js";
declare var window: any;
class MobiRender extends EventEmitter {
  mobiBuffer: ArrayBuffer;
  mode: string;
  book: any;
  metadata: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  isSliding: boolean;
  constructor(mobiBuffer: ArrayBuffer, mode: string, isSliding: boolean) {
    super();
    this.mobiBuffer = mobiBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
    this.isSliding = isSliding || false;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }
      let blob = new Blob([this.mobiBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      if (await isMOBI(file)) {
        this.book = await new MOBI({ unzlib: window.fflate.unzlibSync }).open(
          file
        );
        let parser = new MobiParser(this.book);
        this.element = element;

        this.chapterList = await parser.getChapter(this.book.toc);
        this.chapterDocList = await parser.getChapterDoc();
        this.metadata = await parser.getMetadata();

        let chapterDocIndex = parseInt(
          StorageUtil.getKookitConfig("chapterDocIndex") || "0"
        );
        createIframe(element);

        handleLayout(element, this.mode);
        handleRenderChatper(
          chapterDocIndex,
          this.chapterDocList,
          this.element,
          this.mode
        );
        this.trigger("rendered");
        resolve();
      }
    });
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
  removeContent() {
    this.element.innerHTML = "";
  }
  async prev() {
    this.trigger("page-changed");
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
  record() {
    handleRecord(this.element, this.mode);
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
  async getMetadata() {
    let blob = new Blob([this.mobiBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    this.book = await new MOBI({ unzlib: window.fflate.unzlibSync }).open(file);
    let parser = new MobiParser(this.book);
    return await parser.getMetadata();
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
export default MobiRender;
