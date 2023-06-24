import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { convertStyleNum, progressInfo } from "./utils/layoutUtil";
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
  handleHighlightNode,
} from "./utils/navigationUtil";
import EventEmitter from "./utils/EventEmitter";

class GeneralRender extends EventEmitter {
  mode: string;
  format: string;
  book: any;
  chapterList: Chapter[];
  flattenChapters: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mode: string, format: string) {
    super();
    this.mode = mode;
    this.format = format;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
  }
  getPageSize() {
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
    };
  }
  resolveChapter(href: string) {
    let path = href;

    let chapterIndex = -1;
    for (let index = 0; index < this.flattenChapters.length; index++) {
      if (this.flattenChapters[index].href.includes(path)) {
        chapterIndex = index;
        break;
      }
    }

    if (chapterIndex > -1) {
      return this.flattenChapters[chapterIndex];
    } else {
      let pathWithoutHash = new URL(href).pathname;
      for (let index = 0; index < this.flattenChapters.length; index++) {
        if (
          this.flattenChapters[index].href.includes(
            pathWithoutHash.substring(1)
          )
        ) {
          chapterIndex = index;
          break;
        }
      }
      if (chapterIndex > -1) {
        return this.flattenChapters[chapterIndex];
      } else {
        return null;
      }
    }
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
    this.flattenChapters = newChapter;
    return newChapter;
  }
  getChapter() {
    return this.chapterList;
  }
  getChapterDoc() {
    return this.chapterDocList;
  }
  async goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      await handleScrollPosition(
        this.element,
        this.mode,
        "",
        "",
        chapterHref,
        ""
      );
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToPosition(cfi: string) {
    let { text, chapterDocIndex, chapterTitle, chapterHref, count, page } =
      JSON.parse(cfi);
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format
    );
    await handleScrollPosition(this.element, this.mode, text, count, "", page);
    await this.record();
    this.trigger("rendered");
  }
  async goToNode(node: any) {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc: any = iframe.contentDocument;
    if (!doc) {
      return;
    }

    let targetNode = getCloestBlock(node, this.element);
    let left = targetNode ? convertStyleNum(targetNode.offsetLeft) : 0;
    let top = targetNode ? convertStyleNum(targetNode.offsetTop) : 0;
    if (this.mode !== "scroll") {
      doc.body.scrollTo(left, 0);
    } else {
      this.element.scrollTo(0, top);
    }
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
    if (this.mode === "scroll" || convertStyleNum(doc.body.scrollLeft) === 0) {
      await handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format
      );
      let chapterDocIndex = parseInt(
        StorageUtil.getKookitConfig("chapterDocIndex") || "0"
      );
      if (chapterDocIndex > 0) {
        doc.body.scrollTo(doc.body.scrollWidth, 0);
      }

      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        1,
        this.trigger
      );
    }
    await this.record();
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
        doc.body.scrollWidth -
          convertStyleNum(doc.body.scrollLeft) -
          doc.body.clientWidth
      ) < 10 ||
      this.mode === "scroll"
    ) {
      await handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format
      );
      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        -1,
        this.trigger
      );
    }
    await this.record();
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
      this.mode,
      this.format
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
      this.mode,
      this.format
    );
    await this.record();
    this.trigger("rendered");
  }
  visibleText() {
    return getVisibleText(this.element, this.mode);
  }
  highlightNode(text: string, style: string) {
    handleHighlightNode(this.element, this.mode, text, style);
  }
  async doSearch(keyword: string) {
    return await getSearchResult(keyword, this.chapterDocList);
  }
  async getProgress() {
    return await progressInfo(this.mode);
  }
  async record() {
    let isSliding =
      StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
    if (isSliding) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(
      this.element,
      this.mode,
      this.flatChapter(this.chapterList)
    );
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      chapterDocIndex: StorageUtil.getKookitConfig("chapterDocIndex"),
      chapterHref: StorageUtil.getKookitConfig("chapterHref"),
      count: StorageUtil.getKookitConfig("count"),
      percentage: StorageUtil.getKookitConfig("percentage"),
      page: StorageUtil.getKookitConfig("page"),
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
