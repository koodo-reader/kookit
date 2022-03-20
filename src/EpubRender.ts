import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDom";
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
  async renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      if (!(await excuteCode())) {
        resolve();
        return;
      }

      this.epub = window.ePub(this.epubBuffer, {});
      console.log(this.epub, "window");
      this.element = element;
      this.rendition = this.epub.renderTo(this.element, {
        manager: "default",
        flow: this.mode === "scroll" ? "scrolled" : "auto",
        width: "100%",
        height: "100%",
        snap: true,
        spread: this.mode === "single" ? "none" : "",
      });
      this.rendition.display().then(() => {
        this.trigger("rendered");
        resolve();
      });
    });
  }
  async getChapter() {
    let chapter = await this.epub.loaded.navigation;
    if (!chapter) return [];
    this.chapterList = chapter.toc;
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
    let flattenChapters = this.flatChapter(this.chapterList);
    let href =
      flattenChapters[_.findLastIndex(flattenChapters, { label: title })]?.href;
    this.rendition.display(href);

    this.trigger("rendered");
  }
  goToPosition(cfi: string) {
    this.rendition.display(cfi);
    this.trigger("rendered");
  }
  async prev() {
    this.rendition.prev();
    await this.record();
    // this.trigger("rendered");
  }
  async next() {
    this.rendition.next();
    await this.record();
    // this.trigger("rendered");
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
    ).then((results: any) => Promise.resolve([].concat.apply([], results)));
  }
  getProgress() {
    const currentLocation = this.rendition.currentLocation();
    if (!currentLocation.start) {
      return;
    }
    return {
      prevPage: currentLocation.start.displayed.page,
      nextPage: currentLocation.end.displayed.page,
      totalPage: currentLocation.start.displayed.total,
    };
  }
  async record() {
    const currentLocation = this.rendition.currentLocation();
    if (!currentLocation.start) {
      return;
    }
    const cfi = currentLocation.start.cfi;
    await this.epub.locations.generate();
    let percentage = this.epub.locations.percentageFromCfi(cfi);
    StorageUtil.setKookitConfig("cfi", cfi);
    StorageUtil.setKookitConfig("percentage", percentage);
  }
  async getPosition() {
    const currentLocation = this.rendition.currentLocation();
    if (!currentLocation.start) {
      return;
    }
    await this.epub.locations.generate();
    let percentage = this.epub.locations.percentageFromCfi(
      currentLocation.start.cfi
    );
    return { cfi: currentLocation.start.cfi, percentage: percentage };
  }
  getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      this.epub = window.ePub(this.epubBuffer, {});
      console.log(this.epubBuffer, window);
      let metadata = await this.epub.loaded.metadata;
      let coverUrl = await this.epub.coverUrl();
      let blob = await fetch(coverUrl).then((r) => r.blob());
      var reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        metadata.cover = reader.result;
        resolve(metadata);
      };
    });
  }
  setStyle(css: string) {
    this.rendition.themes.default(css);
  }
}
export default EpubRender;
