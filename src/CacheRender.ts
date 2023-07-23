import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "./libs/cache";
import GeneralParser from "./utils/generalParser";

class CacheRender extends GeneralRender {
  cacheBuffer: ArrayBuffer;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(cacheBuffer: ArrayBuffer, mode: string) {
    super(mode, "CACHE");
    this.cacheBuffer = cacheBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      this.book = await makeCacheBook(this.cacheBuffer);
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
}
export default CacheRender;
