import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import StorageUtil from "./utils/storageUtil";
import { excuteCode } from "./utils/htmlUtil";
import EventEmitter from "./utils/EventEmitter";
declare var window: any;
class EpubRender extends EventEmitter {
  epubBuffer: ArrayBuffer;
  mode: string;
  isSliding: boolean;
  bookStr: string;
  rendition: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  epub: any;
  flattenChapters: any;
  constructor(epubBuffer: ArrayBuffer, mode: string, isSliding: boolean) {
    super();
    this.epubBuffer = epubBuffer;
    this.mode = mode;
    this.isSliding = isSliding || false;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
  }
  async renderTo(element: HTMLElement, cfi: string) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }

      this.epub = window.ePub(this.epubBuffer, {});

      this.element = element;
      this.rendition = this.epub.renderTo(this.element, {
        manager: "default",
        flow: this.mode === "scroll" ? "scrolled" : "auto",
        width: "100%",
        height: "100%",
        snap: true,
        spread: this.mode === "single" ? "none" : "",
      });
      this.rendition.hooks.content.register((content) => {
        let section = this.epub.section(content.sectionIndex);
        let mathml = section.properties.includes("mathml");

        if (mathml) {
          return content.addScript(
            navigator.language === "zh-CN"
              ? "https://cdn.bootcdn.net/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js"
              : "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          );
        }
      });

      this.rendition.display(cfi).then(() => {
        this.trigger("rendered");
        resolve();
      });
      this.rendition.on("rendered", () => {
        setTimeout(() => {
          this.trigger("rendered");
        }, 500);
      });
    });
  }
  async getChapter() {
    let chapter = await this.epub.loaded.navigation;
    if (!chapter) return [];
    console.log(chapter.toc);
    this.chapterList = chapter.toc.map((item, index) => {
      return {
        href: item.href,
        title: item.label,
        index: index,
        subitems: item.subitems,
      };
    });
    return this.chapterList;
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
      if (chapters[i].subitems[0]) {
        newChapter.push(chapters[i]);
        newChapter = newChapter.concat(this.flatChapter(chapters[i].subitems));
      } else {
        newChapter.push(chapters[i]);
      }
    }
    return newChapter;
  }
  goToChapter(title: string) {
    if (!this.flattenChapters) {
      this.flattenChapters = this.flatChapter(this.chapterList);
    }

    let href =
      this.flattenChapters[
        _.findLastIndex(
          this.flattenChapters.map((item) => {
            item.title = item.title.trim();
            return item;
          }),
          { title: title.trim() }
        )
      ]?.href;
    this.rendition.display(href);

    this.trigger("rendered");
  }
  async goToPosition(cfiStr: string) {
    let position = JSON.parse(cfiStr) || {};
    this.epub.rendition.display(position.cfi);
    if (position.isFirst) {
      setTimeout(async () => {
        await this.record();
      }, 0);
    } else {
      await this.record();
    }

    this.trigger("rendered");
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  async prev() {
    this.rendition.prev();
    await this.record();

    // this.trigger("rendered");
    this.trigger("page-changed");
  }
  async next() {
    this.rendition.next();
    await this.record();

    // this.trigger("rendered");
    this.trigger("page-changed");
  }
  async visibleText() {
    const currentLocation = this.rendition.currentLocation();
    const cfibase = currentLocation.start.cfi
      .replace(/!.*/, "")
      .replace("epubcfi(", "");
    const cfistart = currentLocation.start.cfi
      .replace(/.*!/, "")
      .replace(/\)/, "");
    const cfiend = currentLocation.end.cfi.replace(/.*!/, "").replace(/\)/, "");
    const cfiRange = `epubcfi(${cfibase}!,${cfistart},${cfiend})`;
    let range = await this.epub.getRange(cfiRange);
    let text = range.toString();
    return text;
  }
  doSearch(keyword: string) {
    return Promise.all(
      this.epub.spine.spineItems.map((item: any) =>
        item
          .load(this.epub.load.bind(this.epub))
          .then(item.find.bind(item, keyword))
          .finally(item.unload.bind(item))
      )
    ).then((results: any) =>
      Promise.resolve(
        [].concat.apply([], results).map((item: any) => {
          item.cfi = JSON.stringify({ cfi: item.cfi });
          return item;
        })
      )
    );
  }
  async getProgress() {
    let currentLocation = this.rendition.currentLocation();

    if (!currentLocation.start) {
      await this.epub.locations.generate();
      currentLocation = this.rendition.currentLocation();
    }
    return {
      currentPage:
        this.mode === "double"
          ? parseInt(currentLocation.start.displayed.page / 2 + "") + 1
          : currentLocation.start.displayed.page,
      totalPage: currentLocation.start.displayed.total,
    };
  }
  async record() {
    let currentLocation = this.rendition.currentLocation();
    let locations = this.epub.locations._locations;
    if (!currentLocation.start || locations.length === 0) {
      locations = await this.epub.locations.generate();
      currentLocation = this.rendition.currentLocation();
    }

    const cfi = currentLocation.start.cfi;
    let percentage = currentLocation.start.percentage;
    let chapterHref = currentLocation.start.href;
    if (!this.flattenChapters) {
      this.flattenChapters = this.flatChapter(this.chapterList);
    }
    let chapter = "Unknown Chapter";
    let chapterDocIndex = "0";
    let currentChapter = this.flattenChapters.filter(
      (item: any) =>
        item.href.indexOf(chapterHref) > -1 ||
        chapterHref.indexOf(item.href) > -1
    )[0];
    if (currentChapter) {
      chapter = currentChapter.title.trim(" ");
      chapterDocIndex = currentChapter.index.toString();
    }
    StorageUtil.setKookitConfig("cfi", cfi);
    StorageUtil.setKookitConfig("percentage", percentage);
    StorageUtil.setKookitConfig("chapterTitle", chapter);
    StorageUtil.setKookitConfig("chapterDocIndex", chapterDocIndex);
  }
  async getPosition() {
    await this.record();

    return {
      cfi: StorageUtil.getKookitConfig("cfi"),
      percentage: StorageUtil.getKookitConfig("percentage"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      chapterDocIndex: StorageUtil.getKookitConfig("chapterDocIndex"),
    };
  }
  getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      let fileSize = this.epubBuffer.byteLength / 1024 / 1024;
      setTimeout(() => {
        resolve("timeout_error");
      }, Math.ceil(fileSize / 10) * 1000);
      this.epub = window.ePub(this.epubBuffer, {});
      let metadata = await this.epub.loaded.metadata;
      let coverUrl = await this.epub.coverUrl();
      try {
        let blob = await fetch(coverUrl).then((r) => r.blob());
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          metadata.cover = reader.result;
          resolve(metadata);
        };
      } catch (error) {
        metadata.cover = "";
        resolve(metadata);
      }
    });
  }
  setStyle(css: string) {
    this.rendition.themes.default(css);
  }
}
export default EpubRender;
