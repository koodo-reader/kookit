import _ from "underscore";
import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralParser from "./utils/generalParser";
import { excuteCode } from "./utils/htmlUtil";
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
  isSliding: boolean;
  constructor(mobiBuffer: ArrayBuffer, mode: string, isSliding: boolean) {
    super(mode, isSliding);
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
        let parser = new GeneralParser(this.book);
        this.element = element;

        this.chapterList = await parser.getChapter(this.book.toc);
        this.chapterDocList = await parser.getChapterDoc();
        this.metadata = await parser.getMetadata();
        console.log(this.chapterList);
        console.log(this.chapterDocList);
        createIframe(element);
        handleLayout(element, this.mode);
        this.trigger("rendered");
        resolve();
      }
    });
  }
  async getMetadata() {
    let blob = new Blob([this.mobiBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    this.book = await new MOBI({ unzlib: window.fflate.unzlibSync }).open(file);
    let parser = new GeneralParser(this.book);
    return await parser.getMetadata();
  }
}
export default MobiRender;
