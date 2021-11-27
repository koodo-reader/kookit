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
  chapterList: any[];
  largestId: number;
  constructor(dataSource: any[], zip: any, mode: string, format: string) {
    super();

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
  renderImage(id: number) {
    let cap = id + 4 < this.dataSource.length ? id + 4 : this.dataSource.length;
    let bottom = id - 4 > 0 ? id - 4 : 0;
    for (let i = bottom; i < cap; i++) {
      this.parser.renderImage(i);
    }
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
    if (this.largestId - id > 1) {
      return;
    }
    let cap =
      id + 10 < this.dataSource.length - 1
        ? id + 10
        : this.dataSource.length - 1;
    for (let i = id; i < cap; i++) {
      this.parser.renderImage(i);
    }
    this.largestId = id + cap - 1;
  }
  prev() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    if (id > 0) {
      let cap =
        id + 4 < this.dataSource.length ? id + 3 : this.dataSource.length;
      let bottom = id - 4 > 0 ? id - 4 : 0;
      for (let i = bottom; i < cap; i++) {
        this.parser.renderImage(i);
      }
    }
    handleScrollPage(this.element, 1);
    handleRecord(this.element, this.mode);
  }
  next() {
    let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
    if (id < this.dataSource.length - 1) {
      let cap =
        id + 4 < this.dataSource.length - 1
          ? id + 4
          : this.dataSource.length - 1;
      let bottom = id - 4 > 0 ? id - 4 : 0;
      for (let i = bottom; i < cap; i++) {
        this.parser.renderImage(i);
      }
    }
    handleScrollPage(this.element, -1);
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
