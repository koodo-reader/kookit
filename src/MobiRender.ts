import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralParser from "./utils/generalParser";
import { isMOBI, MOBI } from "./libs/mobi.js";
import GeneralRender from "./GeneralRender";
declare var window: any;
class MobiRender extends GeneralRender {
  mobiBuffer: ArrayBuffer;
  mode: string;
  book: any;
  metadata: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mobiBuffer: ArrayBuffer, mode: string) {
    super(mode, "MOBI");
    this.mobiBuffer = mobiBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      console.log(parser);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
  async parse() {
    let blob = new Blob([this.mobiBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    if (await isMOBI(file)) {
      this.book = await new MOBI({ unzlib: window.fflate.unzlibSync }).open(
        file
      );
      console.log(this.book);
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }
  async getMetadata() {
    if (!this.book) {
      await this.parse();
    }
    let parser = new GeneralParser(this.book);
    return await parser.getMetadata();
  }
}
export default MobiRender;
