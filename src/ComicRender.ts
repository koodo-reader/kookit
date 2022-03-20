import _ from "underscore";
import { excuteCode } from "./utils/htmlUtil";
import {
  createIframe,
  handleIframeHeight,
  handleLayout,
} from "./utils/layoutUtil";
import { handleRecord } from "./utils/navigationUtil";
import StorageUtil from "./utils/storageUtil";
import ComicParser from "./utils/comicParser";
import { handleScrollPage, handleScrollPosition } from "./utils/comicUtil";
import EventEmitter from "./utils/EventEmitter";

class ComicRender extends EventEmitter {
  dataSource: any[];
  zip: any;
  mode: string;
  format: string;
  element: any;
  parser: any;
  isSliding: boolean;
  chapterList: any[];
  largestId: number;
  constructor(
    dataSource: any[],
    zip: any,
    mode: string,
    format: string,
    isSliding: boolean
  ) {
    super();
    this.isSliding = isSliding || false;
    this.mode = mode;
    this.format = format;
    this.zip = zip;
    this.dataSource = dataSource;
    this.element = "";
    this.parser = "";
    this.chapterList = [];
    this.largestId = parseInt(StorageUtil.getKookitConfig("count")) || 0;
  }
  renderTo(element: HTMLElement, id: number = 0) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }

      this.element = element;
      createIframe(element);
      this.parser = new ComicParser(
        this.dataSource,
        this.zip,
        this.mode,
        this.element,
        this.format
      );
      this.chapterList = this.parser.getChapter();
      this.parser.renderComic();
      await this.renderImage(id);
      let pageArea = document.getElementById("page-area");
      if (!pageArea) return;
      let iframe = pageArea.getElementsByTagName("iframe")[0];
      if (!iframe) return;
      let doc = iframe.contentDocument;
      if (!doc) {
        return;
      }
      if (!doc.getElementById(id + "")) {
        return;
      }
      let imgRatio = await this.parser.getImgRatio();
      let height = doc.getElementById(id + "")!.clientWidth * imgRatio;
      let imgs = doc.getElementsByTagName("img");
      for (let i = 0; i < imgs.length; i++) {
        if (this.mode === "scroll") {
          imgs[i].style.height = height + "px";
        } else {
          let scale = this.mode === "single" ? 1 : 2;
          if (height > this.element.clientHeight) {
            imgs[i].style.height = this.element.clientHeight + "px";
            imgs[i].style.width = this.element.clientHeight / imgRatio + "px";
            imgs[i].style.paddingLeft =
              (this.element.clientWidth - (this.mode === "single" ? 0 : 88)) /
                2 /
                scale -
              this.element.clientHeight / imgRatio / 2 +
              "px";
          } else {
            imgs[i].style.height = height + "px";
            imgs[i].style.marginTop =
              this.element.clientHeight / 2 - height / 2 + "px";
          }
        }
      }
      handleLayout(element, this.mode);
      handleIframeHeight(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
  getProgress() {
    return {
      totalPage: this.chapterList.length,
      currentPage: parseInt(StorageUtil.getKookitConfig("count")) || 0,
    };
  }
  getPageSize() {
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
    };
  }
  async renderImage(id: number) {
    await this.parser.renderImage(id - 3);
    await this.parser.renderImage(id - 2);
    await this.parser.renderImage(id - 1);
    await this.parser.renderImage(id);
    await this.parser.renderImage(id + 1);
    await this.parser.renderImage(id + 2);
    await this.parser.renderImage(id + 3);
  }
  getChapter() {
    return this.chapterList;
  }
  goToPosition(cfi: string) {
    let { id } = JSON.parse(cfi);

    handleScrollPosition(this.element, this.mode, id);
  }
  async goToChapter(title: string) {
    handleScrollPosition(
      this.element,
      this.mode,
      this.dataSource.indexOf(title) + ""
    );
    await this.renderImage(this.dataSource.indexOf(title));
  }

  async record() {
    handleRecord(this.element, this.mode);

    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    await this.parser.renderImage(id - 3);
    await this.parser.renderImage(id - 2);
    await this.parser.renderImage(id - 1);
    await this.parser.renderImage(id);
    await this.parser.renderImage(id + 1);
    await this.parser.renderImage(id + 2);
    await this.parser.renderImage(id + 3);
  }
  async prev() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    await this.parser.renderImage(id);
    await this.parser.renderImage(id - 1);
    await this.parser.renderImage(id - 2);
    await this.parser.renderImage(id - 3);
    await this.parser.renderImage(id - 4);

    handleScrollPage(this.element, 1, this.isSliding);

    handleRecord(this.element, this.mode);
  }
  async next() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    await this.parser.renderImage(id);
    await this.parser.renderImage(id + 1);
    await this.parser.renderImage(id + 2);
    await this.parser.renderImage(id + 3);
    await this.parser.renderImage(id + 4);

    handleScrollPage(this.element, -1, this.isSliding);
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

export default ComicRender;
