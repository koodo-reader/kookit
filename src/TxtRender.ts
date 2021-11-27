import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
import { excuteCode, txtToHtml } from "./utils/htmlUtil";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import {
  handleNextChapter,
  handlePrevChapter,
  handleRecord,
  handleRenderChatper,
  handleScrollPage,
  handleScrollPosition,
} from "./utils/navigationUtil";
import txtParser from "./utils/txtParser";
import EventEmitter from "./utils/EventEmitter";
class TxtRender extends EventEmitter {
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
    super();
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
      if (!(await excuteCode())) {
        resolve();
        return;
      }
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
      createIframe(element);

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

  record() {
    handleRecord(this.element, this.mode);
  }
  prev() {
    if (
      this.mode === "scroll" ||
      window.frames[0].document.body.scrollLeft === 0
    ) {
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
    handleRecord(this.element, this.mode);
  }
  next() {
    if (
      Math.abs(
        window.frames[0].document.body.scrollWidth -
          window.frames[0].document.body.scrollLeft -
          window.frames[0].document.body.clientWidth
      ) < 10 ||
      this.mode === "scroll"
    ) {
      handleNextChapter(
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
    handleRecord(this.element, this.mode);
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

export default TxtRender;
