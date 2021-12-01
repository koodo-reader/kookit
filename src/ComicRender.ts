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
      this.renderImage(id);

      let imgRatio = await this.parser.getImgRatio();
      let height =
        (window.frames[0].document.getElementById(id + "") as any).clientWidth *
        imgRatio;
      let imgs = window.frames[0].document.getElementsByTagName("img");
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
  getPageSize() {
    return {
      width: window.frames[0].document.body.scrollWidth,
      height: this.element.clientHeight,
    };
  }
  renderImage(id: number) {
    this.parser.renderImage(id - 1);
    this.parser.renderImage(id);
    this.parser.renderImage(id + 1);
  }
  getChapter() {
    return this.chapterList;
  }
  goToPosition(text: string, title: string, id: string) {
    handleScrollPosition(this.element, this.mode, id);
  }
  goToChapter(title: string) {
    handleScrollPosition(
      this.element,
      this.mode,
      this.dataSource.indexOf(title) + ""
    );
    this.renderImage(this.dataSource.indexOf(title));
  }

  record() {
    handleRecord(this.element, this.mode);

    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    this.parser.renderImage(id - 1);
    this.parser.renderImage(id);
    this.parser.renderImage(id + 1);
  }
  prev() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    this.parser.renderImage(id);
    this.parser.renderImage(id - 1);
    this.parser.renderImage(id - 2);

    handleScrollPage(this.element, 1, this.isSliding);
    handleRecord(this.element, this.mode);
  }
  next() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    this.parser.renderImage(id);
    this.parser.renderImage(id + 1);
    this.parser.renderImage(id + 2);
    this.parser.renderImage(id + 3);
    this.parser.renderImage(id + 4);
    handleScrollPage(this.element, -1, this.isSliding);
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

export default ComicRender;
