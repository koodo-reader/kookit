import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { progressInfo } from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import {
  getCloestBlock,
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
import CFI from "epub-cfi-resolver";
declare var window: any;

class GeneralRender extends EventEmitter {
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mode: string) {
    super();
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
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
  async goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      await handleScrollPosition(this.element, this.mode, "", "", chapterHref);
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToPosition(cfi: string) {
    let { text, chapterDocIndex, chapterTitle, chapterHref, count } =
      JSON.parse(cfi);
    if (chapterTitle && !chapterDocIndex) {
      chapterDocIndex = window._.findLastIndex(this.chapterDocList, {
        title: chapterTitle,
      });
    }
    await handleRenderChatper(
      chapterDocIndex,
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode
    );
    //兼容1.5.1及之前的版本
    if (JSON.parse(cfi).cfi) {
      let cfiObj = new CFI(JSON.parse(cfi).cfi);
      let pageArea = document.getElementById("page-area");
      if (!pageArea) return;
      let iframe = pageArea.getElementsByTagName("iframe")[0];
      if (!iframe) return;
      let doc: any = iframe.contentDocument;
      if (!doc) {
        return;
      }
      var bookmark = cfiObj.resolveLast(doc, {
        ignoreIDs: true,
      });

      let targetNode = getCloestBlock(
        bookmark.node.parentElement,
        this.element
      );
      console.log(targetNode);
      let left = targetNode ? targetNode.offsetLeft : 0;
      let top = targetNode ? targetNode.offsetTop : 0;
      if (this.mode !== "scroll") {
        doc.body.scrollTo(left, 0);
      } else {
        this.element.scrollTo(0, top);
      }
    } else {
      await handleScrollPosition(this.element, this.mode, text, count, "");
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToAnchor(href: string) {
    await handleScrollPosition(this.element, this.mode, "", "", href);
    await this.record();
    this.trigger("rendered");
  }
  removeContent() {
    this.element.innerHTML = "";
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
      await handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode
      );
      doc.body.scrollTo(doc.body.scrollWidth, 0);
      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        1,
        this.trigger
      );
    }
    let isSliding =
      StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
    if (isSliding) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(this.element, this.mode);
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
      await handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode
      );
      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        -1,
        this.trigger
      );
    }
    let isSliding =
      StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
    if (isSliding) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(this.element, this.mode);
  }
  async prevChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    await handlePrevChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode
    );
    await this.record();
    this.trigger("rendered");
  }
  async nextChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    await handleNextChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode
    );
    await this.record();
    this.trigger("rendered");
  }
  visibleText() {
    return getVisibleText(this.element, this.mode);
  }
  doSearch(keyword: string) {
    return getSearchResult(keyword, this.chapterDocList);
  }
  async getProgress() {
    return await progressInfo();
  }
  async record() {
    let isSliding =
      StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
    if (isSliding) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(this.element, this.mode);
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
